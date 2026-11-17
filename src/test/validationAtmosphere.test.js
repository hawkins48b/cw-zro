/**
 * The Trajectory Validation atmosphere (#194): the page now uses the Scope View's ISA / Estimate /
 * Accurate card, read as the Ballistic page reads its own since #151. A state saved before #194 must
 * give the result the page computed then: the switch on gave the sea-level standard atmosphere
 * (`null`), off gave the boxes with the pressure as QNH.
 */
import { describe, it, expect } from 'vitest';
import { Unit } from 'js-ballistics';
import { calculateTrajectoryValidation } from '#lib/utils/trajectoryValidation.js';
import { scopeAtmosphereParams } from '#lib/utils/scopeAtmosphere.js';
import { storedAtmosphere, storedValidationAtmosphere } from '#lib/utils/storedState.js';
import { ATMO_COLD_METRIC, ATMO_HOT_ALTITUDE, P308_G1, P338_G7_METRIC } from './fixtures/ballisticProfiles.js';

/** The atmosphere the store saved before #194 with the switch on (its ISA_DEFAULTS). */
const ISA_BOXES = {
	altitude: '0',
	altitudeUnit: 'ft',
	pressure: '29.92',
	pressureUnit: 'inhg',
	temperature: '59',
	temperatureUnit: 'f',
	humidity: '0'
};

const run = (state, profile, atmo) =>
	calculateTrajectoryValidation(
		profile,
		state.range,
		state.measure.type,
		state.measure.value,
		state.measure.unit,
		state.solveFor,
		atmo,
		state.measure.direction
	);
// The page before #194: useISA → null, else the boxes as storedAtmosphere read them.
const beforeResult = (state, profile) => {
	const atmosphere = state.atmosphere == null ? { useISA: true } : storedAtmosphere(state.atmosphere);
	return run(state, profile, atmosphere.useISA ? null : atmosphere);
};
// The page now: the store's reading, through scopeAtmosphereParams.
const nowResult = (state, profile) =>
	run(state, profile, scopeAtmosphereParams(storedValidationAtmosphere(state.atmosphere)));
const numbers = (r) =>
	r && !r.error
		? [r.validatedVelocity, r.validatedBc, r.initialMeasure, r.validatedPoint.slantHeight.In(Unit.Inch), r.validatedPoint.dropAngle.In(Unit.MOA)]
		: r;

const ANGLE = { type: 'angle', value: '14', unit: 'moa', direction: 'below' };
const DIST = { type: 'distance', value: '60', unit: 'cm', direction: 'below' };
// About 5 % more drop than the metric fixture's own shot at 700 to 800 m (320 to 454 cm).
const DIST_METRIC = { type: 'distance', value: '400', unit: 'cm', direction: 'below' };

describe('a Trajectory Validation state saved before #194 gives the same result', () => {
	const STATES = [
		['the default ISA state', { range: { distance: '600', unit: 'yd' }, measure: ANGLE, solveFor: 'velocity', atmosphere: { useISA: true, ...ISA_BOXES } }, P308_G1],
		['a missing atmosphere', { range: { distance: '600', unit: 'yd' }, measure: ANGLE, solveFor: 'velocity', atmosphere: undefined }, P308_G1],
		['ISA, BC, in metres', { range: { distance: '750', unit: 'm' }, measure: DIST_METRIC, solveFor: 'bc', atmosphere: { useISA: true, ...ISA_BOXES } }, P338_G7_METRIC],
		['ISA with an altitude edited by hand (the page never used it)', { range: { distance: '600', unit: 'yd' }, measure: ANGLE, solveFor: 'velocity', atmosphere: { useISA: true, ...ISA_BOXES, altitude: '5000' } }, P308_G1],
		['a custom imperial atmosphere', { range: { distance: '600', unit: 'yd' }, measure: ANGLE, solveFor: 'velocity', atmosphere: { useISA: false, ...ATMO_HOT_ALTITUDE } }, P308_G1],
		['a custom metric atmosphere, BC', { range: { distance: '750', unit: 'm' }, measure: DIST_METRIC, solveFor: 'bc', atmosphere: { useISA: false, ...ATMO_COLD_METRIC } }, P338_G7_METRIC],
		['a custom atmosphere with a station reference edited by hand (the page read QNH)', { range: { distance: '600', unit: 'yd' }, measure: ANGLE, solveFor: 'velocity', atmosphere: { useISA: false, ...ATMO_HOT_ALTITUDE, pressureRef: 'station' } }, P308_G1]
	];

	it.each(STATES)('%s', (_, state, profile) => {
		const before = beforeResult(state, profile);
		expect(before?.error).toBeUndefined();
		expect(numbers(nowResult(state, profile))).toEqual(numbers(before));
	});

	it('gives no result for a damaged section, as before', () => {
		for (const atmosphere of ['x', [ISA_BOXES], { useISA: false, ...ISA_BOXES, pressure: ['29.92'] }]) {
			const state = { range: { distance: '600', unit: 'yd' }, measure: ANGLE, solveFor: 'velocity', atmosphere };
			expect(beforeResult(state, P308_G1)).toEqual({ error: 'no_solution' });
			expect(nowResult(state, P308_G1)).toEqual({ error: 'no_solution' });
		}
	});
});

describe('initialMeasure (#194)', () => {
	it.each([
		['angle, MOA', ANGLE, (p) => p.dropAngle.In(Unit.MOA)],
		['distance, cm', DIST, (p) => p.slantHeight.In(Unit.Centimeter)]
	])('is the profile shot in the observed unit, to 0.1, below the line of sight negative: %s', (_, measure, read) => {
		const r = nowResult({ range: { distance: '600', unit: 'yd' }, measure, solveFor: 'velocity', atmosphere: undefined }, P308_G1);
		expect(r.initialMeasure).toBeLessThan(0);
		expect(r.initialMeasure).toBe(Math.round(read(r.initialPoint) * 10) / 10);
	});
});
