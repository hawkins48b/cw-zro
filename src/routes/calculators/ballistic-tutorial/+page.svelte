<script>
	/**
	 * 3D ballistic tutorial (#182, epic #180). Step 1: profile, CPU/GPU warning, WebGL check. Step 2:
	 * the scene, its settings and the tutorial player.
	 *
	 * Never import three.js, or #lib/tutorial/scene.js, at the top of this file: the scene module is
	 * loaded with `await import(...)` once step 2 mounts, so that no other route's chunk includes it.
	 * The mobile build has no tutorial (#182, owner decision of 2026-11-17): `__MOBILE_BUILD__` is
	 * true there, the import is dead code and is left out of the bundle, and the page only says so.
	 *
	 * The page keeps its own state (store zro-ballistic-tutorial, owner decision of 2026-11-17). The
	 * trajectory is the Ballistic page's (utils/tutorialPath.js); the scene only draws it.
	 */
	import { untrack } from 'svelte';
	import { MonitorOff } from '@lucide/svelte';
	import { m } from '#lib/paraglide/messages.js';
	import { activeProfile } from '#lib/stores/activeProfile.svelte.js';
	import { ballisticTutorial } from '#lib/stores/ballisticTutorial.svelte.js';
	import { shownProfile } from '#lib/utils/storedProfiles.js';
	import { hasNoAirDensity } from '#lib/utils/ballisticCalculator.js';
	import { formatLimit, formatNumber } from '#lib/utils/format.js';
	import { MAX_DISTANCE, altitudeLimits, targetElevationLimits } from '#lib/utils/inputLimits.js';
	import {
		formatUsedAtmosphere,
		scopeAtmosphereParams,
		usedScopeAtmosphere
	} from '#lib/utils/scopeAtmosphere.js';
	import { tutorialTrajectory } from '#lib/utils/tutorialPath.js';
	import { HOLO_FOV_DEG, SCOPE_HALF_VIEW_MRAD } from '#lib/utils/tutorialScene.js';
	import { hasWebGL } from '#lib/utils/webgl.js';
	import { isTutorialAvailable } from '#lib/utils/tutorialAvailability.js';
	import { TUTORIALS, findTutorial } from '#lib/tutorial/registry.js';
	import { useCurrentWeather } from '#lib/components/currentWeather.svelte.js';
	import ProfileInUseChip from '#lib/components/ProfileInUseChip.svelte';
	import ScopeWindCard from '#lib/components/ScopeWindCard.svelte';
	import ScopeAtmosphereCard from '#lib/components/ScopeAtmosphereCard.svelte';
	import TutorialIntro from '#lib/components/tutorial/TutorialIntro.svelte';
	import TutorialScene from '#lib/components/tutorial/TutorialScene.svelte';
	import TutorialRangeCard from '#lib/components/tutorial/TutorialRangeCard.svelte';
	import TutorialDisplayCard from '#lib/components/tutorial/TutorialDisplayCard.svelte';
	import TutorialPlayer from '#lib/components/tutorial/TutorialPlayer.svelte';

	/** Not in the Capacitor apps (#182): the page then shows a message and nothing else. */
	const available = isTutorialAvailable();

	// ── Steps ─────────────────────────────────────────────────────────
	// Every visit starts on step 1, so the heavy scene never starts unasked.
	let step = $state(1);

	/** @type {'checking'|'ok'|'missing'} */
	let webgl = $state('checking');
	$effect(() => {
		if (available) webgl = hasWebGL() ? 'ok' : 'missing';
	});

	let shown = $derived(shownProfile(activeProfile.profile));
	let reticleType = $derived(shown?.reticleType ?? 'red-dot');
	/** red-dot → holographic sight; mil-dot, mrad, moa → riflescope (#180). */
	let optic = $derived(reticleType === 'red-dot' ? 'holo' : 'scope');

	// ── Atmosphere, as on the Scope View and the Ballistic page ───────
	let atmosphere = $derived(ballisticTutorial.atmosphere);
	const weather = useCurrentWeather(ballisticTutorial);
	let atmoParams = $derived(scopeAtmosphereParams(atmosphere));
	let atmosphereUsed = $derived(
		formatUsedAtmosphere(usedScopeAtmosphere(atmosphere), {
			number: formatNumber,
			units: { hpa: m.unit_hpa(), inhg: m.unit_inhg(), c: m.unit_c(), f: m.unit_f() }
		})
	);
	let noAirDensity = $derived(hasNoAirDensity(atmoParams));

	// ── Trajectory (utils/tutorialPath.js) ────────────────────────────
	// Keyed on the values, so a change of weather or quality (same store) neither runs the engine
	// again nor clears the shot. The stored values are JSON, so the round trip keeps them as they are.
	let inputsKey = $derived(
		JSON.stringify([ballisticTutorial.range, ballisticTutorial.terrain, ballisticTutorial.storedWind ?? null, atmoParams])
	);
	let trajectory = $derived.by(() => {
		const [range, terrain, wind, atmo] = JSON.parse(inputsKey);
		const report = {};
		const result = tutorialTrajectory(activeProfile.profile, range, terrain, atmo, wind, { report });
		return { ...result, altitudeTooLow: !result.path && !!atmo && !!report.minimumAltitude };
	});
	let geometry = $derived(trajectory.geometry);
	let path = $derived(trajectory.path);
	let altitudeTooLow = $derived(trajectory.altitudeTooLow);

	// ── Range card messages ───────────────────────────────────────────
	let range = $derived(ballisticTutorial.range);
	let terrain = $derived(ballisticTutorial.terrain);
	let distLabel = $derived(range.unit === 'm' ? m.unit_m() : m.unit_yd());
	let heightLabel = $derived(terrain.unit === 'm' ? m.unit_m() : m.unit_ft());
	const limitMessage = (limits, unit) =>
		m.validation_range({ min: formatLimit(limits.min), max: formatLimit(limits.max), unit });
	let distanceError = $derived(
		geometry.error === 'distance' ? m.validation_range_above_zero({ max: formatLimit(MAX_DISTANCE), unit: distLabel }) : ''
	);
	let elevationError = $derived(
		geometry.error === 'elevation'
			? limitMessage(targetElevationLimits(terrain.unit), heightLabel)
			: geometry.error === 'steep'
				? m.tutorial_elevation_steep()
				: ''
	);
	let altitudeError = $derived(geometry.altitudeError ? limitMessage(altitudeLimits(terrain.unit), heightLabel) : '');
	const round1 = (v) => Math.round(v * 10) / 10;
	let slopeText = $derived(
		geometry.error === null && round1(geometry.slopeDeg) !== 0 ? `${formatNumber(round1(geometry.slopeDeg))}°` : ''
	);

	// ── Scene ─────────────────────────────────────────────────────────
	/** @type {HTMLDivElement|null} */
	let sceneEl = $state(null);
	/** @type {'loading'|'ready'|'error'|'lost'} */
	let sceneStatus = $state('loading');
	/** @type {'shooter'|'optic'|'side'|'target'|null} */
	let camera = $state('shooter');
	let firing = $state(false);
	/** Whether the shot on screen is from the current path: the overlay then shows its values. */
	let shotShown = $state(false);
	let canFire = $derived(!!path);

	/** @type {Awaited<ReturnType<typeof import('#lib/tutorial/scene.js').createTutorialScene>> | null} */
	let sceneApi = null;
	/** Bumped on every start and stop, so a scene that finishes loading after the page moved on is freed. */
	let sceneRun = 0;

	let sceneSettings = $derived({
		optic,
		geometry,
		path,
		wind: ballisticTutorial.wind,
		weather: ballisticTutorial.weather,
		quality: ballisticTutorial.quality
	});

	async function startScene() {
		const run = ++sceneRun;
		sceneStatus = 'loading';
		camera = 'shooter';
		// The mobile build never gets here (available is false); the constant also makes the import
		// below dead code there, so its bundle has no three.js.
		if (__MOBILE_BUILD__) return;
		try {
			const { createTutorialScene } = await import('#lib/tutorial/scene.js');
			if (run !== sceneRun || !sceneEl) return;
			const api = await createTutorialScene(sceneEl, untrack(() => sceneSettings), {
				onorbit: () => (camera = null),
				onlost: () => {
					if (run === sceneRun) sceneStatus = 'lost';
				}
			});
			if (run !== sceneRun) {
				api?.dispose();
				return;
			}
			sceneApi = api;
			sceneStatus = 'ready';
		} catch (e) {
			console.error('3D scene error:', e);
			if (run === sceneRun) sceneStatus = 'error';
		}
	}

	function stopScene() {
		sceneRun++;
		sceneApi?.dispose();
		sceneApi = null;
		firing = false;
		shotShown = false;
	}

	// Start the scene when step 2 has its container; free it when leaving the page.
	$effect(() => {
		if (!available || step !== 2 || !sceneEl) return;
		untrack(startScene);
		return stopScene;
	});

	// Hand every settings change to the scene: it rebuilds only what changed.
	$effect(() => {
		if (step !== 2) return;
		const settings = sceneSettings;
		if (sceneStatus === 'ready') sceneApi?.update(settings);
	});

	// A new path makes the shot on screen old.
	$effect(() => {
		path;
		untrack(() => (shotShown = false));
	});

	function restartScene() {
		stopScene();
		startScene();
	}

	function chooseCamera(preset) {
		camera = preset;
		sceneApi?.setCamera(preset);
	}

	let fireRun = 0;
	async function fire() {
		if (!sceneApi || !path) return;
		const run = ++fireRun;
		const fired = path;
		firing = true;
		shotShown = false;
		await sceneApi.fire();
		if (run !== fireRun) return;
		firing = false;
		// A settings change during the flight clears the shot: its values are then old.
		shotShown = sceneApi !== null && path === fired;
	}

	/** The reticle over the scene through the optic, in the optic's field of view. */
	let reticle = $derived(
		camera === 'optic'
			? {
					type: reticleType,
					halfView: optic === 'scope' ? SCOPE_HALF_VIEW_MRAD : Math.tan(((HOLO_FOV_DEG / 2) * Math.PI) / 180) * 1000
				}
			: null
	);

	// ── Values over the scene ─────────────────────────────────────────
	let distanceText = $derived(geometry.error === 'distance' ? '' : `${formatNumber(geometry.distance)} ${distLabel}`);
	const unitText = (unit) => (unit === 'cm' ? m.unit_cm() : m.unit_in());

	/** One overlay line per value id (registry STEP_VALUES), or null when it has no value now. */
	function valueLine(id) {
		switch (id) {
			case 'distance':
				return distanceText ? { id, label: m.tutorial_value_distance(), value: distanceText } : null;
			case 'slope':
				return geometry.error === null ? { id, label: m.tutorial_value_slope(), value: `${formatNumber(round1(geometry.slopeDeg))}°` } : null;
			case 'wind': {
				const wind = ballisticTutorial.wind;
				const speed = `${wind.speed || '0'} ${wind.speedUnit === 'mps' ? m.unit_mps() : m.unit_mph()}`;
				return { id, label: m.tutorial_value_wind(), value: m.tutorial_value_wind_from({ speed, direction: String(wind.direction || '0') }) };
			}
			case 'drop':
				return path ? { id, label: m.tutorial_value_drop_at({ distance: distanceText }), value: `${formatNumber(path.drop.value)} ${unitText(path.drop.unit)}` } : null;
			case 'windage':
				return path ? { id, label: m.tutorial_value_windage_at({ distance: distanceText }), value: `${formatNumber(path.windage.value)} ${unitText(path.windage.unit)}` } : null;
			case 'time':
				return path ? { id, label: m.tutorial_value_time(), value: `${formatNumber(Math.round(path.time * 100) / 100)} ${m.unit_s()}` } : null;
			default:
				return null;
		}
	}

	// ── Tutorial player ───────────────────────────────────────────────
	let tutorials = $derived(
		TUTORIALS.map((t) => ({ id: t.id, title: m[t.titleKey](), description: m[t.descKey](), stepCount: t.steps.length }))
	);
	/** @type {{ id: string, index: number } | null} */
	let running = $state(null);
	let runningTutorial = $derived(running ? findTutorial(running.id) : null);
	let runningStep = $derived(runningTutorial && running ? runningTutorial.steps[running.index] : null);
	let current = $derived(
		runningTutorial && runningStep && running
			? {
					title: m[runningTutorial.titleKey](),
					index: running.index,
					count: runningTutorial.steps.length,
					stepTitle: m[runningStep.titleKey](),
					text: m[runningStep.textKey]()
				}
			: null
	);

	/** The overlay: the step's values in a tutorial, else the drop and drift of the last shot. */
	let overlay = $derived.by(() => {
		const ids = runningStep ? (runningStep.values ?? []) : shotShown ? ['drop', 'windage'] : [];
		return ids.map(valueLine).filter((line) => line !== null);
	});

	/** Run a step: camera, highlight, action. */
	function applyStep() {
		const s = runningStep;
		if (!s || !sceneApi) return;
		if (s.camera) chooseCamera(s.camera);
		else if (s.pose) {
			camera = null;
			sceneApi.setPose(s.pose);
		}
		sceneApi.highlight(s.highlight ?? null);
		if (s.action === 'fire') fire();
	}

	function startTutorial(id) {
		if (!findTutorial(id)) return;
		running = { id, index: 0 };
		applyStep();
	}
	function nextStep() {
		if (!current || !running) return;
		if (current.index >= current.count - 1) exitTutorial();
		else {
			running = { ...running, index: running.index + 1 };
			applyStep();
		}
	}
	function previousStep() {
		if (running && running.index > 0) {
			running = { ...running, index: running.index - 1 };
			applyStep();
		}
	}
	function exitTutorial() {
		running = null;
		sceneApi?.highlight(null);
	}
