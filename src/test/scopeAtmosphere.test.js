/**
 * The Scope View atmosphere modes, wind presets and stored view state (#148, owner decisions of
 * 2026-11-16). ISA, Estimate and Accurate give calculateShotPoint an atmosphere in the shape it
 * already reads; Accurate with QNH is the custom atmosphere of before #148. A saved state from
 * before #148 must give the same result as the page computed then. The engine is stubbed wherever
 * no result is expected, so a missing guard fails on the stub instead of running the shot.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { Atmo, UNew, Unit } from 'js-ballistics';
import { Calculator } from '#lib/utils/ballisticEngine.js';
import { calculateShotPoint, hasNoAirDensity } from '#lib/utils/ballisticCalculator.js';
import {
	WEATHER_HUMIDITY,
	formatUsedAtmosphere,
	scopeAtmosphereParams,
	usedScopeAtmosphere
} from '#lib/utils/scopeAtmosphere.js';
import { STANDARD_SEA_LEVEL_HPA } from '#lib/utils/stationPressure.js';
import {
	storedAtmosphere,
	storedElevation,
	storedRange,
	storedResultMode,
	storedScopeAtmosphere
} from '#lib/utils/storedState.js';
import { scopeEffectiveRange } from '#lib/utils/scopeRange.js';
import { WIND_PRESETS, activeWindPreset, windPresetSpeed } from '#lib/utils/windPreset.js';
import {
	ATMO_COLD_METRIC,
	ATMO_HOT_ALTITUDE,
	P223_G1,
	P308_G1,
	P338_G7_METRIC,
	WIND_10MPH,
	WIND_4MPS
} from './fixtures/ballisticProfiles.js';

const throwsAsText = JSON.parse('{"toString":1}');

/** The default boxes of the Scope View store. */
const ISA_BOXES = {
	altitude: '0',
	altitudeUnit: 'ft',
	pressure: '29.92',
	pressureUnit: 'inhg',
	temperature: '59',
	temperatureUnit: 'f',
	humidity: '0'
};

/** A stored atmosphere as the store reads it. */
const atmo = (fields) => storedScopeAtmosphere({ ...ISA_BOXES, ...fields });

/** The numbers of a shot point, for exact comparison. */
const numbers = (point) =>
	point && {
		drop: point.height.In(Unit.Inch),
		windage: point.windage.In(Unit.Inch),
		velocity: point.velocity.In(Unit.FPS),
		energy: point.energy.In(Unit.FootPound),
		time: point.time
	};

const shot = (profile, atmosphere, wind = null, distance = '600', unit = 'yd') =>
	numbers(calculateShotPoint(profile, { distance, unit }, atmosphere, wind));

/** The Atmo calculateShotPoint builds from custom values: the same steps as customAtmo. */
const pressureAtSite = (params) => {
	const altitude = params.altitudeUnit === 'm' ? UNew.Meter(Number(params.altitude)) : UNew.Foot(Number(params.altitude));
	return Atmo.standardPressure(altitude).In(Unit.hPa);
};

