/**
 * Units, columns and number formats of the precision dope card (#157), without the engine, so that
 * the template script can read them in plain Node.
 *
 * Numbers print with a decimal point in every language, as on the mid-range cards. Negative values
 * use the hyphen-minus: the standard PDF fonts (WinAnsi) have no U+2212. A missing value prints as
 * an en dash.
 */

/**
 * The columns of each unit, by quantity (owner decisions of 2026-11-17 on #157 and #160): each of
 * wind, pressure and temperature has its own unit, chosen apart from the others. The reference is
 * the ICAO standard either way: 1013.25 hPa is 29.92 inHg and 15 °C is 59 °F.
 */
export const PRECISION_COLUMNS = Object.freeze({
	wind: Object.freeze({
		mps: Object.freeze({ unit: 'm/s', speeds: Object.freeze([2, 4, 6, 8]) }),
		mph: Object.freeze({ unit: 'mph', speeds: Object.freeze([5, 10, 15, 20]) })
	}),
	pressure: Object.freeze({
		hpa: Object.freeze({ unit: 'hPa', reference: 1013.25, columns: Object.freeze([1000, 950, 900, 850, 800, 750]) }),
		inhg: Object.freeze({ unit: 'inHg', reference: 29.92, columns: Object.freeze([29.5, 28.0, 26.5, 25.0, 23.5, 22.0]) })
	}),
	temperature: Object.freeze({
		c: Object.freeze({ unit: 'C', reference: 15, columns: Object.freeze([45, 35, 25, 15, 5, -5, -15, -25]) }),
		f: Object.freeze({ unit: 'F', reference: 59, columns: Object.freeze([110, 90, 70, 50, 30, 10, -10]) })
	})
});

/** The quantities that have a unit choice, in the order of PrecisionUnits. */
export const PRECISION_QUANTITIES = Object.freeze(['wind', 'pressure', 'temperature']);

/**
 * @typedef {{ wind: 'mps'|'mph', pressure: 'hpa'|'inhg', temperature: 'c'|'f' }} PrecisionUnits
 */

/** The two presets: all metric, all imperial (#160). The cards of #157 had only these. */
export const PRECISION_UNIT_PRESETS = Object.freeze({
	metric: Object.freeze({ wind: 'mps', pressure: 'hpa', temperature: 'c' }),
	imperial: Object.freeze({ wind: 'mph', pressure: 'inhg', temperature: 'f' })
});

/**
 * The units option read strictly (#160): a preset name ('metric' or 'imperial'), or a plain
 * object with exactly the own keys wind, pressure and temperature, each set to one of the units
 * of PRECISION_COLUMNS. Anything else is null: an unknown preset, a missing, inherited or extra
 * key, an unknown or inherited unit name ('toString', '__proto__'), an array, or an object that
 * throws when read. Each key is read once, so a getter cannot answer differently later.
 * @param {unknown} value
 * @returns {Readonly<PrecisionUnits>|null} a new frozen object, never the caller's
 */
export function precisionUnits(value) {
	if (typeof value === 'string') return Object.hasOwn(PRECISION_UNIT_PRESETS, value) ? PRECISION_UNIT_PRESETS[value] : null;
	try {
		if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
		const keys = Reflect.ownKeys(value);
		if (keys.length !== PRECISION_QUANTITIES.length) return null;
		/** @type {Record<string, string>} */
		const units = {};
		for (const quantity of PRECISION_QUANTITIES) {
			if (!Object.hasOwn(value, quantity)) return null;
			const unit = value[quantity];
			if (typeof unit !== 'string' || !Object.hasOwn(PRECISION_COLUMNS[quantity], unit)) return null;
			units[quantity] = unit;
		}
		return /** @type {Readonly<PrecisionUnits>} */ (Object.freeze(units));
	} catch {
		// A Proxy or getter that throws.
		return null;
	}
}

/**
 * The preset a choice matches, or null for a mixed choice.
 * @param {unknown} units
 * @returns {'metric'|'imperial'|null}
 */
export function precisionUnitPreset(units) {
	const u = precisionUnits(units);
	if (!u) return null;
	for (const [name, preset] of Object.entries(PRECISION_UNIT_PRESETS)) {
		if (PRECISION_QUANTITIES.every((q) => preset[q] === u[q])) return /** @type {'metric'|'imperial'} */ (name);
	}
	return null;
}

/**
 * The columns of a unit choice: { pressure, temperature, wind }, each the entry of
 * PRECISION_COLUMNS. Null for a choice precisionUnits refuses.
 * @param {unknown} units
 */
export function precisionColumns(units) {
	const u = precisionUnits(units);
	if (!u) return null;
	return Object.freeze({
		pressure: PRECISION_COLUMNS.pressure[u.pressure],
		temperature: PRECISION_COLUMNS.temperature[u.temperature],
		wind: PRECISION_COLUMNS.wind[u.wind]
	});
}

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
