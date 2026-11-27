/**
 * The output embeds the whole source page and clips it to the label: content outside the crop
 * is invisible but still contained in the file. Removing it would need a hand-written
 * content-stream parser, which this project rules out for untrusted PDFs (see CLAUDE.md).
 *
 * Instead, pages are checked for text outside every detected item and outside the areas a
 * layout expects (e.g. the DHL receipt, which repeats the label data). If there is a notable
 * amount, the user is told not to pass the file on.
 */
import { center, containsPoint } from './geometry.ts';
import type { Detection } from './detection.ts';
import type { PageAnalysis } from './types.ts';

/** Below this many characters (whitespace ignored) stray text is not worth a notice. */
export const HIDDEN_TEXT_THRESHOLD_CHARS = 300;

/** Characters of text on `page` outside the given items and their companion areas. */
export function hiddenTextChars(page: PageAnalysis, items: readonly Detection[]): number {
  const covered = items
    .filter((d) => d.pageIndex === page.pageIndex)
    .flatMap((d) => [d.contentBox, ...d.companionAreas]);
  let chars = 0;
  for (const element of page.elements) {
    if (element.kind !== 'text') continue;
    const middle = center(element.bbox);
    if (covered.some((area) => containsPoint(area, middle))) continue;
    chars += element.text.replace(/\s+/g, '').length;
  }
  return chars;
}

export function hasNotableHiddenText(page: PageAnalysis, items: readonly Detection[]): boolean {
  return hiddenTextChars(page, items) > HIDDEN_TEXT_THRESHOLD_CHARS;
}
