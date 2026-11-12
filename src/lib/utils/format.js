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
