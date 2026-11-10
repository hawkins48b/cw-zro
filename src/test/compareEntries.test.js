import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
	chartLabelSeries,
	chartLabelText,
	compareSeriesName,
	compareSeriesText,
	normalizeCompareEntries
} from '#lib/utils/compareEntries.js';
import { compareTrajectories } from '#lib/stores/compareTrajectories.svelte.js';

const stored = vi.hoisted(() => ({ value: {} }));

vi.mock('#lib/stores/localStore.svelte.js', () => ({ localStore: () => stored }));

const entry = { id: 'a', profileId: 'p', zeroDist: '100', zeroUnit: 'yd' };

describe('normalizeCompareEntries', () => {
	it.each([
		['a string', 'entries'],
		['an object', { 0: entry }],
		['a number', 3],
		['null', null],
		['nothing', undefined]
	])('gives no entries for %s', (_, value) => {
		expect(normalizeCompareEntries(value)).toEqual([]);
	});

	it.each([
		['null', null],
		['a number', 1],
		['a string', 'a'],
		['an array', []],
		['a numeric id', { ...entry, id: 1 }],
		['a missing id', { profileId: 'p', zeroDist: '100', zeroUnit: 'yd' }],
		['an object profileId', { ...entry, profileId: {} }],
		['a zero that cannot become text', { ...entry, zeroDist: { toString: 1 } }],
		['an array zero', { ...entry, zeroDist: [100] }],
		['a boolean zero', { ...entry, zeroDist: true }],
		['a null zero', { ...entry, zeroDist: null }],
		['an unknown unit', { ...entry, zeroUnit: 'ft' }],
		['a markup unit', { ...entry, zeroUnit: '<b>' }]
	])('leaves out %s and keeps the good entry', (_, bad) => {
		expect(normalizeCompareEntries([bad, entry])).toEqual([entry]);
	});

	it.each([
		['text', '100'],
		['a number', 100],
		['an empty zero, so its message shows', ''],
		['a rejected zero, so its message shows', '0']
	])('keeps an entry with %s', (_, zeroDist) => {
		const kept = { ...entry, zeroDist, zeroUnit: 'm' };
		expect(normalizeCompareEntries([kept])).toEqual([kept]);
	});
});

describe('compareTrajectories store', () => {
	beforeEach(() => {
		stored.value = { entries: 'damaged', range: {}, yAxis: 'in' };
	});

	it('reads damaged entries as none', () => {
		expect(compareTrajectories.entries).toEqual([]);
	});

	it('can add, change and remove on top of damaged entries', () => {
		compareTrajectories.addEntry('p', '100', 'yd');
		const [{ id }] = compareTrajectories.entries;
		compareTrajectories.updateEntry(id, { zeroDist: '200' });
		expect(compareTrajectories.entries[0].zeroDist).toBe('200');
		compareTrajectories.removeEntry(id);
		expect(compareTrajectories.entries).toEqual([]);
	});
});

describe('compareSeriesName', () => {
	it('escapes the profile name', () => {
		expect(compareSeriesName('<img src=x onerror=alert(1)>', '100', 'yd')).toBe(
			'&lt;img src=x onerror=alert(1)&gt; @ 100 yd'
		);
	});

	it('escapes the zero distance', () => {
		expect(compareSeriesName('Load', '<b>1</b>', 'm')).toBe('Load @ &lt;b&gt;1&lt;/b&gt; m');
	});

	it('escapes an ampersand once', () => {
		expect(compareSeriesName('Smith & Wesson', 100, 'yd')).toBe('Smith &amp; Wesson @ 100 yd');
	});
});

describe('compareSeriesText (#111)', () => {
	it('is the series name before escaping', () => {
		expect(compareSeriesText('Smith & Wesson <b>x</b>', 100, 'yd')).toBe('Smith & Wesson <b>x</b> @ 100\u202fyd');
		expect(compareSeriesName('Smith & Wesson <b>x</b>', 100, 'yd')).toBe(
			'Smith &amp; Wesson &lt;b&gt;x&lt;/b&gt; @ 100\u202fyd'
		);
	});
});

