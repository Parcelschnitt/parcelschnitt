/**
 * Turns a PDF page into a list of visible elements in view space.
 *
 * Geometry comes from the pdf.js operator list (paths, images, form XObjects, clipping) and
 * from pdf.js text content. No PDF syntax is parsed here.
 */
import {
  IDENTITY,
  applyToPoint,
  applyToVector,
  compose,
  intersect,
  center,
  containsPoint,
  determinant,
  expand,
  normalizeQuarterTurn,
  rectFromPoints,
  transformRect,
  type Matrix,
  type Point,
  type Rect,
} from './geometry.ts';
import { ParcelschnittError } from './errors.ts';
import { assertAcceptableInput, assertPageCount } from './limits.ts';
import { safeDocumentParams, type PdfJsLib, type PdfJsPage } from './pdfjs.ts';
import type { PageAnalysis, PageElement, PathElement, Segment, TextElement } from './types.ts';

/** pdf.js DrawOPS codes inside constructPath data. */
const DRAW_OP = { moveTo: 0, lineTo: 1, curveTo: 2, quadraticCurveTo: 3, closePath: 4 } as const;

/**
 * Glyph box relative to the font size. Generous on purpose: accents (Ä, Ü) reach above the
 * cap height, and a crop that clips a glyph is worse than a fraction of a mm of white space.
 */
const TEXT_DESCENT = 0.25;
const TEXT_ASCENT = 0.95;

interface GraphicsState {
  ctm: Matrix;
  lineWidth: number;
  /** Visible region in view space; null = unclipped. */
  clip: Rect | null;
}

function isNumberArray(value: unknown, length?: number): value is readonly number[] {
  if (!(Array.isArray(value) || ArrayBuffer.isView(value))) return false;
  const arr = Array.from(value as ArrayLike<unknown>);
  if (length !== undefined && arr.length !== length) return false;
  return arr.every((item) => typeof item === 'number');
}

function asMatrix(value: unknown): Matrix | null {
  if (!isNumberArray(value, 6)) return null;
  const [a = 1, b = 0, c = 0, d = 1, e = 0, f = 0] = Array.from(value);
  return [a, b, c, d, e, f];
}

function asRect(value: unknown): Rect | null {
  if (!isNumberArray(value, 4)) return null;
  const [x0 = 0, y0 = 0, x1 = 0, y1 = 0] = Array.from(value);
  return { x0: Math.min(x0, x1), y0: Math.min(y0, y1), x1: Math.max(x0, x1), y1: Math.max(y0, y1) };
}

/** A clip region that nothing intersects (x0 > x1), used when clips do not overlap. */
const EMPTY_CLIP: Rect = { x0: 1, y0: 1, x1: 0, y1: 0 };

function clipWith(state: GraphicsState, region: Rect): void {
  state.clip = state.clip ? (intersect(state.clip, region) ?? EMPTY_CLIP) : region;
}

/** Splits pdf.js path data into straight segments in view space. */
function pathSegments(data: readonly number[], toView: Matrix): Segment[] {
  const segments: Segment[] = [];
  let current: Point | null = null;
  let start: Point | null = null;
  let i = 0;
  const next = (): number => data[i++] ?? 0;
  while (i < data.length) {
    const op = next();
    switch (op) {
      case DRAW_OP.moveTo:
        current = applyToPoint(toView, next(), next());
        start = current;
        break;
      case DRAW_OP.lineTo: {
        const p = applyToPoint(toView, next(), next());
        if (current) segments.push({ a: current, b: p });
        current = p;
        break;
      }
      case DRAW_OP.curveTo:
        i += 4;
        current = applyToPoint(toView, next(), next());
        break;
      case DRAW_OP.quadraticCurveTo:
        i += 2;
        current = applyToPoint(toView, next(), next());
        break;
      case DRAW_OP.closePath:
        if (current && start && (current.x !== start.x || current.y !== start.y)) {
          segments.push({ a: current, b: start });
        }
        current = start;
        break;
      default:
        // Unknown op code: stop rather than misinterpret the rest of the data.
        return segments;
    }
  }
  return segments;
}

interface OperatorScan {
  elements: PageElement[];
  /** Clip regions that were active whenever text was shown. */
  textClips: (Rect | null)[];
}

