<script>
	/**
	 * The one list card of the picker pattern (#166). Holds PickerRow items, optionally under
	 * PickerGroup headings. It scrolls inside when given a max height class.
	 *
	 * @prop {string} label       - Accessible name of the list (already translated).
	 * @prop {string} [id]        - For aria-controls of the search field.
	 * @prop {string} [class]     - Extra classes, e.g. max-h-72 or flex-1 min-h-0.
	 * @prop {boolean} [grouped]  - Children are PickerGroup blocks (each with its own <ul>).
	 * @prop {import('svelte').Snippet} children
	 */
	let { label, id = undefined, class: cls = '', grouped = false, children } = $props();
</script>

{#if grouped}
	<div
		{id}
		role="group"
		aria-label={label}
		class="rounded-container border border-surface-200-800 preset-filled-surface-100-900 overflow-y-auto {cls}"
	>
		{@render children()}
	</div>
{:else}
	<ul
		{id}
		aria-label={label}
		class="rounded-container border border-surface-200-800 preset-filled-surface-100-900 overflow-y-auto divide-y divide-surface-200-800 {cls}"
	>
		{@render children()}
	</ul>
{/if}
