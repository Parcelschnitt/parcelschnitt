import { customsCn22 } from './customsCn22.ts';
import { dhlPaketmarke } from './dhlPaketmarke.ts';
import { internetmarke } from './internetmarke.ts';
import type { LayoutDescription } from './types.ts';

export type {
  CropMarkLayout,
  CutLineLayout,
  ExpectedSizeMm,
  FramedFormLayout,
  LayoutDescription,
} from './types.ts';
export { customsCn22, dhlPaketmarke, internetmarke };

/** All bundled layouts, in the order they are tried. */
export const LAYOUTS: readonly LayoutDescription[] = [dhlPaketmarke, internetmarke, customsCn22];
