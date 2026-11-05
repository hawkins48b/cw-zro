import { Unit } from 'js-ballistics';

/**
 * How far the cards look for zero crossings, in yd or m, past the 500 units they print. The same
 * limit as calculateFullTrajectory. A crossing beyond it stays blank on the card.
 */
export const ZERO_SEARCH_RANGE = 3000;

/**
 * Steepest zero elevation worth following, in radians. Beyond about 0.6 rad a bullet is near its
 * maximum range, so no real zero needs more.
 */
const MAX_ZERO_ELEVATION = 0.6;

/**
 * Whether a solved zero elevation is safe to fly out to ZERO_SEARCH_RANGE. The zero solver can
 * return NaN or a near vertical elevation without an error on absurd inputs. Such a bullet climbs
 * above the altitude where the atmosphere gives NaN, and the engine then never returns, which no
 * try/catch can stop.
 *
 * @param {Angular} elevation - weapon.zeroElevation after setWeaponZero
 * @returns {boolean}
 */
export function isFlyableZeroElevation(elevation) {
	return Math.abs(elevation.In(Unit.Radian)) <= MAX_ZERO_ELEVATION;
}

/**
 * Near and far zero crossings of a shot, in the given distance unit, read between the two rows
 * around each crossing. Pass rows with extraData: those add a row just past each crossing, so an
 * arc narrower than the step is not lost and the reading does not depend on the step.
 *
 * near is null when the muzzle is not below the line of sight, as with a sight height of 0, and
 * either is null when the rows end before that crossing. Null means blank on the card.
 *
 * @param {TrajectoryData[]|null} trajectory
 * @param {object} distanceUnit - Unit.Yard or Unit.Meter
 * @returns {{ near: number|null, far: number|null }}
 */
export function findZeroCrossings(trajectory, distanceUnit) {
	const crossings = { near: null, far: null };
	if (!trajectory || trajectory.length === 0) return crossings;

	const height = (p) => p.targetDrop.In(Unit.Millimeter);
	const crossing = (a, b) => {
		const x = a.distance.In(distanceUnit);
		return x + (height(a) / (height(a) - height(b))) * (b.distance.In(distanceUnit) - x);
	};

	let rising = height(trajectory[0]) < 0;
	for (let i = 1; i < trajectory.length; i++) {
		const [prev, curr] = [trajectory[i - 1], trajectory[i]];
		if (rising && height(curr) >= 0) {
			crossings.near = crossing(prev, curr);
			rising = false;
		} else if (!rising && height(curr) < 0) {
			crossings.far = crossing(prev, curr);
			break;
		}
	}
	return crossings;
}
