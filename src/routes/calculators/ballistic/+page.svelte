<script>
	import { onMount } from 'svelte';
	import { m } from '#lib/paraglide/messages.js';
	import { localizeHref } from '#lib/paraglide/runtime.js';
	import { activeProfile } from '#lib/stores/activeProfile.svelte.js';
	import { ballistic } from '#lib/stores/ballistic.svelte.js';
	import { settings } from '#lib/stores/settings.svelte.js';
	import { scopeView } from '#lib/stores/scopeView.svelte.js';
	import { ballisticPageTrajectory, isUsableBallisticRange, scopeDistanceRow } from '#lib/utils/ballisticPage.js';
	import { getElevationValue, getWindageValue, hasNoAirDensity } from '#lib/utils/ballisticCalculator.js';
	import { clickValue, signedClickCount } from '#lib/utils/clicks.js';
	import { formatLimit, formatNumber } from '#lib/utils/format.js';
	import {
		formatUsedAtmosphere,
		scopeAtmosphereParams,
		usedScopeAtmosphere
	} from '#lib/utils/scopeAtmosphere.js';
	import {
		chartTickAmount,
		MAX_DISTANCE,
		MIN_TABLE_STEP,
		maxTableStep,
		tableStep,
		tableStepLimit
	} from '#lib/utils/inputLimits.js';
	import { shownProfile } from '#lib/utils/storedProfiles.js';
	import ChipGroup from '#lib/components/ChipGroup.svelte';
	import ScopeWindCard from '#lib/components/ScopeWindCard.svelte';
	import ScopeAtmosphereCard from '#lib/components/ScopeAtmosphereCard.svelte';
	import { Download, Columns3, MapPin, Waves } from '@lucide/svelte';
	import { Unit } from 'js-ballistics';

	const uid = $props.id();
	const focusRing = 'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary-500';

	// ── ApexCharts (lazy-loaded, browser-only) ──────────────────────
	let ApexCharts = $state(null);
	let elevChartEl = $state(null);
	let velChartEl = $state(null);

	onMount(async () => {
		const mod = await import('apexcharts');
		ApexCharts = mod.default;
	});

	// ── Trajectory computation ───────────────────────────────────────
	// The range box shows the range message when the page does not calculate (#122).
	let rangeUsable = $derived(isUsableBallisticRange(ballistic.range.distance));
	// The step box shows the minimum under a step below it (#130), and the maximum, the range, over
	// a step above it (#133). The table keeps tableStep, which reads a step above the range as the range.
	let stepLimit = $derived(tableStepLimit(ballistic.range.step, ballistic.range.distance));
	let chartStep = $derived(tableStep(ballistic.range.step, ballistic.range.distance));
	// ── Atmosphere (#151, owner decision): ISA, Estimate or Accurate, as on the Scope View ──
	let atmosphere = $derived(ballistic.atmosphere);
	/** What the calculation is given: null is the standard atmosphere at sea level. */
	let atmoParams = $derived(scopeAtmosphereParams(atmosphere));
	/** What ISA and Estimate use, in the units of the boxes, for the line under the card. */
	let atmosphereUsed = $derived(
		formatUsedAtmosphere(usedScopeAtmosphere(atmosphere), {
			number: formatNumber,
			units: { hpa: m.unit_hpa(), inhg: m.unit_inhg(), c: m.unit_c(), f: m.unit_f() }
		})
	);
	// Values within their limits whose air density is not above 0 give no result (#107), checked on
	// the atmosphere actually used.
	let noAirDensity = $derived(hasNoAirDensity(atmoParams));

	let trajectory = $derived(
		ballisticPageTrajectory(activeProfile.profile, ballistic.range, atmoParams, ballistic.storedWind)
	);
	let trajectoryResult = $derived(trajectory.result);

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

	// ── Header: active profile (#151), as the Scope View's profile bar ──
	let shown = $derived(shownProfile(activeProfile.profile));
	let profilesHref = $derived(localizeHref('/profiles'));

	// ── Chart card (#151): Drop / Velocity switch, stored in ballistic.options.chartMode ──
	let chartMode = $derived(ballistic.options.chartMode);
	let velUnit = $derived(ballistic.options.velChartUnit ?? 'fps');

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
			y: Math.round(p.slantHeight.In(dropUnit) * 10) / 10
		}));

		const maxX = data.length > 0 ? data[data.length - 1].x : 0;
		// One tick per table step, capped: a small step on a long range asked ApexCharts for
		// millions of ticks (#130).
		const tickAmount = chartTickAmount(maxX, step);

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
		// One tick per table step, capped: a small step on a long range asked ApexCharts for
		// millions of ticks (#130).
		const tickAmount = chartTickAmount(maxX, step);

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
	// Only the chart of the selected mode is in the page; the other element is null, so its chart
	// is destroyed and not built.
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
			chartStep
		);
		const chart = new ac(el, opts);
		chart.render();
		return () => chart.destroy();
	});

	$effect(() => {
		const ac = ApexCharts;
		const el = velChartEl;
		if (!ac || !el) return;

		const opts = buildVelChartOptions(chartPoints, settings.darkMode, isMetric, velUnit, soundSpeedFPS, chartStep);
		const chart = new ac(el, opts);
		chart.render();
		return () => chart.destroy();
	});

	// ── Table columns ────────────────────────────────────────────────
	// elevClicks and windClicks (#151, owner decision) are off by default. They count the clicks of
	// the profile's click value and unit as the Scope View does (utils/clicks.js), signed like the
	// angle columns: a negative elevation is dialled up.
	let elevClickUnit = $derived(shown?.elevationClickUnit ?? 'MOA');
	let windClickUnit = $derived(shown?.windageClickUnit ?? 'MOA');
	let elevPerClick = $derived(clickValue(shown?.elevationClickValue));
	let windPerClick = $derived(clickValue(shown?.windageClickValue));
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
				{ id: 'elevMRAD', label: () => m.ballistic_col_elev_mrad() },
				{ id: 'elevClicks', label: () => m.ballistic_col_elev_clicks() }
			]
		},
		{
			id: 'wind',
			label: () => m.ballistic_group_wind(),
			columns: [
				{ id: 'windIn', label: () => m.ballistic_col_wind_in() },
				{ id: 'windCm', label: () => m.ballistic_col_wind_cm() },
				{ id: 'windMOA', label: () => m.ballistic_col_wind_moa() },
				{ id: 'windMRAD', label: () => m.ballistic_col_wind_mrad() },
				{ id: 'windClicks', label: () => m.ballistic_col_wind_clicks() }
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
				return r1(point.slantHeight.In(Unit.Inch));
			case 'elevCm':
				return r1(point.slantHeight.In(Unit.Centimeter));
			case 'elevMOA':
				return r1(point.dropAngle.In(Unit.MOA));
			case 'elevMRAD':
				return r1(point.dropAngle.In(Unit.MRad));
			case 'windIn':
				return r1(point.windage.In(Unit.Inch));
			case 'windCm':
				return r1(point.windage.In(Unit.Centimeter));
			case 'windMOA':
				return r1(point.windageAngle.In(Unit.MOA));
			case 'windMRAD':
				return r1(point.windageAngle.In(Unit.MRad));
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
			case 'elevClicks':
				return signedClickCount(getElevationValue(point, elevClickUnit), elevPerClick) ?? '';
			case 'windClicks':
				return signedClickCount(getWindageValue(point, windClickUnit), windPerClick) ?? '';
			default:
				return '';
		}
	}

	let visibleColumns = $derived(ballistic.options.visibleColumns ?? ['rangeYd', 'elevIn', 'elevMOA', 'velFps', 'energyFtlb', 'time']);
	let activeColumns = $derived(ALL_COLUMNS.filter((c) => visibleColumns.includes(c.id)));
	let showColumnSelector = $state(false);

	// ── Row highlight (#151) ─────────────────────────────────────────
	// The index in tablePoints of the row at the Scope View's target distance, or -1 (utils/ballisticPage.js).
	let highlightIndex = $derived(
		scopeDistanceRow(
			tablePoints.map((p) => p.distance.In(isMetric ? Unit.Meter : Unit.Yard)),
			scopeView.range,
			isMetric ? 'm' : 'yd'
		)
	);

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

