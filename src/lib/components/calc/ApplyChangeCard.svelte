<script>
	/**
	 * Save a calculated value to the profile in use, showing before → after (#166): MPBR "Use this
	 * zero in your profile" and Trajectory Validation "Apply to profile". The page stays where it is;
	 * after the save the button gives way to a status line. Computes and saves nothing itself.
	 *
	 * @prop {string} title          - Card heading (already translated).
	 * @prop {string} label          - Name of the value in the before → after row ("Zero distance").
	 * @prop {string} before         - The profile value now, as shown ("200 m").
	 * @prop {string} after          - The new value, as shown ("24 m").
	 * @prop {string} note           - What the save changes, under the row.
	 * @prop {string} buttonLabel    - "Set zero to 24 m".
	 * @prop {string} [doneText]     - Status after the save; shown instead of the button when set.
	 * @prop {string} [unchangedText] - Shown instead of the button when the profile has the value already.
	 * @prop {() => void} onapply
	 */
	import { ArrowRight, BookmarkPlus, CircleCheck } from '@lucide/svelte';

	let { title, label, before, after, note, buttonLabel, doneText = '', unchangedText = '', onapply } = $props();

	const uid = $props.id();
	const focusRing = 'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary-500';
</script>

<section
	class="card preset-filled-surface-100-900 border border-surface-200-800 p-4 flex flex-col gap-3"
	aria-labelledby="{uid}-title"
>
	<div class="flex items-center gap-2.5">
		<span class="size-9 shrink-0 rounded-full flex items-center justify-center preset-tonal-primary" aria-hidden="true">
			<BookmarkPlus class="size-[18px]" />
		</span>
		<h2 id="{uid}-title" class="text-[15px] font-semibold">{title}</h2>
	</div>

	<div class="flex flex-wrap items-center gap-x-2.5 gap-y-1 px-3 py-2.5 rounded-base bg-surface-200-800">
		<span class="flex-1 min-w-max text-[13px] text-surface-600-400">{label}</span>
		<span class="flex items-center gap-2.5">
			<span class="text-[15px] font-semibold tabular-nums text-surface-600-400 line-through">{before}</span>
			<ArrowRight class="size-4 text-surface-600-400" aria-hidden="true" /><span class="sr-only">→</span>
			<span class="text-[17px] font-bold tabular-nums">{after}</span>
		</span>
	</div>

	<p class="text-xs leading-snug text-surface-600-400">{note}</p>

	{#if doneText}
		<p
			role="status"
			class="min-h-12 px-3 py-2.5 rounded-base flex items-center gap-2 text-sm font-semibold preset-tonal-success"
		>
			<CircleCheck class="size-[18px] shrink-0" aria-hidden="true" />
			{doneText}
		</p>
	{:else if unchangedText}
		<p class="min-h-12 px-3 py-2.5 rounded-base flex items-center gap-2 text-sm preset-tonal-surface">
			<CircleCheck class="size-[18px] shrink-0" aria-hidden="true" />
			{unchangedText}
		</p>
	{:else}
		<button
			type="button"
			class="btn w-full h-12 preset-filled-primary-500 text-[15px] font-semibold gap-2 {focusRing}"
			onclick={() => onapply?.()}
		>
			<BookmarkPlus class="size-[18px]" aria-hidden="true" />
			{buttonLabel}
		</button>
	{/if}
</section>
