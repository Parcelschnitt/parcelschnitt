import { height, ptToMm, width, type QuarterTurn, type Rect } from './geometry.ts';
import type { ExpectedSizeMm } from '../layouts/types.ts';
import type { PageElement, TextElement } from './types.ts';

/** A label found on a page. */
export interface Detection {
  readonly layoutId: string;
  readonly pageIndex: number;
  /** 0..1; detectors only report matches they are confident about. */
  readonly confidence: number;
  /** Bounding box of the label content in view space (helper graphics excluded). */
  readonly contentBox: Rect;
  /** Clockwise angle of the label text as displayed; 0 = upright. */
  readonly textAngle: QuarterTurn;
  /** Helper graphics that were deliberately left out (scissors, crop marks, cut line). */
  readonly excluded: readonly Rect[];
  readonly requiresFullScale: boolean;
}

/**
 * Largest per-side deviation from the expected size in mm, or null when outside tolerance.
 * Orientation does not matter: the longer side is compared with `expected.long`.
 */
export function sizeDeviationMm(box: Rect, expected: ExpectedSizeMm): number | null {
  const w = ptToMm(width(box));
  const h = ptToMm(height(box));
  const deviation = Math.max(
    Math.abs(Math.max(w, h) - expected.long),
    Math.abs(Math.min(w, h) - expected.short),
  );
  return deviation <= expected.tolerance ? deviation : null;
}

export function confidenceFromDeviation(deviation: number, tolerance: number): number {
  return Math.max(0, Math.min(1, 1 - (0.5 * deviation) / tolerance));
}

/** Text direction shared by most characters; ties resolve to upright. */
export function dominantTextAngle(elements: readonly PageElement[]): QuarterTurn {
  const weights = new Map<QuarterTurn, number>();
  for (const element of elements) {
    if (element.kind !== 'text') continue;
    weights.set(element.angle, (weights.get(element.angle) ?? 0) + element.text.length);
  }
  let best: QuarterTurn = 0;
  let bestWeight = 0;
  for (const angle of [0, 90, 180, 270] as const) {
    const weight = weights.get(angle) ?? 0;
    if (weight > bestWeight) {
      best = angle;
      bestWeight = weight;
    }
  }
  return best;
}

export const isText = (element: PageElement): element is TextElement => element.kind === 'text';
