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
 * A new id for a later profile whose id is already taken: the id with `-2`, `-3` and so on, the
 * first that no stored profile has and that was not given out yet. It depends only on the stored
 * list, so it is the same at every read, and a save stores it. `next` remembers where the count of
 * each id stopped, so that a list with many copies of one id stays quick to read.
 *
 * @param {string} id
 * @param {Set<string>} stored - every stored id, as text
 * @param {Set<string>} used - ids already given out
 * @param {Map<string, number>} next - for each id, the number to try first
 * @returns {string}
 */
function freeId(id, stored, used, next) {
	for (let n = next.get(id) ?? 2; ; n++) {
		const candidate = `${id}-${n}`;
		if (!stored.has(candidate) && !used.has(candidate)) {
			next.set(id, n + 1);
			return candidate;
		}
	}
}

/**
 * Characters a profile id cannot hold (#134). Pages link to a profile as `/profiles/<id>` without
 * encoding it: `/` adds a path segment, `?` and `#` start the query and the fragment, `%` is read as
 * an escape when the route parameter is decoded, a browser reads `\` as `/`, and it drops tabs and
 * line breaks anywhere in a URL. Each one becomes `-`. A space inside an id is kept: the browser
 * encodes it and the route gives it back.
 */
const URL_UNSAFE = /[\/?#%\\\t\n\r]/g;

/** Whether a character code is one a browser drops from either end of a URL: a space or a control. */
const isUrlTrimmed = (code) => code <= 0x20;

/**
 * The text with each space or control character at either end replaced by `-` (#134). A loop from
 * each end, not a regular expression: `/^[\x00-\x20]+|[\x00-\x20]+$/` takes quadratic time on a
 * long run of spaces inside the text (security review of #134), and this runs on every read.
 * @param {string} text
 * @returns {string}
 */
function replaceTrimmedEnds(text) {
	let start = 0;
	while (start < text.length && isUrlTrimmed(text.charCodeAt(start))) start++;
	if (start === text.length) return '-'.repeat(text.length);
	let end = text.length;
	while (isUrlTrimmed(text.charCodeAt(end - 1))) end--;
	if (start === 0 && end === text.length) return text;
	return '-'.repeat(start) + text.slice(start, end) + '-'.repeat(text.length - end);
}

/**
 * Ids that cannot be used even without those characters (#134): empty; `new` and `ammo-selector`,
 * the static routes under `/profiles/` (a test fails when a new one is not listed here); and `.`
 * and `..`, which a browser resolves as path segments. Such a profile gets FRESH_ID.
 */
export const UNUSABLE_IDS = new Set(['', 'new', 'ammo-selector', '.', '..']);

/** The id given to a profile whose stored id is in UNUSABLE_IDS, or the base of a free one. */
const FRESH_ID = 'profile';

/**
 * The id a stored id becomes before checking it is free: FRESH_ID for an unusable id, else the id
 * as text with every URL_UNSAFE character, and every space or control character at its ends,
 * replaced by `-`.
 * A usable id is unchanged.
 * @param {string|number} id
 * @returns {string}
 */
function linkableId(id) {
	const text = String(id);
	if (UNUSABLE_IDS.has(text)) return FRESH_ID;
	return replaceTrimmedEnds(text.replace(URL_UNSAFE, '-'));
}

/**
 * Longest rifle designation, optic name and ammo brand, in UTF-16 code units as an input's
 * `maxlength` counts them (#141, owner decision of 2026-11-11). The profile form holds each of them
 * to it, and a longer stored value is cut to it when read (cutStoredTexts).
 */
export const MAX_NAME_LENGTH = 60;

/**
 * Longest stored ammo text (`ammo`): the profile form builds it from the brand and the weight
 * (buildAmmoString), so it may hold MAX_NAME_LENGTH characters of brand and a weight after it.
 */
export const MAX_AMMO_LENGTH = MAX_NAME_LENGTH + 20;

/** The stored text fields cut on read, with their longest length (#141). `optic` copies `opticName`. */
const TEXT_LIMITS = {
	name: MAX_NAME_LENGTH,
	opticName: MAX_NAME_LENGTH,
	optic: MAX_NAME_LENGTH,
	bulletBrand: MAX_NAME_LENGTH,
	ammo: MAX_AMMO_LENGTH
};

/**
 * A text cut to at most `max` UTF-16 code units, as `maxlength` counts them, without leaving half
 * of a character that takes two (an emoji, for example) at the end.
 * @param {string} text
 * @param {number} max
 * @returns {string}
 */
export function cutText(text, max) {
	if (text.length <= max) return text;
	const last = text.charCodeAt(max - 1);
	return text.slice(0, last >= 0xd800 && last <= 0xdbff ? max - 1 : max);
}

/**
 * The profile with each text field of TEXT_LIMITS that is longer than its limit cut to it (#141,
 * owner decision: cut on read). Only text is cut: other values are left as stored, for shownProfile
 * to read. The very object given when nothing is cut.
 * @param {Record<string, any>} profile
 * @returns {Record<string, any>}
 */
function cutStoredTexts(profile) {
	let cut = null;
	for (const [key, max] of Object.entries(TEXT_LIMITS)) {
		const value = profile[key];
		if (typeof value === 'string' && value.length > max) {
			cut ??= { ...profile };
			cut[key] = cutText(value, max);
		}
	}
	return cut ?? profile;
}

/**
 * The usable profiles of the stored list. Anything that is not a list gives no profiles, and an
 * entry that is not a profile is left out. The pages then show that there is no profile, and
 * saving a profile writes a usable list again.
 *
 * Ids are read as text (#131, owner decision): pages look a profile up with `===` by the id in
 * `/profiles/<id>`, which is text, so a profile stored with the number id 1 could not be opened, or
 * made active unless it was first. Its id is now `"1"`. Two profiles cannot share an id: the first
 * keeps it, and a later one with the same id (`1` and `"1"`, or `"1"` twice) gets a new one from
 * freeId, so that each profile can still be opened, edited and deleted on its own.
 *
 * Ids that cannot be used in a link are renumbered on read (#134, owner decision): UNUSABLE_IDS
 * (empty, `new`, `ammo-selector`, `.`, `..`) become `profile`; `/`, `?`, `#`, `%`, `\`, tabs and line breaks, and spaces at either
 * end, become `-` (linkableId).
 * When that id is stored on another profile or already given out, freeId gives `<id>-2` and so on,
 * as for a duplicate. Like duplicates, the result depends only on the list, so it is the same at
 * every read, and the next save stores it.
 *
 * A rifle designation, optic name or ammo brand longer than MAX_NAME_LENGTH, and an ammo text longer
 * than MAX_AMMO_LENGTH, is cut to it (#141, cutStoredTexts). Like a renumbered id, the next save
 * stores the cut text.
 *
 * A profile whose id is already text, usable and not taken, and whose texts fit, is the stored
 * object itself. Its other fields are left as stored.
 *
 * @param {unknown} value
 * @returns {object[]}
 */
export function normalizeProfiles(value) {
	if (!Array.isArray(value)) return [];
	const profiles = value.filter(isStoredProfile);
	const stored = new Set(profiles.map((profile) => String(profile.id)));
	const used = new Set();
	const next = new Map();
	return profiles.map((profile) => {
		const text = String(profile.id);
		const wanted = linkableId(text);
		// A changed id must not take one another profile has stored, even later in the list.
		const taken = used.has(wanted) || (wanted !== text && stored.has(wanted));
		const id = taken ? freeId(wanted, stored, used, next) : wanted;
		used.add(id);
		const fitted = cutStoredTexts(profile);
		if (id === profile.id) return fitted;
		return fitted === profile ? { ...profile, id } : Object.assign(fitted, { id });
	});
}

/**
 * The ids normalizeProfiles renumbered so that a link can carry them (#134), as a map from the stored
 * id, as text, to the id it reads as. Only references need it: the active profile and the Compare
 * Trajectories entries hold a profile id. The profiles store rewrites both with this map at load,
 * in the same step as it writes the renumbered list (renameActiveProfileId, renameCompareEntries),
 * so no session can store the new ids while a reference keeps an old one.
 *
 * A stored id is left out when a profile already reads with that id, since a reference to it finds
 * that profile as before: the first of two duplicates (#131), or a number id read as its text. When
 * several profiles were stored with the same unusable id, the first one is the one a reference meant,
 * as with duplicates. No key of the map is an id a profile reads as: those never hold the characters
 * renumbered, nor equal an id in UNUSABLE_IDS.
 *
 * @param {unknown} value - the stored profile list
 * @returns {Map<string, string>}
 */
export function findProfileIdRenames(value) {
	const renames = new Map();
	if (!Array.isArray(value)) return renames;
	const read = normalizeProfiles(value);
	const readIds = new Set(read.map((profile) => profile.id));
	value.filter(isStoredProfile).forEach((profile, i) => {
		const text = String(profile.id);
		if (!readIds.has(text) && !renames.has(text)) renames.set(text, read[i].id);
	});
	return renames;
}

/**
 * The stored active profile id (`zro-active-profile`) with a renumbered id replaced by its new one
 * (#134). Anything else, damaged values included, is returned as stored.
 *
 * @param {unknown} value - the stored active id
 * @param {ReadonlyMap<string, string>} renames - from findProfileIdRenames
 * @returns {unknown}
 */
export function renameActiveProfileId(value, renames) {
	const id = storedProfileId(value);
	return id !== null && renames.has(id) ? renames.get(id) : value;
}

/**
 * The stored Compare Trajectories state (`zro-compare-traj`) with each entry that points at a
 * renumbered id pointed at its new one (#134). The very value given back when no entry changes, so
 * the caller can skip the write. Damaged state, entries or fields are left as stored: only an entry
 * object whose profileId is text in the map changes, and only that field.
 *
 * @param {unknown} value - the stored compare state
 * @param {ReadonlyMap<string, string>} renames - from findProfileIdRenames
 * @returns {unknown}
 */
export function renameCompareEntries(value, renames) {
	if (!isRecord(value)) return value;
	const entries = /** @type {any} */ (value).entries;
	if (!Array.isArray(entries)) return value;
	const renamed = (entry) => isRecord(entry) && typeof entry.profileId === 'string' && renames.has(entry.profileId);
	if (!entries.some(renamed)) return value;
	return {
		...value,
		entries: entries.map((entry) => (renamed(entry) ? { ...entry, profileId: renames.get(entry.profileId) } : entry))
	};
}

/**
 * The profile a stored reference to a profile id points at (#134): the active profile, or a
 * Compare Trajectories entry. First the usable profile with that id, as before. Else the profile
 * that is stored with that id and was renumbered by normalizeProfiles, the first one if several
 * were, so a reference stored before the renumbering still finds its profile. Undefined when none.
 * The profiles store rewrites the stored references at load (findProfileIdRenames); this is only a
 * fallback.
 *
 * @param {unknown} value - the stored profile list
 * @param {string|null} id - the stored reference, as text (storedProfileId)
 * @returns {object|undefined}
 */
export function profileForStoredId(value, id) {
	if (typeof id !== 'string' || !Array.isArray(value)) return undefined;
	const profiles = normalizeProfiles(value);
	const exact = profiles.find((profile) => profile.id === id);
	if (exact) return exact;
	const index = value.filter(isStoredProfile).findIndex((profile) => String(profile.id) === id);
	return index === -1 ? undefined : profiles[index];
}

/**
 * The stored id of the active profile, read as normalizeProfiles reads profile ids (#131): a number
 * or text as text, anything else as none, so the first profile is active. A stored `1` therefore
 * finds the profile stored with the id `1`, or `"1"`. A stored id that was renumbered (#134) finds
 * its profile through profileForStoredId.
 *
 * @param {unknown} value
 * @returns {string|null}
 */
export const storedProfileId = (value) => (isNumberOrText(value) ? String(value) : null);

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
