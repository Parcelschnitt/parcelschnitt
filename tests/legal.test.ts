import { mkdtemp, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import {
  PLACEHOLDERS,
  escapeHtml,
  fillLegalPlaceholders,
  readLegalInput,
  validateLegalDetails,
} from '../scripts/legal-plugin.ts';

const complete = {
  name: 'Erika Mustermann',
  street: 'Musterstraße 1',
  postalCode: '12345',
  city: 'Musterstadt',
  country: 'Deutschland',
  email: 'erika@example.org',
};

describe('imprint details', () => {
  it('accepts complete details', () => {
    expect(validateLegalDetails(complete)).toEqual({ ok: true, details: complete });
  });

  it('reports missing and invalid fields without echoing values', () => {
    const result = validateLegalDetails({ ...complete, street: ' ', email: 'not-an-email' });
    expect(result).toEqual({ ok: false, problems: ['street is missing', 'email is invalid'] });
  });

  it('escapes HTML in inserted values', () => {
    const html = fillLegalPlaceholders('<p>{{legal.name}}</p>', {
      ...complete,
      name: '<script>alert(1)</script> & "Co"',
    });
    expect(html).toBe('<p>&lt;script&gt;alert(1)&lt;/script&gt; &amp; &quot;Co&quot;</p>');
    expect(escapeHtml("O'Neil")).toBe('O&#39;Neil');
  });

  it('rejects unknown placeholders instead of leaving them in the page', () => {
    expect(() => fillLegalPlaceholders('{{legal.phone}}', complete)).toThrow(/Unknown/);
  });

  it('fills every field, also with placeholders for local builds', () => {
    const template = Object.keys(complete)
      .map((f) => `{{legal.${f}}}`)
      .join('|');
    expect(fillLegalPlaceholders(template, PLACEHOLDERS)).not.toContain('{{');
  });

  it('prefers environment variables over the local file', async () => {
    const dir = await mkdtemp(join(tmpdir(), 'parcelschnitt-legal-'));
    const file = join(dir, 'legal.local.json');
    await writeFile(file, JSON.stringify({ ...complete, name: 'From File' }));
    expect(readLegalInput({}, file)).toMatchObject({ name: 'From File' });
    expect(readLegalInput({ PARCELSCHNITT_LEGAL_NAME: 'From Env' }, file)).toEqual({
      name: 'From Env',
    });
    expect(readLegalInput({}, join(dir, 'missing.json'))).toEqual({});
  });
});
