import { PDFDocument, degrees } from 'pdf-lib';
import { describe, expect, it } from 'vitest';
import { detectLabels } from '../src/core/detect.ts';
import { intersect, mmToPt } from '../src/core/geometry.ts';
import { analyze, analyzeSingle, fixture, sizeMm } from './helpers.ts';

async function rotated(name: string, angle: number): Promise<Uint8Array> {
  const doc = await PDFDocument.load(await fixture(name));
  doc.getPage(0).setRotation(degrees(angle));
  return doc.save();
}

describe('DHL Paketmarke detection', () => {
  it('finds exactly one label above the cut line', async () => {
    const detections = detectLabels([await analyzeSingle(await fixture('dhl-paketmarke.pdf'))]);
    expect(detections).toHaveLength(1);
    const [d] = detections;
    expect(d?.layoutId).toBe('dhl-paketmarke');
    expect(d?.requiresFullScale).toBe(true);
    expect(d?.confidence).toBeGreaterThan(0.8);
  });

  it('measures the label content at about 189 x 100 mm, turned', async () => {
    const [d] = detectLabels([await analyzeSingle(await fixture('dhl-paketmarke.pdf'))]);
    if (!d) throw new Error('not detected');
    const { w, h } = sizeMm(d.contentBox);
    expect(w).toBeCloseTo(189, 0);
    expect(h).toBeCloseTo(100, 0);
    expect(d.textAngle).toBe(270);
  });

  it('keeps the label above the cut line and excludes the scissors', async () => {
    const [d] = detectLabels([await analyzeSingle(await fixture('dhl-paketmarke.pdf'))]);
    if (!d) throw new Error('not detected');
    expect(d.contentBox.y1).toBeLessThan(421);
    // cut line + two scissors icons (each several path elements)
    const helpers = d.excluded.filter((r) => r.y1 < 421 && r.y1 > 421 - 15);
    expect(helpers.length).toBeGreaterThanOrEqual(2);
    for (const helper of d.excluded) expect(intersect(helper, d.contentBox)).toBeNull();
  });

  it.each([90, 180, 270])('still detects the label on a page with /Rotate %i', async (angle) => {
    const page = await analyzeSingle(await rotated('dhl-paketmarke.pdf', angle));
    const [d] = detectLabels([page]);
    if (!d) throw new Error('not detected');
    const { w, h } = sizeMm(d.contentBox);
    expect(Math.max(w, h)).toBeCloseTo(189, 0);
    expect(Math.min(w, h)).toBeCloseTo(100, 0);
    expect((d.textAngle + 360 - angle) % 360).toBe(270);
  });
});

describe('Internetmarke detection', () => {
  it('finds the area between the four crop-mark crosses', async () => {
    const detections = detectLabels([await analyzeSingle(await fixture('internetmarke.pdf'))]);
    expect(detections).toHaveLength(1);
    const [d] = detections;
    if (!d) throw new Error('not detected');
    expect(d.layoutId).toBe('internetmarke');
    expect(d.textAngle).toBe(0);
    expect(d.excluded).toHaveLength(4);
  });

  it('centres on the content, not on the crosses', async () => {
    const [d] = detectLabels([await analyzeSingle(await fixture('internetmarke.pdf'))]);
    if (!d) throw new Error('not detected');
    for (const cross of d.excluded) expect(intersect(cross, d.contentBox)).toBeNull();
    const frame = { x0: 36, y0: 82, x1: 36 + mmToPt(90), y1: 82 + mmToPt(47) };
    expect(d.contentBox.x0).toBeGreaterThan(frame.x0);
    expect(d.contentBox.y0).toBeGreaterThan(frame.y0);
    expect(d.contentBox.x1).toBeLessThan(frame.x1);
    expect(d.contentBox.y1).toBeLessThan(frame.y1);
  });
});

describe('no confident match', () => {
  it('reports nothing for a page without a label (manual cropping fallback)', async () => {
    expect(detectLabels(await analyze(await fixture('unrelated.pdf')))).toEqual([]);
  });

  it('does not guess when the markers are present but the cut line is missing', async () => {
    const doc = await PDFDocument.create();
    const page = doc.addPage();
    page.drawText('Leitcode', { x: 50, y: 700 });
    page.drawText('Identcode', { x: 50, y: 650 });
    expect(detectLabels(await analyze(await doc.save()))).toEqual([]);
  });
});
