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
