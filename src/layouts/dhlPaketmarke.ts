import type { CutLineLayout } from './types.ts';

/**
 * DHL Paketmarke on A4 (identical for eBay, DHL Online-Frankierung and Post-Shop).
 *
 * The label lies rotated by 90° above a full-width cut line with small scissors icons at both
 * ends just above it. Below the line is a receipt for the sender, which is not printed.
 * International labels (e.g. "Päckchen XS - Welt") are a few mm longer than national ones;
 * both fit the 199 mm label.
 */
export const dhlPaketmarke: CutLineLayout = {
  kind: 'cutLine',
  id: 'dhl-paketmarke',
  role: 'shippingLabel',
  carrier: 'DHL',
  markers: ['Leitcode', 'Identcode'],
  minCutLineRatio: 0.8,
  helperBandPt: 15,
  maxHelperSizePt: 30,
  expectedSizesMm: [
    { long: 189, short: 100, tolerance: 4 }, // national
    { long: 197, short: 100, tolerance: 4 }, // international
  ],
  requiresFullScale: true,
};
