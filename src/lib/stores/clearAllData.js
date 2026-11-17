/**
 * "Clear all data on this device" (#166): removes the app's keys from localStorage (appStorage.js)
 * and puts every store back to its default in memory, so the app reads as on its first launch: no
 * profile (isFirstRun), so the page sends the user to the Welcome screen. The page asks for
 * confirmation first and navigates afterwards; this does neither.
 */
import { clearAppStorage } from '#lib/utils/appStorage.js';
import { clearLegacyLocaleCookie } from '#lib/utils/storedLocale.js';
import { ammoSelection } from './ammoSelection.svelte.js';
import { formDraft } from './formDraft.svelte.js';
import { resetLocalStores } from './localStore.svelte.js';
import { applyDarkMode, settings } from './settings.svelte.js';

/**
 * @returns {string[]} the localStorage keys removed
 */
export function clearAllData() {
	const removed = clearAppStorage();
	resetLocalStores();
	ammoSelection.clear();
	formDraft.clear();
	clearLegacyLocaleCookie();
	// The theme is the device's again, as on a first launch.
	applyDarkMode(settings.darkMode);
	return removed;
}
