/**
 * Bullet weight, diameter, twist, length and altitude limits on every calculation path (#125;
 * owner decision of 2026-11-10, both ends included, in the unit entered). As in inputLimits.test.js,
 * nothing here runs a value past a limit on the real engine: setWeaponZero and fire are stubbed to
 * throw, and the checks count calls. A value at a limit must reach the stub, which proves the stub
 * is live and the limit is not stricter than decided. Twist and length only reach the engine with
 * spin drift on, and never on the dope cards, so they are only checked there.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { Unit } from 'js-ballistics';
import { Calculator } from '#lib/utils/ballisticEngine.js';
import {
	calculateShotPoint,
	calculateFullTrajectory,
	calculateMPBR
} from '#lib/utils/ballisticCalculator.js';
import { calculateTrajectoryValidation } from '#lib/utils/trajectoryValidation.js';
import { generateImperialDopeCard } from '#lib/utils/dopeCardImperial.js';
import { generateMetricDopeCard } from '#lib/utils/dopeCardMetric.js';
import {
	ALTITUDE_LIMITS,
	BARREL_TWIST_LIMITS,
	BULLET_DIAMETER_LIMITS,
	BULLET_LENGTH_LIMITS,
	BULLET_WEIGHT_LIMITS,
	hasUsableBullet,
	isUsableAtmosphere
} from '#lib/utils/inputLimits.js';
import { P308_G1, P338_G7_METRIC, ATMO_COLD_METRIC, ATMO_HOT_ALTITUDE } from './fixtures/ballisticProfiles.js';

vi.mock('pdf-lib', () => ({
	rgb: () => ({}),
	StandardFonts: {},
	PDFDocument: {
		load: async () => ({
			embedFont: async () => ({
				widthOfTextAtSize: (text, size) => String(text).length * size * 0.55,
				getCharacterSet: () => Array.from({ length: 95 }, (_, i) => i + 0x20)
			}),
			getPages: () => [
				{
					getSize: () => ({ height: 612 }),
					drawText: () => {},
					drawLine: () => {},
					drawCircle: () => {},
					drawRectangle: () => {},
					drawSvgPath: () => {}
				}
			]
		})
	}
}));

const RANGE = { distance: 600, unit: 'yd', step: 100 };
const VALIDATION_RANGE = { distance: 600, unit: 'yd' };

/** A custom atmosphere well inside every limit, in imperial units. */
const ATMO = {
	altitude: '0',
	altitudeUnit: 'ft',
	pressure: '29.92',
	pressureUnit: 'inhg',
	temperature: '59',
	temperatureUnit: 'f',
	humidity: '50'
};

const validation = (profile, atmo = null) =>
	calculateTrajectoryValidation(profile, VALIDATION_RANGE, 'distance', 10, 'in', 'velocity', atmo);

/** The paths that use spin drift: twist and length reach the engine there. */
const SPIN_PATHS = [
	['calculateShotPoint', (profile) => calculateShotPoint(profile, RANGE, null, null)],
	['calculateFullTrajectory', (profile) => calculateFullTrajectory(profile, RANGE, null, null)],
	['calculateMPBR', (profile) => calculateMPBR(profile, '8', 'in')],
	['calculateTrajectoryValidation', (profile) => validation(profile)]
];

/** The dope cards: weight and diameter reach the engine, twist and length never do. */
const CARD_PATHS = [
	['the imperial dope card', (profile) => generateImperialDopeCard(profile)],
	['the metric dope card', (profile) => generateMetricDopeCard(profile)]
];

const PROFILE_PATHS = [...SPIN_PATHS, ...CARD_PATHS];

/** The paths that take a custom atmosphere. */
const ATMOSPHERE_PATHS = [
	['calculateShotPoint', (atmo) => calculateShotPoint(P308_G1, RANGE, atmo, null)],
	['calculateFullTrajectory', (atmo) => calculateFullTrajectory(P308_G1, RANGE, atmo, null)],
	['calculateTrajectoryValidation', (atmo) => validation(P308_G1, atmo)]
];

