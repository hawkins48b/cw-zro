import { getLocale } from '#lib/paraglide/runtime.js';

/**
 * Format a number according to the current locale.
 * @param {number} value
 * @param {Intl.NumberFormatOptions} [options]
 * @returns {string}
 */
export function formatNumber(value, options = {}) {
	return new Intl.NumberFormat(getLocale(), options).format(value);
}

/**
 * Format a number with a fixed number of decimal places.
 * @param {number} value
 * @param {number} decimals
 * @returns {string}
 */
export function formatFixed(value, decimals = 1) {
	return formatNumber(value, {
		minimumFractionDigits: decimals,
		maximumFractionDigits: decimals
	});
}

/**
 * A limit as shown in a message: in the current locale, without thousands grouping, so that it
 * reads back as the same number when typed (`3000`, and `25,4` in French and German, #117).
 * @param {number} value
 * @returns {string}
 */
export function formatLimit(value) {
	return formatNumber(value, { useGrouping: false, maximumFractionDigits: 6 });
}

/**
 * Escape a string for use as HTML text content, such as a chart series name
 * that ApexCharts writes with innerHTML.
 * Quotes stay as they are, because ApexCharts also writes the same string to
 * an aria-label with setAttribute, which does not decode entities. This keeps
 * quotes readable there only: names with & < > do show entities in the aria-label.
 * Because quotes stay, this is not safe inside HTML attribute values.
 * @param {unknown} value
 * @returns {string}
 */
export function escapeHtmlText(value) {
	return String(value).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}
