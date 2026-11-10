/**
 * Custom altitude too low for the shot (#125, owner decision of 2026-11-10, option A). The engine
 * ends every flight below -1410.748 ft (-430 m), so a low altitude inside its limits can give no
 * result. The pages then say why, from the stop reason the engine reports (flightStop.js), and no
 * result changes. Values here are inside every limit, on the real engine, and were measured to
 * return quickly (P308_G1: no result below about -1402 ft at 600 yd, before and after the change).
 */
import { describe, it, expect, vi, afterEach } from 'vitest';
import { Calculator, TrajectoryRangeError, ZeroFindingError, UNew, Unit } from 'js-ballistics';
import { calculateShotPoint, calculateFullTrajectory } from '#lib/utils/ballisticCalculator.js';
import { calculateTrajectoryValidation } from '#lib/utils/trajectoryValidation.js';
import { ballisticPageTrajectory } from '#lib/utils/ballisticPage.js';
import {
	MINIMUM_FLIGHT_ALTITUDE_FT,
	endedAtMinimumAltitude,
	isMinimumAltitudeStop,
	minimumFlightAltitude
} from '#lib/utils/flightStop.js';
import { altitudeTooLowMessage } from '#lib/components/altitudeMessage.js';
import { P308_G1, P223_SHORT_ZERO, P338_G7_METRIC } from './fixtures/ballisticProfiles.js';

const RANGE = { distance: 600, unit: 'yd', step: 100 };
const ATMO = {
	altitude: '0',
	altitudeUnit: 'ft',
	pressure: '29.92',
	pressureUnit: 'inhg',
	temperature: '59',
	temperatureUnit: 'f',
	humidity: '50'
};
const at = (altitude, altitudeUnit = 'ft') => ({ ...ATMO, altitude, altitudeUnit });

/** Each custom-atmosphere path: [result, whether it reports the altitude as too low]. */
const PATHS = [
	[
		'calculateShotPoint',
		(profile, atmo, range = RANGE) => {
			const report = {};
			const result = calculateShotPoint(profile, range, atmo, null, { report });
			return [result, report.minimumAltitude];
		}
	],
	[
		'calculateFullTrajectory',
		(profile, atmo, range = RANGE) => {
			const report = {};
			const result = calculateFullTrajectory(profile, range, atmo, null, { report });
			return [result, report.minimumAltitude];
		}
	],
	[
		'the Ballistic page',
		(profile, atmo, range = RANGE) => {
			const { result, altitudeTooLow } = ballisticPageTrajectory(profile, range, atmo, null);
			return [result, altitudeTooLow];
		}
	],
	[
		'calculateTrajectoryValidation',
		(profile, atmo, range = RANGE) => {
			const result = calculateTrajectoryValidation(profile, range, 'distance', 10, 'in', 'velocity', atmo);
			const tooLow = result?.error === 'minimum_altitude';
			return [tooLow || result?.error === 'no_solution' ? null : result, tooLow];
		}
	]
];

afterEach(() => {
	vi.restoreAllMocks();
});

describe.each(PATHS)('%s', (_, run) => {
	describe('says the altitude is too low when the engine ends the flight there', () => {
		it.each([
			['-3281 ft, the lower limit', at('-3281')],
			['-1000 m, the lower limit', at('-1000', 'm')],
			['-1500 ft', at('-1500')],
			['-1405 ft, just below the reach of a 600 yd shot', at('-1405')],
			['-430,5 m, with a comma', at('-430,5', 'm')]
		])('%s', (__, atmo) => {
			vi.spyOn(console, 'error').mockImplementation(() => {});
			const [result, tooLow] = run(P308_G1, atmo);
			expect(result).toBeNull();
			expect(tooLow).toBe(true);
		});

		it('also when the zero solve fails on it (ZeroFindingError)', () => {
			vi.spyOn(console, 'error').mockImplementation(() => {});
			const [result, tooLow] = run(P223_SHORT_ZERO, at('-1500'));
			expect(result).toBeNull();
			expect(tooLow).toBe(true);
		});
	});

	describe('gives a result, and no message, just above', () => {
		it.each([
			['-1400 ft', at('-1400')],
			['-1000 ft', at('-1000')],
			['-400 m', at('-400', 'm')],
			['0', ATMO],
			['10000 m, the upper limit', at('10000', 'm')]
		])('%s', (__, atmo) => {
			const [result, tooLow] = run(P308_G1, atmo);
			expect(result).not.toBeNull();
			expect(tooLow).toBe(false);
		});
	});

	it('does not say it for an altitude out of its limits: the box gives the range instead', () => {
		const [result, tooLow] = run(P308_G1, at('-1000.01', 'm'));
		expect(result).toBeNull();
		expect(tooLow).toBe(false);
	});

	it('does not say it when the shot fails for another reason', () => {
		vi.spyOn(console, 'error').mockImplementation(() => {});
		vi.spyOn(Calculator.prototype, 'fire').mockImplementation(() => {
			throw new TrajectoryRangeError(TrajectoryRangeError.MinimumVelocityReached, []);
		});
		const [result, tooLow] = run(P308_G1, at('-1000'));
		expect(result).toBeNull();
		expect(tooLow).toBe(false);
	});
});

