/**
 * Script for the static legal pages: applies the colour theme, nothing else.
 *
 * The theme comes from the page address (passed along by the links, nothing stored) or, if
 * the user chose "remember settings" on the main page, from local storage.
 */
import { browserStorage, loadSettings } from './settings.ts';
import { applyTheme, carryThemeInLinks, themeFromUrl } from './theme.ts';

const theme = themeFromUrl(location.search) ?? loadSettings(browserStorage())?.theme ?? 'system';
applyTheme(theme);
carryThemeInLinks(theme);
