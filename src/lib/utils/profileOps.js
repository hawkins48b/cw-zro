import { MAX_NAME_LENGTH, cutText, shownProfile } from './storedProfiles.js';

/**
 * Pure helper functions for profile list operations.
 * The profiles store calls them on the usable stored list (storedProfiles.js), and they are
 * testable without Svelte.
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

/** What a duplicated profile's name ends with. */
const COPY_SUFFIX = ' - Copy';

/**
 * The name of a copy of a profile: the shown name, cut so that the name with " - Copy" fits in
 * MAX_NAME_LENGTH (#141). Without the cut, a 60-character name lost its suffix on the next read,
 * and the copy looked like the original.
 * @param {object} profile
 * @returns {string}
 */
export function copyName(profile) {
	return cutText(shownProfile(profile).name, MAX_NAME_LENGTH - COPY_SUFFIX.length) + COPY_SUFFIX;
}

/**
 * Duplicates a profile, appending " - Copy" to its name as the page shows it, so that a stored name
 * that is not text cannot throw (#120).
 * @param {Array}  list
 * @param {string} id
 * @returns {{ list: Array, id: string | null }}
 */
export function duplicateProfile(list, id) {
	const src = getProfile(list, id);
	if (!src) return { list, id: null };
	const { id: _srcId, ...rest } = src;
	return addProfile(list, { ...rest, name: copyName(src) });
}

/**
 * The page to go back to from the ammo selector, read from its `return` query parameter. Only a
 * profile page, with or without a locale prefix, is accepted: the value comes from the URL, and
 * goto rejects a path that leaves the site or matches no route, which would leave the selection
 * button doing nothing.
 *
 * @param {string|null} value
 * @returns {string}
 */
export function safeReturnPath(value) {
	return /^(\/(fr|de))?\/profiles(\/[\w-]+)?$/.test(value ?? '') ? value : '/profiles';
}

/**
 * Whether a profile can be deleted (#166): not the last one. The calculators need a profile, and the
 * Welcome screen is only for a first run.
 * @param {Array} list
 * @returns {boolean}
 */
export function canDeleteProfile(list) {
	return Array.isArray(list) && list.length > 1;
}

/**
 * The profile that becomes active when the profile `id` is deleted (#166): the next one in list
 * order, else the previous one; null when there is no other profile or `id` is not in the list.
 * @param {Array} list
 * @param {string} id
 * @returns {string | null}
 */
export function nextActiveAfterDelete(list, id) {
	if (!Array.isArray(list)) return null;
	const i = list.findIndex((p) => p.id === id);
	if (i === -1) return null;
	return (list[i + 1] ?? list[i - 1])?.id ?? null;
}

/** A crypto.randomUUID id, the only id an imported profile may keep. */
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;

/**
 * Returns a new list with the imported profiles appended after the stored ones (#166). No stored
 * profile is changed or replaced. Each one keeps the id planImport gave it (a UUID) when no profile
 * in the list has it, so the page can mark it New; any other id gets a new UUID. Entries that are
 * not objects are left out.
 *
 * @param {Array} list
 * @param {Array} imported - profiles from planImport's candidates (profileImport.js)
 * @returns {{ list: Array, ids: string[] }}
 */
export function appendImportedProfiles(list, imported) {
	const taken = new Set(list.map((p) => p.id));
	const added = [];
	for (const profile of Array.isArray(imported) ? imported : []) {
		if (profile === null || typeof profile !== 'object' || Array.isArray(profile)) continue;
		let id = typeof profile.id === 'string' && UUID.test(profile.id) ? profile.id : null;
		if (id === null || taken.has(id)) id = crypto.randomUUID();
		taken.add(id);
		added.push({ ...profile, id });
	}
	return { list: [...list, ...added], ids: added.map((p) => p.id) };
}
