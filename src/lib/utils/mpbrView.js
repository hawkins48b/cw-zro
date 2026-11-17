/**
 * What the MPBR page shows of a calculateMPBR result (#166): the chart markers and the zero the
 * profile would get. Presentation only: every number comes from the result or the profile as it
 * is, nothing is recalculated or rounded differently.
 */
import { isUsableZeroDistance, zeroDistanceValue } from './zeroDistance.js';

/**
 * The four labelled points of the MPBR chart, in the result's units (m and cm, or yd and in).
 *
 * - near: the near zero, on the line of sight. The zero the page saves (optimalZero).
 * - far: the far zero, on the line of sight. The check point.
 * - apex: the highest point of the path (max. ordinate).
 * - end: the end of the point blank range, at the bottom edge of the target zone.
 *
 * A point the result does not have (no far zero, no apex) is left out.
 *
 * @param {object|null} result - calculateMPBR result.
 * @returns {Array<{ id: 'near'|'far'|'apex'|'end', x: number, y: number }>}
 */
export function mpbrChartMarkers(result) {
	if (!result) return [];
	const markers = [];
	const finite = (v) => typeof v === 'number' && Number.isFinite(v);
	if (finite(result.nearZero)) markers.push({ id: 'near', x: result.nearZero, y: 0 });
	if (finite(result.farZero)) markers.push({ id: 'far', x: result.farZero, y: 0 });
	const apex = result.maxOrdinate;
	if (apex && finite(apex.distance) && finite(apex.elevation)) {
		markers.push({ id: 'apex', x: apex.distance, y: apex.elevation });
	}
	if (finite(result.mpbrMax) && result.mpbrMax > 0 && finite(result.halfTarget)) {
		markers.push({ id: 'end', x: result.mpbrMax, y: -result.halfTarget });
	}
	return markers;
}

/**
 * Where a point label sits around its marker. Centred by default; near either end of the x axis a
 * centred label runs over the y axis ticks or past the plot, so it is anchored on the side that
 * faces into the plot (#100).
 *
 * @param {number} x    - The marker's distance.
 * @param {number} maxX - The last distance on the x axis.
 * @returns {'start'|'middle'|'end'}
 */
export function chartLabelAnchor(x, maxX) {
	if (!(maxX > 0)) return 'middle';
	if (x < maxX * 0.15) return 'start';
	if (x > maxX * 0.85) return 'end';
	return 'middle';
}

/**
 * The zero distance change "Set zero to N" makes: before (the profile's zero now) → after (the
 * near zero of the result, in the result's distance unit), and the patch for profiles.update.
 * The patch is the one the page saved before #166 (#110): zeroDist is the number optimalZero.
 *
 * @param {object|null} profile - The active profile.
 * @param {object|null} result  - calculateMPBR result.
 * @returns {{
 *   before: { value: number|null, unit: 'yd'|'m' },
 *   after: { value: number, unit: 'yd'|'m' },
 *   same: boolean,
 *   usable: boolean,
 *   patch: { zeroDist: number, zeroUnit: 'yd'|'m' }
 * } | null}
 *   same: the profile already zeroes there (same value, same unit). usable: the zero can be given
 *   to the engine (isUsableZeroDistance); the page offers no save otherwise (#93).
 */
export function mpbrZeroChange(profile, result) {
	if (!profile || !result || typeof result.optimalZero !== 'number') return null;
	const afterUnit = result.useMetric ? 'm' : 'yd';
	const beforeUnit = profile.zeroUnit === 'm' ? 'm' : 'yd';
	const beforeValue = zeroDistanceValue(profile.zeroDist);
	const before = { value: Number.isFinite(beforeValue) ? beforeValue : null, unit: beforeUnit };
	const after = { value: result.optimalZero, unit: afterUnit };
	return {
		before,
		after,
		same: before.value === after.value && before.unit === after.unit,
		usable: isUsableZeroDistance(result.optimalZero),
		patch: { zeroDist: result.optimalZero, zeroUnit: afterUnit }
	};
}
