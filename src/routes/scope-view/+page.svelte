<script>
	import { m } from '#lib/paraglide/messages.js';
	import { localizeHref } from '#lib/paraglide/runtime.js';
	import DistanceInput from '#lib/components/DistanceInput.svelte';
	import ScopeWindCard from '#lib/components/ScopeWindCard.svelte';
	import ScopeAtmosphereCard from '#lib/components/ScopeAtmosphereCard.svelte';
	import { useCurrentWeather } from '#lib/components/currentWeather.svelte.js';
	import ScopeResult from '#lib/components/ScopeResult.svelte';
	import ScopeReticle from '#lib/components/ScopeReticle.svelte';
	import ElevationAngleCard from '#lib/components/ElevationAngleCard.svelte';
	import ProfileInUseChip from '#lib/components/ProfileInUseChip.svelte';
	import { MediaQuery } from 'svelte/reactivity';
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
	import { isUsableScopeRange, scopeEffectiveRange } from '#lib/utils/scopeRange.js';
	import { formatLimit, formatNumber } from '#lib/utils/format.js';
	import {
		formatUsedAtmosphere,
		scopeAtmosphereParams,
		usedScopeAtmosphere
	} from '#lib/utils/scopeAtmosphere.js';
	import { shownProfile } from '#lib/utils/storedProfiles.js';

	// Tablet, between the phone tab bar and the desktop sidebar (sm to lg in +layout.svelte): the
	// result shows the dial and the hold together (TabletScope board, #166).
	const tablet = new MediaQuery('(min-width: 40rem) and (max-width: 63.98rem)', false);

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
	sm and up: inputs on the left, the result on the right, sticky in the scrolling <main>. Tablet
	(sm to lg, TabletScope board): two equal columns, and the result shows the dial and the hold at
	once. Desktop (lg, ScopeDesktop board): title and intro, inputs a little wider than the result,
	which keeps its Dial / Hold switch. The elevation angle is its own card at every width (#166).
-->
<div class="flex flex-col gap-3 sm:gap-4 lg:gap-5">
	<header class="flex flex-wrap items-center gap-x-4 gap-y-3">
		<div class="max-sm:contents flex-[1_1_320px] min-w-0">
			<!-- Below lg the app header already shows the title -->
			<h1 class="sr-only lg:not-sr-only lg:text-[28px] lg:font-bold lg:tracking-tight">{m.scope_view_title()}</h1>
			<p class="hidden lg:block lg:mt-1 text-sm text-surface-600-400">{m.scope_view_intro()}</p>
		</div>
		<!-- 1 · Profile in use: Change opens the picker in place (#166) -->
		<div class="flex-1 min-w-0 sm:hidden">
			<ProfileInUseChip />
		</div>
		<div class="hidden sm:block max-w-full sm:ml-auto">
			<ProfileInUseChip variant="compact" />
		</div>
	</header>

	<div
		class="grid grid-cols-1 gap-3 sm:grid-cols-2 sm:gap-5 sm:items-start lg:grid-cols-[minmax(0,6fr)_minmax(0,5fr)]"
	>
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
		<div class="sm:col-start-2 sm:row-start-1 sm:row-span-4 sm:sticky sm:top-4">
			<ScopeResult
				{status}
				distance={rangeUsable ? String(scopeView.range.distance).trim() : null}
				unitLabel={distLabel}
				mode={scopeView.resultMode}
				onmodechange={(mode) => scopeView.setResultMode(mode)}
				both={tablet.current}
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
		<div class="sm:col-start-1 min-w-0">
			<ScopeWindCard
				speed={scopeView.wind.speed}
				speedUnit={scopeView.wind.speedUnit}
				direction={scopeView.wind.direction}
				preset={scopeView.windPreset}
				onchange={(patch) => scopeView.setWind(patch)}
				onpreset={(preset) => scopeView.applyWindPreset(preset)}
			/>
		</div>

		<!-- 5 · Elevation angle, always shown, its own card; deg / cos inside the box (#166, shared with Ballistic #173) -->
		<div class="sm:col-start-1 min-w-0">
			<ElevationAngleCard
				angle={scopeView.elevation.angle}
				unit={scopeView.elevation.unit}
				onchange={(patch) => scopeView.setElevation(patch)}
			/>
		</div>

		<!-- 6 · Atmosphere -->
		<div class="sm:col-start-1 min-w-0">
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
</div>
