<script>
	/**
	 * A text input with optional prefix, suffix, and unit toggle buttons,
	 * all rendered inline inside a single input-styled container.
	 *
	 * Layout (left → right):
	 *   [prefix?]  [text input — flex-1]  [suffix?]  [unit chips?]
	 *
	 * @prop {string}  label      - Field label (already translated). Empty = no label.
	 * @prop {string}  value      - Bindable input value (string).
	 * @prop {string}  unit       - Bindable selected unit value.
	 * @prop {Array}   units      - [{ value, label }] unit options. Labels already translated.
	 * @prop {string}  placeholder
	 * @prop {string}  prefix     - Static text left of the input (e.g. "1 /").
	 * @prop {string}  suffix     - Static text right of the input, before unit chips.
	 * @prop {string}  inputmode  - inputmode attribute (default: 'decimal').
	 * @prop {string}  hint       - Optional helper text displayed below the input.
	 * @prop {string}  invalid    - Error message to display (overrides hint when non-empty).
	 */
	let {
		label = '',
		value = $bindable(''),
		unit = $bindable(''),
		units = [],
		placeholder = '',
		prefix = null,
		suffix = null,
		inputmode = 'decimal',
		hint = null,
		invalid = ''
	} = $props();
</script>

<div class="space-y-1.5">
	{#if label}
		<span class="text-sm font-medium block">{label}</span>
	{/if}

	<!--
		The wrapper gets Skeleton's .input class for the ring/border/radius/focus-within
		styling. !flex overrides .input's display:block.
	-->
	<div class="input !flex !items-center gap-2">
		{#if prefix}
			<span class="text-surface-500 text-sm select-none shrink-0">{prefix}</span>
		{/if}

		<input
			class="flex-1 min-w-0 bg-transparent border-none outline-none shadow-none p-0"
			type="text"
			{inputmode}
			bind:value
			{placeholder}
		/>

		{#if suffix}
			<span class="text-surface-500 text-sm select-none shrink-0">{suffix}</span>
		{/if}

		{#if units.length > 0}
			<div class="flex items-center gap-1 shrink-0">
				{#each units as opt}
					<button
						type="button"
						class="chip text-xs {unit === opt.value
							? 'preset-filled-primary-500'
							: 'preset-tonal-surface'}"
						onclick={() => (unit = opt.value)}
					>
						{opt.label}
					</button>
				{/each}
			</div>
		{/if}
	</div>

	{#if invalid}
		<p class="text-xs text-error-500">{invalid}</p>
	{:else if hint}
		<p class="text-xs text-surface-500-400">{hint}</p>
	{/if}
</div>
