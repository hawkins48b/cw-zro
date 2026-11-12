/**
 * Input limits on every calculation path (#89, #90, #91, #92, #93, #119; owner decisions of
 * 2026-11-10). Far outside them js-ballistics can stay in its loop for good, and neither try/catch
 * nor a Vitest timeout can stop that. So nothing here runs a value past a limit: the engine is
 * stubbed to throw, and the checks count calls, because each calculator's catch swallows a throw.
 * A value at a limit must reach the stub, which proves the stub is live and the limit is not
 * stricter than decided. The few tests on the real engine only use values inside the limits, which
 * were measured not to hang (3888 worst-case combinations on f40933f).
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
import { downloadDopeCard } from '#lib/utils/dopeCardDownload.js';
import { shotWinds } from '#lib/utils/shotWind.js';
import {
	MIN_BC,
	MAX_VELOCITY_FPS,
	MAX_SIGHT_HEIGHT,
	MAX_DISTANCE,
	TEMPERATURE_LIMITS,
	PRESSURE_LIMITS,
	velocityInFps,
	isUsableVelocityFps
} from '#lib/utils/inputLimits.js';
import { P308_G1, P308_G1_METRIC_EXACT } from './fixtures/ballisticProfiles.js';

const card = vi.hoisted(() => ({ labels: [] }));

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
					drawText: (text) => card.labels.push(text),
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

/** The paths that take a profile. Each returns its result; the dope cards return a promise. */
const PROFILE_PATHS = [
	['calculateShotPoint', (profile) => calculateShotPoint(profile, RANGE, null, null)],
	['calculateFullTrajectory', (profile) => calculateFullTrajectory(profile, RANGE, null, null)],
	['calculateMPBR', (profile) => calculateMPBR(profile, '8', 'in')],
	['the imperial dope card', (profile) => generateImperialDopeCard(profile)],
	['the metric dope card', (profile) => generateMetricDopeCard(profile)],
	[
		'calculateTrajectoryValidation',
		(profile) => calculateTrajectoryValidation(profile, VALIDATION_RANGE, 'distance', 10, 'in')
	]
];

/** The paths that take a custom atmosphere. */
const ATMOSPHERE_PATHS = [
	['calculateShotPoint', (atmo) => calculateShotPoint(P308_G1, RANGE, atmo, null)],
	['calculateFullTrajectory', (atmo) => calculateFullTrajectory(P308_G1, RANGE, atmo, null)],
	[
		'calculateTrajectoryValidation',
		(atmo) => calculateTrajectoryValidation(P308_G1, VALIDATION_RANGE, 'distance', 10, 'in', 'velocity', atmo)
	]
];

/** What a reload gives: JSON.parse turns 1e999 into Infinity, and keeps the rest as stored. */
const stored = (json) => JSON.parse(json);

/** No result: null, or no solution from the validation search, whose first shot gave nothing. */
const noResult = (result) => result === null || result?.error === 'no_solution';

const BC_REJECTED = [
	['just under the floor', '0.0099'],
	['0.001', '0.001'],
	['0.00001, which ran until killed', '0.00001'],
	['1e-9', '1e-9'],
	['0', '0'],
	['negative', '-0.5'],
	['Infinity', 'Infinity'],
	['a stored overflow', stored('1e999')],
	['hex, which parseFloat reads as 0', '0x10'],
	['empty', '']
];
const BC_ACCEPTED = [
	['the floor', '0.01'],
	['the floor with a comma', '0,01'],
	['a stored number at the floor', MIN_BC],
	['a G1 match bullet', '0.462']
];

const VELOCITY_REJECTED = [
	['the ceiling in fps', { velocity: '10000' }],
	['just over the ceiling in fps', { velocity: '10000.01' }],
	['1e15 fps', { velocity: '1e15' }],
	['Infinity', { velocity: 'Infinity' }],
	['a stored overflow', { velocity: stored('1e999') }],
	['the ceiling in m/s, 3048', { velocity: '3048', velocityUnit: 'mps' }],
	['just under the floor in fps', { velocity: '49.99' }],
	['just under the floor in m/s', { velocity: '15.23', velocityUnit: 'mps' }],
	['hex', { velocity: '0x10' }],
	['empty', { velocity: '' }]
];
const VELOCITY_ACCEPTED = [
	['just under the ceiling in fps', { velocity: '9999.99' }],
	['just under the ceiling in m/s', { velocity: '3047.99', velocityUnit: 'mps' }],
	['the floor in fps', { velocity: '50' }],
	['the floor in m/s', { velocity: '15.24', velocityUnit: 'mps' }],
	['a comma', { velocity: '2650,5' }]
];

