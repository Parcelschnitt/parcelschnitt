import { LAYOUTS, type LayoutDescription } from '../layouts/index.ts';
import type { Detection } from './detection.ts';
import { detectCropMarkLabels } from './detectors/cropMarks.ts';
import { detectCutLineLabel } from './detectors/cutLine.ts';
import type { PageAnalysis } from './types.ts';

function detectWithLayout(page: PageAnalysis, layout: LayoutDescription): Detection[] {
  switch (layout.kind) {
    case 'cutLine':
      return detectCutLineLabel(page, layout);
    case 'cropMarks':
      return detectCropMarkLabels(page, layout);
  }
}

/**
 * Finds labels on every page. Layouts are tried in order; the first layout that matches a
 * page wins for that page. Pages without a confident match yield nothing, and the caller
 * falls back to manual cropping. Nothing is guessed.
 */
export function detectLabels(
  pages: readonly PageAnalysis[],
  layouts: readonly LayoutDescription[] = LAYOUTS,
): Detection[] {
  const detections: Detection[] = [];
  for (const page of pages) {
    for (const layout of layouts) {
      const found = detectWithLayout(page, layout);
      if (found.length > 0) {
        detections.push(...found);
        break;
      }
    }
  }
  return detections;
}
