// @vitest-environment node
/**
 * Precision dope card PDF (#157), on the real templates, pdf-lib and Helvetica widths: the page
 * count and size, the template of each language, the units of each of the 8 unit choices (#160),
 * every drawn text inside the content area, profile text that the font cannot encode or that is too
 * long, and no PDF without data. Also that the committed templates in `static/pdf/` are what
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
import { COVER, FOOTER, LEFT, PAGE_SIZE, coverLogoLeft, PX, RANGE, RIGHT, dialInnerFits, dialValuePoint, precisionTemplatePath } from '#lib/utils/precisionCardLayout.js';
import { PRECISION_LOCALES, precisionWords } from '#lib/utils/precisionCardWords.js';
import { PRECISION_COLUMNS, PRECISION_QUANTITIES, formatColumn, formatDate, unitSymbol } from '#lib/utils/precisionCardFormat.js';
import { buildPrecisionTemplate } from '../../scripts/precision-card-templates.js';
import { P223_G1 } from './fixtures/ballisticProfiles.js';

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

/** The 8 unit choices of #160: every wind, pressure and temperature unit with every other. */
const UNIT_CHOICES = Object.keys(PRECISION_COLUMNS.wind).flatMap((wind) =>
	Object.keys(PRECISION_COLUMNS.pressure).flatMap((pressure) =>
		Object.keys(PRECISION_COLUMNS.temperature).map((temperature) => ({ wind, pressure, temperature }))
	)
);
/** A mixed choice: mph rings with hPa and °F. */
const MIXED = Object.freeze({ wind: 'mph', pressure: 'hpa', temperature: 'f' });
const choiceName = (u) => `${u.wind}/${u.pressure}/${u.temperature}`;
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
		texts.push({ text, x: options.x, y: options.y, width: options.font.widthOfTextAtSize(text, options.size), size: options.size, page: this.ref });
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
	it.each(PRECISION_LOCALES.flatMap((l) => ['metric', 'imperial', MIXED].map((u) => [l, u])))('%s %o: cover, one page per distance and the worksheet, all A6', async (locale, units) => {
		const doc = await generatePrecisionDopeCard(SAMPLE, { ...OPTIONS, units }, locale);
		expect(doc).not.toBeNull();
		expect(fetched).toEqual([precisionTemplatePath(locale)]);
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
			expect(fetched).toEqual(['/pdf/precision-en.pdf']);
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
		const doc = await generatePrecisionDopeCard(SAMPLE, OPTIONS, 'en');
		const all = texts.map((t) => t.text);
		// The 700 m page; selected by page, since 800 is also a pressure column (#160).
		const pageTexts = texts.filter((t) => t.page === doc.getPage(7).ref).map((t) => t.text);
		expect(pageTexts[0]).toBe('700');
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
		for (const [correction, units] of [['clicks', 'metric'], ['angle', 'metric'], ['clicks', MIXED], ['angle', { wind: 'mps', pressure: 'inhg', temperature: 'f' }]]) {
			texts.length = 0;
			await generatePrecisionDopeCard(SAMPLE, { ...OPTIONS, correction, units, maxDistance: 1500 }, locale);
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

	it('stops a long name and ammo before the cover logo (#201)', async () => {
		const name = 'Long rifle name '.repeat(10);
		const doc = await generatePrecisionDopeCard({ ...SAMPLE, name, ammo: 'Long ammunition text '.repeat(10) }, OPTIONS, 'en');
		const cover = doc.getPages()[0].ref;
		const header = texts.filter((t) => t.page === cover && t.y > PAGE_SIZE.height - (COVER.header.top + COVER.header.height) * PX);
		const logoLeft = coverLogoLeft() * PX;
		expect(header.filter((t) => t.text.includes('…'))).toHaveLength(2);
		for (const t of header) expect(t.x + t.width).toBeLessThanOrEqual(logoLeft - COVER.header.logoGap * PX + 0.01);
	});
});

describe('wind dial (#159)', () => {
	/** The range page's dial area, in design px from the top: below the ⑤ rule, above the footer rule. */
	const inDial = (t) => {
		const top = (PAGE_SIZE.height - t.y) / PX;
		return top > RANGE.spin.rule && top < FOOTER.rule;
	};
	/**
	 * The box of a text in PDF points: from 0.2 of its size below the baseline to 0.8 above, the
	 * white halo of a value (RANGE.dial.halo); `pad` on each side.
	 */
	const box = (t, pad = 0) => ({ left: t.x - pad, right: t.x + t.width + pad, bottom: t.y - 0.2 * t.size, top: t.y + 0.8 * t.size });
	const overlap = (a, b) => a.left < b.right && b.left < a.right && a.bottom < b.top && b.bottom < a.top;
	const label = (t) => `"${t.text}" at ${(t.x / PX).toFixed(1)},${((PAGE_SIZE.height - t.y) / PX).toFixed(1)}`;

	/** The texts of the template's range page in the dial: badge, clock and angle labels. */
	const templateDial = async () => {
		texts.length = 0;
		await buildPrecisionTemplate('en');
		const pages = [...new Set(texts.map((t) => t.page))];
		return texts.filter((t) => t.page === pages[1] && inDial(t));
	};
	/** A dial value, as drawn by the fill; the ring speeds and the unit are larger (#160). */
	const isValue = (t) => Math.abs(t.size - RANGE.dial.valueSize * PX) < 1e-9;

	/** P223_G1 with 1/4 MOA clicks: past 2000 yd it has three-digit clicks on every ring, and 100+ MOA. */
	const LONG = { ...P223_G1, reticleType: 'moa', elevationClickValue: '0.25', elevationClickUnit: 'MOA', windageClickValue: '0.25', windageClickUnit: 'MOA' };
	/** The sample in metres with a MOA reticle: four-character angles (12.2) on the inner rings. */
	const SAMPLE_MOA = { ...SAMPLE, reticleType: 'moa' };

	it.each([
		['clicks', LONG, 'imperial', 3],
		['angle', LONG, 'imperial', 5],
		['clicks', SAMPLE_MOA, 'metric', 3],
		['angle', SAMPLE_MOA, 'metric', 4],
		// Mixed units (#160): mph rings with hPa and °F, m/s rings with inHg and °F.
		['clicks', LONG, MIXED, 3],
		['angle', SAMPLE_MOA, { wind: 'mps', pressure: 'inhg', temperature: 'f' }, 4]
	])('%s, %s, %o: no dial value overlaps another, a ring label or a ray label', async (correction, profile, units, longest) => {
		const template = await templateDial();
		// XII, I, II, III, 30°, 60°, 90°, 15°, 45°, 75° and the badge.
		expect(template.map((t) => t.text)).toEqual(expect.arrayContaining(['XII', 'I', 'II', 'III', '15°', '30°', '45°', '60°', '75°', '90°']));
		expect(template).toHaveLength(11);

		texts.length = 0;
		const doc = await generatePrecisionDopeCard(profile, { ...OPTIONS, maxDistance: 3000, correction, units }, 'en');
		const ranges = doc.getPages().slice(1, -1);
		expect(ranges.length).toBeGreaterThan(20);
		const pad = RANGE.dial.halo.padding * PX;
		let widest = 0;
		for (const page of ranges) {
			const drawn = texts.filter((t) => t.page === page.ref && inDial(t));
			const values = drawn.filter(isValue);
			// The four ring speeds and the unit, drawn by the fill since #160.
			const labels = [...template, ...drawn.filter((t) => !isValue(t))];
			expect(labels).toHaveLength(16);
			expect(values).toHaveLength(24);
			for (const v of values) widest = Math.max(widest, v.text.length);
			for (let i = 0; i < values.length; i++) {
				const a = box(values[i], pad);
				for (let j = i + 1; j < values.length; j++) {
					expect(overlap(a, box(values[j], pad)), `${label(values[i])} and ${label(values[j])}`).toBe(false);
				}
				for (const l of labels) expect(overlap(a, box(l)), `${label(values[i])} and ${label(l)}`).toBe(false);
			}
		}
		// The worst case is on the card: the test measures the widest values it is meant for.
		expect(widest).toBeGreaterThanOrEqual(longest);
	});

	it('staggers only the inner ring, and only when its values would overlap on the ring (#174, #200)', () => {
		const dl = RANGE.dial;
		const centre = { x: dl.origin.x + dl.centre.x, y: dl.origin.y + dl.centre.y };
		const radius = (ring, ray, staggered) => {
			const at = dialValuePoint(ring, ray, staggered);
			return Math.hypot(at.x - centre.x, at.y - centre.y);
		};
		dl.rays.forEach((angle, ray) => {
			for (let ring = 1; ring < dl.radii.length; ring++) {
				expect(radius(ring, ray, true)).toBeCloseTo(dl.radii[ring], 9);
				expect(radius(ring, ray, false)).toBeCloseTo(dl.radii[ring], 9);
			}
			expect(radius(0, ray, true)).toBeCloseTo(dl.radii[0] + (dl.halfRays.includes(angle) ? dl.stagger[0] : 0), 9);
			expect(radius(0, ray, false)).toBeCloseTo(dl.radii[0], 9);
		});
		expect(dl.stagger[0]).toBeGreaterThan(0);
		// Bold 11 px digits are about 6.1 px wide: one digit on every ray fits on the ring, two digits
		// on 15° to 60° do not (30° and 45° are too close), nor do three.
		expect(dialInnerFits(Array(6).fill(6.1), 8.3)).toBe(true);
		expect(dialInnerFits(Array(6).fill(12.2), 16.7)).toBe(false);
		expect(dialInnerFits(Array(6).fill(18.4), 16.7)).toBe(false);
	});

	it('draws the inner ring on its ring when it fits, staggered when it does not (#200)', async () => {
		const dl = RANGE.dial;
		const centre = { x: dl.origin.x + dl.centre.x, y: dl.origin.y + dl.centre.y };
		/** The distances from the centre of the inner ring values of each range page, in px. */
		const innerRadii = async (profile, options) => {
			texts.length = 0;
			const doc = await generatePrecisionDopeCard(profile, options, 'en');
			return doc.getPages().slice(1, -1).map((page) => {
				const values = texts.filter((t) => t.page === page.ref && inDial(t) && isValue(t));
				return values.slice(0, dl.rays.length).map((t) => {
					const x = (t.x + t.width / 2) / PX;
					const y = (PAGE_SIZE.height - t.y) / PX - dl.valueSize * dl.baselineDrop;
					return Math.hypot(x - centre.x, y - centre.y);
				});
			});
		};
		// The sample to 800 m: one- and two-digit clicks, every inner value on its ring.
		for (const ring of await innerRadii(SAMPLE, OPTIONS)) {
			for (const r of ring) expect(r).toBeCloseTo(dl.radii[0], 6);
		}
		// 1/4 MOA to 3000 yd: the far pages have three-digit inner values, staggered.
		const LONG = { ...P223_G1, reticleType: 'moa', elevationClickValue: '0.25', elevationClickUnit: 'MOA', windageClickValue: '0.25', windageClickUnit: 'MOA' };
		const far = (await innerRadii(LONG, { ...OPTIONS, maxDistance: 3000, units: 'imperial' })).at(-1);
		expect(far.some((r) => Math.abs(r - dl.radii[0] - dl.stagger[0]) < 1e-6)).toBe(true);
	});

	it('prints the 700 m values of the sample, ring by ring from 15° to 90°', async () => {
		const doc = await generatePrecisionDopeCard(SAMPLE, OPTIONS, 'en');
		const p700 = doc.getPage(7);
		const values = texts.filter((t) => t.page === p700.ref && inDial(t) && isValue(t)).map((t) => t.text);
		const card = computePrecisionCard(SAMPLE, OPTIONS);
		const wind = card.pages.find((p) => p.distance === 700).wind;
		expect(values).toEqual(wind.flatMap((ring) => ring.values.map(String)));
	});
});

describe('units (#160)', () => {
	const SYMBOLS = ['hPa', 'inHg', '°C', '°F', 'm/s', 'mph'];
	/** The unit symbols in a list of texts. */
	const symbolsIn = (list) => SYMBOLS.filter((u) => list.some((t) => t.text.includes(u))).sort();

	it.each(PRECISION_LOCALES.flatMap((l) => UNIT_CHOICES.map((u) => [l, choiceName(u), u])))('%s %s: the cover, columns, rings and worksheet follow the choice', async (locale, _, units) => {
		// In fps, so that the cover's muzzle velocity prints no m/s.
		const profile = { ...SAMPLE, velocity: '2690', velocityUnit: 'fps' };
		const doc = await generatePrecisionDopeCard(profile, { ...OPTIONS, maxDistance: 300, units }, locale);
		const card = computePrecisionCard(profile, { ...OPTIONS, maxDistance: 300, units });
		const pressure = PRECISION_COLUMNS.pressure[units.pressure];
		const temperature = PRECISION_COLUMNS.temperature[units.temperature];
		const wind = PRECISION_COLUMNS.wind[units.wind];
		expect(card.units).toEqual(units);
		expect(card.columns).toEqual({ pressure, temperature, wind });
		const chosen = [unitSymbol(pressure.unit), unitSymbol(temperature.unit), unitSymbol(wind.unit)].sort();

		const pages = doc.getPages();
		const on = (page) => texts.filter((t) => t.page === page.ref);
		// Cover: the reference values and the wind unit, and no other unit.
		const cover = on(pages[0]).map((t) => t.text);
		expect(cover).toContain(`${formatColumn(pressure.reference, pressure.unit)} ${unitSymbol(pressure.unit)}`);
		expect(cover).toContain(`${temperature.reference} ${unitSymbol(temperature.unit)}`);
		expect(cover).toContain(unitSymbol(wind.unit));
		expect(symbolsIn(on(pages[0]))).toEqual(chosen);
		// Each range page: the units, every column value and every ring speed; one correction per column.
		for (const page of pages.slice(1, -1)) {
			const range = on(page);
			const all = range.map((t) => t.text);
			expect(symbolsIn(range)).toEqual(chosen);
			for (const c of pressure.columns) expect(all).toContain(formatColumn(c, pressure.unit));
			for (const c of temperature.columns) expect(all).toContain(formatColumn(c, temperature.unit));
			for (const v of wind.speeds) expect(all).toContain(String(v));
		}
		for (const p of card.pages) {
			expect(p.pressure).toHaveLength(pressure.columns.length);
			expect(p.temperature).toHaveLength(temperature.columns.length);
			expect(p.wind.map((w) => w.speed)).toEqual([...wind.speeds]);
		}
		// Worksheet.
		expect(symbolsIn(on(pages.at(-1)))).toEqual(chosen);
	});

	it.each(PRECISION_LOCALES)('%s: the template holds no unit', async (locale) => {
		texts.length = 0;
		await buildPrecisionTemplate(locale);
		expect(texts.length).toBeGreaterThan(50);
		expect(symbolsIn(texts)).toEqual([]);
	});

	it('a preset name and its units give the same PDF', async () => {
		const drawn = async (units) => {
			texts.length = 0;
			await generatePrecisionDopeCard(SAMPLE, { ...OPTIONS, units }, 'en');
			return texts.map((t) => [t.text, t.x, t.y, t.size]);
		};
		expect(await drawn({ wind: 'mph', pressure: 'inhg', temperature: 'f' })).toEqual(await drawn('imperial'));
		expect(await drawn({ wind: 'mps', pressure: 'hpa', temperature: 'c' })).toEqual(await drawn('metric'));
	});

	it.each(PRECISION_QUANTITIES)('gives no PDF for an unknown %s unit', async (quantity) => {
		vi.spyOn(console, 'error').mockImplementation(() => {});
		expect(await generatePrecisionDopeCard(SAMPLE, { ...OPTIONS, units: { ...MIXED, [quantity]: 'kelvin' } }, 'en')).toBeNull();
		expect(fetched).toEqual([]);
	});
});

describe('distance unit (#197)', () => {
	it.each([
		['m', 'yd', 'in'],
		['yd', 'm', 'cm']
	])('a 100 %s zero on a %s card: the cover keeps the zero, every page uses the chosen unit', async (zero, chosen, size) => {
		const profile = { ...SAMPLE, zeroUnit: zero };
		const doc = await generatePrecisionDopeCard(profile, { ...OPTIONS, maxDistance: 300, distanceUnit: chosen }, 'en');
		const pages = doc.getPages();
		const on = (page) => texts.filter((t) => t.page === page.ref).map((t) => t.text);
		const cover = on(pages[0]);
		expect(cover).toContain(`100 ${zero}`);
		expect(cover).toContain(`100–300 ${chosen}`);
		for (const page of pages.slice(1, -1)) {
			const all = on(page);
			expect(all).toContain(chosen);
			expect(all).not.toContain(zero);
			expect(all.filter((t) => t.startsWith("1 click")).map((t) => t.split(" ").at(-1))).toEqual([size]);
		}
		expect(on(pages.at(-1))).toContain(chosen);
	});
});

describe('templates', () => {
	it.each(PRECISION_LOCALES)('%s: the committed file is what the script writes', async (locale) => {
		const file = path.join(process.cwd(), 'static', precisionTemplatePath(locale));
		expect(fs.existsSync(file)).toBe(true);
		const committed = fs.readFileSync(file);
		const doc = await PDFDocument.load(committed);
		expect(doc.getPageCount()).toBe(3);
		expect(doc.getPages().every(isA6)).toBe(true);
		const built = Buffer.from(await buildPrecisionTemplate(locale));
		expect(built.equals(committed), 'run npm run templates:precision and commit static/pdf').toBe(true);
	});

	it('the logo fits the cover header band (#201)', () => {
		const h = COVER.header;
		expect(coverLogoLeft()).toBeGreaterThan(LEFT);
		expect(h.logo.right).toBeLessThanOrEqual(RIGHT);
		expect(h.logo.centre - h.logo.height / 2).toBeGreaterThanOrEqual(h.top);
		expect(h.logo.centre + h.logo.height / 2).toBeLessThanOrEqual(h.top + h.height);
	});
});