describe('storedScopeAtmosphere', () => {
	it('reads a state saved before #148 with useISA as the ISA mode', () => {
		const read = storedScopeAtmosphere({ useISA: true, ...ISA_BOXES });
		expect(read).toEqual({ useISA: true, ...ISA_BOXES, mode: 'isa', weather: 'cloudy', pressureRef: 'qnh' });
	});

	it('reads a custom state saved before #148 as Accurate with QNH', () => {
		const read = storedScopeAtmosphere({ useISA: false, ...ATMO_HOT_ALTITUDE });
		expect(read).toMatchObject({ useISA: false, mode: 'accurate', pressureRef: 'qnh', ...ATMO_HOT_ALTITUDE });
	});

	it.each(['isa', 'estimate', 'accurate'])('keeps the stored mode %s, and useISA follows it', (mode) => {
		expect(storedScopeAtmosphere({ useISA: true, mode }).mode).toBe(mode);
		expect(storedScopeAtmosphere({ useISA: false, mode }).useISA).toBe(mode === 'isa');
	});

	it.each([
		['null', null],
		['text', 'ISA'],
		['a number', 1],
		['an object', {}],
		['an object that cannot become text', throwsAsText],
		['an array', ['isa']],
		['a prototype key', 'toString']
	])('reads a damaged mode (%s) from useISA, as the page did before', (_, mode) => {
		expect(storedScopeAtmosphere({ useISA: true, mode }).mode).toBe('isa');
		expect(storedScopeAtmosphere({ useISA: false, mode }).mode).toBe('accurate');
	});

	it.each([
		['null', null],
		['text', 'fog'],
		['an object', {}],
		['an array', ['rain']],
		['a prototype key', 'toString'],
		['an object that cannot become text', throwsAsText]
	])('reads a damaged weather (%s) as cloudy and pressureRef as qnh', (_, value) => {
		const read = storedScopeAtmosphere({ mode: 'estimate', weather: value, pressureRef: value });
		expect(read.weather).toBe('cloudy');
		expect(read.pressureRef).toBe('qnh');
	});

	it('keeps each weather and the station reference', () => {
		for (const weather of ['sunny', 'cloudy', 'rain', 'snow']) {
			expect(storedScopeAtmosphere({ weather }).weather).toBe(weather);
		}
		expect(storedScopeAtmosphere({ pressureRef: 'station' }).pressureRef).toBe('station');
	});

	it('reads a damaged section as Accurate with empty boxes, which gives no result', () => {
		for (const section of [null, 'x', 5, [ISA_BOXES], throwsAsText]) {
			const read = storedScopeAtmosphere(section);
			expect(read).toMatchObject({ mode: 'accurate', useISA: false, altitude: '', pressure: '' });
			expect(scopeAtmosphereParams(read)).not.toBeNull();
		}
	});
});

describe('storedResultMode', () => {
	it('keeps hold and reads anything else as dial', () => {
		expect(storedResultMode('hold')).toBe('hold');
		for (const value of ['dial', undefined, null, 'HOLD', 1, {}, ['hold'], throwsAsText]) {
			expect(storedResultMode(value)).toBe('dial');
		}
	});
});

describe('scopeAtmosphereParams', () => {
	it('is the standard atmosphere of before #148 (null) in ISA at altitude 0', () => {
		expect(scopeAtmosphereParams(atmo({ mode: 'isa' }))).toBeNull();
		expect(scopeAtmosphereParams(atmo({ mode: 'isa', altitude: '0', altitudeUnit: 'm' }))).toBeNull();
		expect(scopeAtmosphereParams(atmo({ mode: 'isa', altitude: 0 }))).toBeNull();
	});

	it('gives the ICAO atmosphere of the altitude in ISA elsewhere', () => {
		const params = scopeAtmosphereParams(atmo({ mode: 'isa', altitude: '1000', altitudeUnit: 'm' }));
		expect(params).toMatchObject({ pressure: STANDARD_SEA_LEVEL_HPA, pressureUnit: 'hpa', pressureRef: 'qnh', temperatureUnit: 'c', humidity: 0 });
		const icao = Atmo.icao({ altitude: UNew.Meter(1000) });
		expect(params.temperature).toBeCloseTo(icao.temperature.In(Unit.Celsius), 12);
		expect(pressureAtSite(params)).toBeCloseTo(icao.pressure.In(Unit.hPa), 9);
	});

	it('ignores the pressure, temperature and humidity boxes in ISA', () => {
		const a = scopeAtmosphereParams(atmo({ mode: 'isa', altitude: '3000' }));
		const b = scopeAtmosphereParams(atmo({ mode: 'isa', altitude: '3000', pressure: '', temperature: 'x', humidity: '100' }));
		expect(b).toEqual(a);
	});

	it.each(Object.entries(WEATHER_HUMIDITY))('uses %s humidity %d % in Estimate', (weather, humidity) => {
		const params = scopeAtmosphereParams(atmo({ mode: 'estimate', weather, altitude: '5000', temperature: '85' }));
		expect(params).toEqual({
			altitude: '5000',
			altitudeUnit: 'ft',
			pressure: STANDARD_SEA_LEVEL_HPA,
			pressureUnit: 'hpa',
			pressureRef: 'qnh',
			temperature: '85',
			temperatureUnit: 'f',
			humidity
		});
	});

	it('has the owner’s weather humidities', () => {
		expect(WEATHER_HUMIDITY).toEqual({ sunny: 40, cloudy: 65, rain: 90, snow: 80 });
	});

	it('uses the cloudy humidity for a weather that is not one', () => {
		const params = scopeAtmosphereParams({ ...atmo({ mode: 'estimate' }), weather: 'toString' });
		expect(params.humidity).toBe(65);
	});

	it('passes the boxes as entered in Accurate, with the reference', () => {
		expect(scopeAtmosphereParams(atmo({ mode: 'accurate', ...ATMO_COLD_METRIC }))).toEqual({ ...ATMO_COLD_METRIC, pressureRef: 'qnh' });
		expect(scopeAtmosphereParams(atmo({ mode: 'accurate', pressureRef: 'station', ...ATMO_COLD_METRIC }))).toEqual({
			...ATMO_COLD_METRIC,
			pressureRef: 'station'
		});
	});
});

