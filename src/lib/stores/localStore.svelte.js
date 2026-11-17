import { browser } from '$app/env';

/**
 * How to put each store made by localStore back to its default in memory, for clearAllData (#166).
 * In the order the stores were made, so a default that reads another store (the active profile
 * reads the profiles) sees it already reset.
 * @type {Set<() => void>}
 */
const resets = new Set();

/**
 * Puts every store made by localStore back to its default in memory, without writing it: after
 * the stored keys are removed, the app reads as on its first launch (#166).
 */
export function resetLocalStores() {
	for (const reset of resets) reset();
}

/**
 * Creates a reactive localStorage-backed state.
 *
 * @param {string} key - localStorage key
 * @param {*|function} init - default value or a function returning it
 * @param {{ seed?: boolean }} options
 *   seed: if true (default), persists the default value on first launch
 *         set to false when the default comes from external state (e.g. OS preference)
 *         and should not be written back to localStorage
 */
export function localStore(key, init, { seed = true } = {}) {
	function getDefault() {
		return typeof init === 'function' ? init() : init;
	}

	function load() {
		if (!browser) return getDefault();
		try {
			const raw = localStorage.getItem(key);
			if (raw !== null) return JSON.parse(raw);
		} catch {
			// fall through to default
		}
		const defaultValue = getDefault();
		if (seed) write(defaultValue);
		return defaultValue;
	}

	/**
	 * Saves a value, and keeps going when storage refuses it (full, or blocked). The value stays in
	 * memory for this session. A store module writes while it loads (a seed, or a one-time conversion
	 * such as the wind direction of #106), so a throw here would stop the page loading.
	 */
	function write(value) {
		try {
			localStorage.setItem(key, JSON.stringify(value));
			return true;
		} catch (e) {
			console.warn(`Could not save ${key}:`, e);
			return false;
		}
	}

	let data = $state(load());

	function persist() {
		if (browser) write(data);
	}

	resets.add(() => {
		data = getDefault();
	});

	return {
		get value() {
			return data;
		},
		set value(v) {
			data = v;
			persist();
		},
		/**
		 * Saves a value and keeps it only when the save worked (security review of #166): when storage
		 * refuses it (full, or blocked), the value in memory stays the old one, so the page does not
		 * show as saved what the next start would not have.
		 * @returns {boolean} whether it was saved (always true outside the browser)
		 */
		trySet(v) {
			if (browser && !write(v)) return false;
			data = v;
			return true;
		},
		/** Call after in-place mutations (push, splice, index assignment) */
		persist
	};
}
