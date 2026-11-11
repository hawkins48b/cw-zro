// @vitest-environment node
/**
 * Dope card layout (#136, #137, #138, #139). The cards are generated from the real templates with
 * the real pdf-lib and Helvetica Bold widths; every draw call is recorded with its geometry and
 * checked against the printed areas of `CARD_LAYOUTS` and `HEADER_FIELDS`:
 *
 * - header text stays inside its field (#137, #138);
 * - nothing of the drop graph is drawn outside the graph area, and a value past the scale is still
 *   printed, next to an arrow on the edge (#136, #139);
 * - every points-of-aim mark and label stays inside its target box, and labels do not overlap each
 *   other or cover another mark (#136, #139).
 *
 * jsdom breaks pdf-lib's ArrayBuffer check, hence the node environment. fetch reads `static/`.
 */
import { describe, it, expect, vi, beforeAll, afterAll, beforeEach } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import { PDFDocument, PDFPage, StandardFonts } from 'pdf-lib';
import { generateImperialDopeCard } from '#lib/utils/dopeCardImperial.js';
import { generateMetricDopeCard } from '#lib/utils/dopeCardMetric.js';
import {
	CARD_LAYOUTS,
	HEADER_FIELDS,
	MIN_HEADER_SIZE,
	bcHeaderText,
	clipSegmentY,
	encodableText,
	fitText
} from '#lib/utils/dopeCardLayout.js';
import { P223_G1, P223_SHORT_ZERO, P300BLK_SUBSONIC, P308_G1, P338_G7_METRIC } from './fixtures/ballisticProfiles.js';

const PT = 72;
const EPS = 0.01;
const calls = [];
const spies = [];
let font;

beforeAll(async () => {
	vi.stubGlobal('fetch', async (url) => {
		const bytes = fs.readFileSync(path.join(process.cwd(), 'static', url));
		return { arrayBuffer: async () => bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength) };
	});
	for (const method of ['drawText', 'drawRectangle', 'drawCircle', 'drawLine', 'drawSvgPath']) {
		const real = PDFPage.prototype[method];
		spies.push(
			vi.spyOn(PDFPage.prototype, method).mockImplementation(function (...args) {
				calls.push({ method, args, height: this.getSize().height });
				return real.apply(this, args);
			})
		);
	}
	font = await (await PDFDocument.create()).embedFont(StandardFonts.HelveticaBold);
});

afterAll(() => {
	for (const spy of spies) spy.mockRestore();
	vi.unstubAllGlobals();
});

beforeEach(() => {
	calls.length = 0;
	vi.spyOn(console, 'warn').mockImplementation(() => {});
});

const CARDS = [
	['imperial', generateImperialDopeCard],
	['metric', generateMetricDopeCard]
];

const LONG_NAMES = {
	...P308_G1,
	name: 'My very long rifle profile name for the dope card test',
	bulletBrand: 'Hornady ELD Match 178 gr boat tail hollow point',
	opticName: 'Schmidt & Bender PM II 5-25x56 Ultra Short',
	opticHeight: '2.125',
	velocity: '2725.5'
};

const PROFILES = { P223_G1, P223_SHORT_ZERO, P308_G1, P338_G7_METRIC, P300BLK_SUBSONIC, LONG_NAMES };

/** Every element drawn, as a box in PDF points (origin bottom left), with what it is. */
function elements() {
	return calls.map(({ method, args, height }) => {
		const o = method === 'drawText' || method === 'drawSvgPath' ? args[1] : args[0];
		const base = { method, height, text: method === 'drawText' ? args[0] : undefined };
		if (method === 'drawRectangle') return { ...base, x: o.x, y: o.y, w: o.width, h: o.height };
		if (method === 'drawLine') {
			return { ...base, x: Math.min(o.start.x, o.end.x), y: Math.min(o.start.y, o.end.y), w: Math.abs(o.end.x - o.start.x), h: Math.abs(o.end.y - o.start.y) };
		}
		if (method === 'drawText') return { ...base, x: o.x, y: o.y, w: o.font.widthOfTextAtSize(args[0], o.size), h: o.size * 0.72, size: o.size };
		// Circles and arrows: their anchor point, which lies on the mark.
		return { ...base, x: o.x, y: o.y, w: 0, h: 0 };
	});
}

/** Inches from the top of the page of an element's top. */
const topInches = (e) => (e.height - (e.y + e.h)) / PT;

