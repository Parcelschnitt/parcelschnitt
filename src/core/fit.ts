/**
 * Places label content on a printer profile: picks the rotation, centres the content and
 * decides whether it fits at 100 %. Content is never shrunk unless the caller explicitly
 * allows it, and shrinking always produces a warning.
 */
import { mmToPt, normalizeQuarterTurn, type QuarterTurn } from './geometry.ts';
import type { PrinterProfile } from '../profiles/index.ts';

/** Rounding slack in pt (0.5 pt ≈ 0.18 mm). */
const FIT_EPSILON = 0.5;

export interface Placement {
  /** Clockwise rotation applied to the content as displayed in the source. */
  readonly rotation: QuarterTurn;
  /** 1 = printed at 100 %. */
  readonly scale: number;
  readonly pageWidthPt: number;
  readonly pageHeightPt: number;
  /** Size of the placed content on the output page (after rotation and scaling). */
  readonly contentWidthPt: number;
  readonly contentHeightPt: number;
  /** Lower-left corner of the placed content in PDF page coordinates. */
  readonly x: number;
  readonly y: number;
}

export type FitWarning =
  | { readonly code: 'scaled'; readonly scale: number }
  | { readonly code: 'carrierRequiresFullScale' };

export type FitResult =
  | { readonly ok: true; readonly placement: Placement; readonly warnings: readonly FitWarning[] }
  | { readonly ok: false; readonly reason: 'doesNotFit'; readonly requiredScale: number };

export interface FitOptions {
  /** Allow shrinking content that does not fit 1:1. Off by default. */
  readonly allowShrink?: boolean;
  /** Carrier demands 100 % (DHL); shrinking then adds an extra warning. */
  readonly requiresFullScale?: boolean;
}

interface Orientation {
  rotation: QuarterTurn;
  width: number;
  height: number;
  /** Largest scale (capped at 1) at which this orientation fits. */
  maxScale: number;
}

/**
 * @param contentWidthPt  content width as displayed in the source
 * @param contentHeightPt content height as displayed in the source
 * @param textAngle       clockwise angle of the source text; 0 = upright
 */
export function fitToProfile(
  contentWidthPt: number,
  contentHeightPt: number,
  textAngle: QuarterTurn,
  profile: PrinterProfile,
  options: FitOptions = {},
): FitResult {
  const margin = mmToPt(profile.marginMm);
  const usableWidth = mmToPt(profile.widthMm) - 2 * margin;
  const usableHeight = profile.heightMm === null ? Infinity : mmToPt(profile.heightMm) - 2 * margin;

  // Prefer upright text; otherwise turn a quarter (clockwise first). Never upside down.
  const upright = normalizeQuarterTurn(360 - textAngle);
  const orientations: Orientation[] = [0, 90, 270].map((extra) => {
    const rotation = normalizeQuarterTurn(upright + extra);
    const swapped = rotation % 180 !== 0;
    const width = swapped ? contentHeightPt : contentWidthPt;
    const height = swapped ? contentWidthPt : contentHeightPt;
    const maxScale = Math.min(
      1,
      (usableWidth + FIT_EPSILON) / width,
      (usableHeight + FIT_EPSILON) / height,
    );
    return { rotation, width, height, maxScale };
  });

  const fullSize = orientations.find((o) => o.maxScale >= 1);
  const best = fullSize ?? [...orientations].sort((a, b) => b.maxScale - a.maxScale)[0];
  if (!best) throw new Error('unreachable: orientations is never empty');

  const warnings: FitWarning[] = [];
  let scale = 1;
  if (!fullSize) {
    if (!options.allowShrink) {
      return { ok: false, reason: 'doesNotFit', requiredScale: best.maxScale };
    }
    scale = best.maxScale;
    warnings.push({ code: 'scaled', scale });
    if (options.requiresFullScale) warnings.push({ code: 'carrierRequiresFullScale' });
  }

  const contentWidth = best.width * scale;
  const contentHeight = best.height * scale;
  const pageWidth = mmToPt(profile.widthMm);
  const pageHeight =
    profile.heightMm === null ? contentHeight + 2 * margin : mmToPt(profile.heightMm);

  return {
    ok: true,
    warnings,
    placement: {
      rotation: best.rotation,
      scale,
      pageWidthPt: pageWidth,
      pageHeightPt: pageHeight,
      contentWidthPt: contentWidth,
      contentHeightPt: contentHeight,
      x: (pageWidth - contentWidth) / 2,
      y: (pageHeight - contentHeight) / 2,
    },
  };
}
