/**
 * ApexCharts 8.8.1 (#75), rendered in jsdom: the behaviour of the library that the app relies on.
 *
 * The app imports `apexcharts`, which the browser build resolves to dist/apexcharts.esm.js.
 * Vitest would take the server build, so these tests import `apexcharts/client`, the same file.
 * jsdom has no layout: the chart gets a fixed width, and the SVG measuring calls are stubbed.
 * A failure here after an ApexCharts update means the update needs a review, not a new expected value.
 */
import { readFileSync } from 'fs';
import { afterEach, beforeAll, describe, expect, it } from 'vitest';
import ApexCharts from 'apexcharts/client';
import { compareSeriesText } from '#lib/utils/compareEntries.js';
import { chartTickAmount, MAX_CHART_TICKS } from '#lib/utils/inputLimits.js';

beforeAll(() => {
	globalThis.ResizeObserver ??= class {
		observe() {}
		unobserve() {}
		disconnect() {}
	};
	const proto = globalThis.SVGElement.prototype;
	proto.getBBox = () => ({ x: 0, y: 0, width: 40, height: 12 });
	proto.getComputedTextLength = () => 40;
	proto.getTotalLength = () => 100;
	proto.getPointAtLength = () => ({ x: 0, y: 0 });
	proto.getScreenCTM = () => null;
});

let chart = null;
let el = null;

afterEach(() => {
	chart?.destroy();
	el?.remove();
	chart = null;
	el = null;
});

/** Render a line chart with the settings every page of the app uses. */
async function render(options) {
	el = document.createElement('div');
	document.body.append(el);
	chart = new ApexCharts(el, {
		...options,
		chart: {
			type: 'line',
			height: 300,
			width: 600,
			toolbar: { show: false },
			animations: { enabled: false },
			zoom: { enabled: false },
			parentHeightOffset: 0,
			...options.chart
		},
		markers: { size: 0 }
	});
	await chart.render();
	return el;
}

const line = (y) => [
	{ x: 0, y },
	{ x: 100, y: y - 2 },
	{ x: 200, y: y - 6 }
];

describe('the installed ApexCharts', () => {
	it('is pinned to 8.8.1, the version the owner accepted (#75)', () => {
		const pkg = JSON.parse(readFileSync('package.json', 'utf8'));
		expect(pkg.dependencies.apexcharts).toBe('8.8.1');
		expect(JSON.parse(readFileSync('node_modules/apexcharts/package.json', 'utf8')).version).toBe('8.8.1');
	});
});

describe('compare chart series names (#75, was #103 and #111)', () => {
	const names = [
		'Smith & Wesson <img src=x onerror=alert(1)>',
		'<script>alert(1)</script>',
		'</div><b>Rifle</b>',
		'&lt;b&gt; &amp;',
		`Tom's "Müller" à 300 m`
	].map((name) => compareSeriesText(name, 100, 'yd'));

	async function renderNames() {
		return render({
			series: names.map((name, i) => ({ name, data: line(i) })),
			xaxis: { type: 'numeric' },
			legend: { show: true, position: 'top', horizontalAlign: 'right' },
			chart: { accessibility: { description: 'Trajectory comparison' } }
		});
	}

	it('creates no element from a name', async () => {
		const root = await renderNames();
		expect(root.querySelectorAll('img, script, b')).toHaveLength(0);
	});

	it('shows each name as typed in the legend', async () => {
		const root = await renderNames();
		const texts = [...root.querySelectorAll('.apexcharts-legend-text')];
		expect(texts.map((t) => t.textContent)).toEqual(names);
		for (const t of texts) expect(t.children).toHaveLength(0);
	});

	it('gives each legend item an aria-label that starts with the name as typed', async () => {
		const root = await renderNames();
		const labels = [...root.querySelectorAll('.apexcharts-legend-series')].map((n) => n.getAttribute('aria-label'));
		expect(labels).toHaveLength(names.length);
		labels.forEach((label, i) => expect(label.startsWith(`${names[i]}, `)).toBe(true));
	});

	it('uses the description as the chart label', async () => {
		const root = await renderNames();
		expect(root.querySelector('svg.apexcharts-svg').getAttribute('aria-label')).toBe('Trajectory comparison');
	});

	it('shows each name as typed in the shared tooltip, with no element', async () => {
		const root = await renderNames();
		// No pointer in jsdom: draw the tooltip rows as a hover over the second point would.
		const tt = chart.w.globals.tooltip;
		tt.tooltipLabels.drawSeriesTexts({ shared: true, ttItems: tt.ttItems, i: 0, j: 1 });
		const labels = [...root.querySelectorAll('.apexcharts-tooltip-text-y-label')];
		expect(labels.map((l) => l.textContent)).toEqual(names.map((name) => `${name}: `));
		for (const l of labels) expect(l.children).toHaveLength(0);
		expect(root.querySelectorAll('img, script, b')).toHaveLength(0);
	});
});

