/**
 * Wind guard (#116). A NaN or infinite direction, or a huge speed, hangs fire for good, and neither
 * try/catch nor a Vitest timeout can stop that. So nothing here runs the hang: rejected winds meet an
 * engine stubbed to throw, and the checks count calls, because each calculator's catch would swallow
 * a throw. Tests that use the real engine go through flyOnlySafeWinds, which throws on a wind that
 * could hang before the engine sees it.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { UNew, Unit, Wind } from 'js-ballistics';
import { Calculator } from '#lib/utils/ballisticEngine.js';
import { windVector } from './fixtures/windVector.js';
import { calculateShotPoint, calculateFullTrajectory } from '#lib/utils/ballisticCalculator.js';
import { shotWinds } from '#lib/utils/shotWind.js';
import { P308_G1, WIND_10MPH, WIND_4MPS } from './fixtures/ballisticProfiles.js';

const RANGE = { distance: 600, unit: 'yd', step: 100 };

const CALCULATORS = [
	['calculateShotPoint', (wind) => calculateShotPoint(P308_G1, RANGE, null, wind)],
	['calculateShotPoint with cant', (wind) => calculateShotPoint(P308_G1, RANGE, null, wind, { cantAngle: 5 })],
	['calculateFullTrajectory', (wind) => calculateFullTrajectory(P308_G1, RANGE, null, wind)]
];

/**
 * The fastest wind the real engine gets here, in m/s. Written out, not read from shotWind.js: a
 * limit raised by mistake has to fail on this stub, and must not reach a wind that hangs.
 */
const SAFE_WIND_MPS = 100;

const windAt = (direction) => ({ speed: '10', speedUnit: 'mph', direction });

/** What a reload gives: JSON.parse turns 1e999 into Infinity, and keeps the rest as stored. */
const stored = (json) => JSON.parse(json);

const BAD_DIRECTIONS = [
	['text', 'abc'],
	['the text NaN', 'NaN'],
	['the text Infinity', 'Infinity'],
	['the text -Infinity', '-Infinity'],
	['an overflow as text', '1e999'],
	['a negative overflow as text', '-1e999'],
	['NaN', NaN],
	['Infinity', Infinity],
	['-Infinity', -Infinity],
	['a stored overflow', stored('1e999')],
	['null', null],
	['undefined', undefined],
	['true', true],
	['false', false],
	['an object', {}],
	['an empty array', []],
	['an array holding an angle', [90]],
	['an object that cannot become text', { toString: 1 }],
	['just over the limit', '1000000.1'],
	['just under the negative limit', '-1000000.1'],
	['1e15', '1e15'],
	['1e100', '1e100'],
	['1e300', 1e300],
	['1e308', '1e308'],
	['-1e308', -1e308],
	['the largest number', Number.MAX_VALUE]
];

const BAD_SPEEDS = [
	['500, the first limit tried', '500'],
	['an overflow as text', '1e999'],
	['the text Infinity', 'Infinity'],
	['Infinity', Infinity],
	['a stored overflow', stored('1e999')],
	['1e9, which hangs as a crosswind', '1e9'],
	['1e150, which hangs in any direction', '1e150'],
	['1e300', '1e300'],
	['1e308', 1e308],
	['the largest number', Number.MAX_VALUE]
];

const NO_WIND_SPEEDS = [
	['empty text', ''],
	['whitespace', '  '],
	['text', 'abc'],
	['the text 0', '0'],
	['0', 0],
	['-0', -0],
	['a negative value', '-5'],
	['a negative overflow', '-1e999'],
	['-Infinity', -Infinity],
	['NaN', NaN],
	['null', null],
	['undefined', undefined],
];

/** Stored speeds of a shape no box sends. The page still shows some as a speed, so no wind would mislead. */
const BAD_SPEED_SHAPES = [
	['true', true],
	['false', false],
	['an empty array', []],
	['an object', {}],
	['an array holding a speed', [10]],
	['an array holding an overflow', ['1e999']],
	['an object that cannot become text', { toString: 1 }]
];

