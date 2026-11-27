/**
 * The minimal slice of the pdf.js API that the core needs.
 *
 * pdf.js is injected rather than imported so the core runs unchanged in a browser Web Worker
 * (modern build), in Node for tests and scripts (legacy build) and later in the Tauri app.
 * Everything pdf.js returns is treated as `unknown` and narrowed with type guards.
 */

export interface PdfJsViewport {
  readonly transform: readonly number[];
  readonly width: number;
  readonly height: number;
}

export interface PdfJsPage {
  readonly rotate: number;
  readonly view: readonly number[];
  getViewport(params: { scale: number }): PdfJsViewport;
  getTextContent(): Promise<{ items: readonly unknown[] }>;
  getOperatorList(): Promise<{ fnArray: readonly number[]; argsArray: readonly unknown[] }>;
}

export interface PdfJsDocument {
  readonly numPages: number;
  getPage(pageNumber: number): Promise<PdfJsPage>;
}

export interface PdfJsLoadingTask {
  readonly promise: Promise<PdfJsDocument>;
  destroy(): Promise<void>;
}

export interface PdfJsDocumentParams {
  data: Uint8Array;
  isEvalSupported: boolean;
  enableXfa: boolean;
  disableFontFace: boolean;
  useSystemFonts: boolean;
  disableAutoFetch: boolean;
  disableStream: boolean;
  stopAtErrors: boolean;
  verbosity: number;
}

export interface PdfJsLib {
  getDocument(params: PdfJsDocumentParams): PdfJsLoadingTask;
  readonly OPS: Readonly<Record<string, number>>;
}

/**
 * Hardened pdf.js options for untrusted input:
 * - `isEvalSupported: false` keeps pdf.js from compiling font code with `new Function`
 *   (relevant for CVE-2024-4367 class issues).
 * - No XFA, no font-face injection, no system fonts, no streaming/range requests.
 * - `verbosity: 0` keeps pdf.js from logging, so no document content ends up in logs.
 */
export function safeDocumentParams(data: Uint8Array): PdfJsDocumentParams {
  return {
    // pdf.js may transfer (detach) the buffer it receives; always hand it a copy.
    data: data.slice(),
    isEvalSupported: false,
    enableXfa: false,
    disableFontFace: true,
    useSystemFonts: false,
    disableAutoFetch: true,
    disableStream: true,
    stopAtErrors: false,
    verbosity: 0,
  };
}
