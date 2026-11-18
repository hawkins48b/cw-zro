/**
 * Ballistic page range (#122): the range message under the box and the result must agree for
 * every range, as on the compare page. Out-of-range values are checked with the engine stubbed to
 * throw, so they are known to stop before it; values inside are run on the real engine. Since #199
 * the range is a whole hundred, from 100 to 3000.
 */
import { describe, it, expect, vi, afterEach } from 'vitest';
import { Calculator } from '#lib/utils/ballisticEngine.js';
import { ballisticPageTrajectory, isUsableBallisticRange, scopeDistanceRow } from '#lib/utils/ballisticPage.js';
import { calculateFullTrajectory } from '#lib/utils/ballisticCalculator.js';
import { P308_G1 } from './fixtures/ballisticProfiles.js';
import { Unit } from 'js-ballistics';
import { storedRange } from '#lib/utils/storedState.js';

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
// Not a whole hundred (#199): the Ballistic range box rejects them, Scope View does not.
const NOT_HUNDREDS = [
	['1'],
	['0.5'],
	['99'],
	['437'],
	['600,5'],
	['500.01'],
	['2999'],
	[250]
];
const ACCEPTED = [['100'], ['500'], ['600,0'], ['500.0'], ['3000'], [3000], [1200]];

afterEach(() => {
	vi.restoreAllMocks();
});

describe('isUsableBallisticRange', () => {
	it.each([...REJECTED, ...NOT_HUNDREDS])('rejects %j, so the page shows the range message', (distance) => {
		expect(isUsableBallisticRange(distance)).toBe(false);
	});

	it.each(ACCEPTED)('accepts %j', (distance) => {
		expect(isUsableBallisticRange(distance)).toBe(true);
	});
});

describe('ballisticPageTrajectory', () => {
	it.each([...REJECTED, ...NOT_HUNDREDS])('gives no result for %j, before the engine', (distance) => {
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
		for (const [distance] of [...REJECTED.filter(([d]) => !['1e9', 'Infinity'].includes(d)), ...NOT_HUNDREDS, ...ACCEPTED]) {
			const shown = !isUsableBallisticRange(distance);
			const { result } = ballisticPageTrajectory(P308_G1, range(distance), null, null);
			expect(result === null).toBe(shown);
		}
	});
});

describe('scopeDistanceRow (#151)', () => {
	const YD_ROWS = [0, 25, 50, 75, 100, 328.1, 500, 546.8];
	const M_ROWS = [0, 50, 100, 457.2, 500];

	it.each([
		['the same distance in the same unit', { distance: '500', unit: 'yd' }, 'yd', YD_ROWS, 6],
		['a comma decimal', { distance: '75,0', unit: 'yd' }, 'yd', YD_ROWS, 3],
		['a number', { distance: 100, unit: 'm' }, 'm', M_ROWS, 2],
		['metres in a yard table: 300 m is 328.08 yd, row 328.1', { distance: '300', unit: 'm' }, 'yd', YD_ROWS, 5],
		['metres in a yard table: 500 m is 546.81 yd, row 546.8', { distance: '500', unit: 'm' }, 'yd', YD_ROWS, 7],
		['yards in a metre table: 500 yd is 457.2 m', { distance: '500', unit: 'yd' }, 'm', M_ROWS, 3],
		['a missing unit read as yd, as storedRange does', { distance: '500', unit: 'x' }, 'm', M_ROWS, 3],
		['a row unrounded, as the engine gives it', { distance: '100', unit: 'yd' }, 'yd', [0, 50.00000001, 99.99999997], 2]
	])('finds %s', (_, scopeRange, tableUnit, rows, index) => {
		expect(scopeDistanceRow(rows, scopeRange, tableUnit)).toBe(index);
	});

	it.each([
		['no row there', { distance: '510', unit: 'yd' }, 'yd'],
		['a row 0.1 away', { distance: '25.1', unit: 'yd' }, 'yd'],
		['300 yd in a metre table (274.3 m)', { distance: '300', unit: 'yd' }, 'm']
	])('gives -1 for %s', (_, scopeRange, tableUnit) => {
		expect(scopeDistanceRow(tableUnit === 'yd' ? YD_ROWS : M_ROWS, scopeRange, tableUnit)).toBe(-1);
	});

	it.each(REJECTED)('gives -1 for a Scope View distance it does not calculate: %j', (distance) => {
		expect(scopeDistanceRow([0, 0.5, 500, 3000, 5000], { distance, unit: 'yd' }, 'yd')).toBe(-1);
	});

	it('gives -1 for an object that cannot become text, and for no rows', () => {
		// The page passes scopeView.range, which storedRange reads as an empty box.
		expect(scopeDistanceRow([0, 500], storedRange({ distance: JSON.parse('{"toString":1}'), unit: 'yd' }), 'yd')).toBe(-1);
		expect(scopeDistanceRow([], { distance: '500', unit: 'yd' }, 'yd')).toBe(-1);
	});

	it('finds the row of the real table', () => {
		const { result } = ballisticPageTrajectory(P308_G1, { distance: '600', unit: 'yd', step: '100' }, null, null);
		const rows = result.trajectory.map((p) => p.distance.In(Unit.Yard));
		expect(scopeDistanceRow(rows, { distance: '400', unit: 'yd' }, 'yd')).toBe(4);
	});
});
