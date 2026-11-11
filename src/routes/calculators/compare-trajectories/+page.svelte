<script>
	import { onMount } from 'svelte';
	import { m } from '#lib/paraglide/messages.js';
	import { localizeHref } from '#lib/paraglide/runtime.js';
	import { profiles } from '#lib/stores/profiles.svelte.js';
	import { settings } from '#lib/stores/settings.svelte.js';
	import { compareTrajectories } from '#lib/stores/compareTrajectories.svelte.js';
	import { calculateFullTrajectory } from '#lib/utils/ballisticCalculator.js';
	import {
		chartLabelSeries,
		chartLabelText,
		compareSeriesName,
		compareSeriesText
	} from '#lib/utils/compareEntries.js';
	import { shownProfile } from '#lib/utils/storedProfiles.js';
	import { isUsableZeroDistance, MIN_ZERO_DISTANCE, MAX_ZERO_DISTANCE } from '#lib/utils/zeroDistance.js';
	import { readDecimal } from '#lib/utils/decimal.js';
	import { formatLimit } from '#lib/utils/format.js';
	import { isUsableRange, MAX_DISTANCE } from '#lib/utils/inputLimits.js';
	import { Unit } from 'js-ballistics';
	import { Plus, X } from '@lucide/svelte';

	// ── ApexCharts (lazy-loaded, browser-only) ───────────────────────
	let ApexCharts = $state(null);
	let chartEl = $state(null);

	onMount(async () => {
		const mod = await import('apexcharts');
		ApexCharts = mod.default;
	});

	// ── Chart unit helpers ───────────────────────────────────────────
	const Y_AXIS_OPTIONS = [
		{ value: 'in', label: () => m.unit_in() },
		{ value: 'ft', label: () => m.unit_ft() },
		{ value: 'yd', label: () => m.unit_yd() },
		{ value: 'cm', label: () => m.unit_cm() },
		{ value: 'm', label: () => m.unit_m() }
	];

	function getYUnit(key) {
		switch (key) {
			case 'in': return Unit.Inch;
			case 'ft': return Unit.Foot;
			case 'yd': return Unit.Yard;
			case 'cm': return Unit.Centimeter;
			case 'm': return Unit.Meter;
			default: return Unit.Inch;
		}
	}

	let isMetric = $derived(compareTrajectories.range.unit === 'm');
	let distLabel = $derived(isMetric ? m.unit_m() : m.unit_yd());
	let yAxisKey = $derived(compareTrajectories.yAxis);

	// ── Resolve entries to profiles ──────────────────────────────────
	let resolvedEntries = $derived(
		compareTrajectories.entries.map((entry) => {
			const profile = profiles.findStored(entry.profileId);
			if (!profile) return null;
			const zeroUnitLabel = entry.zeroUnit === 'm' ? m.unit_m() : m.unit_yd();
			// The calculators get the profile as stored; the page shows its names as text (#120).
			const shown = shownProfile(profile);
			return {
				...entry,
				profile,
				shown,
				seriesName: compareSeriesName(shown.name, entry.zeroDist, zeroUnitLabel),
				seriesText: compareSeriesText(shown.name, entry.zeroDist, zeroUnitLabel)
			};
		}).filter(Boolean)
	);

	// ── Compute trajectories for all entries ─────────────────────────
	let rangeDist = $derived(readDecimal(compareTrajectories.range.distance));
	let rangeUsable = $derived(isUsableRange(rangeDist));

	/** The trajectory of each entry, in the order of resolvedEntries: null when it has none. */
	let entryResults = $derived.by(() => {
		if (!rangeUsable) return resolvedEntries.map(() => null);
		const rangeObj = { distance: rangeDist, unit: compareTrajectories.range.unit, step: 1 };
		return resolvedEntries.map((entry) =>
			calculateFullTrajectory(
				{ ...entry.profile, zeroDist: entry.zeroDist, zeroUnit: entry.zeroUnit },
				rangeObj,
				null,
				null
			)
		);
	});

	let chartData = $derived.by(() => {
		if (resolvedEntries.length === 0) return null;

		const series = [];
		for (const [i, entry] of resolvedEntries.entries()) {
			const result = entryResults[i];
			if (!result) continue;

			const distUnit = isMetric ? Unit.Meter : Unit.Yard;
			const yUnit = getYUnit(yAxisKey);
			const data = (result.trajectory ?? []).map((p) => ({
				x: Math.round(p.distance.In(distUnit) * 10) / 10,
				y: Math.round(p.targetDrop.In(yUnit) * 100) / 100
			}));
			// An entry without a result has no series, so the color comes from the entry's position:
			// a line must keep the color of the dot on its card.
			series.push({ name: entry.seriesName, text: entry.seriesText, data, color: entryColor(i) });
		}

		return series.length > 0 ? series : null;
	});

	// ── Chart rendering ──────────────────────────────────────────────
	const CHART_COLORS = [
		'#6366f1', '#22c55e', '#f59e0b', '#ef4444', '#06b6d4',
		'#8b5cf6', '#ec4899', '#14b8a6', '#f97316', '#64748b'
	];

	function entryColor(index) {
		return CHART_COLORS[index % CHART_COLORS.length];
	}

	/**
	 * @param {{ name: string, data: object[], color: string }[]} series - names escaped (#103)
	 * @param {boolean} dark
	 * @param {string[]} texts - the series names as the user reads them, for the chart label (#111)
	 */
	function buildChartOptions(series, dark, texts) {
		const dAxisLabel = isMetric ? m.unit_meters() : m.unit_yards();
		const dLabel = isMetric ? m.unit_m() : m.unit_yd();
		const yLabel = Y_AXIS_OPTIONS.find((o) => o.value === yAxisKey)?.label();

		const maxX = series.reduce((max, s) => {
			const last = s.data.at(-1)?.x ?? 0;
			return last > max ? last : max;
		}, 0);

		return {
			series,
			chart: {
				type: 'line',
				height: 320,
				background: 'transparent',
				toolbar: { show: false },
				animations: { enabled: false },
				zoom: { enabled: false },
				parentHeightOffset: 0,
				// ApexCharts builds the svg aria-label from the escaped series names; this label
				// replaces it and is written as text, not HTML (#111).
				accessibility: {
					description: m.compare_chart_description({ names: texts.join(', ') })
				}
			},
			stroke: { width: 2, curve: 'monotoneCubic' },
			theme: { mode: dark ? 'dark' : 'light' },
			grid: {
				borderColor: dark ? '#374151' : '#e5e7eb',
				strokeDashArray: 3,
				padding: { left: 10, right: 20, top: 0, bottom: 0 }
			},
			xaxis: {
				type: 'numeric',
				min: 0,
				max: maxX || undefined,
				title: { text: dAxisLabel, style: { fontSize: '12px' } },
				labels: { formatter: (v) => `${Math.round(v)}` }
			},
			yaxis: {
				title: { text: yLabel, style: { fontSize: '12px' } },
				labels: { formatter: (v) => `${v}` }
			},
			colors: series.map((s) => s.color),
			annotations: {
				yaxis: [
					{
						y: 0,
						borderColor: dark ? '#9ca3af' : '#6b7280',
						strokeDashArray: 4,
						borderWidth: 1,
						label: {
							text: m.ballistic_legend_los(),
							position: 'center',
							style: {
								fontSize: '10px',
								color: dark ? '#9ca3af' : '#6b7280',
								background: 'transparent',
								border: 'none'
							}
						}
					}
				]
			},
			tooltip: {
				theme: dark ? 'dark' : 'light',
				x: { formatter: (v) => `${v} ${dLabel}` },
				y: { formatter: (v) => `${v} ${yLabel}` }
			},
			legend: { show: true, position: 'top', horizontalAlign: 'right' },
			markers: { size: 0 }
		};
	}

	$effect(() => {
		const ac = ApexCharts;
		const el = chartEl;
		const data = chartData;
		if (!ac || !el || !data) return;

		const texts = data.map(({ name, text }) => ({ name, text }));
		const series = data.map(({ text, ...rest }) => rest);
		const opts = buildChartOptions(series, settings.darkMode, texts.map(({ text }) => text));

		// ApexCharts copies the escaped series names into the aria-labels of the legend items and
		// of the keyboard-focused data point with setAttribute, so a screen reader would read
		// `&amp;`. Put each element's own series name back as text whenever it writes one (#111).
		const fixLabels = () => {
			for (const node of el.querySelectorAll('[aria-label]')) {
				const index = chartLabelSeries(node);
				if (index === null) continue;
				const label = node.getAttribute('aria-label') ?? '';
				const fixed = chartLabelText(label, texts[index]);
				if (fixed !== label) node.setAttribute('aria-label', fixed);
			}
		};
		const observer = new MutationObserver(fixLabels);
		observer.observe(el, { subtree: true, childList: true, attributes: true, attributeFilter: ['aria-label'] });

		const chart = new ac(el, opts);
		chart.render();
		return () => {
			observer.disconnect();
			chart.destroy();
		};
	});

	// ── Helper ───────────────────────────────────────────────────────
	function profileZeroLabel(profile) {
		return `${profile.zeroDist}\u202f${profile.zeroUnit === 'm' ? m.unit_m() : m.unit_yd()}`;
	}
