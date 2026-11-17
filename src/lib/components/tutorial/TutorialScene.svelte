<script>
	/**
	 * The 3D view of the ballistic tutorial (#182), without three.js: a framed box the page mounts the
	 * renderer into, the loading and error states over it, the value overlay (top left), the camera
	 * presets and the Fire button under it. This file must never import three.js: the page loads it
	 * lazily and appends its canvas to `container`.
	 *
	 * Size: 4:3 on phones, 16:10 from sm, and from lg as tall as the window allows (the page keeps this
	 * card in view while the settings scroll). The renderer should follow the container's size
	 * (ResizeObserver), not the window's.
	 *
	 * @prop {HTMLDivElement|null} container - Bindable: the element the renderer's canvas goes into.
	 * @prop {'loading'|'ready'|'error'|'lost'} status - loading: three.js and the models load (spinner);
	 *   ready: nothing over the scene; error: the scene could not start; lost: the WebGL context was
	 *   lost. error and lost show Restart.
	 * @prop {Array<{ id: string, label: string, value: string }>} values - The overlay lines, already
	 *   translated and formatted ({ label: 'Drop at 300 m', value: '45 cm' }). Empty: no overlay.
	 * @prop {'shooter'|'optic'|'side'|'target'|null} camera - The preset the camera is on; null once
	 *   the user has orbited away from it.
	 * @prop {(preset: 'shooter'|'optic'|'side'|'target') => void} oncamera
	 * @prop {boolean} firing   - A bullet is in flight: Fire is disabled.
	 * @prop {boolean} canFire  - False when there is no trajectory for the settings: Fire is disabled and
	 *   the reason shows under the bar.
	 * @prop {() => void} onfire
	 * @prop {() => void} onrestart - Restart after error or lost.
	 * @prop {{ type: 'red-dot'|'mil-dot'|'mrad'|'moa', halfView: number } | null} [reticle] - Shown over
	 *   the scene (TutorialReticle) while the camera looks through the optic; null hides it.
	 * @prop {HTMLDivElement|null} hud - Bindable: the HUD bracket around the target (#195). The scene
	 *   places and sizes it each frame from the target's projected corners, and hides it when it is
	 *   not needed; the page hands it to the scene.
	 * @prop {string} [hudLabel] - Under the bracket: the target and its distance ('Target 300 m').
	 */
	import { m } from '#lib/paraglide/messages.js';
	import { Crosshair, Loader, RefreshCw, TriangleAlert } from '@lucide/svelte';
	import ChipGroup from '#lib/components/ChipGroup.svelte';
	import TutorialReticle from './TutorialReticle.svelte';

	let {
		container = $bindable(null),
		status = 'loading',
		values = [],
		camera = null,
		oncamera,
		firing = false,
		canFire = true,
		onfire,
		onrestart,
		reticle = null,
		hud = $bindable(null),
		hudLabel = ''
	} = $props();

	const uid = $props.id();
	const focusRing = 'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary-500';

	let cameraOptions = $derived([
		{ value: 'shooter', label: m.tutorial_camera_shooter(), title: m.tutorial_camera_shooter_title() },
		{ value: 'optic', label: m.tutorial_camera_optic(), title: m.tutorial_camera_optic_title() },
		{ value: 'side', label: m.tutorial_camera_side(), title: m.tutorial_camera_side_title() },
		{ value: 'target', label: m.tutorial_camera_target(), title: m.tutorial_camera_target_title() }
	]);
	let failed = $derived(status === 'error' || status === 'lost');
</script>

<section
	class="card preset-filled-surface-100-900 border border-surface-200-800 overflow-hidden min-w-0"
	aria-labelledby="{uid}-title"
