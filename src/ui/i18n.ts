/**
 * UI strings in German and English. German is the reference: every key must exist in both
 * languages (enforced by the type of `en` and by a test).
 *
 * Placeholders use `{name}` and are filled by `t()`. Strings are always inserted with
 * `textContent`, never as HTML.
 */

export type Lang = 'de' | 'en';

const de = {
  'app.tagline': 'Versandetiketten passgenau für den Etikettendrucker zuschneiden',
  'app.wip': 'In Entwicklung, noch nicht für den Alltag gedacht',
  'app.privacy':
    'Alles bleibt auf deinem Gerät: Die PDF wird nur in deinem Browser verarbeitet. Keine Uploads, kein Konto, kein Tracking.',
  'lang.switch': 'English',
  'lang.switchLabel': 'Switch to English',

  'file.drop': 'PDF hierher ziehen oder klicken, um eine Datei auszuwählen',
  'file.hint': 'DHL-Paketmarke, Internetmarke oder Zollinhaltserklärung CN22 als A4-PDF',
  'file.selected': 'Datei: {name}',
  'file.reset': 'Andere Datei',

  'settings.title': 'Einstellungen',
  'settings.profile': 'Etikettenformat',
  'settings.customs': 'Zollinhaltserklärung (CN22)',
  'settings.customs.withLabels': 'Mit auf das Etikett drucken',
  'settings.customs.separateA4': 'Separat auf A4 drucken',
  'settings.customs.omit': 'Nicht drucken',
  'settings.allowShrink': 'Trotzdem verkleinert ausgeben (nicht empfohlen)',

  'caution.tooShortForDhl':
    'Dieses Format ist zu kurz für die DHL-Paketmarke in Originalgröße. DHL verlangt den Druck in 100 %.',

  'status.processing': 'Wird verarbeitet …',
  'status.noLabel':
    'In dieser PDF wurde kein bekanntes Etikett sicher erkannt. Manueller Zuschnitt folgt in einer späteren Version.',
  'status.found': '{count} Element(e) erkannt.',

  'layout.dhl-paketmarke': 'DHL-Paketmarke',
  'layout.internetmarke': 'Internetmarke',
  'layout.customs-cn22': 'Zollinhaltserklärung CN22',

  'target.labelPrinter': 'Etikettendrucker',
  'target.a4Sheet': 'A4-Drucker',

  'fit.ok': 'Passt in Originalgröße (100 %).',
  'fit.doesNotFit': 'Passt nicht in Originalgröße auf dieses Format (nötig wären {percent} %).',
  'fit.scaled': 'Auf {percent} % verkleinert.',
  'fit.carrierRequiresFullScale':
    'Achtung: DHL verlangt den Druck in Originalgröße. Verkleinerte Etiketten können abgelehnt werden.',

  'output.title': 'Ergebnis',
  'output.labels': 'Für den Etikettendrucker',
  'output.a4': 'Für den A4-Drucker',
  'output.download': 'PDF herunterladen',
  'output.open': 'Zum Drucken öffnen',
  'output.printHint':
    'Beim Drucken „Tatsächliche Größe“ bzw. 100 % wählen, nicht „An Seite anpassen“.',
  'output.previewAlt': 'Vorschau Seite {page}',

  'error.fileTooLarge': 'Die Datei ist zu groß (höchstens {mb} MB).',
  'error.emptyFile': 'Die Datei ist leer.',
  'error.notAPdf': 'Die Datei ist keine PDF.',
  'error.tooManyPages': 'Die PDF hat zu viele Seiten (höchstens {pages}).',
  'error.unreadablePdf': 'Die PDF konnte nicht gelesen werden.',
  'error.pageOutOfRange': 'Die PDF konnte nicht verarbeitet werden.',
  'error.internal': 'Unerwarteter Fehler. Bitte versuche es erneut.',
  'error.unsupportedBrowser':
    'Dein Browser wird nicht unterstützt. Bitte verwende eine aktuelle Version von Firefox, Chrome, Edge oder Safari.',

  'footer.license': 'Open Source, MIT-Lizenz',
  'footer.thirdParty': 'Lizenzen verwendeter Software',
} as const;

