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
  /** Choose the profile recommended for the detected label instead of `profileId`. */
  readonly autoProfile: boolean;
}

/** Render the source pages so the user can select an area by hand. */
export interface PagesRequest {
  readonly type: 'pages';
  readonly id: number;
  readonly bytes: ArrayBuffer;
}

/** Crop a user-selected area (view-space pt) and turn it by `rotation` (clockwise). */
export interface ManualRequest {
  readonly type: 'manual';
  readonly id: number;
  readonly bytes: ArrayBuffer;
  readonly profileId: ProfileId;
  readonly allowShrink: boolean;
  readonly pageIndex: number;
  readonly box: {
    readonly x0: number;
    readonly y0: number;
    readonly x1: number;
    readonly y1: number;
  };
  readonly rotation: QuarterTurn;
}

export type WorkerRequest = ProcessRequest | PagesRequest | ManualRequest;

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
  /** Geometry only (view-space pt), used to pre-fill the manual selection. */
  readonly pageIndex: number;
  readonly contentBox: {
    readonly x0: number;
    readonly y0: number;
    readonly x1: number;
    readonly y1: number;
  };
  /** Clockwise turn that makes this item upright. */
  readonly uprightRotation: QuarterTurn;
  readonly role: LayoutRole;
  readonly target: 'labelPrinter' | 'a4Sheet';
  readonly fit: FitSummary;
}

export interface ResultResponse {
  readonly type: 'result';
  readonly id: number;
  /** Label-printer profile actually used (may differ from the request with autoProfile). */
  readonly profileId: ProfileId;
  readonly labels: readonly LabelSummary[];
  readonly pdf: ArrayBuffer | null;
  readonly a4Pdf: ArrayBuffer | null;
  readonly previews: readonly ImageBitmap[];
  readonly a4Previews: readonly ImageBitmap[];
}

/** A rendered source page with its displayed size in PDF points. */
export interface PageImage {
  readonly bitmap: ImageBitmap;
  readonly widthPt: number;
  readonly heightPt: number;
}

export interface PagesResponse {
  readonly type: 'pages';
  readonly id: number;
  readonly pages: readonly PageImage[];
}

export type ErrorCode = ParcelschnittErrorCode | 'internal';

export interface ErrorResponse {
  readonly type: 'error';
  readonly id: number;
  readonly code: ErrorCode;
}

export type WorkerResponse = ResultResponse | PagesResponse | ErrorResponse;

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
    typeof value['autoProfile'] === 'boolean' &&
    CUSTOMS_OPTIONS.some((o) => o === value['customsForms'])
  );
}

const QUARTER_TURNS: readonly QuarterTurn[] = [0, 90, 180, 270];

function isBox(value: unknown): value is ManualRequest['box'] {
  return (
    isRecord(value) &&
    ['x0', 'y0', 'x1', 'y1'].every((k) => typeof value[k] === 'number' && Number.isFinite(value[k]))
  );
}

export function isPagesRequest(value: unknown): value is PagesRequest {
  return (
    isRecord(value) &&
    value['type'] === 'pages' &&
    Number.isSafeInteger(value['id']) &&
    value['bytes'] instanceof ArrayBuffer
  );
}

export function isManualRequest(value: unknown): value is ManualRequest {
  return (
    isRecord(value) &&
    value['type'] === 'manual' &&
    Number.isSafeInteger(value['id']) &&
    value['bytes'] instanceof ArrayBuffer &&
    isProfileId(value['profileId']) &&
    typeof value['allowShrink'] === 'boolean' &&
    Number.isSafeInteger(value['pageIndex']) &&
    (value['pageIndex'] as number) >= 0 &&
    isBox(value['box']) &&
    QUARTER_TURNS.some((q) => q === value['rotation'])
  );
}

export function isErrorCode(value: unknown): value is ErrorCode {
  return ERROR_CODES.some((c) => c === value);
}

export function isWorkerResponse(value: unknown): value is WorkerResponse {
  if (!isRecord(value) || !Number.isSafeInteger(value['id'])) return false;
  if (value['type'] === 'error') return isErrorCode(value['code']);
  if (value['type'] === 'pages') return Array.isArray(value['pages']);
  return (
    value['type'] === 'result' &&
    isProfileId(value['profileId']) &&
    Array.isArray(value['labels']) &&
    Array.isArray(value['previews']) &&
    Array.isArray(value['a4Previews']) &&
    (value['pdf'] === null || value['pdf'] instanceof ArrayBuffer) &&
    (value['a4Pdf'] === null || value['a4Pdf'] instanceof ArrayBuffer)
  );
}
