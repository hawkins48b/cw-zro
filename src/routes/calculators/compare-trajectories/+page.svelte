<script>
	import { onMount } from 'svelte';
	import { m } from '#lib/paraglide/messages.js';
	import { localizeHref } from '#lib/paraglide/runtime.js';
	import { profiles } from '#lib/stores/profiles.svelte.js';
	import { settings } from '#lib/stores/settings.svelte.js';
	import { compareTrajectories } from '#lib/stores/compareTrajectories.svelte.js';
	import { calculateFullTrajectory } from '#lib/utils/ballisticCalculator.js';
	import { compareSeriesText } from '#lib/utils/compareEntries.js';
	import { shownProfile } from '#lib/utils/storedProfiles.js';
	import { isUsableZeroDistance, MIN_ZERO_DISTANCE, MAX_ZERO_DISTANCE } from '#lib/utils/zeroDistance.js';
	import { readDecimal } from '#lib/utils/decimal.js';
	import { formatLimit } from '#lib/utils/format.js';
	import { isUsableRange, MAX_DISTANCE } from '#lib/utils/inputLimits.js';
	import { Unit } from 'js-ballistics';
	import { Plus, X } from '@lucide/svelte';
	import ChipGroup from '#lib/components/ChipGroup.svelte';
	import CompareAddPicker from '#lib/components/compare/CompareAddPicker.svelte';

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
				// As typed: ApexCharts 8 writes series names as text (#75)
				seriesName: compareSeriesText(shown.name, entry.zeroDist, zeroUnitLabel)
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
				y: Math.round(p.slantHeight.In(yUnit) * 100) / 100
			}));
			// An entry without a result has no series, so the color comes from the entry's position:
			// a line must keep the color of the dot on its card.
			// endLabel: the rifle name drawn at the end of the line (#166), as text (see buildChartOptions).
			series.push({ name: entry.seriesName, data, color: entryColor(i), endLabel: entry.shown.name });
		}

		return series.length > 0 ? series : null;
	});

	// ── Chart rendering ──────────────────────────────────────────────
	// #166: four colours that keep 3:1 contrast on the card in each theme (owner's list); a fifth
	// line starts the list again. The chart, the legend and the dot on each entry use the same one.
	const CHART_COLORS = {
		light: ['#4f46e5', '#c2410c', '#0e7490', '#be185d'],
		dark: ['#a5b4fc', '#fb923c', '#22d3ee', '#f472b6']
	};

	function entryColor(index) {
		const list = settings.darkMode ? CHART_COLORS.dark : CHART_COLORS.light;
		return list[index % list.length];
	}

	/**
	 * @param {{ name: string, data: object[], color: string }[]} series - names as typed (#75)
	 * @param {boolean} dark
	 */
	function buildChartOptions(series, dark) {
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
				// The svg aria-label, in the app's language and written as text (#111)
				accessibility: {
					description: m.compare_chart_description({ names: series.map((s) => s.name).join(', ') })
				}
			},
			stroke: { width: 2, curve: 'monotoneCubic' },
			theme: { mode: dark ? 'dark' : 'light' },
			grid: {
				borderColor: dark ? '#374151' : '#e5e7eb',
				strokeDashArray: 3,
				padding: { left: 10, right: 20, top: 8, bottom: 0 }
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
				// Each line's name at its end (#166): drawn by ApexCharts as SVG text, never as HTML
				// (src/test/apexcharts.test.js "compare end labels").
				points: series
					.filter((s) => s.data.length > 0)
					.map((s) => ({
						x: s.data.at(-1).x,
						y: s.data.at(-1).y,
						marker: { size: 3, fillColor: s.color, strokeColor: s.color, strokeWidth: 0 },
						label: {
							text: s.endLabel,
							textAnchor: 'end',
							offsetX: -4,
							offsetY: -4,
							borderWidth: 0,
							style: { color: s.color, background: 'transparent', fontSize: '11px', fontWeight: 600 }
						}
					})),
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
			// Series names are profile names typed by the user. ApexCharts 8 writes them as text only
			// while no legend.formatter, legend.tooltipHoverFormatter or tooltip.y.title.formatter changes
			// them: such a formatter's output is written as HTML, so it must escape it (#103, #75).
			// src/test/apexcharts.test.js fails if one is added here.
			tooltip: {
				theme: dark ? 'dark' : 'light',
				x: { formatter: (v) => `${v} ${dLabel}` },
				y: { formatter: (v) => `${v} ${yLabel}` }
			},
			// The legend is the page's own list under the title (#166), with each line's zero.
			legend: { show: false },
			markers: { size: 0 }
		};
	}

	$effect(() => {
		const ac = ApexCharts;
		const el = chartEl;
		const data = chartData;
		if (!ac || !el || !data) return;

		const opts = buildChartOptions(data, settings.darkMode);
		const chart = new ac(el, opts);
		chart.render();
		return () => chart.destroy();
	});

	// ── Legend (#166): colour, name and the zero of each line on the chart ──
	let legend = $derived(
		resolvedEntries
			.map((entry, i) => ({ entry, i }))
			.filter(({ i }) => !!entryResults[i])
			.map(({ entry, i }) => ({
				id: entry.id,
				color: entryColor(i),
				text: m.compare_legend_entry({
					name: entry.shown.name || m.scope_view_profile_unnamed(),
					zero: `${String(entry.zeroDist).trim()}\u202f${entry.zeroUnit === 'm' ? m.unit_m() : m.unit_yd()}`
				})
			}))
	);

	// ── Add profile (#166) ───────────────────────────────────────────
	// Desktop: an inline panel, open at first when the chart is empty. Below lg: the /add page.
	let addOpen = $state(compareTrajectories.entries.length === 0);
	const addHref = localizeHref('/calculators/compare-trajectories/add');

	const uid = $props.id();
	const focusRing = 'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary-500';
	const unitOptions = () => [
		{ value: 'yd', label: m.unit_yd() },
		{ value: 'm', label: m.unit_m() }
	];
