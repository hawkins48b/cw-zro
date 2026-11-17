<script>
	/**
	 * One − or + button of a stepped field (#166): a real button, 44 px wide, full height of its box,
	 * with a specific accessible name ("Increase altitude by 10 m"). Used by StepperField and the
	 * Scope View cant row.
	 *
	 * Hold to repeat (#168, utils/holdRepeat.js): a press makes one step; held, it repeats after
	 * 400 ms every 100 ms, and after 10 repeats each repeat makes 10 steps. It stops on release, when
	 * the pointer leaves the button, and on touch cancel (a scroll). Enter and Space make one step, as
	 * a click from the keyboard (detail 0); pointer clicks are ignored, the press already stepped.
	 *
	 * @prop {'down'|'up'} dir
	 * @prop {string} label           - Accessible name, already translated, with the step and unit.
	 * @prop {(steps: number) => void} onclick - Make `steps` steps (1, or 10 while held long).
	 * @prop {'inset'|'standalone'} [variant] - inset: inside a field box (no own border or radius);
	 *   standalone: its own 44 px rounded button (next to a slider).
	 */
	import { onDestroy } from 'svelte';
	import { Minus, Plus } from '@lucide/svelte';
	import { createHoldRepeat } from '#lib/utils/holdRepeat.js';

	let { dir, label, onclick, variant = 'inset' } = $props();

	const hold = createHoldRepeat((steps) => onclick?.(steps));
	onDestroy(() => hold.stop());

	function onPointerDown(e) {
		// Main button or a touch / pen contact only
		if (e.button !== 0) return;
		hold.start();
	}

	function onClick(e) {
		// A click from the keyboard or assistive tech has no pointer press before it
		if (e.detail === 0) onclick?.(1);
	}

	const base =
		'shrink-0 flex items-center justify-center preset-tonal-surface select-none touch-manipulation [-webkit-touch-callout:none] focus-visible:outline-2 focus-visible:outline-primary-500';
	let shape = $derived(
		variant === 'inset'
			? 'h-full w-11 focus-visible:-outline-offset-2'
			: 'size-11 rounded-base focus-visible:outline-offset-2'
	);
</script>

<!-- A release lost to an app switch or a system dialog must not keep stepping -->
<svelte:window onblur={() => hold.stop()} />
<svelte:document onvisibilitychange={() => hold.stop()} />

<button
	type="button"
	class="{base} {shape}"
	aria-label={label}
	title={label}
	onpointerdown={onPointerDown}
	onpointerup={() => hold.stop()}
	onpointercancel={() => hold.stop()}
	onlostpointercapture={() => hold.stop()}
	onpointerleave={() => hold.stop()}
	oncontextmenu={(e) => e.preventDefault()}
	onclick={onClick}
>
	{#if dir === 'down'}
		<Minus class="size-4" aria-hidden="true" />
	{:else}
		<Plus class="size-4" aria-hidden="true" />
	{/if}
</button>
