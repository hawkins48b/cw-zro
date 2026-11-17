import { UNew, Unit } from 'js-ballistics';
import { readDecimal } from './decimal.js';
import { HUMIDITY_LIMITS, altitudeLimits, pressureLimits, temperatureLimits } from './inputLimits.js';
import { MAX_SCOPE_ANGLE_DEG } from './scopeRange.js';
import { MAX_WIND_SPEED_MPS } from './shotWind.js';
import { MAX_ROTATION, ISA_ATMOSPHERE } from './storedState.js';
import { DEFAULT_WEATHER, WEATHER_HUMIDITY } from './scopeAtmosphere.js';

/**
 * − and + buttons of the numeric fields of the Scope View and of the shared wind and atmosphere
 * cards (#166). A step changes the text of the box, as typing would, and the page then reads it the
 * way it reads a typed value: the buttons never compute a result.
 *
 * Each field has a step spec (fieldStepSpec). Its limits are the ones the calculators already check
 * (inputLimits.js, scopeRange.js, shotWind.js, storedState.js): a step never leaves them, so a
 * step can bring an out-of-range value back in, but never takes a usable one out.
 */

/**
 * @typedef {object} StepSpec
 * @property {number} step            - The size of one step, in the unit shown.
 * @property {number} [min]           - Lowest value a step gives.
 * @property {number} [max]           - Highest value a step gives.
 * @property {boolean} [minExclusive] - min itself is not usable (a cosine of 0).
 * @property {boolean} [maxExclusive] - max itself is not usable (an angle of 90°).
 * @property {number} start           - What an empty box, or one that is not a number, is read as.
 * @property {number} [wrap]          - Values go round in [0, wrap) instead of stopping (direction).
 */

/** Most decimals a stepped value keeps. */
const MAX_DECIMALS = 10;

/**
 * The number of decimals of a finite number as JavaScript writes it (0.5 → 1, 29.92 → 2, 1e-7 → 7),
 * at most MAX_DECIMALS.
 * @param {number} value
 * @returns {number}
 */
export function decimalsOf(value) {
	if (!Number.isFinite(value)) return 0;
	const [mantissa, exponent] = String(Math.abs(value)).split('e');
	const fraction = (mantissa.split('.')[1] ?? '').length;
	return Math.min(MAX_DECIMALS, Math.max(0, fraction - (exponent ? Number(exponent) : 0)));
}

/**
 * The text of a box after one step of `delta` (a step, or minus a step).
 *
 * - The box is read as the calculators read it (readDecimal: `1,5` is 1.5, `90abc` is 90). An empty
 *   box, text that is not a number, or an infinite value is read as `spec.start`, and the step is
 *   taken from there.
 * - The result keeps the decimals of the step or of the value, whichever has more, so 0.1 + 0.2
 *   gives 0.3, and 29.921 + 0.01 gives 29.931.
 * - With `wrap`, it goes round in [0, wrap). Otherwise it is kept within min and max; an exclusive
 *   end is kept one last decimal inside (89 for 90° with whole degrees, 0.01 for a cosine of 0).
 *   A value already out of the limits comes back to the nearest one.
 *
 * @param {unknown} value - The box text (or a number).
 * @param {number} delta  - +step or −step.
 * @param {StepSpec} spec
 * @returns {string} The new box text, with a decimal point.
 */
export function stepValue(value, delta, spec) {
	const read = readDecimal(value);
	const base = Number.isFinite(read) ? read : spec.start;
	const decimals = Math.max(decimalsOf(Math.abs(delta)), decimalsOf(base));
	const factor = 10 ** decimals;
	const round = (n) => Math.round(n * factor) / factor;

	let next = round(base + delta);
	if (spec.wrap) {
		next = round(((next % spec.wrap) + spec.wrap) % spec.wrap);
		if (next >= spec.wrap) next = 0;
	} else {
		// A clamped value keeps at most one decimal more than the step, so a long typed value that is
		// out of range comes back just inside an open end (cos 0.001, not 1e-10), while 89.5 + 1 still
		// gives 89.9 under an open 90.
		const stepFactor = 10 ** Math.min(decimals, decimalsOf(Math.abs(delta)) + 1);
		const unit = 1 / stepFactor;
		if (spec.max !== undefined) {
			const high = spec.maxExclusive ? spec.max - unit : spec.max;
			// The last value with these decimals at or under the end (35.4 * 100 is 3539.9999999999995).
			if (next > high) next = Math.floor(high * stepFactor + 1e-6) / stepFactor;
		}
		if (spec.min !== undefined) {
			const low = spec.minExclusive ? spec.min + unit : spec.min;
			if (next < low) next = Math.ceil(low * stepFactor - 1e-6) / stepFactor;
		}
	}
	// -0 is written as 0, and never in exponent form (String(1e-7) is "1e-7").
	const fixed = (next === 0 ? 0 : round(next)).toFixed(decimals);
	return fixed.includes('.') ? fixed.replace(/\.?0+$/, '') : fixed;
}