describe('Ballistic chart ticks (#130)', () => {
	it('draws at most MAX_CHART_TICKS + 1 x-axis labels for a step of 1 on 3000', async () => {
		const tickAmount = chartTickAmount(3000, 1);
		expect(tickAmount).toBe(MAX_CHART_TICKS);
		const data = Array.from({ length: 31 }, (_, i) => ({ x: i * 100, y: -i }));
		const root = await render({
			series: [{ name: 'Elevation', data }],
			xaxis: { type: 'numeric', min: 0, max: 3000, tickAmount, labels: { formatter: (v) => `${Math.round(v)}` } }
		});
		const labels = root.querySelectorAll('.apexcharts-xaxis-label');
		expect(labels.length).toBeGreaterThan(10);
		expect(labels.length).toBeLessThanOrEqual(MAX_CHART_TICKS + 1);
	});
});

describe('annotation labels', () => {
	it('draws the y-axis, x-axis range and point annotation labels the pages set', async () => {
		const label = (text, extra = {}) => ({ text, style: { color: '#fff', background: '#6366f1', fontSize: '11px' }, ...extra });
		const root = await render({
			series: [{ name: 'in', data: line(1) }],
			xaxis: { type: 'numeric', min: 0, max: 200 },
			grid: { padding: { left: 10, right: 20, top: 12, bottom: 0 } },
			annotations: {
				yaxis: [
					{ y: 0, strokeDashArray: 4, borderWidth: 1, label: label('Line of sight', { position: 'center' }) },
					{ y: -4, y2: 4, opacity: 0.12, label: label('Target zone') }
				],
				xaxis: [
					{
						x: 20,
						x2: 180,
						opacity: 0.08,
						label: label('Point Blank Range', { position: 'bottom', orientation: 'horizontal', textAnchor: 'start', offsetX: 6, offsetY: -8 })
					}
				],
				points: [
					{ x: 10, y: 0, marker: { size: 5 }, label: label('Near zero', { offsetY: -10, textAnchor: 'start' }) },
					{ x: 100, y: -1, marker: { size: 5 }, label: label('Max. Ordinate', { offsetY: -10, textAnchor: 'middle' }) },
					{ x: 190, y: -5, marker: { size: 5 }, label: label('Far zero', { offsetY: -10, textAnchor: 'end' }) }
				]
			}
		});
		const texts = [...root.querySelectorAll('.apexcharts-annotations text, .apexcharts-yaxis-annotations text, .apexcharts-xaxis-annotations text, .apexcharts-point-annotations text')].map(
			(t) => t.textContent
		);
		for (const text of ['Line of sight', 'Target zone', 'Point Blank Range', 'Near zero', 'Max. Ordinate', 'Far zero']) {
			expect(texts).toContain(text);
		}
	});
});

describe('compare chart name formatters (#103, #75)', () => {
	it('sets no formatter whose output ApexCharts would write as HTML', () => {
		const source = readFileSync('src/routes/calculators/compare-trajectories/+page.svelte', 'utf8');
		const options = source.slice(source.indexOf('function buildChartOptions'), source.indexOf('$effect(')).replace(/\/\/.*$/gm, '');
		expect(options.length).toBeGreaterThan(0);
		expect(options).not.toMatch(/tooltipHoverFormatter|custom\s*:/);
		expect(options).not.toMatch(/legend\s*:\s*{[^}]*formatter/);
		expect(options).not.toMatch(/title\s*:\s*{[^}]*formatter/);
	});
});
