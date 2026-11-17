/**
 * Elevation angle on the Ballistic page (#173). calculateFullTrajectory takes the Scope View's angle
 * and applies it as the Scope View does (scopeAngleCosine, rifleman's rule): each row at a distance
 * along the line of sight is the point calculateShotPoint gives for the Scope View's effective range
 * at that distance. No angle, an empty box or 0° must give exactly the flat table of before, so
 * every baseline holds. An angle the Scope View rejects gives no table, before the engine.
 */
import { describe, it, expect, vi, afterEach } from 'vitest';
import { Unit } from 'js-ballistics';
import { Calculator } from '#lib/utils/ballisticEngine.js';
import {
	calculateFullTrajectory,
	calculateShotPoint,
	getElevationValue,
	getWindageValue
} from '#lib/utils/ballisticCalculator.js';
import { ballisticPageTrajectory } from '#lib/utils/ballisticPage.js';
import {
	MIN_TABLE_COSINE,
	isUsableScopeAngle,
	isUsableTableAngle,
	scopeAngleCosine,
	scopeEffectiveRange
} from '#lib/utils/scopeRange.js';
import { storedBallisticElevation, storedElevation } from '#lib/utils/storedState.js';
import {
	ATMO_COLD_METRIC,
	ATMO_HOT_ALTITUDE,
	P308_G1,
	P338_G7_METRIC,
	P65_G7,
	WIND_10MPH,
	WIND_4MPS
} from './fixtures/ballisticProfiles.js';

afterEach(() => {
	vi.restoreAllMocks();
});

const deg = (angle) => ({ angle, unit: /** @type {'deg'} */ ('deg') });
const cos = (angle) => ({ angle, unit: /** @type {'cos'} */ ('cos') });

/** The whole result as plain data, so two results can be compared value for value. */
const plain = (result) => JSON.parse(JSON.stringify(result));

describe('scopeAngleCosine', () => {
	it('is exactly 1 for no angle, an empty box, 0° and a cosine of 1', () => {
		for (const elevation of [null, undefined, deg(''), cos(''), deg('  '), deg('0'), deg(0), deg('-0'), cos('1'), cos(1)]) {
			expect(scopeAngleCosine(elevation)).toBe(1);
		}
	});

	it('is the cosine of the degrees, or the cosine typed, with a comma read as a point', () => {
		expect(scopeAngleCosine(deg('60'))).toBeCloseTo(0.5, 15);
		expect(scopeAngleCosine(deg('-60'))).toBeCloseTo(0.5, 15);
		expect(scopeAngleCosine(cos('0,87'))).toBe(0.87);
	});

	it.each([[deg('90')], [deg('-90')], [deg('abc')], [deg('Infinity')], [cos('0')], [cos('-0.5')], [cos('1.5')], [cos('abc')]])(
		'is null where the Scope View rejects the angle: %j',
		(elevation) => {
			expect(isUsableScopeAngle(elevation)).toBe(false);
			expect(scopeAngleCosine(elevation)).toBeNull();
		}
	);

	it('gives scopeEffectiveRange the same range as before #173', () => {
		for (const elevation of [deg('15'), deg('-45'), cos('0.9'), deg(''), cos(''), deg('89.5')]) {
			const read = Number(String(elevation.angle).replace(',', '.'));
			const before =
				elevation.unit === 'deg' ? Math.cos(((read || 0) * Math.PI) / 180) : read || 1;
			expect(scopeEffectiveRange({ distance: '600', unit: 'yd' }, elevation)).toEqual({ distance: 600 * before, unit: 'yd' });
		}
	});
});

