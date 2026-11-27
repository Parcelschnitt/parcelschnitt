/**
 * Colour theme: follow the system ("system"), or force light or dark. The choice is applied as
 * `data-theme` on <html>; styles.css does the rest.
 */
export type Theme = 'system' | 'light' | 'dark';

export const THEMES: readonly Theme[] = ['system', 'light', 'dark'];

export const isTheme = (value: unknown): value is Theme => THEMES.some((theme) => theme === value);

export function applyTheme(theme: Theme, root: HTMLElement = document.documentElement): void {
  if (theme === 'system') root.removeAttribute('data-theme');
  else root.setAttribute('data-theme', theme);
}

const THEME_PARAM = 'theme';

/** Theme passed along in the page address (`?theme=light`), if valid. */
export function themeFromUrl(search: string): Theme | null {
  const value = new URLSearchParams(search).get(THEME_PARAM);
  return isTheme(value) ? value : null;
}

/**
 * Link target that carries the theme to the next page without storing anything.
 * "system" removes the parameter. Fragments such as `#en` are kept.
 */
export function withTheme(href: string, theme: Theme, base: string): string {
  const url = new URL(href, base);
  if (theme === 'system') url.searchParams.delete(THEME_PARAM);
  else url.searchParams.set(THEME_PARAM, theme);
  return url.href;
}

/** Points every internal page link (marked with data-carry-theme) at the given theme. */
export function carryThemeInLinks(theme: Theme, root: ParentNode = document): void {
  for (const link of root.querySelectorAll<HTMLAnchorElement>('a[data-carry-theme]')) {
    // The attribute starts empty; the first call records the original link target in it.
    const recorded = link.dataset['carryTheme'];
    const original =
      recorded === undefined || recorded === '' ? (link.getAttribute('href') ?? './') : recorded;
    link.dataset['carryTheme'] = original;
    link.href = withTheme(original, theme, document.baseURI);
  }
}
