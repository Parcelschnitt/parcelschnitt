/**
 * Geometry of the manual selection frame, in PDF points (view space: origin top-left of the
 * displayed page). Pure functions, no DOM: covered by unit tests.
 */
import { MIN_SELECTION_PT } from '../core/manual.ts';

export interface Box {
  readonly x0: number;
  readonly y0: number;
  readonly x1: number;
  readonly y1: number;
}

export interface PageSize {
  readonly widthPt: number;
  readonly heightPt: number;
}

export type Handle = 'nw' | 'ne' | 'sw' | 'se';

const MM_PER_PT = 25.4 / 72;

export { MIN_SELECTION_PT };

const clamp = (value: number, min: number, max: number): number =>
  Math.min(Math.max(value, min), max);

/** Initial frame: the middle 60 % of the page. */
export function defaultSelection(page: PageSize): Box {
  return {
    x0: page.widthPt * 0.2,
    y0: page.heightPt * 0.2,
    x1: page.widthPt * 0.8,
    y1: page.heightPt * 0.8,
  };
}

/** Moves the frame by (dx, dy) without leaving the page; its size never changes. */
export function moveBox(box: Box, dx: number, dy: number, page: PageSize): Box {
  const w = box.x1 - box.x0;
  const h = box.y1 - box.y0;
  const x0 = clamp(box.x0 + dx, 0, page.widthPt - w);
  const y0 = clamp(box.y0 + dy, 0, page.heightPt - h);
  return { x0, y0, x1: x0 + w, y1: y0 + h };
}

/** Drags one corner; the opposite corner stays put. Keeps the minimum size and the page. */
export function resizeBox(box: Box, handle: Handle, dx: number, dy: number, page: PageSize): Box {
  let { x0, y0, x1, y1 } = box;
  if (handle === 'nw' || handle === 'sw') x0 = clamp(x0 + dx, 0, x1 - MIN_SELECTION_PT);
  else x1 = clamp(x1 + dx, x0 + MIN_SELECTION_PT, page.widthPt);
  if (handle === 'nw' || handle === 'ne') y0 = clamp(y0 + dy, 0, y1 - MIN_SELECTION_PT);
  else y1 = clamp(y1 + dy, y0 + MIN_SELECTION_PT, page.heightPt);
  return { x0, y0, x1, y1 };
}

export interface BoxMm {
  readonly left: number;
  readonly top: number;
  readonly width: number;
  readonly height: number;
}

const round1 = (value: number): number => Math.round(value * 10) / 10;

/** For the numeric inputs: millimetres with one decimal. */
export function toMm(box: Box): BoxMm {
  return {
    left: round1(box.x0 * MM_PER_PT),
    top: round1(box.y0 * MM_PER_PT),
    width: round1((box.x1 - box.x0) * MM_PER_PT),
    height: round1((box.y1 - box.y0) * MM_PER_PT),
  };
}

/** From the numeric inputs; invalid numbers keep the previous frame, the page is enforced. */
export function fromMm(values: BoxMm, previous: Box, page: PageSize): Box {
  const numbers = [values.left, values.top, values.width, values.height];
  if (!numbers.every(Number.isFinite)) return previous;
  const w = clamp(values.width / MM_PER_PT, MIN_SELECTION_PT, page.widthPt);
  const h = clamp(values.height / MM_PER_PT, MIN_SELECTION_PT, page.heightPt);
  const x0 = clamp(values.left / MM_PER_PT, 0, page.widthPt - w);
  const y0 = clamp(values.top / MM_PER_PT, 0, page.heightPt - h);
  return { x0, y0, x1: x0 + w, y1: y0 + h };
}

/** Frame position as percentages of the page, for CSS placement over the page image. */
export function toPercent(
  box: Box,
  page: PageSize,
): {
  left: number;
  top: number;
  width: number;
  height: number;
} {
  return {
    left: (box.x0 / page.widthPt) * 100,
    top: (box.y0 / page.heightPt) * 100,
    width: ((box.x1 - box.x0) / page.widthPt) * 100,
    height: ((box.y1 - box.y0) / page.heightPt) * 100,
  };
}

/** Next rotation in 90° steps (clockwise for +1, counter-clockwise for -1). */
export function turn(rotation: 0 | 90 | 180 | 270, direction: 1 | -1): 0 | 90 | 180 | 270 {
  return ((((rotation + direction * 90) % 360) + 360) % 360) as 0 | 90 | 180 | 270;
}
