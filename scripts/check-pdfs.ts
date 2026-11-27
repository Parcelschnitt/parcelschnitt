/**
 * Refuses PDFs outside `tests/fixtures/`.
 *
 * Real shipping labels contain personal data of third parties and must never enter the
 * repository. Files are checked by extension AND by content (a PDF header line such as
 * `%PDF-1.7` within the first 1024 bytes), so a renamed PDF is caught as well.
 *
 *   --staged  check the files staged for commit (pre-commit hook)
 *   --all     check every tracked file (CI; hooks can be bypassed with --no-verify)
 */
import { execFileSync } from 'node:child_process';
import { openSync, readSync, closeSync } from 'node:fs';

const ALLOWED_PREFIX = 'tests/fixtures/';
/** A PDF header line: `%PDF-` plus version, at the start of a line. */
const PDF_HEADER = /(?:^|[\r\n])%PDF-\d\.\d/;
/** The PDF spec allows the header anywhere in the first 1024 bytes. */
const HEADER_SEARCH_BYTES = 1024;

type Mode = '--staged' | '--all';

function git(args: readonly string[]): Buffer {
  return execFileSync('git', args, { maxBuffer: 256 * 1024 * 1024 });
}

function listFiles(mode: Mode): string[] {
  const output =
    mode === '--staged'
      ? git(['diff', '--cached', '--name-only', '--diff-filter=ACMR', '-z'])
      : git(['ls-files', '-z']);
  return output.toString('utf8').split('\0').filter(Boolean);
}

function readHead(mode: Mode, path: string): Buffer {
  if (mode === '--staged') {
    // Staged content is read from the index, not from the working tree.
    return git(['cat-file', 'blob', `:${path}`]).subarray(0, HEADER_SEARCH_BYTES);
  }
  const buffer = Buffer.alloc(HEADER_SEARCH_BYTES);
  const fd = openSync(path, 'r');
  try {
    return buffer.subarray(0, readSync(fd, buffer, 0, HEADER_SEARCH_BYTES, 0));
  } finally {
    closeSync(fd);
  }
}

function looksLikePdf(content: Buffer): boolean {
  return PDF_HEADER.test(content.toString('latin1'));
}

function findViolations(mode: Mode): string[] {
  const violations: string[] = [];
  for (const path of listFiles(mode)) {
    if (path.startsWith(ALLOWED_PREFIX)) continue;
    if (/\.pdf$/i.test(path)) {
      violations.push(path);
      continue;
    }
    if (looksLikePdf(readHead(mode, path))) violations.push(path);
  }
  return violations;
}

function main(): void {
  const mode = process.argv[2];
  if (mode !== '--staged' && mode !== '--all') {
    process.stderr.write('Usage: check-pdfs.ts --staged | --all\n');
    process.exit(2);
  }
  const violations = findViolations(mode);
  if (violations.length === 0) return;

  process.stderr.write(
    [
      'Refusing PDF files outside tests/fixtures/:',
      ...violations.map((path) => `  - ${path}`),
      '',
      'Real shipping labels contain personal data and must never be committed.',
      'Keep real samples outside the repository (see PARCELSCHNITT_SAMPLES).',
      mode === '--staged' ? 'Unstage them with: git restore --staged <file>' : '',
      '',
    ].join('\n'),
  );
  process.exit(1);
}

main();