const SIGHT_REJECTED = [
	['just over 10 in', { opticHeight: '10.01' }],
	['just under -10 in', { opticHeight: '-10.01' }],
	['just over 25.4 cm', { opticHeight: '25.41', opticHeightUnit: 'cm' }],
	['just under -25.4 cm', { opticHeight: '-25.41', opticHeightUnit: 'cm' }],
	['20 in, which hung with a 0.5 zero', { opticHeight: '20' }],
	['-2e6, which ran until killed', { opticHeight: '-2e6' }],
	['1e300, which ran until killed', { opticHeight: '1e300' }],
	['Infinity', { opticHeight: 'Infinity' }],
	['empty', { opticHeight: '' }]
];
const SIGHT_ACCEPTED = [
	['10 in', { opticHeight: '10' }],
	['-10 in', { opticHeight: '-10' }],
	['25.4 cm', { opticHeight: '25.4', opticHeightUnit: 'cm' }],
	['-25.4 cm', { opticHeight: '-25.4', opticHeightUnit: 'cm' }],
	['0', { opticHeight: '0' }],
	['a comma', { opticHeight: '1,5' }]
];

let solver;
let fire;
const reached = () => solver.mock.calls.length + fire.mock.calls.length > 0;

beforeEach(() => {
	card.labels = [];
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
	describe('BC (#119)', () => {
		it.each(BC_REJECTED)('gives no result for %s, before the engine', async (__, bc) => {
			expect(noResult(await run({ ...P308_G1, bc }))).toBe(true);
			expect(reached()).toBe(false);
		});

		it.each(BC_ACCEPTED)('reaches the engine with %s', async (__, bc) => {
			await run({ ...P308_G1, bc });
			expect(reached()).toBe(true);
		});
	});

	describe('velocity (#90, #91)', () => {
		it.each(VELOCITY_REJECTED)('gives no result for %s, before the engine', async (__, change) => {
			expect(noResult(await run({ ...P308_G1, ...change }))).toBe(true);
			expect(reached()).toBe(false);
		});

		it.each(VELOCITY_ACCEPTED)('reaches the engine with %s', async (__, change) => {
			await run({ ...P308_G1, ...change });
			expect(reached()).toBe(true);
		});
	});

	describe('sight height (#91, #92)', () => {
		it.each(SIGHT_REJECTED)('gives no result for %s, before the engine', async (__, change) => {
			expect(noResult(await run({ ...P308_G1, ...change }))).toBe(true);
			expect(reached()).toBe(false);
		});

		it.each(SIGHT_ACCEPTED)('reaches the engine with %s', async (__, change) => {
			await run({ ...P308_G1, ...change });
			expect(reached()).toBe(true);
		});
	});
});

describe.each([
	['calculateShotPoint', (profile, atmo) => calculateShotPoint(profile, RANGE, atmo, null)],
	['calculateFullTrajectory', (profile, atmo) => calculateFullTrajectory(profile, RANGE, atmo, null)]
])('%s, velocity with powder sensitivity', (_, run) => {
	/** 9990 fps at 59 °F, 10 fps more per °F. */
	const sensitive = { ...P308_G1, velocity: '9990', tempSensitivity: true, temperature: '59', tempModifier: '10' };

	it('gives no result when the air temperature takes the velocity past the ceiling', () => {
		expect(run(sensitive, { ...ATMO, temperature: '61' })).toBeNull();
		expect(reached()).toBe(false);
	});

	it('reaches the engine when it stays under the ceiling', () => {
		run(sensitive, { ...ATMO, temperature: '59.5' });
		expect(reached()).toBe(true);
	});

	it('gives no result for an entered velocity at the ceiling that a cold air takes below it', () => {
		expect(run({ ...sensitive, velocity: '10000' }, { ...ATMO, temperature: '0' })).toBeNull();
		expect(reached()).toBe(false);
	});
});