/** What a reload gives: JSON.parse turns 1e999 into Infinity, and keeps the rest as stored. */
const stored = (json) => JSON.parse(json);

/** No result: null, or no solution from the validation search, whose first shot gave nothing. */
const noResult = (result) => result === null || result?.error === 'no_solution';

/** With spin drift on, so that twist and length are passed on. */
const SPIN = { ...P308_G1, spinDrift: true };

const WEIGHT_REJECTED = [
	['just under 1 gr', { bulletWeight: '0.99' }],
	['just over 2000 gr', { bulletWeight: '2000.01' }],
	['just under 0.065 g', { bulletWeight: '0.0649', bulletWeightUnit: 'g' }],
	['just over 130 g', { bulletWeight: '130.01', bulletWeightUnit: 'g' }],
	['0', { bulletWeight: '0' }],
	['negative', { bulletWeight: '-168' }],
	['1e300', { bulletWeight: '1e300' }],
	['Infinity', { bulletWeight: 'Infinity' }],
	['a stored overflow', { bulletWeight: stored('1e999') }],
	['hex, which reads as 0', { bulletWeight: '0x10' }],
	['text', { bulletWeight: 'abc' }],
	['empty', { bulletWeight: '' }]
];
const WEIGHT_ACCEPTED = [
	['1 gr', { bulletWeight: '1' }],
	['2000 gr', { bulletWeight: '2000' }],
	['0.065 g', { bulletWeight: '0.065', bulletWeightUnit: 'g' }],
	['130 g', { bulletWeight: '130', bulletWeightUnit: 'g' }],
	['a comma', { bulletWeight: '168,5' }],
	['a stored number', { bulletWeight: 168 }]
];

const DIAMETER_REJECTED = [
	['just under 0.1 in', { bulletDiameter: '0.0999' }],
	['just over 1 in', { bulletDiameter: '1.0001' }],
	['just under 2.54 mm', { bulletDiameter: '2.539', bulletDiameterUnit: 'mm' }],
	['just over 25.4 mm', { bulletDiameter: '25.401', bulletDiameterUnit: 'mm' }],
	['7.62 in, a mm value in inches', { bulletDiameter: '7.62' }],
	['0', { bulletDiameter: '0' }],
	['negative', { bulletDiameter: '-0.308' }],
	['Infinity', { bulletDiameter: 'Infinity' }],
	['a stored overflow', { bulletDiameter: stored('1e999') }],
	['hex', { bulletDiameter: '0x1' }],
	['empty', { bulletDiameter: '' }]
];
const DIAMETER_ACCEPTED = [
	['0.1 in', { bulletDiameter: '0.1' }],
	['1 in', { bulletDiameter: '1' }],
	['2.54 mm', { bulletDiameter: '2.54', bulletDiameterUnit: 'mm' }],
	['25.4 mm', { bulletDiameter: '25.4', bulletDiameterUnit: 'mm' }],
	['a comma', { bulletDiameter: '0,308' }]
];

const TWIST_REJECTED = [
	['just under 1 in', { barrelTwist: '0.99' }],
	['just over 100 in', { barrelTwist: '100.01' }],
	['just under 25.4 mm', { barrelTwist: '25.39', barrelTwistUnit: 'mm' }],
	['just over 2540 mm', { barrelTwist: '2540.01', barrelTwistUnit: 'mm' }],
	['254 in, a mm value in inches', { barrelTwist: '254' }],
	['a left-hand twist past 100 in', { barrelTwist: '-100.01' }],
	['a left-hand twist under 1 in', { barrelTwist: '-0.5' }],
	['0 as text, which is set', { barrelTwist: '0' }],
	['Infinity', { barrelTwist: 'Infinity' }],
	['a stored overflow', { barrelTwist: stored('1e999') }],
	['hex', { barrelTwist: '0x10' }],
	['text', { barrelTwist: 'abc' }]
];
const TWIST_ACCEPTED = [
	['1 in', { barrelTwist: '1' }],
	['100 in', { barrelTwist: '100' }],
	['25.4 mm', { barrelTwist: '25.4', barrelTwistUnit: 'mm' }],
	['2540 mm', { barrelTwist: '2540', barrelTwistUnit: 'mm' }],
	['-10 in, a left-hand barrel', { barrelTwist: '-10' }],
	['-100 in', { barrelTwist: '-100' }],
	['-2540 mm', { barrelTwist: '-2540', barrelTwistUnit: 'mm' }],
	['a comma', { barrelTwist: '10,5' }],
	['empty, which is not passed on', { barrelTwist: '' }]
];