/** Every number a calculation gives, so that two results compare exactly. */
function figures(result) {
	if (!result) return result;
	const rows = result.chartPoints ?? [result];
	return {
		rows: rows.map((p) => [
			p.time,
			p.distance.In(Unit.Foot),
			p.velocity.In(Unit.FPS),
			p.slantHeight.In(Unit.Inch),
			p.windage.In(Unit.Inch),
			p.dropAngle.In(Unit.MOA),
			p.windageAngle.In(Unit.MOA),
			p.energy.In(Unit.FootPound)
		]),
		summary: result.chartPoints
			? [result.nearZero, result.farZero, result.maxApex, result.maxDrop, result.subsonicDist]
			: null
	};
}

/** Stops a wind that could hang before the real engine sees it. */
function flyOnlySafeWinds() {
	const realZero = Calculator.prototype.setWeaponZero;
	vi.spyOn(Calculator.prototype, 'setWeaponZero').mockImplementation(function (shot, distance) {
		for (const wind of shot.winds) {
			const { x, z } = windVector(wind);
			const usable = Number.isFinite(x) && Number.isFinite(z);
			if (!usable || wind.velocity.In(Unit.MPS) > SAFE_WIND_MPS) {
				throw new Error('a wind that can hang reached the engine');
			}
		}
		return realZero.call(this, shot, distance);
	});
}

