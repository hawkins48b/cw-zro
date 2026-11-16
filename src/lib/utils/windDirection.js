/**
 * Wind direction conventions (#106).
 *
 * The app shows and stores where the wind comes FROM, in degrees clockwise from the target, as a
 * shooter reads a clock: 0° from the target (headwind), 90° from the right, 180° from behind
 * (tailwind), 270° from the left. The engine (js-ballistics `Wind.directionFrom`, vector
 * (cos, 0, sin)) reads 0° as a tailwind and 90° as a wind from the left. The two are half a turn
 * apart: engine angle = shown angle + 180°.
 *
 * Before #106 the app gave the shown angle to the engine unchanged, so stored directions are in the
 * engine's convention until storedWind.js converts them once.
 */

/**
 * Largest wind direction accepted, in degrees either way. It cannot hang the engine, which only
 * takes its sin and cos. But the angle loses precision, and from 1e100 it has no meaning while the
 * result still looks normal. No one enters this many turns, so it gives no result instead. It is
 * checked on the angle the user entered, before the half turn.
 */
export const MAX_WIND_DIRECTION_DEGREES = 1e6;

/**
 * The same direction seen from the other end, half a turn away, in [0, 360). It turns a shown
 * angle into the engine's angle, and an engine angle into a shown angle: the half turn is its own
 * inverse. Whole degrees come out exact, so 270 gives 90 and 90 gives 270.
 *
 * @param {number} degrees - finite
 * @returns {number}
 */
export function halfTurn(degrees) {
	return (((degrees % 360) + 540) % 360);
}

/**
 * The hour on a shooter's clock for a shown direction (where the wind comes from, #106), for the
 * hint under the Scope View direction field (#148): 0° is 12 o'clock, 90° is 3, 180° is 6, 270° is
 * 9. Rounded to the nearest hour, so 15° to 44.9° is 1 o'clock. Display only: the engine never
 * reads it. Null for a value readDecimal-style parsing would not give a finite number.
 *
 * @param {number} degrees
 * @returns {number|null} 1 to 12
 */
export function clockHour(degrees) {
	if (typeof degrees !== 'number' || !Number.isFinite(degrees)) return null;
	const turned = ((degrees % 360) + 360) % 360;
	const hour = Math.round(turned / 30) % 12;
	return hour === 0 ? 12 : hour;
}
