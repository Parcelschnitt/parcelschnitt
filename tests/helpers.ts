import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import * as pdfjsLegacy from 'pdfjs-dist/legacy/build/pdf.mjs';
import { analyzeDocument, type PdfJsLib } from '../src/core/index.ts';
import { height, ptToMm, union, width, type Rect } from '../src/core/geometry.ts';
import type { PageAnalysis, PageElement } from '../src/core/types.ts';

/** Node needs the legacy pdf.js build; the browser uses the modern one. */
export const pdfjs: PdfJsLib = pdfjsLegacy;

export const FIXTURES = join(import.meta.dirname, 'fixtures');

export async function fixture(name: string): Promise<Uint8Array> {
  return new Uint8Array(await readFile(join(FIXTURES, name)));
}

export async function analyze(bytes: Uint8Array): Promise<PageAnalysis[]> {
  return analyzeDocument(bytes, pdfjs);
}

export async function analyzeSingle(bytes: Uint8Array): Promise<PageAnalysis> {
  const [page] = await analyze(bytes);
  if (!page) throw new Error('PDF has no pages');
  return page;
}

export function visibleBox(elements: readonly PageElement[]): Rect {
  const box = union(elements.map((e) => e.bbox));
  if (!box) throw new Error('No visible elements');
  return box;
}

export const sizeMm = (r: Rect): { w: number; h: number } => ({
  w: ptToMm(width(r)),
  h: ptToMm(height(r)),
});

export const texts = (elements: readonly PageElement[]): string[] =>
  elements.flatMap((e) => (e.kind === 'text' ? [e.text] : [])).sort();
