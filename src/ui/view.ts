/**
 * Pure presentation logic: turns worker results into display text. No DOM access, so it is
 * covered by unit tests.
 */
import { LIMITS } from '../core/limits.ts';
import { formatPercent, isMessageKey, t, type Lang } from './i18n.ts';
import type { ErrorCode, LabelSummary } from './protocol.ts';

export type Tone = 'ok' | 'warn';

export interface LabelLine {
  readonly text: string;
  readonly tone: Tone;
}

export interface LabelView {
  readonly name: string;
  readonly target: string;
  readonly lines: readonly LabelLine[];
}

export function layoutName(lang: Lang, layoutId: string): string {
  const key = `layout.${layoutId}`;
  return isMessageKey(key) ? t(lang, key) : layoutId;
}

export function describeLabel(lang: Lang, label: LabelSummary): LabelView {
  const lines: LabelLine[] = [];
  const { fit } = label;
  if (!fit.ok) {
    lines.push({
      text: t(lang, 'fit.doesNotFit', { percent: formatPercent(fit.requiredScale) }),
      tone: 'warn',
    });
  } else if (fit.warnings.length === 0) {
    lines.push({ text: t(lang, 'fit.ok'), tone: 'ok' });
  } else {
    for (const warning of fit.warnings) {
      lines.push(
        warning.code === 'scaled'
          ? { text: t(lang, 'fit.scaled', { percent: formatPercent(warning.scale) }), tone: 'warn' }
          : { text: t(lang, 'fit.carrierRequiresFullScale'), tone: 'warn' },
      );
    }
  }
  if (label.hiddenText) lines.push({ text: t(lang, 'output.hiddenText'), tone: 'warn' });
  return {
    name: layoutName(lang, label.layoutId),
    target: t(lang, label.target === 'a4Sheet' ? 'target.a4Sheet' : 'target.labelPrinter'),
    lines,
  };
}

/** The shrink option is offered only while something does not fit (or was shrunk). */
export function offersShrink(labels: readonly LabelSummary[]): boolean {
  return labels.some((l) => !l.fit.ok || l.fit.warnings.some((w) => w.code === 'scaled'));
}

export function hasCustomsForm(labels: readonly LabelSummary[]): boolean {
  return labels.some((l) => l.role === 'customsForm');
}

export function errorMessage(lang: Lang, code: ErrorCode): string {
  switch (code) {
    case 'fileTooLarge':
      return t(lang, 'error.fileTooLarge', { mb: LIMITS.maxFileBytes / (1024 * 1024) });
    case 'tooManyPages':
      return t(lang, 'error.tooManyPages', { pages: LIMITS.maxPages });
    case 'emptyFile':
      return t(lang, 'error.emptyFile');
    case 'notAPdf':
      return t(lang, 'error.notAPdf');
    case 'unreadablePdf':
      return t(lang, 'error.unreadablePdf');
    case 'pageOutOfRange':
      return t(lang, 'error.pageOutOfRange');
    case 'invalidSelection':
      return t(lang, 'error.invalidSelection');
    case 'internal':
      return t(lang, 'error.internal');
  }
}

/** Download name derived from the input name; never contains path separators. */
export function outputFileName(inputName: string, suffix: string): string {
  const base = inputName
    .replace(/\.pdf$/i, '')
    .replace(/[^\p{L}\p{N}._ -]+/gu, '_')
    .slice(0, 80);
  return `${base || 'label'}-${suffix}.pdf`;
}
