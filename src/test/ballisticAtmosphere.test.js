/**
 * The Ballistic page atmosphere modes (#151, owner decision): the page now uses the Scope View's
 * ISA / Estimate / Accurate card. A Ballistic state saved before #151 must give exactly the result
 * the page computed then, and every custom atmosphere must still stop at the guards before the
 * engine. The engine is stubbed wherever no result is expected, so a missing guard fails on the
 * stub instead of running a hang.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { Unit } from 'js-ballistics';
import { Calculator } from '#lib/utils/ballisticEngine.js';
import { calculateFullTrajectory, hasNoAirDensity } from '#lib/utils/ballisticCalculator.js';
import { ballisticPageTrajectory } from '#lib/utils/ballisticPage.js';
import { scopeAtmosphereParams } from '#lib/utils/scopeAtmosphere.js';
import {
	ISA_ATMOSPHERE,
	patchedAtmosphere,
	storedAtmosphere,
	storedBallisticAtmosphere,
	storedRange
} from '#lib/utils/storedState.js';
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

/** The atmosphere a Ballistic state saved on develop holds in ISA: the store's ISA_DEFAULTS. */
const ISA_BOXES = {
	altitude: '0',
	altitudeUnit: 'ft',
	pressure: '29.92',
	pressureUnit: 'inhg',
	temperature: '59',
	temperatureUnit: 'f',
	humidity: '0'
};

/** Every number of a full trajectory, for exact comparison. */
const row = (p) => [
	p.distance.In(Unit.Yard),
	p.slantHeight.In(Unit.Inch),
	p.dropAngle.In(Unit.MOA),
	p.windage.In(Unit.Inch),
	p.windageAngle.In(Unit.MOA),
	p.velocity.In(Unit.FPS),
	p.energy.In(Unit.FootPound),
	p.time
];
const numbers = (result) =>
	result && {
		trajectory: result.trajectory.map(row),
		chartPoints: result.chartPoints.map(row),
		nearZero: result.nearZero,
		farZero: result.farZero,
		maxApex: result.maxApex,
		maxDrop: result.maxDrop,
		soundSpeedFPS: result.soundSpeedFPS,
		subsonicDist: result.subsonicDist
	};

// The page before #151: useISA → null, else the boxes as storedAtmosphere read them.
const developResult = (state, profile) => {
	const atmosphere = storedAtmosphere(state.atmosphere);
	return numbers(
		ballisticPageTrajectory(profile, storedRange(state.range, { step: true }), atmosphere.useISA ? null : atmosphere, state.wind)
			.result
	);
};
// The page now: the mode read by the Ballistic store, through scopeAtmosphereParams.
const nowParams = (state) => scopeAtmosphereParams(storedBallisticAtmosphere(state.atmosphere));
const nowResult = (state, profile) =>
	numbers(ballisticPageTrajectory(profile, storedRange(state.range, { step: true }), nowParams(state), state.wind).result);

const FROM = { directionConvention: 'from-target' };
const NO_WIND = { speed: '0', speedUnit: 'mph', direction: '90', ...FROM };

