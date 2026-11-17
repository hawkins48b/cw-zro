<script>
	/**
	 * A link to another site (#166). target="_blank" so the Electron window hands it to the system
	 * browser instead of blocking it; the icon and a hidden "(opens in a new tab)" say so.
	 *
	 * @prop {string} href
	 * @prop {string} [class]
	 * @prop {import('svelte').Snippet} [icon] - Shown before the text.
	 * @prop {import('svelte').Snippet} children
	 */
	import { ExternalLinkIcon } from '@lucide/svelte';
	import { m } from '#lib/paraglide/messages.js';

	let { href, class: cls = '', icon, children } = $props();
</script>

<a {href} target="_blank" rel="noopener noreferrer" class={cls}>
	{@render icon?.()}
	<span class="min-w-0 break-words">{@render children()}</span>
	<ExternalLinkIcon class="size-4 shrink-0" aria-hidden="true" />
	<span class="sr-only">{m.common_opens_new_tab()}</span>
</a>
