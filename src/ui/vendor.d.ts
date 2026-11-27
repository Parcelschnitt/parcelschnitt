/** pdf.js ships no types for its worker entry; only its presence matters here. */
declare module 'pdfjs-dist/build/pdf.worker.mjs' {
  export const WorkerMessageHandler: unknown;
}
