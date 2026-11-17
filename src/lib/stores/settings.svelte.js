import { browser } from '$app/env';
import { localStore } from './localStore.svelte.js';

const store = localStore(
	'zro-dark-mode',
	() => browser && window.matchMedia('(prefers-color-scheme: dark)').matches,
	{ seed: false }
);

export const settings = {
	get darkMode() {
		return store.value;
	},
	toggleDarkMode() {
		this.setDarkMode(!store.value);
	},
	/** Light (false) or dark (true) theme: the sidebar's Light / Dark buttons (#149). */
	setDarkMode(dark) {
		store.value = Boolean(dark);
		applyDarkMode(store.value);
	}
};

export function applyDarkMode(dark) {
	if (!browser) return;
	document.documentElement.classList.toggle('dark', dark);
}
