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
 * cannot become text. The mapping is as it was, whatever #106 finds about it.
 *
 * @param {any} wind
 * @returns {object}
 */
export function migrateClockWind(wind) {
	const { direction } = wind;
	const isClock = wind.directionUnit === 'clock' && (isNumberOrText(direction) || !direction);
	return {
		speed: wind.speed,
		speedUnit: wind.speedUnit,
		direction: isClock ? String((parseInt(direction || '12') % 12) * 30) : direction
	};
}
