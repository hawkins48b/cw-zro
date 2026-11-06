import { escapeHtmlText } from './format.js';

const ZERO_UNITS = ['yd', 'm'];

/**
 * Whether a stored compare entry can be used. An empty or rejected zero distance is usable: the page
 * has to keep the entry so that its message shows.
 * @param {any} entry
 * @returns {boolean}
 */
function isCompareEntry(entry) {
	return (
		entry !== null &&
		typeof entry === 'object' &&
		typeof entry.id === 'string' &&
		typeof entry.profileId === 'string' &&
		(typeof entry.zeroDist === 'string' || typeof entry.zeroDist === 'number') &&
		ZERO_UNITS.includes(entry.zeroUnit)
	);
}

/**
 * The usable entries of a stored compare list. The value comes from localStorage, so it cannot be
 * trusted: anything that is not an array gives no entries, and a damaged entry is left out.
 * @param {unknown} value
 * @returns {object[]}
 */
export function normalizeCompareEntries(value) {
	return Array.isArray(value) ? value.filter(isCompareEntry) : [];
}

/**
 * The name of a compare chart series. ApexCharts writes series names with innerHTML, so the name
 * and the zero distance, which both come from the user, must stay escaped (#103).
 * @param {string} profileName
 * @param {string|number} zeroDist
 * @param {string} unitLabel
 * @returns {string}
 */
export function compareSeriesName(profileName, zeroDist, unitLabel) {
	return escapeHtmlText(`${profileName} @ ${zeroDist} ${unitLabel}`);
}
