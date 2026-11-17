<script>
	import { onMount } from 'svelte';
	import { m } from '#lib/paraglide/messages.js';
	import { localizeHref } from '#lib/paraglide/runtime.js';
	import { activeProfile } from '#lib/stores/activeProfile.svelte.js';
	import { profiles } from '#lib/stores/profiles.svelte.js';
	import { settings } from '#lib/stores/settings.svelte.js';
	import { trajectoryValidation } from '#lib/stores/trajectoryValidation.svelte.js';
	import { calculateTrajectoryValidation } from '#lib/utils/trajectoryValidation.js';
	import {
		validationChange,
		validationObservationPoint,
		validationPatch
	} from '#lib/utils/validationView.js';
	import { altitudeTooLowMessage } from '#lib/components/altitudeMessage.js';
	import { calculateFullTrajectory } from '#lib/utils/ballisticCalculator.js';
	import { readDecimal } from '#lib/utils/decimal.js';
	import { formatLimit, formatNumber } from '#lib/utils/format.js';
	import { MAX_DISTANCE } from '#lib/utils/inputLimits.js';
	import { chartLabelAnchor } from '#lib/utils/mpbrView.js';
	import { profileName } from '#lib/components/profile/profileLabels.js';
	import { Unit } from 'js-ballistics';
	import AtmosphereCard from '#lib/components/AtmosphereCard.svelte';
	import ChipGroup from '#lib/components/ChipGroup.svelte';
	import ProfileInUseChip from '#lib/components/ProfileInUseChip.svelte';
	import ApplyChangeCard from '#lib/components/calc/ApplyChangeCard.svelte';

	// ── ApexCharts (lazy-loaded, browser-only) ───────────────────────
	let ApexCharts = $state(null);
	let chartEl = $state(null);

	onMount(async () => {
		const mod = await import('apexcharts');
		ApexCharts = mod.default;
	});

	const uid = $props.id();

	// ── Derived: measure type/unit shortcuts ─────────────────────────
	let solveFor = $derived(trajectoryValidation.solveFor);
	let measureType = $derived(trajectoryValidation.measure.type);
	let measureDirection = $derived(trajectoryValidation.direction);
	let measureHint = $derived.by(() => {
		if (measureType === 'angle') {
			return measureDirection === 'above'
				? m.traj_val_measure_hint_angle_above()
				: m.traj_val_measure_hint_angle();
		}
		return measureDirection === 'above'
			? m.traj_val_measure_hint_distance_above()
			: m.traj_val_measure_hint_distance();
	});
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
	let rangeNumber = $derived(readDecimal(trajectoryValidation.range.distance));

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
			atmoParams,
			measureDirection
		);
	});
	let change = $derived(validationChange(validationResult));
	let observation = $derived(
		validationObservationPoint(trajectoryValidation.range.distance, measureValue, measureDirection)
	);

	// ── Derived: full trajectories for chart ─────────────────────────
	let chartData = $derived.by(() => {
		const profile = activeProfile.profile;
		if (!profile) return null;

		const rangeDist = readDecimal(trajectoryValidation.range.distance);
		if (!isFinite(rangeDist) || rangeDist < 100 || rangeDist > MAX_DISTANCE) return null;

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

	// ── Display helpers (the result's numbers, in the locale) ────────
	const num = (v, digits = 1) => formatNumber(v, { maximumFractionDigits: digits });
	const signedNum = (v, digits) => `${v > 0 ? '+' : v < 0 ? '−' : ''}${num(Math.abs(v), digits)}`;
	let bcType = $derived(activeProfile.profile?.bcType === 'G7' ? 'G7' : 'G1');
	/** "766 m/s" or "0.462 G1". */
	const valueText = (field, v) => (field === 'bc' ? `${num(v, 3)} ${bcType}` : `${num(v, 1)} ${velLabel}`);

	let diffNote = $derived.by(() => {
		if (!change) return '';
		if (change.same || change.percent === null || change.percent === 0) return m.traj_val_diff_same();
		const percent = num(Math.abs(change.percent), 1);
		if (change.field === 'velocity') {
			return change.diff < 0 ? m.traj_val_diff_slower({ percent }) : m.traj_val_diff_faster({ percent });
		}
		return change.diff < 0 ? m.traj_val_diff_lower({ percent }) : m.traj_val_diff_higher({ percent });
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

	function buildChartOptions(data, dark, metric, mType, mUnit, rangeVal, obs) {
		const distUnit = metric ? Unit.Meter : Unit.Yard;
		const dLabel = metric ? m.unit_m() : m.unit_yd();
		const mLabel = mType === 'distance'
			? (mUnit === 'cm' ? m.unit_cm() : m.unit_in())
			: (mUnit === 'mrad' ? m.unit_mrad() : m.unit_moa());

		function getYValue(point) {
			if (mType === 'distance') {
				const u = mUnit === 'cm' ? Unit.Centimeter : Unit.Inch;
				return Math.round(point.slantHeight.In(u) * 10) / 10;
			}
			const u = mUnit === 'mrad' ? Unit.MRad : Unit.MOA;
			return Math.round(point.dropAngle.In(u) * 10) / 10;
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
		const cPrimary = resolveCSSColor('--color-primary-500', '#0a7a38');
		const cWarning = resolveCSSColor('--color-warning-500', '#a35f00');
		const cMuted = dark ? '#a9adaa' : '#4f5350';
		const cText = dark ? '#f8faf8' : '#181b19';

		const series = [{ name: m.traj_val_legend_profile(), data: initialData }];
		if (hasValidated) series.push({ name: m.traj_val_validated(), data: validatedData });

		const points = [];
		if (obs) {
			points.push({
				x: obs.x,
				y: obs.y,
				marker: { size: 7, fillColor: 'transparent', strokeColor: cWarning, strokeWidth: 3, shape: 'circle' },
				label: {
					text: m.traj_val_chart_obs({ value: num(Math.abs(obs.y)), unit: mLabel }),
					borderColor: cWarning,
					style: { color: '#fff', background: cWarning, fontSize: '11px', fontWeight: 600 },
					// The observation sits at the right end of the plot: label to its left, and on the
					// side of the line of sight away from the curve's end.
					offsetY: obs.y < 0 ? 32 : -12,
					textAnchor: chartLabelAnchor(obs.x, maxX)
				}
			});
		}

		return {
			series,
			chart: {
				type: 'line',
				height: 280,
				background: 'transparent',
				toolbar: { show: false },
				animations: { enabled: false },
				zoom: { enabled: false },
				parentHeightOffset: 0,
				fontFamily: 'inherit'
			},
			stroke: { width: hasValidated ? [2, 3] : [2], curve: 'monotoneCubic', dashArray: hasValidated ? [6, 0] : [6] },
			theme: { mode: dark ? 'dark' : 'light' },
			grid: {
				borderColor: dark ? '#272b28' : '#dfe3e0',
				strokeDashArray: 3,
				padding: { left: 10, right: 20, top: 0, bottom: 0 }
			},
			xaxis: {
				type: 'numeric',
				min: 100,
				max: maxX || undefined,
				title: { text: m.calc_axis_distance({ unit: dLabel }), style: { fontSize: '12px', fontWeight: 600, color: cText } },
				labels: { formatter: (v) => `${Math.round(v)}`, style: { colors: cMuted } }
			},
			yaxis: {
				title: { text: m.traj_val_axis_height({ unit: mLabel }), style: { fontSize: '12px', fontWeight: 600, color: cText } },
				labels: { formatter: (v) => `${Math.round(v * 10) / 10}`, style: { colors: cMuted } }
			},
			colors: hasValidated ? [cMuted, cPrimary] : [cMuted],
			annotations: {
				yaxis: [
					{
						y: 0,
						borderColor: cMuted,
						strokeDashArray: 3,
						borderWidth: 1,
						label: {
							text: m.ballistic_legend_los(),
							position: 'center',
							borderColor: 'transparent',
							style: { fontSize: '10px', color: cMuted, background: 'transparent' }
						}
					}
				],
				xaxis: [
					{
						x: rangeVal,
						borderColor: cMuted,
						strokeDashArray: 4,
						borderWidth: 1,
						label: {
							text: m.traj_val_chart_range({ distance: num(rangeVal), unit: dLabel }),
							position: 'top',
							orientation: 'horizontal',
							textAnchor: 'end',
							offsetX: -6,
							borderColor: 'transparent',
							style: { fontSize: '10px', color: cMuted, background: 'transparent' }
						}
					}
				],
				points
			},
			tooltip: {
				shared: true,
				intersect: false,
				theme: dark ? 'dark' : 'light',
				x: { formatter: (v) => `${v} ${dLabel}` },
				y: { formatter: (v) => `${v} ${mLabel}` }
			},
			legend: { show: false },
			markers: { size: 0 }
		};
	}

	// ── Chart effect ─────────────────────────────────────────────────
	$effect(() => {
		const ac = ApexCharts;
		const el = chartEl;
		const data = chartData;
		if (!ac || !el || !data) return;

		const rangeVal = readDecimal(trajectoryValidation.range.distance) || 100;
		const opts = buildChartOptions(
			data,
			settings.darkMode,
			isMetric,
			measureType,
			measureUnit,
			rangeVal,
			observation
		);
		const chart = new ac(el, opts);
		chart.render();
		return () => chart.destroy();
	});

	// ── Apply validated result to profile ────────────────────────────
	/**
	 * The change Apply saved (#166). Applying changes the profile, which reruns the search from the
	 * new value, so the before → after is kept here and shown until an input or the profile in use
	 * changes. The page stays.
	 */
	let appliedChange = $state(null);

	function applyResult() {
		const profile = activeProfile.profile;
		const patch = validationPatch(validationResult);
		if (!profile || !patch || !change || change.same) return;
		const snapshot = change;
		if (profiles.update(profile.id, patch)) appliedChange = snapshot;
	}

	// Forget the applied change when what was observed, what is solved, the weather or the profile
	// in use changes, but not when Apply itself changes the profile's velocity or BC.
	let inputsKey = $derived(
		JSON.stringify([
			activeProfile.id,
			trajectoryValidation.range,
			trajectoryValidation.measure,
			solveFor,
			trajectoryValidation.atmosphere
		])
	);
	let appliedKey = '';
	$effect(() => {
		const key = inputsKey;
		if (key !== appliedKey) {
			appliedKey = key;
			appliedChange = null;
		}
	});

	let profileLabel = $derived(activeProfile.profile ? profileName(activeProfile.profile) : '');

	let answerLead = $derived.by(() => {
		const args = {
			range: num(rangeNumber),
			unit: distLabel,
			value: num(Math.abs(readDecimal(measureValue))),
			measureUnit: measureLabel
		};
		return measureDirection === 'above' ? m.traj_val_answer_lead_above(args) : m.traj_val_answer_lead_below(args);
	});

	let chartAria = $derived.by(() => {
		const parts = [m.traj_val_chart_title()];
		if (observation) parts.push(m.traj_val_chart_obs({ value: num(Math.abs(observation.y)), unit: measureLabel }));
		parts.push(m.traj_val_chart_range({ distance: num(rangeNumber), unit: distLabel }));
		return parts.join('. ');
	});

	const focusRing = 'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary-500';
	const cardClass = 'card preset-filled-surface-100-900 border border-surface-200-800 p-4 flex flex-col gap-3';
</script>

<svelte:head>
	<title>{m.traj_val_title()} — {m.app_name()}</title>
</svelte:head>

{#snippet stepsCards()}
	<!-- 1 · What you saw -->
	<section class={cardClass} aria-labelledby="{uid}-step1">
		<h2 id="{uid}-step1" class="text-[15px] font-semibold">{m.traj_val_step_seen()}</h2>

		<div class="space-y-1">
			<label for="{uid}-range" class="text-xs text-surface-600-400">{m.traj_val_range()}</label>
			<div class="input !flex !items-center gap-2 h-12">
				<input
					id="{uid}-range"
					class="flex-1 w-10 min-w-0 bg-transparent border-none outline-none shadow-none p-0 text-lg font-semibold"
					type="text"
					inputmode="decimal"
					placeholder="100"
					aria-describedby="{uid}-range-note"
					value={trajectoryValidation.range.distance}
					oninput={(e) => trajectoryValidation.setRange({ distance: e.target.value })}
				/>
				<ChipGroup
					label={m.traj_val_range()}
					options={[
						{ value: 'yd', label: m.unit_yd() },
						{ value: 'm', label: m.unit_m() }
					]}
					value={trajectoryValidation.range.unit}
					onselect={(unit) => trajectoryValidation.setRange({ unit })}
				/>
			</div>
			{#if rangeNumber > 0 && rangeNumber < 100}
				<p id="{uid}-range-note" class="text-xs text-error-500">{m.traj_val_range_min_error()}</p>
			{:else if rangeNumber > MAX_DISTANCE}
				<p id="{uid}-range-note" class="text-xs text-error-500">{m.validation_range({ min: formatLimit(100), max: formatLimit(MAX_DISTANCE), unit: distLabel })}</p>
			{:else}
				<p id="{uid}-range-note" class="text-xs leading-snug text-surface-600-400">{m.traj_val_range_hint()}</p>
			{/if}
		</div>

		<div class="space-y-1.5">
			<span id="{uid}-type" class="block text-xs text-surface-600-400">{m.traj_val_measure_type()}</span>
			<ChipGroup
				variant="segmented"
				stretch
				label={m.traj_val_measure_type()}
				options={[
					{ value: 'angle', label: m.traj_val_angle() },
					{ value: 'distance', label: m.traj_val_distance() }
				]}
				value={measureType}
				onselect={(type) => trajectoryValidation.setMeasure({ type })}
			/>
			<p class="text-xs leading-snug text-surface-600-400">{m.traj_val_measure_type_hint()}</p>
		</div>

		<div class="space-y-1.5">
			<span class="block text-xs text-surface-600-400">{m.traj_val_direction()}</span>
			<ChipGroup
				variant="segmented"
				stretch
				label={m.traj_val_direction()}
				options={[
					{ value: 'below', label: m.traj_val_direction_below() },
					{ value: 'above', label: m.traj_val_direction_above() }
				]}
				value={measureDirection}
				onselect={(direction) => trajectoryValidation.setMeasure({ direction })}
			/>
		</div>

		<div class="space-y-1">
			<label for="{uid}-value" class="text-xs text-surface-600-400">{m.traj_val_measure_value()}</label>
			<div class="input !flex !items-center gap-2 h-12">
				<input
					id="{uid}-value"
					class="flex-1 w-10 min-w-0 bg-transparent border-none outline-none shadow-none p-0 text-lg font-semibold"
					type="text"
					inputmode="decimal"
					placeholder="0"
					aria-describedby="{uid}-value-hint"
					value={measureValue}
					oninput={(e) => trajectoryValidation.setMeasure(
						measureType === 'angle'
							? { angleValue: e.target.value }
							: { distanceValue: e.target.value }
					)}
				/>
				{#if measureType === 'angle'}
					<ChipGroup
						label={m.traj_val_measure_value()}
						options={[
							{ value: 'moa', label: m.unit_moa() },
							{ value: 'mrad', label: m.unit_mrad() }
						]}
						value={trajectoryValidation.measure.angleUnit}
						onselect={(angleUnit) => trajectoryValidation.setMeasure({ angleUnit })}
					/>
				{:else}
					<ChipGroup
						label={m.traj_val_measure_value()}
						options={[
							{ value: 'in', label: m.unit_in() },
							{ value: 'cm', label: m.unit_cm() }
						]}
						value={trajectoryValidation.measure.distanceUnit}
						onselect={(distanceUnit) => trajectoryValidation.setMeasure({ distanceUnit })}
					/>
				{/if}
			</div>
			<p id="{uid}-value-hint" class="text-xs leading-snug text-surface-600-400">{measureHint}</p>
		</div>
	</section>

	<!-- 2 · What to correct -->
	<section class={cardClass} aria-labelledby="{uid}-step2">
		<h2 id="{uid}-step2" class="text-[15px] font-semibold">{m.traj_val_step_correct()}</h2>
		<ChipGroup
			variant="segmented"
			stretch
			label={m.traj_val_step_correct()}
			options={[
				{ value: 'velocity', label: m.traj_val_solve_velocity() },
				{ value: 'bc', label: m.traj_val_solve_bc() }
			]}
			value={solveFor}
			onselect={(value) => trajectoryValidation.setSolveFor(value)}
		/>
		<p class="text-xs leading-snug text-surface-600-400">
			{solveFor === 'bc' ? m.traj_val_solve_hint_bc() : m.traj_val_solve_hint_velocity()}
		</p>
	</section>

	<!-- 3 · Weather that day -->
	<AtmosphereCard
		title={m.traj_val_step_weather()}
		isaHint={m.traj_val_isa_hint()}
		atmosphere={trajectoryValidation.atmosphere}
		altitudeTooLow={validationResult?.error === 'minimum_altitude'}
		onchange={(patch) => trajectoryValidation.setAtmosphere(patch)}
	/>
{/snippet}

{#snippet answerCard()}
	{#if change}
		{@const field = change.field}
		<section
			class="card bg-primary-600 dark:bg-primary-800 text-primary-50 rounded-container p-4 flex flex-col gap-3"
			aria-label={field === 'bc' ? m.traj_val_validated_bc() : m.traj_val_validated_velocity()}
			aria-live="polite"
		>
			<span class="text-[13px] font-medium">{answerLead}</span>
			<div>
				<p class="text-[11px] font-bold uppercase tracking-wider">
					{field === 'bc' ? m.traj_val_validated_bc() : m.traj_val_validated_velocity()}
				</p>
				<p class="text-[34px] font-extrabold leading-none tabular-nums tracking-tight">
					{num(change.after, field === 'bc' ? 3 : 1)}
					<span class="text-lg font-semibold">{field === 'bc' ? bcType : velLabel}</span>
				</p>
			</div>
			<div class="grid grid-cols-2 gap-2.5">
				<div class="rounded-base bg-primary-50/12 px-3 py-2.5">
					<p class="text-[11px] font-bold uppercase tracking-wider">
						{field === 'bc' ? m.traj_val_profile_bc() : m.traj_val_profile_velocity()}
					</p>
					<p class="text-xl font-bold tabular-nums leading-tight">{valueText(field, change.before)}</p>
				</div>
				<div class="rounded-base bg-primary-50/12 px-3 py-2.5">
					<p class="text-[11px] font-bold uppercase tracking-wider">{m.traj_val_difference()}</p>
					<p class="text-xl font-bold tabular-nums leading-tight">
						{signedNum(change.diff, field === 'bc' ? 3 : 1)}{field === 'bc' ? '' : ` ${velLabel}`}
					</p>
					<p class="mt-0.5 text-[11px] leading-snug opacity-90">{diffNote}</p>
				</div>
			</div>
			<p class="text-xs leading-snug opacity-90">{m.traj_val_answer_note()}</p>
		</section>
	{:else}
		<section class="card preset-filled-surface-100-900 border border-surface-200-800 p-4" aria-live="polite">
			{#if validationResult?.error === 'range'}
				<p class="text-sm text-warning-800-200 text-center py-2">{m.traj_val_range_error()}</p>
			{:else if validationResult?.error === 'minimum_altitude'}
				<p class="text-sm text-warning-800-200 text-center py-2">{altitudeTooLowMessage(trajectoryValidation.atmosphere.altitudeUnit)}</p>
			{:else if validationResult?.error === 'no_solution'}
				<p class="text-sm text-warning-800-200 text-center py-2">{m.traj_val_no_result()}</p>
			{:else if validationResult?.error === 'timeout'}
				<p class="text-sm text-warning-800-200 text-center py-2">{m.traj_val_timeout()}</p>
			{:else}
				<p class="text-sm text-surface-600-400 text-center py-2">{m.traj_val_hint()}</p>
			{/if}
		</section>
	{/if}
	{#if validationResult?.suggestAbove}
		<p class="text-xs text-warning-800-200 text-center">{m.traj_val_above_los_notice()}</p>
	{/if}
{/snippet}

{#snippet applyCard()}
	{#if appliedChange || change}
		{@const shown = appliedChange ?? change}
		{@const after = valueText(shown.field, shown.after)}
		<ApplyChangeCard
			title={m.traj_val_apply()}
			label={shown.field === 'bc' ? m.traj_val_profile_bc() : m.traj_val_profile_velocity()}
			before={valueText(shown.field, shown.before)}
			{after}
			note={shown.field === 'bc'
				? m.traj_val_apply_note_bc({ profile: profileLabel })
				: m.traj_val_apply_note_velocity({ profile: profileLabel })}
			buttonLabel={shown.field === 'bc'
				? m.traj_val_apply_bc({ value: num(shown.after, 3) })
				: m.traj_val_apply_velocity({ value: num(shown.after, 1), unit: velLabel })}
			doneText={appliedChange
				? appliedChange.field === 'bc'
					? m.traj_val_applied_bc({ value: num(appliedChange.after, 3), type: bcType })
					: m.traj_val_applied_velocity({ value: num(appliedChange.after, 1), unit: velLabel })
				: ''}
			unchangedText={!appliedChange && change?.same ? m.traj_val_already() : ''}
			onapply={applyResult}
		/>
	{/if}
{/snippet}

{#snippet chartCard()}
	<section
		class="card preset-filled-surface-100-900 border border-surface-200-800 p-4 flex flex-col gap-2.5 min-w-0"
		aria-labelledby="{uid}-chart-title"
	>
		<h2 id="{uid}-chart-title" class="text-[15px] font-semibold">{m.traj_val_chart_title()}</h2>
		<div class="flex flex-wrap gap-x-4 gap-y-1 text-xs text-surface-600-400" aria-hidden="true">
			<span class="flex items-center gap-1.5"><span class="inline-block w-[18px] border-t-2 border-dashed border-surface-500"></span>{m.traj_val_legend_profile()}</span>
			{#if chartData?.validated}
				<span class="flex items-center gap-1.5"><span class="inline-block w-[18px] h-[3px] rounded-full bg-primary-500"></span>{m.traj_val_validated()}</span>
			{/if}
			{#if observation}
				<span class="flex items-center gap-1.5"><span class="inline-block size-2.5 rounded-full border-2 border-warning-500"></span>{m.traj_val_legend_observation()}</span>
			{/if}
		</div>
		<div role="img" aria-label={chartAria}>
			<div bind:this={chartEl}></div>
		</div>
		<p class="text-xs leading-snug text-surface-600-400">{m.traj_val_chart_note()}</p>
	</section>
{/snippet}

{#if !activeProfile.profile}
	<div class="py-12 text-center space-y-3">
		<p class="text-surface-600-400">{m.traj_val_no_profile()}</p>
		<a href={localizeHref('/profiles')} class="btn preset-tonal-primary">{m.nav_profiles()}</a>
	</div>
{:else}
	<!--
		Phone: one column: the three steps, then the answer, Apply and the chart.
		From md: steps on the left; answer, Apply and chart on the right (answer first).
	-->
	<div class="max-w-[1180px] mx-auto flex flex-col gap-4 lg:gap-5">
		<header class="flex flex-wrap items-center gap-x-4 gap-y-3 px-1 sm:px-0">
			<div class="order-2 sm:order-none flex-[1_1_320px] min-w-0">
				<!-- Below lg the app header already shows the title -->
				<h1 class="sr-only lg:not-sr-only lg:text-[28px] lg:font-bold lg:tracking-tight">{m.traj_val_title()}</h1>
				<p class="lg:mt-1 text-sm text-surface-600-400">{m.traj_val_intro()}</p>
			</div>
			<ProfileInUseChip class="order-1 sm:order-none sm:flex-[0_1_300px]" />
		</header>

		<div class="flex flex-col gap-4 md:grid md:grid-cols-2 md:items-start lg:grid-cols-[minmax(300px,1fr)_minmax(0,1.9fr)] lg:gap-5">
			<div class="flex flex-col gap-4 min-w-0">
				{@render stepsCards()}
			</div>
			<div class="flex flex-col gap-4 min-w-0">
				{@render answerCard()}
				{@render applyCard()}
				{#if chartData}
					{@render chartCard()}
				{/if}
			</div>
		</div>
	</div>
{/if}
