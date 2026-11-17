<script>
	/**
	 * Compare Trajectories, Add a profile (#166): the picker pattern (select, then confirm). The one
	 * Add profile button of the Compare page opens it on every device (#193).
	 */
	import { m } from '#lib/paraglide/messages.js';
	import { localizeHref } from '#lib/paraglide/runtime.js';
	import { goto } from '$app/navigation';
	import { ArrowLeft } from '@lucide/svelte';
	import CompareAddPicker from '#lib/components/compare/CompareAddPicker.svelte';

	const compareHref = localizeHref('/calculators/compare-trajectories');
	const focusRing = 'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary-500';
</script>

<svelte:head>
	<title>{m.compare_pick_profile()} — {m.app_name()}</title>
</svelte:head>

<div class="mx-auto w-full max-w-2xl flex flex-col gap-3 sm:gap-4 lg:gap-5">
	<!-- Desktop has no app header with Back (#193) -->
	<a
		href={compareHref}
		class="hidden lg:inline-flex items-center gap-2 self-start min-h-11 text-sm font-semibold text-primary-700-300 hover:underline underline-offset-2 rounded-sm {focusRing}"
	>
		<ArrowLeft class="size-4" aria-hidden="true" />
		{m.compare_title()}
	</a>
	<h1 class="sr-only lg:not-sr-only lg:text-[28px] lg:font-bold lg:tracking-tight">{m.compare_pick_profile()}</h1>
	<CompareAddPicker onadded={() => goto(compareHref)} />
</div>
