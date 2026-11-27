import { ParcelschnittError } from './errors.ts';

/**
 * Hard limits for untrusted input. Shipping-label PDFs are small (typically < 1 MB, 1-2 pages);
 * the limits leave generous headroom while bounding memory and CPU use.
 */
export const LIMITS = {
  maxFileBytes: 10 * 1024 * 1024,
  maxPages: 20,
} as const;

/** The PDF header may appear anywhere in the first 1024 bytes (ISO 32000-1, 7.5.2 note). */
const HEADER_SEARCH_BYTES = 1024;
const PDF_HEADER = [0x25, 0x50, 0x44, 0x46, 0x2d]; // "%PDF-"

function hasPdfHeader(bytes: Uint8Array): boolean {
  const end = Math.min(bytes.length, HEADER_SEARCH_BYTES) - PDF_HEADER.length;
  outer: for (let i = 0; i <= end; i++) {
    for (let j = 0; j < PDF_HEADER.length; j++) {
      if (bytes[i + j] !== PDF_HEADER[j]) continue outer;
    }
    return true;
  }
  return false;
}

/** Cheap checks before any parser touches the bytes. */
export function assertAcceptableInput(bytes: Uint8Array): void {
  if (bytes.length === 0) throw new ParcelschnittError('emptyFile', 'The file is empty.');
  if (bytes.length > LIMITS.maxFileBytes) {
    throw new ParcelschnittError('fileTooLarge', 'The file exceeds the size limit.');
  }
  if (!hasPdfHeader(bytes)) throw new ParcelschnittError('notAPdf', 'The file is not a PDF.');
}

export function assertPageCount(pageCount: number): void {
  if (pageCount > LIMITS.maxPages) {
    throw new ParcelschnittError('tooManyPages', 'The PDF has too many pages.');
  }
}