</script>

<svelte:head>
	<title>{m.compare_title()} — {m.app_name()}</title>
</svelte:head>

<div class="space-y-6">

	{#if profiles.list.length === 0}
		<div class="py-12 text-center space-y-3">
			<p class="text-surface-600-400">{m.compare_no_profiles()}</p>
			<a href="/profiles" class="btn preset-tonal-primary">{m.nav_profiles()}</a>
		</div>
	{:else}

		<!-- ═══ Selected entries ════════════════════════════════════ -->
		<div class="space-y-2 max-w-2xl">
			<div class="flex items-center gap-2">
				<span class="text-sm font-medium flex-1">{m.compare_selected()}</span>
				{#if resolvedEntries.length > 0}
					<span class="chip text-xs preset-filled-primary-500">{resolvedEntries.length}</span>
				{/if}
				<a
					href={localizeHref('/calculators/compare-trajectories/add')}
					class="btn btn-icon preset-filled-primary-500 shrink-0"
					title={m.compare_add_profile()}
				>
					<Plus class="size-5" />
				</a>
			</div>

			{#if resolvedEntries.length > 0}
				<div class="grid gap-2">
					{#each resolvedEntries as entry, i}
						<div class="card preset-tonal-primary p-2 sm:p-3 overflow-hidden">
							<!-- Header: color dot + name + remove -->
							<div class="flex items-center gap-2">
								<span
									class="size-3 rounded-full shrink-0"
									style="background-color: {entryColor(i)}"
								></span>
								<div class="flex-1 min-w-0">
									<p class="text-sm font-semibold truncate">{entry.shown.name}</p>
									<p class="text-xs opacity-70 truncate">{entry.shown.ammo}</p>
								</div>
								<button
									type="button"
									class="btn btn-icon btn-sm preset-tonal-error shrink-0"
									title={m.compare_remove()}
									onclick={() => compareTrajectories.removeEntry(entry.id)}
								>
									<X class="size-4" />
								</button>
							</div>

							<!-- Zero distance override -->
							<div class="mt-1.5 input !flex !items-center gap-1.5">
								<input
									class="flex-1 min-w-0 bg-transparent border-none outline-none shadow-none p-0 text-right"
									type="text"
									inputmode="decimal"
									placeholder={String(entry.shown.zeroDist)}
									value={entry.zeroDist}
									aria-invalid={!isUsableZeroDistance(entry.zeroDist)}
									aria-describedby={isUsableZeroDistance(entry.zeroDist) ? undefined : `zero-error-${i}`}
									oninput={(e) => compareTrajectories.updateEntry(entry.id, { zeroDist: e.target.value })}
								/>
								<div class="flex items-center gap-1 shrink-0">
									{#each [{ value: 'yd', label: m.unit_yd() }, { value: 'm', label: m.unit_m() }] as opt}
										<button
											type="button"
											class="chip text-xs {entry.zeroUnit === opt.value
												? 'preset-filled-primary-500'
												: 'preset-tonal-surface'}"
											onclick={() => compareTrajectories.updateEntry(entry.id, { zeroUnit: opt.value })}
										>{opt.label}</button>
									{/each}
								</div>
							</div>
							{#if !isUsableZeroDistance(entry.zeroDist)}
								<p id={`zero-error-${i}`} class="mt-1 text-xs text-error-500">
									{m.compare_zero_invalid({ min: formatLimit(MIN_ZERO_DISTANCE), max: formatLimit(MAX_ZERO_DISTANCE) })}
								</p>
							{:else if rangeUsable && !entryResults[i]}
								<!-- A usable zero can still give no trajectory, e.g. a short zero on a slow load (#114). -->
								<p class="mt-1 text-xs text-warning-800-200">{m.compare_zero_no_result()}</p>
							{/if}
						</div>
					{/each}
				</div>
			{:else}
				<p class="text-sm text-surface-600-400 text-center py-4">{m.compare_no_entries()}</p>
			{/if}
		</div>

		<!-- ═══ Chart controls ═══════════════════════════════════════ -->
		<div class="grid grid-cols-1 sm:grid-cols-2 gap-4">
			<!-- Max distance -->
			<div class="card preset-filled-surface-100-900 p-4 space-y-1.5">
				<span class="text-sm font-medium">{m.compare_max_dist()}</span>
				<div class="input !flex !items-center gap-2">
					<input
						class="flex-1 min-w-0 bg-transparent border-none outline-none shadow-none p-0"
						type="text"
						inputmode="decimal"
						placeholder="500"
						value={compareTrajectories.range.distance}
						aria-invalid={!rangeUsable}
						oninput={(e) => compareTrajectories.setRange({ distance: e.target.value })}
					/>
					<div class="flex items-center gap-1 shrink-0">
						{#each [{ value: 'yd', label: m.unit_yd() }, { value: 'm', label: m.unit_m() }] as opt}
							<button
								type="button"
								class="chip text-xs {compareTrajectories.range.unit === opt.value
									? 'preset-filled-primary-500'
									: 'preset-tonal-surface'}"
								onclick={() => compareTrajectories.setRange({ unit: opt.value })}
							>{opt.label}</button>
						{/each}
					</div>
				</div>
				{#if !rangeUsable}
					<p class="text-xs text-error-500">{m.validation_range_above_zero({ max: formatLimit(MAX_DISTANCE), unit: distLabel })}</p>
				{/if}
			</div>

			<!-- Y axis unit -->
			<div class="card preset-filled-surface-100-900 p-4 space-y-1.5">
				<span class="text-sm font-medium">{m.compare_y_axis()}</span>
				<div class="flex flex-wrap gap-1">
					{#each Y_AXIS_OPTIONS as opt}
						<button
							type="button"
							class="chip text-xs {compareTrajectories.yAxis === opt.value
								? 'preset-filled-primary-500'
								: 'preset-tonal-surface'}"
							onclick={() => compareTrajectories.setYAxis(opt.value)}
						>{opt.label()}</button>
					{/each}
				</div>
			</div>
		</div>

		<!-- ═══ Chart ════════════════════════════════════════════════ -->
		{#if chartData}
			<div class="space-y-2">
				<h2 class="font-semibold">{m.compare_chart_title()}</h2>
				<div bind:this={chartEl}></div>
			</div>
		{/if}

	{/if}
</div>
