/**
 * Bundled printer profiles. Sizes are the label (or tape) dimensions as fed through the
 * printer, in mm: `widthMm` across the feed direction, `heightMm` along it.
 */

/** Reasons to show a notice when the profile is selected (i18n keys in the UI). */
export type ProfileCaution =
  /** Too short for a DHL Paketmarke at 100 %; DHL requires full-scale printing. */
  'tooShortForDhl';

export interface PrinterProfile {
  readonly id: string;
  readonly name: string;
  readonly widthMm: number;
  /** null = continuous tape: the page length follows the content. */
  readonly heightMm: number | null;
  /** Unprintable margin on every side, in mm. */
  readonly marginMm: number;
  readonly cautions: readonly ProfileCaution[];
}

export const PROFILES = [
  {
    id: 'label-103x199',
    name: '103 × 199 mm (DHL)',
    widthMm: 103,
    heightMm: 199,
    marginMm: 0,
    cautions: [],
  },
  {
    id: 'label-100x150',
    name: '100 × 150 mm (4 × 6″)',
    widthMm: 100,
    heightMm: 150,
    marginMm: 0,
    cautions: ['tooShortForDhl'],
  },
  {
    id: 'label-103x150',
    name: '103 × 150 mm',
    widthMm: 103,
    heightMm: 150,
    marginMm: 0,
    cautions: ['tooShortForDhl'],
  },
  {
    id: 'dymo-99014',
    name: 'DYMO 99014 (54 × 101 mm)',
    widthMm: 54,
    heightMm: 101,
    marginMm: 0,
    cautions: [],
  },
  {
    id: 'brother-62',
    name: 'Brother 62 mm (endless)',
    widthMm: 62,
    heightMm: null,
    marginMm: 1.5,
    cautions: [],
  },
] as const satisfies readonly PrinterProfile[];

/**
 * Plain A4 sheet for an office printer, used for customs forms that are printed separately
 * from the labels. Not a label-printer profile, so not part of PROFILES.
 */
export const A4_SHEET: PrinterProfile = {
  id: 'a4-sheet',
  name: 'A4',
  widthMm: 210,
  heightMm: 297,
  marginMm: 10,
  cautions: [],
};

export type ProfileId = (typeof PROFILES)[number]['id'];

export function getProfile(id: ProfileId): PrinterProfile {
  const profile = PROFILES.find((p) => p.id === id);
  if (!profile) throw new RangeError(`Unknown profile: ${id}`);
  return profile;
}
