import { readDecimal } from './decimal.js';
import { MAX_WIND_DIRECTION_DEGREES, halfTurn } from './windDirection.js';

/** Whether a stored value can be read as a number. Storage can hold any JSON value. */
export const isNumberOrText = (value) => typeof value === 'number' || typeof value === 'string';

const isWindObject = (wind) => wind !== null && typeof wind === 'object' && !Array.isArray(wind);

const shownValue = (value) => (isNumberOrText(value) ? value : '');

/**
 * The wind a page shows, from the wind in storage. Pages and WindInput read this, so a damaged value
 * cannot throw while they render (#118). Storage can hold an object that cannot become text.
 *
 * Calculators must keep the stored value instead. shotWinds gives no result for a stored array,
 * object or boolean (owner decision on #116), and this function would turn those into an empty box,
 * which reads as no wind. The two stay in agreement: where the box is empty for that reason there
 * is no result, and where the whole wind is replaced shotWinds finds no speed, so it uses no wind,
 * as the fallback shows. The unit is read as shotWinds reads it: anything but 'mps' is mph.
 *
 * @param {unknown} stored
 * @param {{ speed: string, speedUnit: string, direction: string }} fallback
 * @returns {{ speed: string|number, speedUnit: string, direction: string|number }}
 */
export function pageWind(stored, fallback) {
	if (!isWindObject(stored)) return { ...fallback };
	const wind = /** @type {any} */ (stored);
	return {
		speed: shownValue(wind.speed),
		speedUnit: wind.speedUnit === 'mps' ? 'mps' : 'mph',
		direction: shownValue(wind.direction)
	};
}

/**
 * The wind to store after a change. Only the changed fields are replaced: a damaged field keeps
 * giving no result until the user sets it, so no result appears for a wind they did not enter.
 *
 * @param {unknown} stored
 * @param {object} patch
 * @param {object} fallback - used when the stored value is not a wind at all
 * @returns {object}
 */
export function patchWind(stored, patch, fallback) {
	return { ...(isWindObject(stored) ? /** @type {object} */ (stored) : fallback), ...patch };
}

/**
 * Convert a stored wind of the old shape, with a directionUnit, to degrees. This runs when the store
 * is imported, so a damaged direction has to pass through: parseInt would throw on an object that
 * cannot become text. Only a missing direction still reads as 12 o'clock, as it always has. The
 * mapping is as it was before #106: 3 o'clock gives 90, which was a wind from the left in the
 * engine's convention. migrateStoredWind then turns it into the shown 270, so the result stays.
 *
 * @param {any} wind
 * @returns {object}
 */
export function migrateClockWind(wind) {
	const { direction } = wind;
	const isClock =
		wind.directionUnit === 'clock' && (isNumberOrText(direction) || direction === undefined);
	return {
		speed: wind.speed,
		speedUnit: wind.speedUnit,
		direction: isClock ? String((parseInt(direction || '12') % 12) * 30) : direction
	};
}

/**
 * Marker of a stored wind whose direction is where the wind comes from, as shown since #106. A wind
 * without it was stored in the engine's convention, and migrateStoredWind converts it once.
 */
export const WIND_FROM_TARGET = 'from-target';

/**
 * A stored direction of the engine's convention, as the direction shown since #106, so that the
 * wind and the result stay the same. A value shotWinds reads gives the angle half a turn away, as
 * text in [0, 360), rounded to 1e-9 degrees so that 0.1 does not turn into 180.10000000000002:
 * '90' gives '270', '-90.5' gives '89.5', '1,5' gives '181.5', '90abc' gives '270'. An empty box
 * was a tailwind (engine 0°) and is now a headwind, so it gives '180', the tailwind. Anything
 * shotWinds rejects (text that is not a number, beyond the direction limit, an array, an object, a
 * boolean, null, missing) stays as it is, so it keeps giving the same result as before.
 *
 * @param {unknown} direction
 * @returns {unknown}
 */
export function shownWindDirection(direction) {
	if (typeof direction === 'string' && direction.trim() === '') return '180';
	if (!isNumberOrText(direction)) return direction;
	const degrees = readDecimal(direction);
	if (!(Math.abs(degrees) <= MAX_WIND_DIRECTION_DEGREES)) return direction;
	return String(Number(halfTurn(degrees).toFixed(9)));
}

/**
 * The stored wind in the convention shown since #106, converted once (owner decision on #106).
 * Stores call this when they are imported. A wind that carries WIND_FROM_TARGET is returned as it
 * is, the same object, so a reload does not turn it back. Otherwise the direction is converted with
 * shownWindDirection and the marker is added; the other fields are kept. A stored value that is not
 * a wind object is returned as it is: there is no direction to convert, and the stores write their
 * default wind, which carries the marker, on the next change.
 *
 * With clock, a wind of the older shape with a directionUnit first goes through migrateClockWind,
 * as the Scope View store always did. Only that store ever stored a clock direction.
 *
 * @param {unknown} stored
 * @param {{ clock?: boolean }} [options]
 * @returns {unknown}
 */
export function migrateStoredWind(stored, { clock = false } = {}) {
	if (!isWindObject(stored)) return stored;
	const wind = /** @type {any} */ (stored);
	if (wind.directionConvention === WIND_FROM_TARGET) return stored;
	const degrees = clock && wind.directionUnit !== undefined ? migrateClockWind(wind) : wind;
	return {
		...degrees,
		direction: shownWindDirection(degrees.direction),
		directionConvention: WIND_FROM_TARGET
	};
}
