import { dhlPaketmarke } from './dhlPaketmarke.ts';
import { internetmarke } from './internetmarke.ts';
import type { LayoutDescription } from './types.ts';

export type { LayoutDescription, CutLineLayout, CropMarkLayout, ExpectedSizeMm } from './types.ts';
export { dhlPaketmarke, internetmarke };

/** All bundled layouts, in the order they are tried. */
export const LAYOUTS: readonly LayoutDescription[] = [dhlPaketmarke, internetmarke];