describe('the atmosphere modes in calculateShotPoint', () => {
	it('ISA at altitude 0 gives exactly the standard result', () => {
		expect(shot(P308_G1, scopeAtmosphereParams(atmo({ mode: 'isa' })))).toEqual(shot(P308_G1, null));
	});

	it('ISA at an altitude equals the same air entered as station pressure, and differs from sea level', () => {
		const altitude = UNew.Meter(1500);
		const isa = shot(P338_G7_METRIC, scopeAtmosphereParams(atmo({ mode: 'isa', altitude: '1500', altitudeUnit: 'm' })), null, '1000', 'm');
		const entered = shot(
			P338_G7_METRIC,
			{
				altitude: '1500',
				altitudeUnit: 'm',
				pressure: String(Atmo.standardPressure(altitude).In(Unit.hPa)),
				pressureUnit: 'hpa',
				pressureRef: 'station',
				temperature: String(Atmo.standardTemperature(altitude).In(Unit.Celsius)),
				temperatureUnit: 'c',
				humidity: '0'
			},
			null,
			'1000',
			'm'
		);
		const seaLevel = shot(P338_G7_METRIC, null, null, '1000', 'm');
		for (const key of Object.keys(isa)) expect(isa[key]).toBeCloseTo(entered[key], 6);
		expect(isa.drop).not.toBeCloseTo(seaLevel.drop, 1);
	});

	it('Estimate equals Accurate with the standard sea-level pressure, the temperature and the weather humidity', () => {
		const estimate = shot(P308_G1, scopeAtmosphereParams(atmo({ mode: 'estimate', weather: 'rain', altitude: '5000', temperature: '85' })), WIND_10MPH);
		const accurate = shot(
			P308_G1,
			scopeAtmosphereParams(atmo({ mode: 'accurate', altitude: '5000', pressure: '1013.25', pressureUnit: 'hpa', temperature: '85', humidity: '90' })),
			WIND_10MPH
		);
		expect(estimate).toEqual(accurate);
	});

	it('gives a different result for each weather (humidity is used)', () => {
		const drops = Object.keys(WEATHER_HUMIDITY).map(
			(weather) => shot(P308_G1, scopeAtmosphereParams(atmo({ mode: 'estimate', weather, altitude: '5000', temperature: '95' })), null, '1000').velocity
		);
		expect(new Set(drops).size).toBe(4);
	});

	it('Station uses the pressure as entered: the recorded station pressure of a fixture gives its QNH result', () => {
		// ATMO_HOT_ALTITUDE holds the QNH equivalent of 24.9 inHg measured at 5000 ft (#107).
		const qnh = shot(P308_G1, scopeAtmosphereParams(atmo({ mode: 'accurate', ...ATMO_HOT_ALTITUDE })), WIND_10MPH);
		const station = shot(
			P308_G1,
			scopeAtmosphereParams(atmo({ mode: 'accurate', pressureRef: 'station', ...ATMO_HOT_ALTITUDE, pressure: '24.9' })),
			WIND_10MPH
		);
		for (const key of Object.keys(qnh)) expect(station[key]).toBeCloseTo(qnh[key], 6);
	});

	it('Station and QNH agree at altitude 0 and differ above it', () => {
		const at = (altitude, pressureRef) =>
			shot(P308_G1, scopeAtmosphereParams(atmo({ mode: 'accurate', pressureRef, altitude, pressure: '29.5' })), null, '1000');
		expect(at('0', 'station')).toEqual(at('0', 'qnh'));
		expect(at('6000', 'station').drop).not.toBeCloseTo(at('6000', 'qnh').drop, 1);
	});

	it('checks the air density on the atmosphere actually used', () => {
		// At 10000 m, 70 °C and 100 % (#107): 300 hPa as QNH is about 79 hPa at the site, where the
		// air has no density; 300 hPa measured at the site has one.
		const box = { mode: 'accurate', altitude: '10000', altitudeUnit: 'm', pressure: '300', pressureUnit: 'hpa', temperature: '70', temperatureUnit: 'c', humidity: '100' };
		expect(hasNoAirDensity(scopeAtmosphereParams(atmo({ ...box, pressureRef: 'qnh' })))).toBe(true);
		expect(hasNoAirDensity(scopeAtmosphereParams(atmo({ ...box, pressureRef: 'station' })))).toBe(false);
		expect(hasNoAirDensity(null)).toBe(false);
	});

	it('has air density in ISA and Estimate at the ends of the limits', () => {
		for (const altitude of ['-1000', '10000']) {
			expect(hasNoAirDensity(scopeAtmosphereParams(atmo({ mode: 'isa', altitude, altitudeUnit: 'm' })))).toBe(false);
			for (const temperature of ['-90', '70']) {
				for (const weather of Object.keys(WEATHER_HUMIDITY)) {
					expect(hasNoAirDensity(scopeAtmosphereParams(atmo({ mode: 'estimate', weather, altitude, altitudeUnit: 'm', temperature, temperatureUnit: 'c' })))).toBe(false);
				}
			}
		}
	});
});

