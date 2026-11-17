import { Unit } from 'js-ballistics';
import { readDecimal } from './decimal.js';
import { MAX_DISTANCE } from './inputLimits.js';

/**
 * Smallest zero distance the engine is given, in the unit it was entered in (yd or m). Owner
 * decision on #114, 2026-11-10.
 *
 * On 0 and on values just above it (1e-310 did) js-ballistics returns a NaN elevation from
 * setWeaponZero, and fire then never ends, which try/catch cannot stop. From there up to about 1e-6
 * it solves to absurd elevations or fails afterwards. From 0.001 to 0.1 every reference load gave no
 * result after about a second of blocked page, and 0.15 solved for some. Hangs were measured with a
 * sight height about as large as the zero or larger (20 in with a 0.5 zero), which the sight height
 * limit of 10 in and this floor rule out. No real zero is closer than 1 yd or 1 m.
 *
 * Those were measured on js-ballistics 2.2. On 3.1 (#77) a zero of 0, 1e-310 or 0.001 solves to an
 * elevation of 0 and returns, an unzeroed barrel: no hang, but no meaningful result either.
 */
export const MIN_ZERO_DISTANCE = 1;

/** Largest zero distance, in the unit entered: the range limit of every calculator (#93). */
export const MAX_ZERO_DISTANCE = MAX_DISTANCE;

/**
 * The zero distance as the calculators read it: its absolute value, with a comma read as a decimal
 * point. NaN when it is not a number or text.
 *
 * @param {*} value
 * @returns {number}
 */
export function zeroDistanceValue(value) {
	if (typeof value !== 'number' && typeof value !== 'string') return NaN;
	return Math.abs(readDecimal(value));
}

/**
 * Whether a zero distance can be given to the engine. Call this before setWeaponZero.
 *
 * A negative value is usable: the calculators take its absolute value. Empty text gives NaN, and
 * the engine does not reject NaN or Infinity: it returns elevation 0, which plots as a believable
 * trajectory from an unzeroed barrel. The value must lie from MIN_ZERO_DISTANCE to
 * MAX_ZERO_DISTANCE.
 *
 * @param {*} value - a stored or typed zero distance. Storage can hold any JSON value.
 * @returns {boolean}
 */
export function isUsableZeroDistance(value) {
	const zero = zeroDistanceValue(value);
	return zero >= MIN_ZERO_DISTANCE && zero <= MAX_ZERO_DISTANCE;
}

/**
 * Whether a solved shot can be fired. Call this between setWeaponZero and fire.
 *
 * The solver can return NaN without an error, as js-ballistics 2.2 did on an infinite cant angle,
 * and fire then never ends: every exit check in the engine is false with NaN. On 3.1 (#77) an
 * infinite or NaN cant hangs the zero solve itself, so calculateShotPoint checks the cant first. This reads the elevation the engine
 * flies, which adds the cant to weapon.zeroElevation. It only rejects values that are not finite,
 * so it changes no result.
 *
 * A finite elevation does not make a shot safe. When a NaN only appears during the flight, the
 * solver stops on the elevation it started from, usually 0, and fire still hangs. A NaN sight height
 * does that, so it has its own check before the solve. Other inputs need their own checks too.
 *
 * @param {Shot} shot
 * @returns {boolean}
 */
export function hasFiniteElevation(shot) {
	return Number.isFinite(shot.barrelElevation.In(Unit.Radian));
}