const LENGTH_REJECTED = [
	['just under 0.1 in', { bulletLength: '0.0999' }],
	['just over 4 in', { bulletLength: '4.01' }],
	['just under 2.54 mm', { bulletLength: '2.539', bulletLengthUnit: 'mm' }],
	['just over 101.6 mm', { bulletLength: '101.61', bulletLengthUnit: 'mm' }],
	['30.9 in, a mm value in inches', { bulletLength: '30.9' }],
	['0 as text, which is set', { bulletLength: '0' }],
	['negative', { bulletLength: '-1.215' }],
	['Infinity', { bulletLength: 'Infinity' }],
	['a stored overflow', { bulletLength: stored('1e999') }],
	['text', { bulletLength: 'abc' }]
];
const LENGTH_ACCEPTED = [
	['0.1 in', { bulletLength: '0.1' }],
	['4 in', { bulletLength: '4' }],
	['2.54 mm', { bulletLength: '2.54', bulletLengthUnit: 'mm' }],
	['101.6 mm', { bulletLength: '101.6', bulletLengthUnit: 'mm' }],
	['a comma', { bulletLength: '1,215' }],
	['empty, which is not passed on', { bulletLength: '' }]
];

let solver;
let fire;
const reached = () => solver.mock.calls.length + fire.mock.calls.length > 0;

beforeEach(() => {
	vi.stubGlobal('fetch', async () => ({ arrayBuffer: async () => new ArrayBuffer(0) }));
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
	vi.unstubAllGlobals();
});

describe.each(PROFILE_PATHS)('%s', (_, run) => {
	describe('bullet weight (#125)', () => {
		it.each(WEIGHT_REJECTED)('gives no result for %s, before the engine', async (__, change) => {
			expect(noResult(await run({ ...P308_G1, ...change }))).toBe(true);
			expect(reached()).toBe(false);
		});

		it.each(WEIGHT_ACCEPTED)('reaches the engine with %s', async (__, change) => {
			await run({ ...P308_G1, ...change });
			expect(reached()).toBe(true);
		});
	});

	describe('bullet diameter (#125)', () => {
		it.each(DIAMETER_REJECTED)('gives no result for %s, before the engine', async (__, change) => {
			expect(noResult(await run({ ...P308_G1, ...change }))).toBe(true);
			expect(reached()).toBe(false);
		});

		it.each(DIAMETER_ACCEPTED)('reaches the engine with %s', async (__, change) => {
			await run({ ...P308_G1, ...change });
			expect(reached()).toBe(true);
		});
	});

	describe('twist and length with spin drift off', () => {
		it.each([...TWIST_REJECTED, ...LENGTH_REJECTED])(
			'reaches the engine with %s: it is not passed on',
			async (__, change) => {
				await run({ ...P308_G1, ...change });
				expect(reached()).toBe(true);
			}
		);
	});
});

describe.each(SPIN_PATHS)('%s, spin drift on', (_, run) => {
	describe('barrel twist (#125)', () => {
		it.each(TWIST_REJECTED)('gives no result for %s, before the engine', async (__, change) => {
			expect(noResult(await run({ ...SPIN, ...change }))).toBe(true);
			expect(reached()).toBe(false);
		});

		it.each(TWIST_ACCEPTED)('reaches the engine with %s', async (__, change) => {
			await run({ ...SPIN, ...change });
			expect(reached()).toBe(true);
		});
	});

	describe('bullet length (#125)', () => {
		it.each(LENGTH_REJECTED)('gives no result for %s, before the engine', async (__, change) => {
			expect(noResult(await run({ ...SPIN, ...change }))).toBe(true);
			expect(reached()).toBe(false);
		});

		it.each(LENGTH_ACCEPTED)('reaches the engine with %s', async (__, change) => {
			await run({ ...SPIN, ...change });
			expect(reached()).toBe(true);
		});
	});
});

