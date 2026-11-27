/**
 * DOM wiring of the web UI. Parsing and rendering happen in the worker; this file only shows
 * results. All text goes through `textContent`.
 */
import type { CustomsFormOutput } from '../core/index.ts';
import { LIMITS } from '../core/limits.ts';
import { PROFILES, getProfile, type ProfileId } from '../profiles/index.ts';
import { detectLang, isMessageKey, t, type Lang } from './i18n.ts';
import {
  isProfileId,
  isWorkerResponse,
  type ErrorCode,
  type ProcessRequest,
  type ResultResponse,
} from './protocol.ts';
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
  dropZone: element('drop-zone', HTMLLabelElement),
  fileInput: element('file-input', HTMLInputElement),
  fileName: element('file-name', HTMLParagraphElement),
  profileSelect: element('profile-select', HTMLSelectElement),
  profileCaution: element('profile-caution', HTMLParagraphElement),
  customsField: element('customs-field', HTMLDivElement),
  customsSelect: element('customs-select', HTMLSelectElement),
  shrinkField: element('shrink-field', HTMLDivElement),
  shrinkCheckbox: element('shrink-checkbox', HTMLInputElement),
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

interface State {
  lang: Lang;
  file: { name: string; bytes: ArrayBuffer } | null;
  requestId: number;
  lastResult: ResultResponse | null;
  lastError: ErrorCode | null;
  objectUrls: string[];
}

const state: State = {
  lang: detectLang(navigator.languages),
  file: null,
  requestId: 0,
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
  if (state.lastError) {
    setStatus(errorMessage(state.lang, state.lastError), true);
    return;
  }
  const result = state.lastResult;
  if (!result) {
    setStatus('');
    return;
  }
  if (result.labels.length === 0) {
    setStatus(t(state.lang, 'status.noLabel'));
  } else {
    setStatus(t(state.lang, 'status.found', { count: result.labels.length }));
  }
  ui.customsField.hidden = !hasCustomsForm(result.labels);
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

function process(): void {
  if (!state.file) return;
  state.requestId += 1;
  const request: ProcessRequest = {
    type: 'process',
    id: state.requestId,
    // A copy: the original stays here for re-processing with other settings.
    bytes: state.file.bytes.slice(0),
    profileId: selectedProfileId(),
    allowShrink: ui.shrinkCheckbox.checked,
    customsForms: selectedCustoms(),
  };
  setStatus(t(state.lang, 'status.processing'));
  worker.postMessage(request, [request.bytes]);
}

worker.addEventListener('message', (event: MessageEvent<unknown>) => {
  const response = event.data;
  if (!isWorkerResponse(response) || response.id !== state.requestId) return;
  if (response.type === 'error') {
    state.lastResult = null;
    state.lastError = response.code;
  } else {
    state.lastResult = response;
    state.lastError = null;
  }
  renderResult();
});

worker.addEventListener('error', () => {
  state.lastResult = null;
  state.lastError = 'internal';
  renderResult();
});

async function acceptFile(file: File): Promise<void> {
  state.lastResult = null;
  state.lastError = null;
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
  process();
}

// ---------------------------------------------------------------- events

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

ui.profileSelect.addEventListener('change', () => {
  renderProfileCaution();
  ui.shrinkCheckbox.checked = false;
  process();
});
ui.customsSelect.addEventListener('change', process);
ui.shrinkCheckbox.addEventListener('change', process);

ui.langToggle.addEventListener('click', () => {
  state.lang = state.lang === 'de' ? 'en' : 'de';
  applyStaticTexts();
  renderProfileCaution();
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
renderProfileCaution();
if (!browserSupported()) {
  ui.fileInput.disabled = true;
  setStatus(t(state.lang, 'error.unsupportedBrowser'), true);
}