export type MessageKey = keyof typeof de;

const en: Record<MessageKey, string> = {
  'app.tagline': 'Crop shipping labels to the exact size of your label printer',
  'app.wip': 'Work in progress, not ready for everyday use',
  'app.privacy':
    'Everything stays on your device: the PDF is processed only in your browser. No uploads, no account, no tracking.',
  'lang.switch': 'Deutsch',
  'lang.switchLabel': 'Auf Deutsch umschalten',

  'file.drop': 'Drop a PDF here or click to choose a file',
  'file.hint': 'DHL Paketmarke, Internetmarke or customs declaration CN22 as an A4 PDF',
  'file.selected': 'File: {name}',
  'file.reset': 'Other file',

  'settings.title': 'Settings',
  'settings.profile': 'Label size',
  'settings.customs': 'Customs declaration (CN22)',
  'settings.customs.withLabels': 'Print with the labels',
  'settings.customs.separateA4': 'Print separately on A4',
  'settings.customs.omit': 'Do not print',
  'settings.allowShrink': 'Shrink anyway (not recommended)',

  'caution.tooShortForDhl':
    'This size is too short for a DHL label at full size. DHL requires printing at 100 %.',

  'status.processing': 'Processing …',
  'status.noLabel':
    'No known label was detected with confidence in this PDF. Manual cropping will follow in a later version.',
  'status.found': '{count} item(s) detected.',

  'layout.dhl-paketmarke': 'DHL Paketmarke',
  'layout.internetmarke': 'Internetmarke',
  'layout.customs-cn22': 'Customs declaration CN22',

  'target.labelPrinter': 'Label printer',
  'target.a4Sheet': 'A4 printer',

  'fit.ok': 'Fits at full size (100 %).',
  'fit.doesNotFit': 'Does not fit this size at 100 % (would need {percent} %).',
  'fit.scaled': 'Shrunk to {percent} %.',
  'fit.carrierRequiresFullScale':
    'Warning: DHL requires printing at full size. Shrunk labels may be rejected.',

  'output.title': 'Result',
  'output.labels': 'For the label printer',
  'output.a4': 'For the A4 printer',
  'output.download': 'Download PDF',
  'output.open': 'Open for printing',
  'output.printHint': 'When printing, choose "Actual size" or 100 %, not "Fit to page".',
  'output.previewAlt': 'Preview page {page}',

  'error.fileTooLarge': 'The file is too large (at most {mb} MB).',
  'error.emptyFile': 'The file is empty.',
  'error.notAPdf': 'The file is not a PDF.',
  'error.tooManyPages': 'The PDF has too many pages (at most {pages}).',
  'error.unreadablePdf': 'The PDF could not be read.',
  'error.pageOutOfRange': 'The PDF could not be processed.',
  'error.internal': 'Unexpected error. Please try again.',
  'error.unsupportedBrowser':
    'Your browser is not supported. Please use a current version of Firefox, Chrome, Edge or Safari.',

  'footer.license': 'Open source, MIT licence',
  'footer.thirdParty': 'Third-party licences',
};

const MESSAGES: Record<Lang, Record<MessageKey, string>> = { de, en };

export type MessageParams = Readonly<Record<string, string | number>>;

/** Translated string with `{name}` placeholders filled in. Unknown placeholders stay visible. */
export function t(lang: Lang, key: MessageKey, params: MessageParams = {}): string {
  return MESSAGES[lang][key].replace(/\{(\w+)\}/g, (match, name: string) => {
    const value = params[name];
    return value === undefined ? match : String(value);
  });
}

/** German for German-speaking browsers, English otherwise. */
export function detectLang(languages: readonly string[]): Lang {
  return languages.some((l) => l.toLowerCase().startsWith('de')) ? 'de' : 'en';
}

export function isMessageKey(key: string): key is MessageKey {
  return Object.hasOwn(de, key);
}

/** For tests: all keys per language. */
export const messageKeys = (lang: Lang): string[] => Object.keys(MESSAGES[lang]);

/** Formats a scale factor (0..1) as a whole percentage, never rounding up to 100 %. */
export function formatPercent(scale: number): number {
  return Math.floor(scale * 100);
}
