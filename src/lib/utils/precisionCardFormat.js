/**
 * Units, columns and number formats of the precision dope card (#157), without the engine, so that
 * the template script can read them in plain Node.
 *
 * Numbers print with a decimal point in every language, as on the mid-range cards. Negative values
 * use the hyphen-minus: the standard PDF fonts (WinAnsi) have no U+2212. A missing value prints as
 * an en dash.
 */

/**
 * The columns of each unit system (owner decision of 2026-11-17 on #157). The reference is the ICAO
 * standard in both: 1013.25 hPa is 29.92 inHg and 15 °C is 59 °F.
 */
export const PRECISION_UNITS = Object.freeze({
	metric: Object.freeze({
		pressure: Object.freeze({ unit: 'hPa', reference: 1013.25, columns: Object.freeze([1000, 950, 900, 850, 800, 750]) }),
		temperature: Object.freeze({ unit: 'C', reference: 15, columns: Object.freeze([45, 35, 25, 15, 5, -5, -15, -25]) }),
		wind: Object.freeze({ unit: 'm/s', speeds: Object.freeze([2, 4, 6, 8]) })
	}),
	imperial: Object.freeze({
		pressure: Object.freeze({ unit: 'inHg', reference: 29.92, columns: Object.freeze([29.5, 28.0, 26.5, 25.0, 23.5, 22.0]) }),
		temperature: Object.freeze({ unit: 'F', reference: 59, columns: Object.freeze([110, 90, 70, 50, 30, 10, -10]) }),
		wind: Object.freeze({ unit: 'mph', speeds: Object.freeze([5, 10, 15, 20]) })
	})
});

/** What a missing value prints: an en dash (WinAnsi). */
export const NO_VALUE = '–';

/** The printed symbol of a unit: °C and °F for C and F, the unit itself otherwise. */
export function unitSymbol(unit) {
	if (unit === 'C') return '°C';
	if (unit === 'F') return '°F';
	return unit;
}

/** A signed number: '+3', '0', '-1'. */
export function signed(value) {
	if (value === 0) return '0';
	return value > 0 ? `+${value}` : `-${Math.abs(value)}`;
}

/** A signed number with one decimal: '+3.2', '0.0', '-1.0'. */
export function signedTenth(value) {
	if (value === 0) return '0.0';
	return (value > 0 ? '+' : '-') + Math.abs(value).toFixed(1);
}

/**
 * A column heading or reference: temperatures signed ('+45', '-5'), inHg with at least one decimal
 * ('28.0', '29.92'), hPa as it is.
 * @param {number} value
 * @param {string} unit
 */
export function formatColumn(value, unit) {
	if (unit === 'C' || unit === 'F') return signed(value);
	if (unit === 'inHg') return Number.isInteger(value * 10) ? value.toFixed(1) : String(value);
	return String(value);
}

/**
 * A printed correction: whole clicks signed ('+3'), or an angle to 0.1 signed ('+0.3'); a magnitude
 * without a sign when `magnitude` is set. A missing value is NO_VALUE.
 * @param {number|null} value
 * @param {'clicks'|'angle'} correction
 * @param {{ magnitude?: boolean }} [options]
 */
export function formatCorrection(value, correction, { magnitude = false } = {}) {
	if (value === null || value === undefined || !Number.isFinite(value)) return NO_VALUE;
	if (magnitude) return correction === 'angle' ? Math.abs(value).toFixed(1) : String(Math.abs(value));
	return correction === 'angle' ? signedTenth(value) : signed(value);
}

/**
 * A date as dd.mm.yyyy.
 * @param {Date} date
 */
export function formatDate(date) {
	const pad = (n) => String(n).padStart(2, '0');
	return `${pad(date.getDate())}.${pad(date.getMonth() + 1)}.${date.getFullYear()}`;
}
