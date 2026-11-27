# Contributing

Thanks for helping! Parcelschnitt is small and privacy-focused; these rules keep it that way.
(Kurzfassung auf Deutsch unten.)

## Ground rules

1. **Never commit real shipping labels.** Only synthetic PDFs under `tests/fixtures/`. A
   pre-commit hook and CI block PDFs anywhere else. Keep real samples outside the repo and
   point `PARCELSCHNITT_SAMPLES` at them for local tests.
2. **No network access at runtime**: no CDNs, external fonts, analytics or third-party
   scripts.
3. **Treat PDFs as untrusted input.** Parse with pdf.js only; respect the size and page limits.
4. **No new dependencies without discussion.** Licenses must be MIT-compatible (no GPL/AGPL);
   versions are pinned exactly.
5. **Detection is content based.** Never fixed coordinates; never guess. A new label layout
   needs a synthetic fixture (via `scripts/generate-fixtures.ts`) and tests.
6. **Never log label content** (names, addresses, tracking numbers), not even in tests.

## Workflow

```sh
npm install          # also installs the pre-commit hook
npm run lint
npm run typecheck
npm test
npm run fixtures     # regenerate synthetic fixtures after changing the generator
```

- Work on a branch, open a pull request; CI must be green.
- Small commits, [Conventional Commits](https://www.conventionalcommits.org/) in English.
- Code, identifiers and comments in English; user-facing docs in German and English.

## Imprint and privacy pages

`impressum.html` and `datenschutz.html` contain `{{legal.*}}` placeholders. The operator's
details are filled in at build time from `PARCELSCHNITT_LEGAL_*` environment variables or from
a local `legal.local.json` (git-ignored; see `legal.example.json`). Never commit real details.
Deployment builds set `PARCELSCHNITT_REQUIRE_LEGAL=1` and fail without complete details.

## Deployment (maintainers)

`.github/workflows/deploy.yml` builds `main` and publishes it on GitHub Pages. It only runs
once the repository is public. One-time setup:

1. Settings → Pages → Build and deployment → Source: **GitHub Actions**.
2. Settings → Secrets and variables → Actions → **Variables** → add the repository variables
   `PARCELSCHNITT_LEGAL_NAME`, `PARCELSCHNITT_LEGAL_STREET`, `PARCELSCHNITT_LEGAL_POSTAL_CODE`,
   `PARCELSCHNITT_LEGAL_CITY`, `PARCELSCHNITT_LEGAL_COUNTRY`, `PARCELSCHNITT_LEGAL_EMAIL`.
   Variables (not secrets) are fine: the values are published on the imprint page anyway.
3. Push to `main` or run the workflow manually (Actions → Deploy to GitHub Pages → Run).

The build fails if any variable is missing, and the deployed pages are checked for the CSP and
for leftover placeholders.

## Reporting a new label layout

Use the issue form "Neues Etikett melden / Report a new label layout". It asks for the carrier,
the source of the PDF, sizes and a description of the page layout. **Do not attach the real
PDF.** A screenshot is fine only with all personal data, barcodes and codes blacked out.
Vulnerabilities go through private vulnerability reporting (see SECURITY.md), never an issue.

---

## Kurzfassung (Deutsch)

- **Niemals echte Versandetiketten committen.** Nur synthetische PDFs in `tests/fixtures/`.
- Keine Netzwerkzugriffe zur Laufzeit, keine neuen Abhängigkeiten ohne Absprache
  (nur MIT-kompatible Lizenzen, exakt gepinnt).
- Erkennung nur anhand des Inhalts; jedes neue Layout braucht Fixture und Test.
- Nie Etiketteninhalte loggen.
- Branch, Pull Request, grüne CI; Commits nach Conventional Commits auf Englisch.
- Neues Layout melden: Issue-Formular „Neues Etikett melden“, **kein echtes PDF anhängen**.
