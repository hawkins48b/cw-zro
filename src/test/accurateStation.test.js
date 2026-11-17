/**
 * The Accurate atmosphere is station pressure only (#172, owner decision of 2026-11-17).
 *
 * - The engine gets ACCURATE_ENGINE_ALTITUDE_M, never the stored altitude. With station pressure the
 *   altitude changes no result, except where the engine's minimum altitude ends the flight; at the
 *   fixed altitude that floor is below the engine's maximum drop, so it never ends a flight.
 * - A saved Accurate state with QNH is converted once, on read, to the station pressure at its saved
 *   altitude, in the box's unit (1 decimal hPa, 2 decimals inHg): its result stays the same up to
 *   that rounding, measured here.
 */
import { describe, it, expect, vi, afterEach } from 'vitest';
import { Unit } from 'js-ballistics';
import { ENGINE_CONFIG } from '#lib/utils/ballisticEngine.js';
import { calculateShotPoint, hasNoAirDensity } from '#lib/utils/ballisticCalculator.js';
import { PRESSURE_LIMITS, TEMPERATURE_LIMITS } from '#lib/utils/inputLimits.js';
import {
	ACCURATE_ENGINE_ALTITUDE_M,
	accurateStationAtmosphere,
	scopeAtmosphereParams,
	stationPressureBox
} from '#lib/utils/scopeAtmosphere.js';
import { storedBallisticAtmosphere, storedScopeAtmosphere } from '#lib/utils/storedState.js';
import { P223_G1, P308_G1, P338_G7_METRIC, WIND_4MPS } from './fixtures/ballisticProfiles.js';

const throwsAsText = JSON.parse('{"toString":1}');

/** Station air measured on site, with a stored altitude the Accurate mode no longer shows. */
const STATION = {
	mode: 'accurate',
	pressureRef: 'station',
	altitude: '1500',
	altitudeUnit: 'm',
	pressure: '850',
	pressureUnit: 'hpa',
	temperature: '10',
	temperatureUnit: 'c',
	humidity: '50'
};

/** The custom atmosphere of before #172: the boxes as entered, with the stored altitude. */
const asBefore = (atmosphere) => {
	const { mode, ...boxes } = atmosphere;
	return boxes;
};

const shot = (profile, atmosphere, distance, options) =>
	calculateShotPoint(profile, { distance: String(distance), unit: 'm' }, atmosphere, WIND_4MPS, options);

afterEach(() => {
	vi.restoreAllMocks();
});

