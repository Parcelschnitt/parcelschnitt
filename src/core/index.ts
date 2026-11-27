/**
 * Public API of the Parcelschnitt core. Free of DOM and UI code so it can run in a browser
 * Web Worker, in Node and in the planned desktop app.
 */
import { analyzeDocument } from './analyze.ts';
import { renderLabels, type PlacedLabel } from './crop.ts';
import { detectLabels } from './detect.ts';
import type { Detection } from './detection.ts';
import { fitToProfile, type FitResult } from './fit.ts';
import { height, width } from './geometry.ts';
import type { PdfJsLib } from './pdfjs.ts';
import type { PrinterProfile } from '../profiles/index.ts';

export { analyzeDocument } from './analyze.ts';
export { detectLabels } from './detect.ts';
export { fitToProfile } from './fit.ts';
export { renderLabels } from './crop.ts';
export { LIMITS } from './limits.ts';
export { ParcelschnittError, type ParcelschnittErrorCode } from './errors.ts';
export type { Detection } from './detection.ts';
export type { FitResult, FitWarning, Placement } from './fit.ts';
export type { PdfJsLib } from './pdfjs.ts';
export type { PageAnalysis } from './types.ts';

export interface CropOptions {
  readonly profile: PrinterProfile;
  /** Shrink labels that do not fit 1:1. Off by default; always reported as a warning. */
  readonly allowShrink?: boolean;
}

export interface LabelOutcome {
  readonly detection: Detection;
  readonly fit: FitResult;
}

export interface CropResult {
  /** One entry per detected label. Empty: nothing detected, offer manual cropping. */
  readonly labels: readonly LabelOutcome[];
  /** One page per label that fits; null when no label could be placed. */
  readonly pdf: Uint8Array | null;
}

/** Detects labels in a PDF and crops them to the printer profile. */
export async function cropLabels(
  bytes: Uint8Array,
  pdfjs: PdfJsLib,
  options: CropOptions,
): Promise<CropResult> {
  const pages = await analyzeDocument(bytes, pdfjs);
  const labels = detectLabels(pages).map((detection): LabelOutcome => ({
    detection,
    fit: fitToProfile(
      width(detection.contentBox),
      height(detection.contentBox),
      detection.textAngle,
      options.profile,
      {
        allowShrink: options.allowShrink ?? false,
        requiresFullScale: detection.requiresFullScale,
      },
    ),
  }));
  const placed: PlacedLabel[] = labels.flatMap(({ detection, fit }) =>
    fit.ok ? [{ detection, placement: fit.placement }] : [],
  );
  const pdf = placed.length > 0 ? await renderLabels(bytes, pages, placed) : null;
  return { labels, pdf };
}
