<script>
	/**
	 * The licence texts every build ships under /licenses/ (#77): the bclibc notice, LGPL-3.0 and
	 * GPL-3.0. One opens at a time (#166): opening one closes the other. They are shown here, not
	 * linked, so that the Electron window, which has no back button, never leaves the app.
	 *
	 * @prop {number} [initial] - Index open at first, -1 for none.
	 */
	import { ChevronDownIcon } from '@lucide/svelte';
	import { m } from '#lib/paraglide/messages.js';
	import notice from '../../../../static/licenses/THIRD-PARTY-NOTICES.txt?raw';
	import lgpl from '../../../../static/licenses/LGPL-3.0.txt?raw';
	import gpl from '../../../../static/licenses/GPL-3.0.txt?raw';
	import { card, focusRing } from './settingsStyles.js';

	let { initial = 0, class: cls = '' } = $props();
	const uid = $props.id();

	const texts = [
		{ title: m.licenses_notice_title(), detail: m.licenses_notice_detail(), text: notice },
		{ title: m.licenses_lgpl_title(), detail: m.licenses_lgpl_detail(), text: lgpl },
		{ title: m.licenses_gpl_title(), detail: m.licenses_gpl_detail(), text: gpl }
	];

	// svelte-ignore state_referenced_locally
	let open = $state(initial);

	function toggle(i) {
		open = open === i ? -1 : i;
	}
</script>

<div class="{card} overflow-hidden {cls}">
	{#each texts as t, i (t.title)}
		{@const expanded = open === i}
		<div class={i > 0 ? 'border-t border-surface-200-800' : ''}>
			<h3>
				<button
					type="button"
					id="{uid}-head-{i}"
					class="w-full flex items-center gap-3 min-h-14 px-4 py-2.5 text-left hover:preset-tonal-surface {focusRing} focus-visible:-outline-offset-2"
					aria-expanded={expanded}
					aria-controls="{uid}-panel-{i}"
					onclick={() => toggle(i)}
				>
					<span class="flex-1 min-w-0">
						<span class="block text-[15px] font-semibold break-words">{t.title}</span>
						<span class="block mt-0.5 text-xs text-surface-600-400">{t.detail}</span>
					</span>
					<ChevronDownIcon
						class="size-[18px] shrink-0 text-surface-600-400 transition-transform {expanded ? 'rotate-180' : ''}"
						aria-hidden="true"
					/>
				</button>
			</h3>
			<div id="{uid}-panel-{i}" role="region" aria-labelledby="{uid}-head-{i}" hidden={!expanded} class="px-4 pb-4">
				<pre
					class="p-3 rounded-base border border-surface-200-800 bg-surface-50-950 text-xs leading-relaxed whitespace-pre-wrap break-words text-surface-700-300">{t.text}</pre>
			</div>
		</div>
	{/each}
</div>
