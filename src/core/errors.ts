/**
 * Error codes are stable identifiers for the UI (translated via i18n). Messages never contain
 * label content, because labels hold personal data.
 */
export type ParcelschnittErrorCode =
  | 'fileTooLarge'
  | 'emptyFile'
  | 'notAPdf'
  | 'tooManyPages'
  | 'unreadablePdf'
  | 'pageOutOfRange'
  | 'invalidSelection';

export class ParcelschnittError extends Error {
  readonly code: ParcelschnittErrorCode;

  constructor(code: ParcelschnittErrorCode, message: string) {
    super(message);
    this.name = 'ParcelschnittError';
    this.code = code;
  }
}
