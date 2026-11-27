/**
 * DOM wiring of the web UI. Parsing and rendering happen in the worker; this file only shows
 * results. All text goes through `textContent`.
 */
import type { CustomsFormOutput } from '../core/index.ts';
import type { QuarterTurn } from '../core/geometry.ts';
import { LIMITS } from '../core/limits.ts';
import { PROFILES, getProfile, type ProfileId } from '../profiles/index.ts';
import { detectLang, isMessageKey, t, type Lang } from './i18n.ts';
import {
  isProfileId,
  isWorkerResponse,
  type ErrorCode,
  type ManualRequest,
  type PageImage,
  type PagesRequest,
  type ProcessRequest,
  type ResultResponse,
} from './protocol.ts';
import { defaultSelection, fromMm, toMm, turn, type Box } from './selection.ts';
import { SelectionEditor } from './selectionEditor.ts';
import { applyTheme, carryThemeInLinks, isTheme, themeFromUrl, type Theme } from './theme.ts';
import { browserStorage, forgetSettings, loadSettings, saveSettings } from './settings.ts';
import {
  describeLabel,
  errorMessage,
  hasCustomsForm,
  offersShrink,
  outputFileName,
} from './view.ts';

function element<T extends HTMLElement>(id: string, type: new () => T): T {
  const el = document.getElementById(id);
  if (!(el instanceof type)) throw new Error(`Missing element #${id}`);
  return el;
}

const ui = {
  langToggle: element('lang-toggle', HTMLButtonElement),
  themeSelect: element('theme-select', HTMLSelectElement),
  dropZone: element('drop-zone', HTMLLabelElement),
  fileInput: element('file-input', HTMLInputElement),
  fileName: element('file-name', HTMLParagraphElement),
  profileSelect: element('profile-select', HTMLSelectElement),
  profileCaution: element('profile-caution', HTMLParagraphElement),
  autoProfileCheckbox: element('auto-profile-checkbox', HTMLInputElement),
  customsField: element('customs-field', HTMLDivElement),
  customsSelect: element('customs-select', HTMLSelectElement),
  shrinkField: element('shrink-field', HTMLDivElement),
  shrinkCheckbox: element('shrink-checkbox', HTMLInputElement),
  rememberCheckbox: element('remember-checkbox', HTMLInputElement),
  rememberFailed: element('remember-failed', HTMLParagraphElement),
  manualSection: element('manual-section', HTMLElement),
  manualLoading: element('manual-loading', HTMLParagraphElement),
  manualPageField: element('manual-page-field', HTMLDivElement),
  manualPage: element('manual-page', HTMLSelectElement),
  manualEditor: element('manual-editor', HTMLDivElement),
  manualLeft: element('manual-left', HTMLInputElement),
  manualTop: element('manual-top', HTMLInputElement),
  manualWidth: element('manual-width', HTMLInputElement),
  manualHeight: element('manual-height', HTMLInputElement),
  manualRotateLeft: element('manual-rotate-left', HTMLButtonElement),
  manualRotateRight: element('manual-rotate-right', HTMLButtonElement),
  manualRotation: element('manual-rotation', HTMLSpanElement),
  manualBack: element('manual-back', HTMLButtonElement),
  manualStart: element('manual-start', HTMLButtonElement),
  outputSection: element('output-section', HTMLElement),
  status: element('status', HTMLDivElement),
  labelList: element('label-list', HTMLUListElement),
  labelOutput: element('label-output', HTMLDivElement),
  labelPreviews: element('label-previews', HTMLDivElement),
  labelDownload: element('label-download', HTMLAnchorElement),
  labelOpen: element('label-open', HTMLAnchorElement),
  a4Output: element('a4-output', HTMLDivElement),
  a4Previews: element('a4-previews', HTMLDivElement),
  a4Download: element('a4-download', HTMLAnchorElement),
  a4Open: element('a4-open', HTMLAnchorElement),
  printHint: element('print-hint', HTMLParagraphElement),
};

