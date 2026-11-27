/**
 * Access to real sample labels for local testing. Samples live OUTSIDE the repository; their
 * folder is passed via PARCELSCHNITT_SAMPLES. Real labels contain personal data: never print
 * their content or file names in test output.
 */
import { readdir, readFile, realpath } from 'node:fs/promises';
import { join, relative, isAbsolute } from 'node:path';
import type { ProfileId } from '../src/profiles/index.ts';

export const SAMPLES_DIR = process.env['PARCELSCHNITT_SAMPLES'] ?? '';

const REPO_ROOT = join(import.meta.dirname, '..');

/** Default target profile per layout for the printer check. */
export const DEFAULT_PROFILE: Readonly<Record<string, ProfileId>> = {
  'dhl-paketmarke': 'label-103x199',
  internetmarke: 'dymo-99014',
  'customs-cn22': 'label-103x199',
};

export async function isInsideRepo(path: string): Promise<boolean> {
  const [root, target] = await Promise.all([realpath(REPO_ROOT), realpath(path)]);
  const rel = relative(root, target);
  return rel === '' || (!rel.startsWith('..') && !isAbsolute(rel));
}

export interface Sample {
  /** Anonymous label for output, e.g. "sample 2". */
  readonly label: string;
  readonly path: string;
  readonly bytes: Uint8Array;
}

export async function loadSamples(dir: string): Promise<Sample[]> {
  if (await isInsideRepo(dir)) {
    throw new Error('PARCELSCHNITT_SAMPLES must point to a folder outside the repository.');
  }
  const names = (await readdir(dir)).filter((n) => /\.pdf$/i.test(n)).sort();
  return Promise.all(
    names.map(async (name, i) => ({
      label: `sample ${i + 1}`,
      path: join(dir, name),
      bytes: new Uint8Array(await readFile(join(dir, name))),
    })),
  );
}
