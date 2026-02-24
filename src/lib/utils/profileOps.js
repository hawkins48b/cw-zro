/**
 * Pure helper functions for profile list operations.
 * These mirror the logic in the profiles store and are testable without Svelte.
 */

/**
 * Returns a new list with the profile appended (with a generated UUID).
 * @param {Array}  list
 * @param {object} profile
 * @returns {{ list: Array, id: string }}
 */
export function addProfile(list, profile) {
	const id = crypto.randomUUID();
	return { list: [...list, { ...profile, id }], id };
}

/**
 * Returns a new list with the matching profile merged with data.
 * @param {Array}  list
 * @param {string} id
 * @param {object} data
 * @returns {{ list: Array, success: boolean }}
 */
export function updateProfile(list, id, data) {
	const i = list.findIndex((p) => p.id === id);
	if (i === -1) return { list, success: false };
	const next = [...list];
	next[i] = { ...list[i], ...data, id };
	return { list: next, success: true };
}

/**
 * Returns a new list with the matching profile removed.
 * @param {Array}  list
 * @param {string} id
 * @returns {{ list: Array, removed: boolean }}
 */
export function removeProfile(list, id) {
	const filtered = list.filter((p) => p.id !== id);
	return { list: filtered, removed: filtered.length < list.length };
}

/**
 * Finds a profile by id, or returns null.
 * @param {Array}  list
 * @param {string} id
 * @returns {object | null}
 */
export function getProfile(list, id) {
	return list.find((p) => p.id === id) ?? null;
}

/**
 * Duplicates a profile, appending " - Copy" to its name.
 * @param {Array}  list
 * @param {string} id
 * @returns {{ list: Array, id: string | null }}
 */
export function duplicateProfile(list, id) {
	const src = getProfile(list, id);
	if (!src) return { list, id: null };
	const { id: _srcId, ...rest } = src;
	return addProfile(list, { ...rest, name: `${rest.name} - Copy` });
}