interface ManualState {
  pageIndex: number;
  box: Box;
  rotation: QuarterTurn;
  /** The user has edited the frame (or it was pre-filled): results can be computed. */
  ready: boolean;
}

interface State {
  lang: Lang;
  file: { name: string; bytes: ArrayBuffer } | null;
  mode: 'auto' | 'manual';
  /** The user picked the format by hand for the current file: no automatic choice. */
  profileLocked: boolean;
  /** Format the worker chose automatically for the current file, if any. */
  autoChosenProfile: ProfileId | null;
  /** Latest crop request (auto or manual); older responses are ignored. */
  requestId: number;
  /** Latest page-rendering request, counted separately from crop requests. */
  pagesRequestId: number;
  pages: readonly PageImage[] | null;
  manual: ManualState | null;
  lastResult: ResultResponse | null;
  lastError: ErrorCode | null;
  objectUrls: string[];
}

const state: State = {
  lang: detectLang(navigator.languages),
  file: null,
  mode: 'auto',
  profileLocked: false,
  autoChosenProfile: null,
  requestId: 0,
  pagesRequestId: 0,
  pages: null,
  manual: null,
  lastResult: null,
  lastError: null,
  objectUrls: [],
};

const worker = new Worker(new URL('./worker.ts', import.meta.url), { type: 'module' });

// ---------------------------------------------------------------- i18n

function applyStaticTexts(): void {
  document.documentElement.lang = state.lang;
  for (const el of document.querySelectorAll<HTMLElement>('[data-i18n]')) {
    const key = el.dataset['i18n'];
    if (key && isMessageKey(key)) el.textContent = t(state.lang, key);
  }
  ui.langToggle.textContent = t(state.lang, 'lang.switch');
  ui.langToggle.setAttribute('aria-label', t(state.lang, 'lang.switchLabel'));
  ui.langToggle.lang = state.lang === 'de' ? 'en' : 'de';
}

function renderProfileOptions(): void {
  const selected = ui.profileSelect.value || PROFILES[0].id;
  ui.profileSelect.replaceChildren(
    ...PROFILES.map((profile) => {
      const option = document.createElement('option');
      option.value = profile.id;
      option.textContent = profile.name;
      option.selected = profile.id === selected;
      return option;
    }),
  );
}

function selectedProfileId(): ProfileId {
  const value = ui.profileSelect.value;
  return isProfileId(value) ? value : PROFILES[0].id;
}

function selectedCustoms(): CustomsFormOutput {
  const value = ui.customsSelect.value;
  return value === 'separateA4' || value === 'omit' ? value : 'withLabels';
}

function renderProfileCaution(): void {
  const profile = getProfile(selectedProfileId());
  const caution = profile.cautions[0];
  ui.profileCaution.hidden = caution === undefined;
  ui.profileCaution.textContent = caution ? t(state.lang, `caution.${caution}`) : '';
}

// ---------------------------------------------------------------- results

function revokeObjectUrls(): void {
  for (const url of state.objectUrls) URL.revokeObjectURL(url);
  state.objectUrls = [];
}

function pdfUrl(bytes: ArrayBuffer): string {
  const url = URL.createObjectURL(new Blob([bytes], { type: 'application/pdf' }));
  state.objectUrls.push(url);
  return url;
}

function showPreviews(container: HTMLElement, bitmaps: readonly ImageBitmap[]): void {
  container.replaceChildren(
    ...bitmaps.map((bitmap, index) => {
      const canvas = document.createElement('canvas');
      canvas.width = bitmap.width;
      canvas.height = bitmap.height;
      canvas.setAttribute('role', 'img');
      canvas.setAttribute('aria-label', t(state.lang, 'output.previewAlt', { page: index + 1 }));
      canvas.getContext('bitmaprenderer')?.transferFromImageBitmap(bitmap);
      return canvas;
    }),
  );
}

function showOutput(
  section: HTMLElement,
  previews: HTMLElement,
  download: HTMLAnchorElement,
  open: HTMLAnchorElement,
  pdf: ArrayBuffer | null,
  bitmaps: readonly ImageBitmap[],
  suffix: string,
): void {
  section.hidden = pdf === null;
  if (!pdf) return;
  const url = pdfUrl(pdf);
  download.href = url;
  download.download = outputFileName(state.file?.name ?? 'label', suffix);
  open.href = url;
  showPreviews(previews, bitmaps);
}