function scanOperators(
  ops: Readonly<Record<string, number>>,
  fnArray: readonly number[],
  argsArray: readonly unknown[],
  viewTransform: Matrix,
): OperatorScan {
  const op = (name: string): number => ops[name] ?? -1;
  const PAINT_STROKE = new Set(['stroke', 'closeStroke'].map(op));
  const PAINT_FILL = new Set(['fill', 'eoFill'].map(op));
  const PAINT_BOTH = new Set(
    ['fillStroke', 'eoFillStroke', 'closeFillStroke', 'closeEOFillStroke'].map(op),
  );
  const SHOW_TEXT = new Set(
    ['showText', 'showSpacedText', 'nextLineShowText', 'nextLineSetSpacingShowText'].map(op),
  );
  const PAINT_IMAGE = new Set(
    [
      'paintImageXObject',
      'paintInlineImageXObject',
      'paintImageMaskXObject',
      'paintSolidColorImageMask',
      'paintImageXObjectRepeat',
      'paintImageMaskXObjectRepeat',
    ].map(op),
  );
  const CLIP = new Set(['clip', 'eoClip'].map(op));

  const elements: PageElement[] = [];
  const textClips: (Rect | null)[] = [];
  const stack: GraphicsState[] = [];
  let state: GraphicsState = { ctm: IDENTITY, lineWidth: 1, clip: null };
  let pendingClip = false;
  let lastPathBox: Rect | null = null;

  const toView = (): Matrix => compose(viewTransform, state.ctm);
  const push = (): void => {
    stack.push({ ...state });
  };
  const pop = (): void => {
    state = stack.pop() ?? { ctm: IDENTITY, lineWidth: 1, clip: null };
  };

  for (let index = 0; index < fnArray.length; index++) {
    const fn = fnArray[index];
    const args = argsArray[index];
    const argList = Array.isArray(args) ? (args as unknown[]) : [];

    if (fn === op('save')) {
      push();
    } else if (fn === op('restore')) {
      pop();
    } else if (fn === op('setLineWidth')) {
      const [lineWidth] = argList;
      if (typeof lineWidth === 'number' && lineWidth >= 0) state.lineWidth = lineWidth;
    } else if (fn === op('transform')) {
      const m = asMatrix(argList);
      if (m) state.ctm = compose(state.ctm, m);
    } else if (fn === op('paintFormXObjectBegin')) {
      push();
      const m = asMatrix(argList[0]);
      if (m) state.ctm = compose(state.ctm, m);
      const bbox = asRect(argList[1]);
      if (bbox) clipWith(state, transformRect(toView(), bbox));
    } else if (fn === op('paintFormXObjectEnd')) {
      pop();
    } else if (fn !== undefined && CLIP.has(fn)) {
      // pdf.js may emit the clip operator before or after the path it applies to.
      if (lastPathBox) clipWith(state, lastPathBox);
      else pendingClip = true;
    } else if (fn === op('constructPath')) {
      const paintOp = argList[0];
      const pathData = Array.isArray(argList[1]) ? (argList[1] as unknown[])[0] : undefined;
      const minMax = asRect(argList[2]);
      const box = minMax ? transformRect(toView(), minMax) : null;
      const halfStroke = (state.lineWidth / 2) * Math.sqrt(Math.abs(determinant(toView())));
      lastPathBox = box;
      if (pendingClip && box) {
        clipWith(state, box);
        pendingClip = false;
        lastPathBox = null;
      }
      if (typeof paintOp !== 'number' || !box) continue;
      const stroked = PAINT_STROKE.has(paintOp) || PAINT_BOTH.has(paintOp);
      const filled = PAINT_FILL.has(paintOp) || PAINT_BOTH.has(paintOp);
      if (!stroked && !filled) continue; // endPath: clipping path only, nothing painted
      const painted = stroked ? expand(box, halfStroke) : box;
      const visible = state.clip ? intersect(state.clip, painted) : painted;
      if (!visible) continue;
      const element: PathElement = {
        kind: 'path',
        bbox: visible,
        stroked,
        filled,
        segments: isNumberArray(pathData) ? pathSegments(pathData, toView()) : [],
      };
      elements.push(element);
      continue;
    } else if (fn !== undefined && PAINT_IMAGE.has(fn)) {
      const box = transformRect(toView(), { x0: 0, y0: 0, x1: 1, y1: 1 });
      const visible = state.clip ? intersect(state.clip, box) : box;
      if (visible) elements.push({ kind: 'image', bbox: visible });
    } else if (fn !== undefined && SHOW_TEXT.has(fn)) {
      textClips.push(state.clip);
    }
    if (fn !== op('constructPath')) lastPathBox = null;
  }
  return { elements, textClips };
}

