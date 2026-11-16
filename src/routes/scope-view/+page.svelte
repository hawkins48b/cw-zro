<script>
	import { m } from '#lib/paraglide/messages.js';
	import { localizeHref } from '#lib/paraglide/runtime.js';
	import DistanceInput from '#lib/components/DistanceInput.svelte';
	import ScopeWindCard from '#lib/components/ScopeWindCard.svelte';
	import ScopeAtmosphereCard from '#lib/components/ScopeAtmosphereCard.svelte';
	import { useCurrentWeather } from '#lib/components/currentWeather.svelte.js';
	import ScopeResult from '#lib/components/ScopeResult.svelte';
	import ScopeReticle from '#lib/components/ScopeReticle.svelte';
	import ChipGroup from '#lib/components/ChipGroup.svelte';
	import { activeProfile } from '#lib/stores/activeProfile.svelte.js';
	import { scopeView } from '#lib/stores/scopeView.svelte.js';
	import {
		calculateShotPoint,
		getElevationValue,
		getWindageValue,
		hasNoAirDensity
	} from '#lib/utils/ballisticCalculator.js';
	import { Unit } from 'js-ballistics';
	import { clickCount, clickValue } from '#lib/utils/clicks.js';
	import { MAX_DISTANCE } from '#lib/utils/inputLimits.js';
	import { isUsableScopeAngle, isUsableScopeRange, scopeEffectiveRange } from '#lib/utils/scopeRange.js';
	import { formatLimit, formatNumber } from '#lib/utils/format.js';
	import {
		formatUsedAtmosphere,
		scopeAtmosphereParams,
		usedScopeAtmosphere
	} from '#lib/utils/scopeAtmosphere.js';
	import { shownProfile } from '#lib/utils/storedProfiles.js';

	const uid = $props.id();

	// ── Atmosphere (#148): ISA, Estimate or Accurate, see utils/scopeAtmosphere.js ──
	let atmosphere = $derived(scopeView.atmosphere);
	// "Use current weather here" (#152): nothing is asked or sent before a tap on the card's button.
	const weather = useCurrentWeather(scopeView);
	/** What the calculation is given: null is the standard atmosphere at sea level. */
	let atmoParams = $derived(scopeAtmosphereParams(atmosphere));
	/** What ISA and Estimate use, in the units of the boxes, for the line under the card. */
	let atmosphereUsed = $derived(
		formatUsedAtmosphere(usedScopeAtmosphere(atmosphere), {
			number: formatNumber,
			units: { hpa: m.unit_hpa(), inhg: m.unit_inhg(), c: m.unit_c(), f: m.unit_f() }
		})
	);

	// ── Derived computation ──

	// The angle box is always shown now, and the stored angle always applies (#148, owner decision of
	// 2026-11-16). Before, it was only applied while the section was open, and the section started
	// closed on every visit. An angle of 0 or an empty box gives the same result as before.
	let effectiveRange = $derived(scopeEffectiveRange(scopeView.range, scopeView.elevation));
	let rangeUsable = $derived(isUsableScopeRange(scopeView.range.distance));
	let angleUsable = $derived(isUsableScopeAngle(scopeView.elevation));
	let distLabel = $derived(scopeView.range.unit === 'm' ? m.unit_m() : m.unit_yd());

	// Whether the custom altitude is too low for this shot (#125), from the engine's stop reason.
	let shot = $derived.by(() => {
		const profile = activeProfile.profile;
		if (!profile || !effectiveRange) return { point: null, altitudeTooLow: false };
		const report = {};
		const point = calculateShotPoint(profile, effectiveRange, atmoParams, scopeView.storedWind, { report });
		return { point, altitudeTooLow: !point && !!atmoParams && report.minimumAltitude };
	});
	let point = $derived(shot.point);

	let cantedPoint = $derived.by(() => {
		if (!scopeView.rotation) return point;
		const profile = activeProfile.profile;
		if (!profile || !effectiveRange) return null;
		return calculateShotPoint(profile, effectiveRange, atmoParams, scopeView.storedWind, { cantAngle: scopeView.rotation });
	});

	// Values within their limits whose air density is not above 0 give no result (#107), checked on
	// the atmosphere actually used (Station pressure as entered, Estimate humidity).
	let noAirDensity = $derived(hasNoAirDensity(atmoParams));

	// The profile as the page shows it (#120): its click values and units can be read as text.
	let shown = $derived(shownProfile(activeProfile.profile));
	let elevUnit = $derived(shown?.elevationClickUnit ?? 'MOA');
	let windUnit = $derived(shown?.windageClickUnit ?? 'MOA');

	let elevValue = $derived(getElevationValue(point, elevUnit));
	let windValue = $derived(getWindageValue(point, windUnit));

	// Clicks as the Ballistic table counts them too (#151): utils/clicks.js.
	let elevClicks = $derived(clickCount(elevValue, clickValue(shown?.elevationClickValue)));
	let windClicks = $derived(clickCount(windValue, clickValue(shown?.windageClickValue)));

	// Direction logic (matches v1 convention)
	let elevDir = $derived(elevValue !== null ? (elevValue <= 0 ? 'up' : 'down') : null);
	let windDir = $derived(windValue !== null ? (windValue >= 0 ? 'left' : 'right') : null);

	let elevation = $derived(
		elevValue === null ? null : { dir: elevDir, clicks: elevClicks, value: elevValue, unit: elevUnit }
	);
	let windage = $derived(
		windValue === null ? null : { dir: windDir, clicks: windClicks, value: windValue, unit: windUnit }
	);

	// Trajectory info
	let trajUnit = $state(scopeView.range.unit === 'm' ? 'metric' : 'imperial');
	let flightTime = $derived(point ? Math.round(point.time * 100) / 100 : null);
	let energy = $derived.by(() => {
		if (!point) return null;
		return trajUnit === 'metric'
			? { value: Math.round(point.energy.In(Unit.Joule)), unit: m.unit_j() }
			: { value: Math.round(point.energy.In(Unit.FootPound)), unit: m.unit_ft_lb() };
	});
	let terminalVel = $derived.by(() => {
		if (!point) return null;
		return trajUnit === 'metric'
			? { value: Math.round(point.velocity.In(Unit.MPS)), unit: m.unit_mps() }
			: { value: Math.round(point.velocity.In(Unit.FPS)), unit: m.unit_fps() };
	});

	let status = $derived(!activeProfile.profile ? 'no-profile' : point === null ? 'no-result' : 'ok');
	let profilesHref = $derived(localizeHref('/profiles'));
