import { calculateFullTrajectory } from './ballisticCalculator.js';
import { readDecimal } from './decimal.js';
import { isUsableRange } from './inputLimits.js';
import { isUsableScopeRange } from './scopeRange.js';

/**
 * Whether the range box of the Ballistic page holds a range the page calculates (#122): above 0
 * and at most MAX_DISTANCE, read with a comma as a decimal point, as on the compare page. The page
 * shows validation_range_above_zero under the box when it does not.
 *
 * @param {unknown} distance - the range box value
 * @returns {boolean}
 */
export function isUsableBallisticRange(distance) {
	return isUsableRange(readDecimal(distance));
}

/**
 * The trajectory of the Ballistic page, and whether it is missing because the custom altitude is
 * too low for this shot (#125). `result` is null without a profile or with a range the box rejects
 * (isUsableBallisticRange), else calculateFullTrajectory. Checking the range here, as the compare
 * page does, makes the message and the result agree for every range: calculateFullTrajectory
 * alone would take a negative range as positive and give a result under the message.
 * `altitudeTooLow` is only true with a custom atmosphere, when the engine ended the flight at its
 * minimum altitude (flightStop.js).
 *
 * @param {object|null} profile
 * @param {{ distance: unknown, unit: string, step: unknown }} range
 * @param {object|null} atmosphere - scopeAtmosphereParams of the stored atmosphere (#151): a custom
 *   atmosphere, or null for the standard atmosphere at sea level
 * @param {object|null} wind
 * @returns {{ result: ReturnType<typeof calculateFullTrajectory>, altitudeTooLow: boolean }}
 */
export function ballisticPageTrajectory(profile, range, atmosphere, wind) {
	if (!profile || !isUsableBallisticRange(range.distance)) return { result: null, altitudeTooLow: false };
	const report = {};
	const result = calculateFullTrajectory(profile, range, atmosphere, wind, { report });
	return { result, altitudeTooLow: !result && !!atmosphere && report.minimumAltitude };
}

/** Metres in a yard, exactly. */
const METRES_PER_YARD = 0.9144;

/** A distance rounded to 0.1, as the table shows it. */
const tenth = (value) => Math.round(value * 10) / 10;

/**
 * The index of the table row at the Scope View's target distance (#151), or -1 when no row is there.
 *
 * The Scope View distance is its range box (the distance typed, not the distance after the uphill
 * or downhill angle). It is converted to the table's unit (yd or m) and matched to a row when both,
 * rounded to 0.1 as the table shows them, are equal. A Scope View distance the Scope View does not
 * calculate (isUsableScopeRange: empty, text, 0, negative, past the maximum) highlights nothing.
 *
 * @param {number[]} rowDistances - the distance of each table row in the table's unit
 * @param {{ distance: unknown, unit: string }} scopeRange - the Scope View range, as storedRange reads it
 * @param {'yd'|'m'} tableUnit - the unit of the Ballistic table
 * @returns {number}
 */
export function scopeDistanceRow(rowDistances, scopeRange, tableUnit) {
	if (!isUsableScopeRange(scopeRange.distance)) return -1;
	const distance = readDecimal(scopeRange.distance);
	const scopeUnit = scopeRange.unit === 'm' ? 'm' : 'yd';
	const converted =
		scopeUnit === tableUnit ? distance : tableUnit === 'm' ? distance * METRES_PER_YARD : distance / METRES_PER_YARD;
	const target = tenth(converted);
	return rowDistances.findIndex((row) => tenth(row) === target);
}
