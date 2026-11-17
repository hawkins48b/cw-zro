/**
 * The theme of Settings (#166): settings.setTheme / theme, the sidebar toggle (setDarkMode,
 * toggleDarkMode) and static/theme-init.js, which applies the stored theme before the first paint,
 * read and write the same zro-dark-mode value the same way.
 */
import { readFileSync } from 'fs';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('$app/env', () => ({ browser: true }));

const themeInit = readFileSync('static/theme-init.js', 'utf-8');

/** What theme-init.js does on a page load with the current storage. */
function runThemeInit() {
	document.documentElement.classList.remove('dark');
	new Function(themeInit)();
	return document.documentElement.classList.contains('dark') ? 'dark' : 'light';
}

async function loadSettings() {
	vi.resetModules();
	return (await import('#lib/stores/settings.svelte.js')).settings;
}

describe('theme', () => {
	let systemDark = false;
	beforeEach(() => {
		localStorage.clear();
		document.documentElement.classList.remove('dark');
		systemDark = false;
		vi.stubGlobal('matchMedia', () => ({ matches: systemDark }));
	});
	afterEach(() => vi.unstubAllGlobals());

	it('setTheme applies the theme now and stores what theme-init reads at the next start', async () => {
		const settings = await loadSettings();
		expect(settings.setTheme('dark')).toBe(true);
		expect(settings.theme).toBe('dark');
		expect(settings.darkMode).toBe(true);
		expect(document.documentElement.classList.contains('dark')).toBe(true);
		expect(localStorage.getItem('zro-dark-mode')).toBe('true');
		expect(runThemeInit()).toBe('dark');

		expect(settings.setTheme('light')).toBe(true);
		expect(settings.theme).toBe('light');
		expect(document.documentElement.classList.contains('dark')).toBe(false);
		expect(localStorage.getItem('zro-dark-mode')).toBe('false');
		expect(runThemeInit()).toBe('light');
		expect((await loadSettings()).theme).toBe('light');
	});

	it('setTheme ignores anything but light or dark', async () => {
		const settings = await loadSettings();
		settings.setTheme('dark');
		for (const bad of ['system', 'Dark', '', null, undefined, true, 1, {}]) {
			expect(settings.setTheme(/** @type {any} */ (bad))).toBe(false);
		}
		expect(settings.theme).toBe('dark');
		expect(localStorage.getItem('zro-dark-mode')).toBe('true');
	});

	it('the toggle and setTheme share one state', async () => {
		const settings = await loadSettings();
		settings.setTheme('light');
		settings.toggleDarkMode();
		expect(settings.theme).toBe('dark');
		settings.setDarkMode(false);
		expect(settings.theme).toBe('light');
	});

	it('follows the system setting when nothing is stored, and writes nothing', async () => {
		systemDark = true;
		const settings = await loadSettings();
		expect(settings.theme).toBe('dark');
		expect(runThemeInit()).toBe('dark');
		expect(localStorage.getItem('zro-dark-mode')).toBeNull();
	});

	it('reads a damaged stored value as light, as theme-init does', async () => {
		systemDark = true;
		for (const raw of ['"dark"', '1', 'null', '{}', 'not json']) {
			localStorage.setItem('zro-dark-mode', raw);
			const settings = await loadSettings();
			expect(runThemeInit(), raw).toBe('light');
			// 'not json' is unreadable: the store falls back to the system setting, theme-init to light.
			if (raw !== 'not json') expect(settings.theme, raw).toBe('light');
		}
	});
});
