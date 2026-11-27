/**
 * Processing worker: the only place where untrusted PDFs are parsed (pdf.js and pdf-lib).
 *
 * pdf.js runs in-thread here: registering its worker module on `globalThis.pdfjsWorker` makes
 * pdf.js use it directly instead of spawning a nested worker.
 */
import * as pdfjs from 'pdfjs-dist';
import * as pdfjsWorker from 'pdfjs-dist/build/pdf.worker.mjs';
import {
  ParcelschnittError,
  cropLabels,
  cropManual,
  type CropResult,
  type LabelOutcome,
  type PdfJsLib,
} from '../core/index.ts';
import { normalizeQuarterTurn } from '../core/geometry.ts';
import { getProfile, type ProfileId } from '../profiles/index.ts';
import { renderPreviews, type PdfJsRenderLib } from './preview.ts';
import {
  isManualRequest,
  isPagesRequest,
  isProcessRequest,
  type ErrorResponse,
  type LabelSummary,
  type ManualRequest,
  type PagesRequest,
  type PagesResponse,
  type ProcessRequest,
  type ResultResponse,
  type WorkerRequest,
  type WorkerResponse,
} from './protocol.ts';

(globalThis as { pdfjsWorker?: unknown }).pdfjsWorker = pdfjsWorker;

const pdfjsLib: PdfJsLib = pdfjs;
const renderLib = pdfjs as unknown as PdfJsRenderLib;

function summarize(outcome: LabelOutcome): LabelSummary {
  const { detection, fit, target } = outcome;
  return {
    layoutId: detection.layoutId,
    pageIndex: detection.pageIndex,
    contentBox: detection.contentBox,
    uprightRotation: normalizeQuarterTurn(360 - detection.textAngle),
    role: detection.role,
    target,
    fit: fit.ok
      ? {
          ok: true,
          scale: fit.placement.scale,
          rotation: fit.placement.rotation,
          warnings: fit.warnings,
        }
      : { ok: false, requiredScale: fit.requiredScale },
  };
}

/** Copies into a standalone ArrayBuffer that can be transferred to the main thread. */
function toTransferable(bytes: Uint8Array): ArrayBuffer {
  const copy = new ArrayBuffer(bytes.byteLength);
  new Uint8Array(copy).set(bytes);
  return copy;
}

async function toResponse(id: number, result: CropResult): Promise<ResultResponse> {
  const [previews, a4Previews] = await Promise.all([
    result.pdf ? renderPreviews(result.pdf, renderLib) : [],
    result.a4Pdf ? renderPreviews(result.a4Pdf, renderLib) : [],
  ]);
  return {
    type: 'result',
    id,
    profileId: result.profile.id as ProfileId,
    labels: result.labels.map(summarize),
    pdf: result.pdf ? toTransferable(result.pdf) : null,
    a4Pdf: result.a4Pdf ? toTransferable(result.a4Pdf) : null,
    previews: previews.map((p) => p.bitmap),
    a4Previews: a4Previews.map((p) => p.bitmap),
  };
}

async function processAuto(request: ProcessRequest): Promise<ResultResponse> {
  const result = await cropLabels(new Uint8Array(request.bytes), pdfjsLib, {
    profile: getProfile(request.profileId),
    allowShrink: request.allowShrink,
    customsForms: request.customsForms,
    autoProfile: request.autoProfile,
  });
  return toResponse(request.id, result);
}

async function processManual(request: ManualRequest): Promise<ResultResponse> {
  const result = await cropManual(
    new Uint8Array(request.bytes),
    pdfjsLib,
    { pageIndex: request.pageIndex, box: request.box, rotation: request.rotation },
    { profile: getProfile(request.profileId), allowShrink: request.allowShrink },
  );
  return toResponse(request.id, result);
}

async function renderPages(request: PagesRequest): Promise<PagesResponse> {
  const pages = await renderPreviews(new Uint8Array(request.bytes), renderLib);
  return { type: 'pages', id: request.id, pages };
}

function handle(request: WorkerRequest): Promise<WorkerResponse> {
  switch (request.type) {
    case 'process':
      return processAuto(request);
    case 'manual':
      return processManual(request);
    case 'pages':
      return renderPages(request);
  }
}

function transferables(response: WorkerResponse): Transferable[] {
  switch (response.type) {
    case 'result': {
      const list: Transferable[] = [...response.previews, ...response.a4Previews];
      if (response.pdf) list.push(response.pdf);
      if (response.a4Pdf) list.push(response.a4Pdf);
      return list;
    }
    case 'pages':
      return response.pages.map((p) => p.bitmap);
    case 'error':
      return [];
  }
}

self.addEventListener('message', (event: MessageEvent<unknown>) => {
  const request = event.data;
  if (!isProcessRequest(request) && !isManualRequest(request) && !isPagesRequest(request)) return;
  handle(request).then(
    (response) => {
      self.postMessage(response, { transfer: transferables(response) });
    },
    (error: unknown) => {
      // Only the error code crosses the boundary: messages could contain document details.
      const response: ErrorResponse = {
        type: 'error',
        id: request.id,
        code: error instanceof ParcelschnittError ? error.code : 'internal',
      };
      self.postMessage(response);
    },
  );
});
