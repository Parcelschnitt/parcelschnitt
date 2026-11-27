/**
 * Script for the static legal pages: applies a remembered colour theme, nothing else.
 * Reads local storage only if the user chose "remember settings" on the main page.
 */
import { browserStorage, loadSettings } from './settings.ts';
import { applyTheme } from './theme.ts';

const saved = loadSettings(browserStorage());
if (saved) applyTheme(saved.theme);
