/**
 * Units of the compare trajectories chart. Keep in step with Y_AXIS_OPTIONS
 * and getYUnit in the compare trajectories page.
 */
export const Y_AXIS_UNITS = ['in', 'ft', 'yd', 'cm', 'm'];

/**
 * Return a stored y-axis unit if it is an allowed one, otherwise 'in'.
 * The stored value comes from localStorage, so it cannot be trusted.
 * @param {unknown} value
 * @returns {string}
 */
export function normalizeYAxisUnit(value) {
	return Y_AXIS_UNITS.includes(/** @type {string} */ (value)) ? /** @type {string} */ (value) : 'in';
}
