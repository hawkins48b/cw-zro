import { TrajFlag, Unit } from 'js-ballistics';

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
 * Near and far zero crossings of a shot, in the given distance unit. Pass rows with EVENT_ROWS
 * (ballisticEngine.js): js-ballistics 3 then adds a row exactly at each crossing, flagged ZERO_UP or
 * ZERO_DOWN, and that row's distance is the crossing. So an arc narrower than the step is not lost
 * and the reading does not depend on the step. Without a flag, the crossing is read between the two
 * rows around it.
 *
 * The flag matters at the end of the rows (#77): a zero at the search range, such as 3000, is solved
 * so exactly that the height of its crossing row is about 1e-13 in either way, so the sign alone
 * would print it on some loads and leave it blank on others.
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

	const height = (p) => p.slantHeight.In(Unit.Millimeter);
	const crossing = (a, b) => {
		const x = a.distance.In(distanceUnit);
		return x + (height(a) / (height(a) - height(b))) * (b.distance.In(distanceUnit) - x);
	};

	const flagged = (p, flag) => (p.flag & flag) !== 0;
	const at = (prev, curr, flag) => (flagged(curr, flag) ? curr.distance.In(distanceUnit) : crossing(prev, curr));

	let rising = height(trajectory[0]) < 0;
	for (let i = 1; i < trajectory.length; i++) {
		const [prev, curr] = [trajectory[i - 1], trajectory[i]];
		if (rising && (height(curr) >= 0 || flagged(curr, TrajFlag.ZERO_UP))) {
			crossings.near = at(prev, curr, TrajFlag.ZERO_UP);
			rising = false;
		} else if (!rising && (height(curr) < 0 || flagged(curr, TrajFlag.ZERO_DOWN))) {
			crossings.far = at(prev, curr, TrajFlag.ZERO_DOWN);
			break;
		}
	}
	return crossings;
}
