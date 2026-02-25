import { browser } from '$app/environment';
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
		store.value = !store.value;
		applyDarkMode(store.value);
	}
};

export function applyDarkMode(dark) {
	if (!browser) return;
	document.documentElement.classList.toggle('dark', dark);
}
