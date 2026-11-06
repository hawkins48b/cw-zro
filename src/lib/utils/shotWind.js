import { UNew, Unit, Wind } from 'js-ballistics';
import { isNumberOrText } from './storedWind.js';

/**
 * Fastest wind the engine is given, in m/s: about 224 mph (owner decision on #116).
 *
 * A finite speed can hang the engine as surely as Infinity. From about 400000 mph, winds at 0° and
 * 90° ran until killed while 45° did not, and at 1e140 all three did. Some speeds between those
 * return, so a check for overflow would not be enough. Up to 4000 mph nothing hung, in the standard atmosphere on loads
 * from 60 to 4000 fps and BC 0.02 to 2. That is all this limit shows: a wind under it can still hang
 * on an absurd atmosphere or BC, as Remaining gaps in docs/ballistics-model.md lists.
 */
const MAX_WIND_SPEED_MPS = 100;

/**
 * Largest wind direction accepted, in degrees either way. It cannot hang the engine, which only
 * takes its sin and cos. But the angle loses precision, and from 1e100 it has no meaning while the
 * result still looks normal. No one enters this many turns, so it gives no result instead.
 */
const MAX_WIND_DIRECTION_DEGREES = 1e6;

/**
 * The winds array of a Shot, from the wind of a screen or of storage. Call this before the engine.
 *
 * A NaN or infinite direction, or an infinite speed, gives a NaN wind vector. The zero solve still
 * returns a finite elevation, so hasFiniteElevation does not see it, and fire then never ends, which
 * try/catch cannot stop.
 *
 * | Speed                                     | Direction                   | Result                 |
 * |-------------------------------------------|-----------------------------|------------------------|
 * | Empty, text, 0, negative, null, missing   | Anything                    | [], no wind            |
 * | Array, object, boolean                    | Anything                    | null                   |
 * | Above MAX_WIND_SPEED_MPS, or infinite     | Anything                    | null                   |
 * | Above 0                                   | Empty or whitespace string  | One wind at 0°         |
 * | Above 0                                   | Text or not finite          | null                   |
 * | Above 0                                   | Not a number or string      | null                   |
 * | Above 0                                   | Over 1e6 degrees either way | null                   |
 * | Above 0                                   | Finite number or string     | One wind at that angle |
 *
 * Only an empty box counts as 0°, to match its placeholder and the dial (owner decision on #116).
 * A missing direction does not: the box always sends a string, so null or undefined is a damaged
 * value. Only a number or a string is read at all: parseFloat alone would read the array [90] as 90,
 * and throw on an object that cannot become text. A stored speed of any other shape gives no result
 * rather than no wind, because the page can still show it as a speed (owner decision on #116). Text is read as parseFloat reads it, as the dial
 * does, so '90abc' stays 90.
 *
 * @param {object|null} [wind] - { speed, speedUnit: 'mph'|'mps', direction }
 * @returns {Wind[]|null} the winds of the shot, or null when no shot can be calculated
 */
export function shotWinds(wind) {
	if (!wind || wind.speed === null || wind.speed === undefined) return [];
	if (!isNumberOrText(wind.speed)) return null;
	const speed = parseFloat(wind.speed);
	if (!(speed > 0)) return [];

	const velocity = wind.speedUnit === 'mps' ? UNew.MPS(speed) : UNew.MPH(speed);
	if (!(velocity.In(Unit.MPS) <= MAX_WIND_SPEED_MPS)) return null;

	const { direction } = wind;
	if (!isNumberOrText(direction)) return null;
	const isEmpty = typeof direction === 'string' && direction.trim() === '';
	const degrees = isEmpty ? 0 : parseFloat(direction);
	if (!(Math.abs(degrees) <= MAX_WIND_DIRECTION_DEGREES)) return null;

	return [new Wind({ velocity, directionFrom: UNew.Degree(degrees) })];
}