describe('a Ballistic state saved on develop gives the same result after #151', () => {
	const STATES = [
		[
			'the default ISA state',
			{ range: { distance: '500', unit: 'yd', step: '25' }, atmosphere: { useISA: true, ...ISA_BOXES }, wind: NO_WIND },
			P308_G1
		],
		[
			'ISA with wind, in metres',
			{ range: { distance: '800', unit: 'm', step: '50' }, atmosphere: { useISA: true, ...ISA_BOXES }, wind: { ...WIND_4MPS, ...FROM } },
			P223_G1
		],
		[
			'a custom imperial atmosphere with wind',
			{ range: { distance: '700', unit: 'yd', step: '25' }, atmosphere: { useISA: false, ...ATMO_HOT_ALTITUDE }, wind: { ...WIND_10MPH, ...FROM } },
			P308_G1
		],
		[
			'a custom metric atmosphere',
			{ range: { distance: '900', unit: 'm', step: '100' }, atmosphere: { useISA: false, ...ATMO_COLD_METRIC }, wind: NO_WIND },
			P338_G7_METRIC
		],
		[
			'a custom metric atmosphere with wind',
			{ range: { distance: '1000', unit: 'm', step: '50' }, atmosphere: { useISA: false, ...ATMO_COLD_METRIC }, wind: { ...WIND_4MPS, ...FROM } },
			P338_G7_METRIC
		],
		[
			'a custom atmosphere with a station reference edited by hand (the page read QNH)',
			{ range: { distance: '700', unit: 'yd', step: '25' }, atmosphere: { useISA: false, ...ATMO_HOT_ALTITUDE, pressureRef: 'station' }, wind: NO_WIND },
			P308_G1
		],
		[
			'a custom metric atmosphere with a station reference and wind',
			{ range: { distance: '900', unit: 'm', step: '50' }, atmosphere: { useISA: false, ...ATMO_COLD_METRIC, pressureRef: 'station' }, wind: { ...WIND_4MPS, ...FROM } },
			P338_G7_METRIC
		],
		[
			'ISA with an altitude edited by hand (the page never saved one)',
			{ range: { distance: '500', unit: 'yd', step: '25' }, atmosphere: { useISA: true, ...ISA_BOXES, altitude: '5000', altitudeUnit: 'm' }, wind: NO_WIND },
			P308_G1
		],
		[
			'ISA with a damaged altitude',
			{ range: { distance: '500', unit: 'yd', step: '25' }, atmosphere: { useISA: 1, ...ISA_BOXES, altitude: throwsAsText }, wind: NO_WIND },
			P308_G1
		]
	];

	it.each(STATES)('%s', (_, state, profile) => {
		const before = developResult(state, profile);
		expect(before).not.toBeNull();
		expect(nowResult(state, profile)).toEqual(before);
	});

	it('the imperial defaults as a custom atmosphere: the same result up to the rounding of the converted box (#172)', () => {
		// 29.92 inHg as QNH at 3000 ft is 26.8167 inHg at the site; the box now reads 26.82 (#172).
		const state = { range: { distance: '600', unit: 'yd', step: '50' }, atmosphere: { useISA: false, ...ISA_BOXES, altitude: '3000' }, wind: NO_WIND };
		expect(storedBallisticAtmosphere(state.atmosphere)).toMatchObject({ mode: 'accurate', pressureRef: 'station', pressure: '26.82', altitude: '3000' });
		const before = developResult(state, P223_G1);
		const now = nowResult(state, P223_G1);
		expect(before).not.toBeNull();
		// Exactly the develop page with 26.82 inHg entered as station pressure at the saved altitude,
		// up to the altitude, which station pressure does not use (at most 0.0008 cm, scopeAtmosphere).
		const station = numbers(
			calculateFullTrajectory(P223_G1, storedRange(state.range, { step: true }), { ...ISA_BOXES, altitude: '3000', pressure: '26.82', pressureRef: 'station' }, NO_WIND)
		);
		expect(now.trajectory.length).toBe(before.trajectory.length);
		now.trajectory.forEach((r, i) => r.forEach((v, j) => expect(v).toBeCloseTo(station.trajectory[i][j], 4)));
		// Against develop: the rounding of 0.0033 inHg (0.012 %) moves the 600 yd drop by about 0.05 in.
		const last = before.trajectory.length - 1;
		expect(Math.abs(now.trajectory[last][1] - before.trajectory[last][1])).toBeLessThan(0.1);
		expect(Math.abs(now.trajectory[last][2] - before.trajectory[last][2])).toBeLessThan(0.02);
	});

	it('passes null, the sea-level standard atmosphere, for every saved ISA state', () => {
		for (const [, state] of STATES.filter(([, s]) => s.atmosphere.useISA)) {
			expect(nowParams(state)).toBeNull();
		}
	});

	it('gives no result for a damaged section, as before', () => {
		for (const atmosphere of [null, 'x', [ISA_BOXES], { useISA: false, ...ISA_BOXES, pressure: throwsAsText }]) {
			const state = { range: { distance: '500', unit: 'yd', step: '25' }, atmosphere, wind: NO_WIND };
			expect(developResult(state, P308_G1)).toBeNull();
			expect(nowResult(state, P308_G1)).toBeNull();
		}
	});

	it('keeps the result after the first change on the card: the next write stores altitude 0 with ISA', () => {
		const state = { range: { distance: '500', unit: 'yd', step: '25' }, atmosphere: { useISA: true, ...ISA_BOXES, altitude: '5000' }, wind: NO_WIND };
		const before = developResult(state, P308_G1);
		const written = patchedAtmosphere(storedBallisticAtmosphere(state.atmosphere), { weather: 'rain' });
		expect(written).toMatchObject({ mode: 'isa', useISA: true, altitude: '0' });
		expect(nowResult({ ...state, atmosphere: written }, P308_G1)).toEqual(before);
	});
});

