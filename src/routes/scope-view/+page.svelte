<script>
	import { m } from '$lib/paraglide/messages.js';
	import {
		ArrowUp,
		ArrowDown,
		ArrowLeft,
		ArrowRight,
		Timer,
		Zap,
		ChevronDown,
		ChevronRight
	} from '@lucide/svelte';

	let showElevation = $state(false);
	import DistanceInput from '$lib/components/DistanceInput.svelte';
	import WindInput from '$lib/components/WindInput.svelte';
	import AtmosphereCard from '$lib/components/AtmosphereCard.svelte';
	import ScopeReticle from '$lib/components/ScopeReticle.svelte';
	import { activeProfile } from '$lib/stores/activeProfile.svelte.js';
	import { scopeView } from '$lib/stores/scopeView.svelte.js';
	import { calculateShotPoint, getElevationValue, getWindageValue } from '$lib/utils/ballisticCalculator.js';
	import { Unit } from 'js-ballistics';

	// ── Derived computation ─────────────────────────────────────────

	/**
	 * Compute the effective horizontal distance using the cosine rule.
	 * Elevation angle is applied so bullet drop reflects true horizontal range.
	 */
	let effectiveRange = $derived.by(() => {
		const raw = parseFloat(scopeView.range.distance);
		if (!raw || raw <= 0) return null;
		if (!showElevation) return { distance: raw, unit: scopeView.range.unit };
		const { angle, unit } = scopeView.elevation;
		const a = parseFloat(angle) || 0;
		const cosAngle = unit === 'deg' ? Math.cos((a * Math.PI) / 180) : parseFloat(angle) || 1;
		const dist = raw * cosAngle;
		return { distance: dist, unit: scopeView.range.unit };
	});

	let atmoParams = $derived(
		scopeView.atmosphere.useISA ? null : scopeView.atmosphere
	);

	let point = $derived.by(() => {
		const profile = activeProfile.profile;
		if (!profile || !effectiveRange) return null;
		return calculateShotPoint(profile, effectiveRange, atmoParams, scopeView.wind);
	});

	let cantedPoint = $derived.by(() => {
		if (!scopeView.rotation) return point;
		const profile = activeProfile.profile;
		if (!profile || !effectiveRange) return null;
		return calculateShotPoint(profile, effectiveRange, atmoParams, scopeView.wind, { cantAngle: scopeView.rotation });
	});

	let elevUnit = $derived(activeProfile.profile?.elevationClickUnit ?? 'MOA');
	let windUnit = $derived(activeProfile.profile?.windageClickUnit ?? 'MOA');

	let elevValue = $derived(getElevationValue(point, elevUnit));
	let windValue = $derived(getWindageValue(point, windUnit));

	let elevClickVal = $derived(parseFloat(activeProfile.profile?.elevationClickValue) || 0.5);
	let windClickVal = $derived(parseFloat(activeProfile.profile?.windageClickValue) || 0.5);

	let elevClicks = $derived(elevValue !== null ? Math.round(Math.abs(elevValue) / elevClickVal) : null);
	let windClicks = $derived(windValue !== null ? Math.round(Math.abs(windValue) / windClickVal) : null);

	// Direction logic (matches v1 convention)
	let elevDir = $derived(elevValue !== null ? (elevValue <= 0 ? 'up' : 'down') : null);
	let windDir = $derived(windValue !== null ? (windValue >= 0 ? 'left' : 'right') : null);

	// Trajectory info
	let flightTime = $derived(point ? Math.round(point.time * 100) / 100 : null);
	let energy = $derived.by(() => {
		if (!point) return null;
		const isMetric = scopeView.range.unit === 'm';
		return isMetric
			? { value: Math.round(point.energy.In(Unit.Joule)), unit: m.unit_j() }
			: { value: Math.round(point.energy.In(Unit.FootPound)), unit: m.unit_ft_lb() };
	});
	let terminalVel = $derived.by(() => {
		if (!point) return null;
		const isMetric = scopeView.range.unit === 'm';
		return isMetric
			? { value: Math.round(point.velocity.In(Unit.MPS)), unit: m.unit_mps() }
			: { value: Math.round(point.velocity.In(Unit.FPS)), unit: m.unit_fps() };
	});

