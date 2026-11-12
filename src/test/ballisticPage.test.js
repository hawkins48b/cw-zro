/**
 * Ballistic page range (#122): the range message under the box and the result must agree for
 * every range, as on the compare page. Out-of-range values are checked with the engine stubbed to
 * throw, so they are known to stop before it; values inside are run on the real engine.
 */
import { describe, it, expect, vi, afterEach } from 'vitest';
import { Calculator } from '#lib/utils/ballisticEngine.js';
import { ballisticPageTrajectory, isUsableBallisticRange } from '#lib/utils/ballisticPage.js';
import { calculateFullTrajectory } from '#lib/utils/ballisticCalculator.js';
import { P308_G1 } from './fixtures/ballisticProfiles.js';

const range = (distance) => ({ distance, unit: 'yd', step: 100 });

const REJECTED = [
	['3000.01'],
	['3000,01'],
	['3001'],
	['5000'],
	['1e9'],
	['Infinity'],
	['0'],
	['-500'],
	['-0,5'],
	[''],
	['abc'],
	[null],
	[0],
	[5000]
];
const ACCEPTED = [['1'], ['500'], ['600,5'], ['3000'], [3000], ['0.5']];

afterEach(() => {
	vi.restoreAllMocks();
});

describe('isUsableBallisticRange', () => {
	it.each(REJECTED)('rejects %j, so the page shows the range message', (distance) => {
		expect(isUsableBallisticRange(distance)).toBe(false);
	});

	it.each(ACCEPTED)('accepts %j', (distance) => {
		expect(isUsableBallisticRange(distance)).toBe(true);
	});
});

describe('ballisticPageTrajectory', () => {
	it.each(REJECTED)('gives no result for %j, before the engine', (distance) => {
		const solver = vi.spyOn(Calculator.prototype, 'setWeaponZero').mockImplementation(() => {
			throw new Error('setWeaponZero reached');
		});
		vi.spyOn(console, 'error').mockImplementation(() => {});
		expect(ballisticPageTrajectory(P308_G1, range(distance), null, null)).toEqual({ result: null, altitudeTooLow: false });
		expect(solver).not.toHaveBeenCalled();
	});

	it('gives no result for a negative range, which calculateFullTrajectory alone takes as positive', () => {
		expect(calculateFullTrajectory(P308_G1, range('-500'), null, null)).not.toBeNull();
		expect(ballisticPageTrajectory(P308_G1, range('-500'), null, null).result).toBeNull();
	});

	it.each(ACCEPTED)('gives the result of calculateFullTrajectory for %j', (distance) => {
		const { result } = ballisticPageTrajectory(P308_G1, range(distance), null, null);
		expect(result).not.toBeNull();
		expect(result).toEqual(calculateFullTrajectory(P308_G1, range(distance), null, null));
	});

	it('gives no result without a profile', () => {
		expect(ballisticPageTrajectory(null, range('500'), null, null).result).toBeNull();
	});

	it('agrees with the message on every range', () => {
		for (const [distance] of [...REJECTED.filter(([d]) => !['1e9', 'Infinity'].includes(d)), ...ACCEPTED]) {
			const shown = !isUsableBallisticRange(distance);
			const { result } = ballisticPageTrajectory(P308_G1, range(distance), null, null);
			expect(result === null).toBe(shown);
		}
	});
});
