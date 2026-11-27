/**
 * Crops the real sample labels from $PARCELSCHNITT_SAMPLES for a printer check.
 *
 * Input and output folders must both be OUTSIDE the repository: the results contain the same
 * personal data as the samples. Console output names samples by number only.
 *
 * Usage: node scripts/crop-samples.ts [output-dir] [--all-profiles]
 *   output-dir defaults to $PARCELSCHNITT_OUTPUT, then ~/parcelschnitt-output
 */
import { mkdir, writeFile } from 'node:fs/promises';
import { homedir } from 'node:os';
import { basename, join } from 'node:path';
import * as pdfjs from 'pdfjs-dist/legacy/build/pdf.mjs';
import { cropLabels, detectLabels, analyzeDocument } from '../src/core/index.ts';
import { PROFILES, getProfile, type PrinterProfile } from '../src/profiles/index.ts';
import { DEFAULT_PROFILE, SAMPLES_DIR, isInsideRepo, loadSamples } from '../tests/samples.ts';

async function main(): Promise<void> {
  const args = process.argv.slice(2);
  const allProfiles = args.includes('--all-profiles');
  const outputDir =
    args.find((a) => !a.startsWith('--')) ??
    process.env['PARCELSCHNITT_OUTPUT'] ??
    join(homedir(), 'parcelschnitt-output');

  if (!SAMPLES_DIR) throw new Error('Set PARCELSCHNITT_SAMPLES to the folder with real samples.');
  await mkdir(outputDir, { recursive: true, mode: 0o700 });
  if (await isInsideRepo(outputDir)) {
    throw new Error(
      'The output folder must be outside the repository (results contain personal data).',
    );
  }

  for (const sample of await loadSamples(SAMPLES_DIR)) {
    const detections = detectLabels(await analyzeDocument(sample.bytes, pdfjs));
    const [first] = detections;
    if (!first) {
      process.stdout.write(`${sample.label}: no label detected (manual cropping needed)\n`);
      continue;
    }
    const profiles: PrinterProfile[] = allProfiles
      ? [...PROFILES]
      : [getProfile(DEFAULT_PROFILE[first.layoutId] ?? 'label-103x199')];

    for (const profile of profiles) {
      const result = await cropLabels(sample.bytes, pdfjs, { profile });
      const fits = result.labels.filter((l) => l.fit.ok).length;
      const status = `${sample.label}: ${first.layoutId}, ${result.labels.length} label(s) → ${profile.id}`;
      if (!result.pdf) {
        process.stdout.write(`${status}: does not fit at 100 %, nothing written\n`);
        continue;
      }
      const name = `${basename(sample.path, '.pdf')}.${profile.id}.pdf`;
      await writeFile(join(outputDir, name), result.pdf, { mode: 0o600 });
      process.stdout.write(`${status}: ${fits} page(s) written\n`);
    }
  }
  process.stdout.write(`Output folder: ${outputDir}\n`);
}

await main();
