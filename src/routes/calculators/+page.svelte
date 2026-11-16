<script>
	import { m } from '#lib/paraglide/messages.js';
	import { localizeHref } from '#lib/paraglide/runtime.js';
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

	// Calculators hub (#149): two groups, the everyday tools first.
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
	<li>
		<a
			href={localizeHref(calc.href)}
			class="flex items-center gap-3.5 p-3.5 rounded-container border border-surface-200-800 preset-filled-surface-100-900 hover:border-primary-500 {focusRing}"
		>
			<span
				class="size-11 shrink-0 rounded-base flex items-center justify-center {primary
					? 'preset-tonal-primary'
					: 'preset-tonal-surface'}"
			>
				<Icon class="size-[26px]" strokeWidth={1.75} aria-hidden="true" />
			</span>
			<span class="flex-1 min-w-0">
				<span class="flex flex-wrap items-center gap-1.5 text-[15px] font-semibold">
					{m[calc.labelKey]()}
					{#if calc.advanced}
						<span
							class="px-[7px] py-0.5 rounded-full border border-surface-300-700 text-[10px] font-semibold tracking-wide text-surface-600-400"
						>
							{m.calc_advanced()}
						</span>
					{/if}
				</span>
				<span class="block mt-0.5 text-[13px] leading-snug text-surface-600-400">{m[calc.descKey]()}</span>
			</span>
			<ChevronRightIcon class="size-[18px] shrink-0 text-surface-600-400" aria-hidden="true" />
		</a>
	</li>
{/snippet}

<div class="max-w-2xl flex flex-col gap-2.5 px-2 sm:px-0">
	<p class="mx-1 mb-1 text-sm leading-relaxed text-surface-600-400">
		{#if shown}
			{m.calc_hub_intro({ name: profileName })}
		{:else}
			{m.calc_hub_no_profile()}
			<a href={localizeHref('/profiles/new')} class="font-semibold text-primary-700-300 underline underline-offset-2 hover:no-underline rounded-sm {focusRing}">{m.calc_hub_create_profile()}</a>
		{/if}
	</p>

	<section aria-labelledby="calc-start-here" class="flex flex-col gap-2.5">
		<h2 id="calc-start-here" class="mx-1 mt-1.5 text-xs font-bold tracking-wider uppercase text-surface-600-400">
			{m.calc_hub_start_here()}
		</h2>
		<ul class="flex flex-col gap-2.5">
			{#each startHere as calc (calc.href)}
				{@render card(calc, true)}
			{/each}
		</ul>
	</section>

	<section aria-labelledby="calc-more-tools" class="flex flex-col gap-2.5">
		<h2 id="calc-more-tools" class="mx-1 mt-2.5 text-xs font-bold tracking-wider uppercase text-surface-600-400">
			{m.calc_hub_more_tools()}
		</h2>
		<ul class="flex flex-col gap-2.5">
			{#each moreTools as calc (calc.href)}
				{@render card(calc, false)}
			{/each}
		</ul>
	</section>
</div>
