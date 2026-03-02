<script>
	import { onMount } from 'svelte';
	import { m } from '$lib/paraglide/messages.js';
	import { activeProfile } from '$lib/stores/activeProfile.svelte.js';
	import { ballistic } from '$lib/stores/ballistic.svelte.js';
	import { settings } from '$lib/stores/settings.svelte.js';
	import { calculateFullTrajectory } from '$lib/utils/ballisticCalculator.js';
	import WindInput from '$lib/components/WindInput.svelte';
	import AtmosphereCard from '$lib/components/AtmosphereCard.svelte';
	import {
		ChevronDown,
		ChevronRight,
		Download,
		Columns3,
		MapPin,
		Waves
	} from '@lucide/svelte';
	import { Unit } from 'js-ballistics';

	// ── ApexCharts (lazy-loaded, browser-only) ──────────────────────
	let ApexCharts = $state(null);
	let elevChartEl = $state(null);
	let velChartEl = $state(null);

	onMount(async () => {
		const mod = await import('apexcharts');
		ApexCharts = mod.default;
	});

	// ── Trajectory computation ───────────────────────────────────────
	let trajectoryResult = $derived.by(() => {
		const profile = activeProfile.profile;
		if (!profile) return null;
		const atmo = ballistic.atmosphere.useISA ? null : ballistic.atmosphere;
		return calculateFullTrajectory(profile, ballistic.range, atmo, ballistic.wind);
	});

	let tablePoints = $derived(trajectoryResult?.trajectory ?? []);
	let chartPoints = $derived(trajectoryResult?.chartPoints ?? []);
	let nearZero = $derived(trajectoryResult?.nearZero ?? null);
	let farZero = $derived(trajectoryResult?.farZero ?? null);
	let maxApex = $derived(trajectoryResult?.maxApex ?? null);
	let maxDrop = $derived(trajectoryResult?.maxDrop ?? null);
	let soundSpeedFPS = $derived(trajectoryResult?.soundSpeedFPS ?? null);
	let subsonicDist = $derived(trajectoryResult?.subsonicDist ?? null);

	const isMetric = $derived(ballistic.range.unit === 'm');
	const distLabel = $derived(isMetric ? m.unit_m() : m.unit_yd());
	const elevLabel = $derived(isMetric ? m.unit_cm() : m.unit_in());
	const velLabel = $derived(isMetric ? m.unit_mps() : m.unit_fps());

	// ── Chart builders ───────────────────────────────────────────────
	function resolveCSSColor(varName, fallback) {
		const el = document.createElement('span');
		el.style.cssText = `display:none;color:var(${varName})`;
		document.body.appendChild(el);
		const color = getComputedStyle(el).color;
		document.body.removeChild(el);
		return color || fallback;
	}

	function buildElevChartOptions(points, dark, metric, annotations, nr, fr, apex, maxDrop, step) {
		const distUnit = metric ? Unit.Meter : Unit.Yard;
		const dropUnit = metric ? Unit.Centimeter : Unit.Inch;
		const dLabel = metric ? m.unit_m() : m.unit_yd();
		const dAxisLabel = metric ? m.unit_meters() : m.unit_yards();
		const eLabel = metric ? m.unit_cm() : m.unit_in();

		const cSuccess = resolveCSSColor('--color-success-500', '#22c55e');
		const cPrimary = resolveCSSColor('--color-primary-500', '#6366f1');
		const cWarning = resolveCSSColor('--color-warning-500', '#f59e0b');
		const cError   = resolveCSSColor('--color-error-500', '#ef4444');

		const data = points.map((p) => ({
			x: Math.round(p.distance.In(distUnit) * 10) / 10,
			y: Math.round(p.targetDrop.In(dropUnit) * 10) / 10
		}));

		const maxX = data.length > 0 ? data[data.length - 1].x : 0;
		const tickAmount = step > 0 && maxX > 0 ? Math.round(maxX / step) : undefined;

		const annotationPoints = [];

		// Key points — toggled by the annotations button
		if (annotations) {
			if (nr !== null)
				annotationPoints.push({
					x: nr,
					y: 0,
					marker: { size: 5, fillColor: cSuccess, strokeColor: '#fff', radius: 2 },
					label: {
						text: m.ballistic_near_zero(),
						borderColor: cSuccess,
						style: { color: '#fff', background: cSuccess, fontSize: '11px' },
						offsetY: -10
					}
				});
			if (fr !== null)
				annotationPoints.push({
					x: fr,
					y: 0,
					marker: { size: 5, fillColor: cPrimary, strokeColor: '#fff', radius: 2 },
					label: {
						text: m.ballistic_far_zero(),
						borderColor: cPrimary,
						style: { color: '#fff', background: cPrimary, fontSize: '11px' },
						offsetY: -10
					}
				});
			if (apex !== null)
				annotationPoints.push({
					x: apex.distance,
					y: apex.elevation,
					marker: { size: 5, fillColor: cWarning, strokeColor: '#fff', radius: 2 },
					label: {
						text: m.ballistic_max_ord(),
						borderColor: cWarning,
						style: { color: '#fff', background: cWarning, fontSize: '11px' },
						offsetY: -10
					}
				});
			if (maxDrop !== null)
				annotationPoints.push({
					x: maxDrop.distance,
					y: maxDrop.drop,
					marker: { size: 5, fillColor: cError, strokeColor: '#fff', radius: 2 },
					label: {
						text: m.ballistic_max_drop(),
						borderColor: cError,
						style: { color: '#fff', background: cError, fontSize: '11px' },
						offsetY: 10
					}
				});
		}

		return {
			series: [{ name: m.ballistic_elev_chart(), data }],
			chart: {
				type: 'line',
				height: 280,
				background: 'transparent',
				toolbar: { show: false },
				animations: { enabled: false },
				zoom: { enabled: false },
				parentHeightOffset: 0
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
				tickAmount,
				title: { text: dAxisLabel, style: { fontSize: '12px' } },
				labels: { formatter: (v) => `${Math.round(v)}` }
			},
			yaxis: {
				title: { text: eLabel, style: { fontSize: '12px' } },
				labels: { formatter: (v) => `${v}` }
			},
			colors: [resolveCSSColor('--color-primary-500', '#6366f1')],
			annotations: {
				yaxis: annotations
					? [
						{
							y: 0,
							borderColor: dark ? '#9ca3af' : '#6b7280',
							strokeDashArray: 4,
							borderWidth: 1,
							label: {
								text: m.ballistic_legend_los(),
								position: 'center',
								style: { fontSize: '10px', color: dark ? '#9ca3af' : '#6b7280', background: 'transparent', border: 'none' }
							}
						}
					]
					: [],
				points: annotationPoints
			},
			tooltip: {
				theme: dark ? 'dark' : 'light',
				x: { formatter: (v) => `${v} ${dLabel}` },
				y: { formatter: (v) => `${v} ${eLabel}` }
			},
			markers: { size: 0 }
		};
	}

	function buildVelChartOptions(points, dark, isMetricDist, velUnit, soundFPS, step) {
		const distUnit = isMetricDist ? Unit.Meter : Unit.Yard;
		const velUnitEnum = velUnit === 'mps' ? Unit.MPS : Unit.FPS;
		const dLabel = isMetricDist ? m.unit_m() : m.unit_yd();
		const dAxisLabel = isMetricDist ? m.unit_meters() : m.unit_yards();
		const vLabel = velUnit === 'mps' ? m.unit_mps() : m.unit_fps();

		const velData = points.map((p) => ({
			x: Math.round(p.distance.In(distUnit) * 10) / 10,
			y: Math.round(p.velocity.In(velUnitEnum))
		}));

		const maxX = velData.length > 0 ? velData[velData.length - 1].x : 0;
		const tickAmount = step > 0 && maxX > 0 ? Math.round(maxX / step) : undefined;

		const series = [{ name: m.ballistic_vel_chart(), data: velData }];

		if (soundFPS !== null && velData.length > 0) {
			const sos = Math.round(velUnit === 'mps' ? soundFPS / 3.28084 : soundFPS);
			const lastX = velData.at(-1).x;
			series.push({
				name: m.ballistic_speed_of_sound(),
				data: [
					{ x: 0, y: sos },
					{ x: lastX, y: sos }
				]
			});
		}

		return {
			series,
			chart: {
				type: 'line',
				height: 220,
				background: 'transparent',
				toolbar: { show: false },
				animations: { enabled: false },
				zoom: { enabled: false },
				parentHeightOffset: 0
			},
			stroke: { width: [2, 1], curve: ['monotoneCubic', 'straight'], dashArray: [0, 4] },
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
				tickAmount,
				title: { text: dAxisLabel, style: { fontSize: '12px' } },
				labels: { formatter: (v) => `${Math.round(v)}` }
			},
			yaxis: {
				title: { text: vLabel, style: { fontSize: '12px' } },
				labels: { formatter: (v) => `${v}` }
			},
			colors: ['#22d3ee', '#94a3b8'],
			tooltip: {
				theme: dark ? 'dark' : 'light',
				x: { formatter: (v) => `${v} ${dLabel}` },
				y: { formatter: (v) => `${v} ${vLabel}` }
			},
			legend: { show: true, position: 'top', horizontalAlign: 'right' },
			markers: { size: 0 }
		};
	}

	// ── Chart effects ────────────────────────────────────────────────
	$effect(() => {
		const ac = ApexCharts;
		const el = elevChartEl;
		if (!ac || !el) return;

		const opts = buildElevChartOptions(
			chartPoints,
			settings.darkMode,
			isMetric,
			ballistic.options.showAnnotations,
			nearZero,
			farZero,
			maxApex,
			maxDrop,
			parseFloat(ballistic.range.step) || 25
		);
		const chart = new ac(el, opts);
		chart.render();
		return () => chart.destroy();
	});

	$effect(() => {
		const ac = ApexCharts;
		const el = velChartEl;
		if (!ac || !el || !ballistic.options.showVelocityChart) return;

		const velUnit = ballistic.options.velChartUnit ?? 'fps';
		const opts = buildVelChartOptions(chartPoints, settings.darkMode, isMetric, velUnit, soundSpeedFPS, parseFloat(ballistic.range.step) || 25);
		const chart = new ac(el, opts);
		chart.render();
		return () => chart.destroy();
	});

	// ── Table columns ────────────────────────────────────────────────
	const COLUMN_GROUPS = [
		{
			id: 'distance',
			label: () => m.ballistic_group_distance(),
			columns: [
				{ id: 'rangeYd', label: () => m.ballistic_col_range_yd() },
				{ id: 'rangeM', label: () => m.ballistic_col_range_m() }
			]
		},
		{
			id: 'elevation',
			label: () => m.ballistic_group_elevation(),
			columns: [
				{ id: 'elevIn', label: () => m.ballistic_col_elev_in() },
				{ id: 'elevCm', label: () => m.ballistic_col_elev_cm() },
				{ id: 'elevMOA', label: () => m.ballistic_col_elev_moa() },
				{ id: 'elevMRAD', label: () => m.ballistic_col_elev_mrad() }
			]
		},
		{
			id: 'wind',
			label: () => m.ballistic_group_wind(),
			columns: [
				{ id: 'windIn', label: () => m.ballistic_col_wind_in() },
				{ id: 'windCm', label: () => m.ballistic_col_wind_cm() },
				{ id: 'windMOA', label: () => m.ballistic_col_wind_moa() },
				{ id: 'windMRAD', label: () => m.ballistic_col_wind_mrad() }
			]
		},
		{
			id: 'velocity',
			label: () => m.ballistic_group_velocity(),
			columns: [
				{ id: 'velFps', label: () => m.ballistic_col_vel_fps() },
				{ id: 'velMps', label: () => m.ballistic_col_vel_mps() }
			]
		},
		{
			id: 'energy',
			label: () => m.ballistic_group_energy(),
			columns: [
				{ id: 'energyFtlb', label: () => m.ballistic_col_energy_ftlb() },
				{ id: 'energyJ', label: () => m.ballistic_col_energy_j() }
			]
		},
		{
			id: 'time',
			label: () => m.ballistic_group_time(),
			columns: [{ id: 'time', label: () => m.ballistic_col_time() }]
		}
	];
	const ALL_COLUMNS = COLUMN_GROUPS.flatMap((g) => g.columns);

	function getCellValue(point, colId) {
		const r1 = (v) => Math.round(v * 10) / 10;
		const r0 = (v) => Math.round(v);
		switch (colId) {
			case 'rangeYd':
				return r1(point.distance.In(Unit.Yard));
			case 'rangeM':
				return r1(point.distance.In(Unit.Meter));
			case 'elevIn':
				return r1(point.targetDrop.In(Unit.Inch));
			case 'elevCm':
				return r1(point.targetDrop.In(Unit.Centimeter));
			case 'elevMOA':
				return r1(point.dropAdjustment.In(Unit.MOA));
			case 'elevMRAD':
				return r1(point.dropAdjustment.In(Unit.MRad));
			case 'windIn':
				return r1(point.windage.In(Unit.Inch));
			case 'windCm':
				return r1(point.windage.In(Unit.Centimeter));
			case 'windMOA':
				return r1(point.windageAdjustment.In(Unit.MOA));
			case 'windMRAD':
				return r1(point.windageAdjustment.In(Unit.MRad));
			case 'velFps':
				return r0(point.velocity.In(Unit.FPS));
			case 'velMps':
				return r0(point.velocity.In(Unit.MPS));
			case 'energyFtlb':
				return r0(point.energy.In(Unit.FootPound));
			case 'energyJ':
				return r0(point.energy.In(Unit.Joule));
			case 'time':
				return Math.round(point.time * 100) / 100;
			default:
				return '';
		}
	}

	let visibleColumns = $derived(ballistic.options.visibleColumns ?? ['rangeYd', 'elevIn', 'elevMOA', 'velFps', 'energyFtlb', 'time']);
	let activeColumns = $derived(ALL_COLUMNS.filter((c) => visibleColumns.includes(c.id)));
	let showColumnSelector = $state(false);

	// ── CSV export ───────────────────────────────────────────────────
	function exportCSV() {
		if (tablePoints.length === 0) return;
		const header = activeColumns.map((c) => c.label()).join(',');
		const rows = tablePoints.map((p) => activeColumns.map((c) => getCellValue(p, c.id)).join(','));
		const csv = [header, ...rows].join('\n');
		const blob = new Blob([csv], { type: 'text/csv' });
		const url = URL.createObjectURL(blob);
		const a = document.createElement('a');
		a.href = url;
		a.download = 'trajectory.csv';
		a.click();
		URL.revokeObjectURL(url);
	}