function renderLabelList(result: ResultResponse): void {
  ui.labelList.replaceChildren(
    ...result.labels.map((label) => {
      const view = describeLabel(state.lang, label);
      const item = document.createElement('li');
      const name = document.createElement('span');
      name.className = 'name';
      name.textContent = `${view.name} → ${view.target}`;
      item.append(name);
      for (const line of view.lines) {
        const p = document.createElement('div');
        p.className = line.tone;
        p.textContent = line.text;
        item.append(p);
      }
      return item;
    }),
  );
}

function setStatus(text: string, isError = false): void {
  ui.status.textContent = text;
  ui.status.classList.toggle('error', isError);
}

function clearResults(): void {
  revokeObjectUrls();
  ui.customsField.hidden = true;
  ui.shrinkField.hidden = true;
  ui.labelList.replaceChildren();
  ui.labelPreviews.replaceChildren();
  ui.a4Previews.replaceChildren();
  ui.labelOutput.hidden = true;
  ui.a4Output.hidden = true;
  ui.printHint.hidden = true;
}

function renderResult(): void {
  clearResults();
  ui.outputSection.hidden = state.file === null && state.lastError === null;
  ui.manualStart.hidden = state.mode === 'manual' || state.lastResult === null;
  if (state.lastError) {
    setStatus(errorMessage(state.lang, state.lastError), true);
    return;
  }
  const result = state.lastResult;
  if (!result) {
    const waitingForSelection = state.mode === 'manual' && !state.manual?.ready;
    setStatus(
      waitingForSelection
        ? `${t(state.lang, 'status.noLabel')} ${t(state.lang, 'status.manualPending')}`
        : t(state.lang, 'status.processing'),
    );
    return;
  }
  if (state.mode === 'auto') {
    const chosen =
      state.autoChosenProfile === null
        ? ''
        : ` ${t(state.lang, 'status.profileChosen', { profile: getProfile(state.autoChosenProfile).name })}`;
    setStatus(
      result.labels.length === 0
        ? t(state.lang, 'status.noLabel')
        : `${t(state.lang, 'status.found', { count: result.labels.length })}${chosen}`,
    );
    ui.customsField.hidden = !hasCustomsForm(result.labels);
  } else {
    setStatus('');
  }
  ui.shrinkField.hidden = !offersShrink(result.labels) && !ui.shrinkCheckbox.checked;
  renderLabelList(result);
  showOutput(
    ui.labelOutput,
    ui.labelPreviews,
    ui.labelDownload,
    ui.labelOpen,
    result.pdf,
    result.previews,
    selectedProfileId(),
  );
  showOutput(
    ui.a4Output,
    ui.a4Previews,
    ui.a4Download,
    ui.a4Open,
    result.a4Pdf,
    result.a4Previews,
    'a4',
  );
  ui.printHint.hidden = result.pdf === null && result.a4Pdf === null;
}

// ---------------------------------------------------------------- processing

/** Sends a crop request for the current mode. */
function process(): void {
  if (!state.file) return;
  if (state.mode === 'manual') {
    processManual();
    return;
  }
  state.requestId += 1;
  const request: ProcessRequest = {
    type: 'process',
    id: state.requestId,
    // A copy: the original stays here for re-processing with other settings.
    bytes: state.file.bytes.slice(0),
    profileId: selectedProfileId(),
    allowShrink: ui.shrinkCheckbox.checked,
    customsForms: selectedCustoms(),
    autoProfile: ui.autoProfileCheckbox.checked && !state.profileLocked,
  };
  state.lastResult = null;
  setStatus(t(state.lang, 'status.processing'));
  worker.postMessage(request, [request.bytes]);
}

