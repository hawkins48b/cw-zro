/**
 * The first-run decision (#150). The app is on its first run while it has no usable profile: the
 * `zro-profiles` key is missing, or holds no list, or a list in which no entry can be used
 * (normalizeProfiles, #120). Then the splash goes to the Welcome screen; otherwise to Scope View.
 */
import { normalizeProfiles } from './storedProfiles.js';

/**
 * @param {unknown} storedProfiles - the stored profile list, as read (undefined or null when missing)
 * @returns {boolean} true when there is no usable profile
 */
export function isFirstRun(storedProfiles) {
	return normalizeProfiles(storedProfiles).length === 0;
}

/**
 * The page the splash opens, without a language prefix.
 * @param {unknown} storedProfiles
 * @returns {'/welcome' | '/scope-view'}
 */
export function startPath(storedProfiles) {
	return isFirstRun(storedProfiles) ? '/welcome' : '/scope-view';
}