/** Split the elements by area: header above the graph, points of aim below its axis labels. */
function byArea() {
	const all = elements();
	return {
		header: all.filter((e) => topInches(e) < 1.42),
		graph: all.filter((e) => topInches(e) >= 1.42 && topInches(e) < 5.7),
		pointsOfAim: all.filter((e) => topInches(e) >= 5.7)
	};
}

const within = (e, box) =>
	e.x >= box.x - EPS && e.y >= box.y - EPS && e.x + e.w <= box.x + box.w + EPS && e.y + e.h <= box.y + box.h + EPS;

const graphBox = (kind, height) => {
	const g = CARD_LAYOUTS[kind].graph;
	const top = height - (g.zeroY - g.max * g.perUnit) * PT;
	const bottom = height - (g.zeroY - g.min * g.perUnit) * PT;
	return { x: g.left * PT, y: bottom, w: (g.right - g.left) * PT, h: top - bottom };
};

const targetBoxes = (kind, height) =>
	CARD_LAYOUTS[kind].targets.map((t) => ({
		x: t.left * PT,
		y: height - t.bottom * PT,
		w: (t.right - t.left) * PT,
		h: (t.bottom - t.top) * PT
	}));

describe('fitText', () => {
	const width = (text, size) => font.widthOfTextAtSize(text, size);

	it('keeps a text that fits', () => {
		expect(fitText(font, 'Sierra', 100, 11)).toEqual({ text: 'Sierra', size: 11 });
	});

	it('shrinks a text that is a little too wide', () => {
		const { text, size } = fitText(font, '1000', 22, 11);
		expect(text).toBe('1000');
		expect(size).toBeLessThan(11);
		expect(size).toBeGreaterThanOrEqual(MIN_HEADER_SIZE);
		expect(width(text, size)).toBeLessThanOrEqual(22);
	});

	it('cuts a text that does not fit at the smallest size, with an ellipsis', () => {
		const { text, size } = fitText(font, LONG_NAMES.name, 100, 11);
		expect(size).toBe(MIN_HEADER_SIZE);
		expect(text.endsWith('…')).toBe(true);
		expect(LONG_NAMES.name.startsWith(text.slice(0, -1))).toBe(true);
		expect(width(text, size)).toBeLessThanOrEqual(100);
	});

	it('prints nothing when not even the ellipsis fits', () => {
		expect(fitText(font, 'abc', 1, 11)).toEqual({ text: '', size: MIN_HEADER_SIZE });
	});

	it('cuts a pasted text of 30000 characters quickly', () => {
		const start = performance.now();
		const { text } = fitText(font, 'x'.repeat(30000), 100, 11);
		expect(performance.now() - start).toBeLessThan(1000);
		expect(text.endsWith('…')).toBe(true);
		expect(width(text, MIN_HEADER_SIZE)).toBeLessThanOrEqual(100);
	});

	it('takes an empty text', () => {
		expect(fitText(font, '', 10, 11)).toEqual({ text: '', size: 11 });
	});
});

describe('clipSegmentY', () => {
	const a = { x: 0, y: 0 };

	it('keeps a segment inside the band', () => {
		expect(clipSegmentY(a, { x: 10, y: 10 }, -5, 20)).toEqual([a, { x: 10, y: 10 }]);
	});

	it('cuts a segment at the edge it crosses', () => {
		expect(clipSegmentY(a, { x: 10, y: -20 }, -10, 20)).toEqual([a, { x: 5, y: -10 }]);
	});

	it('drops a segment outside the band', () => {
		expect(clipSegmentY({ x: 0, y: -20 }, { x: 10, y: -30 }, -10, 20)).toBeNull();
		expect(clipSegmentY({ x: 0, y: 30 }, { x: 10, y: 30 }, -10, 20)).toBeNull();
	});
});

