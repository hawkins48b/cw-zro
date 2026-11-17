<script>
	/**
	 * Tonal card of an ammunition (#150, #166): name, optional line, and its weight, BC, diameter and
	 * length. Setup ammunition step ("… · filled in" + Edit), profile editor (+ Change), Ammo Library
	 * (the selection).
	 *
	 * @prop {string} title       - Name line (already translated).
	 * @prop {string} [subtitle]  - Small line under the name ("From the Ammo Library").
	 * @prop {string} [aside]     - Small text right of the name ("G1 drag model").
	 * @prop {{ weight: string, bc: string, diameter: string, length: string }} values - Shown as given.
	 * @prop {string} [note]      - Line under the numbers.
	 * @prop {string} [label]     - Accessible name of the section.
	 * @prop {boolean} [large]    - Bigger numbers in two columns (Ammo Library aside on desktop).
	 * @prop {import('svelte').Snippet} [action] - Button or link right of the name (Edit, Change).
	 */
	import { m } from '#lib/paraglide/messages.js';

	let { title, subtitle = '', aside = '', values, note = '', label = undefined, large = false, action } = $props();

	let items = $derived([
		[large ? m.profile_ammo_weight() : m.setup_ammo_weight(), values.weight],
		[large ? m.profile_ammo_bc() : m.setup_ammo_bc(), values.bc],
		[large ? m.profile_ammo_diameter() : m.setup_ammo_diameter(), values.diameter],
		[large ? m.profile_ammo_length() : m.setup_ammo_length(), values.length]
	]);
</script>

<section aria-label={label} class="card preset-tonal-primary {large ? 'p-[18px] gap-3.5' : 'p-3.5 gap-2.5'} flex flex-col" aria-live="polite">
	<div class="flex items-center gap-2.5">
		<div class="flex-1 min-w-0">
			<p class="font-bold break-words {large ? 'text-lg' : 'text-[15px]'}">{title}</p>
			{#if subtitle}
				<p class="mt-0.5 text-xs">{subtitle}</p>
			{/if}
		</div>
		{#if aside}
			<span class="shrink-0 text-xs whitespace-nowrap">{aside}</span>
		{/if}
		{@render action?.()}
	</div>
	<dl class="grid {large ? 'grid-cols-2 gap-x-2.5 gap-y-3' : 'grid-cols-2 min-[400px]:grid-cols-4 gap-2'}">
		{#each items as [term, value] (term)}
			<div class="min-w-0">
				<dt class={large ? 'text-xs' : 'text-[11px]'}>{term}</dt>
				<dd class="tabular-nums {large ? 'mt-0.5 text-lg font-bold' : 'text-sm font-semibold'}">{value}</dd>
			</div>
		{/each}
	</dl>
	{#if note}
		<p class="text-xs leading-snug">{note}</p>
	{/if}
</section>
