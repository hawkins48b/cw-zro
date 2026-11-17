/**
 * Exporting one profile as a JSON file (#149).
 *
 * The file holds the profile as the profiles store gives it (`profiles.get(id)`): the stored
 * profile, read by normalizeProfiles, so its id is usable and its names fit. Fields are written as
 * stored, a damaged value included: the file is a copy, not a checked profile. It is wrapped in a
 * small envelope so that a later import can recognise the file and its version:
 *
 * ```json
 * {
 *   "format": "zro-profile",
 *   "version": 1,
 *   "exportedAt": "2026-11-16T09:30:00.000Z",
 *   "profile": { "id": "...", "name": "...", ... }
 * }
 * ```
 *
 * The id is kept as stored. An import must not trust it: it should give the profile a new id, as
 * duplicating one does.
 *
 * Nothing here touches the network or storage. The page saves the text through a normal download.
 */
import { isRecord } from './storedState.js';
import { isNumberOrText } from './storedWind.js';

/** The `format` field of an exported profile. */
export const PROFILE_EXPORT_FORMAT = 'zro-profile';

/** The `version` field. Raise it when the envelope or the profile fields change in a way an import must know. */
export const PROFILE_EXPORT_VERSION = 1;

/** The MIME type of the file. */
export const PROFILE_EXPORT_TYPE = 'application/json';

/** The file name when the profile name gives no usable character. */
export const PROFILE_EXPORT_FALLBACK_NAME = 'zro-profile.json';

/** Longest name part of the file name, in characters (code points). */
export const MAX_FILENAME_NAME_LENGTH = 60;

/**
 * How much of the profile name is read for the file name, in UTF-16 code units. Stored names are
 * cut to 60 when read (#141), but this function can be given any profile; the cap keeps the work
 * small on a long damaged name.
 */
const MAX_NAME_INPUT = 4 * MAX_FILENAME_NAME_LENGTH;

/** Every run of characters that is not a letter, a combining mark, a digit or `_`. */
const UNSAFE_RUN = /[^\p{L}\p{M}\p{N}_]+/gu;

/**
 * The name part of the file name: the profile name with only letters (accented ones included),
 * digits, `_` and `-` (#149).
 *
 * - Anything else becomes `-`, a run of them one `-`: spaces, dots, `/`, `\`, `:`, `*`, `?`, `"`,
 *   `<`, `>`, `|`, control and format characters (bidirectional overrides among them), emoji. So
 *   the name cannot hold a path, an extension or a leading dot.
 * - `-` and `_` are trimmed from both ends, then the name is cut to MAX_FILENAME_NAME_LENGTH
 *   characters (never half a character) and trimmed again.
 * - The text is normalised to NFC first, so an accented letter typed as letter plus accent is one
 *   character.
 *
 * Windows reserved names (`CON`, `NUL`, `COM1` and so on) need no rule: the file name always starts
 * with `zro-profile-`, so the name part is never the whole base name.
 *
 * @param {unknown} name - the stored profile name; anything that is not a number or text gives ''
 * @returns {string} the name part, possibly ''
 */
export function filenamePart(name) {
	if (!isNumberOrText(name)) return '';
	const text = String(name).slice(0, MAX_NAME_INPUT).normalize('NFC');
	const safe = text.replace(UNSAFE_RUN, '-');
	const chars = Array.from(trimSeparators(safe)).slice(0, MAX_FILENAME_NAME_LENGTH);
	return trimSeparators(chars.join(''));
}

/** Whether a character is a separator trimmed from the ends of the name part. */
const isSeparator = (char) => char === '-' || char === '_';

/**
 * The text without `-` and `_` at either end. A loop, not a regular expression: `/[-_]+$/` takes
 * quadratic time on a long run of them inside the text (see replaceTrimmedEnds in storedProfiles.js).
 * @param {string} text
 * @returns {string}
 */
function trimSeparators(text) {
	let start = 0;
	let end = text.length;
	while (start < end && isSeparator(text[start])) start++;
	while (end > start && isSeparator(text[end - 1])) end--;
	return text.slice(start, end);
}

/**
 * The file name of an exported profile: `zro-profile-<name>.json`, the name made safe by
 * filenamePart, or `zro-profile.json` when nothing of the name is left.
 * @param {unknown} name - the stored profile name
 * @returns {string}
 */
export function profileExportFilename(name) {
	const part = filenamePart(name);
	return part ? `zro-profile-${part}.json` : PROFILE_EXPORT_FALLBACK_NAME;
}

/**
 * The text of the export file: the envelope with the profile, as JSON with two-space indents and a
 * final line break. Null when the profile is not an object (a missing or damaged profile gives no
 * file) or cannot be written as JSON. A date that is not valid gives `exportedAt: null`.
 *
 * @param {unknown} profile - the profile as `profiles.get(id)` gives it
 * @param {Date} exportedAt - the time of the export, given in so tests can fix it
 * @returns {string|null}
 */
export function profileExportJson(profile, exportedAt) {
	if (!isRecord(profile)) return null;
	const time = exportedAt instanceof Date && !Number.isNaN(exportedAt.getTime()) ? exportedAt.toISOString() : null;
	try {
		return (
			JSON.stringify(
				{ format: PROFILE_EXPORT_FORMAT, version: PROFILE_EXPORT_VERSION, exportedAt: time, profile },
				null,
				2
			) + '\n'
		);
	} catch {
		// A value parsed from storage is always JSON; this only guards a profile built in memory.
		return null;
	}
}

