/**
 * Declarative descriptions of label layouts. Detection is content based: layouts describe
 * markers and features to look for, never fixed page coordinates.
 */

/** Expected size of the printable label content, independent of orientation. */
export interface ExpectedSizeMm {
  readonly long: number;
  readonly short: number;
  /** Accepted deviation per side, in mm. */
  readonly tolerance: number;
}

/**
 * The label sits on one side of a long cut line spanning (almost) the whole page; marker
 * texts identify which side. Small helper graphics (scissors) next to the line are excluded.
 */
export interface CutLineLayout {
  readonly kind: 'cutLine';
  readonly id: string;
  readonly carrier: string;
  /** All of these must appear on the label side (case-insensitive substring match). */
  readonly markers: readonly string[];
  /** Minimum length of the cut line relative to the page extent along it. */
  readonly minCutLineRatio: number;
  /** Graphics within this distance of the cut line, on the label side, may be helpers. */
  readonly helperBandPt: number;
  /** Only graphics up to this size count as helpers (scissors icons). */
  readonly maxHelperSizePt: number;
  /** Known variants of the label size (e.g. national and international). */
  readonly expectedSizesMm: readonly ExpectedSizeMm[];
  /** Carrier requires printing at 100 %. */
  readonly requiresFullScale: boolean;
}

/**
 * The label area is framed by four crop-mark crosses. The crosses themselves are not part
 * of the label; the output is centred on the content between them.
 */
export interface CropMarkLayout {
  readonly kind: 'cropMarks';
  readonly id: string;
  readonly carrier: string;
  /** Length range of a single cross arm, in pt. */
  readonly armLengthPt: { readonly min: number; readonly max: number };
  /** Expected distance between the cross centres. */
  readonly expectedFrameMm: ExpectedSizeMm;
  /** Minimum number of text elements inside the frame. */
  readonly minTextElements: number;
  readonly requiresFullScale: boolean;
}

/**
 * A form with a printed rectangular border (e.g. customs declaration CN22). The border is
 * part of the output; everything outside it (cut lines, instructions) is not.
 */
export interface FramedFormLayout {
  readonly kind: 'framedForm';
  readonly id: string;
  readonly carrier: string;
  /**
   * All of these must appear inside the frame. Matching ignores case and whitespace,
   * so "CN22" also matches "CN 22".
   */
  readonly markers: readonly string[];
  readonly expectedFrameMm: ExpectedSizeMm;
  readonly requiresFullScale: boolean;
}

export type LayoutDescription = CutLineLayout | CropMarkLayout | FramedFormLayout;