describe('the engine altitude of the Accurate mode', () => {
	it('puts the minimum altitude below the maximum drop, inside the altitude limits', () => {
		const feet = ACCURATE_ENGINE_ALTITUDE_M / 0.3048;
		// The bullet reaches the floor only after a drop of feet - minimumAltitude, which is more than
		// the engine's maximum drop, so the maximum drop ends the flight first.
		expect(feet - ENGINE_CONFIG.minimumAltitude).toBeGreaterThan(-ENGINE_CONFIG.maximumDrop);
		expect(ACCURATE_ENGINE_ALTITUDE_M).toBeLessThanOrEqual(10000);
	});

	it('gives the result of the stored altitude, which station pressure does not use', () => {
		// Measured on the test loads from -1000 to 10000 m and 100 to 3000 m: at most 0.0008 cm of drop.
		for (const profile of [P223_G1, P308_G1, P338_G7_METRIC]) {
			for (const distance of [300, 1000, 2000]) {
				const now = shot(profile, scopeAtmosphereParams(STATION), distance);
				expect(now).not.toBeNull();
				for (const altitude of ['0', '500', '1500', '3000', '6000']) {
					const before = shot(profile, asBefore({ ...STATION, altitude }), distance);
					expect(Math.abs(now.height.In(Unit.Centimeter) - before.height.In(Unit.Centimeter))).toBeLessThan(0.001);
					expect(now.windage.In(Unit.Centimeter)).toBeCloseTo(before.windage.In(Unit.Centimeter), 6);
					expect(now.velocity.In(Unit.MPS)).toBeCloseTo(before.velocity.In(Unit.MPS), 6);
					expect(now.time).toBeCloseTo(before.time, 9);
				}
			}
		}
	});

	it('is not stopped by the minimum altitude where a stored altitude stopped the shot', () => {
		vi.spyOn(console, 'error').mockImplementation(() => {});
		// The .223 drops more than 430 m at 3000 m: at altitude 0 the engine ends the flight at its floor.
		const report = {};
		expect(shot(P223_G1, asBefore({ ...STATION, altitude: '0' }), 3000, { report })).toBeNull();
		expect(report.minimumAltitude).toBe(true);
		const now = shot(P223_G1, scopeAtmosphereParams({ ...STATION, altitude: '0' }), 3000, { report });
		expect(now).not.toBeNull();
		expect(report.minimumAltitude).toBe(false);
		// The same as where the floor was far enough below.
		const high = shot(P223_G1, asBefore({ ...STATION, altitude: '1500' }), 3000);
		expect(Math.abs(now.height.In(Unit.Centimeter) - high.height.In(Unit.Centimeter))).toBeLessThan(0.001);
		// A low stored altitude stopped even a 1000 m shot of the .308.
		expect(shot(P308_G1, asBefore({ ...STATION, altitude: '-1000' }), 1000)).toBeNull();
		expect(shot(P308_G1, scopeAtmosphereParams({ ...STATION, altitude: '-1000' }), 1000)).not.toBeNull();
	});

	it('leaves station air with a density at every corner of the limits, so Accurate never has none', () => {
		for (const [pressure, pressureUnit] of [[String(PRESSURE_LIMITS.hpa.min), 'hpa'], [String(PRESSURE_LIMITS.inhg.min), 'inhg']]) {
			for (const temperature of [TEMPERATURE_LIMITS.c.min, TEMPERATURE_LIMITS.c.max]) {
				for (const humidity of ['0', '100']) {
					const params = scopeAtmosphereParams({ ...STATION, pressure, pressureUnit, temperature: String(temperature), humidity });
					expect(hasNoAirDensity(params)).toBe(false);
				}
			}
		}
	});
});

describe('stationPressureBox', () => {
	it('converts a QNH box to station pressure at the altitude, 1 decimal in hPa and 2 in inHg', () => {
		expect(stationPressureBox('1013.25', 'hpa', '0', 'm')).toBe('1013.3');
		expect(stationPressureBox('29.92', 'inhg', '0', 'ft')).toBe('29.92');
		expect(stationPressureBox('1019', 'hpa', '1234', 'm')).toBe('878.5'); // 878.46
		expect(stationPressureBox('29.92', 'inhg', '3000', 'ft')).toBe('26.82'); // 26.8167
		expect(stationPressureBox('1019,0', 'hpa', '1234,0', 'm')).toBe('878.5'); // decimal comma, as the calculators read it
		expect(stationPressureBox(1019, 'hpa', 1234, 'm')).toBe('878.5');
		// Any unit but hpa is inHg, any unit but m is feet, as the calculators read them.
		expect(stationPressureBox('29.92', 'mbar', '3000', 'yd')).toBe('26.82');
	});

	it('keeps a pressure out of its limits as it is: still no result, with the same message', () => {
		for (const pressure of ['', 'x', '299', '1201', throwsAsText, null, ['1000']]) {
			expect(stationPressureBox(pressure, 'hpa', '500', 'm')).toBe(pressure);
		}
		expect(stationPressureBox('8.85', 'inhg', '500', 'ft')).toBe('8.85');
	});

	it('empties a usable pressure whose altitude is out of its limits: there was no result, and still is none', () => {
		for (const altitude of ['', 'x', '10001', '-1001', 'Infinity', throwsAsText, null, ['100']]) {
			expect(stationPressureBox('1013', 'hpa', altitude, 'm')).toBe('');
		}
	});

	it('keeps a converted value that falls out of the limits, so the box shows its message', () => {
		expect(stationPressureBox('1013.25', 'hpa', '10000', 'm')).toBe('264.4');
		expect(stationPressureBox('1200', 'hpa', '-1000', 'm')).toBe('1349.3');
	});
});