interface RawTextItem {
  str: string;
  transform: Matrix;
  width: number;
  height: number;
}

function isRawTextItem(
  item: unknown,
): item is { str: string; transform: unknown; width: unknown; height: unknown } {
  return typeof item === 'object' && item !== null && 'str' in item && typeof item.str === 'string';
}

function toRawTextItem(item: unknown): RawTextItem | null {
  if (!isRawTextItem(item)) return null;
  const transform = asMatrix(item.transform);
  if (!transform || typeof item.width !== 'number' || typeof item.height !== 'number') return null;
  return { str: item.str, transform, width: item.width, height: item.height };
}

function textElement(item: RawTextItem, viewTransform: Matrix): TextElement | null {
  if (item.str.trim() === '') return null;
  const [a, b, c, d, e, f] = item.transform;
  const uLen = Math.hypot(a, b);
  const vLen = Math.hypot(c, d);
  if (uLen === 0 || vLen === 0) return null;
  const u = { x: a / uLen, y: b / uLen };
  const v = { x: c / vLen, y: d / vLen };
  const size = item.height > 0 ? item.height : vLen;
  const corner = (along: number, up: number): Point =>
    applyToPoint(viewTransform, e + u.x * along + v.x * up, f + u.y * along + v.y * up);
  const bbox = rectFromPoints([
    corner(0, -TEXT_DESCENT * size),
    corner(item.width, -TEXT_DESCENT * size),
    corner(0, TEXT_ASCENT * size),
    corner(item.width, TEXT_ASCENT * size),
  ]);
  const direction = applyToVector(viewTransform, u.x, u.y);
  const angle = normalizeQuarterTurn((Math.atan2(direction.y, direction.x) * 180) / Math.PI);
  return { kind: 'text', bbox, text: item.str, angle };
}

/**
 * Text content from pdf.js carries no clipping information. Text counts as visible when its
 * centre lies inside a clip region that was active while text was shown (or when there was
 * no clipping at all). This is exact for the documents we produce and read.
 */
function clipText(text: TextElement, textClips: readonly (Rect | null)[]): TextElement | null {
  if (textClips.length === 0 || textClips.includes(null)) return text;
  for (const clip of textClips) {
    if (clip && containsPoint(clip, center(text.bbox), 0.5)) {
      const bbox = intersect(clip, text.bbox);
      return bbox ? { ...text, bbox } : null;
    }
  }
  return null;
}

export async function analyzePage(
  page: PdfJsPage,
  pageIndex: number,
  ops: Readonly<Record<string, number>>,
): Promise<PageAnalysis> {
  const viewport = page.getViewport({ scale: 1 });
  const viewTransform = asMatrix(viewport.transform) ?? IDENTITY;
  const [operatorList, textContent] = await Promise.all([
    page.getOperatorList(),
    page.getTextContent(),
  ]);
  const scan = scanOperators(ops, operatorList.fnArray, operatorList.argsArray, viewTransform);
  const texts = textContent.items
    .map(toRawTextItem)
    .map((item) => (item ? textElement(item, viewTransform) : null))
    .map((text) => (text ? clipText(text, scan.textClips) : null))
    .filter((text): text is TextElement => text !== null);

  return {
    pageIndex,
    width: viewport.width,
    height: viewport.height,
    rotate: normalizeQuarterTurn(page.rotate),
    viewTransform,
    elements: [...texts, ...scan.elements],
  };
}

/** Loads a PDF with hardened pdf.js settings and analyses every page. */
export async function analyzeDocument(bytes: Uint8Array, pdfjs: PdfJsLib): Promise<PageAnalysis[]> {
  assertAcceptableInput(bytes);
  const task = pdfjs.getDocument(safeDocumentParams(bytes));
  try {
    let doc;
    try {
      doc = await task.promise;
    } catch {
      throw new ParcelschnittError('unreadablePdf', 'The PDF could not be read.');
    }
    assertPageCount(doc.numPages);
    const pages: PageAnalysis[] = [];
    for (let n = 1; n <= doc.numPages; n++) {
      pages.push(await analyzePage(await doc.getPage(n), n - 1, pdfjs.OPS));
    }
    return pages;
  } finally {
    await task.destroy();
  }
}
