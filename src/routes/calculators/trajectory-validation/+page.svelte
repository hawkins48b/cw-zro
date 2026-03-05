<script>
	import { onMount } from 'svelte';
	import { m } from '$lib/paraglide/messages.js';
	import { activeProfile } from '$lib/stores/activeProfile.svelte.js';
	import { profiles } from '$lib/stores/profiles.svelte.js';
	import { settings } from '$lib/stores/settings.svelte.js';
	import { trajectoryValidation } from '$lib/stores/trajectoryValidation.svelte.js';
	import { calculateTrajectoryValidation } from '$lib/utils/trajectoryValidation.js';
	import { calculateFullTrajectory } from '$lib/utils/ballisticCalculator.js';
	import { Unit } from 'js-ballistics';
	import { CheckCircle } from '@lucide/svelte';
	import AtmosphereCard from '$lib/components/AtmosphereCard.svelte';

	// ── ApexCharts (lazy-loaded, browser-only) ───────────────────────
	let ApexCharts = $state(null);
	let chartEl = $state(null);

	onMount(async () => {
		const mod = await import('apexcharts');
		ApexCharts = mod.default;
	});

	// ── Derived: measure type/unit shortcuts ─────────────────────────
	let solveFor = $derived(trajectoryValidation.solveFor);
	let measureType = $derived(trajectoryValidation.measure.type);
	let measureUnit = $derived(
		measureType === 'distance'
			? trajectoryValidation.measure.distanceUnit
			: trajectoryValidation.measure.angleUnit
	);
	let measureValue = $derived(
		measureType === 'distance'
			? trajectoryValidation.measure.distanceValue
			: trajectoryValidation.measure.angleValue
	);
	let measureLabel = $derived(
		measureType === 'distance'
			? (measureUnit === 'cm' ? m.unit_cm() : m.unit_in())
			: (measureUnit === 'mrad' ? m.unit_mrad() : m.unit_moa())
	);

	let atmoParams = $derived(
		trajectoryValidation.atmosphere.useISA ? null : trajectoryValidation.atmosphere
	);

	let isMetric = $derived(trajectoryValidation.range.unit === 'm');
	let distLabel = $derived(isMetric ? m.unit_m() : m.unit_yd());
	let velLabel = $derived(
		activeProfile.profile?.velocityUnit === 'mps' ? m.unit_mps() : m.unit_fps()
	);

	// ── Derived: validation result (binary search) ───────────────────
	let validationResult = $derived.by(() => {
		const profile = activeProfile.profile;
		if (!profile) return null;
		return calculateTrajectoryValidation(
			profile,
			trajectoryValidation.range,
			measureType,
			measureValue,
			measureUnit,
			solveFor,
			atmoParams
		);
	});

	// ── Derived: full trajectories for chart ─────────────────────────
	let chartData = $derived.by(() => {
		const profile = activeProfile.profile;
		if (!profile) return null;

		const rangeDist = parseFloat(trajectoryValidation.range.distance);
		if (!isFinite(rangeDist) || rangeDist < 100) return null;

		const step = 1;
		const chartRange = { distance: rangeDist, unit: trajectoryValidation.range.unit, step };

		const initial = calculateFullTrajectory(profile, chartRange, atmoParams, null);
		if (!initial) return null;

		let validated = null;
		if (validationResult && !validationResult.error) {
			const validatedProfile = solveFor === 'bc'
				? { ...profile, bc: String(validationResult.validatedBc) }
				: { ...profile, velocity: String(validationResult.validatedVelocity) };
			validated = calculateFullTrajectory(validatedProfile, chartRange, atmoParams, null);
		}

		return { initial, validated };
	});

	// ── Chart helpers ────────────────────────────────────────────────
	function resolveCSSColor(varName, fallback) {
		const el = document.createElement('span');
		el.style.cssText = `display:none;color:var(${varName})`;
		document.body.appendChild(el);
		const color = getComputedStyle(el).color;
		document.body.removeChild(el);
		return color || fallback;
	}

	function buildChartOptions(data, dark, metric, mType, mUnit, rangeVal) {
		const distUnit = metric ? Unit.Meter : Unit.Yard;
		const dLabel = metric ? m.unit_m() : m.unit_yd();
		const dAxisLabel = metric ? m.unit_meters() : m.unit_yards();
		const mLabel = mType === 'distance'
			? (mUnit === 'cm' ? m.unit_cm() : m.unit_in())
			: (mUnit === 'mrad' ? m.unit_mrad() : m.unit_moa());

		function getYValue(point) {
			if (mType === 'distance') {
				const u = mUnit === 'cm' ? Unit.Centimeter : Unit.Inch;
				return Math.round(point.targetDrop.In(u) * 10) / 10;
			}
			const u = mUnit === 'mrad' ? Unit.MRad : Unit.MOA;
			return Math.round(point.dropAdjustment.In(u) * 10) / 10;
		}

		const initialData = (data.initial.trajectory ?? []).map((p) => ({
			x: Math.round(p.distance.In(distUnit) * 10) / 10,
			y: getYValue(p)
		})).filter((p) => p.x >= 100);

		const hasValidated = data.validated != null;
		const validatedData = hasValidated
			? (data.validated.trajectory ?? []).map((p) => ({
				x: Math.round(p.distance.In(distUnit) * 10) / 10,
				y: getYValue(p)
			})).filter((p) => p.x >= 100)
			: [];

		const maxX = rangeVal || (initialData.at(-1)?.x ?? 0);
		const cPrimary = resolveCSSColor('--color-primary-500', '#6366f1');
		const cWarning = resolveCSSColor('--color-warning-500', '#f97316');

		const series = [{ name: m.traj_val_initial(), data: initialData }];
		if (hasValidated) series.push({ name: m.traj_val_validated(), data: validatedData });

		return {
			series,
			chart: {
				type: 'line',
				height: 280,
				background: 'transparent',
				toolbar: { show: false },
				animations: { enabled: false },
				zoom: { enabled: false },
				parentHeightOffset: 0
			},
			stroke: { width: hasValidated ? [2, 2] : [2], curve: 'monotoneCubic', dashArray: hasValidated ? [4, 0] : [0] },
			theme: { mode: dark ? 'dark' : 'light' },
			grid: {
				borderColor: dark ? '#374151' : '#e5e7eb',
				strokeDashArray: 3,
				padding: { left: 10, right: 20, top: 0, bottom: 0 }
			},
			xaxis: {
				type: 'numeric',
				min: 100,
				max: maxX || undefined,
				title: { text: dAxisLabel, style: { fontSize: '12px' } },
				labels: { formatter: (v) => `${Math.round(v)}` }
			},
			yaxis: {
				title: { text: mLabel, style: { fontSize: '12px' } },
				labels: { formatter: (v) => `${v}` }
			},
			colors: hasValidated ? [cPrimary, cWarning] : [cPrimary],
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
				],
				xaxis: [
					{
						x: rangeVal,
						borderColor: dark ? '#9ca3af' : '#6b7280',
						strokeDashArray: 4,
						borderWidth: 1,
						label: {
							text: m.traj_val_range(),
							position: 'right',
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
				shared: true,
				intersect: false,
				theme: dark ? 'dark' : 'light',
				x: { formatter: (v) => `${v} ${dLabel}` },
				y: { formatter: (v) => `${v} ${mLabel}` }
			},
			legend: { show: true, position: 'top', horizontalAlign: 'right' },
			markers: { size: 0 }
		};
	}

	// ── Chart effect ─────────────────────────────────────────────────
	$effect(() => {
		const ac = ApexCharts;
		const el = chartEl;
		const data = chartData;
		if (!ac || !el || !data) return;

		const rangeVal = parseFloat(trajectoryValidation.range.distance) || 100;
		const opts = buildChartOptions(
			data,
			settings.darkMode,
			isMetric,
			measureType,
			measureUnit,
			rangeVal
		);
		const chart = new ac(el, opts);
		chart.render();
		return () => chart.destroy();
	});

	// ── Apply validated result to profile ────────────────────────────
	let applied = $state(false);

	function applyResult() {
		const profile = activeProfile.profile;
		if (!profile || !validationResult || validationResult.error) return;
		if (solveFor === 'bc') {
			profiles.update(profile.id, { bc: String(validationResult.validatedBc) });
		} else {
			profiles.update(profile.id, { velocity: String(validationResult.validatedVelocity) });
		}
		applied = true;
	}

	// Reset applied flag whenever the result changes
	$effect(() => {
		const _ = validationResult;
		applied = false;
	});
</script>

<svelte:head>
	<title>{m.traj_val_title()} — {m.app_name()}</title>
</svelte:head>

{#if !activeProfile.profile}
	<div class="py-12 text-center space-y-3">
		<p class="text-surface-500-400">{m.traj_val_no_profile()}</p>
		<a href="/profiles" class="btn preset-tonal-primary">{m.nav_profiles()}</a>
	</div>
{:else}
	<div class="space-y-6">

		<!-- ═══ Solve For toggle ═════════════════════════════════════════ -->
		<div class="flex items-center gap-3">
			<span class="text-sm font-medium">{m.traj_val_solve_for()}</span>
			<div class="flex gap-1">
				{#each [{ value: 'velocity', label: m.traj_val_solve_velocity() }, { value: 'bc', label: m.traj_val_solve_bc() }] as opt}
					<button
						type="button"
						class="chip text-xs {trajectoryValidation.solveFor === opt.value
							? 'preset-filled-primary-500'
							: 'preset-tonal-surface'}"
						onclick={() => trajectoryValidation.setSolveFor(opt.value)}
					>{opt.label}</button>
				{/each}
			</div>
		</div>

		<!-- ═══ Inputs ══════════════════════════════════════════════════ -->
		<div class="grid grid-cols-1 sm:grid-cols-2 gap-4">

			<!-- Range card -->
			<div class="card preset-filled-surface-100-900 p-4 space-y-3">
				<div class="space-y-1.5">
					<span class="text-sm font-medium">{m.traj_val_range()}</span>
					<div class="input !flex !items-center gap-2">
						<input
							class="flex-1 min-w-0 bg-transparent border-none outline-none shadow-none p-0"
							type="text"
							inputmode="decimal"
							placeholder="100"
							value={trajectoryValidation.range.distance}
							oninput={(e) => trajectoryValidation.setRange({ distance: e.target.value })}
						/>
						<div class="flex gap-1 shrink-0">
							{#each [{ value: 'yd', label: m.unit_yd() }, { value: 'm', label: m.unit_m() }] as opt}
								<button
									type="button"
									class="chip text-xs {trajectoryValidation.range.unit === opt.value
										? 'preset-filled-primary-500'
										: 'preset-tonal-surface'}"
									onclick={() => trajectoryValidation.setRange({ unit: opt.value })}
								>{opt.label}</button>
							{/each}
						</div>
					</div>
					{#if parseFloat(trajectoryValidation.range.distance) > 0 && parseFloat(trajectoryValidation.range.distance) < 100}
						<p class="text-xs text-error-500">{m.traj_val_range_min_error()}</p>
					{:else}
						<p class="text-xs text-surface-500-400">{m.traj_val_range_hint()}</p>
					{/if}
				</div>
			</div>

			<!-- Measure card -->
			<div class="card preset-filled-surface-100-900 p-4 space-y-3">
				<!-- Type toggle -->
				<div class="flex items-center justify-between">
					<span class="text-sm font-medium">{m.traj_val_measure_type()}</span>
					<div class="flex gap-1">
						{#each [{ value: 'angle', label: m.traj_val_angle() }, { value: 'distance', label: m.traj_val_distance() }] as opt}
							<button
								type="button"
								class="chip text-xs {trajectoryValidation.measure.type === opt.value
									? 'preset-filled-primary-500'
									: 'preset-tonal-surface'}"
								onclick={() => trajectoryValidation.setMeasure({ type: opt.value })}
							>{opt.label}</button>
						{/each}
					</div>
				</div>

				<!-- Value + unit -->
				<div class="space-y-1.5">
					<div class="flex items-center justify-between">
						<span class="text-sm font-medium">{m.traj_val_measure_value()}</span>
						<!-- Unit chips -->
						{#if measureType === 'angle'}
							<div class="flex gap-1">
								{#each [{ value: 'moa', label: m.unit_moa() }, { value: 'mrad', label: m.unit_mrad() }] as opt}
									<button
										type="button"
										class="chip text-xs {trajectoryValidation.measure.angleUnit === opt.value
											? 'preset-filled-primary-500'
											: 'preset-tonal-surface'}"
										onclick={() => trajectoryValidation.setMeasure({ angleUnit: opt.value })}
									>{opt.label}</button>
								{/each}
							</div>
						{:else}
							<div class="flex gap-1">
								{#each [{ value: 'in', label: m.unit_in() }, { value: 'cm', label: m.unit_cm() }] as opt}
									<button
										type="button"
										class="chip text-xs {trajectoryValidation.measure.distanceUnit === opt.value
											? 'preset-filled-primary-500'
											: 'preset-tonal-surface'}"
										onclick={() => trajectoryValidation.setMeasure({ distanceUnit: opt.value })}
									>{opt.label}</button>
								{/each}
							</div>
						{/if}
					</div>
					<div class="input !flex !items-center gap-2">
						<input
							class="flex-1 min-w-0 bg-transparent border-none outline-none shadow-none p-0"
							type="text"
							inputmode="decimal"
							placeholder="0"
							value={measureValue}
							oninput={(e) => trajectoryValidation.setMeasure(
								measureType === 'angle'
									? { angleValue: e.target.value }
									: { distanceValue: e.target.value }
							)}
						/>
						<span class="text-sm text-surface-500-400 shrink-0">{measureLabel}</span>
					</div>
					<p class="text-xs text-surface-500-400">
						{measureType === 'angle' ? m.traj_val_measure_hint_angle() : m.traj_val_measure_hint_distance()}
					</p>
				</div>
			</div>
		</div>

		<!-- ═══ Atmosphere ═══════════════════════════════════════════════ -->
		<AtmosphereCard
			atmosphere={trajectoryValidation.atmosphere}
			onchange={(patch) => trajectoryValidation.setAtmosphere(patch)}
		/>

		<!-- ═══ Results ══════════════════════════════════════════════════ -->
		{#if validationResult?.error === 'range'}
			<p class="text-sm text-warning-500 text-center py-2">{m.traj_val_range_error()}</p>
		{:else if validationResult?.error === 'no_solution'}
			<p class="text-sm text-warning-500 text-center py-2">{m.traj_val_no_result()}</p>
		{:else if validationResult && !validationResult.error}
			<div class="grid grid-cols-2 sm:grid-cols-3 gap-3">
				{#if solveFor === 'velocity'}
					<!-- Profile velocity -->
					<div class="px-3 py-3 rounded-lg bg-surface-50-950">
						<p class="text-xs text-surface-500-400 uppercase tracking-wide leading-none mb-1">
							{m.traj_val_profile_velocity()}
						</p>
						<p class="text-sm font-semibold tabular-nums leading-none">
							{validationResult.initialVelocity}
							<span class="text-xs font-normal text-surface-500-400">{velLabel}</span>
						</p>
					</div>
					<!-- Validated velocity -->
					<div class="px-3 py-3 rounded-lg bg-surface-50-950">
						<p class="text-xs text-surface-500-400 uppercase tracking-wide leading-none mb-1">
							{m.traj_val_validated_velocity()}
						</p>
						<p class="text-sm font-semibold tabular-nums leading-none text-success-500">
							{validationResult.validatedVelocity}
							<span class="text-xs font-normal text-surface-500-400">{velLabel}</span>
						</p>
					</div>
				{:else}
					<!-- Profile BC -->
					<div class="px-3 py-3 rounded-lg bg-surface-50-950">
						<p class="text-xs text-surface-500-400 uppercase tracking-wide leading-none mb-1">
							{m.traj_val_profile_bc()}
						</p>
						<p class="text-sm font-semibold tabular-nums leading-none">
							{validationResult.initialBc}
						</p>
					</div>
					<!-- Validated BC -->
					<div class="px-3 py-3 rounded-lg bg-surface-50-950">
						<p class="text-xs text-surface-500-400 uppercase tracking-wide leading-none mb-1">
							{m.traj_val_validated_bc()}
						</p>
						<p class="text-sm font-semibold tabular-nums leading-none text-success-500">
							{validationResult.validatedBc}
						</p>
					</div>
				{/if}

				<!-- Apply button -->
				<div class="col-span-2 sm:col-span-1 flex items-center">
					<button
						type="button"
						class="btn btn-sm w-full {applied ? 'preset-filled-success-500' : 'preset-tonal-primary'}"
						title={m.traj_val_apply()}
						onclick={applyResult}
						disabled={applied}
					>
						<CheckCircle class="size-4" />
						<span class="text-xs">{applied ? m.traj_val_applied() : m.traj_val_apply()}</span>
					</button>
				</div>
			</div>
		{:else}
			<p class="text-sm text-surface-500-400 text-center py-2">{m.traj_val_hint()}</p>
		{/if}

		<!-- ═══ Comparison chart ═════════════════════════════════════════ -->
		{#if chartData}
			<div class="space-y-2">
				<h2 class="font-semibold">{m.traj_val_chart_title()}</h2>
				<div bind:this={chartEl}></div>
			</div>
		{/if}

	</div>
{/if}
