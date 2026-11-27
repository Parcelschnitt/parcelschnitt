/**
 * Geometry primitives.
 *
 * All analysis happens in "view space": PDF points, origin at the top-left corner of the page
 * as it is displayed (page /Rotate already applied), y growing downwards. This matches how
 * people describe label layouts ("cut line about 421 pt from the top").
 */

export const PT_PER_MM = 72 / 25.4;

export const mmToPt = (mm: number): number => mm * PT_PER_MM;
export const ptToMm = (pt: number): number => pt / PT_PER_MM;

/** Axis-aligned rectangle. Invariant: x0 <= x1 and y0 <= y1. */
export interface Rect {
  readonly x0: number;
  readonly y0: number;
  readonly x1: number;
  readonly y1: number;
}

export interface Point {
  readonly x: number;
  readonly y: number;
}

/** Affine matrix in PDF order [a, b, c, d, e, f]: x' = a*x + c*y + e, y' = b*x + d*y + f. */
export type Matrix = readonly [number, number, number, number, number, number];

export const IDENTITY: Matrix = [1, 0, 0, 1, 0, 0];

/** Returns the matrix that applies `inner` first, then `outer`. */
export function compose(outer: Matrix, inner: Matrix): Matrix {
  const [a1, b1, c1, d1, e1, f1] = outer;
  const [a2, b2, c2, d2, e2, f2] = inner;
  return [
    a1 * a2 + c1 * b2,
    b1 * a2 + d1 * b2,
    a1 * c2 + c1 * d2,
    b1 * c2 + d1 * d2,
    a1 * e2 + c1 * f2 + e1,
    b1 * e2 + d1 * f2 + f1,
  ];
}

export const determinant = (m: Matrix): number => m[0] * m[3] - m[1] * m[2];

export function invert(m: Matrix): Matrix {
  const [a, b, c, d, e, f] = m;
  const det = determinant(m);
  if (Math.abs(det) < 1e-12) throw new RangeError('Matrix is not invertible');
  return [d / det, -b / det, -c / det, a / det, (c * f - d * e) / det, (b * e - a * f) / det];
}

export function applyToPoint(m: Matrix, x: number, y: number): Point {
  return { x: m[0] * x + m[2] * y + m[4], y: m[1] * x + m[3] * y + m[5] };
}

/** Applies only the linear part of `m` (for direction vectors). */
export function applyToVector(m: Matrix, x: number, y: number): Point {
  return { x: m[0] * x + m[2] * y, y: m[1] * x + m[3] * y };
}

export function rectFromPoints(points: readonly Point[]): Rect {
  let x0 = Infinity;
  let y0 = Infinity;
  let x1 = -Infinity;
  let y1 = -Infinity;
  for (const p of points) {
    x0 = Math.min(x0, p.x);
    y0 = Math.min(y0, p.y);
    x1 = Math.max(x1, p.x);
    y1 = Math.max(y1, p.y);
  }
  return { x0, y0, x1, y1 };
}

/** Bounding box of `rect` after transformation by `m`. */
export function transformRect(m: Matrix, rect: Rect): Rect {
  return rectFromPoints([
    applyToPoint(m, rect.x0, rect.y0),
    applyToPoint(m, rect.x1, rect.y0),
    applyToPoint(m, rect.x0, rect.y1),
    applyToPoint(m, rect.x1, rect.y1),
  ]);
}

export const width = (r: Rect): number => r.x1 - r.x0;
export const height = (r: Rect): number => r.y1 - r.y0;
export const center = (r: Rect): Point => ({ x: (r.x0 + r.x1) / 2, y: (r.y0 + r.y1) / 2 });

export function union(rects: readonly Rect[]): Rect | null {
  if (rects.length === 0) return null;
  return {
    x0: Math.min(...rects.map((r) => r.x0)),
    y0: Math.min(...rects.map((r) => r.y0)),
    x1: Math.max(...rects.map((r) => r.x1)),
    y1: Math.max(...rects.map((r) => r.y1)),
  };
}

export function intersect(a: Rect, b: Rect): Rect | null {
  const r = {
    x0: Math.max(a.x0, b.x0),
    y0: Math.max(a.y0, b.y0),
    x1: Math.min(a.x1, b.x1),
    y1: Math.min(a.y1, b.y1),
  };
  return r.x0 <= r.x1 && r.y0 <= r.y1 ? r : null;
}

export function containsPoint(r: Rect, p: Point, tolerance = 0): boolean {
  return (
    p.x >= r.x0 - tolerance &&
    p.x <= r.x1 + tolerance &&
    p.y >= r.y0 - tolerance &&
    p.y <= r.y1 + tolerance
  );
}

export function expand(r: Rect, by: number): Rect {
  return { x0: r.x0 - by, y0: r.y0 - by, x1: r.x1 + by, y1: r.y1 + by };
}

/** Quarter turns in degrees, clockwise as seen by the viewer. */
export type QuarterTurn = 0 | 90 | 180 | 270;

export function normalizeQuarterTurn(degrees: number): QuarterTurn {
  const q = (((Math.round(degrees / 90) * 90) % 360) + 360) % 360;
  return q as QuarterTurn;
}
