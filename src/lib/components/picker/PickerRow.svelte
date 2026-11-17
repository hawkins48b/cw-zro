<script>
	/**
	 * One row of the picker pattern (#166): title, detail line, optional badge and warning note,
	 * tinted with a check badge when selected. Put rows in a PickerList.
	 *
	 * Single choice (default): a button with aria-pressed; only the selected row shows the badge.
	 * multiple: a checkbox (role="checkbox", aria-checked); an unchecked row shows an empty circle.
	 *
	 * @prop {string}   title
	 * @prop {string}   [detail]    - Second line, muted.
	 * @prop {string}   [badge]     - Small tonal pill after the title (e.g. "New").
	 * @prop {string}   [note]      - Warning line under the detail (e.g. imported as a copy).
	 * @prop {boolean}  selected
	 * @prop {boolean}  [multiple]
	 * @prop {string}   [ariaLabel] - Accessible name when the title is not enough.
	 * @prop {Function} onclick()
	 */
	import { Check, TriangleAlert } from '@lucide/svelte';

	let {
		title,
		detail = '',
		badge = '',
		note = '',
		selected = false,
		multiple = false,
		ariaLabel = undefined,
		onclick
	} = $props();
</script>

<li>
	<button
		type="button"
		role={multiple ? 'checkbox' : undefined}
		aria-checked={multiple ? selected : undefined}
		aria-pressed={multiple ? undefined : selected}
		aria-label={ariaLabel}
		class="w-full min-h-[58px] flex items-center gap-3 px-3.5 py-2.5 text-left transition-colors focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-primary-500 {selected
			? 'bg-primary-500/10 dark:bg-primary-400/15'
			: 'hover:preset-tonal-surface'}"
		{onclick}
	>
		<span class="flex-1 min-w-0">
			<span class="flex flex-wrap items-center gap-x-1.5 gap-y-0.5 text-[15px] font-semibold">
				<span class="min-w-0 break-words">{title}</span>
				{#if badge}
					<span class="px-[7px] py-0.5 rounded-full preset-tonal-primary text-[10px] font-bold tracking-wide uppercase">
						{badge}
					</span>
				{/if}
			</span>
			{#if detail}
				<span class="block mt-0.5 text-xs text-surface-600-400 truncate">{detail}</span>
			{/if}
			{#if note}
				<span class="flex items-start gap-1.5 mt-1 text-xs font-medium leading-snug text-warning-800-200">
					<TriangleAlert class="size-3.5 shrink-0 mt-px" aria-hidden="true" />
					{note}
				</span>
			{/if}
		</span>
		{#if selected}
			<span class="size-6 shrink-0 rounded-full flex items-center justify-center bg-primary-600 dark:bg-primary-500 text-white" aria-hidden="true">
				<Check class="size-4" strokeWidth={3} />
			</span>
		{:else if multiple}
			<span class="size-[22px] shrink-0 rounded-full border border-surface-400-600" aria-hidden="true"></span>
		{/if}
	</button>
</li>
