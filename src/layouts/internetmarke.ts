import type { CropMarkLayout } from './types.ts';

/**
 * Deutsche Post Internetmarke (Brief, Warenpost) printed on A4: four crop-mark crosses around
 * an area of about 90 x 47 mm at the top left of the page.
 */
export const internetmarke: CropMarkLayout = {
  kind: 'cropMarks',
  id: 'internetmarke',
  role: 'shippingLabel',
  carrier: 'Deutsche Post',
  armLengthPt: { min: 8, max: 24 },
  expectedFrameMm: { long: 90, short: 47, tolerance: 10 },
  minTextElements: 1,
  requiresFullScale: false,
};
