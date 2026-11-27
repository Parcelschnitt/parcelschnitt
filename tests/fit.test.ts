import { describe, expect, it } from 'vitest';
import { fitToProfile } from '../src/core/fit.ts';
import { mmToPt, ptToMm } from '../src/core/geometry.ts';
import { getProfile } from '../src/profiles/index.ts';

const DHL = { w: mmToPt(189), h: mmToPt(100), angle: 270 } as const; // lying, text bottom-to-top
const IM = { w: mmToPt(88), h: mmToPt(44), angle: 0 } as const; // upright

describe('fitToProfile', () => {
  it('puts a DHL label upright on 103 x 199 mm at 100 %, centred', () => {
    const result = fitToProfile(DHL.w, DHL.h, DHL.angle, getProfile('label-103x199'));
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    const p = result.placement;
    expect(result.warnings).toEqual([]);
    expect(p.scale).toBe(1);
    expect(p.rotation).toBe(90);
    expect(ptToMm(p.pageWidthPt)).toBeCloseTo(103, 6);
    expect(ptToMm(p.pageHeightPt)).toBeCloseTo(199, 6);
    expect(ptToMm(p.contentWidthPt)).toBeCloseTo(100, 6);
    expect(ptToMm(p.contentHeightPt)).toBeCloseTo(189, 6);
    expect(ptToMm(p.x)).toBeCloseTo(1.5, 6);
    expect(ptToMm(p.y)).toBeCloseTo(5, 6);
  });

  it.each(['label-100x150', 'label-103x150'] as const)(
    'refuses to shrink a DHL label silently on %s',
    (id) => {
      const result = fitToProfile(DHL.w, DHL.h, DHL.angle, getProfile(id));
      expect(result).toMatchObject({ ok: false, reason: 'doesNotFit' });
      if (result.ok) return;
      expect(result.requiredScale).toBeLessThan(1);
      expect(getProfile(id).cautions).toContain('tooShortForDhl');
    },
  );

  it('shrinks only when allowed, and then always warns', () => {
    const result = fitToProfile(DHL.w, DHL.h, DHL.angle, getProfile('label-100x150'), {
      allowShrink: true,
      requiresFullScale: true,
    });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.placement.scale).toBeLessThan(1);
    expect(result.warnings.map((w) => w.code)).toEqual(['scaled', 'carrierRequiresFullScale']);
    expect(result.placement.contentHeightPt).toBeLessThanOrEqual(mmToPt(150) + 0.5);
  });

  it('turns an Internetmarke a quarter so it fits DYMO 99014 at 100 %', () => {
    const result = fitToProfile(IM.w, IM.h, IM.angle, getProfile('dymo-99014'));
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.placement.scale).toBe(1);
    expect(result.placement.rotation).toBe(90);
    expect(ptToMm(result.placement.contentWidthPt)).toBeCloseTo(44, 6);
  });

  it('sizes continuous tape to the content plus margins', () => {
    const profile = getProfile('brother-62');
    const result = fitToProfile(IM.w, IM.h, IM.angle, profile);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(ptToMm(result.placement.pageWidthPt)).toBeCloseTo(62, 6);
    expect(ptToMm(result.placement.pageHeightPt)).toBeCloseTo(88 + 2 * profile.marginMm, 6);
    expect(result.placement.scale).toBe(1);
  });

  it('keeps upright content upright when it fits', () => {
    const result = fitToProfile(mmToPt(50), mmToPt(30), 0, getProfile('label-103x199'));
    expect(result.ok && result.placement.rotation).toBe(0);
  });

  it('never turns content upside down', () => {
    for (const angle of [0, 90, 180, 270] as const) {
      for (const profile of ['label-103x199', 'dymo-99014', 'brother-62'] as const) {
        const result = fitToProfile(mmToPt(80), mmToPt(40), angle, getProfile(profile));
        if (!result.ok) continue;
        expect((angle + result.placement.rotation) % 360).not.toBe(180);
      }
    }
  });
});
