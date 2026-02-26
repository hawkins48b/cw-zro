<script>
	import { m } from '$lib/paraglide/messages.js';
	import {
		ArrowUp,
		ArrowDown,
		ArrowLeft,
		ArrowRight,
		Link,
		Link2Off,
		Timer,
		Zap,
		ChevronDown,
		ChevronRight
	} from '@lucide/svelte';

	let showElevation = $state(false);
	import DistanceInput from '$lib/components/DistanceInput.svelte';
	import WindInput from '$lib/components/WindInput.svelte';
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

	let elevValue = $derived(getElevationValue(point, scopeView.adjustments.elevation));
	let windValue = $derived(getWindageValue(point, scopeView.adjustments.windage));

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

	// ── Adjustment unit options ──────────────────────────────────────
	const adjUnits = [
		{ value: 'MOA', label: 'MOA' },
		{ value: 'MRAD', label: 'MRAD' },
		{ value: 'IN', label: m.unit_in() },
		{ value: 'FT', label: m.unit_ft() },
		{ value: 'CM', label: m.unit_cm() },
		{ value: 'M', label: m.unit_m() }
	];
</script>

<svelte:head>
	<title>{m.scope_view_title()} — {m.app_name()}</title>
</svelte:head>

<!-- Page header (desktop only) -->
<header class="space-y-2 mb-6 hidden sm:block">
	<h1 class="h1">{m.scope_view_title()}</h1>
	<p class="text-surface-500">{m.scope_view_subtitle()}</p>