describe('isUsableTableAngle', () => {
	it('takes every angle the Scope View takes down to a cosine of MIN_TABLE_COSINE', () => {
		expect(isUsableTableAngle(null)).toBe(true);
		expect(isUsableTableAngle(deg('89.9999'))).toBe(true);
		expect(isUsableTableAngle(deg('-89.9999'))).toBe(true);
		expect(isUsableTableAngle(cos(String(MIN_TABLE_COSINE)))).toBe(true);
		expect(isUsableTableAngle(cos('0.000001'))).toBe(true);
	});

	it('rejects a steeper angle, which the Scope View still takes', () => {
		for (const elevation of [cos('0.0000009'), cos('1e-12'), deg('89.99995'), deg('-89.999999')]) {
			expect(isUsableScopeAngle(elevation)).toBe(true);
			expect(isUsableTableAngle(elevation)).toBe(false);
		}
	});
});

describe('calculateFullTrajectory with no angle', () => {
	const CASES = [
		['.308 yd, wind', P308_G1, { distance: '1000', unit: 'yd', step: '25' }, null, WIND_10MPH],
		['.338 m, hot altitude', P338_G7_METRIC, { distance: '1500', unit: 'm', step: '50' }, ATMO_HOT_ALTITUDE, WIND_4MPS],
		['6.5 yd, cold', P65_G7, { distance: '873.4', unit: 'yd', step: '17.3' }, ATMO_COLD_METRIC, WIND_10MPH]
	];

	it.each(CASES)('gives exactly the table of before for 0°, empty, a cosine of 1 or null (%s)', (_, profile, range, atmo, wind) => {
		const before = plain(calculateFullTrajectory(profile, range, atmo, wind));
		expect(before).not.toBeNull();
		for (const elevation of [null, undefined, deg('0'), deg(''), cos(''), cos('1'), deg('0,0')]) {
			expect(plain(calculateFullTrajectory(profile, range, atmo, wind, { elevation }))).toEqual(before);
		}
	});

	it('gives the page the table of before when it passes no angle', () => {
		const range = { distance: '1000', unit: 'yd', step: '25' };
		const before = plain(calculateFullTrajectory(P308_G1, range, null, WIND_10MPH));
		expect(plain(ballisticPageTrajectory(P308_G1, range, null, WIND_10MPH).result)).toEqual(before);
		expect(plain(ballisticPageTrajectory(P308_G1, range, null, WIND_10MPH, deg('0')).result)).toEqual(before);
		expect(plain(ballisticPageTrajectory(P308_G1, range, null, WIND_10MPH, storedBallisticElevation(undefined)).result)).toEqual(
			before
		);
	});
});