describe.each([
	['calculateShotPoint', (range) => calculateShotPoint(P308_G1, range, null, null)],
	['calculateFullTrajectory', (range) => calculateFullTrajectory(P308_G1, range, null, null)],
	[
		'calculateTrajectoryValidation',
		(range) => calculateTrajectoryValidation(P308_G1, range, 'distance', 10, 'in')
	]
])('%s, range (#93)', (_, run) => {
	it.each([
		['just over 3000 yd', { distance: '3000.01', unit: 'yd', step: 100 }],
		['just over 3000 m', { distance: '3000.01', unit: 'm', step: 100 }],
		['just over 3000 with a comma', { distance: '3000,01', unit: 'yd', step: 100 }],
		['1e9', { distance: '1e9', unit: 'yd', step: 100 }],
		['Infinity', { distance: 'Infinity', unit: 'yd', step: 100 }]
	])('gives no result for %s, before the engine', (__, range) => {
		expect(noResult(run(range))).toBe(true);
		expect(reached()).toBe(false);
	});

	it.each([
		['3000 yd', { distance: '3000', unit: 'yd', step: 100 }],
		['3000 m', { distance: '3000', unit: 'm', step: 100 }],
		['a comma', { distance: '600,5', unit: 'yd', step: 100 }]
	])('reaches the engine with %s', (__, range) => {
		run(range);
		expect(reached()).toBe(true);
	});
});

describe.each(ATMOSPHERE_PATHS)('%s, custom atmosphere (#92)', (_, run) => {
	it.each([
		['-90.01 °C', { temperature: '-90.01', temperatureUnit: 'c' }],
		['70.01 °C', { temperature: '70.01', temperatureUnit: 'c' }],
		['-273 °C, which ran until killed', { temperature: '-273', temperatureUnit: 'c' }],
		['100000 °C, which ran until killed', { temperature: '100000', temperatureUnit: 'c' }],
		['-130.01 °F', { temperature: '-130.01' }],
		['158.01 °F', { temperature: '158.01' }],
		['-600 °F, which ran until killed', { temperature: '-600' }],
		['299.99 hPa', { pressure: '299.99', pressureUnit: 'hpa' }],
		['1200.01 hPa', { pressure: '1200.01', pressureUnit: 'hpa' }],
		['1e8 hPa, which ran until killed', { pressure: '1e8', pressureUnit: 'hpa' }],
		['8.85 inHg', { pressure: '8.85' }],
		['35.41 inHg', { pressure: '35.41' }],
		['1e308 inHg, which ran until killed', { pressure: '1e308' }],
		['0 inHg', { pressure: '0' }],
		['humidity under 0', { humidity: '-0.01' }],
		['humidity over 100', { humidity: '100.01' }],
		['an altitude that is not a number', { altitude: 'abc' }],
		['an infinite altitude', { altitude: 'Infinity' }],
		['an empty temperature', { temperature: '' }]
	])('gives no result for %s, before the engine', (__, change) => {
		expect(noResult(run({ ...ATMO, ...change }))).toBe(true);
		expect(reached()).toBe(false);
	});

	it.each([
		['-90 °C', { temperature: '-90', temperatureUnit: 'c' }],
		['70 °C', { temperature: '70', temperatureUnit: 'c' }],
		['-130 °F', { temperature: '-130' }],
		['158 °F', { temperature: '158' }],
		['300 hPa', { pressure: '300', pressureUnit: 'hpa' }],
		['1200 hPa', { pressure: '1200', pressureUnit: 'hpa' }],
		['1013,25 hPa, with a comma', { pressure: '1013,25', pressureUnit: 'hpa' }],
		['8.86 inHg', { pressure: '8.86' }],
		['35.4 inHg', { pressure: '35.4' }],
		['humidity 0', { humidity: '0' }],
		['humidity 100', { humidity: '100' }],
		['-1000 ft', { altitude: '-1000' }]
	])('reaches the engine with %s', (__, change) => {
		run({ ...ATMO, ...change });
		expect(reached()).toBe(true);
	});
});

