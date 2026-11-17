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
 *   the same reason. A missing Ballistic `elevation` (saved before #173) is 0°. The atmosphere is then a custom one, not the standard one.
 * - Units are read as the calculators read them: `m`, `hpa`, `c` and `deg`, anything else is the
 *   other unit.
 * - Display settings (the Ballistic `options`) fall back to their defaults: they change no result.
 *
 * The page and the calculators read the same value, so what the page shows and the result agree.
 * The wind is not read here: see storedWind.js.
 */
import { isNumberOrText } from './storedWind.js';
import {
	DEFAULT_PRESSURE_REF,
	DEFAULT_WEATHER,
	accurateStationAtmosphere,
	isAtmosphereMode,
	isPressureRef,
	isWeather
} from './scopeAtmosphere.js';

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

/** The angle of a page that has never stored one: 0°, a flat shot (#173). */
export const DEFAULT_ELEVATION = Object.freeze({ angle: '0', unit: 'deg' });

/**
 * The stored uphill or downhill angle of the Ballistic page (#173). State saved before #173 has no
 * angle (missing or null): it reads as 0°, the flat table it always gave, with the degree chip.
 * Anything else is read as the Scope View reads its angle (storedElevation): a damaged section is an
 * empty box, which is a flat shot too, and a damaged angle an empty box.
 *
 * @param {unknown} stored
 * @returns {{ angle: string|number, unit: 'deg'|'cos' }}
 */
export function storedBallisticElevation(stored) {
	return stored === undefined || stored === null ? { ...DEFAULT_ELEVATION } : storedElevation(stored);
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
 * texts are kept; the velocity chart unit is `mps` or else `fps`; the chart shown (#151) is
 * `velocity` or else `drop`.
 *
 * The flags `showAtmosphere`, `showWind` and `showVelocityChart` of before #151 opened sections the
 * page no longer has: they are not read, and the next change of an option drops them.
 *
 * @param {unknown} stored
 * @param {{ showAnnotations: boolean, visibleColumns: string[], velChartUnit: string,
 *   chartMode: 'drop'|'velocity' }} defaults
 * @returns {typeof defaults}
 */
export function storedBallisticOptions(stored, defaults) {
	const options = storedObject(stored);
	return {
		showAnnotations: typeof options.showAnnotations === 'boolean' ? options.showAnnotations : defaults.showAnnotations,
		visibleColumns: Array.isArray(options.visibleColumns)
			? options.visibleColumns.filter((column) => typeof column === 'string')
			: [...defaults.visibleColumns],
		velChartUnit: options.velChartUnit === 'mps' ? 'mps' : 'fps',
		chartMode: options.chartMode === 'velocity' ? 'velocity' : 'drop'
	};
}

/**
 * The stored target of the MPBR page (#127). A size that is not a number or text is an empty box:
 * the Calculate button stays off, so there is no result, as there was none or the page threw. An
 * array is not read as a number, as in storedRange. The unit is `cm` or else `in`, as calculateMPBR
 * reads it.
 *
 * @param {unknown} stored
 * @returns {{ size: string|number, unit: 'in'|'cm' }}
 */
export function storedMpbrTarget(stored) {
	const target = storedObject(stored);
	return { size: storedText(target.size), unit: target.unit === 'cm' ? 'cm' : 'in' };
}

/**
 * The stored observation of the Trajectory Validation page (#127). Each choice is read as
 * calculateTrajectoryValidation reads it: the type is `distance` or else `angle`, the distance unit
 * `cm` or else `in`, the angle unit `mrad` or else `moa`, and the direction `above` or else `below`
 * (state saved before the direction existed has none). A value that is not a number or text is an
 * empty box, which gives no result. A damaged section is a section of empty boxes.
 *
 * @param {unknown} stored
 * @returns {{ type: 'angle'|'distance', direction: 'below'|'above', distanceValue: string|number,
 *   distanceUnit: 'in'|'cm', angleValue: string|number, angleUnit: 'moa'|'mrad' }}
 */
export function storedValidationMeasure(stored) {
	const measure = storedObject(stored);
	return {
		type: measure.type === 'distance' ? 'distance' : 'angle',
		direction: measure.direction === 'above' ? 'above' : 'below',
		distanceValue: storedText(measure.distanceValue),
		distanceUnit: measure.distanceUnit === 'cm' ? 'cm' : 'in',
		angleValue: storedText(measure.angleValue),
		angleUnit: measure.angleUnit === 'mrad' ? 'mrad' : 'moa'
	};
}

/**
 * What the Trajectory Validation page solves for (#127): `bc`, or else the muzzle velocity, the
 * default. Before, the calculation solved for the BC on any value but `velocity`, while the chart
 * and the Apply button took any value but `bc` as velocity, so a damaged value could save an
 * `undefined` velocity to the profile. Now all of them read the same choice.
 *
 * @param {unknown} stored
 * @returns {'velocity'|'bc'}
 */
export const storedSolveFor = (stored) => (stored === 'bc' ? 'bc' : 'velocity');

/**
 * The stored atmosphere of the Trajectory Validation page (#127). State saved before the field
 * existed has none, and the page read a missing or `null` atmosphere as the standard one: that is
 * kept, so no result changes. Anything else is read by storedAtmosphere: a section that is not an
 * object is a custom atmosphere with empty boxes, which gives no result.
 *
 * @param {unknown} stored
 * @param {ReturnType<typeof storedAtmosphere>} standard - the standard atmosphere of the page
 * @returns {ReturnType<typeof storedAtmosphere>}
 */
export function storedValidationAtmosphere(stored, standard) {
	return stored === undefined || stored === null ? { ...standard } : storedAtmosphere(stored);
}

/**
 * The stored atmosphere of the Scope View and Ballistic pages as stored, before the conversion of
 * #172: the boxes, mode, weather and pressure reference. See storedScopeAtmosphere.
 *
 * @param {unknown} stored
 * @returns {ReturnType<typeof storedAtmosphere> & { mode: 'isa'|'estimate'|'accurate',
 *   weather: 'sunny'|'cloudy'|'rain'|'snow', pressureRef: 'qnh'|'station' }}
 */
function readScopeAtmosphere(stored) {
	const atmosphere = storedObject(stored);
	const boxes = storedAtmosphere(atmosphere);
	const mode = isAtmosphereMode(atmosphere.mode) ? atmosphere.mode : boxes.useISA ? 'isa' : 'accurate';
	return {
		...boxes,
		useISA: mode === 'isa',
		mode,
		weather: isWeather(atmosphere.weather) ? atmosphere.weather : DEFAULT_WEATHER,
		pressureRef: isPressureRef(atmosphere.pressureRef) ? atmosphere.pressureRef : DEFAULT_PRESSURE_REF
	};
}

/**
 * The stored atmosphere of the Scope View (#148): the boxes as storedAtmosphere reads them, plus
 * the mode, the weather of the estimate mode and the pressure reference.
 *
 * State saved before #148 has no mode: `useISA` gives `isa`, anything else `accurate` with `qnh`,
 * which is what the page computed then. A mode that is not one of the three is read the same way,
 * from `useISA`, so a damaged mode gives the atmosphere the page used before. A damaged section is a
 * custom atmosphere of empty boxes, as in storedAtmosphere, so no result appears for air the user
 * did not choose. The weather is `cloudy` and the pressure reference `qnh` unless one of the others
 * is stored. `useISA` is read back from the mode, so the two always agree.
 *
 * Since #172 the Accurate mode is always station pressure: an Accurate state with `qnh` is read with
 * its pressure converted to station pressure at its saved altitude and `pressureRef` `station`
 * (accurateStationAtmosphere), so its result stays the same up to the rounding of the box. Reading
 * writes nothing; the next change on the card stores the converted values, after which the state
 * reads as it is.
 *
 * @param {unknown} stored
 * @returns {ReturnType<typeof readScopeAtmosphere>}
 */
export function storedScopeAtmosphere(stored) {
	return accurateStationAtmosphere(readScopeAtmosphere(stored));
}

/**
 * The stored result mode of the Scope View (#148): `hold` shows the reticle, anything else, or
 * nothing, is `dial`. It changes no result.
 *
 * @param {unknown} stored
 * @returns {'dial'|'hold'}
 */
export const storedResultMode = (stored) => (stored === 'hold' ? 'hold' : 'dial');

/**
 * The standard atmosphere as the Scope View and Ballistic stores write it: the default boxes (sea
 * level, 29.92 inHg, 59 °F, 0 %), the mode, weather and pressure reference (#148, #151). useISA is
 * kept beside the mode, so state written now reads the same in a build from before #148 or #151.
 * The pressure reference is `station` since #172: the Accurate pressure box is station pressure.
 */
export const ISA_ATMOSPHERE = Object.freeze({
	useISA: true,
	mode: 'isa',
	weather: DEFAULT_WEATHER,
	pressureRef: 'station',
	altitude: '0',
	altitudeUnit: 'ft',
	pressure: '29.92',
	pressureUnit: 'inhg',
	temperature: '59',
	temperatureUnit: 'f',
	humidity: '0'
});

/**
 * The atmosphere to store after a change on the atmosphere card, for the Scope View (#148) and
 * Ballistic (#151) stores. `useISA: true` resets it to the standard atmosphere, as before #148;
 * `useISA: false` is the accurate mode. A `mode` changes the mode only: the boxes are kept, so
 * switching back shows what the user entered. A mode that is not one of the three keeps the
 * current one. useISA is written to match the mode.
 *
 * @param {ReturnType<typeof storedScopeAtmosphere>} current - the atmosphere as the store reads it
 * @param {Record<string, unknown>} patch
 * @returns {Record<string, unknown>}
 */
export function patchedAtmosphere(current, patch) {
	if (patch.useISA === true) return { ...ISA_ATMOSPHERE };
	const { useISA, ...rest } = patch;
	const next = { ...current, ...rest };
	if (useISA === false && rest.mode === undefined) next.mode = 'accurate';
	if (!isAtmosphereMode(next.mode)) next.mode = current.mode;
	next.useISA = next.mode === 'isa';
	return next;
}

/**
 * The stored atmosphere of the Ballistic page (#151): read as on the Scope View
 * (storedScopeAtmosphere), with two differences for state saved before #151, which has no mode.
 *
 * - Before #151 the page used the sea-level standard atmosphere (`null`) whenever `useISA` was on,
 *   whatever the boxes held: the boxes were hidden, and choosing the standard atmosphere reset them
 *   to altitude 0. The ISA mode now uses the altitude, so a saved ISA state is read at altitude 0,
 *   which gives `null` again. Normal use only ever saved altitude 0 with useISA; this covers a state
 *   edited by hand or damaged in the altitude only.
 * - Before #151 the page read its atmosphere with storedAtmosphere, which drops `pressureRef`, so
 *   the pressure was always QNH. A `pressureRef` in such a state (edited by hand) is read as `qnh`
 *   (security review of #151).
 *
 * Then, as on the Scope View, an Accurate state with QNH is converted to station pressure at its
 * saved altitude (#172): a custom state saved before #151 is therefore always converted, whatever
 * `pressureRef` it holds, since the page always read it as QNH.
 *
 * So every saved result stays the same, up to the rounding of the converted box. Reading writes
 * nothing; the next change stores these values with the mode.
 *
 * @param {unknown} stored
 * @returns {ReturnType<typeof storedScopeAtmosphere>}
 */
export function storedBallisticAtmosphere(stored) {
	const atmosphere = readScopeAtmosphere(stored);
	if (isAtmosphereMode(storedObject(stored).mode)) return accurateStationAtmosphere(atmosphere);
	// Saved before #151: as the page computed it then, then converted as any QNH state (#172).
	const before151 = { ...atmosphere, pressureRef: DEFAULT_PRESSURE_REF };
	return accurateStationAtmosphere(before151.mode === 'isa' ? { ...before151, altitude: '0' } : before151);
}
