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
  'app.privacy':
    'Alles bleibt auf deinem Gerät: Die PDF wird nur in deinem Browser verarbeitet. Keine Uploads, kein Konto, kein Tracking.',
  'lang.switch': 'English',
  'theme.label': 'Darstellung',
  'theme.system': 'Automatisch',
  'theme.light': 'Hell',
  'theme.dark': 'Dunkel',
  'lang.switchLabel': 'Switch to English',

  'file.drop': 'PDF hierher ziehen oder klicken, um eine Datei auszuwählen',
  'file.hint': 'DHL-Paketmarke, Internetmarke oder Zollinhaltserklärung CN22 als A4-PDF',
  'file.selected': 'Datei: {name}',
  'file.reset': 'Andere Datei',

  'settings.title': 'Einstellungen',
  'settings.profile': 'Etikettenformat',
  'settings.autoProfile': 'Format passend zum Etikett wählen',
  'settings.autoProfileHint':
    'Zum Beispiel DHL-Paketmarke → 103 × 199 mm, Internetmarke → DYMO 99014. Änderst du das Format von Hand, gilt das für die aktuelle Datei.',
  'settings.customs': 'Zollinhaltserklärung (CN22)',
  'settings.customs.withLabels': 'Eigenes Etikett im gleichen Format',
  'settings.customs.separateA4': 'Separat auf A4-Papier',
  'settings.customs.omit': 'Nicht ausgeben',
  'settings.allowShrink': 'Trotzdem verkleinert ausgeben (nicht empfohlen)',
  'settings.remember': 'Einstellungen auf diesem Gerät merken',
  'settings.rememberHint':
    'Gespeichert werden nur Etikettenformat, automatische Formatwahl, Zoll-Option und Darstellung, im Browser dieses Geräts. Nichts wird übertragen. Häkchen entfernen löscht die Angaben.',
  'settings.rememberFailed':
    'Dein Browser erlaubt das Speichern nicht (z. B. im privaten Modus). Die Einstellungen gelten nur für diesen Besuch.',

  'caution.tooShortForDhl':
    'Dieses Format ist zu kurz für die DHL-Paketmarke in Originalgröße. DHL verlangt den Druck in 100 %.',

  'status.processing': 'Wird verarbeitet …',
  'status.noLabel':
    'In dieser PDF wurde kein bekanntes Etikett sicher erkannt. Wähle den Bereich oben selbst aus.',
  'status.manualPending': 'Ziehe den Rahmen über das Etikett, das Ergebnis erscheint dann hier.',
  'status.found': '{count} Element(e) erkannt.',
  'status.profileChosen': 'Format automatisch gewählt: {profile}.',

  'layout.dhl-paketmarke': 'DHL-Paketmarke',
  'layout.internetmarke': 'Internetmarke',
  'layout.customs-cn22': 'Zollinhaltserklärung CN22',
  'layout.manual': 'Manuell gewählter Bereich',

  'manual.title': 'Bereich selbst wählen',
  'manual.start': 'Bereich selbst wählen',
  'manual.hint':
    'Ziehe den Rahmen über das Etikett und passe ihn an den Ecken an. Lass Scheren, Passerkreuze und Belege außen vor. Mit den Pfeilen drehst du das Ergebnis, bis die Schrift aufrecht steht.',
  'manual.loading': 'Seiten werden geladen …',
  'manual.page': 'Seite',
  'manual.pageOption': 'Seite {page} von {count}',
  'manual.left': 'Links (mm)',
  'manual.top': 'Oben (mm)',
  'manual.width': 'Breite (mm)',
  'manual.height': 'Höhe (mm)',
  'manual.rotateLeft': '↺ Links drehen',
  'manual.rotateRight': 'Rechts drehen ↻',
  'manual.rotation': 'Drehung: {degrees}°',
  'manual.frame':
    'Auswahlrahmen. Mit den Pfeiltasten verschieben, mit gedrückter Umschalttaste in größeren Schritten. Größe über die Felder in Millimetern.',
  'manual.back': 'Zurück zur automatischen Erkennung',

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
  'output.hiddenText':
    'Hinweis: Auf der Originalseite steht außerhalb des Etiketts weiterer Text (z. B. eine Rechnung). Er wird nicht gedruckt, ist aber unsichtbar in der Datei enthalten. Zum Drucken ist das unbedenklich, gib die Datei aber nicht weiter.',

  'error.fileTooLarge': 'Die Datei ist zu groß (höchstens {mb} MB).',
  'error.emptyFile': 'Die Datei ist leer.',
  'error.notAPdf': 'Die Datei ist keine PDF.',
  'error.tooManyPages': 'Die PDF hat zu viele Seiten (höchstens {pages}).',
  'error.unreadablePdf': 'Die PDF konnte nicht gelesen werden.',
  'error.pageOutOfRange': 'Die PDF konnte nicht verarbeitet werden.',
  'error.invalidSelection':
    'Der gewählte Bereich ist zu klein oder liegt außerhalb der Seite (mindestens 10 × 10 mm).',
  'error.internal': 'Unerwarteter Fehler. Bitte versuche es erneut.',
  'error.unsupportedBrowser':
    'Dein Browser wird nicht unterstützt. Bitte verwende eine aktuelle Version von Firefox, Chrome, Edge oder Safari.',

  'intro.text':
    'Versandportale liefern Etiketten meist als A4-PDF mit Beleg, Scheren und Schnittlinien. Parcelschnitt schneidet daraus genau das Etikett aus, dreht es richtig herum und legt es in Originalgröße auf das Format deiner Etikettenrolle.',
  'howto.title': 'So geht’s',
  'howto.step1':
    'Etikett wie gewohnt als PDF herunterladen, z. B. bei DHL, eBay oder der Internetmarke der Deutschen Post.',
  'howto.step2': 'PDF unten ablegen und das Format deiner Etikettenrolle wählen.',
  'howto.step3': 'Ergebnis herunterladen oder direkt drucken, in Originalgröße (100 %).',
  'more.title': 'Mehr erfahren',
  'more.supported':
    'Unterstützt: DHL-Paketmarke (national und international, auch über eBay und den Post-Shop), Internetmarke der Deutschen Post und Zollinhaltserklärung CN22.',
  'more.profiles':
    'Formate: 103 × 199 mm (Standard für DHL), 100 × 150 mm, 103 × 150 mm, DYMO 99014 (54 × 101 mm) und Brother 62 mm Endlosband.',
  'more.customs':
    'Zollinhaltserklärung: Sie wird auf Wunsch als eigenes Etikett im gleichen Format ausgegeben, damit du die Rolle nicht wechseln musst, oder separat auf A4-Papier.',
  'more.print':
    'Drucken: Im Druckdialog „Tatsächliche Größe“ bzw. 100 % wählen und im Druckertreiber das passende Etikettenformat einstellen.',
  'more.privacy':
    'Datenschutz: Die PDF wird ausschließlich in deinem Browser verarbeitet. Sie wird nicht hochgeladen, und die Seite lädt keine Inhalte von anderen Servern.',
  'more.hidden':
    'Technischer Hinweis: Die erzeugte PDF enthält die Originalseite unsichtbar im Hintergrund, sichtbar und gedruckt wird nur das Etikett. Bei DHL steckt dort der Beleg, der dieselben Angaben wie das Etikett enthält. Steht auf der Seite weiterer Text, etwa eine Rechnung, weist Parcelschnitt dich darauf hin. Gib die Datei in diesem Fall nicht weiter.',
  'more.unknown':
    'Etikett nicht erkannt? Dann wählst du den Bereich einfach selbst aus. Neue Etikettenarten kannst du über ein Formular auf GitHub melden (kostenloses GitHub-Konto nötig), bitte ohne die echte PDF anzuhängen:',
  'report.layout': 'Neues Etikett melden',
  'report.layoutHint':
    'Sollte Parcelschnitt dieses Etikett kennen? Beschreibe es uns über das Formular auf GitHub (kostenloses Konto nötig). Bitte die echte PDF nicht anhängen.',
  'report.bug': 'Fehler melden',
  'more.disclaimer':
    'Parcelschnitt ist ein unabhängiges Open-Source-Projekt und steht in keiner Verbindung zu DHL oder der Deutschen Post.',
  'support.title': 'Parcelschnitt unterstützen',
  'support.text':
    'Parcelschnitt ist kostenlos und werbefrei. Wenn es dir Zeit spart, kannst du die Weiterentwicklung über GitHub Sponsors unterstützen.',
  'support.button': 'Über GitHub Sponsors unterstützen',
  'footer.source': 'Quellcode auf GitHub',
  'link.external': '(externer Link zu GitHub)',
  'footer.license': 'Open Source, MIT-Lizenz',
  'footer.thirdParty': 'Lizenzen verwendeter Software',
  'footer.imprint': 'Impressum',
  'footer.privacy': 'Datenschutz',
} as const;

