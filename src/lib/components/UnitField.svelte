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
	 * @prop {string}  id         - Optional id of the input; a generated one is used otherwise.
	 *
	 * The label is a <label for> the input, the hint or error is its aria-describedby, and an error
	 * sets aria-invalid (#150). The unit chips say which unit is chosen with aria-pressed.
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
		invalid = '',
		id = undefined
	} = $props();

	const uid = $props.id();
	let inputId = $derived(id ?? `${uid}-input`);
	let noteId = $derived(`${inputId}-note`);
</script>

<div class="space-y-1.5">
	{#if label}
		<label for={inputId} class="text-sm font-medium block">{label}</label>
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
			id={inputId}
			type="text"
			{inputmode}
			aria-describedby={invalid || hint ? noteId : undefined}
			aria-invalid={invalid ? 'true' : undefined}
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
						aria-pressed={unit === opt.value}
						onclick={() => (unit = opt.value)}
					>
						{opt.label}
					</button>
				{/each}
			</div>
		{/if}
	</div>

	{#if invalid}
		<p id={noteId} class="text-xs text-error-500">{invalid}</p>
	{:else if hint}
		<p id={noteId} class="text-xs text-surface-600-400">{hint}</p>
	{/if}
</div>