describe('the atmosphere guards apply in every mode, before the engine', () => {
	let solver;
	let fire;
	const reached = () => solver.mock.calls.length + fire.mock.calls.length > 0;

	beforeEach(() => {
		solver = vi.spyOn(Calculator.prototype, 'setWeaponZero').mockImplementation(() => {
			throw new Error('setWeaponZero reached');
		});
		fire = vi.spyOn(Calculator.prototype, 'fire').mockImplementation(() => {
			throw new Error('fire reached');
		});
		vi.spyOn(console, 'error').mockImplementation(() => {});
	});

	afterEach(() => {
		vi.restoreAllMocks();
	});

	const run = (fields) =>
		calculateShotPoint(P223_G1, { distance: '500', unit: 'yd' }, scopeAtmosphereParams(atmo(fields)), null);

	it('reaches the stub with usable values in each mode, so the stub is live', () => {
		for (const mode of ['isa', 'estimate', 'accurate']) {
			solver.mockClear();
			fire.mockClear();
			run({ mode, altitude: '3000' });
			expect(reached()).toBe(true);
		}
	});

	const BAD_ALTITUDES = ['', 'x', '32809', '-3282', 'Infinity', '1e9', throwsAsText, null, ['100']];

	it.each(['isa', 'estimate', 'accurate'])('stops an altitude out of its limits in %s', (mode) => {
		for (const altitude of BAD_ALTITUDES) {
			expect(run({ mode, altitude })).toBeNull();
		}
		expect(reached()).toBe(false);
	});

	it.each(['estimate', 'accurate'])('stops a temperature out of its limits in %s', (mode) => {
		for (const temperature of ['', 'x', '159', '-131', 'NaN', '1e400', throwsAsText]) {
			expect(run({ mode, altitude: '1000', temperature })).toBeNull();
		}
		expect(reached()).toBe(false);
	});

	it.each(['qnh', 'station'])('stops a pressure out of its limits in Accurate with %s', (pressureRef) => {
		for (const pressure of ['', '8.85', '35.5', '-29.92', throwsAsText]) {
			expect(run({ mode: 'accurate', pressureRef, pressure })).toBeNull();
		}
		expect(reached()).toBe(false);
	});

	it('stops QNH air with no density at the site before the engine', () => {
		expect(
			run({ mode: 'accurate', pressureRef: 'qnh', altitude: '10000', altitudeUnit: 'm', pressure: '300', pressureUnit: 'hpa', temperature: '70', temperatureUnit: 'c', humidity: '100' })
		).toBeNull();
		expect(reached()).toBe(false);
	});
});

