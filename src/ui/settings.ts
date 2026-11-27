/**
 * Optional, user-initiated persistence of preferences. Off by default (privacy by default):
 * nothing is written until the user ticks "remember settings", and unticking deletes it.
 *
 * Only the label size, the customs option, the auto-format choice and the colour theme are
 * stored, never file data, and never the permission to shrink (that stays a deliberate per-file decision).
 * Stored data is treated as untrusted and validated on read.
 */
import type { CustomsFormOutput } from '../core/index.ts';
import type { ProfileId } from '../profiles/index.ts';
import { isProfileId } from './protocol.ts';
import { isTheme, type Theme } from './theme.ts';

export const SETTINGS_KEY = 'parcelschnitt.settings.v1';

export interface Settings {
  readonly profileId: ProfileId;
  readonly customsForms: CustomsFormOutput;
  /** Choose the format to match the label. Missing in older stored data: on. */
  readonly autoProfile: boolean;
  /** Colour theme. Missing in older stored data: follow the system. */
  readonly theme: Theme;
}

/** The subset of the Web Storage API used here (injectable for tests). */
export type SettingsStorage = Pick<Storage, 'getItem' | 'setItem' | 'removeItem'>;

const isCustomsOption = (value: unknown): value is CustomsFormOutput =>
  value === 'withLabels' || value === 'separateA4' || value === 'omit';

export function parseSettings(raw: string | null): Settings | null {
  if (raw === null || raw.length > 1024) return null;
  let data: unknown;
  try {
    data = JSON.parse(raw);
  } catch {
    return null;
  }
  if (typeof data !== 'object' || data === null) return null;
  const {
    profileId,
    customsForms,
    autoProfile = true,
    theme = 'system',
  } = data as Record<string, unknown>;
  if (!isProfileId(profileId) || !isCustomsOption(customsForms)) return null;
  if (typeof autoProfile !== 'boolean' || !isTheme(theme)) return null;
  return { profileId, customsForms, autoProfile, theme };
}

/** Stored settings, or null when none (or invalid ones) exist or storage is unavailable. */
export function loadSettings(storage: SettingsStorage | null): Settings | null {
  try {
    return parseSettings(storage?.getItem(SETTINGS_KEY) ?? null);
  } catch {
    return null; // storage blocked by the browser
  }
}

/** Returns false when the browser refuses to store (private mode, blocked storage). */
export function saveSettings(storage: SettingsStorage | null, settings: Settings): boolean {
  if (!storage) return false;
  try {
    storage.setItem(
      SETTINGS_KEY,
      JSON.stringify({
        profileId: settings.profileId,
        customsForms: settings.customsForms,
        autoProfile: settings.autoProfile,
        theme: settings.theme,
      }),
    );
    return true;
  } catch {
    return false;
  }
}

export function forgetSettings(storage: SettingsStorage | null): void {
  try {
    storage?.removeItem(SETTINGS_KEY);
  } catch {
    // nothing stored or storage blocked: nothing to delete
  }
}

/** `window.localStorage` may throw on access when the user blocked site data. */
export function browserStorage(): SettingsStorage | null {
  try {
    return globalThis.localStorage;
  } catch {
    return null;
  }
}