</script>

<svelte:head>
	<title>{m.compare_title()} — {m.app_name()}</title>
</svelte:head>

{#snippet addButton(cls)}
	<!-- Below lg: the Add page; lg and up: the inline panel -->
	<a
		href={addHref}
		class="lg:hidden btn h-11 px-3.5 gap-1.5 preset-filled-primary-500 text-sm font-semibold {focusRing} {cls}"
	>
		<Plus class="size-[18px]" strokeWidth={2.5} aria-hidden="true" />
		{m.compare_add_profile()}
	</a>
	<button
		type="button"
		class="hidden lg:inline-flex btn h-11 px-4 gap-1.5 preset-filled-primary-500 text-sm font-semibold {focusRing} {cls}"
		aria-expanded={addOpen}
		aria-controls="{uid}-add"
		onclick={() => (addOpen = !addOpen)}
	>
		<Plus class="size-[18px]" strokeWidth={2.5} aria-hidden="true" />
		{m.compare_add_profile()}
	</button>
{/snippet}

<div class="flex flex-col gap-3 sm:gap-4 lg:gap-5">
	{#if profiles.list.length === 0}
		<div class="py-12 text-center space-y-3">
			<p class="text-surface-600-400">{m.compare_no_profiles()}</p>
			<a href={localizeHref('/profiles')} class="btn preset-tonal-primary {focusRing}">{m.nav_profiles()}</a>
		</div>
	{:else}
		<!-- Header: title on desktop (the app header shows it below lg), intro and Add from sm -->
		<header class="flex flex-wrap items-center gap-x-4 gap-y-3 max-sm:sr-only">
			<div class="flex-[1_1_320px] min-w-0">
				<h1 class="sr-only lg:not-sr-only lg:text-[28px] lg:font-bold lg:tracking-tight">{m.compare_title()}</h1>
				<p class="lg:mt-1 text-sm text-surface-600-400">{m.compare_intro()}</p>
			</div>
			<div class="max-sm:hidden">{@render addButton('')}</div>
		</header>

		<!--
			Phone: entries, chart, chart settings. sm and up: entries and settings on the left, the
			chart on the right when there is room, else under them (flex-wrap, as on the boards).
		-->
		<div class="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-start sm:gap-5">
			<div class="max-sm:contents sm:flex-[1_1_340px] sm:max-w-full lg:max-w-[420px] flex flex-col gap-3.5 min-w-0">
				<!-- Desktop: Add a profile, inline -->
				{#if addOpen}
					<section
						id="{uid}-add"
						aria-labelledby="{uid}-add-title"
						class="hidden lg:flex flex-col gap-2.5 card preset-filled-surface-100-900 border border-surface-300-700 p-4"
					>
						<div class="flex items-center gap-2">
							<h2 id="{uid}-add-title" class="flex-1 text-[15px] font-semibold">{m.compare_pick_profile()}</h2>
							<button
								type="button"
								class="btn-icon size-9 rounded-base text-surface-600-400 hover:preset-tonal-surface {focusRing}"
								aria-label={m.common_close()}
								title={m.common_close()}
								onclick={() => (addOpen = false)}
							>
								<X class="size-[18px]" aria-hidden="true" />
							</button>
						</div>
						<CompareAddPicker listClass="max-h-72 overflow-y-auto" onadded={() => (addOpen = false)} />
					</section>
				{/if}

				<!-- On the chart -->
				<section aria-labelledby="{uid}-entries-title" class="order-1 flex flex-col gap-2 min-w-0">
					<div class="flex items-center gap-2 px-1 sm:px-0">
						<h2 id="{uid}-entries-title" class="flex-1 text-xs font-bold tracking-wider uppercase text-surface-600-400">
							{m.compare_on_the_chart()}
						</h2>
						{#if resolvedEntries.length > 0}
							<span class="min-w-[22px] h-[22px] px-1.5 rounded-full preset-tonal-surface text-xs font-bold flex items-center justify-center tabular-nums">
								{resolvedEntries.length}
							</span>
						{/if}
						<div class="sm:hidden">{@render addButton('')}</div>
					</div>

					{#if resolvedEntries.length > 0}
						<ul class="card preset-filled-surface-100-900 border border-surface-200-800 divide-y divide-surface-200-800 overflow-hidden">
							{#each resolvedEntries as entry, i (entry.id)}
								{@const zeroOk = isUsableZeroDistance(entry.zeroDist)}
								{@const name = entry.shown.name || m.scope_view_profile_unnamed()}
								<li class="px-3.5 py-2.5 flex flex-col gap-1.5">
									<div class="flex items-center gap-2.5">
										<span class="size-3 rounded-full shrink-0" style="background-color: {entryColor(i)}" aria-hidden="true"></span>
										<span class="flex-1 min-w-0">
											<span class="block text-[15px] font-semibold truncate">{name}</span>
											{#if entry.shown.ammo}
												<span class="block text-xs text-surface-600-400 truncate">{entry.shown.ammo}</span>
											{/if}
										</span>
										<button
											type="button"
											class="btn-icon size-11 -mr-2 shrink-0 rounded-base text-surface-600-400 hover:preset-tonal-surface {focusRing}"
											title={m.compare_remove()}
											aria-label={m.compare_remove_named({ name })}
											onclick={() => compareTrajectories.removeEntry(entry.id)}
										>
											<X class="size-[18px]" aria-hidden="true" />
										</button>
									</div>
									<div class="flex items-center gap-2.5 pl-[22px]">
										<label for="{uid}-zero-{entry.id}" class="flex-1 text-xs text-surface-600-400">{m.compare_zero_override()}</label>
										<div class="input !flex !items-center gap-1 h-10 w-[150px] shrink-0">
											<input
												id="{uid}-zero-{entry.id}"
												class="flex-1 w-10 min-w-0 bg-transparent border-none outline-none shadow-none p-0 font-semibold"
												type="text"
												inputmode="decimal"
												autocomplete="off"
												placeholder={String(entry.shown.zeroDist)}
												value={entry.zeroDist}
												aria-invalid={!zeroOk}
												aria-describedby={zeroOk ? undefined : `${uid}-zero-msg-${entry.id}`}
												oninput={(e) => compareTrajectories.updateEntry(entry.id, { zeroDist: e.target.value })}
											/>
											<ChipGroup
												label={m.compare_zero_unit_named({ name })}
												options={unitOptions()}
												value={entry.zeroUnit}
												onselect={(unit) => compareTrajectories.updateEntry(entry.id, { zeroUnit: unit })}
											/>
										</div>
									</div>
									{#if !zeroOk}
										<p id="{uid}-zero-msg-{entry.id}" class="pl-[22px] text-xs text-error-500" role="alert">
											{m.compare_zero_invalid({ min: formatLimit(MIN_ZERO_DISTANCE), max: formatLimit(MAX_ZERO_DISTANCE) })}
										</p>
									{:else if rangeUsable && !entryResults[i]}
										<!-- A usable zero can still give no trajectory, e.g. a short zero on a slow load (#114). -->
										<p class="pl-[22px] text-xs text-warning-800-200">{m.compare_zero_no_result()}</p>
									{/if}
								</li>
							{/each}
						</ul>
						<p class="px-1 sm:px-0 text-xs leading-snug text-surface-600-400">{m.compare_zero_note()}</p>
					{:else}
						<div class="card preset-filled-surface-100-900 border border-surface-200-800 px-4 py-6 text-center">
							<p class="text-sm text-surface-600-400">{m.compare_no_entries()}</p>
						</div>
					{/if}
				</section>

				<!-- Chart settings -->
				<section
					aria-labelledby="{uid}-settings-title"
					class="order-3 card preset-filled-surface-100-900 border border-surface-200-800 px-3.5 py-3 flex flex-col gap-3 min-w-0"
				>
					<h2 id="{uid}-settings-title" class="text-xs font-bold tracking-wider uppercase text-surface-600-400">{m.compare_chart_settings()}</h2>
					<div class="flex flex-wrap gap-x-4 gap-y-3">
						<div class="flex-[1_1_160px] min-w-0 space-y-1">
							<label for="{uid}-max" class="block text-xs text-surface-600-400">{m.compare_max_dist()}</label>
							<div class="input !flex !items-center gap-1 h-11">
								<input
									id="{uid}-max"
									class="flex-1 w-10 min-w-0 bg-transparent border-none outline-none shadow-none p-0 font-semibold"
									type="text"
									inputmode="decimal"
									autocomplete="off"
									placeholder="500"
									value={compareTrajectories.range.distance}
									aria-invalid={!rangeUsable}
									aria-describedby={rangeUsable ? undefined : `${uid}-max-msg`}
									oninput={(e) => compareTrajectories.setRange({ distance: e.target.value })}
								/>
								<ChipGroup
									label={m.scope_view_distance_unit()}
									options={unitOptions()}
									value={compareTrajectories.range.unit}
									onselect={(unit) => compareTrajectories.setRange({ unit })}
								/>
							</div>
							{#if !rangeUsable}
								<p id="{uid}-max-msg" class="text-xs text-error-500" role="alert">
									{m.validation_range_above_zero({ max: formatLimit(MAX_DISTANCE), unit: distLabel })}
								</p>
							{/if}
						</div>
						<div class="flex-[1_1_200px] min-w-0 space-y-1">
							<span class="block text-xs text-surface-600-400" aria-hidden="true">{m.compare_height_in()}</span>
							<ChipGroup
								variant="segmented"
								label={m.compare_y_axis()}
								options={Y_AXIS_OPTIONS.map((o) => ({ value: o.value, label: o.label() }))}
								value={compareTrajectories.yAxis}
								onselect={(unit) => compareTrajectories.setYAxis(unit)}
							/>
						</div>
					</div>
				</section>
			</div>

			<!-- Chart -->
			<section
				aria-labelledby="{uid}-chart-title"
				class="order-2 sm:flex-[999_1_440px] lg:flex-[999_1_560px] min-w-0 card preset-filled-surface-100-900 border border-surface-200-800 p-4 flex flex-col gap-2.5"
			>
				<div class="flex flex-wrap items-center gap-x-4 gap-y-1.5">
					<h2 id="{uid}-chart-title" class="flex-[1_1_auto] text-[15px] font-semibold">{m.compare_chart_title()}</h2>
					{#if chartData}
						<ul class="flex flex-wrap gap-x-3.5 gap-y-1" aria-label={m.compare_legend()}>
							{#each legend as item (item.id)}
								<li class="flex items-center gap-1.5 text-xs text-surface-600-400">
									<span class="inline-block w-4 h-[3px] rounded-full shrink-0" style="background-color: {item.color}" aria-hidden="true"></span>
									{item.text}
								</li>
							{/each}
						</ul>
					{/if}
				</div>
				{#if chartData}
					<div bind:this={chartEl}></div>
				{:else}
					<div class="py-10 flex flex-col items-center gap-3 text-center">
						<p class="text-sm text-surface-600-400">
							{resolvedEntries.length === 0 ? m.compare_no_entries() : m.ballistic_no_result()}
						</p>
						{#if resolvedEntries.length === 0}
							{@render addButton('')}
						{/if}
					</div>
				{/if}
			</section>
		</div>
	{/if}
</div>
