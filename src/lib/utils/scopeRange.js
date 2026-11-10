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

/**
 * Whether the angle of the scope view can be used (#121). An angle in degrees always can, as
 * before. A typed cosine must be finite, above 0 and at most 1: 2 would double the range, -1 would
 * give a negative one that the calculator turns positive, and Infinity no result, all without a
 * message. An empty box is a flat shot in either unit, as before.
 *
 * @param {{ angle: unknown, unit: 'deg'|'cos' } | null} elevation - null when the angle section is closed
 * @returns {boolean}
 */
export function isUsableScopeAngle(elevation) {
	if (!elevation || elevation.unit !== 'cos' || isEmptyAngle(elevation.angle)) return true;
	const cosine = readDecimal(elevation.angle);
	return Number.isFinite(cosine) && cosine > 0 && cosine <= 1;
}

/**
 * The horizontal range the scope view calculates: the stored range, times the cosine of the
 * uphill or downhill angle when the angle section is open. Null when the stored range is out of
 * its limits (isUsableScopeRange) or the typed cosine is (isUsableScopeAngle), so the result and
 * the messages agree.
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