function processManual(): void {
  if (!state.file || !state.manual?.ready) {
    renderResult();
    return;
  }
  state.requestId += 1;
  const request: ManualRequest = {
    type: 'manual',
    id: state.requestId,
    bytes: state.file.bytes.slice(0),
    profileId: selectedProfileId(),
    allowShrink: ui.shrinkCheckbox.checked,
    pageIndex: state.manual.pageIndex,
    box: state.manual.box,
    rotation: state.manual.rotation,
  };
  setStatus(t(state.lang, 'status.processing'));
  worker.postMessage(request, [request.bytes]);
}

let manualTimer: ReturnType<typeof setTimeout> | undefined;

/** Recomputes the manual crop shortly after the last edit (keyboard repeats, typing). */
function scheduleManual(): void {
  clearTimeout(manualTimer);
  manualTimer = setTimeout(processManual, 250);
}

function requestPages(): void {
  if (!state.file) return;
  state.pagesRequestId += 1;
  const request: PagesRequest = {
    type: 'pages',
    id: state.pagesRequestId,
    bytes: state.file.bytes.slice(0),
  };
  ui.manualLoading.hidden = false;
  worker.postMessage(request, [request.bytes]);
}

worker.addEventListener('message', (event: MessageEvent<unknown>) => {
  const response = event.data;
  if (!isWorkerResponse(response)) return;
  if (response.type === 'pages') {
    if (response.id !== state.pagesRequestId) return;
    for (const page of state.pages ?? []) page.bitmap.close();
    state.pages = response.pages;
    ui.manualLoading.hidden = true;
    showManualPage();
    return;
  }
  if (response.id !== state.requestId) {
    // A pages request may fail too; its error is shown like any other.
    if (!(response.type === 'error' && response.id === state.pagesRequestId)) return;
    ui.manualLoading.hidden = true;
  }
  if (response.type === 'error') {
    state.lastResult = null;
    state.lastError = response.code;
  } else {
    state.lastResult = response;
    state.lastError = null;
    adoptProfile(response.profileId);
    if (state.mode === 'auto' && response.labels.length === 0) enterManual();
  }
  renderResult();
});

/** Shows the format the worker used, if it chose one automatically. */
function adoptProfile(profileId: ProfileId): void {
  if (profileId === selectedProfileId()) return;
  ui.profileSelect.value = profileId;
  state.autoChosenProfile = profileId;
  renderProfileCaution();
}

worker.addEventListener('error', () => {
  state.lastResult = null;
  state.lastError = 'internal';
  renderResult();
});

// ---------------------------------------------------------------- manual cropping

const editor = new SelectionEditor(
  ui.manualEditor,
  t(state.lang, 'manual.frame'),
  (box) => {
    if (!state.manual) return;
    state.manual.box = box;
    syncManualInputs();
  },
  (box) => {
    if (!state.manual) return;
    state.manual.box = box;
    state.manual.ready = true;
    syncManualInputs();
    scheduleManual();
  },
);

function syncManualInputs(): void {
  if (!state.manual) return;
  const mm = toMm(state.manual.box);
  ui.manualLeft.value = String(mm.left);
  ui.manualTop.value = String(mm.top);
  ui.manualWidth.value = String(mm.width);
  ui.manualHeight.value = String(mm.height);
  ui.manualRotation.textContent = t(state.lang, 'manual.rotation', {
    degrees: state.manual.rotation,
  });
}

function renderPageOptions(): void {
  const count = state.pages?.length ?? 0;
  ui.manualPageField.hidden = count < 2;
  ui.manualPage.replaceChildren(
    ...Array.from({ length: count }, (_, index) => {
      const option = document.createElement('option');
      option.value = String(index);
      option.textContent = t(state.lang, 'manual.pageOption', { page: index + 1, count });
      option.selected = index === state.manual?.pageIndex;
      return option;
    }),
  );
}

function showManualPage(): void {
  const manual = state.manual;
  const page = manual ? state.pages?.[manual.pageIndex] : undefined;
  if (!manual || !page) return;
  // Nothing chosen yet: start with a frame in the middle of the page.
  if (!manual.ready) manual.box = defaultSelection(page);
  editor.setPage(page.bitmap, page, manual.box);
  renderPageOptions();
  syncManualInputs();
}