export type MessageKey = keyof typeof de;

const en: Record<MessageKey, string> = {
  'app.tagline': 'Crop shipping labels to the exact size of your label printer',
  'app.privacy':
    'Everything stays on your device: the PDF is processed only in your browser. No uploads, no account, no tracking.',
  'lang.switch': 'Deutsch',
  'theme.label': 'Appearance',
  'theme.system': 'Automatic',
  'theme.light': 'Light',
  'theme.dark': 'Dark',
  'lang.switchLabel': 'Auf Deutsch umschalten',

  'file.drop': 'Drop a PDF here or click to choose a file',
  'file.hint': 'DHL Paketmarke, Internetmarke or customs declaration CN22 as an A4 PDF',
  'file.selected': 'File: {name}',
  'file.reset': 'Other file',

  'settings.title': 'Settings',
  'settings.profile': 'Label size',
  'settings.autoProfile': 'Choose the size to match the label',
  'settings.autoProfileHint':
    'For example DHL Paketmarke → 103 × 199 mm, Internetmarke → DYMO 99014. If you change the size by hand, that applies to the current file.',
  'settings.customs': 'Customs declaration (CN22)',
  'settings.customs.withLabels': 'Own label in the same size',
  'settings.customs.separateA4': 'Separately on A4 paper',
  'settings.customs.omit': 'Leave out',
  'settings.allowShrink': 'Shrink anyway (not recommended)',
  'settings.remember': 'Remember settings on this device',
  'settings.rememberHint':
    'Only the label size, the automatic size choice, the customs option and the appearance are stored, in this browser on this device. Nothing is sent anywhere. Unticking deletes them.',
  'settings.rememberFailed':
    'Your browser does not allow storing settings (e.g. in private mode). They apply to this visit only.',

  'caution.tooShortForDhl':
    'This size is too short for a DHL label at full size. DHL requires printing at 100 %.',

  'status.processing': 'Processing …',
  'status.noLabel':
    'No known label was detected with confidence in this PDF. Please select the area above.',
  'status.manualPending': 'Drag the frame over the label; the result then appears here.',
  'status.found': '{count} item(s) detected.',
  'status.profileChosen': 'Size chosen automatically: {profile}.',

  'layout.dhl-paketmarke': 'DHL Paketmarke',
  'layout.internetmarke': 'Internetmarke',
  'layout.customs-cn22': 'Customs declaration CN22',
  'layout.manual': 'Manually selected area',

  'manual.title': 'Select the area yourself',
  'manual.start': 'Select the area yourself',
  'manual.hint':
    'Drag the frame over the label and adjust it at the corners. Leave scissors, crop marks and receipts outside. Use the arrows to turn the result until the text is upright.',
  'manual.loading': 'Loading pages …',
  'manual.page': 'Page',
  'manual.pageOption': 'Page {page} of {count}',
  'manual.left': 'Left (mm)',
  'manual.top': 'Top (mm)',
  'manual.width': 'Width (mm)',
  'manual.height': 'Height (mm)',
  'manual.rotateLeft': '↺ Turn left',
  'manual.rotateRight': 'Turn right ↻',
  'manual.rotation': 'Rotation: {degrees}°',
  'manual.frame':
    'Selection frame. Move it with the arrow keys, hold Shift for larger steps. Change the size with the millimetre fields.',
  'manual.back': 'Back to automatic detection',

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
  'output.hiddenText':
    'Note: the original page contains further text outside the label (e.g. an invoice). It is not printed but remains invisibly in the file. That is fine for printing, but do not pass the file on.',

  'error.fileTooLarge': 'The file is too large (at most {mb} MB).',
  'error.emptyFile': 'The file is empty.',
  'error.notAPdf': 'The file is not a PDF.',
  'error.tooManyPages': 'The PDF has too many pages (at most {pages}).',
  'error.unreadablePdf': 'The PDF could not be read.',
  'error.pageOutOfRange': 'The PDF could not be processed.',
  'error.invalidSelection':
    'The selected area is too small or outside the page (at least 10 × 10 mm).',
  'error.internal': 'Unexpected error. Please try again.',
  'error.unsupportedBrowser':
    'Your browser is not supported. Please use a current version of Firefox, Chrome, Edge or Safari.',

  'intro.text':
    'Shipping portals usually deliver labels as A4 PDFs with a receipt, scissors and cut lines. Parcelschnitt cuts out exactly the label, turns it the right way round and places it at full size on your label roll.',
  'howto.title': 'How it works',
  'howto.step1':
    'Download your label as a PDF as usual, e.g. from DHL, eBay or Deutsche Post Internetmarke.',
  'howto.step2': 'Drop the PDF below and choose the size of your label roll.',
  'howto.step3': 'Download the result or print it directly, at full size (100 %).',
  'more.title': 'Learn more',
  'more.supported':
    'Supported: DHL Paketmarke (national and international, also via eBay and the Post-Shop), Deutsche Post Internetmarke and customs declaration CN22.',
  'more.profiles':
    'Sizes: 103 × 199 mm (standard for DHL), 100 × 150 mm, 103 × 150 mm, DYMO 99014 (54 × 101 mm) and Brother 62 mm continuous tape.',
  'more.customs':
    'Customs declaration: on request it becomes its own label in the same size, so you do not have to change rolls, or a separate A4 page.',
  'more.print':
    'Printing: choose "Actual size" or 100 % in the print dialog and set the matching label size in the printer driver.',
  'more.privacy':
    'Privacy: the PDF is processed only in your browser. It is not uploaded, and the page loads nothing from other servers.',
  'more.hidden':
    'Technical note: the generated PDF contains the original page invisibly in the background; only the label is visible and printed. For DHL this is the receipt, which repeats the label data. If the page holds further text, such as an invoice, Parcelschnitt tells you. In that case, do not pass the file on.',
  'more.unknown':
    'Label not recognised? Then simply select the area yourself. You can report new label types through a form on GitHub (free GitHub account required), please without attaching the real PDF:',
  'report.layout': 'Report a new label',
  'report.layoutHint':
    'Should Parcelschnitt know this label? Describe it to us through the form on GitHub (free account required). Please do not attach the real PDF.',
  'report.bug': 'Report a bug',
  'more.disclaimer':
    'Parcelschnitt is an independent open-source project and is not affiliated with DHL or Deutsche Post.',
  'support.title': 'Support Parcelschnitt',
  'support.text':
    'Parcelschnitt is free and ad-free. If it saves you time, you can support its development via GitHub Sponsors.',
  'support.button': 'Support via GitHub Sponsors',
  'footer.source': 'Source code on GitHub',
  'link.external': '(external link to GitHub)',
  'footer.license': 'Open source, MIT licence',
  'footer.thirdParty': 'Third-party licences',
  'footer.imprint': 'Legal notice',
  'footer.privacy': 'Privacy policy',
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