<!-- One stat tile: label, value with unit (or the unknown dash), note line. -->
{#snippet stat(label, value, unit, note)}
	<div class="rounded-container border border-surface-200-800 preset-filled-surface-100-900 px-4 py-3.5 min-w-0">
		<p class="text-xs text-surface-600-400">{label}</p>
		{#if value !== null}
			<p class="mt-1 text-2xl font-bold tabular-nums leading-tight">
				{value}<span class="ml-1 text-sm font-normal text-surface-600-400">{unit}</span>
			</p>
		{:else}
			<p class="mt-1 text-2xl font-bold leading-tight text-surface-600-400">{m.ballistic_unknown()}</p>
		{/if}
		{#if note}
			<p class="mt-0.5 text-xs text-surface-600-400">{note}</p>
		{/if}
	</div>
{/snippet}

{#if !activeProfile.profile}
	<!-- No profile -->
	<div class="py-12 text-center space-y-3">
		<p class="text-surface-600-400">{m.ballistic_no_profile()}</p>
		<a href="/profiles" class="btn preset-tonal-primary">{m.nav_profiles()}</a>
	</div>
{:else}
	<!--
		Below lg: one column (header, Distances, Wind, Atmosphere, stats, chart, table).
		lg and up (where the app sidebar appears): conditions on the left, results on the right (#151).
	-->
	<div class="max-w-[1180px] mx-auto flex flex-col gap-4 lg:gap-5">
		<!-- ═══ Header ═══════════════════════════════════════════════════ -->
		<header class="flex flex-wrap items-center gap-x-4 gap-y-3 px-1 sm:px-0">
			<div class="flex-[1_1_320px] min-w-0">
				<!-- Below lg the app header already shows the title -->
				<h1 class="sr-only lg:not-sr-only lg:text-[28px] lg:font-bold lg:tracking-tight">{m.ballistic_title()}</h1>
				<p class="lg:mt-1 text-sm text-surface-600-400">{m.ballistic_intro()}</p>
			</div>
			<a
				href={profilesHref}
				class="flex items-center gap-2.5 min-h-11 max-w-full px-3.5 py-1.5 rounded-container border border-surface-200-800 preset-filled-surface-100-900 hover:border-primary-500 {focusRing}"
			>
				<span class="size-2 rounded-full shrink-0 bg-primary-500" aria-hidden="true"></span>
				<span class="min-w-0 truncate text-sm font-semibold">
					<span class="sr-only">{m.scope_view_active_profile()}:</span>
					{shown?.name || m.scope_view_profile_unnamed()}{#if shown?.ammo}<span class="font-normal text-surface-600-400"> · {shown.ammo}</span>{/if}
				</span>
				<span class="text-[13px] font-semibold text-primary-700-300 shrink-0">{m.scope_view_profile_change()}</span>
			</a>
			<button
				type="button"
				class="btn h-11 border border-surface-300-700 hover:preset-tonal-surface font-semibold {focusRing}"
				onclick={exportCSV}
				disabled={tablePoints.length === 0}
			>
				<Download class="size-4" aria-hidden="true" />
				{m.ballistic_export_csv()}
			</button>
		</header>

		<div class="grid grid-cols-1 gap-4 lg:grid-cols-[minmax(300px,340px)_minmax(0,1fr)] lg:gap-5 lg:items-start">
			<!-- ═══ Conditions (left column on lg) ══════════════════════════ -->
			<div class="flex flex-col gap-3.5 min-w-0">
				<!-- Distances -->
				<section
					class="card preset-filled-surface-100-900 border border-surface-200-800 px-3.5 py-3 space-y-3"
					aria-labelledby="{uid}-dist-title"
				>
					<h2 id="{uid}-dist-title" class="text-sm font-semibold">{m.ballistic_distances()}</h2>

					<!-- Max distance -->
					<div class="space-y-0.5">
						<label for="{uid}-max" class="text-xs text-surface-600-400">{m.ballistic_max_dist()}</label>
						<div class="input !flex !items-center gap-1 h-11">
							<input
								id="{uid}-max"
								class="flex-1 w-8 min-w-0 bg-transparent border-none outline-none shadow-none p-0 font-semibold"
								type="text"
								inputmode="decimal"
								autocomplete="off"
								placeholder="500"
								value={ballistic.range.distance}
								aria-invalid={!rangeUsable}
								aria-describedby={rangeUsable ? undefined : `${uid}-max-msg`}
								oninput={(e) => ballistic.setRange({ distance: e.target.value })}
							/>
							<ChipGroup
								label={m.scope_view_distance_unit()}
								options={[
									{ value: 'yd', label: m.unit_yd() },
									{ value: 'm', label: m.unit_m() }
								]}
								value={ballistic.range.unit}
								onselect={(unit) => ballistic.setRange({ unit })}
							/>
						</div>
						{#if !rangeUsable}
							<p id="{uid}-max-msg" class="text-xs text-error-500" role="alert">
								{m.validation_range_above_zero({ max: formatLimit(MAX_DISTANCE), unit: distLabel })}
							</p>
						{/if}
					</div>

					<!-- Step -->
					<div class="space-y-0.5">
						<label for="{uid}-step" class="text-xs text-surface-600-400">{m.ballistic_step()}</label>
						<div class="input !flex !items-center gap-1 h-11">
							<input
								id="{uid}-step"
								class="flex-1 w-8 min-w-0 bg-transparent border-none outline-none shadow-none p-0 font-semibold"
								type="text"
								inputmode="decimal"
								autocomplete="off"
								placeholder="25"
								value={ballistic.range.step}
								aria-invalid={stepLimit !== null}
								aria-describedby="{uid}-step-msg"
								oninput={(e) => ballistic.setRange({ step: e.target.value })}
							/>
							<span class="text-sm text-surface-600-400 shrink-0">{distLabel}</span>
						</div>
						{#if stepLimit === 'min'}
							<p id="{uid}-step-msg" class="text-xs text-error-500" role="alert">
								{m.ballistic_step_min({ min: formatLimit(MIN_TABLE_STEP), unit: distLabel })}
							</p>
						{:else if stepLimit === 'max'}
							<p id="{uid}-step-msg" class="text-xs text-error-500" role="alert">
								{m.ballistic_step_max({ max: formatLimit(maxTableStep(ballistic.range.distance)), unit: distLabel })}
							</p>
						{:else}
							<p id="{uid}-step-msg" class="text-xs text-surface-600-400">{m.ballistic_step_hint()}</p>
						{/if}
					</div>
				</section>

				<!-- Wind -->
				<ScopeWindCard
					speed={ballistic.wind.speed}
					speedUnit={ballistic.wind.speedUnit}
					direction={ballistic.wind.direction}
					preset={ballistic.windPreset}
					onchange={(patch) => ballistic.setWind(patch)}
					onpreset={(preset) => ballistic.applyWindPreset(preset)}
				/>

				<!-- Atmosphere -->
				<ScopeAtmosphereCard
					{atmosphere}
					used={atmosphereUsed}
					altitudeTooLow={trajectory.altitudeTooLow}
					{noAirDensity}
					onchange={(patch) => ballistic.setAtmosphere(patch)}
				/>
			</div>

			<!-- ═══ Results (right column on lg) ════════════════════════════ -->
			<div class="@container flex flex-col gap-4 min-w-0">
				<!-- Stats -->
				{#if trajectoryResult}
					<div class="grid grid-cols-2 @xl:grid-cols-4 gap-3">
						{@render stat(m.ballistic_near_zero(), nearZero, distLabel, m.ballistic_stat_near_zero_note())}
						{@render stat(m.ballistic_far_zero(), farZero, distLabel, m.ballistic_stat_far_zero_note())}
						{@render stat(
							m.ballistic_stat_highest(),
							maxApex?.elevation ?? null,
							elevLabel,
							maxApex ? `${m.ballistic_at()} ${maxApex.distance} ${distLabel}` : ''
						)}
						{@render stat(
							m.ballistic_stat_subsonic(),
							subsonicDist,
							distLabel,
							subsonicDist !== null ? m.ballistic_stat_subsonic_note() : m.ballistic_stat_supersonic_note()
						)}
					</div>
				{/if}

				<!-- Bullet path chart -->
				<section
					class="card preset-filled-surface-100-900 border border-surface-200-800 p-4 space-y-2 min-w-0"
					aria-labelledby="{uid}-chart-title"
				>
					<div class="flex flex-wrap items-center gap-x-3 gap-y-2">
						<h2 id="{uid}-chart-title" class="flex-1 min-w-max text-[15px] font-semibold">{m.ballistic_chart_title()}</h2>
						{#if chartMode === 'drop'}
							<button
								type="button"
								class="touch-hit chip text-xs {ballistic.options.showAnnotations
									? 'preset-filled-primary-500'
									: 'preset-tonal-surface'} {focusRing}"
								aria-pressed={ballistic.options.showAnnotations}
								onclick={() => ballistic.setOptions({ showAnnotations: !ballistic.options.showAnnotations })}
							>
								<MapPin class="size-3 mr-1" aria-hidden="true" />{m.ballistic_annotations()}
							</button>
						{:else}
							<ChipGroup
								label={m.ballistic_vel_unit()}
								options={[
									{ value: 'fps', label: m.unit_fps() },
									{ value: 'mps', label: m.unit_mps() }
								]}
								value={velUnit}
								onselect={(value) => ballistic.setOptions({ velChartUnit: value })}
							/>
						{/if}
						<ChipGroup
							variant="segmented"
							label={m.ballistic_chart_mode()}
							options={[
								{ value: 'drop', label: m.ballistic_chart_drop() },
								{ value: 'velocity', label: m.ballistic_vel_chart() }
							]}
							value={chartMode}
							onselect={(mode) => ballistic.setOptions({ chartMode: mode })}
						/>
					</div>

					{#if chartPoints.length === 0}
						<p class="text-sm text-surface-600-400 py-10 text-center">{m.ballistic_no_result()}</p>
					{:else if chartMode === 'drop'}
						<div bind:this={elevChartEl}></div>
						{#if ballistic.options.showAnnotations}
							<div class="flex flex-wrap gap-x-5 gap-y-1 px-2 text-xs text-surface-600-400">
								<span class="flex items-center gap-1.5">
									<span class="inline-block w-5 border-t-2 border-dashed border-surface-400-600" aria-hidden="true"></span>
									{m.ballistic_legend_los()}
								</span>
							</div>
						{/if}
					{:else}
						<div bind:this={velChartEl}></div>
						<div class="flex flex-wrap justify-center gap-x-6 gap-y-1 text-xs text-surface-600-400">
							{#if soundSpeedFPS !== null}
								<span>
									{m.ballistic_speed_of_sound()}:
									{Math.round(velUnit === 'mps' ? soundSpeedFPS / 3.28084 : soundSpeedFPS)}
									{velUnit === 'mps' ? m.unit_mps() : m.unit_fps()}
								</span>
							{/if}
							{#if subsonicDist !== null}
								<span class="flex items-center gap-1">
									<Waves class="size-3" aria-hidden="true" />{m.ballistic_subsonic_dist()}: {subsonicDist} {distLabel}
								</span>
							{/if}
						</div>
					{/if}
				</section>

				<!-- Data table -->
				<section
					class="card preset-filled-surface-100-900 border border-surface-200-800 overflow-hidden min-w-0"
					aria-labelledby="{uid}-table-title"
				>
					<div class="flex items-center gap-3 px-4 py-3 border-b border-surface-200-800">
						<h2 id="{uid}-table-title" class="flex-1 text-[15px] font-semibold">{m.ballistic_table()}</h2>
						<button
							type="button"
							class="btn btn-sm h-9 {showColumnSelector
								? 'preset-filled-primary-500'
								: 'border border-surface-300-700 hover:preset-tonal-surface'} {focusRing}"
							aria-expanded={showColumnSelector}
							aria-controls="{uid}-columns"
							onclick={() => (showColumnSelector = !showColumnSelector)}
						>
							<Columns3 class="size-4" aria-hidden="true" />
							{m.ballistic_columns()}
						</button>
					</div>

					<!-- Column picker -->
					{#if showColumnSelector}
						<div id="{uid}-columns" class="px-4 py-3 space-y-2 border-b border-surface-200-800">
							{#each COLUMN_GROUPS as group (group.id)}
								<div class="space-y-1" role="group" aria-labelledby="{uid}-group-{group.id}">
									<p id="{uid}-group-{group.id}" class="text-xs font-medium text-surface-600-400 uppercase tracking-wide">
										{group.label()}
									</p>
									<div class="flex flex-wrap gap-1.5">
										{#each group.columns as col (col.id)}
											<button
												type="button"
												class="touch-hit chip text-xs {visibleColumns.includes(col.id)
													? 'preset-filled-primary-500'
													: 'preset-tonal-surface'} {focusRing}"
												aria-pressed={visibleColumns.includes(col.id)}
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
						<p class="text-sm text-surface-600-400 py-6 text-center">{m.ballistic_no_result()}</p>
					{:else}
						<div class="overflow-x-auto">
							<table class="table text-sm">
								<thead>
									<tr class="bg-surface-200-800/50">
										{#each activeColumns as col (col.id)}
											<th scope="col" class="text-xs whitespace-nowrap text-surface-600-400">{col.label()}</th>
										{/each}
									</tr>
								</thead>
								<tbody>
									{#each tablePoints as point, i}
										<tr class={i === highlightIndex ? 'preset-tonal-primary font-semibold' : ''}>
											{#each activeColumns as col (col.id)}
												<td class="tabular-nums whitespace-nowrap">{getCellValue(point, col.id)}</td>
											{/each}
										</tr>
									{/each}
								</tbody>
							</table>
						</div>
						{#if highlightIndex >= 0}
							<p class="px-4 py-2 text-xs text-surface-600-400 border-t border-surface-200-800">
								{m.ballistic_table_highlight()}
							</p>
						{/if}
					{/if}
				</section>
			</div>
		</div>
	</div>
{/if}