/** Switches to manual mode, pre-filled with a detected label if there is one. */
function enterManual(): void {
  const detected = state.lastResult?.labels.find((l) => l.role === 'shippingLabel');
  state.mode = 'manual';
  state.manual = detected
    ? {
        pageIndex: detected.pageIndex,
        box: detected.contentBox,
        rotation: detected.uprightRotation,
        ready: true,
      }
    : { pageIndex: 0, box: { x0: 0, y0: 0, x1: 1, y1: 1 }, rotation: 0, ready: false };
  // The automatic result no longer applies; the manual crop produces a new one.
  state.lastResult = null;
  ui.manualSection.hidden = false;
  ui.customsField.hidden = true;
  if (state.pages) showManualPage();
  else requestPages();
  if (state.manual.ready) processManual();
  else renderResult();
  ui.manualSection.scrollIntoView({ behavior: 'smooth', block: 'start' });
}

function exitManual(): void {
  state.mode = 'auto';
  state.manual = null;
  ui.manualSection.hidden = true;
  process();
}

ui.manualStart.addEventListener('click', enterManual);
ui.manualBack.addEventListener('click', exitManual);

ui.manualPage.addEventListener('change', () => {
  const index = Number(ui.manualPage.value);
  const page = state.pages?.[index];
  if (!state.manual || !page) return;
  state.manual.pageIndex = index;
  state.manual.box = defaultSelection(page);
  state.manual.ready = false;
  showManualPage();
  renderResult();
});

for (const input of [ui.manualLeft, ui.manualTop, ui.manualWidth, ui.manualHeight]) {
  input.addEventListener('change', () => {
    const manual = state.manual;
    const page = manual ? state.pages?.[manual.pageIndex] : undefined;
    if (!manual || !page) return;
    manual.box = fromMm(
      {
        left: ui.manualLeft.valueAsNumber,
        top: ui.manualTop.valueAsNumber,
        width: ui.manualWidth.valueAsNumber,
        height: ui.manualHeight.valueAsNumber,
      },
      manual.box,
      page,
    );
    manual.ready = true;
    editor.setBox(manual.box);
    syncManualInputs();
    scheduleManual();
  });
}

function rotateManual(direction: 1 | -1): void {
  if (!state.manual) return;
  state.manual.rotation = turn(state.manual.rotation, direction);
  syncManualInputs();
  if (state.manual.ready) scheduleManual();
}
ui.manualRotateLeft.addEventListener('click', () => {
  rotateManual(-1);
});
ui.manualRotateRight.addEventListener('click', () => {
  rotateManual(1);
});

// ---------------------------------------------------------------- file input

async function acceptFile(file: File): Promise<void> {
  for (const page of state.pages ?? []) page.bitmap.close();
  state.pages = null;
  state.manual = null;
  state.mode = 'auto';
  state.profileLocked = false;
  state.autoChosenProfile = null;
  state.lastResult = null;
  state.lastError = null;
  ui.manualSection.hidden = true;
  ui.shrinkCheckbox.checked = false;
  ui.fileName.hidden = false;
  ui.fileName.textContent = t(state.lang, 'file.selected', { name: file.name });
  // Check the size before reading anything into memory.
  if (file.size > LIMITS.maxFileBytes) {
    state.file = null;
    state.lastError = 'fileTooLarge';
    renderResult();
    return;
  }
  state.file = { name: file.name, bytes: await file.arrayBuffer() };
  ui.outputSection.hidden = false;
  process();
}

ui.fileInput.addEventListener('change', () => {
  const file = ui.fileInput.files?.[0];
  if (file) void acceptFile(file);
  ui.fileInput.value = '';
});

