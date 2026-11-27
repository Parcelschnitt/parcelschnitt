/**
 * Detector for labels framed by four crop-mark crosses (Deutsche Post Internetmarke).
 * Several framed labels on one page are reported separately.
 */
import { center, containsPoint, expand, intersect, union, type Rect } from '../geometry.ts';
import { extractLines, lineLength, lineRect, type Line } from '../lines.ts';
import {
  confidenceFromDeviation,
  dominantTextAngle,
  isText,
  sizeDeviationMm,
  type Detection,
} from '../detection.ts';
import type { CropMarkLayout } from '../../layouts/types.ts';
import type { PageAnalysis, PageElement } from '../types.ts';

/** How far apart two cross centres may be and still count as the same corner. */
const CORNER_TOLERANCE = 2.5;
/** Arms must actually cross: tolerance for the intersection test. */
const CROSSING_TOLERANCE = 1;
/** Clearance around a cross inside which content counts as part of the cross. */
const CROSS_CLEARANCE = 1;

interface Cross {
  x: number;
  y: number;
  box: Rect;
  sources: readonly number[];
}

function findCrosses(lines: readonly Line[], layout: CropMarkLayout): Cross[] {
  const isArm = (line: Line): boolean =>
    lineLength(line) >= layout.armLengthPt.min && lineLength(line) <= layout.armLengthPt.max;
  const horizontal = lines.filter((l) => l.orientation === 'horizontal' && isArm(l));
  const vertical = lines.filter((l) => l.orientation === 'vertical' && isArm(l));

  const crosses: Cross[] = [];
  for (const h of horizontal) {
    for (const v of vertical) {
      const crossing =
        v.position >= h.from - CROSSING_TOLERANCE &&
        v.position <= h.to + CROSSING_TOLERANCE &&
        h.position >= v.from - CROSSING_TOLERANCE &&
        h.position <= v.to + CROSSING_TOLERANCE;
      if (!crossing) continue;
      const duplicate = crosses.some(
        (c) =>
          Math.abs(c.x - v.position) <= CORNER_TOLERANCE &&
          Math.abs(c.y - h.position) <= CORNER_TOLERANCE,
      );
      if (duplicate) continue;
      crosses.push({
        x: v.position,
        y: h.position,
        box: union([lineRect(h), lineRect(v)]) ?? lineRect(h),
        sources: [...h.sources, ...v.sources],
      });
    }
  }
  return crosses;
}

interface Frame {
  rect: Rect;
  corners: readonly Cross[];
  deviation: number;
}

function findFrames(crosses: readonly Cross[], layout: CropMarkLayout): Frame[] {
  const near = (x: number, y: number): Cross | undefined =>
    crosses.find(
      (c) => Math.abs(c.x - x) <= CORNER_TOLERANCE && Math.abs(c.y - y) <= CORNER_TOLERANCE,
    );
  const frames: Frame[] = [];
  for (const topLeft of crosses) {
    for (const bottomRight of crosses) {
      if (bottomRight.x <= topLeft.x + CORNER_TOLERANCE) continue;
      if (bottomRight.y <= topLeft.y + CORNER_TOLERANCE) continue;
      const topRight = near(bottomRight.x, topLeft.y);
      const bottomLeft = near(topLeft.x, bottomRight.y);
      if (!topRight || !bottomLeft) continue;
      const rect = { x0: topLeft.x, y0: topLeft.y, x1: bottomRight.x, y1: bottomRight.y };
      const deviation = sizeDeviationMm(rect, layout.expectedFrameMm);
      if (deviation === null) continue;
      frames.push({ rect, corners: [topLeft, topRight, bottomLeft, bottomRight], deviation });
    }
  }
  // Best fit first; then drop frames overlapping an already chosen one.
  frames.sort(
    (a, b) => a.deviation - b.deviation || a.rect.y0 - b.rect.y0 || a.rect.x0 - b.rect.x0,
  );
  const chosen: Frame[] = [];
  for (const frame of frames) {
    if (chosen.every((c) => intersect(c.rect, frame.rect) === null)) chosen.push(frame);
  }
  return chosen.sort((a, b) => a.rect.y0 - b.rect.y0 || a.rect.x0 - b.rect.x0);
}

export function detectCropMarkLabels(page: PageAnalysis, layout: CropMarkLayout): Detection[] {
  const crosses = findCrosses(extractLines(page.elements), layout);
  const frames = findFrames(crosses, layout);
  const detections: Detection[] = [];

  for (const frame of frames) {
    const crossSources = new Set(frame.corners.flatMap((c) => c.sources));
    const crossZones = frame.corners.map((c) => expand(c.box, CROSS_CLEARANCE));
    const members: PageElement[] = page.elements.filter(
      (element, index) =>
        !crossSources.has(index) &&
        containsPoint(frame.rect, center(element.bbox)) &&
        crossZones.every((zone) => intersect(zone, element.bbox) === null),
    );
    if (members.filter(isText).length < layout.minTextElements) continue;
    const content = union(members.map((m) => m.bbox));
    const contentBox = content ? intersect(content, frame.rect) : null;
    if (!contentBox) continue;

    detections.push({
      layoutId: layout.id,
      pageIndex: page.pageIndex,
      confidence: confidenceFromDeviation(frame.deviation, layout.expectedFrameMm.tolerance),
      contentBox,
      textAngle: dominantTextAngle(members),
      excluded: frame.corners.map((c) => c.box),
      requiresFullScale: layout.requiresFullScale,
    });
  }
  return detections;
}
