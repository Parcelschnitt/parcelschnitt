import { PDFDocument, PDFName, StandardFonts } from '@cantoo/pdf-lib';
import { describe, expect, it } from 'vitest';
import { cropLabels, cropManual } from '../src/core/index.ts';
import { getProfile } from '../src/profiles/index.ts';
import { fixture, pdfjs } from './helpers.ts';

const profile = getProfile('label-103x199');

/** Adds an invented "invoice" with plenty of text below the label area of page 1. */
async function withInvoice(name: string): Promise<Uint8Array> {
  const doc = await PDFDocument.load(await fixture(name));
  const page = doc.getPage(0);
  const font = await doc.embedFont(StandardFonts.Helvetica);
  for (let line = 0; line < 20; line++) {
    page.drawText(`Rechnung 0000 Position ${line} Musterartikel 1,00 EUR Beispielkunde`, {
      x: 40,
      y: 120 + line * 12,
      size: 8,
      font,
    });
  }
  return doc.save();
}

describe('hidden content notice', () => {
  it.each(['dhl-paketmarke.pdf', 'internetmarke.pdf', 'dhl-international-cn22.pdf'])(
    'stays quiet for the expected layout of %s',
    async (name) => {
      const result = await cropLabels(await fixture(name), pdfjs, { profile });
      expect(result.labels.length).toBeGreaterThan(0);
      for (const label of result.labels) expect(label.hiddenText).toBe(false);
    },
  );

  it('warns when an invoice shares the page with an Internetmarke', async () => {
    const result = await cropLabels(await withInvoice('internetmarke.pdf'), pdfjs, { profile });
    expect(result.labels).toHaveLength(1);
    expect(result.labels[0]?.hiddenText).toBe(true);
  });

  it('warns for a manual crop that leaves a lot of text outside', async () => {
    const bytes = await withInvoice('unrelated.pdf');
    const box = { x0: 40, y0: 40, x1: 200, y1: 120 };
    const result = await cropManual(bytes, pdfjs, { pageIndex: 0, box, rotation: 0 }, { profile });
    expect(result.labels[0]?.hiddenText).toBe(true);
  });
});

describe('output document', () => {
  it('carries no metadata, attachments, scripts or annotations of the source', async () => {
    const source = await PDFDocument.load(await fixture('dhl-paketmarke.pdf'));
    source.setTitle('Secret title Erika');
    source.setAuthor('Secret author');
    source.setSubject('Secret subject');
    source.setKeywords(['secret-keyword']);
    await source.attach(new TextEncoder().encode('secret attachment'), 'secret.txt', {
      mimeType: 'text/plain',
    });
    source.addJavaScript('secretScript', 'app.alert("x")');
    const annotation = source.context.obj({
      Type: 'Annot',
      Subtype: 'Text',
      Rect: [10, 10, 50, 50],
      Contents: 'Secret note',
    });
    source.getPage(0).node.set(PDFName.of('Annots'), source.context.obj([annotation]));

    const result = await cropLabels(await source.save(), pdfjs, { profile });
    if (!result.pdf) throw new Error('no output');
    const output = await PDFDocument.load(result.pdf, { updateMetadata: false });

    expect(output.getTitle()).toBeUndefined();
    expect(output.getAuthor()).toBeUndefined();
    expect(output.getSubject()).toBeUndefined();
    expect(output.getKeywords()).toBeUndefined();
    expect(output.getProducer()).toBe('Parcelschnitt');
    for (const key of ['Names', 'OpenAction', 'AcroForm', 'Metadata']) {
      expect(output.catalog.get(PDFName.of(key))).toBeUndefined();
    }
    // pdf-lib may write an empty Annots array; what matters is that nothing is in it.
    const annots = output.getPage(0).node.Annots();
    expect(annots?.size() ?? 0).toBe(0);

    const raw = new TextDecoder('latin1').decode(result.pdf);
    for (const secret of ['Secret', 'secret', 'app.alert']) expect(raw).not.toContain(secret);
  });
});
