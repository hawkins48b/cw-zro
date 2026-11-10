/**
 * Sea-level pressure corrected for altitude (#107, owner decision of 2026-11-10). The pressure box
 * takes the sea-level (QNH) pressure of a weather report, and the calculators pass the pressure at
 * the site altitude to the engine, by the ISA ratio.
 */
import { describe, it, expect, vi, afterEach } from 'vitest';
import { Atmo, Calculator, UNew, Unit } from 'js-ballistics';
import { hasPositiveDensity } from '#lib/utils/inputLimits.js';
import { calculateTrajectoryValidation } from '#lib/utils/trajectoryValidation.js';
import {
	STANDARD_SEA_LEVEL_HPA,
	stationPressure,
	stationPressureRatio
} from '#lib/utils/stationPressure.js';
import {
	calculateShotPoint,
	calculateFullTrajectory,
	hasNoAirDensity
} from '#lib/utils/ballisticCalculator.js';
import { P308_G1 } from './fixtures/ballisticProfiles.js';

describe('stationPressureRatio', () => {
	it('is exactly 1 at sea level', () => {
		expect(stationPressureRatio(UNew.Meter(0))).toBe(1);
		expect(stationPressureRatio(UNew.Foot(0))).toBe(1);
	});

	it('follows the ISA troposphere', () => {
		// (1 - 0.0065 h / 288.15) ^ 5.255876
		expect(stationPressureRatio(UNew.Meter(1000))).toBeCloseTo(0.88699, 4);
		expect(stationPressureRatio(UNew.Meter(3000))).toBeCloseTo(0.69192, 4);
		expect(stationPressureRatio(UNew.Meter(10000))).toBeCloseTo(0.26091, 4);
		expect(stationPressureRatio(UNew.Meter(-1000))).toBeCloseTo(1.12439, 4);
	});

	it('gives the same ratio in feet and metres', () => {
		expect(stationPressureRatio(UNew.Foot(3280.84))).toBeCloseTo(
			stationPressureRatio(UNew.Meter(1000)),
			6
		);
	});

	it('matches Atmo.standardPressure over the standard sea-level pressure', () => {
		const altitude = UNew.Foot(5000);
		expect(stationPressureRatio(altitude)).toBeCloseTo(
			Atmo.standardPressure(altitude).In(Unit.hPa) / STANDARD_SEA_LEVEL_HPA,
			12
		);
	});
});

describe('stationPressure', () => {
	it('leaves the pressure unchanged at sea level', () => {
		expect(stationPressure(UNew.hPa(1020), UNew.Meter(0)).In(Unit.hPa)).toBeCloseTo(1020, 9);
		expect(stationPressure(UNew.InHg(30.1), UNew.Foot(0)).In(Unit.InHg)).toBeCloseTo(30.1, 9);
	});

	it('gives the standard pressure at altitude for a standard sea-level pressure', () => {
		const altitude = UNew.Meter(1000);
		expect(stationPressure(UNew.hPa(1013.25), altitude).In(Unit.hPa)).toBeCloseTo(
			Atmo.standardPressure(altitude).In(Unit.hPa),
			9
		);
	});

	it('scales hPa and inHg alike', () => {
		const altitude = UNew.Meter(1000);
		expect(stationPressure(UNew.hPa(1000), altitude).In(Unit.hPa)).toBeCloseTo(886.98, 1);
		expect(stationPressure(UNew.InHg(29.92), altitude).In(Unit.InHg)).toBeCloseTo(26.538, 2);
	});

	it('gives the same result for an altitude in feet and in metres', () => {
		const sea = UNew.hPa(1005);
		expect(stationPressure(sea, UNew.Foot(6561.68)).In(Unit.hPa)).toBeCloseTo(
			stationPressure(sea, UNew.Meter(2000)).In(Unit.hPa),
			4
		);
	});

	it('takes the lowest entered pressure at the highest altitude to about 78 hPa, and the highest at the lowest to about 1349 hPa', () => {
		expect(stationPressure(UNew.hPa(300), UNew.Meter(10000)).In(Unit.hPa)).toBeCloseTo(78.3, 1);
		expect(stationPressure(UNew.hPa(1200), UNew.Meter(-1000)).In(Unit.hPa)).toBeCloseTo(1349.3, 1);
	});
});