describe('storedBallisticAtmosphere', () => {
	it('reads ISA saved before #151 as ISA at altitude 0, and custom as Accurate with QNH, converted (#172)', () => {
		expect(storedBallisticAtmosphere({ useISA: true, ...ISA_BOXES, altitude: '4000' })).toMatchObject({
			mode: 'isa',
			useISA: true,
			altitude: '0',
			weather: 'cloudy',
			pressureRef: 'qnh'
		});
		// ATMO_HOT_ALTITUDE holds the QNH equivalent of 24.9 inHg measured at 5000 ft (#107).
		expect(storedBallisticAtmosphere({ useISA: false, ...ATMO_HOT_ALTITUDE })).toEqual({
			useISA: false,
			mode: 'accurate',
			weather: 'cloudy',
			pressureRef: 'station',
			...ATMO_HOT_ALTITUDE,
			pressure: '24.9'
		});
	});

	it('reads the pressure reference of a state saved before #151 as QNH, converted, and keeps it with a mode', () => {
		// Before #151 the page read every custom state as QNH: such a state is converted (#172).
		expect(storedBallisticAtmosphere({ useISA: false, ...ATMO_HOT_ALTITUDE, pressureRef: 'station' })).toMatchObject({ pressureRef: 'station', pressure: '24.9' });
		expect(storedBallisticAtmosphere({ useISA: false, mode: 'fog', ...ATMO_HOT_ALTITUDE, pressureRef: 'station' })).toMatchObject({ pressureRef: 'station', pressure: '24.9' });
		// With a mode, a station reference is kept and the box used as it is.
		expect(
			storedBallisticAtmosphere({ useISA: false, mode: 'accurate', ...ATMO_HOT_ALTITUDE, pressureRef: 'station' })
		).toMatchObject({ pressureRef: 'station', pressure: ATMO_HOT_ALTITUDE.pressure });
		// An ISA state saved before #151 keeps its QNH reference: ISA does not use the box.
		expect(storedBallisticAtmosphere({ useISA: true, ...ISA_BOXES }).pressureRef).toBe('qnh');
	});

	it('keeps the altitude of a state with a mode: ISA at an altitude is chosen by the user (#151)', () => {
		expect(storedBallisticAtmosphere({ ...ISA_ATMOSPHERE, altitude: '4000' }).altitude).toBe('4000');
		expect(scopeAtmosphereParams(storedBallisticAtmosphere({ ...ISA_ATMOSPHERE, altitude: '4000' }))).not.toBeNull();
	});

	it.each(['estimate', 'accurate'])('keeps %s with its boxes', (mode) => {
		const read = storedBallisticAtmosphere({ ...ATMO_COLD_METRIC, useISA: false, mode, weather: 'snow', pressureRef: 'station' });
		expect(read).toEqual({ ...ATMO_COLD_METRIC, useISA: false, mode, weather: 'snow', pressureRef: 'station' });
	});

	it('reads a damaged mode from useISA, as before #151', () => {
		expect(storedBallisticAtmosphere({ ...ISA_BOXES, useISA: true, mode: 'fog', altitude: '900' })).toMatchObject({ mode: 'isa', altitude: '0' });
		expect(storedBallisticAtmosphere({ ...ISA_BOXES, useISA: false, mode: throwsAsText })).toMatchObject({ mode: 'accurate' });
	});

	it('reads a damaged section as Accurate with empty boxes', () => {
		for (const stored of [null, 'x', 5, [ISA_BOXES]]) {
			expect(storedBallisticAtmosphere(stored)).toMatchObject({ mode: 'accurate', useISA: false, altitude: '', pressure: '' });
		}
	});
});

