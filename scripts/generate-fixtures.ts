/**
 * Generates the synthetic test fixtures in tests/fixtures/.
 *
 * The PDFs imitate the structure of real labels (sizes, rotation, marker texts, cut line,
 * scissors, crop-mark crosses) but contain only invented data: placeholder names, addresses
 * and tracking numbers, and barcode-like patterns that encode nothing. Nothing is copied
 * from real labels.
 *
 * Output is deterministic (fixed PRNG seed, no metadata dates), so CI can regenerate the
 * fixtures and verify that the committed files are exactly what this script produces.
 *
 * Usage: node scripts/generate-fixtures.ts [output-dir]
 */
import { mkdir, writeFile } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import {
  PDFDocument,
  StandardFonts,
  degrees,
  rgb,
  type PDFFont,
  type PDFPage,
} from '@cantoo/pdf-lib';

const PT_PER_MM = 72 / 25.4;
const mm = (value: number): number => value * PT_PER_MM;
const A4 = { width: 595.28, height: 841.89 } as const;
const BLACK = rgb(0, 0, 0);

/** Small deterministic PRNG (mulberry32) for placeholder barcodes. */
function prng(seed: number): () => number {
  let state = seed >>> 0;
  return () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

interface Fonts {
  regular: PDFFont;
  bold: PDFFont;
}

async function newDocument(): Promise<{ doc: PDFDocument; page: PDFPage; fonts: Fonts }> {
  const doc = await PDFDocument.create({ updateMetadata: false });
  const page = doc.addPage([A4.width, A4.height]);
  const fonts = {
    regular: await doc.embedFont(StandardFonts.Helvetica),
    bold: await doc.embedFont(StandardFonts.HelveticaBold),
  };
  return { doc, page, fonts };
}

/**
 * Drawing in an upright local coordinate system (u to the right, v downwards, origin at the
 * top-left of the box) that is placed on the page turned 90° counter-clockwise, the way DHL
 * places its label on A4. With `turned: false` the box is drawn upright.
 */
class Canvas {
  private readonly page: PDFPage;
  private readonly fonts: Fonts;
  /** Top-left corner of the box on the page, view coordinates (y down). */
  private readonly originX: number;
  private readonly originY: number;
  /** Width of the box in local (upright) coordinates. */
  private readonly localWidth: number;
  private readonly turned: boolean;

  constructor(
    page: PDFPage,
    fonts: Fonts,
    originX: number,
    originY: number,
    localWidth: number,
    turned: boolean,
  ) {
    this.page = page;
    this.fonts = fonts;
    this.originX = originX;
    this.originY = originY;
    this.localWidth = localWidth;
    this.turned = turned;
  }

  /** Local point → PDF page coordinates (y up). */
  private point(u: number, v: number): { x: number; y: number } {
    const viewX = this.turned ? this.originX + v : this.originX + u;
    const viewY = this.turned ? this.originY + (this.localWidth - u) : this.originY + v;
    return { x: viewX, y: A4.height - viewY };
  }

  text(value: string, u: number, v: number, size: number, bold = false): void {
    this.page.drawText(value, {
      ...this.point(u, v),
      size,
      font: bold ? this.fonts.bold : this.fonts.regular,
      color: BLACK,
      rotate: degrees(this.turned ? 90 : 0),
    });
  }

  lines(values: readonly string[], u: number, v: number, size: number, leading = 1.2): void {
    values.forEach((value, i) => {
      this.text(value, u, v + i * size * leading, size);
    });
  }

  /** Filled or outlined rectangle; (u, v) is its top-left corner in local coordinates. */
  rect(u: number, v: number, w: number, h: number, filled = true): void {
    const bottomLeft = this.turned ? this.point(u, v) : this.point(u, v + h);
    const options = filled ? { color: BLACK } : { borderColor: BLACK, borderWidth: 0.75 };
    this.page.drawRectangle({
      ...bottomLeft,
      width: this.turned ? h : w,
      height: this.turned ? w : h,
      ...options,
    });
  }

  line(u1: number, v1: number, u2: number, v2: number, thickness = 0.75): void {
    this.page.drawLine({
      start: this.point(u1, v1),
      end: this.point(u2, v2),
      thickness,
      color: BLACK,
    });
  }

  /** Bars of random width: looks like a 1D barcode, encodes nothing. */
  barcode(u: number, v: number, w: number, h: number, seed: number): void {
    const random = prng(seed);
    let x = u;
    while (x < u + w - 3) {
      const bar = 0.8 + Math.floor(random() * 3) * 0.8;
      this.rect(x, v, Math.min(bar, u + w - x), h);
      x += bar + 0.8 + Math.floor(random() * 3) * 0.8;
    }
  }

  /** Random module grid: looks like a 2D code, encodes nothing. */
  matrix(u: number, v: number, size: number, modules: number, seed: number): void {
    const random = prng(seed);
    const cell = size / modules;
    for (let row = 0; row < modules; row++) {
      for (let col = 0; col < modules; col++) {
        const finder =
          (row < 3 && col < 3) ||
          (row < 3 && col >= modules - 3) ||
          (row >= modules - 3 && col < 3);
        if (finder || random() < 0.5) this.rect(u + col * cell, v + row * cell, cell, cell);
      }
    }
  }
}

const SENDER = ['Erika Mustermann', 'Musterstraße 1', '12345 Musterstadt', 'Deutschland'];
const RECIPIENT = ['Max Mustermann', 'Beispielweg 42', '54321 Beispielstadt', 'Deutschland'];

/** Small scissors icon (two rings, two blades), about 11 x 10 pt, lower edge at `bottomY` (view). */
function scissors(page: PDFPage, centerX: number, bottomY: number): void {
  const y = A4.height - bottomY - 1;
  page.drawEllipse({
    x: centerX - 3,
    y: y + 3,
    xScale: 2,
    yScale: 2,
    borderColor: BLACK,
    borderWidth: 0.6,
  });
  page.drawEllipse({
    x: centerX - 3,
    y: y + 9,
    xScale: 2,
    yScale: 2,
    borderColor: BLACK,
    borderWidth: 0.6,
  });
  page.drawLine({
    start: { x: centerX - 1, y: y + 4 },
    end: { x: centerX + 6, y: y + 9 },
    thickness: 0.6,
    color: BLACK,
  });
  page.drawLine({
    start: { x: centerX - 1, y: y + 8 },
    end: { x: centerX + 6, y: y + 3 },
    thickness: 0.6,
    color: BLACK,
  });
}

/**
 * DHL Paketmarke: label of 100 x 189 mm lying turned 90° in the top half of an A4 page,
 * full-width cut line at 421 pt from the top, scissors just above both ends, receipt below.
 */
async function dhlPaketmarke(): Promise<Uint8Array> {
  const { doc, page, fonts } = await newDocument();
  const labelW = mm(100); // upright width
  const labelH = mm(189); // upright height
  const cutY = 421;
  const originX = (A4.width - labelH) / 2;
  const originY = cutY - 36 - labelW;
  const label = new Canvas(page, fonts, originX, originY, labelW, true);

  label.rect(labelW - 70, 0, 70, 18, false); // carrier logo placeholder
  label.text('2 kg Paket', 8, 22, 15, true);
  label.text('DHL Online Frankierung', 8, 31, 6);
  label.text('Von:', 8, 42, 6, true);
  label.lines(SENDER, 24, 42, 7);
  label.text('Sicherheitscode', labelW - 72, 30, 5);
  label.matrix(labelW - 72, 34, 66, 22, 101);
  label.text('An:', 8, 120, 7, true);
  label.lines(RECIPIENT, 24, 120, 12);
  label.line(0, 196, labelW, 196);
  label.text('Sendungsnummer: 00.000.000000 0', 8, 210, 7, true);
  label.text('max. 60 x 30 x 15 cm', 8, 219, 7, true);
  label.text('PAK-ID: PAK 000 000 000', 8, 228, 6);
  label.lines(['Entgelt Bezahlt', 'Postage Paid'], labelW - 62, 210, 7);
  label.line(0, 240, labelW, 240);
  label.text('Leitcode/Routingcode', 8, 262, 6);
  label.barcode(24, 268, labelW - 48, 70, 202);
  label.text('00000.000.000.00.0', 100, 350, 7);
  label.rect(0, 366, labelW, 4);
  label.text('Identcode', 8, 380, 6);
  label.barcode(24, 386, labelW - 48, 70, 303);
  label.text('00.000.000000 0', 106, 468, 7);
  label.rect(0, labelH - 10, labelW, 10);

  // Cut line across the page, scissors at both ends just above it.
  page.drawLine({
    start: { x: 14, y: A4.height - cutY },
    end: { x: A4.width - 14, y: A4.height - cutY },
    thickness: 0.5,
    color: BLACK,
  });
  scissors(page, 18, cutY - 2);
  scissors(page, A4.width - 24, cutY - 2);

  // Receipt for the sender below the cut line (not part of the label).
  const receipt = new Canvas(page, fonts, 40, cutY + 20, A4.height - cutY - 60, true);
  receipt.text('Sendungsinformation - für Ihre Unterlagen.', 10, 20, 11, true);
  receipt.lines(['Absender:', '', '', '', 'Empfänger:'], 10, 50, 8);
  receipt.lines(SENDER, 90, 50, 8);
  receipt.lines(RECIPIENT, 90, 100, 8);
  receipt.lines(
    ['Sendungsnr.: 00.000.000000 0', 'Produkt: 2 kg Paket', 'Erstelldatum: 01.01.2026'],
    10,
    160,
    8,
  );
  receipt.text('Sicherheitscode', 250, 20, 7);
  receipt.matrix(250, 26, 90, 26, 404);
  receipt.text('Bitte drucken Sie die Versandmarke in der Originalgröße aus.', 10, 240, 7, true);

  return doc.save({ useObjectStreams: false });
}

/** Crop-mark cross: two dotted arms of 14 pt, centred on the corner (view coordinates). */
function cropMark(page: PDFPage, x: number, viewY: number): void {
  const y = A4.height - viewY;
  const arm = { thickness: 0.4, color: BLACK, dashArray: [1, 1] };
  page.drawLine({ start: { x: x - 7, y }, end: { x: x + 7, y }, ...arm });
  page.drawLine({ start: { x, y: y - 7 }, end: { x, y: y + 7 }, ...arm });
}

/** Internetmarke: four crop-mark crosses around a 90 x 47 mm area at the top left. */
async function internetmarke(): Promise<Uint8Array> {
  const { doc, page, fonts } = await newDocument();
  const left = 36;
  const top = 82;
  const w = mm(90);
  const h = mm(47);
  for (const [x, y] of [
    [left, top],
    [left + w, top],
    [left, top + h],
    [left + w, top + h],
  ] as const) {
    cropMark(page, x, y);
  }
  const area = new Canvas(page, fonts, left, top, w, false);
  area.text('Erika Mustermann, Musterstraße 1, 12345 Musterstadt', 10, 16, 5.5);
  area.text('PRIORITY P.P.', 10, 23, 5.5, true);
  area.text('A0 000A A000 00 0000 0000', 60, 28, 5.5);
  area.text('IM', 42, 35, 7, true);
  area.text('01.01.26 0,00', 60, 35, 5.5);
  area.text('Deutsche Post', 100, 35, 5.5, true);
  area.rect(140, 26, 10, 10, false); // postal horn placeholder
  area.matrix(160, 22, 34, 20, 505);
  area.lines(
    ['MAX MUSTERMANN', 'BEISPIELWEG 42', '54321 BEISPIELSTADT', 'Deutschland'],
    22,
    72,
    9,
    1.1,
  );
  return doc.save({ useObjectStreams: false });
}

/** A page without any label: must not be detected. */
async function unrelated(): Promise<Uint8Array> {
  const { doc, page, fonts } = await newDocument();
  const canvas = new Canvas(page, fonts, 60, 60, A4.width - 120, false);
  canvas.text('Rechnung Nr. 0000', 0, 20, 16, true);
  canvas.lines(SENDER, 0, 60, 10);
  canvas.line(0, 140, A4.width - 120, 140);
  canvas.lines(['Pos. 1  Musterartikel  1,00 EUR', 'Summe  1,00 EUR'], 0, 170, 10);
  return doc.save({ useObjectStreams: false });
}

async function main(): Promise<void> {
  const outputDir = resolve(
    process.argv[2] ?? join(import.meta.dirname, '..', 'tests', 'fixtures'),
  );
  await mkdir(outputDir, { recursive: true });
  const fixtures: Record<string, () => Promise<Uint8Array>> = {
    'dhl-paketmarke.pdf': dhlPaketmarke,
    'internetmarke.pdf': internetmarke,
    'unrelated.pdf': unrelated,
  };
  for (const [name, build] of Object.entries(fixtures)) {
    await writeFile(join(outputDir, name), await build());
    process.stdout.write(`wrote ${join(outputDir, name)}\n`);
  }
}

await main();
