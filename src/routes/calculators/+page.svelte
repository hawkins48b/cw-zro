<script>
	import { m } from '$lib/paraglide/messages.js';
	import { localizeHref } from '$lib/paraglide/runtime';
	import {
		CalculatorIcon,
		TargetIcon,
		GitCompareArrowsIcon,
		ClipboardListIcon,
		CheckCircleIcon,
		ChevronRightIcon
	} from '@lucide/svelte';

	const calculators = [
		{ href: '/calculators/ballistic', labelKey: 'calc_ballistic', descKey: 'calc_ballistic_desc', icon: CalculatorIcon },
		{ href: '/calculators/mpbr', labelKey: 'calc_mpbr', descKey: 'calc_mpbr_desc', icon: TargetIcon },
		{ href: '/calculators/trajectory-validation', labelKey: 'calc_trajectory_validation', descKey: 'calc_trajectory_validation_desc', icon: CheckCircleIcon },
		{ href: '/calculators/compare-trajectories', labelKey: 'calc_compare', descKey: 'calc_compare_desc', icon: GitCompareArrowsIcon },
		{ href: '/calculators/dope-cards', labelKey: 'calc_dope_cards', descKey: 'calc_dope_cards_desc', icon: ClipboardListIcon }
	];
</script>

<svelte:head>
	<title>{m.calculators_title()} — {m.app_name()}</title>
</svelte:head>


<div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-1 gap-3 lg:max-w-xl">
	{#each calculators as calc}
		{@const Icon = calc.icon}
		<a href={localizeHref(calc.href)} class="card p-4 hover:preset-tonal-primary flex items-center gap-4">
			<Icon class="size-6 text-primary-500 shrink-0" />
			<div class="flex-1 min-w-0">
				<div class="font-medium">{m[calc.labelKey]()}</div>
				<p class="text-sm text-surface-500 hidden lg:block">{m[calc.descKey]()}</p>
			</div>
			<ChevronRightIcon class="size-5 text-surface-400 shrink-0" />
		</a>
	{/each}
</div>
