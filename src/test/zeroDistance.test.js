/**
 * Zero distance guard (#88). A zero of 0 hangs js-ballistics for good: setWeaponZero gives a NaN
 * elevation and fire never ends. Neither try/catch nor a Vitest timeout can stop that. So
 * setWeaponZero is stubbed to throw: if a guard fails, the test fails on the call instead of
 * hanging the run.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { Calculator } from 'js-ballistics';
import { calculateShotPoint, calculateFullTrajectory } from '#lib/utils/ballisticCalculator.js';
import { calculateTrajectoryValidation } from '#lib/utils/trajectoryValidation.js';
import { generateImperialDopeCard } from '#lib/utils/dopeCardImperial.js';
import { generateMetricDopeCard } from '#lib/utils/dopeCardMetric.js';
import { MIN_ZERO_DISTANCE, isUsableZeroDistance } from '#lib/utils/zeroDistance.js';
import { P308_G1 } from './fixtures/ballisticProfiles.js';

const card = vi.hoisted(() => ({ labels: [] }));

vi.mock('pdf-lib', () => ({
	rgb: () => ({}),
	StandardFonts: {},
	PDFDocument: {
		load: async () => ({
			embedFont: async () => ({}),
			getPages: () => [
				{
					getSize: () => ({ height: 612 }),
					drawText: (text) => card.labels.push(text),
					drawLine: () => {},
					drawCircle: () => {},
					drawRectangle: () => {}
				}
			]
		})
	}
}));

const REJECTED = [
	['the number 0', 0],
	['the text 0', '0'],
	['0.0', '0.0'],
	['negative zero', '-0'],
	['0 with trailing text', '0abc'],
	['a value that hangs the engine', '1e-320'],
	['a value that solves to an absurd elevation', '1e-100'],
	['just below the floor', '0.00099'],
	['empty text', ''],
	['spaces', '   '],
	['text', 'abc'],
	['null', null],
	['undefined', undefined],
	['an array from tampered storage', [100]],
	['an object that cannot become text', { toString: 1 }],
	['Infinity', 'Infinity']
];

const CARDS = [
	['imperial', generateImperialDopeCard],
	['metric', generateMetricDopeCard]
];

const RANGE = { distance: 500, unit: 'yd', step: 25 };

describe('isUsableZeroDistance', () => {
	it.each(REJECTED)('rejects %s', (_, value) => {
		expect(isUsableZeroDistance(value)).toBe(false);
	});

	it.each([
		['the floor', MIN_ZERO_DISTANCE],
		['a value that solves on every reference load', '0.2'],
		['a number', 100],
		['text', '100'],
		['a negative value, used as its absolute value', '-100']
	])('accepts %s', (_, value) => {
		expect(isUsableZeroDistance(value)).toBe(true);
	});
});

describe('guards before the engine', () => {
	let solver;

	beforeEach(() => {
		card.labels = [];
		vi.stubGlobal('fetch', async () => ({ arrayBuffer: async () => new ArrayBuffer(0) }));
		solver = vi.spyOn(Calculator.prototype, 'setWeaponZero').mockImplementation(() => {
			throw new Error('setWeaponZero reached with an unusable zero');
		});
	});

	afterEach(() => {
		vi.restoreAllMocks();
		vi.unstubAllGlobals();
	});

	describe.each(REJECTED)('with %s', (_, zeroDist) => {
		const profile = { ...P308_G1, zeroDist };

		it('calculateShotPoint gives no result', () => {
			expect(calculateShotPoint(profile, RANGE, null, null)).toBeNull();
			expect(solver).not.toHaveBeenCalled();
		});

		it('calculateFullTrajectory gives no result', () => {
			expect(calculateFullTrajectory(profile, RANGE, null, null)).toBeNull();
			expect(solver).not.toHaveBeenCalled();
		});

		it('trajectory validation does not reach the engine', () => {
			const result = calculateTrajectoryValidation(profile, RANGE, 'distance', 10, 'in');
			expect(result === null || result.error === 'no_solution').toBe(true);
			expect(solver).not.toHaveBeenCalled();
		});

		it.each(CARDS)('the %s dope card prints nothing', async (_, generate) => {
			await generate(profile);
			expect(card.labels).toEqual([]);
			expect(solver).not.toHaveBeenCalled();
		});
	});

	// Proves the stub is live: without this, the checks above would also pass with a guard that
	// stopped everything.
	it('still reaches the engine with a usable zero', () => {
		const profile = { ...P308_G1, zeroDist: 100 };
		calculateShotPoint(profile, RANGE, null, null);
		calculateFullTrajectory(profile, RANGE, null, null);
		expect(solver).toHaveBeenCalledTimes(2);
	});
});