describe('calculateFullTrajectory with an angle: the Scope View point at every row', () => {
	const CASES = [
		['.308 yd, 15° up, wind', P308_G1, { distance: '1000', unit: 'yd', step: '25' }, null, WIND_10MPH, deg('15')],
		['.308 yd, 30° down', P308_G1, { distance: '600', unit: 'yd', step: '100' }, null, null, deg('-30')],
		['.338 m, cosine 0.87, hot altitude', P338_G7_METRIC, { distance: '1500', unit: 'm', step: '50' }, ATMO_HOT_ALTITUDE, WIND_4MPS, cos('0.87')],
		['6.5 yd, 7.3° up, odd step', P65_G7, { distance: '873.4', unit: 'yd', step: '17.3' }, ATMO_COLD_METRIC, WIND_10MPH, deg('7,3')],
		['.308 m, 60° up', P308_G1, { distance: '3000', unit: 'm', step: '100' }, null, WIND_4MPS, deg('60')]
	];

	it.each(CASES)('%s', (_, profile, range, atmo, wind, elevation) => {
		const flat = calculateFullTrajectory(profile, range, atmo, wind);
		const result = calculateFullTrajectory(profile, range, atmo, wind, { elevation });
		expect(result).not.toBeNull();
		const distUnit = range.unit === 'm' ? Unit.Meter : Unit.Yard;

		// The rows are at the same distances along the line of sight as the flat table.
		expect(result.trajectory.map((p) => Math.round(p.distance.In(distUnit) * 10) / 10)).toEqual(
			flat.trajectory.map((p) => Math.round(p.distance.In(distUnit) * 10) / 10)
		);

		let compared = 0;
		for (const row of result.trajectory) {
			const distance = row.distance.In(distUnit);
			if (distance === 0) continue;
			// What the Scope View computes for this distance, angle and conditions.
			const effective = scopeEffectiveRange({ distance: String(distance), unit: range.unit }, elevation);
			const point = calculateShotPoint(profile, effective, atmo, wind);
			expect(point).not.toBeNull();
			for (const unit of ['MOA', 'MRAD', 'IN', 'CM']) {
				expect(getElevationValue(row, unit)).toBe(getElevationValue(point, unit));
				expect(getWindageValue(row, unit)).toBe(getWindageValue(point, unit));
			}
			expect(row.slantHeight.In(Unit.Inch)).toBeCloseTo(point.slantHeight.In(Unit.Inch), 6);
			expect(row.dropAngle.In(Unit.MOA)).toBeCloseTo(point.dropAngle.In(Unit.MOA), 6);
			expect(row.velocity.In(Unit.FPS)).toBeCloseTo(point.velocity.In(Unit.FPS), 6);
			expect(row.energy.In(Unit.FootPound)).toBeCloseTo(point.energy.In(Unit.FootPound), 6);
			expect(row.time).toBeCloseTo(point.time, 9);
			compared++;
		}
		expect(compared).toBe(result.trajectory.length - 1);
	});

	it('changes the holds: a 30° shot holds less than a flat one at the same distance', () => {
		const range = { distance: '1000', unit: 'yd', step: '100' };
		const flat = calculateFullTrajectory(P308_G1, range, null, null).trajectory.at(-1);
		const up = calculateFullTrajectory(P308_G1, range, null, null, { elevation: deg('30') }).trajectory.at(-1);
		const down = calculateFullTrajectory(P308_G1, range, null, null, { elevation: deg('-30') }).trajectory.at(-1);
		expect(up.distance.In(Unit.Yard)).toBeCloseTo(1000, 6);
		expect(Math.abs(up.dropAngle.In(Unit.MOA))).toBeLessThan(Math.abs(flat.dropAngle.In(Unit.MOA)));
		// Uphill and downhill give the same hold: only the cosine counts.
		expect(plain(down)).toEqual(plain(up));
	});

	it('gives the zeros, the highest point and the subsonic distance along the line of sight', () => {
		const range = { distance: '1500', unit: 'yd', step: '25' };
		const flat = calculateFullTrajectory(P308_G1, range, null, null);
		const result = calculateFullTrajectory(P308_G1, range, null, null, { elevation: cos('0.8') });
		// The flat crossing at x is reached at x / cos along the line of sight (rounded to 0.1 both).
		expect(result.nearZero).toBeCloseTo(flat.nearZero / 0.8, 0);
		expect(result.farZero).toBeCloseTo(flat.farZero / 0.8, 0);
		expect(result.maxApex.distance).toBeCloseTo(flat.maxApex.distance / 0.8, 0);
		expect(result.maxApex.elevation).toBeCloseTo(flat.maxApex.elevation, 1);
		expect(result.subsonicDist).not.toBeNull();
		expect(result.subsonicDist).toBeCloseTo(flat.subsonicDist / 0.8, 0);
		expect(result.soundSpeedFPS).toBe(flat.soundSpeedFPS);
		// The chart rows are along the line of sight too, and end at the range.
		const last = result.chartPoints.filter((p) => p.distance.In(Unit.Yard) <= 1500 + 1e-6).at(-1);
		expect(last.distance.In(Unit.Yard)).toBeCloseTo(1500, 6);
	});

	it('passes the angle from the page', () => {
		const range = { distance: '800', unit: 'yd', step: '100' };
		const direct = calculateFullTrajectory(P308_G1, range, null, WIND_10MPH, { elevation: deg('20') });
		expect(plain(ballisticPageTrajectory(P308_G1, range, null, WIND_10MPH, deg('20')).result)).toEqual(plain(direct));
	});

	it('gives the flat table rows near the steepest angle the table takes', () => {
		for (const [distance, step] of [['1', '1'], ['100', '1'], ['3000', '1'], ['873.4', '7']]) {
			for (const unit of ['yd', 'm']) {
				const range = { distance, unit, step };
				const rows = calculateFullTrajectory(P308_G1, range, null, null).trajectory.length;
				for (const angle of [String(MIN_TABLE_COSINE), '0.0000013', '0.000005']) {
					const result = calculateFullTrajectory(P308_G1, range, null, null, { elevation: cos(angle) });
					expect(result.trajectory.length).toBe(rows);
				}
			}
		}
	});
});

