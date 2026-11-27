import { PDFDocument, degrees } from '@cantoo/pdf-lib';
import { describe, expect, it } from 'vitest';
import { cropLabels, cropManual, MIN_SELECTION_PT, type CropResult } from '../src/core/index.ts';
import { detectLabels } from '../src/core/detect.ts';
import { dominantTextAngle } from '../src/core/detection.ts';
import { height, mmToPt, ptToMm, width, type Rect } from '../src/core/geometry.ts';
import { getProfile } from '../src/profiles/index.ts';
import { analyze, analyzeSingle, fixture, pdfjs, visibleBox } from './helpers.ts';

const profile = getProfile('label-103x199');

async function dhlContentBox(bytes: Uint8Array): Promise<Rect> {
  const [d] = detectLabels([await analyzeSingle(bytes)]);
  if (!d) throw new Error('not detected');
  return d.contentBox;
}

describe('manual cropping', () => {
  it('crops a selected area at 100 % and turns it as chosen', async () => {
    const bytes = await fixture('dhl-paketmarke.pdf');
    const box = await dhlContentBox(bytes);
    const result = await cropManual(bytes, pdfjs, { pageIndex: 0, box, rotation: 90 }, { profile });
    const [label] = result.labels;
    expect(label?.detection.layoutId).toBe('manual');
    expect(label?.fit.ok && label.fit.placement.scale).toBe(1);
    if (!result.pdf) throw new Error('no output');
    const [page] = await analyze(result.pdf);
    const out = visibleBox(page?.elements ?? []);
    expect(Math.abs(width(out) - height(box))).toBeLessThan(1);
    expect(Math.abs(height(out) - width(box))).toBeLessThan(1);
    expect(dominantTextAngle(page?.elements ?? [])).toBe(0);
  });

  it('gives the same output as detection for the same area', async () => {
    const bytes = await fixture('dhl-paketmarke.pdf');
    const box = await dhlContentBox(bytes);
    const manual = await cropManual(bytes, pdfjs, { pageIndex: 0, box, rotation: 90 }, { profile });
    const auto = await cropLabels(bytes, pdfjs, { profile });
    const placementOf = (r: CropResult) => {
      const [l] = r.labels;
      return l?.fit.ok ? l.fit.placement : null;
    };
    expect(placementOf(manual)).not.toBeNull();
    expect(placementOf(manual)).toEqual(placementOf(auto));
  });

  it('only shows what lies inside the selection', async () => {
    const bytes = await fixture('internetmarke.pdf');
    // Only the upper half of the stamp area.
    const box = { x0: 40, y0: 85, x1: 40 + mmToPt(85), y1: 85 + mmToPt(15) };
    const result = await cropManual(bytes, pdfjs, { pageIndex: 0, box, rotation: 0 }, { profile });
    if (!result.pdf) throw new Error('no output');
    const [page] = await analyze(result.pdf);
    const out = visibleBox(page?.elements ?? []);
    expect(width(out)).toBeLessThanOrEqual(width(box) + 0.5);
    expect(height(out)).toBeLessThanOrEqual(height(box) + 0.5);
    const shown = (page?.elements ?? []).flatMap((e) => (e.kind === 'text' ? [e.text] : []));
    expect(shown.join(' ')).not.toContain('MUSTERMANN');
  });

  it('respects page rotation (/Rotate)', async () => {
    const doc = await PDFDocument.load(await fixture('dhl-paketmarke.pdf'));
    doc.getPage(0).setRotation(degrees(90));
    const bytes = await doc.save();
    const box = await dhlContentBox(bytes);
    // On a page shown turned by 90°, the label text already runs left to right.
    const result = await cropManual(bytes, pdfjs, { pageIndex: 0, box, rotation: 0 }, { profile });
    if (!result.pdf) throw new Error('no output');
    const [page] = await analyze(result.pdf);
    expect(dominantTextAngle(page?.elements ?? [])).toBe(0);
    expect(ptToMm(height(visibleBox(page?.elements ?? [])))).toBeCloseTo(189, 0);
  });

  it('does not shrink without permission', async () => {
    const bytes = await fixture('dhl-paketmarke.pdf');
    const box = await dhlContentBox(bytes);
    const selection = { pageIndex: 0, box, rotation: 90 } as const;
    const small = getProfile('label-100x150');
    const refused = await cropManual(bytes, pdfjs, selection, { profile: small });
    expect(refused.pdf).toBeNull();
    expect(refused.labels[0]?.fit).toMatchObject({ ok: false, reason: 'doesNotFit' });
    const shrunk = await cropManual(bytes, pdfjs, selection, { profile: small, allowShrink: true });
    const fit = shrunk.labels[0]?.fit;
    expect(fit?.ok && fit.warnings.map((w) => w.code)).toEqual(['scaled']);
  });

  it.each([
    ['too small', { x0: 10, y0: 10, x1: 10 + MIN_SELECTION_PT - 1, y1: 100 }, 0],
    ['outside the page', { x0: 2000, y0: 2000, x1: 2100, y1: 2100 }, 0],
    ['inverted', { x0: 300, y0: 300, x1: 100, y1: 100 }, 0],
    ['not finite', { x0: Number.NaN, y0: 0, x1: 100, y1: 100 }, 0],
    ['on a missing page', { x0: 10, y0: 10, x1: 200, y1: 200 }, 5],
  ] as const)('rejects a selection that is %s', async (_name, box, pageIndex) => {
    const bytes = await fixture('dhl-paketmarke.pdf');
    await expect(
      cropManual(bytes, pdfjs, { pageIndex, box, rotation: 0 }, { profile }),
    ).rejects.toMatchObject({ code: pageIndex === 0 ? 'invalidSelection' : 'pageOutOfRange' });
  });

  it('clips a selection that extends beyond the page', async () => {
    const bytes = await fixture('internetmarke.pdf');
    const box = { x0: -50, y0: -50, x1: 300, y1: 250 };
    const result = await cropManual(bytes, pdfjs, { pageIndex: 0, box, rotation: 0 }, { profile });
    expect(result.labels[0]?.detection.contentBox).toEqual({ x0: 0, y0: 0, x1: 300, y1: 250 });
  });
});
