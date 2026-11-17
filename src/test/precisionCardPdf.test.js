// @vitest-environment node
/**
 * Precision dope card PDF (#157), on the real templates, pdf-lib and Helvetica widths: the page
 * count and size, the template of each language and unit system, every drawn text inside the
 * content area, profile text that the font cannot encode or that is too long, and no PDF without
 * data. Also that the committed templates in `static/pdf/` are what
 * `scripts/precision-card-templates.js` writes, so that no one edits one without the other.
 *
 * jsdom breaks pdf-lib's ArrayBuffer check, hence the node environment. fetch reads `static/`.
 */
import { describe, it, expect, vi, beforeAll, afterAll, beforeEach } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import { PDFArray, PDFDocument, PDFPage } from 'pdf-lib';
import { generatePrecisionDopeCard } from '#lib/utils/precisionCardPdf.js';
import { computePrecisionCard } from '#lib/utils/precisionCard.js';
import { LEFT, PAGE_SIZE, PX, RIGHT, precisionTemplatePath } from '#lib/utils/precisionCardLayout.js';
import { PRECISION_LOCALES, precisionWords } from '#lib/utils/precisionCardWords.js';
import { formatDate } from '#lib/utils/precisionCardFormat.js';
import { TEMPLATE_UNITS, buildPrecisionTemplate } from '../../scripts/precision-card-templates.js';

const SAMPLE = Object.freeze({
	name: 'Tikka T3x',
	ammo: '6.5 Creedmoor 140 gr',
	opticName: 'Vortex Viper',
	barrelTwist: '8',
	barrelTwistUnit: 'in',
	opticHeight: '4.5',
	opticHeightUnit: 'cm',
	zeroDist: 100,
	zeroUnit: 'm',
	bulletDiameter: '0.264',
	bulletDiameterUnit: 'in',
	bulletWeight: '140',
	bulletWeightUnit: 'gr',
	bcType: 'G7',
	bc: '0.326',
	bulletLength: '1.37',
	bulletLengthUnit: 'in',
	velocity: '820',
	velocityUnit: 'mps',
	temperature: '15',
	temperatureUnit: 'c',
	tempModifier: '',
	spinDrift: false,
	tempSensitivity: false,
	reticleType: 'mrad',
	elevationClickValue: '0.1',
	elevationClickUnit: 'MRAD',
	windageClickValue: '0.1',
	windageClickUnit: 'MRAD'
});

const OPTIONS = { maxDistance: 800, correction: 'clicks', units: 'metric', date: new Date(2026, 10, 17) };
const texts = [];
const fetched = [];

beforeAll(() => {
	vi.stubGlobal('fetch', async (url) => {
		fetched.push(url);
		const bytes = fs.readFileSync(path.join(process.cwd(), 'static', url));
		return { arrayBuffer: async () => bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength) };
	});
	const real = PDFPage.prototype.drawText;
	vi.spyOn(PDFPage.prototype, 'drawText').mockImplementation(function (text, options) {
		texts.push({ text, x: options.x, y: options.y, width: options.font.widthOfTextAtSize(text, options.size), size: options.size });
		return real.call(this, text, options);
	});
});

afterAll(() => {
	vi.restoreAllMocks();
	vi.unstubAllGlobals();
});

beforeEach(() => {
	texts.length = 0;
	fetched.length = 0;
});

const isA6 = (page) => {
	const { width, height } = page.getSize();
	return Math.abs(width - PAGE_SIZE.width) < 0.01 && Math.abs(height - PAGE_SIZE.height) < 0.01;
};