describe.each(CARD_PATHS)('%s, spin drift on', (_, run) => {
	it.each([...TWIST_REJECTED, ...LENGTH_REJECTED])(
		'reaches the engine with %s: the cards never use spin drift',
		async (__, change) => {
			await run({ ...SPIN, ...change });
			expect(reached()).toBe(true);
		}
	);
});

describe.each(ATMOSPHERE_PATHS)('%s, custom atmosphere altitude (#125)', (_, run) => {
	it.each([
		['just under -1000 m', { altitude: '-1000.01', altitudeUnit: 'm' }],
		['just over 10000 m', { altitude: '10000.01', altitudeUnit: 'm' }],
		['just under -3281 ft', { altitude: '-3281.01' }],
		['just over 32808 ft', { altitude: '32808.01' }],
		['32809 ft', { altitude: '32809' }],
		['1e300 ft', { altitude: '1e300' }],
		['-1e300 m', { altitude: '-1e300', altitudeUnit: 'm' }],
		['a stored overflow', { altitude: stored('1e999') }],
		['text', { altitude: 'abc' }],
		['empty', { altitude: '' }]
	])('gives no result for %s, before the engine', (__, change) => {
		expect(noResult(run({ ...ATMO, ...change }))).toBe(true);
		expect(reached()).toBe(false);
	});

	it.each([
		['-1000 m', { altitude: '-1000', altitudeUnit: 'm' }],
		['10000 m', { altitude: '10000', altitudeUnit: 'm' }],
		['-3281 ft', { altitude: '-3281' }],
		['32808 ft', { altitude: '32808' }],
		['0', { altitude: '0' }],
		['a comma', { altitude: '1500,5', altitudeUnit: 'm' }]
	])('reaches the engine with %s', (__, change) => {
		run({ ...ATMO, ...change });
		expect(reached()).toBe(true);
	});
});

describe('a saved profile holding a bullet value out of its limits (#125)', () => {
	/** What storage can hold after a reload, from an old form or a tampered value. */
	const SAVED = stored(
		'[{"bulletWeight":1e999},{"bulletWeight":"Infinity"},{"bulletWeight":"0x10"},{"bulletWeight":5000},' +
			'{"bulletDiameter":"1e300"},{"bulletDiameter":7.62},{"bulletDiameter":"abc"}]'
	);
	const SAVED_SPIN = stored(
		'[{"barrelTwist":1e999},{"barrelTwist":"0x10"},{"barrelTwist":254},{"bulletLength":"Infinity"},{"bulletLength":39.6}]'
	);
	const cases = [
		...PROFILE_PATHS.flatMap(([path, run]) =>
			SAVED.map((change) => [path, JSON.stringify(change), run, { ...P308_G1, ...change }])
		),
		...SPIN_PATHS.flatMap(([path, run]) =>
			SAVED_SPIN.map((change) => [path, `${JSON.stringify(change)} with spin drift`, run, { ...SPIN, ...change }])
		)
	];

	it.each(cases)('%s gives no result for %s, before the engine', async (_, __, run, profile) => {
		expect(noResult(await run(profile))).toBe(true);
		expect(reached()).toBe(false);
	});
});

