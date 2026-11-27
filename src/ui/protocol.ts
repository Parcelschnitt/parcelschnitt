/**
 * Messages between the UI (main thread) and the processing worker.
 *
 * The worker is the only place where PDFs are parsed. The main thread sends raw bytes and
 * settings and receives the generated PDFs, preview bitmaps and a summary without any label
 * content. Both directions are validated with type guards.
 */
import type { CustomsFormOutput, FitWarning, ParcelschnittErrorCode } from '../core/index.ts';
import type { QuarterTurn } from '../core/geometry.ts';
import type { LayoutRole } from '../layouts/index.ts';
import { PROFILES, type ProfileId } from '../profiles/index.ts';

export interface ProcessRequest {
  readonly type: 'process';
  readonly id: number;
  readonly bytes: ArrayBuffer;
  readonly profileId: ProfileId;
  readonly allowShrink: boolean;
  readonly customsForms: CustomsFormOutput;
}

export type FitSummary =
  | {
      readonly ok: true;
      readonly scale: number;
      readonly rotation: QuarterTurn;
      readonly warnings: readonly FitWarning[];
    }
  | { readonly ok: false; readonly requiredScale: number };

/** What the UI may know about a detected item: layout and fit, never its content. */
export interface LabelSummary {
  readonly layoutId: string;
  readonly role: LayoutRole;
  readonly target: 'labelPrinter' | 'a4Sheet';
  readonly fit: FitSummary;
}

export interface ResultResponse {
  readonly type: 'result';
  readonly id: number;
  readonly labels: readonly LabelSummary[];
  readonly pdf: ArrayBuffer | null;
  readonly a4Pdf: ArrayBuffer | null;
  readonly previews: readonly ImageBitmap[];
  readonly a4Previews: readonly ImageBitmap[];
}

export type ErrorCode = ParcelschnittErrorCode | 'internal';

export interface ErrorResponse {
  readonly type: 'error';
  readonly id: number;
  readonly code: ErrorCode;
}

export type WorkerResponse = ResultResponse | ErrorResponse;

const CUSTOMS_OPTIONS: readonly CustomsFormOutput[] = ['withLabels', 'separateA4', 'omit'];
const ERROR_CODES: readonly ErrorCode[] = [
  'fileTooLarge',
  'emptyFile',
  'notAPdf',
  'tooManyPages',
  'unreadablePdf',
  'pageOutOfRange',
  'invalidSelection',
  'internal',
];

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null;

export function isProfileId(value: unknown): value is ProfileId {
  return PROFILES.some((p) => p.id === value);
}

export function isProcessRequest(value: unknown): value is ProcessRequest {
  return (
    isRecord(value) &&
    value['type'] === 'process' &&
    Number.isSafeInteger(value['id']) &&
    value['bytes'] instanceof ArrayBuffer &&
    isProfileId(value['profileId']) &&
    typeof value['allowShrink'] === 'boolean' &&
    CUSTOMS_OPTIONS.some((o) => o === value['customsForms'])
  );
}

export function isErrorCode(value: unknown): value is ErrorCode {
  return ERROR_CODES.some((c) => c === value);
}

export function isWorkerResponse(value: unknown): value is WorkerResponse {
  if (!isRecord(value) || !Number.isSafeInteger(value['id'])) return false;
  if (value['type'] === 'error') return isErrorCode(value['code']);
  return (
    value['type'] === 'result' &&
    Array.isArray(value['labels']) &&
    Array.isArray(value['previews']) &&
    Array.isArray(value['a4Previews']) &&
    (value['pdf'] === null || value['pdf'] instanceof ArrayBuffer) &&
    (value['a4Pdf'] === null || value['a4Pdf'] instanceof ArrayBuffer)
  );
}