describe.each(CARDS)('%s card layout', (kind, generate) => {
	describe.each(Object.keys(PROFILES))('%s', (name) => {
		beforeEach(async () => {
			expect(await generate(structuredClone(PROFILES[name]))).not.toBeNull();
		});

		it('keeps every header text inside its field (#137, #138)', () => {
			const { header } = byArea();
			const texts = header.filter((e) => e.method === 'drawText');
			expect(texts.length).toBeGreaterThan(0);
			for (const e of texts) {
				const field = Object.values(HEADER_FIELDS).find(
					(f) => Math.abs(f.x * PT - e.x) < EPS && Math.abs(e.height - f.y * PT - e.y) < EPS
				);
				expect(field, `field of "${e.text}"`).toBeDefined();
				expect(e.x + e.w, `"${e.text}" at ${e.size} pt`).toBeLessThanOrEqual(field.right * PT + EPS);
				expect(e.size).toBeGreaterThanOrEqual(MIN_HEADER_SIZE);
			}
			expect(header.filter((e) => e.method !== 'drawText')).toEqual([]);
		});

		it('draws nothing of the drop graph outside the graph area (#136, #139)', () => {
			const { graph } = byArea();
			expect(graph.length).toBeGreaterThan(0);
			const box = graphBox(kind, graph[0].height);
			for (const e of graph) expect(within(e, box), `${e.method} ${e.text ?? ''}`).toBe(true);
		});

		it('keeps every points-of-aim mark inside a target box, labels apart (#136, #139)', () => {
			const { pointsOfAim } = byArea();
			expect(pointsOfAim.length).toBeGreaterThan(0);
			const boxes = targetBoxes(kind, pointsOfAim[0].height);
			const inBox = boxes.map(() => []);
			for (const e of pointsOfAim) {
				const i = boxes.findIndex((b) => within(e, b));
				expect(i, `${e.method} ${e.text ?? ''} inside a target box`).toBeGreaterThanOrEqual(0);
				inBox[i].push(e);
			}
			for (const items of inBox) {
				const labels = items.filter((e) => e.method === 'drawRectangle');
				const marks = items.filter((e) => e.method === 'drawCircle' || e.method === 'drawSvgPath');
				expect(labels).toHaveLength(3);
				for (let i = 0; i < labels.length; i++) {
					for (let j = i + 1; j < labels.length; j++) {
						const [p, q] = [labels[i], labels[j]];
						const apart = p.x + p.w <= q.x || q.x + q.w <= p.x || p.y + p.h <= q.y || q.y + q.h <= p.y;
						expect(apart, 'labels overlap').toBe(true);
					}
				}
				// A label may touch its own mark, never the centre of another.
				for (const m of marks) {
					const covering = labels.filter((l) => m.x > l.x && m.x < l.x + l.w && m.y > l.y && m.y < l.y + l.h);
					expect(covering, `mark at ${m.x.toFixed(1)}, ${m.y.toFixed(1)}`).toEqual([]);
				}
			}
		});
	});
});

describe('values past the printed scales (#136)', () => {
	const texts = (list) => list.filter((e) => e.method === 'drawText').map((e) => e.text);
	const arrows = (list) => list.filter((e) => e.method === 'drawSvgPath');

	it('pins the subsonic drop past -80 in to the graph edge, with its value, imperial', async () => {
		await generateImperialDopeCard(P300BLK_SUBSONIC);
		const { graph, pointsOfAim } = byArea();
		const g = CARD_LAYOUTS.imperial.graph;
		const drops = texts(graph).map(Number);
		expect(drops).toHaveLength(21);
		const past = drops.filter((v) => v < g.min);
		expect(past.length).toBeGreaterThan(5);
		// One arrow per value past the scale, all on the bottom edge.
		const box = graphBox('imperial', graph[0].height);
		expect(arrows(graph)).toHaveLength(past.length);
		for (const a of arrows(graph)) expect(a.y).toBeCloseTo(box.y, 6);
		// Elevation past the 20 MOA of the target is pinned to the top of its box.
		const elevations = texts(pointsOfAim).filter((t) => t.startsWith('+')).map(Number);
		const pinned = elevations.filter((v) => v > 20);
		expect(pinned.length).toBeGreaterThan(0);
		expect(arrows(pointsOfAim)).toHaveLength(pinned.length);
	});

	it('pins the subsonic drop past -300 cm to the graph edge, metric', async () => {
		await generateMetricDopeCard(P300BLK_SUBSONIC);
		const { graph } = byArea();
		const past = texts(graph).map(Number).filter((v) => v < CARD_LAYOUTS.metric.graph.min);
		expect(past.length).toBeGreaterThan(0);
		expect(arrows(graph)).toHaveLength(past.length);
	});

	it('draws no arrow on a card inside its scales', async () => {
		await generateImperialDopeCard(P308_G1);
		expect(arrows(elements())).toEqual([]);
	});
});

