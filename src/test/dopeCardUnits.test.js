/**
 * Sight height and velocity printed on the dope cards (#132). Each card prints them converted to its
 * own units, and must read the stored unit as its trajectory does: 'cm' and 'mps' are metric, and
 * any other value is inches and fps. Before #132 the metric card converted only 'in' and 'fps', so a
 * damaged unit printed the stored number as cm or m/s while the trajectory used inches or fps.
 *
 * pdf-lib and fetch are replaced, as in dopeCard.baseline.test.js, so every printed label is
 * captured. A card with a damaged unit must print exactly the card of the unit its trajectory used.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { generateImperialDopeCard } from '#lib/utils/dopeCardImperial.js';
import { generateMetricDopeCard } from '#lib/utils/dopeCardMetric.js';
import { P308_G1, P338_G7_METRIC } from './fixtures/ballisticProfiles.js';

const card = vi.hoisted(() => ({ labels: [] }));

vi.mock('pdf-lib', () => ({
	rgb: () => ({}),
	StandardFonts: {},
	PDFDocument: {
		load: async () => ({
			embedFont: async () => ({ widthOfTextAtSize: (text, size) => String(text).length * size * 0.55 }),
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

beforeEach(() => {
	card.labels = [];
	vi.stubGlobal('fetch', async () => ({ arrayBuffer: async () => new ArrayBuffer(0) }));
	vi.spyOn(console, 'warn').mockImplementation(() => {});
});

/** The labels a card prints for a profile. */
async function labels(generate, profile) {
	card.labels = [];
	await generate(profile);
	return [...card.labels];
}

/** Sight height and velocity, the last two header labels. */
const heightAndVelocity = (printed) => printed.slice(8, 10);

const throwsAsText = JSON.parse('{"toString":1}');
const DAMAGED_UNITS = [['mm', 'mm'], ['IN', 'IN'], ['an empty text', ''], ['null', null], ['missing', undefined], ['an object', {}], ['an object that cannot become text', throwsAsText], ['an array', ['cm']], ['a number', 1]];

describe('metric dope card', () => {
	it('prints the recorded height and velocity for good units', async () => {
		// Recorded in dopeCard.baseline.test.js: metric inputs print as typed, imperial ones converted.
		expect(heightAndVelocity(await labels(generateMetricDopeCard, P338_G7_METRIC))).toEqual(['5', '905']);
		expect(heightAndVelocity(await labels(generateMetricDopeCard, P308_G1))).toEqual(['3.8', '807.7']);
	});

	it.each(DAMAGED_UNITS)('reads a sight height unit of %s as inches, as its trajectory does', async (_, unit) => {
		const inches = await labels(generateMetricDopeCard, { ...P308_G1, opticHeightUnit: 'in' });
		const damaged = await labels(generateMetricDopeCard, { ...P308_G1, opticHeightUnit: unit });
		expect(damaged).toEqual(inches);
		expect(damaged[8]).toBe('3.8');
	});

	it.each(DAMAGED_UNITS)('reads a velocity unit of %s as fps, as its trajectory does', async (_, unit) => {
		const fps = await labels(generateMetricDopeCard, { ...P308_G1, velocityUnit: 'fps' });
		const damaged = await labels(generateMetricDopeCard, { ...P308_G1, velocityUnit: unit });
		expect(damaged).toEqual(fps);
		expect(damaged[9]).toBe('807.7');
	});

	it('printed the stored numbers unconverted for a damaged unit before #132', async () => {
		// What the labels were: 1.5 cm and 2650 m/s for a trajectory of 1.5 in and 2650 fps.
		const damaged = await labels(generateMetricDopeCard, { ...P308_G1, opticHeightUnit: 'mm', velocityUnit: 'mm' });
		expect(heightAndVelocity(damaged)).not.toEqual(['1.5', '2650']);
		expect(heightAndVelocity(damaged)).toEqual(['3.8', '807.7']);
	});
});

describe('imperial dope card', () => {
	it('prints the recorded height and velocity for good units', async () => {
		expect(heightAndVelocity(await labels(generateImperialDopeCard, P308_G1))).toEqual(['1.5', '2650']);
		expect(heightAndVelocity(await labels(generateImperialDopeCard, P338_G7_METRIC))).toEqual(['2', '2969.2']);
	});

	it.each(DAMAGED_UNITS)('reads a sight height and velocity unit of %s as inches and fps, as its trajectory does', async (_, unit) => {
		const imperial = await labels(generateImperialDopeCard, { ...P308_G1, opticHeightUnit: 'in', velocityUnit: 'fps' });
		const damaged = await labels(generateImperialDopeCard, { ...P308_G1, opticHeightUnit: unit, velocityUnit: unit });
		expect(damaged).toEqual(imperial);
	});
});
