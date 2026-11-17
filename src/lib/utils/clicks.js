/**
 * Turret clicks of an adjustment (#151), as the Scope View has always counted them. Clicks are a
 * display of an angle (or a size) the calculator already gave, not a new result.
 *
 * The value is first read in the profile's click unit with getElevationValue or getWindageValue,
 * which round it (to 0.1, or 0.01 in ft and m); the clicks are that value divided by the click
 * value, rounded to a whole click.
 */
import { readDecimal } from './decimal.js';

/** The click value the Scope View uses when the profile's is missing, 0 or not a number. */
export const DEFAULT_CLICK_VALUE = 0.5;

/**
 * The click value of a profile field, read as the Scope View reads it: a missing, 0 or unreadable
 * value is 0.5.
 *
 * @param {unknown} stored - e.g. elevationClickValue of shownProfile, which reads it as text
 * @returns {number}
 */
export const clickValue = (stored) => readDecimal(stored) || DEFAULT_CLICK_VALUE;

/**
 * The number of clicks for an adjustment, without its direction: what the Scope View shows beside
 * Up / Down or Left / Right. Null without a value.
 *
 * @param {number|null} value - the adjustment in the click unit (getElevationValue, getWindageValue)
 * @param {number} perClick - clickValue(...)
 * @returns {number|null}
 */
export function clickCount(value, perClick) {
	if (value === null || value === undefined) return null;
	return Math.round(Math.abs(value) / perClick);
}

/**
 * The clicks with the sign of the value, for the Ballistic table (#151): the same count as the
 * Scope View, signed like the angle columns next to it, so a negative elevation (dial up on the
 * Scope View) is a negative number of clicks. No click is 0, never -0.
 *
 * @param {number|null} value
 * @param {number} perClick
 * @returns {number|null}
 */
export function signedClickCount(value, perClick) {
	const count = clickCount(value, perClick);
	if (count === null || count === 0) return count;
	return value < 0 ? -count : count;
}
