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
import { A4_SHEET, type PrinterProfile } from '../profiles/index.ts';
import { manualDetection, type ManualSelection } from './manual.ts';

export { analyzeDocument } from './analyze.ts';
export { detectLabels } from './detect.ts';
export { fitToProfile } from './fit.ts';
export { renderLabels } from './crop.ts';
export { LIMITS } from './limits.ts';
export { MANUAL_LAYOUT_ID, MIN_SELECTION_PT, type ManualSelection } from './manual.ts';
export { ParcelschnittError, type ParcelschnittErrorCode } from './errors.ts';
export type { Detection } from './detection.ts';
export type { FitResult, FitWarning, Placement } from './fit.ts';
export type { PdfJsLib } from './pdfjs.ts';
export type { PageAnalysis } from './types.ts';

/**
 * Where customs forms (CN22) go:
 * - `withLabels`: on the label printer, same profile as the labels (no roll change needed)
 * - `separateA4`: 1:1 on an A4 sheet for an office printer, as a separate PDF
 * - `omit`: not printed (e.g. already attached or handled elsewhere)
 */
export type CustomsFormOutput = 'withLabels' | 'separateA4' | 'omit';

export interface CropOptions {
  readonly profile: PrinterProfile;
  /** Shrink labels that do not fit 1:1. Off by default; always reported as a warning. */
  readonly allowShrink?: boolean;
  /** Default: `withLabels`. */
  readonly customsForms?: CustomsFormOutput;
}

export interface LabelOutcome {
  readonly detection: Detection;
  /** Where this item was placed: the label profile or the A4 sheet. */
  readonly target: 'labelPrinter' | 'a4Sheet';
  readonly fit: FitResult;
}

export interface CropResult {
  /**
   * One entry per detected item that is to be printed (omitted customs forms are not
   * listed). Empty: nothing detected, offer manual cropping.
   */
  readonly labels: readonly LabelOutcome[];
  /** For the label printer: one page per item that fits; null when nothing fits. */
  readonly pdf: Uint8Array | null;
  /** For an office printer: customs forms on A4 (only with `separateA4`). */
  readonly a4Pdf: Uint8Array | null;
}

function fitDetection(
  detection: Detection,
  profile: PrinterProfile,
  allowShrink: boolean,
): FitResult {
  return fitToProfile(
    width(detection.contentBox),
    height(detection.contentBox),
    detection.textAngle,
    profile,
    { allowShrink, requiresFullScale: detection.requiresFullScale },
  );
}

async function renderFitting(
  bytes: Uint8Array,
  pages: Parameters<typeof renderLabels>[1],
  outcomes: readonly LabelOutcome[],
): Promise<Uint8Array | null> {
  const placed: PlacedLabel[] = outcomes.flatMap(({ detection, fit }) =>
    fit.ok ? [{ detection, placement: fit.placement }] : [],
  );
  return placed.length > 0 ? renderLabels(bytes, pages, placed) : null;
}

/** Detects labels in a PDF and crops them to the printer profile. */
export async function cropLabels(
  bytes: Uint8Array,
  pdfjs: PdfJsLib,
  options: CropOptions,
): Promise<CropResult> {
  const customsForms = options.customsForms ?? 'withLabels';
  const allowShrink = options.allowShrink ?? false;
  const pages = await analyzeDocument(bytes, pdfjs);

  const labels: LabelOutcome[] = [];
  for (const detection of detectLabels(pages)) {
    const isCustoms = detection.role === 'customsForm';
    if (isCustoms && customsForms === 'omit') continue;
    // Customs forms on A4 are never shrunk; they always fit.
    labels.push(
      isCustoms && customsForms === 'separateA4'
        ? { detection, target: 'a4Sheet', fit: fitDetection(detection, A4_SHEET, false) }
        : {
            detection,
            target: 'labelPrinter',
            fit: fitDetection(detection, options.profile, allowShrink),
          },
    );
  }

  return {
    labels,
    pdf: await renderFitting(
      bytes,
      pages,
      labels.filter((l) => l.target === 'labelPrinter'),
    ),
    a4Pdf: await renderFitting(
      bytes,
      pages,
      labels.filter((l) => l.target === 'a4Sheet'),
    ),
  };
}

export interface ManualCropOptions {
  readonly profile: PrinterProfile;
  readonly allowShrink?: boolean;
}

/** Crops a user-selected area to the printer profile (no detection involved). */
export async function cropManual(
  bytes: Uint8Array,
  pdfjs: PdfJsLib,
  selection: ManualSelection,
  options: ManualCropOptions,
): Promise<CropResult> {
  const pages = await analyzeDocument(bytes, pdfjs);
  const detection = manualDetection(pages, selection);
  const labels: LabelOutcome[] = [
    {
      detection,
      target: 'labelPrinter',
      fit: fitDetection(detection, options.profile, options.allowShrink ?? false),
    },
  ];
  return { labels, pdf: await renderFitting(bytes, pages, labels), a4Pdf: null };
}
