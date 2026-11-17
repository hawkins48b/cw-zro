<script>
	/**
	 * Tonal summary of one profile with its 8 key numbers (#166): the profile in use on the Profiles
	 * phone layout, and the selection of the profile picker in calculators and Compare.
	 *
	 * @prop {object} profile       - As shownProfile gives it.
	 * @prop {string} [eyebrow]     - Small heading above the name (default "In use").
	 * @prop {string} [editHref]    - Shows "Edit" linking there (already localized).
	 * @prop {string} [label]       - Accessible name of the section (default "Profile in use").
	 * @prop {import('svelte').Snippet} [actions] - Buttons under the numbers (Duplicate, Export, Delete).
	 */
	import { m } from '#lib/paraglide/messages.js';
	import { Pencil } from '@lucide/svelte';
	import { profileName, ammoName, withUnit, clickText, bcText, twistText, reticleText } from './profileLabels.js';

	let { profile, eyebrow = undefined, editHref = undefined, label = undefined, actions } = $props();

	let p = $derived(profile);
	let items = $derived([
		[m.profiles_key_zero(), withUnit(p.zeroDist, p.zeroUnit)],
		[m.profiles_key_velocity(), withUnit(p.velocity, p.velocityUnit)],
		[m.profiles_key_clicks(), clickText(p.elevationClickValue, p.elevationClickUnit)],
		[m.setup_ammo_bc(), bcText(p)],
		[m.setup_ammo_weight(), withUnit(p.bulletWeight, p.bulletWeightUnit)],
		[m.profiles_key_height(), withUnit(p.opticHeight, p.opticHeightUnit)],
		[m.profiles_key_twist(), twistText(p)],
		[m.profiles_key_reticle(), reticleText(p.reticleType)]
	]);
	let ammo = $derived(ammoName(p));
</script>

<section
	aria-label={label ?? m.profiles_in_use_section()}
	class="card preset-tonal-primary p-3.5 flex flex-col gap-3"
>
	<div class="flex items-start justify-between gap-2">
		<div class="min-w-0">
			<p class="text-[11px] font-bold tracking-wider uppercase">{eyebrow ?? m.profiles_in_use()}</p>
			<p class="mt-0.5 text-[15px] font-bold break-words">
				{profileName(p)}{#if ammo}&nbsp;· {ammo}{/if}
			</p>
		</div>
		{#if editHref}
			<a
				href={editHref}
				class="shrink-0 -my-2.5 -mr-1 min-h-11 px-1 flex items-center gap-1.5 rounded-base text-[13px] font-semibold underline-offset-2 hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary-500"
				aria-label={m.profiles_edit_named({ name: profileName(p) })}
			>
				<Pencil class="size-4" aria-hidden="true" />
				{m.common_edit()}
			</a>
		{/if}
	</div>
	<dl class="grid grid-cols-4 gap-x-2 gap-y-2.5">
		{#each items as [term, value] (term)}
			<div class="min-w-0">
				<dt class="text-[11px] opacity-90">{term}</dt>
				<dd class="mt-px text-sm font-semibold tabular-nums whitespace-nowrap overflow-hidden text-ellipsis" title={value}>{value}</dd>
			</div>
		{/each}
	</dl>
	{@render actions?.()}
</section>
