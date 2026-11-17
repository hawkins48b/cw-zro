/**
 * The app's keys in localStorage, and removing them: "Clear all data on this device" (#166).
 *
 * APP_STORAGE_KEYS lists every key the app writes (docs/data-and-privacy.md, "What is stored").
 * Any other key starting with APP_STORAGE_PREFIX is removed too, so that a key added later, or left
 * by an earlier version, does not survive a clear. Keys of other sites or apps on the same origin
 * are left alone.
 */
import { LOCALE_STORAGE_KEY } from './storedLocale.js';

/** Prefix of every key the app writes. */
export const APP_STORAGE_PREFIX = 'zro-';

/** Every key the app writes, with the store that writes it. */
export const APP_STORAGE_KEYS = Object.freeze([
	'zro-profiles', // profiles
	'zro-active-profile', // activeProfile
	'zro-ballistic', // ballistic
	'zro-scope-view', // scopeView
	'zro-traj-validation', // trajectoryValidation
	'zro-compare-traj', // compareTrajectories
	'zro-mpbr', // mpbr
	'zro-dark-mode', // settings, read before the first paint by static/theme-init.js
	LOCALE_STORAGE_KEY // 'zro-locale', storedLocale.js
]);

/**
 * The app's keys present in a storage: APP_STORAGE_KEYS and any other key with APP_STORAGE_PREFIX.
 * @param {Storage} storage
 * @returns {string[]}
 */
export function appStorageKeys(storage) {
	const keys = new Set();
	for (let i = 0; i < storage.length; i++) {
		const key = storage.key(i);
		if (typeof key === 'string' && (key.startsWith(APP_STORAGE_PREFIX) || APP_STORAGE_KEYS.includes(key))) {
			keys.add(key);
		}
	}
	return [...keys];
}

/**
 * Removes the app's keys from a storage. Never throws: storage that cannot be read (private mode,
 * sandbox) holds nothing to remove.
 * @param {Storage} [storage]
 * @returns {string[]} the keys removed
 */
export function clearAppStorage(storage = globalThis.localStorage) {
	if (!storage) return [];
	try {
		const keys = appStorageKeys(storage);
		for (const key of keys) storage.removeItem(key);
		return keys;
	} catch {
		return [];
	}
}
