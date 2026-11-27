import type { FramedFormLayout } from './types.ts';

/**
 * Customs declaration CN22 (Zollinhaltserklärung) as produced by DHL Online-Frankierung for
 * international shipments: a framed form of about 79 x 110 mm, printed upright on a separate
 * page with a cut line and instructions below it.
 */
export const customsCn22: FramedFormLayout = {
  kind: 'framedForm',
  id: 'customs-cn22',
  role: 'customsForm',
  // No own recommendation: customs forms follow the shipping label's profile.
  carrier: 'Deutsche Post / DHL',
  markers: ['CN22'],
  expectedFrameMm: { long: 110, short: 79, tolerance: 5 },
  requiresFullScale: false,
};
