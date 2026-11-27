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

## Reporting a new label layout

Open an issue describing the layout (carrier, where it comes from, page size, marker texts,
cut lines or crop marks). **Do not attach the real PDF.** A screenshot with all personal data
blacked out is fine.

---

## Kurzfassung (Deutsch)

- **Niemals echte Versandetiketten committen.** Nur synthetische PDFs in `tests/fixtures/`.
- Keine Netzwerkzugriffe zur Laufzeit, keine neuen Abhängigkeiten ohne Absprache
  (nur MIT-kompatible Lizenzen, exakt gepinnt).
- Erkennung nur anhand des Inhalts; jedes neue Layout braucht Fixture und Test.
- Nie Etiketteninhalte loggen.
- Branch, Pull Request, grüne CI; Commits nach Conventional Commits auf Englisch.
- Neues Layout melden: Issue mit Beschreibung, **kein echtes PDF anhängen**.
