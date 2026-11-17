<script>
	/** About on phones (#166): "This copy", the version, platform and licence of this build. */
	import { m } from '#lib/paraglide/messages.js';
	import { APP_VERSION } from '#lib/utils/platform.js';
	import { platformText } from './platformText.js';
	import { card, sectionTitle } from './settingsStyles.js';

	let { class: cls = '' } = $props();
	const rows = [
		[m.about_row_version(), APP_VERSION],
		[m.about_row_platform(), platformText()],
		[m.about_row_licence(), m.about_mit_license()]
	];
</script>

<section class="flex flex-col gap-2.5 {cls}">
	<h2 class="{sectionTitle}">{m.about_this_copy()}</h2>
	<dl class="{card} overflow-hidden">
		{#each rows as [term, value], i (term)}
			<div class="flex items-center justify-between gap-3 min-h-12 px-4 py-2 text-sm {i > 0 ? 'border-t border-surface-200-800' : ''}">
				<dt class="text-surface-600-400">{term}</dt>
				<dd class="font-semibold text-right tabular-nums">{value}</dd>
			</div>
		{/each}
	</dl>
</section>
