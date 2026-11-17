/**
 * The guided profile setup (#150, #177): its steps, the fields each one checks, where "+ New profile"
 * links lead, and where the setup goes once saved. Plain functions, tested without Svelte.
 */
import { validateProfile } from './profileValidation.js';

/** Where every "+ New profile" link leads (#177): the guided setup. */
export const NEW_PROFILE_PATH = '/setup';

/** The full profile form, linked from the guided setup as "Use the full form" (#177). */
export const FULL_FORM_PATH = '/profiles/new';

/**
 * The form fields each step asks for, to keep the errors of that step. Step 2 also carries
 * bulletLength when a library pick filled it; step 4 (#177, optional) checks it only with spin drift on.
 */
export const SETUP_STEP_FIELDS = {
	1: ['name', 'opticName', 'opticHeight', 'zeroDist', 'elevationClickValue'],
	2: ['bulletBrand', 'bulletDiameter', 'bulletWeight', 'bc'],
	3: ['velocity'],
	4: ['barrelTwist', 'bulletLength', 'temperature', 'tempModifier']
};

export const SETUP_STEP_COUNT = 4;

/**
 * The profile form's errors (validateProfile), kept to the fields of one step. The switches of
 * step 4 decide whether its fields are checked, as in the profile form.
 *
 * @param {number} step - 1 to SETUP_STEP_COUNT
 * @param {object} form - the guided setup's form, values as typed
 * @param {{ spinDrift?: boolean, tempSensitivity?: boolean }} [advanced]
 * @returns {{ [field: string]: 'required' | 'invalid_number' | 'out_of_range' }}
 */
export function setupStepErrors(step, form, advanced = {}) {
	const fields = SETUP_STEP_FIELDS[step];
	if (!fields) return {};
	const all = validateProfile(form, advanced.spinDrift === true, advanced.tempSensitivity === true);
	return Object.fromEntries(fields.filter((key) => all[key]).map((key) => [key, all[key]]));
}

/**
 * Where the guided setup goes once the profile is saved (#177), paths without a language prefix.
 *
 * - First run: Scope View, replacing the setup (#150, unchanged).
 * - Opened from a page of the app ("+ New profile"): back to that page, with the new profile in use.
 *   Not back to a profile editor (/profiles/new, /profiles/<id>, the Ammo Library), which the
 *   desktop sidebar links from: the Profiles list instead.
 * - Opened directly (no page before it): the Profiles list, replacing the setup.
 *
 * @param {{ firstRun: boolean, fromPath: string | null }} where
 * @returns {{ back: true } | { path: string, replace: true }}
 */
export function setupSavedTarget({ firstRun, fromPath }) {
	if (firstRun) return { path: '/scope-view', replace: true };
	if (fromPath === null || fromPath === undefined) return { path: '/profiles', replace: true };
	const path = fromPath.replace(/(.)\/$/, '$1');
	if (path === '/setup' || path === '/welcome' || /^\/profiles\/.+/.test(path)) {
		return { path: '/profiles', replace: true };
	}
	return { back: true };
}
