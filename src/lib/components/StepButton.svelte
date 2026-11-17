<script>
	/**
	 * One − or + button of a stepped field (#166): a real button, 44 px wide, full height of its box,
	 * with a specific accessible name ("Increase altitude by 10 m"). Used by StepperField and the
	 * Scope View cant row.
	 *
	 * @prop {'down'|'up'} dir
	 * @prop {string} label           - Accessible name, already translated, with the step and unit.
	 * @prop {() => void} onclick
	 * @prop {'inset'|'standalone'} [variant] - inset: inside a field box (no own border or radius);
	 *   standalone: its own 44 px rounded button (next to a slider).
	 */
	import { Minus, Plus } from '@lucide/svelte';

	let { dir, label, onclick, variant = 'inset' } = $props();

	const base =
		'shrink-0 flex items-center justify-center preset-tonal-surface focus-visible:outline-2 focus-visible:outline-primary-500';
	let shape = $derived(
		variant === 'inset'
			? 'h-full w-11 focus-visible:-outline-offset-2'
			: 'size-11 rounded-base focus-visible:outline-offset-2'
	);
</script>

<button type="button" class="{base} {shape}" aria-label={label} title={label} {onclick}>
	{#if dir === 'down'}
		<Minus class="size-4" aria-hidden="true" />
	{:else}
		<Plus class="size-4" aria-hidden="true" />
	{/if}
</button>
