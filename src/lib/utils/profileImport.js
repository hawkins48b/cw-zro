/**
 * Importing profiles from files (#166).
 *
 * A file is either the single profile export of #149 (`zro-profile`, version 1, `profile`) or the
 * export of all profiles (`zro-profiles`, version 1, `profiles`, see profileExport.js). Several files
 * can be imported at once, of either format.
 *
 * Nothing in a file is trusted:
 *
 * - The file must be JSON, of a known format and version, at most MAX_IMPORT_FILE_BYTES long and with
 *   at most MAX_IMPORT_PROFILES profiles; otherwise the whole file is refused with a reason code
 *   (IMPORT_REASONS) the page turns into a message.
 * - Each profile is rebuilt from the fields the profile form knows (readImportedProfile): text cut
 *   to the form's limits (#141), units and choices read as the calculators read them, numbers kept
 *   only when they are numbers. Any other field, `__proto__` and `id` included, is left out. The
 *   rebuilt profile must then pass validateProfile, the profile form's check (limits #125, BC at
 *   most 2 #147), and is stored as the form stores it (buildProfileData). A profile that fails is
 *   skipped and counted, never imported as it is.
 * - Every imported profile gets a new id (planImport), as a duplicate does, and a name already
 *   taken becomes a copy name: "K31 (2)", "K31 (3)" (uniqueCopyName).
 *
 * Nothing here touches storage: the profiles store appends the profiles the user keeps
 * (importProfiles in profiles.svelte.js).
 */
import { parseDecimal } from './decimal.js';
import {
	ALL_PROFILES_EXPORT_FORMAT,
	ALL_PROFILES_EXPORT_VERSION,
	PROFILE_EXPORT_FORMAT,
	PROFILE_EXPORT_VERSION
} from './profileExport.js';
import { buildProfileData, isValid, validateProfile } from './profileValidation.js';
import { MAX_NAME_LENGTH, cutText, shownProfile } from './storedProfiles.js';
import { isRecord } from './storedState.js';

/**
 * Largest file read, in bytes (1 MiB). An exported profile is under 1.5 KB, so this holds several
 * hundred profiles, and keeps a wrong file (a photo, a video) from being read into memory.
 */
export const MAX_IMPORT_FILE_BYTES = 1024 * 1024;

/**
 * Most profiles in one file, and in one import across all its files (security review of #166). A
 * file over it is refused as a whole, not cut; in an import, a file that would take the total over
 * it is refused as a whole ('too_many_total').
 */
export const MAX_IMPORT_PROFILES = 500;

/** Longest number text read from a file, in characters; a longer one is an empty box. */
export const MAX_IMPORT_NUMBER_LENGTH = 32;

/** Longest file name kept for the review list and the messages, in UTF-16 code units. */
export const MAX_IMPORT_FILENAME_LENGTH = 120;

/**
 * Why a file gives no profile. The page shows one message per code.
 *
 * | Code                  | Case                                                                    |
 * |-----------------------|-------------------------------------------------------------------------|
 * | 'too_large'           | Over MAX_IMPORT_FILE_BYTES (size given, or text length)                 |
 * | 'empty'               | The file is empty or holds only spaces                                  |
 * | 'not_json'            | The text is not JSON                                                    |
 * | 'unknown_format'      | JSON, but not an object with `format` 'zro-profile' or 'zro-profiles'   |
 * | 'unsupported_version' | A known format with another `version` than 1 (a later app, or none)     |
 * | 'too_many_profiles'   | A `zro-profiles` file with more than MAX_IMPORT_PROFILES profiles       |
 * | 'no_valid_profiles'   | No profile in it passes the checks (or `profile`/`profiles` is missing) |
 * | 'too_many_total'      | planImport only: the file would take the import over MAX_IMPORT_PROFILES |
 */
export const IMPORT_REASONS = Object.freeze([
	'too_large',
	'empty',
	'not_json',
	'unknown_format',
	'unsupported_version',
	'too_many_profiles',
	'no_valid_profiles',
	'too_many_total'
]);

/** A copy name ends with " (n)": " (2)", " (3)"... */
const COPY_SUFFIX = /\s\((\d+)\)$/;

/** An own field of a parsed object, never one of its prototype. */
const own = (object, key) => (Object.hasOwn(object, key) ? object[key] : undefined);

/**
 * The file name as the page shows it: text, at most MAX_IMPORT_FILENAME_LENGTH long. The page writes
 * it as text, so no other character needs removing.
 * @param {unknown} fileName
 * @returns {string}
 */
function shownFileName(fileName) {
	return typeof fileName === 'string' ? cutText(fileName, MAX_IMPORT_FILENAME_LENGTH) : '';
}

/** Text fields of the form, with their longest length (#141). */
const TEXT_FIELDS = { name: MAX_NAME_LENGTH, opticName: MAX_NAME_LENGTH, bulletBrand: MAX_NAME_LENGTH };

