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

/** Spacing of the wind dial's touch points, in degrees (#155): 24 points, two per clock hour. */
export const DIAL_SNAP_DEGREES = 15;

/**
 * Inner edge of the wind dial's snapping rim, as a fraction of the dial radius (#155). The touch
 * points sit at 0.86; a tap or drag from here outwards snaps to the nearest point, so a finger
 * does not have to hit the point itself. Inside it the dial sets whole degrees.
 */
export const DIAL_SNAP_RIM = 0.7;

/**
 * The direction set by a tap or drag on the wind dial (#155), in whole degrees, in [0, 360).
 * The offset is from the dial centre in screen pixels (y down); 0° is straight up, clockwise.
 * Display input only: the result goes into the direction box like a typed value.
 *
 * @param {number} dx - Pointer x minus centre x.
 * @param {number} dy - Pointer y minus centre y.
 * @param {number} radius - Dial radius in pixels, > 0.
 * @returns {number}
 */
export function dialDirection(dx, dy, radius) {
	// The centre has no direction (atan2(0, -0) would give 180°).
	if (dx === 0 && dy === 0) return 0;
	let angle = Math.atan2(dx, -dy) * (180 / Math.PI);
	if (angle < 0) angle += 360;
	const onRim = Math.hypot(dx, dy) >= DIAL_SNAP_RIM * radius;
	const step = onRim ? DIAL_SNAP_DEGREES : 1;
	return (Math.round(angle / step) * step) % 360;
}