describe('characters the font cannot encode (#140)', () => {
	it('drops them and keeps WinAnsi text as it is', () => {
		expect(encodableText(font, 'Rifle 🎯')).toBe('Rifle ');
		expect(encodableText(font, '日本 Tikka')).toBe(' Tikka');
		expect(encodableText(font, 'Łódź ł Привет Ωμέγα')).toBe('ód   ');
		expect(encodableText(font, 'Gewehr ÄÖÜ é € 3.5–10×50')).toBe('Gewehr ÄÖÜ é € 3.5–10×50');
		expect(encodableText(font, 'bad\ud800end\u0085')).toBe('badend');
	});

	it('turns a space character it cannot encode into a space', () => {
		expect(encodableText(font, 'M193 55\u202fgr')).toBe('M193 55 gr');
	});

	const NAMES = [
		['emoji', 'Rifle 🎯'],
		['CJK', '日本'],
		['Cyrillic', 'Винтовка'],
		['Polish ł', 'Strzał'],
		['only emoji', '🎯🎯']
	];

	for (const [kind, generate] of CARDS) {
		it.each(NAMES)(`gives a ${kind} card for a name, brand and optic with %s`, async (_, text) => {
			const bytes = await generate({ ...P308_G1, name: text, bulletBrand: text, opticName: text });
			expect(bytes).not.toBeNull();
			for (const e of byArea().header.filter((e) => e.method === 'drawText')) {
				expect(encodableText(font, e.text)).toBe(e.text);
			}
		});

		it(`prints a WinAnsi name as typed on the ${kind} card`, async () => {
			await generate({ ...P308_G1, name: 'Gewehr ÄÖÜ é' });
			expect(byArea().header.some((e) => e.text === 'Gewehr ÄÖÜ é')).toBe(true);
		});
	}
});

describe('header text size (#137)', () => {
	it.each(CARDS)('prints short names at 11 pt as before, %s', async (_, generate) => {
		await generate(P308_G1);
		const sizes = byArea().header.filter((e) => e.method === 'drawText').map((e) => e.size);
		expect(new Set(sizes)).toEqual(new Set([11]));
	});

	it.each(CARDS)('shortens a long name with an ellipsis, %s', async (_, generate) => {
		await generate(LONG_NAMES);
		const name = byArea().header.find((e) => e.text.startsWith('My very'));
		expect(name.text.endsWith('…')).toBe(true);
		expect(name.size).toBe(MIN_HEADER_SIZE);
	});

	it.each(CARDS)('prints a name with a line break or tab, as before, %s', async (_, generate) => {
		expect(await generate({ ...P308_G1, name: 'short\nname\there' })).not.toBeNull();
		expect(byArea().header[0].text).toBe('short name here');
	});

	it.each(CARDS)('fits a four digit far zero in its field, %s (#138)', async (_, generate) => {
		await generate({ ...P308_G1, zeroDist: 2800 });
		const far = byArea().header.find((e) => /^\d{4}$/.test(e.text));
		expect(far).toBeDefined();
		expect(far.x + far.w).toBeLessThanOrEqual(HEADER_FIELDS.farZero.right * PT + EPS);
	});
});

describe('BC header (#142)', () => {
	const bcText = () => {
		const f = HEADER_FIELDS.bc;
		return elements().find((e) => e.method === 'drawText' && Math.abs(f.x * PT - e.x) < EPS && Math.abs(e.height - f.y * PT - e.y) < EPS)?.text;
	};

	it('reads the BC as the trajectory does', () => {
		expect(bcHeaderText({ bc: '0,243', bcType: 'G7' })).toBe('0.243 G7');
		expect(bcHeaderText({ bc: '0.4620', bcType: 'G1' })).toBe('0.462 G1');
		expect(bcHeaderText({ bc: 0.5, bcType: 'G7x' })).toBe('0.5 G1');
		expect(bcHeaderText({ bc: '0.3', bcType: undefined })).toBe('0.3 G1');
	});

	it.each(CARDS)('prints a short header for very long stored text, %s', async (kind, generate) => {
		const profile = { ...P308_G1, bc: P308_G1.bc + '9'.repeat(5) + 'x'.repeat(100000), bcType: 'G7'.repeat(500000) };
		expect(await generate(profile)).not.toBeNull();
		const text = bcText();
		expect(text).toBe(`${parseFloat(P308_G1.bc + '99999')} G1`);
	});

	it.each(CARDS)('prints the stored BC and table of a normal profile, %s', async (kind, generate) => {
		expect(await generate(structuredClone(P338_G7_METRIC))).not.toBeNull();
		expect(bcText()).toBe(`${parseFloat(String(P338_G7_METRIC.bc).replace(',', '.'))} G7`);
	});
});