</header>

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
		<div class="card preset-filled-surface-100-900 p-4 space-y-4">
			<div class="border-b border-surface-200-800 pb-2">
				<label class="flex items-center gap-2 cursor-pointer select-none">
					<input
						type="checkbox"
						class="checkbox"
						checked={scopeView.atmosphere.useISA}
						onchange={(e) => scopeView.setAtmosphere({ useISA: e.target.checked })}
					/>
					<span class="text-sm">{m.scope_view_use_isa()}</span>
				</label>
			</div>

			{#if !scopeView.atmosphere.useISA}
				<!-- Altitude -->
				<div class="space-y-1.5">
					<span class="text-sm font-medium">{m.scope_view_altitude()}</span>
					<div class="input !flex !items-center gap-2">
						<input
							class="flex-1 min-w-0 bg-transparent border-none outline-none shadow-none p-0"
							type="text"
							inputmode="decimal"
							value={scopeView.atmosphere.altitude}
							oninput={(e) => scopeView.setAtmosphere({ altitude: e.target.value })}
						/>
						<div class="flex items-center gap-1 shrink-0">
							{#each [{ value: 'ft', label: m.unit_ft() }, { value: 'm', label: m.unit_m() }] as opt}
								<button
									type="button"
									class="chip text-xs {scopeView.atmosphere.altitudeUnit === opt.value
										? 'preset-filled-primary-500'
										: 'preset-tonal-surface'}"
									onclick={() => scopeView.setAtmosphere({ altitudeUnit: opt.value })}
								>
									{opt.label}
								</button>
							{/each}
						</div>
					</div>
				</div>

				<!-- Pressure -->
				<div class="space-y-1.5">
					<span class="text-sm font-medium">{m.scope_view_pressure()}</span>
					<div class="input !flex !items-center gap-2">
						<input
							class="flex-1 min-w-0 bg-transparent border-none outline-none shadow-none p-0"
							type="text"
							inputmode="decimal"
							value={scopeView.atmosphere.pressure}
							oninput={(e) => scopeView.setAtmosphere({ pressure: e.target.value })}
						/>
						<div class="flex items-center gap-1 shrink-0">
							{#each [{ value: 'inhg', label: m.unit_inhg() }, { value: 'hpa', label: m.unit_hpa() }] as opt}
								<button
									type="button"
									class="chip text-xs {scopeView.atmosphere.pressureUnit === opt.value
										? 'preset-filled-primary-500'
										: 'preset-tonal-surface'}"
									onclick={() => scopeView.setAtmosphere({ pressureUnit: opt.value })}
								>
									{opt.label}
								</button>
							{/each}
						</div>
					</div>
				</div>

				<!-- Temperature -->
				<div class="space-y-1.5">
					<span class="text-sm font-medium">{m.scope_view_atmo_temp()}</span>
					<div class="input !flex !items-center gap-2">
						<input
							class="flex-1 min-w-0 bg-transparent border-none outline-none shadow-none p-0"
							type="text"
							inputmode="decimal"
							value={scopeView.atmosphere.temperature}
							oninput={(e) => scopeView.setAtmosphere({ temperature: e.target.value })}
						/>
						<div class="flex items-center gap-1 shrink-0">
							{#each [{ value: 'f', label: m.unit_f() }, { value: 'c', label: m.unit_c() }] as opt}
								<button
									type="button"
									class="chip text-xs {scopeView.atmosphere.temperatureUnit === opt.value
										? 'preset-filled-primary-500'
										: 'preset-tonal-surface'}"
									onclick={() => scopeView.setAtmosphere({ temperatureUnit: opt.value })}
								>
									{opt.label}
								</button>
							{/each}
						</div>
					</div>
				</div>

				<!-- Humidity -->
				<div class="space-y-1.5">
					<span class="text-sm font-medium">{m.scope_view_humidity()}</span>
					<div class="input !flex !items-center gap-2">
						<input
							class="flex-1 min-w-0 bg-transparent border-none outline-none shadow-none p-0"
							type="text"
							inputmode="decimal"
							value={scopeView.atmosphere.humidity}
							oninput={(e) => scopeView.setAtmosphere({ humidity: e.target.value })}
						/>
						<span class="text-surface-500 text-sm select-none shrink-0">%</span>
					</div>
				</div>
			{:else}
				<p class="text-sm text-surface-500-400">
					ICAO — 0 {m.unit_ft()}, 29.92 {m.unit_inhg()}, 59 {m.unit_f()}, 78%
				</p>
			{/if}
		</div>
	</div>

	<!-- ═══ RIGHT: Adjustments ══════════════════════════════════════ -->
	<div>
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
							{Math.abs(elevValue ?? 0)}
							<span class="text-base font-normal text-surface-500-400">
								{scopeView.adjustments.elevation}
							</span>
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
							{Math.abs(windValue ?? 0)}
							<span class="text-base font-normal text-surface-500-400">
								{scopeView.adjustments.windage}
							</span>
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

			<!-- ── Unit selectors ─────────────────────────────────── -->
			<div class="border-t border-surface-200-800 pt-4 flex items-center gap-2">
				<!-- Elevation unit -->
				<div class="flex-1">
					<p class="text-xs text-surface-500-400 mb-1">{m.scope_view_elevation()}</p>
					<select
						class="select text-sm"
						value={scopeView.adjustments.elevation}
						onchange={(e) => scopeView.setAdjustments({ elevation: e.target.value })}
					>
						{#each adjUnits as u}
							<option value={u.value}>{u.label}</option>
						{/each}
					</select>
				</div>

				<!-- Link toggle -->
				<div class="mt-4">
					<button
						type="button"
						class="btn btn-icon {scopeView.adjustments.link
							? 'preset-filled-primary-500'
							: 'preset-tonal-surface'}"
						title={m.scope_view_link_units()}
						onclick={() => scopeView.setAdjustments({ link: !scopeView.adjustments.link })}
					>
						{#if scopeView.adjustments.link}
							<Link class="size-4" />
						{:else}
							<Link2Off class="size-4" />
						{/if}
					</button>
				</div>

				<!-- Windage unit -->
				<div class="flex-1">
					<p class="text-xs text-surface-500-400 mb-1">{m.scope_view_windage()}</p>
					<select
						class="select text-sm"
						value={scopeView.adjustments.windage}
						onchange={(e) => scopeView.setAdjustments({ windage: e.target.value })}
					>
						{#each adjUnits as u}
							<option value={u.value}>{u.label}</option>
						{/each}
					</select>
				</div>
			</div>
		</div>
	</div>
</div>
