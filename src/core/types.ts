import type { Matrix, Point, QuarterTurn, Rect } from './geometry.ts';

/** A visible piece of text. Coordinates in view space (see geometry.ts). */
export interface TextElement {
  readonly kind: 'text';
  readonly bbox: Rect;
  readonly text: string;
  /** Clockwise angle of the text baseline as seen by the viewer; 0 = upright. */
  readonly angle: QuarterTurn;
}

export interface Segment {
  readonly a: Point;
  readonly b: Point;
}

/** A painted vector path. */
export interface PathElement {
  readonly kind: 'path';
  readonly bbox: Rect;
  readonly stroked: boolean;
  readonly filled: boolean;
  /** Straight segments of the path (curves are omitted). */
  readonly segments: readonly Segment[];
}

export interface ImageElement {
  readonly kind: 'image';
  readonly bbox: Rect;
}

export type PageElement = TextElement | PathElement | ImageElement;

/** Everything the detectors know about one page. */
export interface PageAnalysis {
  readonly pageIndex: number;
  /** Displayed page size in pt (after /Rotate). */
  readonly width: number;
  readonly height: number;
  /** Page /Rotate, clockwise. */
  readonly rotate: QuarterTurn;
  /** Maps PDF user space to view space. */
  readonly viewTransform: Matrix;
  /** Visible elements; anything fully clipped away is not included. */
  readonly elements: readonly PageElement[];
}
