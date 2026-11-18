/**
 * #199: Ballistic and Compare take a maximum distance in whole hundreds, the MPBR chart is drawn
 * from rows every 1 unit, and the Trajectory Validation chart has a tick every 100.
 */
import { describe, it, expect } from 'vitest';
import { Unit } from 'js-ballistics';
import { isUsableHundredsRange, MAX_DISTANCE_STEP } from '#lib/utils/inputLimits.js';
import { calculateMPBR } from '#lib/utils/ballisticCalculator.js';
import { validationChartAxis } from '#lib/utils/trajectoryValidation.js';
import { P223_G1, P308_G1 } from './fixtures/ballisticProfiles.js';

describe('isUsableHundredsRange', () => {
	it.each([100, 200, 500, 1200, 3000])('accepts %d', (d) => {
		expect(isUsableHundredsRange(d)).toBe(true);
	});

	it.each([0, -100, 1, 50, 99, 101, 437, 500.5, 2999, 3100, 5000, NaN, Infinity])('rejects %d', (d) => {
		expect(isUsableHundredsRange(d)).toBe(false);
	});

	it('steps by 100', () => {
		expect(MAX_DISTANCE_STEP).toBe(100);
	});
});

describe('MPBR chart rows', () => {
	it.each([
		['.308', P308_G1],
		['.223', P223_G1]
	])('%s: rows at least every 1 yd, from 0 to the chart end', (_, profile) => {
		const result = calculateMPBR(profile, '8', 'in');
		expect(result).not.toBeNull();
		const xs = result.trajectory.map((p) => p.distance.In(Unit.Yard));
		expect(xs[0]).toBeCloseTo(0, 6);
		for (let i = 1; i < xs.length; i++) {
			expect(xs[i] - xs[i - 1]).toBeLessThanOrEqual(1 + 1e-6);
		}
		// Every whole yard is a row
		const whole = new Set(xs.map((x) => Math.round(x * 1e6) / 1e6));
		for (let d = 0; d <= Math.floor(xs.at(-1)); d++) expect(whole.has(d)).toBe(true);
	});
});

describe('validationChartAxis', () => {
	it.each([
		[100, 200, 1],
		[150, 200, 1],
		[200, 200, 1],
		[437, 500, 4],
		[500, 500, 4],
		[500.5, 600, 5],
		[2999, 3000, 29],
		[3000, 3000, 29]
	])('range %d: axis 100 to %d, %d ticks of 100', (range, max, tickAmount) => {
		expect(validationChartAxis(range)).toEqual({ min: 100, max, tickAmount });
		expect((max - 100) / tickAmount).toBe(100);
	});

	it.each([NaN, Infinity, -Infinity, 0, 99.9, 3000.1, 5000])('gives no axis for %d', (range) => {
		expect(validationChartAxis(range)).toBeNull();
	});
});
