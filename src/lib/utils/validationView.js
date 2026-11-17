/**
 * What the Trajectory Validation page shows of a calculateTrajectoryValidation result (#166):
 * the profile value before → the validated value after, their difference, the patch Apply saves,
 * and where the observation sits on the chart. Presentation only: the search is not run here and
 * no result is changed.
 */
import { readDecimal } from './decimal.js';

/**
 * Before → after of the solved value, with the difference.
 *
 * @param {object|null} result - calculateTrajectoryValidation result (null or { error } give null).
 * @returns {{
 *   field: 'velocity'|'bc',
 *   before: number,
 *   after: number,
 *   diff: number,
 *   percent: number|null,
 *   same: boolean
 * } | null}
 *   diff is after − before, rounded to the step the search resolves (1 fps or m/s → shown to
 *   0.1 so a decimal profile velocity is not hidden; 0.001 for a BC). percent is diff / before,
 *   in %, to 0.1; null when before is 0.
 */
export function validationChange(result) {
	if (!result || result.error) return null;
	const isVelocity = result.solveFor !== 'bc';
	const before = isVelocity ? result.initialVelocity : result.initialBc;
	const after = isVelocity ? result.validatedVelocity : result.validatedBc;
	if (!Number.isFinite(before) || !Number.isFinite(after)) return null;
	const scale = isVelocity ? 10 : 1000;
	const diff = Math.round((after - before) * scale) / scale;
	const percent = before !== 0 ? Math.round(((after - before) / before) * 1000) / 10 : null;
	return {
		field: isVelocity ? 'velocity' : 'bc',
		before,
		after,
		diff,
		percent,
		same: diff === 0
	};
}

/**
 * The profile patch Apply saves: the one the page saved before #166, a string like the form's.
 *
 * @param {object|null} result
 * @returns {{ velocity: string } | { bc: string } | null}
 */
export function validationPatch(result) {
	if (!result || result.error) return null;
	return result.solveFor === 'bc'
		? { bc: String(result.validatedBc) }
		: { velocity: String(result.validatedVelocity) };
}

/**
 * The observation on the chart: x is the observation range (in its own unit, the chart's x unit),
 * y the observed value with its side, as the search's goal: below the line of sight is negative.
 * The magnitude is rounded to 0.1, as the search rounds it.
 *
 * @param {number|string} rangeDistance
 * @param {number|string} measureValue - Its sign is ignored.
 * @param {'below'|'above'} direction
 * @returns {{ x: number, y: number } | null}
 */
export function validationObservationPoint(rangeDistance, measureValue, direction) {
	const x = readDecimal(rangeDistance);
	const value = readDecimal(measureValue);
	if (!Number.isFinite(x) || x <= 0 || !Number.isFinite(value) || value === 0) return null;
	const magnitude = Math.round(Math.abs(value) * 10) / 10;
	return { x, y: direction === 'above' ? magnitude : -magnitude };
}
