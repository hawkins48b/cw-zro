<script>
	/**
	 * A short message at the bottom of the screen (#166): "K31 saved to …", "3 profiles imported".
	 * It stays until dismissed or until `duration` ms pass; a new message restarts the timer.
	 * Above the phone tab bar, centred on tablet and desktop.
	 *
	 * @prop {string}   message    - Text to show; empty hides the toast.
	 * @prop {Function} ondismiss()
	 * @prop {number}   [duration] - Auto-hide after this many ms (default 8000; 0 = never).
	 */
	import { fly } from 'svelte/transition';
	import { CircleCheck, X } from '@lucide/svelte';
	import { m } from '#lib/paraglide/messages.js';

	let { message = '', ondismiss, duration = 8000 } = $props();

	$effect(() => {
		if (!message || !duration) return;
		const timer = setTimeout(() => ondismiss?.(), duration);
		return () => clearTimeout(timer);
	});
</script>

<!-- The live region is always in the page, so screen readers announce the message when it appears. -->
<div
	role="status"
	class="fixed z-40 inset-x-4 bottom-[calc(5.5rem+var(--safe-area-bottom))] sm:bottom-6 sm:inset-x-auto sm:left-1/2 sm:-translate-x-1/2 sm:w-[440px] pointer-events-none"
>
	{#if message}
		<div
			transition:fly={{ y: 16, duration: 180 }}
			class="pointer-events-auto min-h-12 flex items-center gap-2 pl-3.5 pr-1 py-1 rounded-base bg-surface-950-50 text-surface-50-950 shadow-xl"
		>
			<CircleCheck class="size-[18px] shrink-0" aria-hidden="true" />
			<span class="flex-1 min-w-0 text-[13px] leading-snug">{message}</span>
			<button
				type="button"
				class="btn-icon size-11 shrink-0 rounded-base hover:bg-surface-50-950/15 focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-current"
				aria-label={m.common_dismiss()}
				title={m.common_dismiss()}
				onclick={ondismiss}
			>
				<X class="size-[18px]" aria-hidden="true" />
			</button>
		</div>
	{/if}
</div>