describe('usedScopeAtmosphere and formatUsedAtmosphere', () => {
	const format = (used) =>
		formatUsedAtmosphere(used, {
			number: (value, options) => new Intl.NumberFormat('en', options).format(value),
			units: { hpa: 'hPa', inhg: 'inHg', c: '°C', f: '°F' }
		});

	it('shows the standard sea-level air in ISA at 0, in the units of the boxes', () => {
		expect(format(usedScopeAtmosphere(atmo({ mode: 'isa' })))).toEqual({ pressure: '29.92 inHg', temperature: '59 °F', humidity: '0 %' });
		expect(format(usedScopeAtmosphere(atmo({ mode: 'isa', pressureUnit: 'hpa', temperatureUnit: 'c' })))).toEqual({
			pressure: '1,013 hPa',
			temperature: '15 °C',
			humidity: '0 %'
		});
	});

	it('shows the standard air at the altitude in ISA', () => {
		const used = usedScopeAtmosphere(atmo({ mode: 'isa', altitude: '1000', altitudeUnit: 'm', pressureUnit: 'hpa', temperatureUnit: 'c' }));
		expect(used.pressure).toBeCloseTo(898.75, 2);
		expect(used.temperature).toBeCloseTo(8.5, 9);
		expect(format(used)).toEqual({ pressure: '899 hPa', temperature: '8.5 °C', humidity: '0 %' });
	});

	it('shows the site pressure, the entered temperature and the weather humidity in Estimate', () => {
		const used = usedScopeAtmosphere(atmo({ mode: 'estimate', weather: 'snow', altitude: '5000', temperature: '-4' }));
		expect(format(used)).toEqual({ pressure: '24.90 inHg', temperature: '-4 °F', humidity: '80 %' });
	});

	it('shows nothing in Accurate, and for an altitude or Estimate temperature out of its limits', () => {
		expect(usedScopeAtmosphere(atmo({ mode: 'accurate' }))).toBeNull();
		expect(usedScopeAtmosphere(atmo({ mode: 'isa', altitude: '' }))).toBeNull();
		expect(usedScopeAtmosphere(atmo({ mode: 'isa', altitude: '40000' }))).toBeNull();
		expect(usedScopeAtmosphere(atmo({ mode: 'estimate', temperature: '200' }))).toBeNull();
		expect(usedScopeAtmosphere(atmo({ mode: 'estimate', temperature: throwsAsText }))).toBeNull();
		expect(format(null)).toBeNull();
	});

	it('never shows -0', () => {
		const used = { pressure: 1000, pressureUnit: 'hpa', temperature: -0.04, temperatureUnit: 'c', humidity: 0 };
		expect(format(used).temperature).toBe('0 °C');
	});
});

