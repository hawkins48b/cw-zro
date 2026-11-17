<script>
	/**
	 * A labelled text input with a hint or an error under it, styled like UnitField (#150).
	 *
	 * @prop {string} label       - Field label (already translated).
	 * @prop {string} value       - Bindable value.
	 * @prop {string} placeholder
	 * @prop {number} maxlength
	 * @prop {string} hint        - Helper text under the input.
	 * @prop {string} invalid     - Error message; replaces the hint when not empty.
	 * @prop {string} id          - Optional input id (a generated one otherwise).
	 * @prop {HTMLInputElement} input - Bindable element, so a parent can focus it.
	 */
	let {
		label,
		value = $bindable(''),
		placeholder = '',
		maxlength = undefined,
		hint = '',
		invalid = '',
		id = undefined,
		input = $bindable(null)
	} = $props();

	const uid = $props.id();
	let inputId = $derived(id ?? `${uid}-input`);
	let noteId = $derived(`${inputId}-note`);
</script>

<div class="space-y-1.5">
	<label for={inputId} class="text-sm font-medium block">{label}</label>
	<input
		bind:this={input}
		id={inputId}
		class="input"
		type="text"
		{maxlength}
		{placeholder}
		bind:value
		aria-describedby={invalid || hint ? noteId : undefined}
		aria-invalid={invalid ? 'true' : undefined}
	/>
	{#if invalid}
		<p id={noteId} class="text-xs text-error-500">{invalid}</p>
	{:else if hint}
		<p id={noteId} class="text-xs text-surface-600-400">{hint}</p>
	{/if}
</div>
