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
  type CropResult,
  type LabelOutcome,
  type PdfJsLib,
} from '../core/index.ts';
import { getProfile } from '../profiles/index.ts';
import { renderPreviews, type PdfJsRenderLib } from './preview.ts';
import {
  isProcessRequest,
  type ErrorResponse,
  type LabelSummary,
  type ProcessRequest,
  type ResultResponse,
} from './protocol.ts';

(globalThis as { pdfjsWorker?: unknown }).pdfjsWorker = pdfjsWorker;

const pdfjsLib: PdfJsLib = pdfjs;
const renderLib = pdfjs as unknown as PdfJsRenderLib;

function summarize(outcome: LabelOutcome): LabelSummary {
  const { detection, fit, target } = outcome;
  return {
    layoutId: detection.layoutId,
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

async function process(request: ProcessRequest): Promise<ResultResponse> {
  const result: CropResult = await cropLabels(new Uint8Array(request.bytes), pdfjsLib, {
    profile: getProfile(request.profileId),
    allowShrink: request.allowShrink,
    customsForms: request.customsForms,
  });
  const [previews, a4Previews] = await Promise.all([
    result.pdf ? renderPreviews(result.pdf, renderLib) : [],
    result.a4Pdf ? renderPreviews(result.a4Pdf, renderLib) : [],
  ]);
  return {
    type: 'result',
    id: request.id,
    labels: result.labels.map(summarize),
    pdf: result.pdf ? toTransferable(result.pdf) : null,
    a4Pdf: result.a4Pdf ? toTransferable(result.a4Pdf) : null,
    previews,
    a4Previews,
  };
}

self.addEventListener('message', (event: MessageEvent<unknown>) => {
  const request = event.data;
  if (!isProcessRequest(request)) return;
  process(request).then(
    (response) => {
      const transfer: Transferable[] = [...response.previews, ...response.a4Previews];
      if (response.pdf) transfer.push(response.pdf);
      if (response.a4Pdf) transfer.push(response.a4Pdf);
      self.postMessage(response, { transfer });
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
