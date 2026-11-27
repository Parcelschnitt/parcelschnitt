# Parcelschnitt

Crops A4 shipping-label PDFs (DHL Paketmarke, Deutsche Post Internetmarke; more carriers later)
to the exact size of a label printer roll. Runs entirely in the user's browser: no server,
no uploads, no accounts, no tracking. Static site on GitHub Pages. MIT licensed.

Version 2 (later) wraps the same core in a Tauri desktop app with direct printing and a
watched folder. Keep `src/core` free of DOM and UI code so it can be reused there.

## Non-negotiable rules

- **Never commit real shipping labels.** Real PDFs contain names, addresses and tracking
  numbers of third parties. Only synthetic or anonymized PDFs in `tests/fixtures/` may be
  committed. Real samples for local testing live OUTSIDE the repo; their folder is passed
  via the env var `PARCELSCHNITT_SAMPLES` and tests that need them are skipped when it is unset.
- No network access at runtime: no CDNs, no external fonts, no analytics, no third-party
  scripts or iframes. Everything is bundled. CSP: `default-src 'self'; connect-src 'none'`,
  no inline scripts.
- PDFs are untrusted input. Parse only with pdf.js inside a Web Worker. Enforce file size
  and page count limits. No hand-written PDF parser.
- Keep vector content as vectors (pdf-lib embedding). Never rasterize barcodes.
- DHL labels must print at 100 % scale. If a label does not fit the chosen profile 1:1,
  warn the user; never shrink silently.
- Detection is content-based (marker texts, cut lines, crop marks), never fixed coordinates.
  If no rule matches with confidence, fall back to manual cropping. Never guess.
- Helper graphics (scissors, crop-mark crosses) are excluded from the output.
- Dependencies: minimal, pinned via lockfile, licenses compatible with MIT
  (no GPL/AGPL; PyMuPDF and similar are out).

## Stack

TypeScript (strict), Vite, pdf.js (Apache-2.0), @cantoo/pdf-lib (MIT, maintained fork of pdf-lib), Vitest, ESLint, Prettier.
No heavy UI framework. UI strings via a small i18n module, German and English.

## Layout

```
src/core/        detection + cropping, no DOM
src/layouts/     one description per label type (markers, bounds, rotation)
src/profiles/    bundled printer profiles (mm)
src/ui/          web UI, i18n de/en; worker.ts is the only place that parses PDFs
tests/fixtures/  synthetic/anonymized PDFs only
docs/            user guide, "report a new layout"
```

## Knowledge from the Python prototype (2026-11-27, three real PDFs)

- eBay, DHL Online-Frankierung and Post-Shop produce the SAME DHL label layout.
- DHL Paketmarke: page A4 portrait; marker texts "Leitcode" and "Identcode". The label sits
  above a horizontal full-width cut line (~y = 421 pt from top) with small scissors icons at
  both ends just above it (exclude them: ignore drawings within ~15 pt above the cut line).
  Content bbox is about 189 x 100 mm, rotated 90°; centre it in a 199 x 103 mm window and
  rotate so text reads upright on a 103 x 199 mm portrait page.
- Internetmarke (Brief/Warenpost): four crop-mark crosses (two ~14 pt lines each) around a
  ~90 x 47 mm area at the top left of the page. The crosses must NOT appear in the output:
  centre on the content between them, not on the crosses. Target e.g. DYMO 99014
  (54 x 101 mm), 1:1.
- International DHL labels (e.g. "Päckchen XS - Welt", 2026-11-27 samples) use the same
  layout but are about 197 x 100 mm; still fits the 199 x 103 mm window at 100 %.
- International DHL PDFs have two pages: page 1 is the customs declaration CN22, page 2 the
  label. CN22: upright form with a yellow border of four lines, about 79.3 x 110.3 mm, marker
  text "CN22" inside; instructions, an interrupted cut line and scissors lie below it and are
  excluded. The border is part of the output. Fits 103 x 199, 100 x 150 and 103 x 150 at 1:1.
- Users do not change rolls between label and customs form. Customs forms therefore either
  go on the same label profile (default), onto a separate A4 sheet for an office printer
  (own PDF), or are omitted. The label profile is chosen by the shipping label, not by the
  customs form.
- Rotating while clipping in one step produced offsets in the prototype; crop first, then
  rotate (or set page /Rotate).

## Web UI architecture

- `src/ui/worker.ts` runs the core with pdf.js in-thread (`globalThis.pdfjsWorker`) and
  renders previews to OffscreenCanvas (`src/ui/preview.ts`). The main thread only receives
  output PDFs, preview bitmaps and a content-free summary (`src/ui/protocol.ts`).
- Main-thread UI code must not import pdf.js, pdf-lib or core runtime code (ESLint enforced).
- The production CSP is injected as a meta tag at build time (`vite.config.ts`); CI checks it.
- No settings are persisted (privacy by default); all text is set via `textContent`.

## Maintainer guidelines

The maintainer's personal coding and security guidelines apply to this project in addition
to this file. They are loaded through the maintainer's user-level `~/.claude/CLAUDE.md`, not
from this repository. Read them at the start of every session.

- Security: where the guidelines and this file differ, the stricter rule wins.
- Style and conventions: if they contradict this file, do not pick one silently; point out
  the conflict and ask.
- Never copy text from the guidelines into this public repository unless asked.

Contributors without access to those guidelines: the rules in this file, `CONTRIBUTING.md`
and the CI checks are the binding baseline for this project.

### Decisions on guideline conflicts (2026-11-27)

- No mandatory per-file header and no `AI-ASSISTED` markers with names in source files.
  Short TSDoc comments where useful; AI involvement is recorded via `Co-Authored-By` in commits.
- No `pino`/`winston` and no `zod`: `src/core` does not log at all (never label content);
  input is validated with hand-written type guards and hard size/page limits.
- Exact version pins in `package.json` (no `^`/`~`), `npm ci --ignore-scripts` in CI,
  SBOM via `npm sbom` in CI, CodeQL on pull requests.
- Merges happen via pull request after the maintainer's review.

## Conventions

- Code, identifiers, comments and commit messages in English (Conventional Commits).
  User-facing docs bilingual (README with German and English sections).
- Every new label layout ships with a fixture and a test.
- Small, reviewable commits; work on branches, merge via pull request.
