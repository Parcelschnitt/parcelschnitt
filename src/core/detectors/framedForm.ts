/**
 * Detector for forms with a printed rectangular border (customs declaration CN22).
 * The border is built from four lines (or one rectangle path); marker texts must lie inside.
 */
import { center, containsPoint, expand, intersect, mmToPt, union, type Rect } from '../geometry.ts';
import { extractLines, lineLength, type Line } from '../lines.ts';
import {
  confidenceFromDeviation,
  dominantTextAngle,
  isText,
  sizeDeviationMm,
  type Detection,
} from '../detection.ts';
import type { FramedFormLayout } from '../../layouts/types.ts';
import type { PageAnalysis } from '../types.ts';

/** How far frame corners may miss each other, in pt. */
const CORNER_TOLERANCE = 2.5;
/** Slack around the frame so its own stroke width is part of the output. */
const STROKE_SLACK = 2;

const normalize = (text: string): string => text.replace(/\s+/g, '').toLowerCase();

interface Frame {
  rect: Rect;
  deviation: number;
}

function hasEdge(horizontals: readonly Line[], y: number, left: number, right: number): boolean {
  return horizontals.some(
    (h) =>
      Math.abs(h.position - y) <= CORNER_TOLERANCE &&
      h.from <= left + CORNER_TOLERANCE &&
      h.to >= right - CORNER_TOLERANCE,
  );
}

function findFrames(page: PageAnalysis, layout: FramedFormLayout): Frame[] {
  const minEdge = mmToPt(layout.expectedFrameMm.short - layout.expectedFrameMm.tolerance);
  const lines = extractLines(page.elements).filter((l) => lineLength(l) >= minEdge);
  const horizontals = lines.filter((l) => l.orientation === 'horizontal');
  const verticals = lines.filter((l) => l.orientation === 'vertical');

  const frames: Frame[] = [];
  for (const left of verticals) {
    for (const right of verticals) {
      if (right.position <= left.position + minEdge) continue;
      if (Math.abs(left.from - right.from) > CORNER_TOLERANCE) continue;
      if (Math.abs(left.to - right.to) > CORNER_TOLERANCE) continue;
      const rect = { x0: left.position, y0: left.from, x1: right.position, y1: left.to };
      if (!hasEdge(horizontals, rect.y0, rect.x0, rect.x1)) continue;
      if (!hasEdge(horizontals, rect.y1, rect.x0, rect.x1)) continue;
      const deviation = sizeDeviationMm(rect, layout.expectedFrameMm);
      if (deviation !== null) frames.push({ rect, deviation });
    }
  }
  return frames.sort((a, b) => a.deviation - b.deviation);
}

export function detectFramedForm(page: PageAnalysis, layout: FramedFormLayout): Detection[] {
  const texts = page.elements.filter(isText);
  const markers = layout.markers.map(normalize);
  const frame = findFrames(page, layout).find((candidate) =>
    markers.every((marker) =>
      texts.some(
        (t) => normalize(t.text).includes(marker) && containsPoint(candidate.rect, center(t.bbox)),
      ),
    ),
  );
  if (!frame) return [];

  const outer = expand(frame.rect, STROKE_SLACK);
  const members = page.elements.filter((e) => containsPoint(outer, center(e.bbox)));
  const content = union(members.map((m) => m.bbox));
  const contentBox = content ? intersect(content, outer) : null;
  if (!contentBox) return [];

  return [
    {
      layoutId: layout.id,
      role: layout.role,
      pageIndex: page.pageIndex,
      confidence: confidenceFromDeviation(frame.deviation, layout.expectedFrameMm.tolerance),
      contentBox,
      textAngle: dominantTextAngle(members),
      excluded: [],
      companionAreas: [],
      requiresFullScale: layout.requiresFullScale,
    },
  ];
}
