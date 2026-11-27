import { PDFDocument, degrees } from '@cantoo/pdf-lib';
import { describe, expect, it } from 'vitest';
import { cropLabels } from '../src/core/index.ts';
import { detectLabels } from '../src/core/detect.ts';
import { center, containsPoint, height, mmToPt, ptToMm, width } from '../src/core/geometry.ts';
import { extractLines, lineLength } from '../src/core/lines.ts';
import { isCross } from '../src/core/detectors/cropMarks.ts';
import { dominantTextAngle } from '../src/core/detection.ts';
import { getProfile, type ProfileId } from '../src/profiles/index.ts';
import type { PageAnalysis, PageElement } from '../src/core/types.ts';
import { analyze, analyzeSingle, fixture, pdfjs, texts, visibleBox } from './helpers.ts';

/** Tolerance for sizes compared across the crop: 0.75 pt ≈ 0.26 mm. */
const TOLERANCE_PT = 0.75;

async function cropFixture(name: string, profile: ProfileId, source?: Uint8Array) {
  const bytes = source ?? (await fixture(name));
  const result = await cropLabels(bytes, pdfjs, { profile: getProfile(profile) });
  if (!result.pdf) throw new Error('no output');
  const [label] = result.labels;
  if (!label?.fit.ok) throw new Error('label does not fit');
  const [sourcePage] = await analyze(bytes);
  if (!sourcePage) throw new Error('no source page');
  return {
    result,
    label,
    placement: label.fit.placement,
    source: sourcePage,
    output: await analyze(result.pdf),
    outputDoc: await PDFDocument.load(result.pdf),
  };
}

/** Elements of the source page whose centre lies inside the detected label. */
function labelElements(page: PageAnalysis, name: string): PageElement[] {
  const [d] = detectLabels([page]);
  if (!d) throw new Error(`${name}: not detected`);
  return page.elements.filter((e) => containsPoint(d.contentBox, center(e.bbox)));
}

function hasCropMarkCross(elements: readonly PageElement[]): boolean {
  const arms = extractLines(elements).filter((l) => lineLength(l) >= 8 && lineLength(l) <= 24);
  const horizontal = arms.filter((l) => l.orientation === 'horizontal');
  const vertical = arms.filter((l) => l.orientation === 'vertical');
  return horizontal.some((h) => vertical.some((v) => isCross(h, v)));
}

describe('DHL Paketmarke → 103 x 199 mm', () => {
  it('produces one portrait page of exactly 103 x 199 mm without page rotation', async () => {
    const { outputDoc, output } = await cropFixture('dhl-paketmarke.pdf', 'label-103x199');
    expect(outputDoc.getPageCount()).toBe(1);
    const page = outputDoc.getPage(0);
    expect(ptToMm(page.getWidth())).toBeCloseTo(103, 3);
    expect(ptToMm(page.getHeight())).toBeCloseTo(199, 3);
    expect(page.getRotation().angle).toBe(0);
    expect(output[0]?.rotate).toBe(0);
  });

  it('turns the label so the text reads upright', async () => {
    const { output } = await cropFixture('dhl-paketmarke.pdf', 'label-103x199');
    expect(dominantTextAngle(output[0]?.elements ?? [])).toBe(0);
  });

  it('keeps 100 % scale: the visible content has the same size as in the source', async () => {
    const { label, placement, output } = await cropFixture('dhl-paketmarke.pdf', 'label-103x199');
    expect(placement.scale).toBe(1);
    const box = visibleBox(output[0]?.elements ?? []);
    // Source content is 189 x 100 mm lying; output is the same, turned upright.
    expect(width(box)).toBeCloseTo(height(label.detection.contentBox), 0);
    expect(height(box)).toBeCloseTo(width(label.detection.contentBox), 0);
    expect(Math.abs(width(box) - mmToPt(100))).toBeLessThan(mmToPt(1));
  });

  it('centres the label on the page', async () => {
    const { outputDoc, output } = await cropFixture('dhl-paketmarke.pdf', 'label-103x199');
    const box = visibleBox(output[0]?.elements ?? []);
    const page = outputDoc.getPage(0);
    expect(Math.abs(box.x0 - (page.getWidth() - box.x1))).toBeLessThan(TOLERANCE_PT);
    expect(Math.abs(box.y0 - (page.getHeight() - box.y1))).toBeLessThan(TOLERANCE_PT);
  });

  it('shows exactly the label: no scissors, no cut line, no receipt', async () => {
    const { source, output } = await cropFixture('dhl-paketmarke.pdf', 'label-103x199');
    const visible = output[0]?.elements ?? [];
    const expected = labelElements(source, 'dhl');
    expect(texts(visible)).toEqual(texts(expected));
    expect(visible.filter((e) => e.kind === 'path')).toHaveLength(
      expected.filter((e) => e.kind === 'path').length,
    );
    expect(texts(visible).join(' ')).not.toContain('Sendungsinformation');
  });

  it('keeps barcodes as vectors (no images in the output)', async () => {
    const { output } = await cropFixture('dhl-paketmarke.pdf', 'label-103x199');
    const elements = output[0]?.elements ?? [];
    expect(elements.some((e) => e.kind === 'image')).toBe(false);
    expect(elements.filter((e) => e.kind === 'path').length).toBeGreaterThan(100);
  });

  it.each([90, 180, 270])(
    'gives the same result for a source page with /Rotate %i',
    async (angle) => {
      const doc = await PDFDocument.load(await fixture('dhl-paketmarke.pdf'));
      doc.getPage(0).setRotation(degrees(angle));
      const { output, placement } = await cropFixture('', 'label-103x199', await doc.save());
      expect(placement.scale).toBe(1);
      const box = visibleBox(output[0]?.elements ?? []);
      expect(ptToMm(width(box))).toBeCloseTo(100, 0);
      expect(ptToMm(height(box))).toBeCloseTo(189, 0);
      expect(dominantTextAngle(output[0]?.elements ?? [])).toBe(0);
    },
  );

  it.each(['label-100x150', 'label-103x150'] as const)(
    'does not produce a silently shrunk label on %s',
    async (profile) => {
      const result = await cropLabels(await fixture('dhl-paketmarke.pdf'), pdfjs, {
        profile: getProfile(profile),
      });
      expect(result.pdf).toBeNull();
      expect(result.labels[0]?.fit).toMatchObject({ ok: false, reason: 'doesNotFit' });
    },
  );
});

