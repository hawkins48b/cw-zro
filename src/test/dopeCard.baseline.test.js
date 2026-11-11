/**
 * Dope card part of the regression baseline (#70). See ballistics.baseline.test.js for what a
 * baseline is and how to treat a failure.
 *
 * The dope cards do not use ballisticCalculator.js: each one has its own private trajectory
 * code, reachable only through the PDF generator. pdf-lib and fetch are replaced here, so
 * every number the generator prints is captured as a label without rendering a PDF. The drawn
 * geometry (graph line, circle positions) is not checked.
 *
 * Tolerance: none. The labels are the rounded strings printed on the card, so a change that
 * alters a printed figure fails, and one below the printed digit does not. The cards stop at
 * 500 units, so ballistics.baseline.test.js is the finer check of the same library.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { generateImperialDopeCard } from '#lib/utils/dopeCardImperial.js';
import { generateMetricDopeCard } from '#lib/utils/dopeCardMetric.js';
import { calculateFullTrajectory, calculateMPBR } from '#lib/utils/ballisticCalculator.js';
import { findZeroCrossings, isFlyableZeroElevation } from '#lib/utils/dopeCardZeros.js';
import { Calculator, UNew, Unit } from 'js-ballistics';
import { P223_G1, P223_SHORT_ZERO, P308_G1, P338_G7_METRIC } from './fixtures/ballisticProfiles.js';

const card = vi.hoisted(() => ({ labels: [] }));

vi.mock('pdf-lib', () => ({
	rgb: () => ({}),
	StandardFonts: {},
	PDFDocument: {
		load: async () => ({
			embedFont: async () => ({}),
			getPages: () => [
				{
					getSize: () => ({ height: 612 }),
					drawText: (text) => card.labels.push(text),
					drawLine: () => {},
					drawCircle: () => {},
					drawRectangle: () => {}
				}
			]
		})
	}
}));

beforeEach(() => {
	card.labels = [];
	vi.stubGlobal('fetch', async () => ({ arrayBuffer: async () => new ArrayBuffer(0) }));
});

/** Split the labels in drawing order: header, drop per 25 units, then points of aim. */
const printed = () => ({
	header: card.labels.slice(0, 10),
	graph: card.labels.slice(10, 31),
	pointsOfAim: card.labels.slice(31)
});

/**
 * Recorded labels.
 * header: name, brand, near zero, 25 impact, optic, BC, far zero, 100 impact, sight height,
 * velocity. Near and far zero were re-recorded for #86: near used to be the saved zero whichever
 * crossing it was, and far the first step 1 row past the crossing, so about 1 unit long.
 * graph: drop at 0, 25, ... 500.
 * pointsOfAim: at 200, 300, 400, 500: elevation, light wind, strong wind.
 * Imperial card: yd, in, MOA, fps, 8 and 20 mph. Metric card: m, cm, mrad, m/s, 3.5 and 9 m/s.
 */
describe('imperial dope card', () => {
	it('records a card from imperial inputs', async () => {
		await generateImperialDopeCard(P308_G1);
		expect(printed()).toEqual({
			header: ['.308 168 gr G1', '', '56', '-0.6', '', '0.462 G1', '100', '0', '1.5', '2650'],
			graph: [
				'-1.5', '-0.6', '-0.1', '+0.1', '0', '-0.5', '-1.4', '-2.6', '-4.3', '-6.3', '-8.9',
				'-11.8', '-15.3', '-19.2', '-23.7', '-28.7', '-34.3', '-40.4', '-47.2', '-54.6', '-62.6'
			],
			pointsOfAim: ['+2', '1.2', '3.1', '+4.9', '1.9', '4.8', '+8.2', '2.6', '6.6', '+12', '3.4', '8.6']
		});
	});

	it('converts metric inputs', async () => {
		await generateImperialDopeCard(P338_G7_METRIC);
		expect(printed()).toEqual({
			header: ['.338 LM 16.2 g G7', '', '85', '-1.1', '', '0.322 G7', '109', '0', '2', '2969.2'],
			graph: [
				'-2', '-1.1', '-0.5', '-0.1', '0', '-0.1', '-0.6', '-1.3', '-2.3', '-3.7', '-5.3',
				'-7.3', '-9.6', '-12.2', '-15.2', '-18.5', '-22.2', '-26.3', '-30.8', '-35.7', '-40.9'
			],
			pointsOfAim: ['+1.1', '0.7', '1.8', '+3', '1.1', '2.8', '+5.3', '1.5', '3.8', '+7.8', '2', '4.9']
		});
	});

	it('prints no figures for a profile that cannot be computed', async () => {
		await generateImperialDopeCard({ ...P308_G1, bc: '0' });
		expect(card.labels).toEqual([]);
	});
});

