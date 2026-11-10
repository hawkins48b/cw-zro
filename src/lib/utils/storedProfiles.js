/**
 * Reading the stored profile list (#120).
 *
 * localStorage can hold any JSON value. The list is checked when it is read, and each profile is
 * read in two ways, as the wind is (storedWind.js):
 *
 * - normalizeProfiles gives the profiles that can be used at all. The calculators get these
 *   profiles as stored: they check every value they read (#89), and a damaged value gives no result.
 * - shownProfile gives the text a page shows. A damaged value is an empty box there, so that the
 *   page cannot throw. Never hand it to a calculator: an empty optional box, such as the barrel
 *   twist, would give a result where the stored value gives none.
 */
import { isRecord } from './storedState.js';
import { isNumberOrText } from './storedWind.js';

/**
 * Whether a stored profile can be listed: an object whose id can become text. Pages link to the
 * profile by its id and look it up by it.
 * @param {unknown} profile
 * @returns {boolean}
 */
const isStoredProfile = (profile) => isRecord(profile) && isNumberOrText(/** @type {any} */ (profile).id);

/**
 * The usable profiles of the stored list, as stored. Anything that is not a list gives no profiles,
 * and an entry that is not a profile is left out. The pages then show that there is no profile, and
 * saving a profile writes a usable list again.
 *
 * @param {unknown} value
 * @returns {object[]}
 */
export function normalizeProfiles(value) {
	return Array.isArray(value) ? value.filter(isStoredProfile) : [];
}

/** Names and labels: shown as text, so that pages can sort and search them. */
const NAME_FIELDS = ['name', 'ammo', 'optic', 'opticName', 'bulletBrand'];

/** Typed numbers: shown as stored when a number or text, else as an empty box. */
const NUMBER_FIELDS = [
	'barrelTwist',
	'opticHeight',
	'zeroDist',
	'bulletDiameter',
	'bulletWeight',
	'bc',
	'bulletLength',
	'velocity',
	'temperature',
	'tempModifier'
];

/**
 * Click values: as stored when a number or text, else 0.5, the value the Scope View counts clicks
 * with when it cannot read one, and the profile form's default.
 */
const CLICK_FIELDS = ['elevationClickValue', 'windageClickValue'];

/**
 * Units, as the calculators read them: the second value, or else the first. So `mm` is millimetres
 * and any other twist unit is inches, as in calculateShotPoint.
 */
const UNIT_FIELDS = {
	barrelTwistUnit: ['in', 'mm'],
	opticHeightUnit: ['in', 'cm'],
	zeroUnit: ['yd', 'm'],
	bulletDiameterUnit: ['in', 'mm'],
	bulletWeightUnit: ['gr', 'g'],
	bcType: ['G1', 'G7'],
	bulletLengthUnit: ['in', 'mm'],
	velocityUnit: ['fps', 'mps'],
	temperatureUnit: ['f', 'c']
};

/** Choices read only by pages: kept when text, else their default. */
const CHOICE_FIELDS = { reticleType: 'red-dot', elevationClickUnit: 'MOA', windageClickUnit: 'MOA' };

/**
 * A profile as pages show it: every field a page reads, in a shape it can render, sort and search.
 * Names are text (a number becomes its text); a number field that is not a number or text is an
 * empty box, and a click value 0.5; units are read as the calculators read them; spin drift and
 * powder sensitivity are on when the stored value is truthy, as the calculators test them; the
 * click link is on unless it is stored as off. Other stored fields are left out.
 *
 * @param {object|null|undefined} profile - a profile from normalizeProfiles
 * @returns {object|null}
 */
export function shownProfile(profile) {
	if (!isRecord(profile)) return null;
	const stored = /** @type {Record<string, any>} */ (profile);
	/** @type {Record<string, any>} */
	const shown = { id: stored.id };
	for (const key of NAME_FIELDS) shown[key] = isNumberOrText(stored[key]) ? String(stored[key]) : '';
	for (const key of NUMBER_FIELDS) shown[key] = isNumberOrText(stored[key]) ? stored[key] : '';
	for (const key of CLICK_FIELDS) shown[key] = isNumberOrText(stored[key]) ? stored[key] : '0.5';
	for (const [key, [first, second]] of Object.entries(UNIT_FIELDS)) {
		shown[key] = stored[key] === second ? second : first;
	}
	for (const [key, fallback] of Object.entries(CHOICE_FIELDS)) {
		shown[key] = typeof stored[key] === 'string' ? stored[key] : fallback;
	}
	shown.spinDrift = Boolean(stored.spinDrift);
	shown.tempSensitivity = Boolean(stored.tempSensitivity);
	shown.clickLink = stored.clickLink === undefined || stored.clickLink === null ? true : Boolean(stored.clickLink);
	return shown;
}