</script>

<svelte:head>
	<title>{m.scope_view_title()} — {m.app_name()}</title>
</svelte:head>


<!-- ── Main grid ─────────────────────────────────────────────────── -->
<div class="grid grid-cols-1 sm:grid-cols-2 gap-4">

	<!-- ═══ LEFT: Conditions ════════════════════════════════════════ -->
	<div class="space-y-4">
		<div class="card preset-filled-surface-100-900 p-4 space-y-4">
			<!-- Target distance -->
			<DistanceInput
				label={m.scope_view_range()}
				value={scopeView.range.distance}
				unit={scopeView.range.unit}
				onchange={(v) => scopeView.setRange({ distance: v })}
				onunitchange={(u) => scopeView.setRange({ unit: u })}
			/>

			<!-- Elevation angle -->
			<div class="space-y-1.5">
				<button
					type="button"
					class="flex items-center gap-2 w-full text-left"
					onclick={() => (showElevation = !showElevation)}
				>
					{#if showElevation}
						<ChevronDown class="size-4 text-surface-500-400 shrink-0" />
					{:else}
						<ChevronRight class="size-4 text-surface-500-400 shrink-0" />
					{/if}
					<span class="text-sm font-medium">{m.scope_view_angle()}</span>
				</button>
				{#if showElevation}
					<div class="input !flex !items-center gap-2">
						<input
							class="flex-1 min-w-0 bg-transparent border-none outline-none shadow-none p-0"
							type="text"
							inputmode="decimal"
							placeholder="0"
							value={scopeView.elevation.angle}
							oninput={(e) => scopeView.setElevation({ angle: e.target.value })}
						/>
						<div class="flex items-center gap-1 shrink-0">
							{#each [{ value: 'deg', label: m.unit_deg() }, { value: 'cos', label: m.unit_cos() }] as opt}
								<button
									type="button"
									class="chip text-xs {scopeView.elevation.unit === opt.value
										? 'preset-filled-primary-500'
										: 'preset-tonal-surface'}"
									onclick={() => scopeView.setElevation({ unit: opt.value })}
								>
									{opt.label}
								</button>
							{/each}
						</div>
					</div>
					<p class="text-xs text-surface-500-400">{m.scope_view_angle_hint()}</p>
				{/if}
			</div>

			<!-- Wind -->
			<WindInput
				speed={scopeView.wind.speed}
				speedUnit={scopeView.wind.speedUnit}
				direction={scopeView.wind.direction}
				onchange={(patch) => scopeView.setWind(patch)}
			/>
		</div>

		<!-- Atmosphere -->
		<AtmosphereCard
			atmosphere={scopeView.atmosphere}
			onchange={(patch) => scopeView.setAtmosphere(patch)}
		/>
	</div>

	<!-- ═══ RIGHT: Adjustments + Reticle ═══════════════════════════ -->
	<div class="space-y-4">
		<div class="card preset-filled-surface-100-900 p-4 space-y-4">
			<h2 class="h5 border-b border-surface-200-800 pb-2">{m.scope_view_adjustments()}</h2>

			{#if !activeProfile.profile}
				<!-- No active profile -->
				<div class="py-6 text-center space-y-2">
					<p class="text-surface-500-400 text-sm">{m.scope_view_no_profile()}</p>
					<a href="/profiles" class="btn btn-sm preset-tonal-primary">
						{m.nav_profiles()}
					</a>
				</div>

			{:else if point === null}
				<!-- Profile present but calculation failed -->
				<div class="py-6 text-center">
					<p class="text-warning-500 text-sm">{m.scope_view_no_valid_result()}</p>
				</div>

			{:else}
				<!-- ── Elevation result ───────────────────────────── -->
				<div class="flex items-center gap-3 py-2">
					<div class="p-2 rounded-lg {elevDir === 'up' ? 'preset-tonal-primary' : 'preset-tonal-secondary'}">
						{#if elevDir === 'up'}
							<ArrowUp class="size-5" />
						{:else}
							<ArrowDown class="size-5" />
						{/if}
					</div>
					<div class="flex-1">
						<p class="text-xs text-surface-500-400 uppercase tracking-wide">{m.scope_view_elevation()}</p>
						<p class="font-bold text-2xl leading-tight">
							{elevClicks}
							<span class="text-base font-normal text-surface-500-400">
								{elevClicks === 1 ? m.scope_view_click() : m.scope_view_clicks()}
							</span>
						</p>
						<p class="text-sm text-surface-500-400">
							{Math.abs(elevValue ?? 0)} {elevUnit}
						</p>
					</div>
					<span class="text-sm font-semibold uppercase {elevDir === 'up' ? 'text-primary-500' : 'text-secondary-500'}">
						{elevDir === 'up' ? m.scope_view_up() : m.scope_view_down()}
					</span>
				</div>

				<!-- ── Windage result ─────────────────────────────── -->
				<div class="flex items-center gap-3 py-2">
					<div class="p-2 rounded-lg {windDir === 'left' ? 'preset-tonal-tertiary' : 'preset-tonal-warning'}">
						{#if windDir === 'left'}
							<ArrowLeft class="size-5" />
						{:else}
							<ArrowRight class="size-5" />
						{/if}
					</div>
					<div class="flex-1">
						<p class="text-xs text-surface-500-400 uppercase tracking-wide">{m.scope_view_windage()}</p>
						<p class="font-bold text-2xl leading-tight">
							{windClicks}
							<span class="text-base font-normal text-surface-500-400">
								{windClicks === 1 ? m.scope_view_click() : m.scope_view_clicks()}
							</span>
						</p>
						<p class="text-sm text-surface-500-400">
							{Math.abs(windValue ?? 0)} {windUnit}
						</p>
					</div>
					<span class="text-sm font-semibold uppercase {windDir === 'left' ? 'text-tertiary-500' : 'text-warning-500'}">
						{windDir === 'left' ? m.scope_view_left() : m.scope_view_right()}
					</span>
				</div>

				<!-- ── Trajectory info ────────────────────────────── -->
				<div class="border-t border-surface-200-800 pt-4 grid grid-cols-3 gap-3 text-center">
					<div>
						<div class="flex justify-center mb-1">
							<Timer class="size-4 text-surface-500-400" />
						</div>
						<p class="text-xs text-surface-500-400">{m.scope_view_flight_time()}</p>
						<p class="font-semibold">{flightTime}<span class="text-xs font-normal text-surface-500-400 ml-0.5">{m.unit_s()}</span></p>
					</div>
					<div>
						<div class="flex justify-center mb-1">
							<Zap class="size-4 text-surface-500-400" />
						</div>
						<p class="text-xs text-surface-500-400">{m.scope_view_energy()}</p>
						<p class="font-semibold">{energy?.value}<span class="text-xs font-normal text-surface-500-400 ml-0.5">{energy?.unit}</span></p>
					</div>
					<div>
						<div class="flex justify-center mb-1">
							<ArrowRight class="size-4 text-surface-500-400" />
						</div>
						<p class="text-xs text-surface-500-400">{m.scope_view_terminal_velocity()}</p>
						<p class="font-semibold">{terminalVel?.value}<span class="text-xs font-normal text-surface-500-400 ml-0.5">{terminalVel?.unit}</span></p>
					</div>
				</div>
			{/if}

			</div>

		<!-- ── Scope Reticle ─────────────────────────────────────── -->
		<ScopeReticle point={cantedPoint} />
	</div>
</div>