describe('accurateStationAtmosphere', () => {
	it('returns any other mode and a station state as they are', () => {
		for (const atmosphere of [
			{ ...STATION, mode: 'isa', pressureRef: 'qnh' },
			{ ...STATION, mode: 'estimate', pressureRef: 'qnh' },
			STATION
		]) {
			expect(accurateStationAtmosphere(atmosphere)).toBe(atmosphere);
		}
	});

	it('converts an Accurate state with QNH, or with no reference, and keeps its altitude for ISA and Estimate', () => {
		for (const pressureRef of ['qnh', undefined, 'fog']) {
			expect(accurateStationAtmosphere({ ...STATION, pressureRef, pressure: '1019', altitude: '1234' })).toEqual({
				...STATION,
				pressureRef: 'station',
				pressure: '878.5',
				altitude: '1234'
			});
		}
	});
});

describe('a saved Accurate QNH state gives the same result, up to the rounding of its box', () => {
	// The shift is that of the rounding: up to 0.05 hPa or 0.005 inHg (0.017 % at 29 inHg). Measured on
	// the test loads at 300 to 1500 m: at most 0.15 cm (0.001 mil) for hPa boxes and 1.6 cm (0.011 mil)
	// for inHg boxes, both on the .223 at 1500 m.
	const SAVED = [
		['hPa', { pressure: '1019', pressureUnit: 'hpa', altitude: '1234', altitudeUnit: 'm', temperature: '10', temperatureUnit: 'c', humidity: '50' }, '878.5', 0.002],
		['inHg', { pressure: '30.12', pressureUnit: 'inhg', altitude: '4321', altitudeUnit: 'ft', temperature: '40', temperatureUnit: 'f', humidity: '50' }, '25.7', 0.015]
	];

	it.each(SAVED)('%s, on the Scope View and the Ballistic page', (_, boxes, station, mil) => {
		const saved = { useISA: false, mode: 'accurate', pressureRef: 'qnh', ...boxes };
		const scope = storedScopeAtmosphere(saved);
		expect(scope).toMatchObject({ pressureRef: 'station', pressure: station, altitude: boxes.altitude });
		expect(storedBallisticAtmosphere(saved)).toEqual(scope);
		// The page before #172: the QNH box at the saved altitude.
		const before = asBefore({ ...boxes, mode: 'accurate', pressureRef: 'qnh' });
		for (const profile of [P223_G1, P308_G1, P338_G7_METRIC]) {
			for (const distance of [300, 1000, 1500]) {
				const then = shot(profile, before, distance);
				const now = shot(profile, scopeAtmosphereParams(scope), distance);
				expect(Math.abs(now.dropAngle.In(Unit.MIL) - then.dropAngle.In(Unit.MIL))).toBeLessThan(mil);
				// And exactly the rounded box entered as station pressure at the saved altitude.
				const rounded = shot(profile, { ...before, pressure: station, pressureRef: 'station' }, distance);
				expect(Math.abs(now.height.In(Unit.Centimeter) - rounded.height.In(Unit.Centimeter))).toBeLessThan(0.001);
			}
		}
	});

	it('converts a Ballistic state saved before #151 as QNH, whatever reference it holds', () => {
		const [, boxes, station] = SAVED[0];
		for (const pressureRef of ['station', 'qnh', undefined]) {
			expect(storedBallisticAtmosphere({ useISA: false, pressureRef, ...boxes })).toMatchObject({ mode: 'accurate', pressureRef: 'station', pressure: station });
		}
		// The Scope View of #148 kept a station reference without a mode: it stays as entered.
		expect(storedScopeAtmosphere({ useISA: false, pressureRef: 'station', ...boxes })).toMatchObject({ pressureRef: 'station', pressure: '1019' });
	});

	it('reads the same twice: a converted state is not converted again', () => {
		const [, boxes] = SAVED[1];
		const once = storedScopeAtmosphere({ mode: 'accurate', pressureRef: 'qnh', ...boxes });
		expect(storedScopeAtmosphere(once)).toEqual(once);
		expect(storedBallisticAtmosphere(once)).toEqual(once);
	});
});