>
	<h2 id="{uid}-title" class="sr-only">{m.tutorial_scene_label()}</h2>

	<div
		class="relative w-full aspect-[4/3] sm:aspect-[16/10] lg:aspect-auto lg:h-[min(62dvh,640px)] lg:min-h-[360px] bg-surface-950 text-surface-50"
	>
		<!-- The renderer's canvas goes in here (the page mounts it). It is the only child the renderer
			touches; the overlays below are siblings. -->
		<div
			bind:this={container}
			class="absolute inset-0 touch-none"
			role="img"
			aria-label={m.tutorial_scene_label()}
		></div>

		<!-- HUD bracket around the target (#195): placed by the scene, hidden until it is -->
		<div
			bind:this={hud}
			class="absolute left-0 top-0 pointer-events-none {status === 'ready' ? '' : 'invisible'}"
			style="display: none"
			aria-hidden="true"
		>
			<span class="absolute -left-px -top-px size-2.5 border-l-2 border-t-2 border-[#22e6ff]"></span>
			<span class="absolute -right-px -top-px size-2.5 border-r-2 border-t-2 border-[#22e6ff]"></span>
			<span class="absolute -left-px -bottom-px size-2.5 border-l-2 border-b-2 border-[#22e6ff]"></span>
			<span class="absolute -right-px -bottom-px size-2.5 border-r-2 border-b-2 border-[#22e6ff]"></span>
			{#if hudLabel}
				<span
					class="absolute left-1/2 top-full mt-1 -translate-x-1/2 whitespace-nowrap px-1.5 rounded-sm bg-surface-950/70 text-[11px] font-semibold tabular-nums text-[#22e6ff]"
					>{hudLabel}</span
				>
			{/if}
		</div>

		<!-- Reticle, through the optic -->
		{#if reticle && status === 'ready'}
			<TutorialReticle type={reticle.type} halfView={reticle.halfView} />
		{/if}

		<!-- Value overlay: read out when it changes -->
		{#if values.length > 0 && status === 'ready'}
			<dl
				class="absolute top-2 left-2 sm:top-3 sm:left-3 max-w-[calc(100%-1rem)] flex flex-col gap-1 px-3 py-2 rounded-base bg-surface-950/75 text-surface-50 text-[13px] leading-snug pointer-events-none"
				aria-label={m.tutorial_values_label()}
				aria-live="polite"
			>
				{#each values as v (v.id)}
					<div class="flex flex-wrap items-baseline gap-x-2">
						<dt class="text-surface-300">{v.label}</dt>
						<dd class="font-semibold tabular-nums">{v.value}</dd>
					</div>
				{/each}
			</dl>
		{/if}

		{#if status === 'loading'}
			<div class="absolute inset-0 flex flex-col items-center justify-center gap-2 text-sm" role="status">
				<Loader class="size-6 animate-spin" aria-hidden="true" />
				{m.tutorial_scene_loading()}
			</div>
		{:else if failed}
			<div class="absolute inset-0 flex items-center justify-center p-4 bg-surface-950/85">
				<div role="alert" class="max-w-sm flex flex-col items-center gap-2.5 text-center">
					<TriangleAlert class="size-6 text-warning-400" aria-hidden="true" />
					<p class="text-[15px] font-semibold">
						{status === 'lost' ? m.tutorial_scene_lost_title() : m.tutorial_scene_error_title()}
					</p>
					<p class="text-[13px] leading-relaxed text-surface-300">
						{status === 'lost' ? m.tutorial_scene_lost_text() : m.tutorial_scene_error_text()}
					</p>
					<button
						type="button"
						class="btn h-11 px-4 mt-1 preset-filled-primary-500 font-semibold focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary-50"
						onclick={() => onrestart?.()}
					>
						<RefreshCw class="size-4" aria-hidden="true" />
						{m.tutorial_scene_restart()}
					</button>
				</div>
			</div>
		{/if}
	</div>

	<!-- Camera presets and Fire -->
	<div class="flex flex-wrap items-center gap-x-3 gap-y-2 px-3 py-2.5 sm:px-4 border-t border-surface-200-800">
		<span class="text-xs text-surface-600-400" aria-hidden="true">{m.tutorial_camera()}</span>
		<ChipGroup
			label={m.tutorial_camera()}
			options={cameraOptions}
			value={camera}
			onselect={(preset) => oncamera?.(preset)}
		/>
		<button
			type="button"
			class="btn h-11 px-5 ml-auto preset-filled-primary-500 font-semibold {focusRing}"
			disabled={status !== 'ready' || firing || !canFire}
			aria-describedby={canFire ? `${uid}-hint` : `${uid}-nofire`}
			onclick={() => onfire?.()}
		>
			{#if firing}
				<Loader class="size-4 animate-spin" aria-hidden="true" />
				{m.tutorial_fire_busy()}
			{:else}
				<Crosshair class="size-4" aria-hidden="true" />
				{m.tutorial_fire()}
			{/if}
		</button>
		<p id="{uid}-hint" class="basis-full text-xs text-surface-600-400">{m.tutorial_camera_hint()}</p>
		{#if !canFire && status === 'ready'}
			<p id="{uid}-nofire" class="basis-full text-xs text-error-500" role="alert">{m.tutorial_fire_unavailable()}</p>
		{/if}
	</div>
</section>