describe('metric dope card', () => {
	it('records a card from metric inputs', async () => {
		await generateMetricDopeCard(P338_G7_METRIC);
		expect(printed()).toEqual({
			header: ['.338 LM 16.2 g G7', '', '78', '-2.6', '', '0.322 G7', '100.1', '0', '5', '905'],
			graph: [
				'-5', '-2.6', '-0.9', '0', '0', '-0.8', '-2.4', '-5', '-8.4', '-12.8', '-18.2',
				'-24.5', '-31.9', '-40.4', '-49.9', '-60.6', '-72.4', '-85.4', '-99.7', '-115.2', '-132'
			],
			pointsOfAim: ['+0.4', '0.2', '0.6', '+1.1', '0.4', '0.9', '+1.8', '0.5', '1.2', '+2.6', '0.6', '1.6']
		});
	});

	it('converts imperial inputs', async () => {
		await generateMetricDopeCard(P308_G1);
		expect(printed()).toEqual({
			header: ['.308 168 gr G1', '', '51.2', '-1.4', '', '0.462 G1', '91.6', '-0.4', '3.8', '807.7'],
			graph: [
				'-3.8', '-1.4', '0', '+0.3', '-0.4', '-2.2', '-5.1', '-9.3', '-14.7', '-21.4', '-29.6',
				'-39.1', '-50.2', '-62.8', '-77.1', '-93.1', '-111', '-130.7', '-152.4', '-176.2', '-202.2'
			],
			pointsOfAim: ['+0.7', '0.4', '1', '+1.7', '0.6', '1.5', '+2.8', '0.8', '2.2', '+4', '1.1', '2.8']
		});
	});

	it('prints no figures for a profile that cannot be computed', async () => {
		await generateMetricDopeCard({ ...P338_G7_METRIC, bc: '0' });
		expect(card.labels).toEqual([]);
	});
});

/**
 * The card prints the crossings of the shot, whichever one the saved zero is (#86). A saved MPBR
 * zero is the near crossing since #109, and a usual 100 yd zero on a .308 is the far one.
 * The MPBR rows were re-recorded for #109, from the near zero the MPBR page now saves.
 */
