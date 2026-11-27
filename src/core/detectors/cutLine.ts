/**
 * Detector for labels separated from the rest of the page by a long cut line
 * (DHL Paketmarke).
 */
import { center, height, intersect, union, width, type Rect } from '../geometry.ts';
import { extractLines, lineLength, lineRect, type Line } from '../lines.ts';
import { dominantTextAngle, isText, sizeConfidence, type Detection } from '../detection.ts';
import type { CutLineLayout } from '../../layouts/types.ts';
import type { PageAnalysis, PageElement } from '../types.ts';

/** -1: label lies before the line (above / left of it); +1: after it. */
type Side = -1 | 1;

/** Elements covering most of the label side are page backgrounds, not label content. */
const MAX_BACKGROUND_COVERAGE = 0.8;

function sideOf(line: Line, rect: Rect): Side {
  const c = center(rect);
  const coordinate = line.orientation === 'horizontal' ? c.y : c.x;
  return coordinate < line.position ? -1 : 1;
}

function sideRegion(page: PageAnalysis, line: Line, side: Side): Rect {
  if (line.orientation === 'horizontal') {
    return side < 0
      ? { x0: 0, y0: 0, x1: page.width, y1: line.position }
      : { x0: 0, y0: line.position, x1: page.width, y1: page.height };
  }
  return side < 0
    ? { x0: 0, y0: 0, x1: line.position, y1: page.height }
    : { x0: line.position, y0: 0, x1: page.width, y1: page.height };
}

/** Distance from the cut line to the nearest edge of `rect` on the label side. */
function gapToLine(line: Line, side: Side, rect: Rect): number {
  if (line.orientation === 'horizontal') {
    return side < 0 ? line.position - rect.y1 : rect.y0 - line.position;
  }
  return side < 0 ? line.position - rect.x1 : rect.x0 - line.position;
}

function isHelperGraphic(
  element: PageElement,
  line: Line,
  side: Side,
  layout: CutLineLayout,
): boolean {
  if (element.kind === 'text') return false;
  const size = Math.max(width(element.bbox), height(element.bbox));
  return (
    size <= layout.maxHelperSizePt && gapToLine(line, side, element.bbox) <= layout.helperBandPt
  );
}

interface Candidate {
  line: Line;
  side: Side;
  /** Distance between the line and the nearest marker; the closest line wins. */
  distance: number;
}

function findCandidates(
  page: PageAnalysis,
  layout: CutLineLayout,
  markerBoxes: readonly (readonly Rect[])[],
): Candidate[] {
  const candidates: Candidate[] = [];
  for (const line of extractLines(page.elements)) {
    const extent = line.orientation === 'horizontal' ? page.width : page.height;
    if (lineLength(line) < layout.minCutLineRatio * extent) continue;
    for (const side of [-1, 1] as const) {
      const onSide = markerBoxes.map((boxes) => boxes.filter((b) => sideOf(line, b) === side));
      if (onSide.some((boxes) => boxes.length === 0)) continue;
      const distance = Math.min(...onSide.flat().map((b) => Math.abs(gapToLine(line, side, b))));
      candidates.push({ line, side, distance });
    }
  }
  return candidates.sort((a, b) => a.distance - b.distance);
}

export function detectCutLineLabel(page: PageAnalysis, layout: CutLineLayout): Detection[] {
  const texts = page.elements.filter(isText);
  const markerBoxes = layout.markers.map((marker) =>
    texts.filter((t) => t.text.toLowerCase().includes(marker.toLowerCase())).map((t) => t.bbox),
  );
  if (markerBoxes.some((boxes) => boxes.length === 0)) return [];

  const best = findCandidates(page, layout, markerBoxes)[0];
  if (!best) return [];
  const { line, side } = best;
  const region = sideRegion(page, line, side);
  const regionArea = width(region) * height(region);
  const cutLineSources = new Set(line.sources);

  const excluded: Rect[] = [lineRect(line)];
  const members: PageElement[] = [];
  page.elements.forEach((element, index) => {
    if (sideOf(line, element.bbox) !== side) return;
    if (cutLineSources.has(index)) return;
    const visible = intersect(region, element.bbox);
    if (!visible) return;
    if (width(visible) * height(visible) >= MAX_BACKGROUND_COVERAGE * regionArea) return;
    if (isHelperGraphic(element, line, side, layout)) {
      excluded.push(element.bbox);
      return;
    }
    members.push(element);
  });

  const content = union(members.map((m) => m.bbox));
  const contentBox = content ? intersect(content, region) : null;
  if (!contentBox) return [];
  const confidence = sizeConfidence(contentBox, layout.expectedSizesMm);
  if (confidence === null) return [];

  return [
    {
      layoutId: layout.id,
      role: layout.role,
      pageIndex: page.pageIndex,
      confidence,
      contentBox,
      textAngle: dominantTextAngle(members),
      excluded,
      // The other side of the cut line holds the receipt, which the layout expects.
      companionAreas: [sideRegion(page, line, side === -1 ? 1 : -1)],
      requiresFullScale: layout.requiresFullScale,
    },
  ];
}
