/**
 * Renders PDF pages to bitmaps inside the worker (OffscreenCanvas), so the main thread never
 * parses a PDF. pdf.js normally creates DOM canvases and SVG filters; in a worker there is no
 * DOM, so minimal replacements are supplied.
 */
import { safeDocumentParams, type PdfJsDocumentParams } from '../core/pdfjs.ts';

/** Longest side of a preview bitmap in device pixels. */
const MAX_PREVIEW_PX = 1400;
/** Preview resolution relative to PDF points (≈ 144 dpi). */
const PREVIEW_SCALE = 2;

interface CanvasAndContext {
  canvas: OffscreenCanvas | null;
  context: OffscreenCanvasRenderingContext2D | null;
}

function context2d(canvas: OffscreenCanvas, alpha = true): OffscreenCanvasRenderingContext2D {
  const ctx = canvas.getContext('2d', { alpha });
  if (!ctx) throw new Error('2D context unavailable');
  return ctx;
}

/** pdf.js canvas factory backed by OffscreenCanvas. */
export class OffscreenCanvasFactory {
  create(width: number, height: number): CanvasAndContext {
    if (width <= 0 || height <= 0) throw new Error('Invalid canvas size');
    const canvas = new OffscreenCanvas(width, height);
    return { canvas, context: context2d(canvas) };
  }

  reset(target: CanvasAndContext, width: number, height: number): void {
    if (!target.canvas) throw new Error('Canvas is not specified');
    target.canvas.width = width;
    target.canvas.height = height;
  }

  destroy(target: CanvasAndContext): void {
    if (target.canvas) {
      target.canvas.width = 0;
      target.canvas.height = 0;
    }
    target.canvas = null;
    target.context = null;
  }

  getNoAlphaContext(canvas: OffscreenCanvas): OffscreenCanvasRenderingContext2D {
    return context2d(canvas, false);
  }
}

/** pdf.js filter factory without SVG filters (only needed for high-contrast modes). */
export class NoFilterFactory {
  addFilter(): string {
    return 'none';
  }
  addHCMFilter(): string {
    return 'none';
  }
  addAlphaFilter(): string {
    return 'none';
  }
  addLuminosityFilter(): string {
    return 'none';
  }
  addHighlightHCMFilter(): string {
    return 'none';
  }
  destroy(): void {
    // nothing to release
  }
}

interface RenderViewport {
  readonly width: number;
  readonly height: number;
}

interface RenderablePage {
  getViewport(params: { scale: number }): RenderViewport;
  render(params: { canvas: OffscreenCanvas; viewport: RenderViewport }): { promise: Promise<void> };
}

export interface PdfJsRenderLib {
  getDocument(
    params: PdfJsDocumentParams & {
      CanvasFactory: typeof OffscreenCanvasFactory;
      FilterFactory: typeof NoFilterFactory;
      isOffscreenCanvasSupported: boolean;
    },
  ): {
    promise: Promise<{ numPages: number; getPage(n: number): Promise<RenderablePage> }>;
    destroy(): Promise<void>;
  };
}

/** Renders every page of `bytes` to an ImageBitmap. */
export async function renderPreviews(
  bytes: Uint8Array,
  pdfjs: PdfJsRenderLib,
): Promise<ImageBitmap[]> {
  const task = pdfjs.getDocument({
    ...safeDocumentParams(bytes),
    CanvasFactory: OffscreenCanvasFactory,
    FilterFactory: NoFilterFactory,
    isOffscreenCanvasSupported: true,
  });
  try {
    const doc = await task.promise;
    const bitmaps: ImageBitmap[] = [];
    for (let n = 1; n <= doc.numPages; n++) {
      const page = await doc.getPage(n);
      const base = page.getViewport({ scale: 1 });
      const scale = Math.min(PREVIEW_SCALE, MAX_PREVIEW_PX / Math.max(base.width, base.height));
      const viewport = page.getViewport({ scale });
      const canvas = new OffscreenCanvas(Math.ceil(viewport.width), Math.ceil(viewport.height));
      const ctx = context2d(canvas, false);
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      await page.render({ canvas, viewport }).promise;
      bitmaps.push(canvas.transferToImageBitmap());
    }
    return bitmaps;
  } finally {
    await task.destroy();
  }
}
