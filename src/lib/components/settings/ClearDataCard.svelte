<script>
	/**
	 * Settings, Danger zone (#166): "Clear all data on this device" with an inline confirmation
	 * (not a dialog). Delete everything calls clearAllData() and opens the Welcome screen, replacing
	 * the history entry so Back does not return to an emptied Settings page.
	 */
	import { tick } from 'svelte';
	import { goto } from '$app/navigation';
	import { TriangleAlertIcon, Trash2Icon } from '@lucide/svelte';
	import { m } from '#lib/paraglide/messages.js';
	import { localizeHref } from '#lib/paraglide/runtime.js';
	import { profiles } from '#lib/stores/profiles.svelte.js';
	import { clearAllData } from '#lib/stores/clearAllData.js';
	import { focusRing } from './settingsStyles.js';

	let { class: cls = '' } = $props();
	const uid = $props.id();

	let confirming = $state(false);
	let busy = $state(false);
	let askButton = $state();
	let cancelButton = $state();
	let count = $derived(profiles.count);

	async function ask() {
		confirming = true;
		await tick();
		// Cancel first: the safe choice gets the focus.
		cancelButton?.focus();
	}

	async function cancel() {
		confirming = false;
		await tick();
		askButton?.focus();
	}

	function clearEverything() {
		if (busy) return;
		busy = true;
		clearAllData();
		goto(localizeHref('/welcome'), { replace: true });
	}
</script>

<section
	aria-labelledby="{uid}-title"
	class="card preset-filled-surface-100-900 border border-error-600-400 p-4 flex flex-col gap-3 {cls}"
>
	<div class="flex items-center gap-2.5 text-error-600-400">
		<TriangleAlertIcon class="size-5 shrink-0" aria-hidden="true" />
		<h3 id="{uid}-title" class="text-[15px] font-bold text-surface-950-50">{m.settings_clear_title()}</h3>
	</div>
	<p class="text-[13px] leading-relaxed text-surface-600-400">
		{count === 1 ? m.settings_clear_desc_one() : m.settings_clear_desc({ count })}
	</p>

	{#if !confirming}
		<button
			bind:this={askButton}
			type="button"
			class="btn self-start h-11 px-4 gap-2 text-sm font-semibold border border-error-600-400 text-error-600-400 hover:preset-tonal-error {focusRing}"
			onclick={ask}
		>
			<Trash2Icon class="size-4" aria-hidden="true" />
			{m.settings_clear_ask()}
		</button>
	{:else}
		<div
			role="group"
			aria-labelledby="{uid}-confirm-title"
			aria-describedby="{uid}-confirm-desc"
			class="rounded-container bg-error-50-950 p-3.5 flex flex-col gap-2.5"
		>
			<p id="{uid}-confirm-title" class="text-sm font-semibold">{m.settings_clear_confirm_title()}</p>
			<p id="{uid}-confirm-desc" class="text-[13px] text-surface-700-300">{m.settings_clear_confirm_desc()}</p>
			<div class="flex flex-wrap gap-2">
				<button
					bind:this={cancelButton}
					type="button"
					class="btn flex-1 sm:flex-none h-11 px-4 text-sm font-semibold bg-surface-50-950 border border-surface-400-600 hover:preset-tonal-surface {focusRing}"
					onclick={cancel}
				>
					{m.common_cancel()}
				</button>
				<button
					type="button"
					class="btn flex-1 sm:flex-none h-11 px-4 text-sm font-bold preset-filled-error-500 {focusRing}"
					disabled={busy}
					onclick={clearEverything}
				>
					{m.settings_clear_confirm()}
				</button>
			</div>
		</div>
	{/if}
</section>