/**
 * The file to download for a profile: its name and its text, or null when there is nothing to
 * export (see profileExportJson).
 *
 * @param {unknown} profile - the profile as `profiles.get(id)` gives it
 * @param {Date} exportedAt
 * @returns {{ filename: string, content: string, type: string } | null}
 */
export function profileExportFile(profile, exportedAt) {
	const content = profileExportJson(profile, exportedAt);
	if (content === null) return null;
	return {
		filename: profileExportFilename(/** @type {Record<string, unknown>} */ (profile).name),
		content,
		type: PROFILE_EXPORT_TYPE
	};
}

/** How long the Blob URL of a download is kept, in ms, before it is revoked. */
export const DOWNLOAD_URL_LIFETIME_MS = 1000;

/**
 * Downloads a file built here, through a normal download, as the CSV and dope card downloads do:
 * a Blob URL clicked from a link that is never added to the page. Nothing is sent.
 *
 * @param {{ filename: string, content: string, type: string } | null} file
 * @param {Document} [doc]
 * @returns {boolean} false when there is no file
 */
export function downloadFile(file, doc = globalThis.document) {
	if (!file) return false;
	const blob = new Blob([file.content], { type: file.type });
	const url = URL.createObjectURL(blob);
	const a = doc.createElement('a');
	a.href = url;
	a.download = file.filename;
	a.click();
	// Later, not at once: a browser may still be starting the download after click() returns
	// (security review of #166).
	setTimeout(() => URL.revokeObjectURL(url), DOWNLOAD_URL_LIFETIME_MS);
	return true;
}

/**
 * Downloads one profile (#149): "Export this profile".
 * @param {unknown} profile - the profile as `profiles.get(id)` gives it
 * @param {Date} [now]
 * @returns {boolean} false when the profile gives no file
 */
export function downloadProfile(profile, now = new Date()) {
	return downloadFile(profileExportFile(profile, now));
}

// ── Export all (#166) ─────────────────────────────────────────────────────

/** The `format` field of the file with all profiles. */
export const ALL_PROFILES_EXPORT_FORMAT = 'zro-profiles';

/** Its `version`. Same rule as PROFILE_EXPORT_VERSION. */
export const ALL_PROFILES_EXPORT_VERSION = 1;

/** Its file name when the date is not valid. */
export const ALL_PROFILES_EXPORT_FALLBACK_NAME = 'zro-profiles.json';

/**
 * The envelope of the file with all profiles (#166):
 *
 * ```json
 * { "format": "zro-profiles", "version": 1, "exportedAt": "2026-11-17T09:30:00.000Z", "profiles": [ ... ] }
 * ```
 *
 * Each profile is written as the single export writes it: as stored (`profiles.list`), id included.
 * An entry that is not an object is left out. A date that is not valid gives `exportedAt: null`.
 *
 * @param {unknown} profiles - profiles.list
 * @param {Date} [now]
 * @returns {{ format: string, version: number, exportedAt: string|null, profiles: object[] }}
 */
export function buildAllProfilesExport(profiles, now = new Date()) {
	const time = now instanceof Date && !Number.isNaN(now.getTime()) ? now.toISOString() : null;
	return {
		format: ALL_PROFILES_EXPORT_FORMAT,
		version: ALL_PROFILES_EXPORT_VERSION,
		exportedAt: time,
		profiles: Array.isArray(profiles) ? profiles.filter(isRecord) : []
	};
}

/**
 * The file name of the file with all profiles: `zro-profiles-YYYY-MM-DD.json`, the date of the
 * device's own time zone (the day the user sees), or ALL_PROFILES_EXPORT_FALLBACK_NAME.
 * @param {Date} [now]
 * @returns {string}
 */
export function allProfilesExportFileName(now = new Date()) {
	if (!(now instanceof Date) || Number.isNaN(now.getTime())) return ALL_PROFILES_EXPORT_FALLBACK_NAME;
	const pad = (n) => String(n).padStart(2, '0');
	return `zro-profiles-${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}.json`;
}

/**
 * The file with all profiles, or null when there is no profile to export or it cannot be written
 * as JSON.
 * @param {unknown} profiles - profiles.list
 * @param {Date} [now]
 * @returns {{ filename: string, content: string, type: string } | null}
 */
export function allProfilesExportFile(profiles, now = new Date()) {
	const envelope = buildAllProfilesExport(profiles, now);
	if (envelope.profiles.length === 0) return null;
	let content;
	try {
		content = JSON.stringify(envelope, null, 2) + '\n';
	} catch {
		return null;
	}
	return { filename: allProfilesExportFileName(now), content, type: PROFILE_EXPORT_TYPE };
}

/**
 * Downloads every profile in one file: "Export all".
 * @param {unknown} profiles - profiles.list
 * @param {Date} [now]
 * @returns {boolean} false when there was nothing to export
 */
export function downloadAllProfiles(profiles, now = new Date()) {
	return downloadFile(allProfilesExportFile(profiles, now));
}
