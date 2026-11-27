import { PDFDocument } from '@cantoo/pdf-lib';
import { describe, expect, it } from 'vitest';
import { LIMITS, ParcelschnittError } from '../src/core/index.ts';
import { analyze } from './helpers.ts';

async function expectCode(promise: Promise<unknown>, code: string): Promise<void> {
  await expect(promise).rejects.toBeInstanceOf(ParcelschnittError);
  await expect(promise).rejects.toMatchObject({ code });
}

describe('input limits (untrusted PDFs)', () => {
  it('rejects empty input', async () => {
    await expectCode(analyze(new Uint8Array()), 'emptyFile');
  });

  it('rejects files above the size limit before parsing', async () => {
    const big = new Uint8Array(LIMITS.maxFileBytes + 1);
    big.set(new TextEncoder().encode('%PDF-1.7\n'));
    await expectCode(analyze(big), 'fileTooLarge');
  });

  it('rejects data without a PDF header', async () => {
    await expectCode(analyze(new TextEncoder().encode('<html>not a pdf</html>')), 'notAPdf');
  });

  it('rejects broken PDFs with a generic error', async () => {
    const broken = new TextEncoder().encode('%PDF-1.7\n1 0 obj << /Type /Catalog >>\n%%EOF');
    await expectCode(analyze(broken), 'unreadablePdf');
  });

  it('rejects documents with too many pages', async () => {
    const doc = await PDFDocument.create();
    for (let i = 0; i <= LIMITS.maxPages; i++) doc.addPage();
    await expectCode(analyze(await doc.save()), 'tooManyPages');
  });

  it('does not leak document content in error messages', async () => {
    const secret = 'Max Mustermann';
    const input = new TextEncoder().encode(`${secret} %PDF-garbage`);
    const error = await analyze(input).catch((e: unknown) => e);
    expect(String(error)).not.toContain(secret);
  });
});