describe('Internetmarke → DYMO 99014', () => {
  it('produces one 54 x 101 mm page at 100 %', async () => {
    const { outputDoc, placement, label, output } = await cropFixture(
      'internetmarke.pdf',
      'dymo-99014',
    );
    const page = outputDoc.getPage(0);
    expect(ptToMm(page.getWidth())).toBeCloseTo(54, 3);
    expect(ptToMm(page.getHeight())).toBeCloseTo(101, 3);
    expect(placement.scale).toBe(1);
    const box = visibleBox(output[0]?.elements ?? []);
    // Turned a quarter: width and height swap, sizes stay.
    expect(Math.abs(width(box) - height(label.detection.contentBox))).toBeLessThan(TOLERANCE_PT);
    expect(Math.abs(height(box) - width(label.detection.contentBox))).toBeLessThan(TOLERANCE_PT);
  });

  it('leaves the crop-mark crosses out', async () => {
    const { source, output } = await cropFixture('internetmarke.pdf', 'dymo-99014');
    expect(hasCropMarkCross(source.elements)).toBe(true);
    expect(hasCropMarkCross(output[0]?.elements ?? [])).toBe(false);
    expect(texts(output[0]?.elements ?? [])).toEqual(texts(labelElements(source, 'im')));
  });
});

describe('no label', () => {
  it('returns no PDF so the UI can offer manual cropping', async () => {
    const result = await cropLabels(await fixture('unrelated.pdf'), pdfjs, {
      profile: getProfile('label-103x199'),
    });
    expect(result).toEqual({ labels: [], pdf: null });
  });

  it('analyses the output again without errors (round trip)', async () => {
    const { result } = await cropFixture('internetmarke.pdf', 'brother-62');
    if (!result.pdf) throw new Error('no output');
    const page = await analyzeSingle(result.pdf);
    expect(page.elements.length).toBeGreaterThan(0);
  });
});

describe('international DHL label with CN22 → 103 x 199 mm', () => {
  it('produces two pages at 100 %: CN22 upright, then the label upright', async () => {
    const bytes = await fixture('dhl-international-cn22.pdf');
    const result = await cropLabels(bytes, pdfjs, { profile: getProfile('label-103x199') });
    if (!result.pdf) throw new Error('no output');
    const output = await analyze(result.pdf);
    expect(output).toHaveLength(2);
    for (const label of result.labels) expect(label.fit.ok && label.fit.placement.scale).toBe(1);

    const [cn22Page, labelPage] = output;
    expect(dominantTextAngle(cn22Page?.elements ?? [])).toBe(0);
    expect(dominantTextAngle(labelPage?.elements ?? [])).toBe(0);
    const cn22Box = visibleBox(cn22Page?.elements ?? []);
    expect(ptToMm(width(cn22Box))).toBeCloseTo(79.3, 0);
    expect(ptToMm(height(cn22Box))).toBeCloseTo(110.3, 0);
    const labelBox = visibleBox(labelPage?.elements ?? []);
    expect(ptToMm(height(labelBox))).toBeCloseTo(197, 0);
  });

  it('leaves instructions, cut line and scissors of the CN22 page out', async () => {
    const bytes = await fixture('dhl-international-cn22.pdf');
    const result = await cropLabels(bytes, pdfjs, { profile: getProfile('label-103x199') });
    if (!result.pdf) throw new Error('no output');
    const [cn22Page] = await analyze(result.pdf);
    const visible = texts(cn22Page?.elements ?? []).join(' ');
    expect(visible).toContain('CN22');
    expect(visible).not.toContain('ausschneiden');
  });

  it('fits the CN22 1:1 on 100 x 150 mm', async () => {
    const result = await cropLabels(await fixture('dhl-international-cn22.pdf'), pdfjs, {
      profile: getProfile('label-100x150'),
    });
    const [cn22, label] = result.labels;
    expect(cn22?.fit.ok && cn22.fit.placement.scale).toBe(1);
    expect(label?.fit).toMatchObject({ ok: false, reason: 'doesNotFit' });
  });
});
