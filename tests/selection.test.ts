import { describe, expect, it } from 'vitest';
import {
  MIN_SELECTION_PT,
  defaultSelection,
  fromMm,
  moveBox,
  resizeBox,
  toMm,
  toPercent,
  turn,
} from '../src/ui/selection.ts';
import { isManualRequest, isPagesRequest } from '../src/ui/protocol.ts';

const page = { widthPt: 595.28, heightPt: 841.89 }; // A4
const box = { x0: 100, y0: 100, x1: 300, y1: 200 };

describe('selection frame', () => {
  it('starts in the middle of the page', () => {
    const start = defaultSelection(page);
    expect(start.x0).toBeCloseTo(page.widthPt - start.x1);
    expect(start.y0).toBeCloseTo(page.heightPt - start.y1);
  });

  it('moves without changing size and stops at the page edges', () => {
    expect(moveBox(box, 10, -20, page)).toEqual({ x0: 110, y0: 80, x1: 310, y1: 180 });
    const pushed = moveBox(box, -1000, 5000, page);
    expect(pushed.x0).toBe(0);
    expect(pushed.y1).toBeCloseTo(page.heightPt);
    expect(pushed.x1 - pushed.x0).toBe(200);
  });

  it('resizes from each corner while the opposite corner stays', () => {
    expect(resizeBox(box, 'se', 50, 30, page)).toEqual({ x0: 100, y0: 100, x1: 350, y1: 230 });
    expect(resizeBox(box, 'nw', -50, -30, page)).toEqual({ x0: 50, y0: 70, x1: 300, y1: 200 });
    expect(resizeBox(box, 'ne', 10, 10, page)).toEqual({ x0: 100, y0: 110, x1: 310, y1: 200 });
    expect(resizeBox(box, 'sw', 10, 10, page)).toEqual({ x0: 110, y0: 100, x1: 300, y1: 210 });
  });

  it('never gets smaller than the minimum or leaves the page while resizing', () => {
    const tiny = resizeBox(box, 'se', -1000, -1000, page);
    expect(tiny.x1 - tiny.x0).toBeCloseTo(MIN_SELECTION_PT);
    expect(tiny.y1 - tiny.y0).toBeCloseTo(MIN_SELECTION_PT);
    const huge = resizeBox(box, 'nw', -1000, -1000, page);
    expect(huge.x0).toBe(0);
    expect(huge.y0).toBe(0);
  });

  it('converts to millimetres and back', () => {
    const mm = toMm({ x0: 0, y0: 0, x1: 283.46, y1: 535.75 });
    expect(mm).toEqual({ left: 0, top: 0, width: 100, height: 189 });
    const back = fromMm(mm, box, page);
    expect(back.x1 - back.x0).toBeCloseTo(283.46, 1);
  });

  it('keeps the previous frame for invalid input and enforces page and minimum', () => {
    expect(fromMm({ left: Number.NaN, top: 0, width: 50, height: 50 }, box, page)).toBe(box);
    const clamped = fromMm({ left: 500, top: 0, width: 1, height: 9999 }, box, page);
    expect(clamped.x1 - clamped.x0).toBeCloseTo(MIN_SELECTION_PT);
    expect(clamped.x1).toBeLessThanOrEqual(page.widthPt);
    expect(clamped.y1 - clamped.y0).toBeCloseTo(page.heightPt);
  });

  it('places the frame in percent of the page', () => {
    expect(toPercent({ x0: 0, y0: 0, x1: page.widthPt / 2, y1: page.heightPt }, page)).toEqual({
      left: 0,
      top: 0,
      width: 50,
      height: 100,
    });
  });

  it('turns in quarter steps in both directions', () => {
    expect(turn(0, 1)).toBe(90);
    expect(turn(270, 1)).toBe(0);
    expect(turn(0, -1)).toBe(270);
  });
});

describe('manual protocol guards', () => {
  const valid = {
    type: 'manual',
    id: 3,
    bytes: new ArrayBuffer(4),
    profileId: 'dymo-99014',
    allowShrink: false,
    pageIndex: 0,
    box: { x0: 1, y0: 2, x1: 300, y1: 400 },
    rotation: 90,
  };

  it('accepts a valid manual request', () => {
    expect(isManualRequest(valid)).toBe(true);
    expect(isPagesRequest({ type: 'pages', id: 1, bytes: new ArrayBuffer(1) })).toBe(true);
  });

  it.each([
    ['rotation of 45°', { ...valid, rotation: 45 }],
    ['negative page', { ...valid, pageIndex: -1 }],
    ['fractional page', { ...valid, pageIndex: 0.5 }],
    ['infinite box', { ...valid, box: { ...valid.box, x1: Infinity } }],
    ['box as string', { ...valid, box: '1,2,3,4' }],
  ])('rejects %s', (_name, request) => {
    expect(isManualRequest(request)).toBe(false);
  });
});