describe('calculators use the corrected pressure', () => {
	const RANGE = { distance: 1000, unit: 'yd', step: 100 };
	const atmo = (altitude, pressure, altitudeUnit = 'm', pressureUnit = 'hpa') => ({
		altitude: String(altitude),
		altitudeUnit,
		pressure: String(pressure),
		pressureUnit,
		temperature: '15',
		temperatureUnit: 'c',
		humidity: '50'
	});

	it('altitude now changes the result', () => {
		const sea = calculateShotPoint(P308_G1, RANGE, atmo(0, 1013.25), null);
		const high = calculateShotPoint(P308_G1, RANGE, atmo(2000, 1013.25), null);
		expect(high.height.In(Unit.Inch)).toBeGreaterThan(sea.height.In(Unit.Inch));
		expect(high.velocity.In(Unit.FPS)).toBeGreaterThan(sea.velocity.In(Unit.FPS) + 50);
	});

	it('a site at altitude gives the result of sea level with the station pressure', () => {
		// The engine only uses altitude relative to the start, so both describe the same air.
		const station = 1013.25 * stationPressureRatio(UNew.Meter(2000));
		for (const fn of [calculateShotPoint, calculateFullTrajectory]) {
			const high = fn(P308_G1, RANGE, atmo(2000, 1013.25), null);
			const sea = fn(P308_G1, RANGE, atmo(0, station), null);
			const a = fn === calculateShotPoint ? high : high.trajectory.at(-1);
			const b = fn === calculateShotPoint ? sea : sea.trajectory.at(-1);
			expect(JSON.stringify(a)).toBe(JSON.stringify(b));
		}
	});

	it('an altitude in feet gives the result of the same altitude in metres', () => {
		const m = calculateShotPoint(P308_G1, RANGE, atmo(1000, 30, 'm', 'inhg'), null);
		const ft = calculateShotPoint(P308_G1, RANGE, atmo(3280.84, 30, 'ft', 'inhg'), null);
		expect(ft.height.In(Unit.Inch)).toBeCloseTo(m.height.In(Unit.Inch), 2);
		expect(ft.velocity.In(Unit.FPS)).toBeCloseTo(m.velocity.In(Unit.FPS), 1);
	});

	it('altitude 0 with standard values gives the standard atmosphere', () => {
		const custom = calculateShotPoint(P308_G1, RANGE, { ...atmo(0, 1013.25), humidity: '0' }, null);
		const isa = calculateShotPoint(P308_G1, RANGE, null, null);
		expect(custom.height.In(Unit.Inch)).toBeCloseTo(isa.height.In(Unit.Inch), 6);
		expect(custom.velocity.In(Unit.FPS)).toBeCloseTo(isa.velocity.In(Unit.FPS), 6);
	});
});

/**
 * Below 0 air density (#107, proposed guard). At 10000 m, 70 °C and 100 % humidity a sea-level
 * pressure of 300 hPa is 78 hPa at the site, where the library's density goes below 0 and the
 * engine ran for more than 5 minutes. The engine is stubbed here, so a missing guard fails
 * instead of hanging.
 */
describe('air density below 0', () => {
	const THIN_WET_HOT = {
		altitude: '10000',
		altitudeUnit: 'm',
		pressure: '300',
		pressureUnit: 'hpa',
		temperature: '70',
		temperatureUnit: 'c',
		humidity: '100'
	};
	const HANG_PROFILE = { ...P308_G1, bcType: 'G7', bc: '0.01', velocity: '9999', zeroDist: 3000 };
	const RANGE = { distance: 3000, unit: 'yd', step: 25 };

	afterEach(() => vi.restoreAllMocks());

	const stubEngine = () => {
		const stop = () => {
			throw new Error('engine reached');
		};
		const solver = vi.spyOn(Calculator.prototype, 'setWeaponZero').mockImplementation(stop);
		const fire = vi.spyOn(Calculator.prototype, 'fire').mockImplementation(stop);
		return () => solver.mock.calls.length + fire.mock.calls.length;
	};

	it('hasPositiveDensity tells the cases apart', () => {
		const atmo = (p, t, h) =>
			new Atmo({ altitude: UNew.Meter(0), pressure: UNew.hPa(p), temperature: UNew.Celsius(t), humidity: h });
		expect(hasPositiveDensity(atmo(78.27, 70, 1))).toBe(false);
		expect(hasPositiveDensity(atmo(78.27, 70, 0))).toBe(true);
		expect(hasPositiveDensity(atmo(78.27, 15, 1))).toBe(true);
		expect(hasPositiveDensity(atmo(1013.25, 15, 0))).toBe(true);
		expect(hasPositiveDensity({ densityRatio: NaN })).toBe(false);
		expect(hasPositiveDensity({ densityRatio: 0 })).toBe(false);
	});

	it.each([
		['calculateShotPoint', () => calculateShotPoint(HANG_PROFILE, RANGE, THIN_WET_HOT, null)],
		['calculateFullTrajectory', () => calculateFullTrajectory(HANG_PROFILE, RANGE, THIN_WET_HOT, null)],
		[
			'calculateTrajectoryValidation',
			() => calculateTrajectoryValidation(HANG_PROFILE, RANGE, 'distance', '100', 'in', 'velocity', THIN_WET_HOT)
		]
	])('%s gives no result before the engine', (_, run) => {
		const calls = stubEngine();
		const result = run();
		expect(calls()).toBe(0);
		if (result && typeof result === 'object' && 'error' in result) expect(result.error).toBeTruthy();
		else expect(result).toBeNull();
	});

	it('hasNoAirDensity flags only usable values whose density is not above 0', () => {
		expect(hasNoAirDensity(THIN_WET_HOT)).toBe(true);
		expect(hasNoAirDensity({ ...THIN_WET_HOT, humidity: '0' })).toBe(false);
		expect(hasNoAirDensity({ ...THIN_WET_HOT, pressure: '1013' })).toBe(false);
		expect(hasNoAirDensity({ ...THIN_WET_HOT, pressure: '299' })).toBe(false); // out of limits
		expect(hasNoAirDensity(null)).toBe(false);
	});

	it('the same air with no humidity still reaches the engine', () => {
		const calls = stubEngine();
		calculateShotPoint(HANG_PROFILE, RANGE, { ...THIN_WET_HOT, humidity: '0' }, null);
		expect(calls()).toBeGreaterThan(0);
	});
});
