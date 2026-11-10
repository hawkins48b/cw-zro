import { calculateFullTrajectory } from './ballisticCalculator.js';
import { readDecimal } from './decimal.js';
import { isUsableRange } from './inputLimits.js';

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
 * @param {object|null} atmosphere - custom atmosphere, or null for ISA
 * @param {object|null} wind
 * @returns {{ result: ReturnType<typeof calculateFullTrajectory>, altitudeTooLow: boolean }}
 */
export function ballisticPageTrajectory(profile, range, atmosphere, wind) {
	if (!profile || !isUsableBallisticRange(range.distance)) return { result: null, altitudeTooLow: false };
	const report = {};
	const result = calculateFullTrajectory(profile, range, atmosphere, wind, { report });
	return { result, altitudeTooLow: !result && !!atmosphere && report.minimumAltitude };
}
