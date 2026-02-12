<script>
	import { m } from '$lib/paraglide/messages.js';
	import { localizeHref } from '$lib/paraglide/runtime';
	import {
		CalculatorIcon,
		TargetIcon,
		GitCompareArrowsIcon,
		ClipboardListIcon,
		CheckCircleIcon
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

<header class="space-y-2 mb-8 hidden sm:block">
	<h1 class="h1">{m.calculators_title()}</h1>
	<p class="text-surface-500">{m.calculators_subtitle()}</p>
</header>

<div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
	{#each calculators as calc}
		{@const Icon = calc.icon}
		<a href={localizeHref(calc.href)} class="card p-4 hover:preset-tonal-primary flex items-start gap-4">
			<Icon class="size-8 text-primary-500 shrink-0" />
			<div>
				<h3 class="h4">{m[calc.labelKey]()}</h3>
				<p class="text-sm text-surface-500">{m[calc.descKey]()}</p>
			</div>
		</a>
	{/each}
</div>