for (const type of ['dragenter', 'dragover'] as const) {
  ui.dropZone.addEventListener(type, (event) => {
    event.preventDefault();
    ui.dropZone.classList.add('dragging');
  });
}
for (const type of ['dragleave', 'drop'] as const) {
  ui.dropZone.addEventListener(type, () => {
    ui.dropZone.classList.remove('dragging');
  });
}
ui.dropZone.addEventListener('drop', (event) => {
  event.preventDefault();
  const file = event.dataTransfer?.files[0];
  if (file) void acceptFile(file);
});
// Dropping a file anywhere else must not navigate away and open the PDF in the tab.
window.addEventListener('dragover', (event) => {
  event.preventDefault();
});
window.addEventListener('drop', (event) => {
  event.preventDefault();
});

// ---------------------------------------------------------------- remembered settings

const storage = browserStorage();

/** Writes the current choice, but only while the user has opted in. */
function persistSettings(): void {
  if (!ui.rememberCheckbox.checked) return;
  const saved = saveSettings(storage, {
    profileId: selectedProfileId(),
    customsForms: selectedCustoms(),
    autoProfile: ui.autoProfileCheckbox.checked,
    theme: selectedTheme(),
  });
  ui.rememberFailed.hidden = saved;
  if (!saved) ui.rememberCheckbox.checked = false;
}

function restoreSettings(): void {
  const saved = loadSettings(storage);
  if (!saved) return;
  ui.profileSelect.value = saved.profileId;
  ui.customsSelect.value = saved.customsForms;
  ui.autoProfileCheckbox.checked = saved.autoProfile;
  setTheme(saved.theme);
  ui.rememberCheckbox.checked = true;
}

function selectedTheme(): Theme {
  const value = ui.themeSelect.value;
  return isTheme(value) ? value : 'system';
}

function setTheme(theme: Theme): void {
  ui.themeSelect.value = theme;
  applyTheme(theme);
  // Pass the choice on to the legal pages through their links, without storing it.
  carryThemeInLinks(theme);
}

ui.themeSelect.addEventListener('change', () => {
  setTheme(selectedTheme());
  persistSettings();
});

ui.rememberCheckbox.addEventListener('change', () => {
  if (ui.rememberCheckbox.checked) {
    persistSettings();
  } else {
    forgetSettings(storage);
    ui.rememberFailed.hidden = true;
  }
});

ui.profileSelect.addEventListener('change', () => {
  // A choice by hand wins over the automatic one, for this file.
  state.profileLocked = true;
  state.autoChosenProfile = null;
  renderProfileCaution();
  ui.shrinkCheckbox.checked = false;
  persistSettings();
  process();
});
ui.autoProfileCheckbox.addEventListener('change', () => {
  state.profileLocked = false;
  state.autoChosenProfile = null;
  persistSettings();
  if (ui.autoProfileCheckbox.checked) process();
  else renderResult();
});
ui.customsSelect.addEventListener('change', () => {
  persistSettings();
  process();
});
ui.shrinkCheckbox.addEventListener('change', process);

ui.langToggle.addEventListener('click', () => {
  state.lang = state.lang === 'de' ? 'en' : 'de';
  applyStaticTexts();
  renderProfileCaution();
  editor.setLabel(t(state.lang, 'manual.frame'));
  renderPageOptions();
  syncManualInputs();
  if (state.file) {
    ui.fileName.textContent = t(state.lang, 'file.selected', { name: state.file.name });
    // Preview bitmaps were handed over to their canvases; fetch fresh results.
    process();
  } else {
    renderResult();
  }
});

// ---------------------------------------------------------------- start

/** Features the worker needs (pdf.js 6 and OffscreenCanvas previews). */
function browserSupported(): boolean {
  return (
    typeof OffscreenCanvas !== 'undefined' &&
    typeof createImageBitmap === 'function' &&
    'toHex' in Uint8Array.prototype &&
    'withResolvers' in Promise
  );
}

applyStaticTexts();
renderProfileOptions();
restoreSettings();
// A theme passed along from a legal page wins for this visit (nothing is stored).
setTheme(themeFromUrl(location.search) ?? selectedTheme());
renderProfileCaution();
if (!browserSupported()) {
  ui.fileInput.disabled = true;
  ui.outputSection.hidden = false;
  setStatus(t(state.lang, 'error.unsupportedBrowser'), true);
}