describe('chartLabelText (#111)', () => {
	const series = (raw) => ({ name: compareSeriesName(raw, 100, 'yd'), text: compareSeriesText(raw, 100, 'yd') });
	const smith = series('Smith & Wesson <b>x</b>');
	const { name, text } = smith;

	it('puts the text back in a legend label', () => {
		expect(chartLabelText(`${name}, visible. Press Enter or Space to toggle.`, smith)).toBe(
			`${text}, visible. Press Enter or Space to toggle.`
		);
	});

	it('puts the text back in a focused data point label', () => {
		expect(chartLabelText(`${name}: -12.5, 300`, smith)).toBe(`${text}: -12.5, 300`);
	});

	it.each([
		['a label without a series name', 'Zoom in'],
		['the label of another chart', 'line chart with 1 data series: a'],
		['an escaped name not at the start', `Chart: ${name}, visible`],
		['an escaped name not followed by a comma or colon', `${name} visible`],
		['an empty label', '']
	])('leaves %s as it is', (_, label) => {
		expect(chartLabelText(label, smith)).toBe(label);
	});

	it('leaves a label as it is without a series, or for a name without entities', () => {
		expect(chartLabelText(`${name}, visible.`, undefined)).toBe(`${name}, visible.`);
		const plain = series('Plain load');
		expect(chartLabelText(`${plain.name}, visible.`, plain)).toBe(`${plain.name}, visible.`);
	});

	it('changes nothing when called again on its own result', () => {
		const once = chartLabelText(`${name}, visible.`, smith);
		expect(chartLabelText(once, smith)).toBe(once);
	});

	describe('profiles named &amp;lt; and &lt; (security review of #111)', () => {
		const first = series('&amp;lt;');
		const second = series('&lt;');

		it('is the pair where one text starts with the other escaped name', () => {
			expect(first.text.startsWith(second.name)).toBe(true);
		});

		it('labels each item with its own name, however often it runs', () => {
			let label = `${first.name}, visible.`;
			for (let i = 0; i < 3; i++) label = chartLabelText(label, first);
			expect(label).toBe(`${first.text}, visible.`);
			let other = `${second.name}, visible.`;
			for (let i = 0; i < 3; i++) other = chartLabelText(other, second);
			expect(other).toBe(`${second.text}, visible.`);
		});

		it('leaves the text ApexCharts writes after a legend toggle as it is', () => {
			expect(chartLabelText(`${first.text}, hidden.`, first)).toBe(`${first.text}, hidden.`);
		});

		it('on the page: each legend item keeps its own name, also after a repeat run', () => {
			const texts = [first, second];
			const root = document.createElement('div');
			texts.forEach((s, i) => {
				const item = document.createElement('div');
				item.className = 'apexcharts-legend-series';
				item.setAttribute('rel', String(i + 1));
				item.setAttribute('aria-label', `${s.name}, visible.`);
				root.append(item);
			});
			const fix = () => {
				for (const node of root.querySelectorAll('[aria-label]')) {
					const index = chartLabelSeries(node);
					if (index === null) continue;
					const label = node.getAttribute('aria-label') ?? '';
					const fixed = chartLabelText(label, texts[index]);
					if (fixed !== label) node.setAttribute('aria-label', fixed);
				}
			};
			fix();
			fix();
			const labels = [...root.children].map((e) => e.getAttribute('aria-label'));
			expect(labels).toEqual([`${first.text}, visible.`, `${second.text}, visible.`]);
		});
	});
});

describe('chartLabelSeries (#111)', () => {
	it('reads a legend item by its rel', () => {
		const item = document.createElement('div');
		item.className = 'apexcharts-legend-series';
		item.setAttribute('rel', '2');
		expect(chartLabelSeries(item)).toBe(1);
	});

	it('reads a data point by its series group', () => {
		const group = document.createElementNS('http://www.w3.org/2000/svg', 'g');
		group.setAttribute('class', 'apexcharts-series');
		group.setAttribute('data:realIndex', '0');
		const point = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
		group.append(point);
		expect(chartLabelSeries(point)).toBe(0);
	});

	it.each([
		['the chart svg', () => document.createElementNS('http://www.w3.org/2000/svg', 'svg')],
		['a legend item without rel', () => Object.assign(document.createElement('div'), { className: 'apexcharts-legend-series' })],
		['a toolbar button', () => document.createElement('button')]
	])('is null for %s', (_, make) => {
		expect(chartLabelSeries(make())).toBeNull();
	});
});
