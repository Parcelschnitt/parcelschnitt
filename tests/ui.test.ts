import { describe, expect, it } from 'vitest';
import { LIMITS } from '../src/core/limits.ts';
import { detectLang, formatPercent, messageKeys, t } from '../src/ui/i18n.ts';
import { isProcessRequest, isWorkerResponse, type LabelSummary } from '../src/ui/protocol.ts';
import {
  describeLabel,
  errorMessage,
  hasCustomsForm,
  offersShrink,
  outputFileName,
} from '../src/ui/view.ts';

const geometry = {
  pageIndex: 0,
  contentBox: { x0: 0, y0: 0, x1: 10, y1: 10 },
  uprightRotation: 0,
} as const;
const fits: LabelSummary = {
  ...geometry,
  layoutId: 'dhl-paketmarke',
  role: 'shippingLabel',
  target: 'labelPrinter',
  fit: { ok: true, scale: 1, rotation: 90, warnings: [] },
};
const tooBig: LabelSummary = { ...fits, fit: { ok: false, requiredScale: 0.7649 } };
const shrunk: LabelSummary = {
  ...fits,
  fit: {
    ok: true,
    scale: 0.76,
    rotation: 90,
    warnings: [{ code: 'scaled', scale: 0.76 }, { code: 'carrierRequiresFullScale' }],
  },
};
const cn22: LabelSummary = {
  ...geometry,
  layoutId: 'customs-cn22',
  role: 'customsForm',
  target: 'a4Sheet',
  fit: { ok: true, scale: 1, rotation: 0, warnings: [] },
};

describe('i18n', () => {
  it('has the same keys in German and English', () => {
    expect(messageKeys('en').sort()).toEqual(messageKeys('de').sort());
  });

  it('has no empty translations', () => {
    for (const lang of ['de', 'en'] as const) {
      for (const key of messageKeys(lang)) {
        expect(t(lang, key as Parameters<typeof t>[1]).trim()).not.toBe('');
      }
    }
  });

  it('fills placeholders and leaves unknown ones visible', () => {
    expect(t('de', 'file.selected', { name: 'x.pdf' })).toBe('Datei: x.pdf');
    expect(t('en', 'file.selected')).toBe('File: {name}');
  });

  it('picks German for German-speaking browsers, English otherwise', () => {
    expect(detectLang(['de-AT', 'en'])).toBe('de');
    expect(detectLang(['en-US', 'de'])).toBe('de');
    expect(detectLang(['fr-FR'])).toBe('en');
    expect(detectLang([])).toBe('en');
  });

  it('never rounds a shrunk scale up to 100 %', () => {
    expect(formatPercent(0.999)).toBe(99);
    expect(formatPercent(0.7649)).toBe(76);
    expect(formatPercent(1)).toBe(100);
  });
});

describe('view', () => {
  it('describes a label that fits', () => {
    expect(describeLabel('de', fits)).toEqual({
      name: 'DHL-Paketmarke',
      target: 'Etikettendrucker',
      lines: [{ text: 'Passt in Originalgröße (100 %).', tone: 'ok' }],
    });
  });

  it('reports the required scale when a label does not fit', () => {
    const view = describeLabel('en', tooBig);
    expect(view.lines).toEqual([
      { text: 'Does not fit this size at 100 % (would need 76 %).', tone: 'warn' },
    ]);
  });

  it('lists every warning of a shrunk DHL label', () => {
    const view = describeLabel('de', shrunk);
    expect(view.lines.map((l) => l.tone)).toEqual(['warn', 'warn']);
    expect(view.lines[0]?.text).toContain('76 %');
    expect(view.lines[1]?.text).toContain('DHL');
  });

  it('offers shrinking only when something does not fit or was shrunk', () => {
    expect(offersShrink([fits, cn22])).toBe(false);
    expect(offersShrink([tooBig])).toBe(true);
    expect(offersShrink([shrunk])).toBe(true);
  });

  it('shows the customs option only when a customs form was found', () => {
    expect(hasCustomsForm([fits])).toBe(false);
    expect(hasCustomsForm([fits, cn22])).toBe(true);
    expect(describeLabel('de', cn22).target).toBe('A4-Drucker');
  });

  it('builds safe download names', () => {
    expect(outputFileName('Label 123.PDF', 'label-103x199')).toBe('Label 123-label-103x199.pdf');
    expect(outputFileName('../../etc/passwd.pdf', 'a4')).toBe('.._.._etc_passwd-a4.pdf');
    expect(outputFileName('.pdf', 'a4')).toBe('label-a4.pdf');
    expect(outputFileName('x'.repeat(300), 'a4').length).toBeLessThanOrEqual(80 + '-a4.pdf'.length);
  });

  it('has a message for every error code', () => {
    expect(errorMessage('de', 'fileTooLarge')).toContain(String(LIMITS.maxFileBytes / 1024 / 1024));
    expect(errorMessage('en', 'tooManyPages')).toContain(String(LIMITS.maxPages));
    expect(errorMessage('en', 'internal')).not.toBe('');
  });
});

describe('worker protocol guards', () => {
  const valid = {
    type: 'process',
    id: 1,
    bytes: new ArrayBuffer(8),
    profileId: 'label-103x199',
    allowShrink: false,
    customsForms: 'withLabels',
  };

  it('accepts a well-formed request', () => {
    expect(isProcessRequest(valid)).toBe(true);
  });

  it.each([
    ['unknown profile', { ...valid, profileId: 'evil' }],
    ['unknown customs option', { ...valid, customsForms: 'print-everything' }],
    ['bytes as string', { ...valid, bytes: 'AAAA' }],
    ['non-integer id', { ...valid, id: 1.5 }],
    ['wrong type', { ...valid, type: 'eval' }],
    ['null', null],
  ])('rejects a request with %s', (_name, request) => {
    expect(isProcessRequest(request)).toBe(false);
  });

  it('accepts only known error codes from the worker', () => {
    expect(isWorkerResponse({ type: 'error', id: 1, code: 'notAPdf' })).toBe(true);
    expect(isWorkerResponse({ type: 'error', id: 1, code: '<img onerror=x>' })).toBe(false);
  });
});
