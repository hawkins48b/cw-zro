/**
 * Reading numbers typed in the app's text boxes (#89, #117).
 *
 * The app ships in French and German, where the comma is the decimal mark, and the boxes use
 * inputmode="decimal", so a phone keyboard can offer only a comma. A comma therefore reads as a
 * decimal point: `1,5` is 1.5 (owner decision on #117). There is no thousands separator: `1,500`
 * is 1.5, not 1500, and `1.500,5` or `1 500` are not numbers.
 */

/**
 * A plain decimal number: optional sign, digits with at most one `.` or `,` separator, and an
 * optional exponent. At least one digit before or after the separator.
 */
const PLAIN_DECIMAL = /^[+-]?(?:\d+(?:[.,]\d*)?|[.,]\d+)(?:[eE][+-]?\d+)?$/;

/**
 * The value of a typed or stored number, or null when it is not a plain finite decimal number.
 * Use it where a value is checked, as in the profile form.
 *
 * Rejected: empty or blank text, `Infinity`, `NaN`, hex, binary and octal (`0x10`), an exponent
 * that overflows (`1e999`), text after the number (`90abc`), more than one separator, and any
 * value that is not a number or a string. Spaces around the number are ignored. A finite number
 * is returned as it is.
 *
 * @param {unknown} value
 * @returns {number|null}
 */
export function parseDecimal(value) {
	if (typeof value === 'number') return Number.isFinite(value) ? value : null;
	if (typeof value !== 'string') return null;
	const text = value.trim();
	if (!PLAIN_DECIMAL.test(text)) return null;
	const number = Number(text.replace(',', '.'));
	return Number.isFinite(number) ? number : null;
}

/**
 * A number as parseFloat reads it, with a comma read as a decimal point. Use it where the app
 * read a value with parseFloat, so that the result stays the same for every value without a comma.
 *
 * Like parseFloat it reads the number at the start of the text and ignores what follows, so
 * `90abc` stays 90 (pinned on the wind path since #116). It can return NaN or Infinity: the
 * calculators check the value afterwards. Only the first comma counts, so `1,5,3` is 1.5. A value
 * that is not a string goes to parseFloat unchanged.
 *
 * @param {unknown} value
 * @returns {number}
 */
export function readDecimal(value) {
	return parseFloat(typeof value === 'string' ? value.replace(',', '.') : /** @type {any} */ (value));
}

/**
 * A valid typed number as the app stores it: trimmed, with a decimal point instead of a comma.
 * Text that is not a plain decimal number is returned as it was.
 *
 * @param {string} value
 * @returns {string}
 */
export function normalizeDecimal(value) {
	if (typeof value !== 'string' || parseDecimal(value) === null) return value;
	return value.trim().replace(',', '.');
}