describe('a saved profile holding a value out of its limits (#89, #119)', () => {
	/** What storage can hold after a reload, from an old form or a tampered value. */
	const SAVED = stored(
		'[{"bc":"0x10"},{"bc":"1e-9"},{"velocity":1e999},{"velocity":"Infinity"},{"velocity":"0x10"},{"opticHeight":"1e300"},{"zeroDist":"Infinity"},{"zeroDist":0.05}]'
	);
	// MPBR solves its own zero, so a saved zero does not reach it.
	const cases = PROFILE_PATHS.flatMap(([path, run]) =>
		SAVED.filter((change) => !(path === 'calculateMPBR' && 'zeroDist' in change)).map((change) => [
			path,
			JSON.stringify(change),
			run,
			change
		])
	);

	it.each(cases)('%s gives no result for %s, before the engine', async (_, __, run, change) => {
		expect(noResult(await run({ ...P308_G1, ...change }))).toBe(true);
		expect(reached()).toBe(false);
	});
});

describe('limits', () => {
	it('are the values the owner chose', () => {
		expect(MIN_BC).toBe(0.01);
		expect(MAX_VELOCITY_FPS).toBe(10000);
		expect(MAX_SIGHT_HEIGHT).toEqual({ in: 10, cm: 25.4 });
		expect(MAX_DISTANCE).toBe(3000);
		expect(TEMPERATURE_LIMITS).toEqual({ c: { min: -90, max: 70 }, f: { min: -130, max: 158 } });
		expect(PRESSURE_LIMITS).toEqual({ hpa: { min: 300, max: 1200 }, inhg: { min: 8.86, max: 35.4 } });
	});

	it('convert m/s as the form shows them: 15.24 is in, 3048 is out', () => {
		expect(isUsableVelocityFps(velocityInFps(15.24, 'mps'))).toBe(true);
		expect(isUsableVelocityFps(velocityInFps(15.23, 'mps'))).toBe(false);
		expect(isUsableVelocityFps(velocityInFps(3047.99, 'mps'))).toBe(true);
		expect(isUsableVelocityFps(velocityInFps(3048, 'mps'))).toBe(false);
	});
});

describe('dope cards with no data (#91)', () => {
	it.each([
		['imperial', generateImperialDopeCard],
		['metric', generateMetricDopeCard]
	])('the %s card returns null and draws nothing', async (_, generate) => {
		expect(await generate({ ...P308_G1, velocity: '' })).toBeNull();
		expect(card.labels).toEqual([]);
		expect(reached()).toBe(false);
	});

	it('downloadDopeCard saves nothing and reports no-data when a card has no data', async () => {
		const save = vi.fn();
		expect(await downloadDopeCard(generateImperialDopeCard, { ...P308_G1, bc: '0.001' }, save)).toBe('no-data');
		expect(save).not.toHaveBeenCalled();
	});

	it('downloadDopeCard saves a card that has data', async () => {
		const save = vi.fn(async () => {});
		const doc = {};
		expect(await downloadDopeCard(async () => doc, P308_G1, save)).toBe('saved');
		expect(save).toHaveBeenCalledWith(doc);
	});
});

describe('dope card build or save failure (#123)', () => {
	it('reports failed, not no-data, when the generator throws', async () => {
		const save = vi.fn();
		const generate = async () => {
			throw new Error('template not loaded');
		};
		expect(await downloadDopeCard(generate, P308_G1, save)).toBe('failed');
		expect(save).not.toHaveBeenCalled();
	});

	it.each([
		['imperial', generateImperialDopeCard],
		['metric', generateMetricDopeCard]
	])('reports failed when the %s template cannot be fetched, on a valid profile', async (_, generate) => {
		vi.stubGlobal('fetch', async () => {
			throw new TypeError('Failed to fetch');
		});
		const save = vi.fn();
		expect(await downloadDopeCard(generate, P308_G1, save)).toBe('failed');
		expect(save).not.toHaveBeenCalled();
	});

	it('reports failed when saving the file throws', async () => {
		const save = vi.fn(async () => {
			throw new Error('disk full');
		});
		expect(await downloadDopeCard(async () => ({}), P308_G1, save)).toBe('failed');
		expect(save).toHaveBeenCalledTimes(1);
	});

	it('reports no-data on a profile with no data even though nothing failed', async () => {
		const save = vi.fn();
		expect(await downloadDopeCard(generateMetricDopeCard, { ...P308_G1, bulletWeight: '0' }, save)).toBe('no-data');
		expect(save).not.toHaveBeenCalled();
	});
});

