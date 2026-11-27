/**
 * Checks against real labels from $PARCELSCHNITT_SAMPLES (outside the repo). Skipped when
 * the variable is unset, e.g. in CI. Assertions compare numbers and booleans only, so a
 * failure never prints label content.
 */
import { PDFDocument } from '@cantoo/pdf-lib';
import { describe, expect, it } from 'vitest';
import { cropLabels } from '../src/core/index.ts';
import { detectLabels } from '../src/core/detect.ts';
import { dominantTextAngle } from '../src/core/detection.ts';
import { isCross } from '../src/core/detectors/cropMarks.ts';
import { center, containsPoint, height, intersect, ptToMm, width } from '../src/core/geometry.ts';
import { extractLines, lineLength } from '../src/core/lines.ts';
import { getProfile } from '../src/profiles/index.ts';
import { analyze, pdfjs, visibleBox } from './helpers.ts';
import { DEFAULT_PROFILE, SAMPLES_DIR, loadSamples } from './samples.ts';

const samples = SAMPLES_DIR ? await loadSamples(SAMPLES_DIR) : [];

describe.skipIf(!SAMPLES_DIR)('real samples ($PARCELSCHNITT_SAMPLES)', () => {
  it('folder contains at least one PDF', () => {
    expect(samples.length).toBeGreaterThan(0);
  });

  describe.each(samples.map((s) => [s.label, s] as const))('%s', (_label, sample) => {
    it('is detected with confidence', async () => {
      const detections = detectLabels(await analyze(sample.bytes));
      expect(detections.length).toBeGreaterThan(0);
      for (const d of detections) expect(d.confidence).toBeGreaterThan(0.5);
    });

    it('keeps helper graphics out of the label area', async () => {
      for (const d of detectLabels(await analyze(sample.bytes))) {
        const overlapping = d.excluded.filter((r) => intersect(r, d.contentBox) !== null);
        expect(overlapping.length).toBe(0);
      }
    });

    it('crops to the default profile at 100 %, upright, without helpers', async () => {
      const source = await analyze(sample.bytes);
      const detections = detectLabels(source);
      const first = detections.find((d) => d.role === 'shippingLabel') ?? detections[0];
      if (!first) throw new Error('not detected');
      const profile = getProfile(DEFAULT_PROFILE[first.layoutId] ?? 'label-103x199');
      const result = await cropLabels(sample.bytes, pdfjs, { profile });
      expect(result.pdf).not.toBeNull();
      if (!result.pdf) return;

      const doc = await PDFDocument.load(result.pdf);
      const output = await analyze(result.pdf);
      expect(doc.getPageCount()).toBe(result.labels.length);

      for (const [i, label] of result.labels.entries()) {
        expect(label.fit.ok).toBe(true);
        if (!label.fit.ok) continue;
        const page = doc.getPage(i);
        const analysis = output[i];
        if (!analysis) throw new Error('missing output page');

        // Page size and rotation
        expect(ptToMm(page.getWidth())).toBeCloseTo(profile.widthMm, 2);
        if (profile.heightMm !== null)
          expect(ptToMm(page.getHeight())).toBeCloseTo(profile.heightMm, 2);
        expect(page.getRotation().angle).toBe(0);
        const expectedAngle = (label.detection.textAngle + label.fit.placement.rotation) % 360;
        expect(dominantTextAngle(analysis.elements)).toBe(expectedAngle);
        expect(expectedAngle).not.toBe(180);

        // Nothing shrunk: visible content has the source size (turned if needed)
        expect(label.fit.placement.scale).toBe(1);
        const box = visibleBox(analysis.elements);
        const turned = label.fit.placement.rotation % 180 !== 0;
        const srcW = width(label.detection.contentBox);
        const srcH = height(label.detection.contentBox);
        expect(Math.abs(width(box) - (turned ? srcH : srcW))).toBeLessThan(1);
        expect(Math.abs(height(box) - (turned ? srcW : srcH))).toBeLessThan(1);

        // Exactly the label content is visible: same element counts as inside the source box
        const sourcePage = source[label.detection.pageIndex];
        if (!sourcePage) throw new Error('missing source page');
        const expected = sourcePage.elements.filter((e) =>
          containsPoint(label.detection.contentBox, center(e.bbox)),
        );
        expect(analysis.elements.filter((e) => e.kind === 'text').length).toBe(
          expected.filter((e) => e.kind === 'text').length,
        );
        expect(analysis.elements.filter((e) => e.kind !== 'text').length).toBe(
          expected.filter((e) => e.kind !== 'text').length,
        );

        // No crop-mark crosses in the output
        const arms = extractLines(analysis.elements).filter(
          (l) => lineLength(l) >= 8 && lineLength(l) <= 24,
        );
        const crosses = arms.filter(
          (h) =>
            h.orientation === 'horizontal' &&
            arms.some((v) => v.orientation === 'vertical' && isCross(h, v)),
        );
        expect(crosses.length).toBe(0);
      }
    });
  });
});
