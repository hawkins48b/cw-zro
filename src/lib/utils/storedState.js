/**
 * Reading the stored state of the Scope View, Ballistic and compare pages (#120).
 *
 * localStorage can hold any JSON value, so each stored field is checked when it is read, and a
 * page only sees a usable shape. The rule for a damaged field, one that is not a number or text
 * where a number or text belongs:
 *
 * - It is read as an empty box. An empty range, atmosphere value or humidity gives no result, as a
 *   damaged value did (or the page threw), so no result appears for a value the user did not enter,
 *   and the page shows its message under the box.
 * - A damaged section (`range`, `atmosphere`, `elevation`) is read as a section of empty boxes, for
 *   the same reason. The atmosphere is then a custom one, not the standard one.
 * - Units are read as the calculators read them: `m`, `hpa`, `c` and `deg`, anything else is the
 *   other unit.
 * - Display settings (the Ballistic `options`) fall back to their defaults: they change no result.
 *
 * The page and the calculators read the same value, so what the page shows and the result agree.
 * The wind is not read here: see storedWind.js.
 */
import { isNumberOrText } from './storedWind.js';

/** Whether a stored value is an object with fields: not null, not an array. */
export const isRecord = (value) => value !== null && typeof value === 'object' && !Array.isArray(value);

/** The stored state as an object, or an empty one when the whole value is damaged. */
export const storedObject = (value) => (isRecord(value) ? /** @type {Record<string, any>} */ (value) : {});

/**
 * A stored number or text as it is, anything else as an empty box.
 * @param {unknown} value
 * @returns {string|number}
 */
export const storedText = (value) => (isNumberOrText(value) ? /** @type {string|number} */ (value) : '');

/**
 * A stored range. A distance that is not a number or text is an empty box, which no calculator
 * takes: the page shows its range message and no result. The unit is `m` or else `yd`, as the
 * calculators read it.
 *
 * The Ballistic step is read the same way. An empty step is 25, as the box's placeholder says,
 * and the step only chooses the rows of the table: no calculated value depends on it.
 *
 * @param {unknown} stored
 * @param {{ step?: boolean }} [options] - step: also read the Ballistic table step
 * @returns {{ distance: string|number, unit: 'yd'|'m', step?: string|number }}
 */
export function storedRange(stored, { step = false } = {}) {
	const range = storedObject(stored);
	const read = { distance: storedText(range.distance), unit: range.unit === 'm' ? 'm' : 'yd' };
	return step ? { ...read, step: storedText(range.step) } : read;
}

/**
 * A stored atmosphere. `useISA` is read as the pages read it, true for any truthy value. A value
 * that is not a number or text is an empty box: an empty box is out of its limits, so the box shows
 * its message and there is no result, as with the damaged value. A damaged atmosphere is a custom
 * one with empty boxes, not the standard atmosphere, so that no result appears for air the user
 * did not choose. Choosing the standard atmosphere again restores it.
 *
 * @param {unknown} stored
 * @returns {{ useISA: boolean, altitude: string|number, altitudeUnit: 'ft'|'m', pressure: string|number,
 *   pressureUnit: 'inhg'|'hpa', temperature: string|number, temperatureUnit: 'f'|'c', humidity: string|number }}
 */
export function storedAtmosphere(stored) {
	const atmosphere = storedObject(stored);
	return {
		useISA: Boolean(atmosphere.useISA),
		altitude: storedText(atmosphere.altitude),
		altitudeUnit: atmosphere.altitudeUnit === 'm' ? 'm' : 'ft',
		pressure: storedText(atmosphere.pressure),
		pressureUnit: atmosphere.pressureUnit === 'hpa' ? 'hpa' : 'inhg',
		temperature: storedText(atmosphere.temperature),
		temperatureUnit: atmosphere.temperatureUnit === 'c' ? 'c' : 'f',
		humidity: storedText(atmosphere.humidity)
	};
}

/**
 * The stored uphill or downhill angle of the Scope View. A damaged angle is an empty box, which is a
 * flat shot in either unit, as a damaged angle already was (it read as NaN, then 0 in degrees or 1
 * as a cosine). The unit is `deg` or else a cosine, as scopeEffectiveRange reads it, so a missing or
 * damaged unit changes no result: `30` without a unit stays a cosine of 30, which gives no result,
 * and `0.9` stays a cosine of 0.9. The page then marks the cosine chip, and isUsableScopeAngle shows
 * the cosine message where a cosine is out of its limits.
 *
 * @param {unknown} stored
 * @returns {{ angle: string|number, unit: 'deg'|'cos' }}
 */
export function storedElevation(stored) {
	const elevation = storedObject(stored);
	return { angle: storedText(elevation.angle), unit: elevation.unit === 'deg' ? 'deg' : 'cos' };
}

/** The cant the Scope View slider can set, in degrees either way. */
export const MAX_ROTATION = 90;

/**
 * The stored reticle rotation (cant) of the Scope View, in degrees. Only a finite number within the
 * slider's range is used. Anything else is no cant, so the slider, the reticle and the result all
 * show 0: before #120, `true` or `[1]` gave a 1° cant the user did not set, and a value past 90°
 * a cant the slider could not show.
 *
 * @param {unknown} stored
 * @returns {number}
 */
export function storedRotation(stored) {
	return typeof stored === 'number' && Number.isFinite(stored) && Math.abs(stored) <= MAX_ROTATION
		? stored
		: 0;
}

/**
 * The stored display options of the Ballistic page. They change no result, so a damaged option
 * falls back to its default. A flag must be a boolean; the columns must be a list, and only its
 * texts are kept; the velocity chart unit is `mps` or else `fps`.
 *
 * @param {unknown} stored
 * @param {{ showAtmosphere: boolean, showWind: boolean, showVelocityChart: boolean,
 *   showAnnotations: boolean, visibleColumns: string[], velChartUnit: string }} defaults
 * @returns {typeof defaults}
 */
export function storedBallisticOptions(stored, defaults) {
	const options = storedObject(stored);
	const flag = (key) => (typeof options[key] === 'boolean' ? options[key] : defaults[key]);
	return {
		showAtmosphere: flag('showAtmosphere'),
		showWind: flag('showWind'),
		showVelocityChart: flag('showVelocityChart'),
		showAnnotations: flag('showAnnotations'),
		visibleColumns: Array.isArray(options.visibleColumns)
			? options.visibleColumns.filter((column) => typeof column === 'string')
			: [...defaults.visibleColumns],
		velChartUnit: options.velChartUnit === 'mps' ? 'mps' : 'fps'
	};
}
