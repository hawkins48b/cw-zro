import { browser } from '$app/environment';

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
		if (seed) localStorage.setItem(key, JSON.stringify(defaultValue));
		return defaultValue;
	}

	let data = $state(load());

	function persist() {
		if (browser) localStorage.setItem(key, JSON.stringify(data));
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
