import { browser } from '$app/env';
import { localStore } from './localStore.svelte.js';

/** The two themes of Settings (#166). The stored value is zro-dark-mode, true or false. */
export const THEMES = Object.freeze(['light', 'dark']);

// The key and its values are the ones static/theme-init.js reads before the first paint: dark when
// the stored text is exactly 'true', light for any other stored value, the system setting when
// nothing is stored.
const store = localStore(
	'zro-dark-mode',
	() => browser && window.matchMedia('(prefers-color-scheme: dark)').matches,
	{ seed: false }
);

export const settings = {
	/** Whether the dark theme is on. A stored value other than true reads as light, as in theme-init.js. */
	get darkMode() {
		return store.value === true;
	},
	/** 'light' or 'dark': the theme on screen. */
	get theme() {
		return this.darkMode ? 'dark' : 'light';
	},
	toggleDarkMode() {
		this.setDarkMode(!this.darkMode);
	},
	/** Light (false) or dark (true) theme: the sidebar's Light / Dark buttons (#149). */
	setDarkMode(dark) {
		store.value = dark === true;
		applyDarkMode(store.value);
	},
	/**
	 * Sets the theme from Settings (#166). Anything but 'light' or 'dark' changes nothing.
	 * @param {'light' | 'dark'} theme
	 * @returns {boolean} whether it was a theme
	 */
	setTheme(theme) {
		if (!THEMES.includes(theme)) return false;
		this.setDarkMode(theme === 'dark');
		return true;
	}
};

export function applyDarkMode(dark) {
	if (!browser) return;
	document.documentElement.classList.toggle('dark', dark === true);
}
