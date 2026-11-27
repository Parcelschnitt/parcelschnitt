/**
 * Extracts axis-aligned lines (cut lines, crop-mark arms) from page elements.
 *
 * Lines show up either as stroked path segments or as very thin filled rectangles. Dashed or
 * dotted lines are often drawn as many short pieces; collinear pieces with small gaps are
 * merged back into one line.
 */
import type { Rect } from './geometry.ts';
import type { PageElement } from './types.ts';

export type Orientation = 'horizontal' | 'vertical';

export interface Line {
  readonly orientation: Orientation;
  /** y for horizontal lines, x for vertical ones. */
  readonly position: number;
  readonly from: number;
  readonly to: number;
  /** Indices into the element list this line was built from. */
  readonly sources: readonly number[];
}

export const lineLength = (line: Line): number => line.to - line.from;

export function lineRect(line: Line): Rect {
  return line.orientation === 'horizontal'
    ? { x0: line.from, x1: line.to, y0: line.position, y1: line.position }
    : { x0: line.position, x1: line.position, y0: line.from, y1: line.to };
}

/** Max deviation from perfectly axis-aligned, in pt. */
const AXIS_TOLERANCE = 0.75;
/** Filled shapes thinner than this count as lines. */
const MAX_LINE_THICKNESS = 2;
/** Max gap between dash pieces that still belong to one line. */
const MAX_DASH_GAP = 4;

function rawLines(elements: readonly PageElement[]): Line[] {
  const lines: Line[] = [];
  elements.forEach((element, index) => {
    if (element.kind !== 'path') return;
    const { bbox } = element;
    const w = bbox.x1 - bbox.x0;
    const h = bbox.y1 - bbox.y0;
    if (element.filled && !element.stroked) {
      if (h <= MAX_LINE_THICKNESS && w > h) {
        lines.push({
          orientation: 'horizontal',
          position: (bbox.y0 + bbox.y1) / 2,
          from: bbox.x0,
          to: bbox.x1,
          sources: [index],
        });
      } else if (w <= MAX_LINE_THICKNESS && h > w) {
        lines.push({
          orientation: 'vertical',
          position: (bbox.x0 + bbox.x1) / 2,
          from: bbox.y0,
          to: bbox.y1,
          sources: [index],
        });
      }
      return;
    }
    if (!element.stroked) return;
    for (const { a, b } of element.segments) {
      if (Math.abs(a.y - b.y) <= AXIS_TOLERANCE && a.x !== b.x) {
        lines.push({
          orientation: 'horizontal',
          position: (a.y + b.y) / 2,
          from: Math.min(a.x, b.x),
          to: Math.max(a.x, b.x),
          sources: [index],
        });
      } else if (Math.abs(a.x - b.x) <= AXIS_TOLERANCE && a.y !== b.y) {
        lines.push({
          orientation: 'vertical',
          position: (a.x + b.x) / 2,
          from: Math.min(a.y, b.y),
          to: Math.max(a.y, b.y),
          sources: [index],
        });
      }
    }
  });
  return lines;
}

function mergeCollinear(lines: readonly Line[]): Line[] {
  const sorted = [...lines].sort(
    (p, q) =>
      p.orientation.localeCompare(q.orientation) || p.position - q.position || p.from - q.from,
  );
  const merged: Line[] = [];
  for (const line of sorted) {
    const last = merged.at(-1);
    if (
      last?.orientation === line.orientation &&
      Math.abs(last.position - line.position) <= AXIS_TOLERANCE &&
      line.from <= last.to + MAX_DASH_GAP
    ) {
      merged[merged.length - 1] = {
        ...last,
        to: Math.max(last.to, line.to),
        sources: [...new Set([...last.sources, ...line.sources])],
      };
    } else {
      merged.push(line);
    }
  }
  return merged;
}

/** All axis-aligned lines on the page, dash pieces merged. */
export function extractLines(elements: readonly PageElement[]): Line[] {
  return mergeCollinear(rawLines(elements));
}