/** Number fields of the form. A value that is not a number is an empty box. */
const NUMBER_FIELDS = [
	'opticHeight',
	'zeroDist',
	'bulletDiameter',
	'bulletWeight',
	'bc',
	'velocity',
	'elevationClickValue',
	'windageClickValue',
	'barrelTwist',
	'bulletLength',
	'temperature',
	'tempModifier'
];

/** Reticles of the profile form; anything else is a red dot, its default. */
const RETICLES = new Set(['red-dot', 'moa', 'mrad', 'mil-dot']);

/**
 * A number field as the form holds it: a finite number as its text, a text of at most
 * MAX_IMPORT_NUMBER_LENGTH characters that reads as a number (decimal comma included) as typed,
 * anything else as an empty box.
 * @param {unknown} value
 * @returns {string}
 */
function numberText(value) {
	if (typeof value === 'number') return Number.isFinite(value) ? String(value) : '';
	if (typeof value !== 'string' || value.length > MAX_IMPORT_NUMBER_LENGTH) return '';
	if (parseDecimal(value) !== null) return value.trim();
	return '';
}

/**
 * A profile read from a file, as the profile form would store it, or null when it is not a profile
 * the form would save. See the file comment.
 *
 * @param {unknown} raw - one profile of the file
 * @returns {object | null} the profile without an id
 */
export function readImportedProfile(raw) {
	if (!isRecord(raw)) return null;
	const shown = shownProfile(raw);
	/** @type {Record<string, any>} */
	const form = {};
	for (const [key, max] of Object.entries(TEXT_FIELDS)) {
		const value = own(raw, key);
		form[key] = typeof value === 'string' || (typeof value === 'number' && Number.isFinite(value))
			? cutText(String(value), max)
			: '';
	}
	for (const key of NUMBER_FIELDS) form[key] = numberText(own(raw, key));
	// Units as the calculators read them (shownProfile): the second value, or else the first.
	for (const key of [
		'barrelTwistUnit',
		'opticHeightUnit',
		'zeroUnit',
		'bulletDiameterUnit',
		'bulletWeightUnit',
		'bcType',
		'bulletLengthUnit',
		'velocityUnit',
		'temperatureUnit'
	]) {
		form[key] = shown[key];
	}
	form.reticleType = RETICLES.has(shown.reticleType) ? shown.reticleType : 'red-dot';
	form.elevationClickUnit = shown.elevationClickUnit === 'MRAD' ? 'MRAD' : 'MOA';
	form.windageClickUnit = shown.windageClickUnit === 'MRAD' ? 'MRAD' : 'MOA';
	form.clickLink = shown.clickLink;
	const spinDrift = shown.spinDrift;
	const tempSensitivity = shown.tempSensitivity;
	if (!isValid(validateProfile(form, spinDrift, tempSensitivity))) return null;
	return buildProfileData(form, spinDrift, tempSensitivity);
}

/**
 * A refused file.
 * @param {string} fileName
 * @param {string} reason - one of IMPORT_REASONS
 * @param {number} [skipped]
 */
const refused = (fileName, reason, skipped = 0) => ({ ok: false, fileName, reason, skipped });

/**
 * Reads one file.
 *
 * @param {unknown} fileName - the file's name, shown in the review and in messages
 * @param {unknown} text - the file's text (`await file.text()`)
 * @param {{ size?: number }} [options] - size: the file's size in bytes (`file.size`). Give it, and
 *   check it with isImportFileTooLarge before reading the file, so a huge file is never read.
 * @returns {{ ok: true, fileName: string, profiles: object[], skipped: number }
 *   | { ok: false, fileName: string, reason: string, skipped: number }}
 *   profiles: the usable profiles, without ids; skipped: how many profiles of the file failed the
 *   checks
 */
export function parseProfileFile(fileName, text, { size } = {}) {
	const name = shownFileName(fileName);
	if (isImportFileTooLarge(size)) return refused(name, 'too_large');
	if (typeof text !== 'string') return refused(name, 'not_json');
	if (text.length > MAX_IMPORT_FILE_BYTES) return refused(name, 'too_large');
	if (text.trim() === '') return refused(name, 'empty');
	let data;
	try {
		data = JSON.parse(text);
	} catch {
		return refused(name, 'not_json');
	}
	if (!isRecord(data)) return refused(name, 'unknown_format');
	const format = own(data, 'format');
	const version = own(data, 'version');
	let list;
	if (format === PROFILE_EXPORT_FORMAT) {
		if (version !== PROFILE_EXPORT_VERSION) return refused(name, 'unsupported_version');
		list = Object.hasOwn(data, 'profile') ? [data.profile] : [];
	} else if (format === ALL_PROFILES_EXPORT_FORMAT) {
		if (version !== ALL_PROFILES_EXPORT_VERSION) return refused(name, 'unsupported_version');
		const profiles = own(data, 'profiles');
		list = Array.isArray(profiles) ? profiles : [];
		if (list.length > MAX_IMPORT_PROFILES) return refused(name, 'too_many_profiles');
	} else {
		return refused(name, 'unknown_format');
	}
	const profiles = [];
	for (const raw of list) {
		const profile = readImportedProfile(raw);
		if (profile) profiles.push(profile);
	}
	const skipped = list.length - profiles.length;
	if (profiles.length === 0) return refused(name, 'no_valid_profiles', skipped);
	return { ok: true, fileName: name, profiles, skipped };
}

