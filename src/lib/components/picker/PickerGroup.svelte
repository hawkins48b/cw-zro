<script>
	/**
	 * A titled block of rows in a grouped PickerList (#166): "From your profiles", "Library", a file
	 * of the import review. The heading sticks to the top while its rows scroll.
	 *
	 * @prop {string} heading   - Already translated, may hold a count ("Library · 41").
	 * @prop {string} [level]   - 'h2' (default) or 'h3'.
	 * @prop {string} [note]    - Muted line under the heading.
	 * @prop {import('svelte').Snippet} children - PickerRow items.
	 */
	let { heading, level = 'h2', note = '', children } = $props();
	const uid = $props.id();
</script>

<svelte:element
	this={level}
	id="{uid}-h"
	class="sticky top-0 z-[1] px-3.5 py-2 text-xs font-bold tracking-wider uppercase truncate bg-surface-200-800 text-surface-600-400 border-b border-surface-200-800"
>
	{heading}
</svelte:element>
{#if note}
	<p class="px-3.5 py-1.5 text-xs text-surface-600-400 border-b border-surface-200-800">{note}</p>
{/if}
<ul aria-labelledby="{uid}-h" class="divide-y divide-surface-200-800 border-b border-surface-200-800 last:border-b-0">
	{@render children()}
</ul>
