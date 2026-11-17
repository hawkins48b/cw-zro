import { readDecimal } from './decimal.js';
import { isUsableRange } from './inputLimits.js';

/**
 * Whether the scope view's stored range can be calculated. The page shows the range message when
 * it cannot, so that an old stored range above MAX_DISTANCE (the box used to allow 9999) is not an
 * empty result without a reason.
 *
 * @param {unknown} distance - the stored range distance
 * @returns {boolean}
 */
export function isUsableScopeRange(distance) {
	return isUsableRange(readDecimal(distance));
}

/** Whether an angle box holds nothing: empty or blank text, null or missing. */
const isEmptyAngle = (angle) =>
	angle === null || angle === undefined || (typeof angle === 'string' && angle.trim() === '');

/** Largest uphill or downhill angle in degrees, not included (#129): its cosine is 0. */
export const MAX_SCOPE_ANGLE_DEG = 90;

/**
 * Whether the angle of the scope view can be used. An empty box is a flat shot in either unit, as
 * before.
 *
 * - A typed cosine (#121) must be finite, above 0 and at most 1: 2 would double the range, -1 would
 *   give a negative one that the calculator turns positive, and Infinity no result, all without a
 *   message.
 * - An angle in degrees (#129) must be finite and strictly between -90 and 90: 90 gave a range of
 *   0, 180 a negative range read as positive, and 360 the full range, all without a message. The
 *   check is on the degrees, not on Math.cos, which gives 6e-17 for 90. Text that is not a number
 *   (NaN) is rejected too; before, it was a flat shot.
 *
 * @param {{ angle: unknown, unit: 'deg'|'cos' } | null} elevation - null when the angle section is closed
 * @returns {boolean}
 */
export function isUsableScopeAngle(elevation) {
	if (!elevation || isEmptyAngle(elevation.angle)) return true;
	const value = readDecimal(elevation.angle);
	if (elevation.unit === 'deg') {
		return Number.isFinite(value) && Math.abs(value) < MAX_SCOPE_ANGLE_DEG;
	}
	return Number.isFinite(value) && value > 0 && value <= 1;
}

/**
 * The horizontal range the scope view calculates: the stored range, times the cosine of the
 * uphill or downhill angle when the angle section is open. Null when the stored range is out of
 * its limits (isUsableScopeRange) or the angle is (isUsableScopeAngle), so the result and the
 * messages agree.
 *
 * @param {{ distance: unknown, unit: string }} range
 * @param {{ angle: unknown, unit: 'deg'|'cos' } | null} elevation - null when the angle section is closed
 * @returns {{ distance: number, unit: string } | null}
 */
export function scopeEffectiveRange(range, elevation) {
	const raw = readDecimal(range.distance);
	if (!isUsableRange(raw)) return null;
	if (!elevation) return { distance: raw, unit: range.unit };
	if (!isUsableScopeAngle(elevation)) return null;
	const angle = readDecimal(elevation.angle);
	const cosAngle = elevation.unit === 'deg' ? Math.cos(((angle || 0) * Math.PI) / 180) : angle || 1;
	return { distance: raw * cosAngle, unit: range.unit };
}
