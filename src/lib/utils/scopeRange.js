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

/**
 * The horizontal range the scope view calculates: the stored range, times the cosine of the
 * uphill or downhill angle when the angle section is open. Null when the stored range is out of
 * its limits (isUsableScopeRange), so the result and the message agree.
 *
 * @param {{ distance: unknown, unit: string }} range
 * @param {{ angle: unknown, unit: 'deg'|'cos' } | null} elevation - null when the angle section is closed
 * @returns {{ distance: number, unit: string } | null}
 */
export function scopeEffectiveRange(range, elevation) {
	const raw = readDecimal(range.distance);
	if (!isUsableRange(raw)) return null;
	if (!elevation) return { distance: raw, unit: range.unit };
	const angle = readDecimal(elevation.angle);
	const cosAngle = elevation.unit === 'deg' ? Math.cos(((angle || 0) * Math.PI) / 180) : angle || 1;
	return { distance: raw * cosAngle, unit: range.unit };
}
