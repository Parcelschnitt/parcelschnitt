import { describe, expect, it } from 'vitest';
import {
  SETTINGS_KEY,
  forgetSettings,
  loadSettings,
  parseSettings,
  saveSettings,
  type SettingsStorage,
} from '../src/ui/settings.ts';

function memoryStorage(): SettingsStorage & { data: Map<string, string> } {
  const data = new Map<string, string>();
  return {
    data,
    getItem: (key) => data.get(key) ?? null,
    setItem: (key, value) => {
      data.set(key, value);
    },
    removeItem: (key) => {
      data.delete(key);
    },
  };
}

const blockedStorage: SettingsStorage = {
  getItem: () => {
    throw new Error('SecurityError');
  },
  setItem: () => {
    throw new Error('QuotaExceededError');
  },
  removeItem: () => {
    throw new Error('SecurityError');
  },
};

describe('remembered settings', () => {
  it('stores nothing until saved explicitly', () => {
    const storage = memoryStorage();
    expect(loadSettings(storage)).toBeNull();
    expect(storage.data.size).toBe(0);
  });

  it('round-trips profile and customs option, and nothing else', () => {
    const storage = memoryStorage();
    expect(
      saveSettings(storage, {
        profileId: 'dymo-99014',
        customsForms: 'separateA4',
        autoProfile: false,
      }),
    ).toBe(true);
    expect(loadSettings(storage)).toEqual({
      profileId: 'dymo-99014',
      customsForms: 'separateA4',
      autoProfile: false,
    });
    expect(
      Object.keys(JSON.parse(storage.data.get(SETTINGS_KEY) ?? '{}') as object).sort(),
    ).toEqual(['autoProfile', 'customsForms', 'profileId']);
  });

  it('treats settings stored before the auto-format option as auto-format on', () => {
    expect(parseSettings('{"profileId":"dymo-99014","customsForms":"omit"}')).toEqual({
      profileId: 'dymo-99014',
      customsForms: 'omit',
      autoProfile: true,
    });
    expect(
      parseSettings('{"profileId":"dymo-99014","customsForms":"omit","autoProfile":"yes"}'),
    ).toBeNull();
  });

  it('forgets everything on request', () => {
    const storage = memoryStorage();
    saveSettings(storage, { profileId: 'brother-62', customsForms: 'omit', autoProfile: true });
    forgetSettings(storage);
    expect(storage.data.size).toBe(0);
    expect(loadSettings(storage)).toBeNull();
  });

  it.each([
    ['not JSON', '{oops'],
    ['unknown profile', '{"profileId":"evil","customsForms":"omit"}'],
    ['unknown customs option', '{"profileId":"dymo-99014","customsForms":"all"}'],
    ['array', '[]'],
    ['oversized', `{"profileId":"dymo-99014","customsForms":"omit","x":"${'a'.repeat(2000)}"}`],
  ])('ignores tampered data (%s)', (_name, raw) => {
    expect(parseSettings(raw)).toBeNull();
  });

  it('copes with storage blocked by the browser', () => {
    expect(loadSettings(blockedStorage)).toBeNull();
    expect(
      saveSettings(blockedStorage, {
        profileId: 'dymo-99014',
        customsForms: 'omit',
        autoProfile: true,
      }),
    ).toBe(false);
    expect(() => {
      forgetSettings(blockedStorage);
    }).not.toThrow();
    expect(loadSettings(null)).toBeNull();
    expect(
      saveSettings(null, { profileId: 'dymo-99014', customsForms: 'omit', autoProfile: true }),
    ).toBe(false);
  });
});
