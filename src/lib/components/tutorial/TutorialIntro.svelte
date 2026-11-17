<script>
	/**
	 * Step 1 of the 3D ballistic tutorial (#182): the profile in use (ProfileInUseChip, Change opens the
	 * picker in place, as on the Dope Cards page), the optic the scene will draw, the CPU/GPU warning,
	 * the WebGL state and the button that opens the scene. It computes nothing and loads nothing: the
	 * page decides what `webgl` is and what Continue does.
	 *
	 * @prop {'checking'|'ok'|'missing'} webgl - WebGL detection: 'checking' until the page knows,
	 *   'missing' shows the no-WebGL card and keeps the button disabled.
	 * @prop {object|null} profile - The profile in use as the pages show it (shownProfile), or null.
	 *   Only `reticleType` is read here, for the optic line.
	 * @prop {() => void} oncontinue - Called by "Open the 3D scene" (only when a profile is in use and
	 *   WebGL is 'ok').
	 */
	import { m } from '#lib/paraglide/messages.js';
	import { localizeHref } from '#lib/paraglide/runtime.js';
	import { NEW_PROFILE_PATH } from '#lib/utils/setupSteps.js';
	import { ArrowRight, Loader, MonitorOff, TriangleAlert } from '@lucide/svelte';
	import ProfileInUseChip from '#lib/components/ProfileInUseChip.svelte';
	import { reticleText } from '#lib/components/profile/profileLabels.js';

	let { webgl = 'checking', profile = null, oncontinue } = $props();

	const uid = $props.id();
	const focusRing = 'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary-500';

	// The optic the scene draws for the profile's reticle (#180): red dot → holographic sight, any other
	// reticle → a riflescope showing it.
	let opticText = $derived.by(() => {
		if (!profile) return '';
		return profile.reticleType === 'red-dot'
			? m.tutorial_optic_holo()
			: m.tutorial_optic_scope({ reticle: reticleText(profile.reticleType) });
	});
	let canContinue = $derived(!!profile && webgl === 'ok');
</script>

<div class="flex flex-col gap-3 sm:gap-4 lg:gap-5">
	<header class="flex flex-wrap items-center gap-x-4 gap-y-3">
		<div class="flex-[1_1_320px] min-w-0">
			<!-- Below lg the app header already shows the title -->
			<h1 class="sr-only lg:not-sr-only lg:text-[28px] lg:font-bold lg:tracking-tight">{m.tutorial_title()}</h1>
			<p class="mx-1 sm:m-0 lg:mt-1 text-sm leading-relaxed text-surface-600-400">{m.tutorial_intro()}</p>
		</div>
	</header>

	<div class="grid grid-cols-1 gap-3 sm:gap-4 md:grid-cols-2 md:items-start lg:gap-5">
		<!-- Profile: the page's one profile selector -->
		<section
			class="card preset-filled-surface-100-900 border border-surface-200-800 px-3.5 py-3 sm:p-4 flex flex-col gap-3 min-w-0"
			aria-labelledby="{uid}-profile-title"
		>
			<div class="space-y-1">
				<h2 id="{uid}-profile-title" class="text-[15px] font-semibold">{m.tutorial_profile_title()}</h2>
				<p class="text-[13px] leading-snug text-surface-600-400">{m.tutorial_profile_desc()}</p>
			</div>
			<ProfileInUseChip />
			{#if profile}
				<p class="text-[13px] text-surface-600-400">
					{m.tutorial_optic_label()}: <span class="font-semibold text-surface-950-50">{opticText}</span>
				</p>
			{:else}
				<p class="text-[13px] leading-snug text-surface-600-400">
					{m.tutorial_no_profile()}
					<a
						href={localizeHref(NEW_PROFILE_PATH)}
						class="font-semibold text-primary-700-300 underline underline-offset-2 hover:no-underline rounded-sm {focusRing}"
						>{m.calc_hub_create_profile()}</a
					>
				</p>
			{/if}
		</section>

		<!-- Warning: heavy page, may crash on phones (#180) -->
		<section
			class="card preset-filled-surface-100-900 border border-warning-500 px-3.5 py-3 sm:p-4 flex flex-col gap-2 min-w-0"
			aria-labelledby="{uid}-warning-title"
		>
			<div class="flex items-center gap-2.5 text-warning-800-200">
				<TriangleAlert class="size-5 shrink-0" aria-hidden="true" />
				<h2 id="{uid}-warning-title" class="text-[15px] font-semibold text-surface-950-50">{m.tutorial_warning_title()}</h2>
			</div>
			<p class="text-[13px] leading-relaxed text-surface-600-400">{m.tutorial_warning_text()}</p>
			<p class="text-[13px] leading-relaxed text-surface-600-400">{m.tutorial_warning_quality()}</p>
		</section>
	</div>

	{#if webgl === 'missing'}
		<!-- No WebGL: the scene cannot start; the button stays disabled -->
		<div
			role="alert"
			class="flex gap-2.5 px-3.5 py-3 rounded-container border border-error-500 bg-error-50-950 text-error-900-100"
		>
			<MonitorOff class="size-5 mt-px shrink-0" aria-hidden="true" />
			<div class="space-y-1">
				<p class="text-sm font-semibold">{m.tutorial_webgl_missing_title()}</p>
				<p class="text-[13px] leading-relaxed">{m.tutorial_webgl_missing_text()}</p>
			</div>
		</div>
	{/if}

	<div class="flex flex-col-reverse gap-2 sm:flex-row sm:items-center sm:justify-end sm:gap-4">
		{#if webgl === 'checking'}
			<p class="flex items-center justify-center gap-2 text-[13px] text-surface-600-400" role="status">
				<Loader class="size-4 animate-spin" aria-hidden="true" />
				{m.tutorial_webgl_checking()}
			</p>
		{/if}
		<button
			type="button"
			class="btn h-12 lg:h-11 w-full sm:w-auto px-5 preset-filled-primary-500 font-semibold {focusRing}"
			disabled={!canContinue}
			onclick={() => canContinue && oncontinue?.()}
		>
			{m.tutorial_open_scene()}
			<ArrowRight class="size-4" aria-hidden="true" />
		</button>
	</div>
</div>
