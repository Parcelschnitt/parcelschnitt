/**
 * Manual cropping: the user selects the label area on a page. Used when no layout is
 * detected with confidence, or when the user overrides the detection.
 */
import { ParcelschnittError } from './errors.ts';
import {
  height,
  intersect,
  mmToPt,
  normalizeQuarterTurn,
  width,
  type QuarterTurn,
  type Rect,
} from './geometry.ts';
import type { Detection } from './detection.ts';
import type { PageAnalysis } from './types.ts';

export const MANUAL_LAYOUT_ID = 'manual';

/** Smaller selections are almost certainly mistakes (a stray click). */
export const MIN_SELECTION_PT = mmToPt(10);

export interface ManualSelection {
  readonly pageIndex: number;
  /** Selected area in view space (pt, origin top-left of the displayed page). */
  readonly box: Rect;
  /** Clockwise turn that makes the selected content upright. */
  readonly rotation: QuarterTurn;
}

const isFiniteRect = (r: Rect): boolean =>
  [r.x0, r.y0, r.x1, r.y1].every(Number.isFinite) && r.x0 < r.x1 && r.y0 < r.y1;

/** Turns a user selection into a detection; the selection is clipped to the page. */
export function manualDetection(
  pages: readonly PageAnalysis[],
  selection: ManualSelection,
): Detection {
  const page = Number.isSafeInteger(selection.pageIndex) ? pages[selection.pageIndex] : undefined;
  if (!page) throw new ParcelschnittError('pageOutOfRange', 'The selected page does not exist.');
  const pageBox = { x0: 0, y0: 0, x1: page.width, y1: page.height };
  const box = isFiniteRect(selection.box) ? intersect(selection.box, pageBox) : null;
  if (!box || width(box) < MIN_SELECTION_PT || height(box) < MIN_SELECTION_PT) {
    throw new ParcelschnittError('invalidSelection', 'The selected area is invalid.');
  }
  return {
    layoutId: MANUAL_LAYOUT_ID,
    role: 'shippingLabel',
    pageIndex: page.pageIndex,
    confidence: 1,
    contentBox: box,
    // fitToProfile turns content upright by (360 - textAngle); the user picked `rotation`.
    textAngle: normalizeQuarterTurn(360 - selection.rotation),
    excluded: [],
    companionAreas: [],
    // Unknown carrier: shrinking still warns, but without the DHL-specific notice.
    requiresFullScale: false,
  };
}
