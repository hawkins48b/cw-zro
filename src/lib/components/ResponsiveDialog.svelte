<script>
	/**
	 * A modal that is a full-screen sheet on phones and a centred dialog from the sm breakpoint
	 * (#166): Import profiles, and later the profile picker of the calculators and Compare.
	 *
	 * Render it inside {#if open}: it traps focus while shown, closes on Escape and on a tap on the
	 * scrim (tablet/desktop), and gives focus back to the element that opened it.
	 *
	 * @prop {string}   title        - Heading of the dialog (already translated). Also its name.
	 * @prop {Function} onclose()    - Close button, Escape, scrim.
	 * @prop {string}   [width]      - Tailwind max-width class of the dialog (default sm:max-w-[560px]).
	 * @prop {import('svelte').Snippet} [actions]  - Extra header buttons, left of Close (e.g. Add files).
	 * @prop {import('svelte').Snippet} children   - Body; scrolls when long.
	 * @prop {import('svelte').Snippet} [footer]   - Buttons pinned under the body.
	 */
	import { fade, fly } from 'svelte/transition';
	import { X } from '@lucide/svelte';
	import { m } from '#lib/paraglide/messages.js';
	import { focusTrap } from '#lib/actions/focusTrap.js';

	let { title, onclose, width = 'sm:max-w-[560px]', actions, children, footer } = $props();

	const uid = $props.id();
	const focusRing = 'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary-500';
</script>

<div
	transition:fade={{ duration: 160 }}
	class="hidden sm:block fixed inset-0 z-50 bg-black/55"
	role="presentation"
	onclick={onclose}
></div>

<div
	transition:fly={{ y: 24, duration: 200, opacity: 0 }}
	class="fixed inset-0 z-50 flex sm:items-center sm:justify-center sm:p-5 pointer-events-none"
>
	<div
		role="dialog"
		aria-modal="true"
		aria-labelledby="{uid}-title"
		tabindex="-1"
		use:focusTrap={{ onescape: onclose }}
		class="pointer-events-auto w-full h-full sm:h-auto sm:max-h-full {width} flex flex-col bg-surface-50-950 sm:rounded-container sm:shadow-2xl outline-none"
		style="padding-top: var(--safe-area-top); padding-bottom: var(--safe-area-bottom);"
	>
		<header class="shrink-0 flex items-center gap-1 pl-2 pr-2 pt-2 pb-1 sm:pl-5 sm:pr-3 sm:pt-4">
			<!-- Phone: close on the left, as a full-screen sheet -->
			<button
				type="button"
				class="sm:hidden btn-icon size-11 shrink-0 rounded-base hover:preset-tonal-surface {focusRing}"
				aria-label={m.common_close()}
				title={m.common_close()}
				onclick={onclose}
			>
				<X class="size-5" aria-hidden="true" />
			</button>
			<h2 id="{uid}-title" class="flex-1 min-w-0 truncate text-[17px] font-semibold sm:text-xl sm:font-bold">{title}</h2>
			{@render actions?.()}
			<button
				type="button"
				class="hidden sm:inline-flex btn-icon size-11 shrink-0 rounded-base hover:preset-tonal-surface {focusRing}"
				aria-label={m.common_close()}
				title={m.common_close()}
				onclick={onclose}
			>
				<X class="size-5" aria-hidden="true" />
			</button>
		</header>

		<div class="flex-1 min-h-0 overflow-y-auto px-4 pt-2 pb-3 sm:px-5 flex flex-col gap-2.5">
			{@render children()}
		</div>

		{#if footer}
			<footer class="shrink-0 border-t border-surface-200-800 sm:border-0 px-4 pt-3 pb-4 sm:px-5 sm:pt-1 sm:pb-5">
				{@render footer()}
			</footer>
		{/if}
	</div>
</div>