describe('pages with the standard atmosphere', () => {
	it('do not say it: there is no altitude box', () => {
		vi.spyOn(console, 'error').mockImplementation(() => {});
		vi.spyOn(Calculator.prototype, 'fire').mockImplementation(() => {
			throw new TrajectoryRangeError(TrajectoryRangeError.MinimumAltitudeReached, []);
		});
		expect(ballisticPageTrajectory(P308_G1, RANGE, null, null)).toEqual({ result: null, altitudeTooLow: false });
		expect(calculateTrajectoryValidation(P308_G1, RANGE, 'distance', 10, 'in')).toEqual({ error: 'no_solution' });
	});
});

describe('no result changes', () => {
	it.each([
		['P308_G1, -1400 ft', P308_G1, at('-1400')],
		['P338_G7_METRIC, -400 m', P338_G7_METRIC, at('-400', 'm')],
		['P308_G1, standard atmosphere', P308_G1, null]
	])('the report does not change the result: %s', (_, profile, atmo) => {
		const plain = calculateFullTrajectory(profile, RANGE, atmo, null);
		const reported = calculateFullTrajectory(profile, RANGE, atmo, null, { report: {} });
		expect(reported).toEqual(plain);
	});
});

describe('flightStop', () => {
	it('uses the engine minimum altitude, -430 m', () => {
		expect(MINIMUM_FLIGHT_ALTITUDE_FT).toBe(-1410.748);
		expect(minimumFlightAltitude('ft')).toBe(-1410.7);
		expect(minimumFlightAltitude('m')).toBe(-430);
		expect(minimumFlightAltitude(undefined)).toBe(-1410.7);
	});

	it('tells a minimum altitude stop from the other ones', () => {
		const stop = (reason) => new TrajectoryRangeError(reason, []);
		expect(isMinimumAltitudeStop(stop(TrajectoryRangeError.MinimumAltitudeReached))).toBe(true);
		expect(isMinimumAltitudeStop(stop(TrajectoryRangeError.MinimumVelocityReached))).toBe(false);
		expect(isMinimumAltitudeStop(stop(TrajectoryRangeError.MaximumDropReached))).toBe(false);
		expect(isMinimumAltitudeStop(new Error('Minimum altitude reached'))).toBe(false);
	});

	it('counts a failed zero solve only when the minimum altitude cut its flights', () => {
		const zeroError = new ZeroFindingError(1, 10, UNew.Radian(0));
		expect(endedAtMinimumAltitude(zeroError, { minimumAltitude: true })).toBe(true);
		expect(endedAtMinimumAltitude(zeroError, { minimumAltitude: false })).toBe(false);
		expect(endedAtMinimumAltitude(null, { minimumAltitude: true })).toBe(true);
		expect(endedAtMinimumAltitude(null, { minimumAltitude: false })).toBe(false);
		// A cut zero solve that solved, then a fire that failed for another reason.
		const velocityStop = new TrajectoryRangeError(TrajectoryRangeError.MinimumVelocityReached, []);
		expect(endedAtMinimumAltitude(velocityStop, { minimumAltitude: true })).toBe(false);
		expect(endedAtMinimumAltitude(new Error('other'), { minimumAltitude: true })).toBe(false);
	});
});

describe('the message', () => {
	it.each([
		['m', '-430', 'm'],
		['ft', '-1410.7', 'ft']
	])('gives the minimum altitude in %s', (unit, value, label) => {
		const text = altitudeTooLowMessage(unit);
		expect(text).toContain(value);
		expect(text).toContain(label);
		expect(text).not.toContain('{');
	});
});