/**
 * Whether a file of this size is refused without reading it. An unknown size is not refused here;
 * parseProfileFile then checks the text.
 * @param {unknown} size - bytes
 * @returns {boolean}
 */
export function isImportFileTooLarge(size) {
	return typeof size === 'number' && size > MAX_IMPORT_FILE_BYTES;
}

/** The key a name is compared by: trimmed, NFC, lower case. "K31" and "k31 " are the same name. */
const nameKey = (name) => String(name).trim().normalize('NFC').toLowerCase();

/**
 * The name, or a copy name when it is taken: "K31" gives "K31 (2)", then "K31 (3)"... A name that is
 * already a copy name counts on: "K31 (2)" taken gives "K31 (3)". The base is cut so that the name
 * with its suffix fits in MAX_NAME_LENGTH (#141): the suffix is always kept. Names are compared
 * trimmed and without case (nameKey).
 *
 * @param {string} name
 * @param {Iterable<string>} takenNames
 * @returns {string}
 */
export function uniqueCopyName(name, takenNames) {
	const taken = new Set();
	for (const taken_ of takenNames) taken.add(nameKey(taken_));
	return copyNameIn(name, taken, new Map());
}

/**
 * uniqueCopyName on a set of name keys (nameKey) the caller keeps, so that planImport builds it once
 * (security review of #166). `next` remembers, per base, the number the last search stopped at, so
 * 500 profiles of one name stay linear. The name returned is not added to `taken`.
 *
 * @param {string} name
 * @param {Set<string>} taken - name keys
 * @param {Map<string, number>} next - per base key, the number to try first
 * @returns {string}
 */
function copyNameIn(name, taken, next) {
	const text = cutText(String(name ?? ''), MAX_NAME_LENGTH);
	if (!taken.has(nameKey(text))) return text;
	const match = COPY_SUFFIX.exec(text);
	const base = match ? text.slice(0, match.index) : text;
	const baseKey = nameKey(base);
	const first = match ? Number(match[1]) + 1 : 2;
	for (let n = Math.max(first, next.get(baseKey) ?? 2); ; n++) {
		const suffix = ` (${n})`;
		const candidate = cutText(base, MAX_NAME_LENGTH - suffix.length).trimEnd() + suffix;
		if (!taken.has(nameKey(candidate))) {
			if (n >= (next.get(baseKey) ?? 2)) next.set(baseKey, n + 1);
			return candidate;
		}
	}
}

/**
 * The review list of an import: one candidate per usable profile of the files, in file order, and
 * one error per refused file.
 *
 * - Every candidate gets a new id (crypto.randomUUID, as addProfile). The id in a file is never read.
 * - A name taken by a stored profile, or by an earlier candidate, becomes a copy name
 *   (uniqueCopyName). The names are given as if every candidate were imported.
 * - `key` is the candidate's id, for the list's keyed each block and to mark the imported rows New:
 *   importProfiles keeps it.
 * - At most MAX_IMPORT_PROFILES candidates in all: a file whose profiles would take the total over
 *   it gives no candidate and the error 'too_many_total' (security review of #166).
 *
 * @param {object[]} existingProfiles - profiles.list
 * @param {ReturnType<typeof parseProfileFile>[]} parsedResults
 * @returns {{
 *   candidates: { key: string, profile: object, fileName: string, originalName: string, renamed: boolean }[],
 *   errors: { fileName: string, reason: string }[],
 *   skipped: { fileName: string, count: number }[]
 * }} skipped: the files of which some profiles failed the checks, with their count
 */
export function planImport(existingProfiles, parsedResults) {
	const taken = new Set();
	for (const p of Array.isArray(existingProfiles) ? existingProfiles : []) taken.add(nameKey(shownProfile(p)?.name ?? ''));
	const next = new Map();
	const candidates = [];
	const errors = [];
	const skipped = [];
	for (const result of Array.isArray(parsedResults) ? parsedResults : []) {
		if (!isRecord(result)) continue;
		if (result.skipped > 0) skipped.push({ fileName: result.fileName, count: result.skipped });
		if (!result.ok) {
			errors.push({ fileName: result.fileName, reason: result.reason });
			continue;
		}
		if (candidates.length + result.profiles.length > MAX_IMPORT_PROFILES) {
			errors.push({ fileName: result.fileName, reason: 'too_many_total' });
			continue;
		}
		for (const imported of result.profiles) {
			const originalName = imported.name;
			const name = copyNameIn(originalName, taken, next);
			taken.add(nameKey(name));
			const id = crypto.randomUUID();
			candidates.push({
				key: id,
				profile: { ...imported, name, id },
				fileName: result.fileName,
				originalName,
				renamed: name !== originalName
			});
		}
	}
	return { candidates, errors, skipped };
}