describe('wind presets', () => {
	it('has the owner’s speeds in m/s and mph', () => {
		expect(WIND_PRESETS).toEqual({
			mps: { none: '0', light: '3.5', strong: '9' },
			mph: { none: '0', light: '7.8', strong: '20.1' }
		});
		// mph is m/s converted and rounded to 0.1.
		expect(UNew.MPS(3.5).In(Unit.MPH).toFixed(1)).toBe('7.8');
		expect(UNew.MPS(9).In(Unit.MPH).toFixed(1)).toBe('20.1');
	});

	it('sets the preset speed in the unit shown; any other unit is mph, as shotWinds reads it', () => {
		expect(windPresetSpeed('light', 'mps')).toBe('3.5');
		expect(windPresetSpeed('strong', 'mph')).toBe('20.1');
		expect(windPresetSpeed('strong', 'kmh')).toBe('20.1');
		expect(windPresetSpeed('none', 'mps')).toBe('0');
		for (const preset of ['gale', 'toString', null, undefined, {}, ['light']]) {
			expect(windPresetSpeed(preset, 'mps')).toBeNull();
		}
	});

	it.each([
		['0', 'mph', 'none'],
		['0.0', 'mps', 'none'],
		['7.8', 'mph', 'light'],
		['7,8', 'mph', 'light'],
		[' 20.10 ', 'mph', 'strong'],
		['3.5', 'mps', 'light'],
		[9, 'mps', 'strong'],
		['3.5', 'mph', null],
		['7.8', 'mps', null],
		['10', 'mph', null],
		['', 'mph', null],
		['x', 'mph', null],
		['-3.5', 'mps', null],
		[null, 'mph', null],
		[throwsAsText, 'mph', null]
	])('marks %j %s as %s', (speed, unit, preset) => {
		expect(activeWindPreset(speed, unit)).toBe(preset);
	});
});

describe('a Scope View state saved on develop gives the same result after #148', () => {
	// The page before #148: useISA → null, else the boxes as storedAtmosphere read them; the angle
	// section started closed, so the range had no angle.
	const developResult = (state, profile) =>
		numbers(
			calculateShotPoint(
				profile,
				scopeEffectiveRange(storedRange(state.range), null),
				state.atmosphere.useISA ? null : storedAtmosphere(state.atmosphere),
				state.wind
			)
		);
	// The page now: the mode from the stored atmosphere, and the stored angle always applies.
	const nowResult = (state, profile) =>
		numbers(
			calculateShotPoint(
				profile,
				scopeEffectiveRange(storedRange(state.range), storedElevation(state.elevation)),
				scopeAtmosphereParams(storedScopeAtmosphere(state.atmosphere)),
				state.wind
			)
		);

	const STATES = [
		[
			'the default ISA state',
			{
				range: { distance: '500', unit: 'yd' },
				elevation: { angle: '0', unit: 'deg' },
				atmosphere: { useISA: true, ...ISA_BOXES },
				wind: { speed: '0', speedUnit: 'mph', direction: '90', directionConvention: 'from-target' }
			},
			P308_G1
		],
		[
			'ISA with wind',
			{
				range: { distance: '800', unit: 'yd' },
				elevation: { angle: '', unit: 'deg' },
				atmosphere: { useISA: true, ...ISA_BOXES },
				wind: { ...WIND_10MPH, directionConvention: 'from-target' }
			},
			P223_G1
		],
		[
			'a custom imperial atmosphere',
			{
				range: { distance: '700', unit: 'yd' },
				elevation: { angle: '0', unit: 'deg' },
				atmosphere: { useISA: false, ...ATMO_HOT_ALTITUDE },
				wind: { ...WIND_10MPH, directionConvention: 'from-target' }
			},
			P308_G1
		],
		[
			'a custom metric atmosphere',
			{
				range: { distance: '900', unit: 'm' },
				elevation: { angle: '', unit: 'cos' },
				atmosphere: { useISA: false, ...ATMO_COLD_METRIC },
				wind: { ...WIND_4MPS, directionConvention: 'from-target' }
			},
			P338_G7_METRIC
		]
	];

	it.each(STATES)('%s', (_, state, profile) => {
		const before = developResult(state, profile);
		expect(before).not.toBeNull();
		expect(nowResult(state, profile)).toEqual(before);
	});

	it('applies a stored angle now (owner decision): 30° shoots at the cosine range', () => {
		const [, state, profile] = STATES[0];
		const angled = { ...state, elevation: { angle: '30', unit: 'deg' } };
		const flat = { ...state, range: { distance: String(500 * Math.cos(Math.PI / 6)), unit: 'yd' } };
		expect(nowResult(angled, profile)).toEqual(developResult(flat, profile));
		expect(nowResult(angled, profile)).not.toEqual(developResult(angled, profile));
	});
});
