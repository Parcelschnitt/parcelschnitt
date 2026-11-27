/**
 * Writes the licence texts of all bundled runtime dependencies to
 * <output-dir>/third-party-licenses.txt. Required for redistributing pdf.js (Apache-2.0)
 * and the MIT-licensed packages in the built site.
 *
 * Packages that are never bundled for the browser (native Node add-ons) are skipped.
 *
 * Usage: node scripts/third-party-licenses.ts <output-dir>
 */
import { readdir, readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';

const ROOT = join(import.meta.dirname, '..');
/** Native/Node-only optional dependencies of pdfjs-dist; not part of the browser bundle. */
const NOT_BUNDLED_PREFIX = '@napi-rs/';
const LICENSE_FILE = /^(licen[cs]e|copying|notice)(\.(md|txt))?$/i;

interface LockPackage {
  version?: string;
  license?: string;
  dev?: boolean;
  optional?: boolean;
}

async function licenseTexts(dir: string): Promise<string[]> {
  const files = (await readdir(dir)).filter((f) => LICENSE_FILE.test(f)).sort();
  return Promise.all(files.map((f) => readFile(join(dir, f), 'utf8')));
}

async function main(): Promise<void> {
  const outputDir = process.argv[2];
  if (!outputDir) throw new Error('Usage: third-party-licenses.ts <output-dir>');
  const lock = JSON.parse(await readFile(join(ROOT, 'package-lock.json'), 'utf8')) as {
    packages: Record<string, LockPackage>;
  };

  const sections: string[] = [];
  for (const [path, pkg] of Object.entries(lock.packages).sort(([a], [b]) => a.localeCompare(b))) {
    if (!path.startsWith('node_modules/') || pkg.dev) continue;
    const name = path.slice(path.lastIndexOf('node_modules/') + 'node_modules/'.length);
    if (name.startsWith(NOT_BUNDLED_PREFIX)) continue;
    const texts = await licenseTexts(join(ROOT, path));
    if (texts.length === 0) throw new Error(`No licence file found for ${name}`);
    sections.push(
      [`${name} ${pkg.version ?? ''} (${pkg.license ?? 'unknown'})`, '='.repeat(72), ...texts].join(
        '\n\n',
      ),
    );
  }

  const header =
    'Parcelschnitt includes the following third-party software.\n' +
    'Parcelschnitt enthält die folgende Software von Dritten.\n';
  await writeFile(
    join(outputDir, 'third-party-licenses.txt'),
    [header, ...sections].join('\n\n\n'),
  );
  process.stdout.write(`third-party-licenses.txt: ${sections.length} packages\n`);
}

await main();