describe('on the real engine, inside the limits', () => {
	beforeEach(() => {
		solver.mockRestore();
		fire.mockRestore();
	});

	it.each([
		['imperial', generateImperialDopeCard],
		['metric', generateMetricDopeCard]
	])('the %s card of a valid profile is a document', async (_, generate) => {
		expect(await generate(P308_G1)).not.toBeNull();
		expect(card.labels.length).toBeGreaterThan(0);
	});

	it.each([
		['imperial', generateImperialDopeCard],
		['metric', generateMetricDopeCard]
	])('the %s card of a load that stops before 500 units returns null', async (_, generate) => {
		expect(await generate({ ...P308_G1, velocity: '60' })).toBeNull();
		expect(card.labels).toEqual([]);
	});

	it.each([
		['10 in sight height', { ...P308_G1, opticHeight: '10' }, null],
		['-10 in sight height', { ...P308_G1, opticHeight: '-10' }, null],
		['25.4 cm sight height', { ...P308_G1_METRIC_EXACT, opticHeight: '25.4' }, null],
		['BC 0.01 at a short range', { ...P308_G1, bc: '0.01' }, { distance: 50, unit: 'yd', step: 10 }],
		['-90 °C', P308_G1, null, { ...ATMO, temperature: '-90', temperatureUnit: 'c' }],
		['70 °C', P308_G1, null, { ...ATMO, temperature: '70', temperatureUnit: 'c' }],
		['300 hPa', P308_G1, null, { ...ATMO, pressure: '300', pressureUnit: 'hpa' }],
		['1200 hPa', P308_G1, null, { ...ATMO, pressure: '1200', pressureUnit: 'hpa' }]
	])('gives a result at %s', (_, profile, range, atmo = null) => {
		expect(calculateShotPoint(profile, range ?? RANGE, atmo, null)).not.toBeNull();
		expect(calculateFullTrajectory(profile, range ?? RANGE, atmo, null)).not.toBeNull();
	});
});

describe('decimal comma on the wind path (#117)', () => {
	it.each([
		[{ speed: '1,5', direction: '90' }, { speed: '1.5', direction: '90' }],
		[{ speed: '10', direction: '12,5' }, { speed: '10', direction: '12.5' }],
		[{ speed: '1,5', direction: '-90,5' }, { speed: '1.5', direction: '-90.5' }]
	])('reads %j as %j', (comma, point) => {
		expect(shotWinds({ speedUnit: 'mph', ...comma })).toEqual(shotWinds({ speedUnit: 'mph', ...point }));
	});

	it('does not read 1,5 as 1', () => {
		expect(shotWinds({ speed: '1,5', speedUnit: 'mph', direction: '90' })).not.toEqual(
			shotWinds({ speed: '1', speedUnit: 'mph', direction: '90' })
		);
	});

	it('keeps 0,5 as a wind: it is not cut to 0, which would mean no wind', () => {
		expect(shotWinds({ speed: '0,5', speedUnit: 'mph', direction: '90' })).toHaveLength(1);
	});

	it('gives the result of the same wind with a decimal point', () => {
		solver.mockRestore();
		fire.mockRestore();
		const comma = calculateShotPoint(P308_G1, RANGE, null, { speed: '10,5', speedUnit: 'mph', direction: '90' });
		const point = calculateShotPoint(P308_G1, RANGE, null, { speed: '10.5', speedUnit: 'mph', direction: '90' });
		expect(comma.windage.In(Unit.Inch)).toBe(point.windage.In(Unit.Inch));
		expect(comma.windage.In(Unit.Inch)).not.toBe(
			calculateShotPoint(P308_G1, RANGE, null, { speed: '10', speedUnit: 'mph', direction: '90' }).windage.In(Unit.Inch)
		);
	});
});
