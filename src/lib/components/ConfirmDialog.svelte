<script>
	/**
	 * A small centred confirmation (#166): Delete profile. Focus starts on Cancel, Escape and the
	 * scrim cancel, focus returns to the button that opened it. Render it inside {#if}.
	 *
	 * @prop {string}   title        - Heading (already translated).
	 * @prop {string}   message      - Body text (already translated).
	 * @prop {string}   confirmLabel - Label of the confirm button.
	 * @prop {boolean}  [danger]     - Confirm button in the error colour (default true).
	 * @prop {Function} onconfirm()
	 * @prop {Function} oncancel()
	 */
	import { fade, fly } from 'svelte/transition';
	import { m } from '#lib/paraglide/messages.js';
	import { focusTrap } from '#lib/actions/focusTrap.js';

	let { title, message, confirmLabel, danger = true, onconfirm, oncancel } = $props();

	const uid = $props.id();
	const focusRing = 'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary-500';
</script>

<div transition:fade={{ duration: 160 }} class="fixed inset-0 z-50 bg-black/55" role="presentation" onclick={oncancel}></div>
<div
	transition:fly={{ y: 16, duration: 200, opacity: 0 }}
	class="fixed inset-0 z-50 flex items-center justify-center p-5 pointer-events-none"
>
	<div
		role="alertdialog"
		aria-modal="true"
		aria-labelledby="{uid}-title"
		aria-describedby="{uid}-desc"
		tabindex="-1"
		use:focusTrap={{ onescape: oncancel }}
		class="card preset-filled-surface-100-900 pointer-events-auto w-full max-w-[400px] p-5 shadow-2xl outline-none"
	>
		<h2 id="{uid}-title" class="text-lg font-bold">{title}</h2>
		<p id="{uid}-desc" class="mt-2 mb-5 text-sm leading-relaxed text-surface-600-400">{message}</p>
		<div class="grid grid-cols-2 gap-2">
			<button
				type="button"
				data-autofocus
				class="btn preset-outlined-surface-300-700 hover:preset-tonal-surface h-[46px] text-[15px] {focusRing}"
				onclick={oncancel}
			>
				{m.common_cancel()}
			</button>
			<button
				type="button"
				class="btn {danger ? 'preset-filled-error-500' : 'preset-filled-primary-500'} h-[46px] text-[15px] font-semibold {focusRing}"
				onclick={onconfirm}
			>
				{confirmLabel}
			</button>
		</div>
	</div>
</div>
