import { browser } from '$app/environment';

const STORAGE_KEY = 'zro-dark-mode';

function getInitialDarkMode() {
	if (!browser) return false;
	const stored = localStorage.getItem(STORAGE_KEY);
	if (stored !== null) return stored === 'true';
	return window.matchMedia('(prefers-color-scheme: dark)').matches;
}

let darkMode = $state(getInitialDarkMode());

export const settings = {
	get darkMode() {
		return darkMode;
	},
	toggleDarkMode() {
		darkMode = !darkMode;
		if (browser) {
			localStorage.setItem(STORAGE_KEY, String(darkMode));
			applyDarkMode(darkMode);
		}
	}
};

export function applyDarkMode(dark) {
	if (!browser) return;
	document.documentElement.classList.toggle('dark', dark);
}
