/**
 * Wind direction convention (#106). The direction shown and entered is where the wind comes from,
 * clockwise from the target: 0° from the target (headwind), 90° from the right, 180° from behind
 * (tailwind), 270° from the left. The engine gets the angle half a turn away. Stored directions of
 * the old convention (the engine's angle) are converted once, so the wind and the result stay.
 */
import { describe, it, expect } from 'vitest';
import { UNew, Unit, Wind } from 'js-ballistics';
import { calculateShotPoint, calculateFullTrajectory } from '#lib/utils/ballisticCalculator.js';
import { shotWinds } from '#lib/utils/shotWind.js';
import { halfTurn, MAX_WIND_DIRECTION_DEGREES } from '#lib/utils/windDirection.js';
import {
	WIND_FROM_TARGET,
	migrateClockWind,
	migrateStoredWind,
	shownWindDirection
} from '#lib/utils/storedWind.js';
import { P308_G1 } from './fixtures/ballisticProfiles.js';

const YD_600 = { distance: 600, unit: 'yd', step: 100 };
const windFrom = (direction) => ({ speed: '10', speedUnit: 'mph', direction });
const lastRow = (result) => result.trajectory[result.trajectory.length - 1];

const SHOTS = [
	['calculateShotPoint', (wind) => calculateShotPoint(P308_G1, YD_600, null, wind)],
	['calculateFullTrajectory', (wind) => lastRow(calculateFullTrajectory(P308_G1, YD_600, null, wind))]
];

describe('direction on the real engine', () => {
	describe.each(SHOTS)('%s, 10 mph, .308 at 600 yd', (_, shoot) => {
		const windage = (direction) => shoot(windFrom(direction)).windage.In(Unit.Inch);
		const drop = (wind) => shoot(wind).targetDrop.In(Unit.Inch);

		it('drifts a wind from the right (90°) to the left', () => {
			// Measured before #106 with the engine's 270°, the same wind: -33.92 in.
			expect(windage('90')).toBeCloseTo(-33.92, 2);
			expect(shoot(windFrom('90')).windageAdjustment.In(Unit.MOA)).toBeLessThan(0);
		});

		it('drifts a wind from the left (270°) to the right', () => {
			expect(windage('270')).toBeCloseTo(33.92, 2);
			expect(shoot(windFrom('270')).windageAdjustment.In(Unit.MOA)).toBeGreaterThan(0);
		});

		it('reads an angle the same after any whole turn', () => {
			expect(windage('450')).toBeCloseTo(windage('90'), 6);
			expect(windage('-90')).toBeCloseTo(windage('270'), 6);
		});

		it('drops a headwind (0°) more, and a tailwind (180°) less, than no wind', () => {
			const still = drop(null);
			expect(drop(windFrom('0'))).toBeLessThan(still);
			expect(drop(windFrom('180'))).toBeGreaterThan(still);
			expect(Math.abs(windage('0'))).toBeLessThan(1e-9);
			expect(Math.abs(windage('180'))).toBeLessThan(1e-9);
		});

		it('reads an empty box as 0°, a headwind', () => {
			expect(drop(windFrom(''))).toBe(drop(windFrom('0')));
		});
	});
});

describe('halfTurn', () => {
	it.each([
		[0, 180],
		[90, 270],
		[180, 0],
		[270, 90],
		[360, 180],
		[-90, 90],
		[-0, 180],
		[720, 180],
		[12.5, 192.5],
		[MAX_WIND_DIRECTION_DEGREES, 100],
		[-MAX_WIND_DIRECTION_DEGREES, 260]
	])('turns %s into %s', (degrees, expected) => {
		expect(halfTurn(degrees)).toBe(expected);
	});

	it('is its own inverse on whole degrees', () => {
		for (let d = 0; d < 360; d += 1) expect(halfTurn(halfTurn(d))).toBe(d);
	});
});

/** The x and z of the wind the engine got before #106, for an old stored direction. */
function oldWindVector(direction) {
	const degrees = typeof direction === 'string' && direction.trim() === '' ? 0 : parseFloat(String(direction).replace(',', '.'));
	return new Wind({ velocity: UNew.MPH(10), directionFrom: UNew.Degree(degrees) }).vector;
}