describe('calculateFullTrajectory with an angle it rejects', () => {
	/** Fail if the engine is reached: the guard must stop the angle before it. */
	const stubEngine = () =>
		vi.spyOn(Calculator.prototype, 'setWeaponZero').mockImplementation(() => {
			throw new Error('setWeaponZero reached');
		});

	const range = { distance: '600', unit: 'yd', step: '25' };

	it.each([
		[deg('90')],
		[deg('-90')],
		[deg('120')],
		[deg('abc')],
		[deg('Infinity')],
		[deg('NaN')],
		[cos('0')],
		[cos('-0.5')],
		[cos('1.01')],
		[cos('2')],
		[cos('abc')]
	])('gives no table, as the Scope View gives no point, for %j', (elevation) => {
		const solver = stubEngine();
		expect(scopeEffectiveRange(range, elevation)).toBeNull();
		expect(calculateFullTrajectory(P308_G1, range, null, WIND_10MPH, { elevation })).toBeNull();
		expect(ballisticPageTrajectory(P308_G1, range, null, WIND_10MPH, elevation)).toEqual({ result: null, altitudeTooLow: false });
		expect(solver).not.toHaveBeenCalled();
	});

	it.each([[cos('0.0000009')], [cos('1e-12')], [cos('1e-300')], [deg('89.99995')], [deg('-89.9999999999')]])(
		'gives no table below MIN_TABLE_COSINE, before the engine: %j',
		(elevation) => {
			const solver = stubEngine();
			expect(calculateFullTrajectory(P308_G1, range, null, WIND_10MPH, { elevation })).toBeNull();
			expect(solver).not.toHaveBeenCalled();
		}
	);

	it('reads a damaged stored angle as a flat table', () => {
		const flat = plain(calculateFullTrajectory(P308_G1, range, null, null));
		for (const stored of ['x', [deg('30')], { angle: {}, unit: 'deg' }, { angle: true, unit: 'deg' }]) {
			const elevation = storedBallisticElevation(stored);
			expect(elevation).toEqual(storedElevation(stored));
			expect(plain(calculateFullTrajectory(P308_G1, range, null, null, { elevation }))).toEqual(flat);
		}
	});
});

describe('storedBallisticElevation', () => {
	it('reads state saved before #173 (no angle) as 0°', () => {
		expect(storedBallisticElevation(undefined)).toEqual({ angle: '0', unit: 'deg' });
		expect(storedBallisticElevation(null)).toEqual({ angle: '0', unit: 'deg' });
	});

	it('keeps a stored angle and reads the rest as the Scope View does', () => {
		expect(storedBallisticElevation({ angle: '12', unit: 'deg' })).toEqual({ angle: '12', unit: 'deg' });
		expect(storedBallisticElevation({ angle: 0.9, unit: 'cos' })).toEqual({ angle: 0.9, unit: 'cos' });
		expect(storedBallisticElevation({ angle: '0.9' })).toEqual({ angle: '0.9', unit: 'cos' });
		expect(storedBallisticElevation(5)).toEqual({ angle: '', unit: 'cos' });
	});
});