</script>

<svelte:head>
	<title>{m.ballistic_title()} — {m.app_name()}</title>
</svelte:head>

{#if !activeProfile.profile}
	<!-- No profile -->
	<div class="py-12 text-center space-y-3">
		<p class="text-surface-500-400">{m.ballistic_no_profile()}</p>
		<a href="/profiles" class="btn preset-tonal-primary">{m.nav_profiles()}</a>
	</div>
{:else}
	<div class="space-y-6">

		<!-- ═══ Conditions inputs ════════════════════════════════════════ -->
		<div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">

			<!-- Range card -->
			<div class="card preset-filled-surface-100-900 p-4 space-y-4">
				<!-- Max distance -->
				<div class="space-y-1.5">
					<span class="text-sm font-medium">{m.ballistic_max_dist()}</span>
					<div class="input !flex !items-center gap-2">
						<input
							class="flex-1 min-w-0 bg-transparent border-none outline-none shadow-none p-0"
							type="text"
							inputmode="decimal"
							placeholder="500"
							value={ballistic.range.distance}
							oninput={(e) => ballistic.setRange({ distance: e.target.value })}
						/>
						<div class="flex items-center gap-1 shrink-0">
							{#each [{ value: 'yd', label: m.unit_yd() }, { value: 'm', label: m.unit_m() }] as opt}
								<button
									type="button"
									class="chip text-xs {ballistic.range.unit === opt.value
										? 'preset-filled-primary-500'
										: 'preset-tonal-surface'}"
									onclick={() => ballistic.setRange({ unit: opt.value })}
								>{opt.label}</button>
							{/each}
						</div>
					</div>
				</div>

				<!-- Step -->
				<div class="space-y-1.5">
					<span class="text-sm font-medium">{m.ballistic_step()}</span>
					<div class="input !flex !items-center gap-2">
						<input
							class="flex-1 min-w-0 bg-transparent border-none outline-none shadow-none p-0"
							type="text"
							inputmode="decimal"
							placeholder="25"
							value={ballistic.range.step}
							oninput={(e) => ballistic.setRange({ step: e.target.value })}
						/>
						<span class="text-sm text-surface-500-400 shrink-0">{distLabel}</span>
					</div>
					<p class="text-xs text-surface-500-400">{m.ballistic_step_hint()}</p>
				</div>
			</div>

			<!-- Atmosphere -->
			<AtmosphereCard
				atmosphere={ballistic.atmosphere}
				onchange={(patch) => ballistic.setAtmosphere(patch)}
			/>

			<!-- Wind (collapsible) -->
			<div class="card preset-filled-surface-100-900">
				<button
					type="button"
					class="flex items-center gap-2 w-full p-4 text-left"
					onclick={() => ballistic.setOptions({ showWind: !ballistic.options.showWind })}
				>
					{#if ballistic.options.showWind}
						<ChevronDown class="size-4 text-surface-500-400 shrink-0" />
					{:else}
						<ChevronRight class="size-4 text-surface-500-400 shrink-0" />
					{/if}
					<span class="text-sm font-medium">{m.ballistic_wind()}</span>
					{#if parseFloat(ballistic.wind.speed) > 0}
						<span class="ml-auto text-xs preset-tonal-primary chip">
							{ballistic.wind.speed} {ballistic.wind.speedUnit === 'mph' ? m.unit_mph() : m.unit_mps()}
						</span>
					{/if}
				</button>

				{#if ballistic.options.showWind}
					<div class="px-4 pb-4 border-t border-surface-200-800 pt-3">
						<WindInput
							speed={ballistic.wind.speed}
							speedUnit={ballistic.wind.speedUnit}
							direction={ballistic.wind.direction}
							onchange={(patch) => ballistic.setWind(patch)}
						/>
					</div>
				{/if}
			</div>
		</div>

		<!-- ═══ Elevation chart + trajectory summary ════════════════════ -->
		<div class="space-y-2">
			<div class="flex items-center justify-between">
				<h2 class="font-semibold">{m.ballistic_elev_chart()}</h2>
				<button
					type="button"
					class="chip text-xs {ballistic.options.showAnnotations ? 'preset-filled-primary-500' : 'preset-tonal-surface'}"
					title={m.ballistic_annotations()}
					onclick={() => ballistic.setOptions({ showAnnotations: !ballistic.options.showAnnotations })}
				>
					<MapPin class="size-3 mr-1" />{m.ballistic_annotations()}
				</button>
			</div>
			<div bind:this={elevChartEl}></div>

			<!-- Chart legend -->
			{#if ballistic.options.showAnnotations}
				<div class="flex flex-wrap gap-x-5 gap-y-1 px-2 text-xs text-surface-500-400">
					<span class="flex items-center gap-1.5">
						<span class="inline-block w-5 border-t-2 border-dashed border-surface-400-600"></span>
						{m.ballistic_legend_los()}
					</span>
				</div>
			{/if}

			<!-- Trajectory summary (inline below chart) -->
			{#if trajectoryResult}
				<div class="grid grid-cols-2 sm:grid-cols-4 gap-2 pt-1">
					<!-- Near Zero -->
					<div class="flex items-center gap-2 px-3 py-2 rounded-lg bg-surface-50-950">
						<div class="size-7 rounded-full preset-tonal-success flex items-center justify-center shrink-0">
							<MapPin class="size-3.5" />
						</div>
						<div class="min-w-0">
							<p class="text-xs text-surface-500-400 uppercase tracking-wide leading-none mb-0.5">{m.ballistic_near_zero()}</p>
							{#if nearZero !== null}
								<p class="text-sm font-semibold tabular-nums leading-none">
									{nearZero} <span class="text-xs font-normal text-surface-500-400">{distLabel}</span>
								</p>
							{:else}
								<p class="text-xs text-surface-500-400">{m.ballistic_unknown()}</p>
							{/if}
						</div>
					</div>

					<!-- Far Zero -->
					<div class="flex items-center gap-2 px-3 py-2 rounded-lg bg-surface-50-950">
						<div class="size-7 rounded-full preset-tonal-primary flex items-center justify-center shrink-0">
							<MapPin class="size-3.5" />
						</div>
						<div class="min-w-0">
							<p class="text-xs text-surface-500-400 uppercase tracking-wide leading-none mb-0.5">{m.ballistic_far_zero()}</p>
							{#if farZero !== null}
								<p class="text-sm font-semibold tabular-nums leading-none">
									{farZero} <span class="text-xs font-normal text-surface-500-400">{distLabel}</span>
								</p>
							{:else}
								<p class="text-xs text-surface-500-400">{m.ballistic_unknown()}</p>
							{/if}
						</div>
					</div>

					<!-- Max Ordinate (apex) -->
					<div class="flex items-center gap-2 px-3 py-2 rounded-lg bg-surface-50-950">
						<div class="size-7 rounded-full preset-tonal-warning flex items-center justify-center shrink-0">
							<MapPin class="size-3.5" />
						</div>
						<div class="min-w-0">
							<p class="text-xs text-surface-500-400 uppercase tracking-wide leading-none mb-0.5">{m.ballistic_max_ord()}</p>
							{#if maxApex !== null}
								<p class="text-sm font-semibold tabular-nums leading-none">
									{maxApex.elevation} <span class="text-xs font-normal text-surface-500-400">{elevLabel}</span>
								</p>
								<p class="text-xs text-surface-500-400 leading-none mt-0.5">{m.ballistic_at()} {maxApex.distance} {distLabel}</p>
							{:else}
								<p class="text-xs text-surface-500-400">{m.ballistic_unknown()}</p>
							{/if}
						</div>
					</div>

					<!-- Max Drop -->
					<div class="flex items-center gap-2 px-3 py-2 rounded-lg bg-surface-50-950">
						<div class="size-7 rounded-full preset-tonal-error flex items-center justify-center shrink-0">
							<MapPin class="size-3.5" />
						</div>
						<div class="min-w-0">
							<p class="text-xs text-surface-500-400 uppercase tracking-wide leading-none mb-0.5">{m.ballistic_max_drop()}</p>
							{#if maxDrop !== null}
								<p class="text-sm font-semibold tabular-nums leading-none">
									{maxDrop.drop} <span class="text-xs font-normal text-surface-500-400">{elevLabel}</span>
								</p>
								<p class="text-xs text-surface-500-400 leading-none mt-0.5">{m.ballistic_at()} {maxDrop.distance} {distLabel}</p>
							{:else}
								<p class="text-xs text-surface-500-400">{m.ballistic_unknown()}</p>
							{/if}
						</div>
					</div>

					</div>
			{/if}
		</div>

		<!-- ═══ Velocity chart (collapsible) ════════════════════════════ -->
		<div class="card preset-filled-surface-100-900">
			<div class="flex items-center gap-2 w-full p-4">
				<button
					type="button"
					class="flex items-center gap-2 flex-1 text-left min-w-0"
					onclick={() => ballistic.setOptions({ showVelocityChart: !ballistic.options.showVelocityChart })}
				>
					{#if ballistic.options.showVelocityChart}
						<ChevronDown class="size-4 text-surface-500-400 shrink-0" />
					{:else}
						<ChevronRight class="size-4 text-surface-500-400 shrink-0" />
					{/if}
					<span class="text-sm font-medium">{m.ballistic_vel_chart()}</span>
				</button>
				{#if ballistic.options.showVelocityChart}
					<div class="flex gap-1 shrink-0">
						{#each [{ value: 'fps', label: m.unit_fps() }, { value: 'mps', label: m.unit_mps() }] as opt}
							<button
								type="button"
								class="chip text-xs {(ballistic.options.velChartUnit ?? 'fps') === opt.value
									? 'preset-filled-primary-500'
									: 'preset-tonal-surface'}"
								onclick={() => ballistic.setOptions({ velChartUnit: opt.value })}
							>{opt.label}</button>
						{/each}
					</div>
				{/if}
			</div>

			{#if ballistic.options.showVelocityChart}
				<div class="px-4 pb-4 border-t border-surface-200-800 pt-3 space-y-2">
					<div bind:this={velChartEl}></div>
					<div class="flex flex-wrap justify-center gap-x-6 gap-y-1 text-xs text-surface-500-400">
						{#if soundSpeedFPS !== null}
							<span>
								{m.ballistic_speed_of_sound()}:
								{Math.round((ballistic.options.velChartUnit ?? 'fps') === 'mps' ? soundSpeedFPS / 3.28084 : soundSpeedFPS)}
								{(ballistic.options.velChartUnit ?? 'fps') === 'mps' ? m.unit_mps() : m.unit_fps()}
							</span>
						{/if}
						{#if subsonicDist !== null}
							<span class="flex items-center gap-1">
								<Waves class="size-3" />{m.ballistic_subsonic_dist()}: {subsonicDist} {distLabel}
							</span>
						{/if}
					</div>
				</div>
			{/if}
		</div>

		<!-- ═══ Data table (full width, no card) ════════════════════════ -->
		<div class="space-y-3">
			<div class="flex items-center gap-2 flex-wrap">
				<h2 class="font-semibold flex-1">{m.ballistic_table()}</h2>

				<!-- Column selector toggle -->
				<button
					type="button"
					class="btn btn-sm {showColumnSelector ? 'preset-filled-primary-500' : 'preset-tonal-surface'}"
					title={m.ballistic_columns()}
					onclick={() => (showColumnSelector = !showColumnSelector)}
				>
					<Columns3 class="size-4" />
				</button>

				<!-- Export CSV -->
				<button
					type="button"
					class="btn btn-sm preset-tonal-surface"
					title={m.ballistic_export_csv()}
					onclick={exportCSV}
					disabled={tablePoints.length === 0}
				>
					<Download class="size-4" />
				</button>
			</div>

			<!-- Column toggles -->
			{#if showColumnSelector}
				<div class="space-y-2">
					{#each COLUMN_GROUPS as group}
						<div class="space-y-1">
							<p class="text-xs font-medium text-surface-500-400 uppercase tracking-wide">{group.label()}</p>
							<div class="flex flex-wrap gap-1.5">
								{#each group.columns as col}
									<button
										type="button"
										class="chip text-xs {visibleColumns.includes(col.id) ? 'preset-filled-primary-500' : 'preset-tonal-surface'}"
										onclick={() => ballistic.toggleColumn(col.id)}
									>{col.label()}</button>
								{/each}
							</div>
						</div>
					{/each}
				</div>
			{/if}

			<!-- Table -->
			{#if tablePoints.length === 0}
				<p class="text-sm text-surface-500-400 py-4 text-center">{m.ballistic_no_result()}</p>
			{:else}
				<div class="overflow-x-auto">
					<table class="table text-sm">
						<thead>
							<tr>
								{#each activeColumns as col}
									<th class="text-xs whitespace-nowrap">{col.label()}</th>
								{/each}
							</tr>
						</thead>
						<tbody>
							{#each tablePoints as point}
								<tr>
									{#each activeColumns as col}
										<td class="tabular-nums whitespace-nowrap">{getCellValue(point, col.id)}</td>
									{/each}
								</tr>
							{/each}
						</tbody>
					</table>
				</div>
			{/if}
		</div>

	</div>
{/if}
