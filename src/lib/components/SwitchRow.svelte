<script>
	/**
	 * An on/off row (#166): title, hint, switch on the right. A button with role="switch".
	 * Profile editor: Same click for windage, Temperature sensitivity, Spin drift.
	 *
	 * @prop {boolean} checked   - Bindable.
	 * @prop {string}  title     - Already translated; the switch's name.
	 * @prop {string}  [hint]    - Line under the title (its description).
	 * @prop {import('svelte').Snippet} [icon] - Shown in a small tile on the left.
	 * @prop {string}  [controls] - id of what the switch shows or hides.
	 */
	let { checked = $bindable(false), title, hint = '', icon, controls = undefined } = $props();
	const uid = $props.id();
</script>

<button
	type="button"
	role="switch"
	aria-checked={checked}
	aria-describedby={hint ? `${uid}-hint` : undefined}
	aria-controls={controls}
	class="w-full min-h-12 py-1 flex items-center gap-3 text-left rounded-base focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary-500"
	onclick={() => (checked = !checked)}
>
	{#if icon}
		<span class="size-8 shrink-0 rounded-base flex items-center justify-center preset-tonal-surface" aria-hidden="true">
			{@render icon()}
		</span>
	{/if}
	<span class="flex-1 min-w-0">
		<span class="block text-sm font-semibold">{title}</span>
		{#if hint}
			<span id="{uid}-hint" class="block mt-0.5 text-xs leading-snug text-surface-600-400">{hint}</span>
		{/if}
	</span>
	<span
		class="w-11 h-[26px] shrink-0 p-[3px] rounded-full flex transition-colors {checked
			? 'justify-end bg-primary-600 dark:bg-primary-500'
			: 'justify-start bg-surface-300-700'}"
		aria-hidden="true"
	>
		<span class="size-5 rounded-full bg-white shadow-sm"></span>
	</span>
</button>