describe('generatePrecisionDopeCard', () => {
	it.each(PRECISION_LOCALES.flatMap((l) => TEMPLATE_UNITS.map((u) => [l, u])))('%s %s: cover, one page per distance and the worksheet, all A6', async (locale, units) => {
		const doc = await generatePrecisionDopeCard(SAMPLE, { ...OPTIONS, units }, locale);
		expect(doc).not.toBeNull();
		expect(fetched).toEqual([precisionTemplatePath(locale, units)]);
		expect(doc.getPageCount()).toBe(8 + 2);
		expect(doc.getPages().every(isA6)).toBe(true);
		// It saves, and reloads with the same pages.
		const reloaded = await PDFDocument.load(await doc.save());
		expect(reloaded.getPageCount()).toBe(10);
	});

	it('prints each distance on its own page only (#158)', async () => {
		// The content streams of a range page: the template's, plus what was drawn for its distance.
		const streams = (page) => {
			const contents = page.node.Contents();
			return contents instanceof PDFArray ? contents.size() : 1;
		};
		const single = await generatePrecisionDopeCard(SAMPLE, { ...OPTIONS, maxDistance: 100 }, 'en');
		const perPage = streams(single.getPage(1));
		const doc = await generatePrecisionDopeCard(SAMPLE, OPTIONS, 'en');
		const ranges = doc.getPages().slice(1, -1);
		expect(ranges).toHaveLength(8);
		// Pages copied together shared one /Contents, so each held the streams of all eight distances.
		for (const page of ranges) expect(streams(page)).toBe(perPage);
		expect(new Set(ranges.map((page) => page.node.Contents())).size).toBe(8);
	});

	it('uses the English template for another locale', async () => {
		for (const locale of ['it', '', undefined, null, 'FR']) {
			fetched.length = 0;
			await generatePrecisionDopeCard(SAMPLE, OPTIONS, locale);
			expect(fetched).toEqual(['/pdf/precision-en-metric.pdf']);
		}
	});

	it('has as many range pages as the card, up to where the flight ends', async () => {
		const slow = { ...SAMPLE, zeroUnit: 'yd', velocity: '200', velocityUnit: 'fps', bc: '0.05', bcType: 'G1' };
		const card = computePrecisionCard(slow, OPTIONS);
		expect(card.pages.length).toBe(3);
		const doc = await generatePrecisionDopeCard(slow, OPTIONS, 'en');
		expect(doc.getPageCount()).toBe(card.pages.length + 2);
	});

	it('gives no PDF and fetches nothing without data', async () => {
		vi.spyOn(console, 'error').mockImplementation(() => {});
		expect(await generatePrecisionDopeCard({ ...SAMPLE, zeroDist: 200 }, OPTIONS, 'en')).toBeNull();
		expect(await generatePrecisionDopeCard(SAMPLE, { ...OPTIONS, maxDistance: 20 }, 'en')).toBeNull();
		expect(fetched).toEqual([]);
	});

	it('prints the 700 m values of the design', async () => {
		await generatePrecisionDopeCard(SAMPLE, OPTIONS, 'en');
		const all = texts.map((t) => t.text);
		const at700 = all.indexOf('700');
		expect(at700).toBeGreaterThan(0);
		const pageTexts = all.slice(at700, all.indexOf('800'));
		for (const expected of ['+58', '725 =', '+3', '750 =', '+7', '775 =', '+10', 'Left +1 click', '1.07 s', '1 click = 0.1 MRAD = 7.0 cm', 'Tikka T3x · ']) {
			expect(pageTexts).toContain(expected);
		}
		expect(all).toContain(`ZRO · ${formatDate(OPTIONS.date)}`);
		expect(all).toContain('100–800 m');
		expect(all).toContain('1:8" right');
		expect(all).toContain('page 10');
		expect(all).toContain('1 / 10');
		expect(all).toContain('10 / 10');
	});

	it.each(PRECISION_LOCALES)('%s: every drawn text stays inside the content area', async (locale) => {
		for (const correction of ['clicks', 'angle']) {
			texts.length = 0;
			await generatePrecisionDopeCard(SAMPLE, { ...OPTIONS, correction, maxDistance: 1500 }, locale);
			expect(texts.length).toBeGreaterThan(100);
			for (const t of texts) {
				expect(t.x, t.text).toBeGreaterThanOrEqual(LEFT * PX - 0.5);
				expect(t.x + t.width, t.text).toBeLessThanOrEqual(RIGHT * PX + 0.5);
				expect(t.y, t.text).toBeGreaterThan(0);
				expect(t.y + t.size, t.text).toBeLessThan(PAGE_SIZE.height);
			}
		}
	});

	it('prints the words of the language', async () => {
		await generatePrecisionDopeCard({ ...SAMPLE, barrelTwist: '-8' }, OPTIONS, 'fr');
		const all = texts.map((t) => t.text);
		const fr = precisionWords('fr');
		expect(all).toContain(`1:8" ${fr.twistLeft}`);
		expect(all).toContain(`${fr.right} +1 clic`);
		expect(all).toContain('1 clic = 0.1 MRAD = 7.0 cm');
	});

	it('prints MRAD or MOA in angle mode', async () => {
		await generatePrecisionDopeCard(SAMPLE, { ...OPTIONS, correction: 'angle' }, 'de');
		const all = texts.map((t) => t.text);
		expect(all).toContain('+5.8');
		expect(all).toContain('Links +0.1 MRAD');
	});

	it('prints a dash for spin drift without twist', async () => {
		await generatePrecisionDopeCard({ ...SAMPLE, barrelTwist: '' }, OPTIONS, 'en');
		const all = texts.map((t) => t.text);
		expect(all.filter((t) => t === '–').length).toBeGreaterThanOrEqual(8);
		expect(all.some((t) => / click$/.test(t) && /^(Left|Right)/.test(t))).toBe(false);
	});

	it('drops characters the font cannot encode, and cuts long names', async () => {
		const name = 'Łódź 🎯 карабин ' + 'very long rifle name '.repeat(20);
		const doc = await generatePrecisionDopeCard({ ...SAMPLE, name, ammo: '7.62×51 混合 '.repeat(10), opticName: 'S&B PM II\nUltra' }, OPTIONS, 'en');
		expect(doc).not.toBeNull();
		await doc.save();
		for (const t of texts) expect(t.text).not.toMatch(/[Łźкарбин🎯混合\n]/u);
		expect(texts.some((t) => t.text.startsWith('ódz') || t.text.startsWith('ód'))).toBe(true);
		expect(texts.some((t) => t.text.includes('…'))).toBe(true);
	});
});

describe('templates', () => {
	it.each(PRECISION_LOCALES.flatMap((l) => TEMPLATE_UNITS.map((u) => [l, u])))('%s %s: the committed file is what the script writes', async (locale, units) => {
		const file = path.join(process.cwd(), 'static', precisionTemplatePath(locale, units));
		expect(fs.existsSync(file)).toBe(true);
		const committed = fs.readFileSync(file);
		const doc = await PDFDocument.load(committed);
		expect(doc.getPageCount()).toBe(3);
		expect(doc.getPages().every(isA6)).toBe(true);
		const built = Buffer.from(await buildPrecisionTemplate(locale, units));
		expect(built.equals(committed), 'run npm run templates:precision and commit static/pdf').toBe(true);
	});
});
