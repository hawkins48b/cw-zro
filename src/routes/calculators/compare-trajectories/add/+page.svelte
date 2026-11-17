<script>
	/**
	 * Compare Trajectories, Add a profile (#166): the picker pattern (select, then confirm), used on
	 * phones and tablets. Desktop opens the same picker inline on the Compare page.
	 */
	import { m } from '#lib/paraglide/messages.js';
	import { localizeHref } from '#lib/paraglide/runtime.js';
	import { goto } from '$app/navigation';
	import CompareAddPicker from '#lib/components/compare/CompareAddPicker.svelte';
</script>

<svelte:head>
	<title>{m.compare_pick_profile()} — {m.app_name()}</title>
</svelte:head>

<div class="mx-auto w-full max-w-2xl flex flex-col gap-3 sm:gap-4 lg:gap-5">
	<h1 class="sr-only lg:not-sr-only lg:text-[28px] lg:font-bold lg:tracking-tight">{m.compare_pick_profile()}</h1>
	<CompareAddPicker pinned onadded={() => goto(localizeHref('/calculators/compare-trajectories'))} />
</div>