describe('wind guard (#116)', () => {
	beforeEach(() => {
		vi.spyOn(console, 'error').mockImplementation(() => {});
	});

	afterEach(() => {
		vi.restoreAllMocks();
	});

	describe('a wind that gives no result', () => {
		let solver;
		let fire;

		beforeEach(() => {
			solver = vi.spyOn(Calculator.prototype, 'setWeaponZero').mockImplementation(() => {
				throw new Error('setWeaponZero reached with a bad wind');
			});
			fire = vi.spyOn(Calculator.prototype, 'fire').mockImplementation(() => {
				throw new Error('fire reached with a bad wind');
			});
		});

		describe.each(CALCULATORS)('%s', (_, calculate) => {
			it.each(BAD_DIRECTIONS)('stops a direction of %s', (__, direction) => {
				expect(calculate(windAt(direction))).toBeNull();
				expect(solver).not.toHaveBeenCalled();
				expect(fire).not.toHaveBeenCalled();
			});

			it('stops a wind with no direction at all', () => {
				expect(calculate({ speed: '10', speedUnit: 'mph' })).toBeNull();
				expect(solver).not.toHaveBeenCalled();
			});

			it.each(BAD_SPEEDS)('stops a speed of %s, in mph', (__, speed) => {
				expect(calculate({ speed, speedUnit: 'mph', direction: '90' })).toBeNull();
				expect(solver).not.toHaveBeenCalled();
				expect(fire).not.toHaveBeenCalled();
			});

			it.each(BAD_SPEEDS)('stops a speed of %s, in m/s', (__, speed) => {
				expect(calculate({ speed, speedUnit: 'mps', direction: '90' })).toBeNull();
				expect(solver).not.toHaveBeenCalled();
				expect(fire).not.toHaveBeenCalled();
			});

			it('stops a bad speed with an empty direction', () => {
				expect(calculate({ speed: '1e999', speedUnit: 'mph', direction: '' })).toBeNull();
				expect(solver).not.toHaveBeenCalled();
			});
		});
	});

	describe('an empty direction with a speed above 0', () => {
		beforeEach(flyOnlySafeWinds);

		describe.each(CALCULATORS)('%s', (_, calculate) => {
			it.each([
				['empty text', ''],
				['a space', ' '],
				['spaces and a tab', ' \t ']
			])('with %s matches an explicit 0 exactly', (__, direction) => {
				const zero = figures(calculate(windAt('0')));
				expect(zero.rows.length).toBeGreaterThan(0);
				expect(figures(calculate(windAt(direction)))).toEqual(zero);
				expect(figures(calculate(windAt(0)))).toEqual(zero);
			});

			it('is a wind: it differs from no wind', () => {
				expect(figures(calculate(windAt('')))).not.toEqual(figures(calculate(null)));
			});
		});
	});

	describe('a speed that uses no wind', () => {
		beforeEach(flyOnlySafeWinds);

		describe.each(CALCULATORS)('%s', (_, calculate) => {
			const directions = [...BAD_DIRECTIONS, ['empty text', ''], ['a good angle', '90']];

			it.each(NO_WIND_SPEEDS)('of %s gives the no wind result on any direction', (__, speed) => {
				const noWind = figures(calculate(null));
				expect(noWind.rows.length).toBeGreaterThan(0);
				for (const [, direction] of directions) {
					expect(figures(calculate({ speed, speedUnit: 'mph', direction }))).toEqual(noWind);
				}
			});

			it.each(BAD_SPEED_SHAPES)('of the stored shape %s gives no result', (__, speed) => {
				expect(calculate({ speed, speedUnit: 'mph', direction: '90' })).toBeNull();
			});

			it('with no speed at all gives the no wind result', () => {
				expect(figures(calculate({ speedUnit: 'mph', direction: 'abc' }))).toEqual(figures(calculate(null)));
			});
		});
	});

	describe('a good wind', () => {
		beforeEach(flyOnlySafeWinds);

		// Proves the stubs are live: a guard that stopped every wind would pass all of the above.
		describe.each(CALCULATORS)('%s', (_, calculate) => {
			it.each([
				['10 mph', WIND_10MPH],
				['4 m/s', WIND_4MPS]
			])('flies %s, and it moves the bullet', (__, wind) => {
				const withWind = figures(calculate(wind));
				expect(withWind.rows.length).toBeGreaterThan(0);
				expect(withWind).not.toEqual(figures(calculate(null)));
			});

			it('reads a stored number as the same text', () => {
				expect(figures(calculate({ speed: 10, speedUnit: 'mph', direction: 270 }))).toEqual(
					figures(calculate(WIND_10MPH))
				);
			});

			it('flies the fastest wind allowed, in both units', () => {
				expect(calculate({ speed: '100', speedUnit: 'mps', direction: '90' })).not.toBeNull();
				expect(calculate({ speed: '223', speedUnit: 'mph', direction: '90' })).not.toBeNull();
			});
		});
	});

	describe('shotWinds', () => {
		/**
		 * The wind both calculators built before the guard, with the engine angle half a turn from the
		 * entered one since #106 (where the wind comes from). Written out, not read from
		 * windDirection.js, so a change there fails here.
		 */
		const direct = (speed, toVelocity, direction) =>
			new Wind({
				velocity: toVelocity(parseFloat(speed)),
				directionFrom: UNew.Degree((((parseFloat(direction) % 360) + 540) % 360))
			});

		it.each([
			['10', 'mph', '90', UNew.MPH],
			['4', 'mps', '90', UNew.MPS],
			['0.1', 'mph', '0', UNew.MPH],
			['20', 'mph', '-90', UNew.MPH],
			['20', 'mph', '720', UNew.MPH],
			['20', 'mph', '12.5', UNew.MPH],
			['20', 'mph', ' 90', UNew.MPH],
			['20', 'mph', '90abc', UNew.MPH],
			['20', 'mph', '-0', UNew.MPH],
			['10abc', 'mph', '90', UNew.MPH]
		])('builds %s %s at %s as it always did, half a turn away', (speed, speedUnit, direction, toVelocity) => {
			const winds = shotWinds({ speed, speedUnit, direction });
			expect(winds).toHaveLength(1);
			expect(winds[0]).toEqual(direct(speed, toVelocity, direction));
		});

		it('takes any unit other than mps as mph, as it always did', () => {
			const [wind] = shotWinds({ speed: '10', speedUnit: 'knots', direction: '90' });
			expect(wind.velocity.In(Unit.MPS)).toBe(UNew.MPH(10).In(Unit.MPS));
		});

		it.each([[null], [undefined], [0], ['']])('gives no winds for a wind of %s', (wind) => {
			expect(shotWinds(wind)).toEqual([]);
		});

		it.each(NO_WIND_SPEEDS)('gives no winds for a speed of %s', (_, speed) => {
			expect(shotWinds({ speed, speedUnit: 'mph', direction: 'abc' })).toEqual([]);
		});

		it.each(BAD_SPEED_SHAPES)('gives null for a stored speed of %s', (_, speed) => {
			expect(shotWinds({ speed, speedUnit: 'mph', direction: '90' })).toBeNull();
		});

		it.each(BAD_DIRECTIONS)('gives null for a direction of %s', (_, direction) => {
			expect(shotWinds(windAt(direction))).toBeNull();
		});

		it.each(BAD_SPEEDS)('gives null for a speed of %s', (_, speed) => {
			expect(shotWinds({ speed, speedUnit: 'mph', direction: '90' })).toBeNull();
		});

		it('reads a wind as stored after a reload', () => {
			expect(shotWinds(stored('{"speed":"10","speedUnit":"mph","direction":1e999}'))).toBeNull();
			expect(shotWinds(stored('{"speed":1e999,"speedUnit":"mph","direction":"90"}'))).toBeNull();
			expect(shotWinds(stored('{"speed":"10","speedUnit":"mph","direction":null}'))).toBeNull();
			expect(shotWinds(stored('{"speed":"10","speedUnit":"mph"}'))).toBeNull();
			expect(shotWinds(stored('{"speed":"10","speedUnit":"mph","direction":""}'))).toHaveLength(1);
		});

		it('counts an empty direction as 0 degrees', () => {
			expect(shotWinds(windAt(''))).toEqual(shotWinds(windAt('0')));
			expect(shotWinds(windAt('   '))).toEqual(shotWinds(windAt('0')));
		});

		it('gives null for a stored speed that is not a number or text', () => {
			expect(shotWinds(stored('{"speed":[10],"speedUnit":"mph","direction":"90"}'))).toBeNull();
			expect(shotWinds(stored('{"speed":{"toString":1},"speedUnit":"mph","direction":"90"}'))).toBeNull();
		});

		describe('speed limit', () => {
			it('allows the limit and stops anything over it, in m/s', () => {
				expect(shotWinds({ speed: '100', speedUnit: 'mps', direction: '90' })).toHaveLength(1);
				expect(shotWinds({ speed: '100.001', speedUnit: 'mps', direction: '90' })).toBeNull();
			});

			it('is the same wind in mph', () => {
				expect(shotWinds({ speed: '223', speedUnit: 'mph', direction: '90' })).toHaveLength(1);
				expect(shotWinds({ speed: '224', speedUnit: 'mph', direction: '90' })).toBeNull();
			});

			it('stops a fast wind before it looks at the direction', () => {
				expect(shotWinds({ speed: '1e300', speedUnit: 'mph', direction: '' })).toBeNull();
			});
		});

		describe('direction limit', () => {
			it.each([
				['the limit', '1000000'],
				['the negative limit', '-1000000'],
				['the limit as a number', 1e6],
				['the limit in exponent form', '1e6'],
				['a negative angle', '-90'],
				['many turns', '-999999.5']
			])('keeps %s', (_, direction) => {
				expect(shotWinds(windAt(direction))).toEqual([direct('10', UNew.MPH, direction)]);
			});

			it('does not apply when no wind is used', () => {
				expect(shotWinds({ speed: '0', speedUnit: 'mph', direction: '1e300' })).toEqual([]);
			});
		});
	});
});
