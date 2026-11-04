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
import { generateImperialDopeCard } from '$lib/utils/dopeCardImperial.js';
import { generateMetricDopeCard } from '$lib/utils/dopeCardMetric.js';
import { P308_G1, P338_G7_METRIC } from './fixtures/ballisticProfiles.js';

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
 * header: name, brand, zero, 25 impact, optic, BC, far zero, 100 impact, sight height, velocity.
 * graph: drop at 0, 25, ... 500.
 * pointsOfAim: at 200, 300, 400, 500: elevation, light wind, strong wind.
 * Imperial card: yd, in, MOA, fps, 8 and 20 mph. Metric card: m, cm, mrad, m/s, 3.5 and 9 m/s.
 */
describe('imperial dope card', () => {
	it('records a card from imperial inputs', async () => {
		await generateImperialDopeCard(P308_G1);
		expect(printed()).toEqual({
			header: ['.308 168 gr G1', '', '100', '-0.6', '', '0.462 G1', '101', '0', '1.5', '2650'],
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
			header: ['.338 LM 16.2 g G7', '', '109', '-1.1', '', '0.322 G7', '110', '0', '2', '2969.2'],
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
			header: ['.338 LM 16.2 g G7', '', '100', '-2.6', '', '0.322 G7', '101', '0', '5', '905'],
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
			header: ['.308 168 gr G1', '', '91.4', '-1.4', '', '0.462 G1', '92', '-0.4', '3.8', '807.7'],
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
