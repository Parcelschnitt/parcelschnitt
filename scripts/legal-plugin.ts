/**
 * Inserts the operator details (name, address, e-mail) into the legal pages at build time.
 *
 * The details must be published on the site (imprint, privacy policy) but are kept out of the
 * repository: they come from environment variables (deployment) or from the git-ignored file
 * `legal.local.json` (local builds). Values are HTML-escaped. Builds that are deployed set
 * PARCELSCHNITT_REQUIRE_LEGAL=1 and fail when details are missing, so no page without a valid
 * imprint can go online. Other builds show visible placeholders.
 */
import { existsSync, readFileSync } from 'node:fs';
import type { Plugin } from 'vite';

export interface LegalDetails {
  readonly name: string;
  readonly street: string;
  readonly postalCode: string;
  readonly city: string;
  readonly country: string;
  readonly email: string;
}

const FIELDS = ['name', 'street', 'postalCode', 'city', 'country', 'email'] as const;
type Field = (typeof FIELDS)[number];

const ENV_NAMES: Record<Field, string> = {
  name: 'PARCELSCHNITT_LEGAL_NAME',
  street: 'PARCELSCHNITT_LEGAL_STREET',
  postalCode: 'PARCELSCHNITT_LEGAL_POSTAL_CODE',
  city: 'PARCELSCHNITT_LEGAL_CITY',
  country: 'PARCELSCHNITT_LEGAL_COUNTRY',
  email: 'PARCELSCHNITT_LEGAL_EMAIL',
};

/** Shown in local and CI builds without details; never deployed (see REQUIRE flag). */
export const PLACEHOLDERS: LegalDetails = {
  name: '[Vor- und Nachname]',
  street: '[Straße und Hausnummer]',
  postalCode: '[PLZ]',
  city: '[Ort]',
  country: '[Land]',
  email: 'kontakt@example.org',
};

const MAX_LENGTH = 200;
const EMAIL = /^[^\s@<>"']+@[^\s@<>"']+\.[^\s@<>"']+$/;

export function escapeHtml(value: string): string {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
}

/** Validated details, or a list of problems (never echoing the values themselves). */
export function validateLegalDetails(
  input: Partial<Record<Field, unknown>>,
): { ok: true; details: LegalDetails } | { ok: false; problems: string[] } {
  const problems: string[] = [];
  const values: Partial<Record<Field, string>> = {};
  for (const field of FIELDS) {
    const value = input[field];
    if (typeof value !== 'string' || value.trim() === '') {
      problems.push(`${field} is missing`);
    } else if (value.length > MAX_LENGTH) {
      problems.push(`${field} is too long`);
    } else {
      values[field] = value.trim();
    }
  }
  if (values.email !== undefined && !EMAIL.test(values.email)) problems.push('email is invalid');
  if (problems.length > 0) return { ok: false, problems };
  return { ok: true, details: values as LegalDetails };
}

/** Reads details from the environment, falling back to legal.local.json. */
export function readLegalInput(
  env: Readonly<Record<string, string | undefined>>,
  localFile: string,
): Partial<Record<Field, unknown>> {
  const fromEnv = Object.fromEntries(
    FIELDS.flatMap((field) => {
      const value = env[ENV_NAMES[field]];
      return value === undefined ? [] : [[field, value]];
    }),
  ) as Partial<Record<Field, unknown>>;
  if (Object.keys(fromEnv).length > 0 || !existsSync(localFile)) return fromEnv;
  const parsed: unknown = JSON.parse(readFileSync(localFile, 'utf8'));
  return typeof parsed === 'object' && parsed !== null ? parsed : {};
}

const PLACEHOLDER = /\{\{legal\.(\w+)\}\}/g;

/** Replaces {{legal.field}} placeholders; unknown fields are an error, not silently kept. */
export function fillLegalPlaceholders(html: string, details: LegalDetails): string {
  return html.replace(PLACEHOLDER, (_match, field: string) => {
    if (!(FIELDS as readonly string[]).includes(field)) {
      throw new Error(`Unknown legal placeholder: ${field}`);
    }
    return escapeHtml(details[field as Field]);
  });
}

export function legalDetailsPlugin(options: {
  env: Readonly<Record<string, string | undefined>>;
  localFile: string;
}): Plugin {
  let details: LegalDetails | null = null;
  return {
    name: 'parcelschnitt-legal-details',
    buildStart() {
      const required = options.env['PARCELSCHNITT_REQUIRE_LEGAL'] === '1';
      const input = readLegalInput(options.env, options.localFile);
      const result = validateLegalDetails(input);
      if (result.ok) {
        details = result.details;
        return;
      }
      if (required) {
        throw new Error(
          `Imprint details incomplete (${result.problems.join(', ')}). ` +
            'Set the PARCELSCHNITT_LEGAL_* variables before deploying.',
        );
      }
      details = PLACEHOLDERS;
    },
    transformIndexHtml(html) {
      return fillLegalPlaceholders(html, details ?? PLACEHOLDERS);
    },
  };
}
