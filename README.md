# Parcelschnitt

> **Erste Version:** [parcelschnitt.github.io/parcelschnitt](https://parcelschnitt.github.io/parcelschnitt/). Rückmeldungen und neue Etikettenarten sind willkommen.
> **First version:** [parcelschnitt.github.io/parcelschnitt](https://parcelschnitt.github.io/parcelschnitt/). Feedback and new label types are welcome.

[Deutsch](#deutsch) · [English](#english)

---

## Deutsch

Parcelschnitt schneidet A4-Versandetiketten als PDF auf das genaue Format deiner
Etikettendrucker-Rolle zu, zum Beispiel die DHL-Paketmarke auf 103 × 199 mm oder die
Internetmarke der Deutschen Post auf DYMO 99014.

**Datenschutz zuerst:** Alles läuft in deinem Browser. Es gibt keinen Server, keine
Uploads, kein Konto und kein Tracking. Deine Etiketten verlassen deinen Rechner nicht.

### Funktionen

- Automatische Erkennung von DHL-Paketmarke (eBay, DHL Online-Frankierung, Post-Shop,
  national und international), Zollinhaltserklärung CN22 und Internetmarke anhand des
  Inhalts, nicht anhand fester Koordinaten
- Zuschnitt in Originalgröße (100 %); Barcodes bleiben Vektoren und werden nicht gerastert
- Profile: 103 × 199 mm, 100 × 150 mm, 103 × 150 mm, DYMO 99014, Brother 62 mm
- Warnung, wenn ein Etikett nicht 1:1 auf das gewählte Format passt; nie stilles Verkleinern
- Manueller Zuschnitt, wenn kein Layout sicher erkannt wird oder die Erkennung danebenliegt
- Später: Desktop-App mit Direktdruck und überwachtem Ordner

### Stand

Die erste Version ist online und im Alltag getestet: Erkennung, Zuschnitt, manueller Zuschnitt
und die Weboberfläche. Weitere Versanddienstleister und eine Desktop-App sind geplant.

### Entwicklung

Voraussetzung: Node.js 24.

```sh
npm install
npm run dev        # local dev server / lokaler Entwicklungsserver
npm test
npm run lint
npm run typecheck
npm run build      # static site in dist/ / statische Seite in dist/
```

Mitarbeit: siehe [CONTRIBUTING.md](CONTRIBUTING.md). Sicherheitslücken bitte vertraulich
melden: siehe [SECURITY.md](SECURITY.md).

### Lizenz

[MIT](LICENSE)

---

## English

Parcelschnitt crops A4 shipping-label PDFs to the exact size of your label printer roll,
for example a DHL Paketmarke to 103 × 199 mm or a Deutsche Post Internetmarke to DYMO 99014.

**Privacy first:** everything runs in your browser. No server, no uploads, no account, no
tracking. Your labels never leave your computer.

### Features

- Automatic detection of DHL Paketmarke (eBay, DHL Online-Frankierung, Post-Shop, national
  and international), customs declaration CN22 and Internetmarke based on content, not
  fixed coordinates
- Cropping at 100 % scale; barcodes stay vectors and are never rasterised
- Profiles: 103 × 199 mm, 100 × 150 mm, 103 × 150 mm, DYMO 99014, Brother 62 mm
- A warning when a label does not fit the chosen size 1:1; never silent shrinking
- Manual cropping when no layout is detected with confidence or the detection is off
- Later: desktop app with direct printing and a watched folder

### Status

The first version is online and tested in daily use: detection, cropping, manual cropping and
the web interface. More carriers and a desktop app are planned.

### Development

Requires Node.js 24.

```sh
npm install
npm run dev        # local dev server / lokaler Entwicklungsserver
npm test
npm run lint
npm run typecheck
npm run build      # static site in dist/ / statische Seite in dist/
```

Contributing: see [CONTRIBUTING.md](CONTRIBUTING.md). Please report vulnerabilities
privately: see [SECURITY.md](SECURITY.md).

### License

[MIT](LICENSE)
