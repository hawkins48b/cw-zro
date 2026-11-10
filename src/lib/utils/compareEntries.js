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
 * The text of a compare chart series, as the user should read it, for labels that are not HTML
 * such as aria-labels (#111). Never hand it to ApexCharts as a series name: use compareSeriesName.
 * @param {string} profileName
 * @param {string|number} zeroDist
 * @param {string} unitLabel
 * @returns {string}
 */
export function compareSeriesText(profileName, zeroDist, unitLabel) {
	return `${profileName} @ ${zeroDist} ${unitLabel}`;
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
	return escapeHtmlText(compareSeriesText(profileName, zeroDist, unitLabel));
}

/**
 * An ApexCharts aria-label with the series name as the user typed it (#111).
 *
 * ApexCharts 5.16.0 starts the label of a legend item with the series name and a comma
 * (Legend.js), and the label of a keyboard-focused data point with the series name and a colon
 * (KeyboardNavigation.js _buildPointLabel). It writes them with setAttribute, which does not
 * decode entities, so the escaped name of compareSeriesName would be read out as `&amp;`. This
 * puts the series text back at the start of such a label.
 *
 * Only the series the element belongs to is matched (chartLabelSeries), never another one: a
 * series text can start with another series' escaped name (`&amp;lt;` is the text of one profile and
 * the escaped name of `&lt;`), and ApexCharts itself writes the text after a legend toggle. The
 * text is shorter than its escaped name whenever the two differ, so a fixed label never matches
 * again: calling this on its own result changes nothing.
 *
 * @param {string} label - the aria-label ApexCharts wrote
 * @param {{ name: string, text: string } | undefined} series - escaped name and text of the element's series
 * @returns {string}
 */
export function chartLabelText(label, series) {
	if (!series || series.name === series.text) return label;
	const { name, text } = series;
	return label.startsWith(`${name},`) || label.startsWith(`${name}:`) ? text + label.slice(name.length) : label;
}

/**
 * The index of the series an ApexCharts 5.16.0 element with an aria-label belongs to, or null.
 * A legend item has `rel`, the index plus 1 (Legend.js); a data point sits inside the series group,
 * which has `data:realIndex` (Line.js).
 *
 * @param {Element} element
 * @returns {number|null}
 */
export function chartLabelSeries(element) {
	const raw = element.classList.contains('apexcharts-legend-series')
		? Number(element.getAttribute('rel')) - 1
		: Number(element.closest('.apexcharts-series')?.getAttribute('data:realIndex') ?? NaN);
	return Number.isInteger(raw) && raw >= 0 ? raw : null;
}
