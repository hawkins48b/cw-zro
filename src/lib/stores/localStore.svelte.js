import { browser } from '$app/env';

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
		} catch (e) {
			console.warn(`Could not save ${key}:`, e);
		}
	}

	let data = $state(load());

	function persist() {
		if (browser) write(data);
	}

	return {
		get value() {
			return data;
		},
		set value(v) {
			data = v;
			persist();
		},
		/** Call after in-place mutations (push, splice, index assignment) */
		persist
	};
}
