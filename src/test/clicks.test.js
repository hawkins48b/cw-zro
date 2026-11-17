/**
 * Turret clicks (#151): the Ballistic table's click columns count clicks as the Scope View always
 * has. Clicks are a display of the angle the calculator gave; no calculated value changes.
 */
import { describe, it, expect } from 'vitest';
import { Unit } from 'js-ballistics';
import {
	calculateFullTrajectory,
	calculateShotPoint,
	getElevationValue,
	getWindageValue
} from '#lib/utils/ballisticCalculator.js';
import { DEFAULT_CLICK_VALUE, clickCount, clickValue, signedClickCount } from '#lib/utils/clicks.js';
import { readDecimal } from '#lib/utils/decimal.js';
import { P308_G1, WIND_10MPH } from './fixtures/ballisticProfiles.js';

/** The Scope View's formulas before #151, kept here to check the helpers against them. */
const scopeViewClickValue = (stored) => readDecimal(stored) || 0.5;
const scopeViewClicks = (value, perClick) => (value !== null ? Math.round(Math.abs(value) / perClick) : null);

describe('clickValue', () => {
	it.each([
		['0.25', 0.25],
		['0,1', 0.1],
		[0.5, 0.5],
		['1/4', 1],
		['', DEFAULT_CLICK_VALUE],
		['0', DEFAULT_CLICK_VALUE],
		['x', DEFAULT_CLICK_VALUE],
		[null, DEFAULT_CLICK_VALUE],
		[undefined, DEFAULT_CLICK_VALUE]
	])('reads %j as %d, as the Scope View does', (stored, expected) => {
		expect(clickValue(stored)).toBe(expected);
		expect(clickValue(stored)).toBe(scopeViewClickValue(stored));
	});
});

describe('clickCount and signedClickCount', () => {
	it.each([
		[-12.3, 0.25, 49, -49],
		[12.3, 0.25, 49, 49],
		[-3.6, 0.1, 36, -36],
		[0.2, 0.5, 0, 0],
		[-0.2, 0.5, 0, 0],
		[0, 0.5, 0, 0],
		[1.25, 0.5, 3, 3],
		[-1.25, 0.5, 3, -3]
	])('%d at %d per click is %d clicks, signed %d', (value, perClick, count, signed) => {
		expect(clickCount(value, perClick)).toBe(count);
		expect(clickCount(value, perClick)).toBe(scopeViewClicks(value, perClick));
		expect(Object.is(signedClickCount(value, perClick), signed)).toBe(true);
	});

	it('gives null without a value', () => {
		expect(clickCount(null, 0.5)).toBeNull();
		expect(signedClickCount(null, 0.5)).toBeNull();
		expect(signedClickCount(undefined, 0.5)).toBeNull();
	});
});

describe('the Ballistic click columns match the Scope View at the same distance', () => {
	const result = calculateFullTrajectory(P308_G1, { distance: '800', unit: 'yd', step: '100' }, null, WIND_10MPH);

	it.each([
		['MOA', '0.25'],
		['MRAD', '0.1'],
		['MOA', '0.5']
	])('in %s at %s per click', (unit, perClickText) => {
		const perClick = clickValue(perClickText);
		const rows = result.trajectory.filter((p) => p.distance.In(Unit.Yard) > 150);
		expect(rows.length).toBeGreaterThan(3);
		for (const p of rows) {
			const distance = Math.round(p.distance.In(Unit.Yard));
			const point = calculateShotPoint(P308_G1, { distance: String(distance), unit: 'yd' }, null, WIND_10MPH);
			// Same angle as the Scope View, so the same count.
			expect(getElevationValue(p, unit)).toBe(getElevationValue(point, unit));
			expect(Math.abs(signedClickCount(getElevationValue(p, unit), perClick))).toBe(
				scopeViewClicks(getElevationValue(point, unit), perClick)
			);
			expect(Math.abs(signedClickCount(getWindageValue(p, unit), perClick))).toBe(
				scopeViewClicks(getWindageValue(point, unit), perClick)
			);
			// Signed like the angle column: past the zero the bullet is low, the angle and clicks negative.
			expect(Math.sign(signedClickCount(getElevationValue(p, unit), perClick))).toBe(
				Math.sign(Math.round(getElevationValue(p, unit) / perClick))
			);
		}
	});
});