</script>

<svelte:head>
	<title>{m.scope_view_title()} — {m.app_name()}</title>
</svelte:head>

<!--
	Phone: one column in the order of the design (profile, distance, result, wind, angle, atmosphere).
	sm and up: inputs on the left, the result on the right, sticky in the scrolling <main>.
-->
<div class="grid grid-cols-1 gap-3 sm:grid-cols-2 sm:gap-5 sm:items-start">
	<!-- 1 · Active profile -->
	<a
		href={profilesHref}
		class="sm:col-start-1 flex items-center gap-2.5 min-h-12 px-3 py-1.5 rounded-container border border-surface-200-800 preset-filled-surface-100-900 hover:border-primary-500 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary-500"
	>
		<span
			class="size-2 rounded-full shrink-0 {activeProfile.profile ? 'bg-primary-500' : 'bg-surface-400-600'}"
			aria-hidden="true"
		></span>
		<span class="flex-1 min-w-0">
			<span class="block text-[11px] text-surface-600-400">{m.scope_view_active_profile()}</span>
			<span class="block text-sm font-semibold truncate">
				{#if shown}
					{shown.name || m.scope_view_profile_unnamed()}{#if shown.ammo}<span class="font-normal text-surface-600-400"> · {shown.ammo}</span>{/if}
				{:else}
					{m.scope_view_profile_none()}
				{/if}
			</span>
		</span>
		<span class="text-sm font-semibold text-primary-700-300 shrink-0">
			{shown ? m.scope_view_profile_change() : m.scope_view_profile_choose()}
		</span>
	</a>

	<!-- 2 · Target distance -->
	<div class="sm:col-start-1">
		<DistanceInput
			label={m.scope_view_range()}
			value={scopeView.range.distance}
			unit={scopeView.range.unit}
			onchange={(v) => scopeView.setRange({ distance: v })}
			onunitchange={(u) => scopeView.setRange({ unit: u })}
			invalid={rangeUsable ? '' : m.validation_range_above_zero({ max: formatLimit(MAX_DISTANCE), unit: distLabel })}
		/>
	</div>

	<!-- 3 · Result (right column, sticky, on sm and up) -->
	<div class="sm:col-start-2 sm:row-start-1 sm:row-span-5 sm:sticky sm:top-4">
		<ScopeResult
			{status}
			distance={rangeUsable ? String(scopeView.range.distance).trim() : null}
			unitLabel={distLabel}
			mode={scopeView.resultMode}
			onmodechange={(mode) => scopeView.setResultMode(mode)}
			{profilesHref}
			{elevation}
			{windage}
			{flightTime}
			{energy}
			velocity={terminalVel}
			energyUnit={trajUnit}
			onenergyunitchange={(u) => (trajUnit = u)}
		>
			{#snippet hold()}
				<ScopeReticle point={cantedPoint} />
			{/snippet}
		</ScopeResult>
	</div>

	<!-- 4 · Wind -->
	<div class="sm:col-start-1">
		<ScopeWindCard
			speed={scopeView.wind.speed}
			speedUnit={scopeView.wind.speedUnit}
			direction={scopeView.wind.direction}
			preset={scopeView.windPreset}
			onchange={(patch) => scopeView.setWind(patch)}
			onpreset={(preset) => scopeView.applyWindPreset(preset)}
		/>
	</div>

	<!-- 5 · Elevation angle, always shown -->
	<section
		class="sm:col-start-1 card preset-filled-surface-100-900 border border-surface-200-800 px-3.5 py-3 space-y-2"
	>
		<div class="flex items-center justify-between gap-2">
			<h2 class="text-sm font-semibold">
				<label for="{uid}-angle">{m.scope_view_angle()}</label>
			</h2>
			<ChipGroup
				label={m.scope_view_angle_unit()}
				options={[
					{ value: 'deg', label: m.unit_deg() },
					{ value: 'cos', label: m.unit_cos() }
				]}
				value={scopeView.elevation.unit}
				onselect={(unit) => scopeView.setElevation({ unit })}
			/>
		</div>
		<div class="input !flex !items-center gap-2 h-11">
			<input
				id="{uid}-angle"
				class="flex-1 min-w-0 bg-transparent border-none outline-none shadow-none p-0 font-semibold"
				type="text"
				inputmode="decimal"
				autocomplete="off"
				placeholder="0"
				value={scopeView.elevation.angle}
				aria-invalid={!angleUsable}
				aria-describedby="{uid}-angle-msg"
				oninput={(e) => scopeView.setElevation({ angle: e.target.value })}
			/>
			{#if scopeView.elevation.unit === 'deg'}
				<span class="text-sm shrink-0" aria-hidden="true">°</span>
			{/if}
		</div>
		{#if angleUsable}
			<p id="{uid}-angle-msg" class="text-xs text-surface-600-400">{m.scope_view_angle_hint()}</p>
		{:else if scopeView.elevation.unit === 'deg'}
			<p id="{uid}-angle-msg" class="text-xs text-error-500" role="alert">{m.scope_view_deg_invalid()}</p>
		{:else}
			<p id="{uid}-angle-msg" class="text-xs text-error-500" role="alert">{m.scope_view_cos_invalid()}</p>
		{/if}
	</section>

	<!-- 6 · Atmosphere -->
	<div class="sm:col-start-1">
		<ScopeAtmosphereCard
			{atmosphere}
			used={atmosphereUsed}
			altitudeTooLow={shot.altitudeTooLow}
			{noAirDensity}
			onchange={weather.onchange}
			weatherAvailable={weather.available}
			weatherStatus={weather.status}
			onweather={weather.request}
		/>
	</div>
</div>