</script>

<svelte:head>
	<title>{m.tutorial_title()} — {m.app_name()}</title>
</svelte:head>

{#if !available}
	<div class="flex flex-col gap-3 sm:gap-4 lg:gap-5">
		<h1 class="sr-only lg:not-sr-only lg:text-[28px] lg:font-bold lg:tracking-tight">{m.tutorial_title()}</h1>
		<div
			role="status"
			class="flex gap-2.5 px-3.5 py-3 rounded-container border border-surface-200-800 preset-filled-surface-100-900"
		>
			<MonitorOff class="size-5 mt-px shrink-0 text-surface-600-400" aria-hidden="true" />
			<div class="space-y-1">
				<p class="text-sm font-semibold">{m.tutorial_mobile_unavailable_title()}</p>
				<p class="text-[13px] leading-relaxed text-surface-600-400">{m.tutorial_mobile_unavailable_text()}</p>
			</div>
		</div>
	</div>
{:else if step === 1}
	<TutorialIntro {webgl} profile={shown} oncontinue={() => (step = 2)} />
{:else}
	<!--
		Phone and tablet: one column (header, scene, player, range, wind, atmosphere, scene settings).
		Desktop (lg): the scene on the left, kept in view while the right column scrolls.
	-->
	<div class="flex flex-col gap-3 sm:gap-4 lg:gap-5">
		<header class="flex flex-wrap items-center gap-x-4 gap-y-3">
			<div class="max-sm:contents flex-[1_1_320px] min-w-0">
				<!-- Below lg the app header already shows the title -->
				<h1 class="sr-only lg:not-sr-only lg:text-[28px] lg:font-bold lg:tracking-tight">{m.tutorial_title()}</h1>
				<p class="hidden lg:block lg:mt-1 text-sm text-surface-600-400">{m.tutorial_intro()}</p>
			</div>
			<div class="flex-1 min-w-0 sm:hidden">
				<ProfileInUseChip />
			</div>
			<div class="hidden sm:block max-w-full sm:ml-auto">
				<ProfileInUseChip variant="compact" />
			</div>
		</header>

		<div class="grid grid-cols-1 gap-3 sm:gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(320px,380px)] lg:gap-5 lg:items-start">
			<div class="min-w-0 lg:sticky lg:top-4">
				<TutorialScene
					bind:container={sceneEl}
					status={sceneStatus}
					values={overlay}
					{camera}
					oncamera={chooseCamera}
					{firing}
					{canFire}
					onfire={fire}
					onrestart={restartScene}
					{reticle}
				/>
			</div>

			<div class="flex flex-col gap-3 sm:gap-4 min-w-0">
				<TutorialPlayer
					{tutorials}
					{current}
					disabled={sceneStatus !== 'ready'}
					onstart={startTutorial}
					onnext={nextStep}
					onback={previousStep}
					onexit={exitTutorial}
				/>

				<TutorialRangeCard
					{range}
					{terrain}
					onrangechange={(patch) => ballisticTutorial.setRange(patch)}
					onterrainchange={(patch) => ballisticTutorial.setTerrain(patch)}
					{distanceError}
					{altitudeError}
					{elevationError}
					slope={slopeText}
				/>

				<div class="min-w-0">
					<ScopeWindCard
						speed={ballisticTutorial.wind.speed}
						speedUnit={ballisticTutorial.wind.speedUnit}
						direction={ballisticTutorial.wind.direction}
						preset={ballisticTutorial.windPreset}
						onchange={(patch) => ballisticTutorial.setWind(patch)}
						onpreset={(preset) => ballisticTutorial.applyWindPreset(preset)}
					/>
				</div>

				<div class="min-w-0">
					<ScopeAtmosphereCard
						{atmosphere}
						used={atmosphereUsed}
						{altitudeTooLow}
						{noAirDensity}
						onchange={weather.onchange}
						weatherAvailable={weather.available}
						weatherStatus={weather.status}
						onweather={weather.request}
					/>
				</div>

				<TutorialDisplayCard
					weather={ballisticTutorial.weather}
					quality={ballisticTutorial.quality}
					onchange={(patch) => {
						if (patch.weather !== undefined) ballisticTutorial.setWeather(patch.weather);
						if (patch.quality !== undefined) ballisticTutorial.setQuality(patch.quality);
					}}
				/>
			</div>
		</div>
	</div>
{/if}
