import { Unit } from 'js-ballistics';

/**
 * Smallest zero distance the engine is given, in the unit it was entered in (yd or m).
 *
 * No real zero is this close. On 0 and on values just above it (1e-310 did) js-ballistics returns
 * a NaN elevation from setWeaponZero, and fire then never ends, which try/catch cannot stop. From
 * there up to about 1e-6 it solves to absurd elevations or fails afterwards. From 0.001 to 0.1
 * every reference load gave no result, and 0.15 solved for some. This floor stops the hang and the
 * absurd values and stays below the zeros that solve.
 */
export const MIN_ZERO_DISTANCE = 0.001;

/**
 * Whether a zero distance can be given to the engine. Call this before setWeaponZero.
 *
 * A negative value is usable: the calculators take its absolute value. Empty text gives NaN, and
 * the engine does not reject NaN or Infinity: it returns elevation 0, which plots as a believable
 * trajectory from an unzeroed barrel.
 *
 * @param {*} value - a stored or typed zero distance. Storage can hold any JSON value.
 * @returns {boolean}
 */
export function isUsableZeroDistance(value) {
	if (typeof value !== 'number' && typeof value !== 'string') return false;
	const zero = Math.abs(parseFloat(value));
	return Number.isFinite(zero) && zero >= MIN_ZERO_DISTANCE;
}

/**
 * Whether a solved shot can be fired. Call this between setWeaponZero and fire.
 *
 * The solver can return NaN without an error, as it does on an infinite cant angle, and fire then
 * never ends: every exit check in the engine is false with NaN. This reads the elevation the engine
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
