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
 * The name of a compare chart series, as the user typed it. ApexCharts 8 writes series names as
 * text in the legend and escapes them in the tooltip (#75), so the name is not escaped here: an
 * escaped name would show `&amp;`. On ApexCharts 5.16.0 the page escaped it (#103) and put it back as text
 * in aria-labels (#111).
 * @param {string} profileName
 * @param {string|number} zeroDist
 * @param {string} unitLabel
 * @returns {string}
 */
export function compareSeriesText(profileName, zeroDist, unitLabel) {
	return `${profileName} @ ${zeroDist} ${unitLabel}`;
}