describe('shownWindDirection', () => {
	it.each([
		['90', '270'],
		['270', '90'],
		['0', '180'],
		['180', '0'],
		['45', '225'],
		['300', '120'],
		['-90', '90'],
		['-90.5', '89.5'],
		['12.5', '192.5'],
		['0.1', '180.1'],
		['1,5', '181.5'],
		['90abc', '270'],
		[' 90 ', '270'],
		['720', '180'],
		['1e6', '100'],
		['-1000000', '260'],
		[45, '225'],
		['', '180'],
		['   ', '180']
	])('converts %j into %j', (old, shown) => {
		expect(shownWindDirection(old)).toBe(shown);
	});

	it.each([
		'90', '270', '0', '45', '300', '-90.5', '12.5', '0.1', '1,5', '90abc', '1e6', '-999999.5', '', ' ', 45, 0
	])('gives the engine the same wind for %j as before #106', (old) => {
		const [now] = shotWinds(windFrom(shownWindDirection(old)));
		const before = oldWindVector(old);
		expect(now.vector.x).toBeCloseTo(before.x, 9);
		expect(now.vector.z).toBeCloseTo(before.z, 9);
		expect(now.vector.y).toBe(0);
	});

	const throwsAsText = JSON.parse('{"toString":1}');
	it.each([
		['text', 'abc'],
		['NaN', 'NaN'],
		['Infinity', 'Infinity'],
		['beyond the limit', '1000001'],
		['a number beyond the limit', -1e7],
		['null', null],
		['missing', undefined],
		['an array', [90]],
		['an object', throwsAsText],
		['true', true]
	])('keeps %s as it is, still with no result', (_, old) => {
		expect(shownWindDirection(old)).toBe(old);
		expect(shotWinds(windFrom(old))).toBeNull();
	});
});

describe('migrateStoredWind', () => {
	const old = { speed: '10', speedUnit: 'mph', direction: '90' };

	it('converts an old wind once and marks it', () => {
		expect(migrateStoredWind(old)).toEqual({ ...old, direction: '270', directionConvention: WIND_FROM_TARGET });
		expect(old.direction).toBe('90');
	});

	it('gives back a marked wind as the same object, so a second run changes nothing', () => {
		const once = migrateStoredWind(old);
		expect(migrateStoredWind(once)).toBe(once);
		expect(migrateStoredWind(migrateStoredWind(once))).toBe(once);
		const json = JSON.parse(JSON.stringify(once));
		expect(migrateStoredWind(json)).toBe(json);
	});

	it('keeps the result of the old wind', () => {
		const point = (wind) => calculateShotPoint(P308_G1, YD_600, null, wind).windage.In(Unit.Inch);
		// The engine read 90 as from the left, which drifts right.
		expect(point(migrateStoredWind(old))).toBeCloseTo(33.92, 2);
	});

	it('turns an empty old direction, which was a tailwind, into 180', () => {
		const migrated = migrateStoredWind({ ...old, direction: '' });
		expect(migrated.direction).toBe('180');
		const drop = (wind) => calculateShotPoint(P308_G1, YD_600, null, wind).targetDrop.In(Unit.Inch);
		expect(drop(migrated)).toBeGreaterThan(drop(null));
	});

	it('keeps the other fields', () => {
		expect(migrateStoredWind({ ...old, speed: 'abc', speedUnit: 'knots', extra: 1 })).toEqual({
			speed: 'abc',
			speedUnit: 'knots',
			extra: 1,
			direction: '270',
			directionConvention: WIND_FROM_TARGET
		});
	});

	it('marks a damaged direction and leaves it as it is', () => {
		expect(migrateStoredWind({ ...old, direction: null })).toEqual({
			...old,
			direction: null,
			directionConvention: WIND_FROM_TARGET
		});
	});

	it('converts a wind with another marker value', () => {
		expect(migrateStoredWind({ ...old, directionConvention: 'x' }).direction).toBe('270');
	});

	it.each([[null], [undefined], ['x'], [5], [[old]]])('gives back %j as it is, with no direction to convert', (value) => {
		expect(migrateStoredWind(value)).toBe(value);
	});

	describe('clock directions (Scope View)', () => {
		const clock = (direction) => ({ speed: '10', speedUnit: 'mph', direction, directionUnit: 'clock' });

		it.each([
			['3', '270'],
			['9', '90'],
			['12', '180'],
			['6', '0'],
			[3, '270'],
			['', '180'],
			[undefined, '180']
		])('turns clock %j into %j, the wind of the old mapping', (hour, shown) => {
			const migrated = migrateStoredWind(clock(hour), { clock: true });
			expect(migrated).toEqual({ speed: '10', speedUnit: 'mph', direction: shown, directionConvention: WIND_FROM_TARGET });
			// The engine gets what migrateClockWind gave it before #106.
			const [now] = shotWinds(migrated);
			const before = oldWindVector(migrateClockWind(clock(hour)).direction);
			expect(now.vector.x).toBeCloseTo(before.x, 9);
			expect(now.vector.z).toBeCloseTo(before.z, 9);
		});

		it('converts a clock wind once', () => {
			const once = migrateStoredWind(clock('3'), { clock: true });
			expect(migrateStoredWind(once, { clock: true })).toBe(once);
		});

		it('reads no clock without the option, as the Ballistic store never had one', () => {
			expect(migrateStoredWind(clock('3')).direction).toBe('183');
		});
	});
});