describe('zero crossings on the card', () => {
	const CARDS = [
		['imperial', generateImperialDopeCard, 'yd'],
		['metric', generateMetricDopeCard, 'm']
	];
	/** Near and far zero of a full card. Blank fields draw nothing, so the labels shift. */
	const zeros = () => {
		const { header } = printed();
		return [header[2], header[6]];
	};
	const saved = (profile, result) => ({
		...profile,
		zeroDist: result.optimalZero,
		zeroUnit: result.useMetric ? 'm' : 'yd'
	});

	it.each([
		[0.01, true],
		[-0.01, true],
		[0.6, true],
		[0.61, false],
		[1.52, false],
		[NaN, false]
	])('treats a zero elevation of %s rad as flyable: %s', (radians, expected) => {
		expect(isFlyableZeroElevation(UNew.Radian(radians))).toBe(expected);
	});

	// A near vertical shot can hang the engine out of reach of any timeout, so the solver is stubbed
	// to return one for the crossings search only, and fire refuses to fly it.
	it.each(CARDS)('leaves the zeros blank on a near vertical solve, %s', async (_, generate) => {
		const realZero = Calculator.prototype.setWeaponZero;
		const realFire = Calculator.prototype.fire;
		let solves = 0;
		let fires = 0;
		const zero = vi.spyOn(Calculator.prototype, 'setWeaponZero').mockImplementation(function (shot, distance) {
			const result = realZero.call(this, shot, distance);
			solves += 1;
			if (solves === 5) shot.weapon.zeroElevation = UNew.Radian(1.52);
			return result;
		});
		const fire = vi.spyOn(Calculator.prototype, 'fire').mockImplementation(function (args) {
			fires += 1;
			if (args.shot.weapon.zeroElevation.In(Unit.Radian) > 1) throw new Error('flew a near vertical shot');
			return realFire.call(this, args);
		});
		try {
			await generate(P308_G1);
		} finally {
			zero.mockRestore();
			fire.mockRestore();
		}
		expect(solves).toBe(5);
		expect(fires).toBe(4);
		const { header } = printed();
		expect(header.length).toBeGreaterThan(0);
		expect(header).not.toContain('56');
	});

	it.each([
		['imperial', generateImperialDopeCard, ['56', '100']],
		['metric', generateMetricDopeCard, ['51.2', '91.6']]
	])('prints both crossings of a .308 zeroed at 100 yd, %s', async (_, generate, expected) => {
		await generate(P308_G1);
		expect(zeros()).toEqual(expected);
	});

	it.each(CARDS)('agrees with the trajectory key points, %s', async (_, generate, unit) => {
		await generate(P338_G7_METRIC);
		const [near, far] = zeros().map(parseFloat);
		const key = calculateFullTrajectory(P338_G7_METRIC, { distance: 500, unit, step: 25 }, null, null);
		expect(Math.abs(near - key.nearZero)).toBeLessThanOrEqual(0.5);
		expect(Math.abs(far - key.farZero)).toBeLessThanOrEqual(0.5);
	});

	it.each([
		['imperial', generateImperialDopeCard, '8', 'in', ['21', '249']],
		['metric', generateMetricDopeCard, '8', 'in', ['19.4', '227.5']],
		['imperial', generateImperialDopeCard, '20', 'cm', ['22', '240']],
		['metric', generateMetricDopeCard, '20', 'cm', ['20.1', '219.8']]
	])('prints the real crossings of a saved MPBR zero, %s card, %s %s target', async (_, generate, size, unit, expected) => {
		await generate(saved(P308_G1, calculateMPBR(P308_G1, size, unit)));
		expect(zeros()).toEqual(expected);
	});

	it('prints the same near and far zero as the MPBR page', async () => {
		const result = calculateMPBR(P223_SHORT_ZERO, '8', 'in');
		await generateImperialDopeCard(saved(P223_SHORT_ZERO, result));
		expect(zeros()).toEqual([String(result.nearZero), String(result.farZero)]);
	});

	it.each([
		['imperial', generateImperialDopeCard, ['6', '667']],
		['metric', generateMetricDopeCard, ['5.6', '609.6']]
	])('prints a saved zero past the 500 units of the card, %s', async (_, generate, expected) => {
		await generate(saved(P308_G1, calculateMPBR(P308_G1, '100', 'in')));
		expect(zeros()).toEqual(expected);
	});

	it.each([
		['imperial', generateImperialDopeCard, ['25', '465']],
		['metric', generateMetricDopeCard, ['23', '425.1']]
	])('prints the far crossing of a short zero, %s', async (_, generate, expected) => {
		await generate(P223_SHORT_ZERO);
		expect(zeros()).toEqual(expected);
	});

	it('reads a near crossing closer than the first row', async () => {
		await generateMetricDopeCard({ ...P308_G1, zeroDist: 2800 });
		expect(zeros()).toEqual(['0.4', '2560.4']);
	});

	it.each([
		['imperial', generateImperialDopeCard, ['111', '112']],
		['metric', generateMetricDopeCard, ['101.7', '102.3']]
	])('keeps an arc narrower than a row, %s', async (_, generate, expected) => {
		await generate({ ...P223_G1, zeroDist: 111 });
		expect(zeros()).toEqual(expected);
	});

	// Owner approval of 2026-11-10 (#93): zero distance is limited to 3000, so this test moved from
	// a 3500 zero to a 3000 yd zero on the imperial card, and the metric case to the null test below.
	it('leaves far zero blank past the search range, imperial', async () => {
		await generateImperialDopeCard({ ...P308_G1, zeroDist: 3000 });
		const { header } = printed();
		// Without far zero, the slot after BC holds the 100 unit impact.
		expect(card.labels).toHaveLength(42);
		expect(parseFloat(header[2])).toBeLessThan(1);
		expect(header[5]).toBe('0.462 G1');
		expect(header[6]).toMatch(/^\+/);
	});

	// #124: P308_G1 saves its zero in yd, so this is a 3000 yd zero, 2743.2 m. The metric card looks
	// for crossings to 3000 m, so it finds the crossing the imperial card cannot reach. It lies 0.1
	// past the zero because the solver checks height one integration step past the distance.
	it('prints the far crossing of a 3000 yd zero on the metric card, in metres (#124)', async () => {
		await generateMetricDopeCard({ ...P308_G1, zeroDist: 3000 });
		const { header } = printed();
		expect(header[6]).toBe('2743.3');
		expect(Math.abs(parseFloat(header[6]) - UNew.Yard(3000).In(Unit.Meter))).toBeLessThanOrEqual(0.2);
	});

	// #124: a zero at the end of the search range has its crossing just past it, so far zero is blank
	// on both cards, as for a 3000 yd zero on the imperial card.
	it.each([
		['metric, 3000 m zero', generateMetricDopeCard, 'm'],
		['imperial, 3000 m zero', generateImperialDopeCard, 'm']
	])('leaves far zero blank past the search range, %s (#124)', async (_, generate, zeroUnit) => {
		await generate({ ...P308_G1, zeroDist: 3000, zeroUnit });
		const { header } = printed();
		expect(card.labels).toHaveLength(42);
		expect(parseFloat(header[2])).toBeLessThan(1);
		expect(header[5]).toBe('0.462 G1');
		expect(header[6]).toMatch(/^\+/);
	});

	// Owner approval of 2026-11-10 (#93): a zero past 3000 gives no card instead of a blank far zero.
	it('gives no card for a 3500 m zero, metric', async () => {
		expect(await generateMetricDopeCard({ ...P308_G1, zeroDist: 3500, zeroUnit: 'm' })).toBeNull();
		expect(card.labels).toEqual([]);
	});

	it.each([
		['imperial', generateImperialDopeCard, '100'],
		['metric', generateMetricDopeCard, '91.6']
	])('leaves near zero blank when the muzzle is on the line of sight, %s', async (_, generate, far) => {
		await generate({ ...P308_G1, opticHeight: '0' });
		const { header } = printed();
		expect(card.labels).toHaveLength(42);
		// Without near zero, the slot after the brand holds the 25 unit impact.
		expect(header[1]).toBe('');
		expect(header[3]).toBe('');
		expect(header[5]).toBe(far);
	});

	describe('findZeroCrossings', () => {
		const rows = (...points) =>
			points.map(([distance, height]) => ({ distance: UNew.Yard(distance), targetDrop: UNew.Inch(height) }));
		const close = (actual, expected) => expect(actual).toBeCloseTo(expected, 6);

		it('reads both crossings between rows', () => {
			const { near, far } = findZeroCrossings(rows([0, -2], [10, 2], [20, 3], [30, -1]), Unit.Yard);
			close(near, 5);
			close(far, 27.5);
		});

		it('gives the distance in the unit asked for', () => {
			const { near } = findZeroCrossings(rows([0, -2], [10, 2]), Unit.Meter);
			close(near, 5 * 0.9144);
		});

		it('leaves out a crossing the rows do not reach', () => {
			expect(findZeroCrossings(rows([0, -2], [10, -1]), Unit.Yard)).toEqual({ near: null, far: null });
			const { near, far } = findZeroCrossings(rows([0, -2], [10, 2], [20, 3]), Unit.Yard);
			close(near, 5);
			expect(far).toBeNull();
		});

		it('has no near crossing when the muzzle is not below the line of sight', () => {
			const { near, far } = findZeroCrossings(rows([0, 0], [10, 2], [20, -2]), Unit.Yard);
			expect(near).toBeNull();
			close(far, 15);
		});

		it('takes no rows', () => {
			expect(findZeroCrossings(null, Unit.Yard)).toEqual({ near: null, far: null });
			expect(findZeroCrossings([], Unit.Yard)).toEqual({ near: null, far: null });
		});
	});
});