describe('patchedAtmosphere (shared by the Scope View and Ballistic stores)', () => {
	const custom = storedBallisticAtmosphere({ useISA: false, ...ATMO_HOT_ALTITUDE });

	it('resets to the standard atmosphere on useISA: true', () => {
		expect(patchedAtmosphere(custom, { useISA: true })).toEqual(ISA_ATMOSPHERE);
	});

	it('is Accurate on useISA: false, and keeps useISA matching the mode', () => {
		const isa = storedBallisticAtmosphere(ISA_ATMOSPHERE);
		expect(patchedAtmosphere(isa, { useISA: false })).toMatchObject({ mode: 'accurate', useISA: false });
		expect(patchedAtmosphere(custom, { mode: 'isa' })).toMatchObject({ mode: 'isa', useISA: true, altitude: '5000' });
		expect(patchedAtmosphere(custom, { mode: 'estimate' })).toMatchObject({ mode: 'estimate', useISA: false });
	});

	it('keeps the boxes on a mode change and the mode on a mode that is not one', () => {
		expect(patchedAtmosphere(custom, { mode: 'estimate', temperature: '9' })).toEqual({
			...custom,
			mode: 'estimate',
			temperature: '9'
		});
		expect(patchedAtmosphere(custom, { mode: 'fog' }).mode).toBe('accurate');
		expect(patchedAtmosphere(custom, { mode: null }).mode).toBe('accurate');
	});
});

describe('the Ballistic atmosphere guards apply in every mode, before the engine', () => {
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
		calculateFullTrajectory(
			P223_G1,
			{ distance: '500', unit: 'yd', step: '25' },
			scopeAtmosphereParams(storedBallisticAtmosphere({ ...ISA_ATMOSPHERE, ...fields })),
			null
		);

	it('reaches the stub with usable values in each mode and unit, so the stub is live', () => {
		for (const mode of ['isa', 'estimate', 'accurate']) {
			for (const units of [
				{ altitude: '3000' },
				{ altitude: '900', altitudeUnit: 'm', pressure: '1013', pressureUnit: 'hpa', temperature: '15', temperatureUnit: 'c' }
			]) {
				solver.mockClear();
				fire.mockClear();
				run({ mode, ...units });
				expect(reached()).toBe(true);
			}
		}
	});

	const BAD_ALTITUDES = ['', 'x', '32809', '-3282', 'Infinity', '1e9', throwsAsText, null, ['100']];

	it.each(['isa', 'estimate'])('stops an altitude out of its limits in %s', (mode) => {
		for (const altitude of BAD_ALTITUDES) {
			expect(run({ mode, altitude })).toBeNull();
		}
		expect(reached()).toBe(false);
	});

	it('stops a QNH Accurate state with an altitude out of its limits: its pressure reads empty (#172)', () => {
		for (const altitude of BAD_ALTITUDES) {
			expect(run({ mode: 'accurate', pressureRef: 'qnh', altitude })).toBeNull();
		}
		expect(reached()).toBe(false);
	});

	it('does not use the stored altitude in Accurate with station pressure (#172)', () => {
		for (const altitude of BAD_ALTITUDES) {
			solver.mockClear();
			fire.mockClear();
			run({ mode: 'accurate', altitude });
			expect(reached()).toBe(true);
		}
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

	it('stops a saved QNH state whose air had no density at the site before the engine (#172)', () => {
		// 300 hPa as QNH at 10000 m is 78.3 hPa at the site, where the air at 70 °C and 100 % has no
		// density. It now reads as that station pressure, out of the pressure limits: still no result.
		const fields = {
			mode: 'accurate',
			pressureRef: 'qnh',
			altitude: '10000',
			altitudeUnit: 'm',
			pressure: '300',
			pressureUnit: 'hpa',
			temperature: '70',
			temperatureUnit: 'c',
			humidity: '100'
		};
		expect(run(fields)).toBeNull();
		expect(reached()).toBe(false);
		expect(storedBallisticAtmosphere({ ...ISA_ATMOSPHERE, ...fields }).pressure).toBe('78.3');
		expect(hasNoAirDensity(scopeAtmosphereParams(storedBallisticAtmosphere({ ...ISA_ATMOSPHERE, ...fields })))).toBe(false);
		// The same box as station pressure has a density, so Accurate never shows the density message
		// within the limits now; the check stays for the pages that still take QNH.
		expect(hasNoAirDensity(scopeAtmosphereParams(storedBallisticAtmosphere({ ...ISA_ATMOSPHERE, ...fields, pressureRef: 'station' })))).toBe(false);
	});
});