describe('limits', () => {
	it('are the values the owner chose', () => {
		expect(BULLET_WEIGHT_LIMITS).toEqual({ gr: { min: 1, max: 2000 }, g: { min: 0.065, max: 130 } });
		expect(BULLET_DIAMETER_LIMITS).toEqual({ in: { min: 0.1, max: 1 }, mm: { min: 2.54, max: 25.4 } });
		expect(BULLET_LENGTH_LIMITS).toEqual({ in: { min: 0.1, max: 4 }, mm: { min: 2.54, max: 101.6 } });
		expect(BARREL_TWIST_LIMITS).toEqual({ in: { min: 1, max: 100 }, mm: { min: 25.4, max: 2540 } });
		expect(ALTITUDE_LIMITS).toEqual({ m: { min: -1000, max: 10000 }, ft: { min: -3281, max: 32808 } });
	});

	it('hold every test profile', () => {
		for (const profile of [P308_G1, SPIN, P338_G7_METRIC]) expect(hasUsableBullet(profile)).toBe(true);
		for (const atmo of [ATMO, ATMO_HOT_ALTITUDE, ATMO_COLD_METRIC]) {
			const values = {
				altitude: Number(atmo.altitude),
				pressure: Number(atmo.pressure),
				temperature: Number(atmo.temperature),
				humidity: Number(atmo.humidity)
			};
			expect(isUsableAtmosphere(values, atmo)).toBe(true);
		}
	});

	it('read a unit the form does not offer as the calculators do: grains, inches and feet', () => {
		expect(hasUsableBullet({ ...P308_G1, bulletWeightUnit: 'oz' })).toBe(true);
		expect(hasUsableBullet({ ...P308_G1, bulletDiameterUnit: undefined })).toBe(true);
		expect(hasUsableBullet({ ...SPIN, barrelTwist: '254', barrelTwistUnit: 'cm' })).toBe(false);
		const values = { altitude: 10001, pressure: 29.92, temperature: 59, humidity: 50 };
		expect(isUsableAtmosphere(values, {})).toBe(true);
		expect(isUsableAtmosphere(values, { altitudeUnit: 'm' })).toBe(false);
	});

	it('skip twist and length for a path without spin drift', () => {
		const bad = { ...SPIN, barrelTwist: '1000', bulletLength: '50' };
		expect(hasUsableBullet(bad)).toBe(false);
		expect(hasUsableBullet(bad, { spinDrift: false })).toBe(true);
		expect(hasUsableBullet({ ...bad, bulletWeight: '0' }, { spinDrift: false })).toBe(false);
	});
});

describe('on the real engine, at the limits', () => {
	beforeEach(() => {
		solver.mockRestore();
		fire.mockRestore();
	});

	it.each([
		['1 gr', { bulletWeight: '1' }],
		['2000 gr', { bulletWeight: '2000' }],
		['0.1 in diameter', { bulletDiameter: '0.1' }],
		['1 in diameter', { bulletDiameter: '1' }],
		['1 in twist, spin drift on', { spinDrift: true, barrelTwist: '1' }],
		['100 in twist, spin drift on', { spinDrift: true, barrelTwist: '100' }],
		['0.1 in length, spin drift on', { spinDrift: true, bulletLength: '0.1' }],
		['4 in length, spin drift on', { spinDrift: true, bulletLength: '4' }]
	])('gives a result at %s', (_, change) => {
		expect(calculateShotPoint({ ...P308_G1, ...change }, RANGE, null, null)).not.toBeNull();
		expect(calculateFullTrajectory({ ...P308_G1, ...change }, RANGE, null, null)).not.toBeNull();
	});

	it.each([
		['10000 m', { altitude: '10000', altitudeUnit: 'm' }],
		['32808 ft', { altitude: '32808' }],
		['-1000 ft', { altitude: '-1000' }],
		['-300 m', { altitude: '-300', altitudeUnit: 'm' }]
	])('gives a result at an altitude of %s', (_, change) => {
		expect(calculateShotPoint(P308_G1, RANGE, { ...ATMO, ...change }, null)).not.toBeNull();
		expect(calculateFullTrajectory(P308_G1, RANGE, { ...ATMO, ...change }, null)).not.toBeNull();
	});

	it('gives the same result for a profile inside the limits as without the check', () => {
		// Weight and diameter do not enter the drag with a given BC without spin drift, so a
		// different weight inside the limits gives the very same drop: the check moved nothing.
		const at = (profile) => calculateShotPoint(profile, RANGE, null, null).slantHeight.In(Unit.Inch);
		expect(at({ ...P308_G1, bulletWeight: '2000' })).toBe(at(P308_G1));
	});
});