/** Fastest wind a step gives, in a speed unit: shotWinds' limit, in m/s or in mph. */
export function maxWindSpeed(speedUnit) {
	return speedUnit === 'mps' ? MAX_WIND_SPEED_MPS : UNew.MPS(MAX_WIND_SPEED_MPS).In(Unit.MPH);
}

/**
 * The step spec of a field, in the unit shown (owner, 2026-11-17).
 *
 * | Field         | Step                 | Limits                                   | Empty box reads as      |
 * |---------------|----------------------|------------------------------------------|-------------------------|
 * | windSpeed     | 0.5 m/s, 1 mph       | 0 to shotWinds' 100 m/s (223.69 mph)     | 0                       |
 * | windDirection | 5°                   | goes round in [0, 360)                   | 0 (as the dial)         |
 * | angle (deg)   | 1°                   | above -90° and below 90°                 | 0 (flat)                |
 * | angle (cos)   | 0.01                 | above 0, at most 1                       | 1 (flat)                |
 * | altitude      | 10 m, 10 ft          | altitudeLimits                           | 0                       |
 * | pressure      | 1 hPa, 0.01 inHg     | pressureLimits                           | 1013 hPa, 29.92 inHg    |
 * | temperature   | 1 °C, 1 °F           | temperatureLimits                        | 0 °C, 32 °F (as before) |
 * | humidity      | 5 %                  | 0 to 100 %                               | 65 % (cloudy, default)  |
 * | cant          | 1°                   | -90° to 90° (the slider)                 | 0                       |
 *
 * Units are read as the calculators read them: `mps` or else mph, `m` or else ft, `hpa` or else
 * inHg, `c` or else °F, `deg` or else a cosine.
 *
 * @param {'windSpeed'|'windDirection'|'angle'|'altitude'|'pressure'|'temperature'|'humidity'|'cant'} field
 * @param {string} [unit]
 * @returns {StepSpec}
 */
export function fieldStepSpec(field, unit) {
	switch (field) {
		case 'windSpeed':
			return { step: unit === 'mps' ? 0.5 : 1, min: 0, max: maxWindSpeed(unit), start: 0 };
		case 'windDirection':
			return { step: 5, wrap: 360, start: 0 };
		case 'angle':
			return unit === 'deg'
				? {
						step: 1,
						min: -MAX_SCOPE_ANGLE_DEG,
						max: MAX_SCOPE_ANGLE_DEG,
						minExclusive: true,
						maxExclusive: true,
						start: 0
					}
				: { step: 0.01, min: 0, max: 1, minExclusive: true, start: 1 };
		case 'altitude':
			return { step: 10, ...altitudeLimits(unit), start: 0 };
		case 'pressure':
			return unit === 'hpa'
				? { step: 1, ...pressureLimits(unit), start: 1013 }
				: { step: 0.01, ...pressureLimits(unit), start: Number(ISA_ATMOSPHERE.pressure) };
		case 'temperature':
			return { step: 1, ...temperatureLimits(unit), start: unit === 'c' ? 0 : 32 };
		case 'humidity':
			return { step: 5, ...HUMIDITY_LIMITS, start: WEATHER_HUMIDITY[DEFAULT_WEATHER] };
		case 'cant':
			return { step: 1, min: -MAX_ROTATION, max: MAX_ROTATION, start: 0 };
		default:
			throw new Error(`No step for ${field}`);
	}
}
