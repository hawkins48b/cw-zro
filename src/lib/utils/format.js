import { getLocale } from '$lib/paraglide/runtime';

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
