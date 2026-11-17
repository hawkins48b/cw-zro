<script>
	import { m } from '#lib/paraglide/messages.js';
	import { localizeHref } from '#lib/paraglide/runtime.js';
	import { NEW_PROFILE_PATH } from '#lib/utils/setupSteps.js';
	import {
		ChartSplineIcon,
		Table2Icon,
		RulerDimensionLineIcon,
		ChartLineIcon,
		ChartScatterIcon,
		ChevronRightIcon
	} from '@lucide/svelte';
	import { activeProfile } from '#lib/stores/activeProfile.svelte.js';
	import { shownProfile } from '#lib/utils/storedProfiles.js';
	import ProfileInUseChip from '#lib/components/ProfileInUseChip.svelte';

	// Calculators hub (#149): two groups, the everyday tools first. #166: from sm a card grid with
	// the profile chip (Change opens the picker) in the header; phones keep the list and the intro line.
	const startHere = [
		{ href: '/calculators/ballistic', labelKey: 'calc_ballistic', descKey: 'calc_ballistic_desc', icon: ChartSplineIcon },
		{ href: '/calculators/dope-cards', labelKey: 'calc_dope_cards', descKey: 'calc_dope_cards_desc', icon: Table2Icon }
	];
	const moreTools = [
		{ href: '/calculators/mpbr', labelKey: 'calc_mpbr', descKey: 'calc_mpbr_desc', icon: RulerDimensionLineIcon },
		{ href: '/calculators/compare-trajectories', labelKey: 'calc_compare', descKey: 'calc_compare_desc', icon: ChartLineIcon },
		{
			href: '/calculators/trajectory-validation',
			labelKey: 'calc_trajectory_validation',
			descKey: 'calc_trajectory_validation_desc',
			icon: ChartScatterIcon,
			advanced: true
		}
	];

	// The active profile as the page shows it (#120): rifle, then ammo when there is one.
	let shown = $derived(shownProfile(activeProfile.profile));
	let profileName = $derived(
		shown ? [shown.name || m.scope_view_profile_unnamed(), shown.ammo].filter(Boolean).join(' · ') : ''
	);

	const focusRing = 'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary-500';
</script>

<svelte:head>
	<title>{m.calculators_title()} — {m.app_name()}</title>
</svelte:head>

{#snippet card(calc, primary)}
	{@const Icon = calc.icon}
	<li class="min-w-0">
		<a
			href={localizeHref(calc.href)}
			class="h-full flex items-center gap-3.5 p-3.5 rounded-container border border-surface-200-800 preset-filled-surface-100-900 hover:border-primary-500 {focusRing} {primary
				? 'sm:gap-4 sm:p-5 lg:gap-[18px] lg:p-6'
				: 'sm:flex-col sm:items-start sm:gap-3 sm:p-[18px] lg:gap-3.5'}"
		>
			<span class="shrink-0 flex items-center justify-between gap-2 {primary ? '' : 'sm:self-stretch'}">
				<span
					class="shrink-0 rounded-base flex items-center justify-center {primary
						? 'size-11 sm:size-14 lg:size-[60px] preset-tonal-primary'
						: 'size-11 sm:size-12 preset-tonal-surface'}"
				>
					<Icon class="size-[26px] {primary ? 'sm:size-[30px]' : ''}" strokeWidth={1.75} aria-hidden="true" />
				</span>
				{#if calc.advanced}
					<!-- Tablet and desktop: the badge sits right of the icon -->
					<span
						class="hidden sm:inline-block px-2 py-0.5 rounded-full border border-surface-300-700 text-[11px] font-semibold tracking-wide text-surface-600-400"
					>
						{m.calc_advanced()}
					</span>
				{/if}
			</span>
			<span class="flex-1 min-w-0">
				<span
					class="flex flex-wrap items-center gap-1.5 text-[15px] font-semibold {primary ? 'sm:text-lg' : 'sm:text-base'}"
				>
					{m[calc.labelKey]()}
					{#if calc.advanced}
						<span
							class="sm:hidden px-[7px] py-0.5 rounded-full border border-surface-300-700 text-[10px] font-semibold tracking-wide text-surface-600-400"
						>
							{m.calc_advanced()}
						</span>
					{/if}
				</span>
				<span class="block mt-0.5 text-[13px] leading-snug text-surface-600-400 sm:mt-1 sm:text-sm">{m[calc.descKey]()}</span>
				{#if primary}
					<span class="hidden lg:inline-flex items-center gap-1 mt-3 text-sm font-semibold text-primary-700-300" aria-hidden="true">
						{m.calc_hub_open()}
						<ChevronRightIcon class="size-4" />
					</span>
				{/if}
			</span>
			<ChevronRightIcon
				class="size-[18px] shrink-0 text-surface-600-400 {primary ? 'lg:hidden' : 'sm:hidden'}"
				aria-hidden="true"
			/>
		</a>
	</li>
{/snippet}

<div class="flex flex-col gap-3 sm:gap-4 lg:gap-5">
	<!-- Header: title on desktop (the app header shows it below lg), intro, profile chip from sm -->
	<header class="flex flex-wrap items-center gap-x-4 gap-y-3">
		<div class="flex-[1_1_320px] min-w-0">
			<h1 class="sr-only lg:not-sr-only lg:text-[28px] lg:font-bold lg:tracking-tight">{m.calculators_title()}</h1>
			<p class="mx-1 mb-1 sm:m-0 lg:mt-1 text-sm leading-relaxed text-surface-600-400">
				{#if shown}
					<span class="sm:hidden">{m.calc_hub_intro({ name: profileName })}</span>
					<span class="hidden sm:inline">{m.calc_hub_intro_change()}</span>
				{:else}
					{m.calc_hub_no_profile()}
					<a href={localizeHref(NEW_PROFILE_PATH)} class="font-semibold text-primary-700-300 underline underline-offset-2 hover:no-underline rounded-sm {focusRing}">{m.calc_hub_create_profile()}</a>
				{/if}
			</p>
		</div>
		{#if shown}
			<div class="hidden sm:block max-w-full">
				<ProfileInUseChip variant="compact" />
			</div>
		{/if}
	</header>

	<section aria-labelledby="calc-start-here" class="flex flex-col gap-2.5 sm:gap-4">
		<h2 id="calc-start-here" class="mx-1 mt-1.5 sm:mx-0 sm:mt-1 text-xs font-bold tracking-wider uppercase text-surface-600-400">
			{m.calc_hub_start_here()}
		</h2>
		<ul class="flex flex-col gap-2.5 sm:grid sm:grid-cols-2 sm:gap-4 lg:grid-cols-[repeat(auto-fit,minmax(340px,1fr))]">
			{#each startHere as calc (calc.href)}
				{@render card(calc, true)}
			{/each}
		</ul>
	</section>

	<section aria-labelledby="calc-more-tools" class="flex flex-col gap-2.5 sm:gap-4">
		<h2 id="calc-more-tools" class="mx-1 mt-2.5 sm:mx-0 sm:mt-2 text-xs font-bold tracking-wider uppercase text-surface-600-400">
			{m.calc_hub_more_tools()}
		</h2>
		<ul class="flex flex-col gap-2.5 sm:grid sm:grid-cols-[repeat(auto-fit,minmax(200px,1fr))] sm:gap-4 lg:grid-cols-[repeat(auto-fit,minmax(260px,1fr))]">
			{#each moreTools as calc (calc.href)}
				{@render card(calc, false)}
			{/each}
		</ul>
	</section>
</div>
