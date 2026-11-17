<script>
	/**
	 * Settings, About group (#166): About ZRO (with the version), Privacy, Licences and notices.
	 * Phone and desktop General page; the tablet shows the same pages in its left pane instead.
	 */
	import { ChevronRightIcon, InfoIcon, ShieldIcon, ScaleIcon } from '@lucide/svelte';
	import { m } from '#lib/paraglide/messages.js';
	import { APP_VERSION } from '#lib/utils/platform.js';
	import { localizeHref } from '#lib/paraglide/runtime.js';
	import { card, linkRow, rowIcon } from './settingsStyles.js';
</script>

<div class="{card} overflow-hidden flex flex-col">
	<a href={localizeHref('/settings/about')} class={linkRow}>
		<InfoIcon class={rowIcon} aria-hidden="true" />
		<span class="flex-1 min-w-0 text-[15px] font-medium">{m.settings_about_zro()}</span>
		<span class="text-[13px] text-surface-600-400 tabular-nums">{APP_VERSION}</span>
		<ChevronRightIcon class="size-[18px] shrink-0 text-surface-600-400" aria-hidden="true" />
	</a>
	<a href={localizeHref('/settings/privacy')} class="{linkRow} border-t border-surface-200-800">
		<ShieldIcon class={rowIcon} aria-hidden="true" />
		<span class="flex-1 min-w-0">
			<span class="block text-[15px] font-medium">{m.settings_privacy()}</span>
			<span class="block mt-0.5 text-xs text-surface-600-400">{m.privacy_summary_title()}</span>
		</span>
		<ChevronRightIcon class="size-[18px] shrink-0 text-surface-600-400" aria-hidden="true" />
	</a>
	<a href={localizeHref('/settings/about/licenses')} class="{linkRow} border-t border-surface-200-800">
		<ScaleIcon class={rowIcon} aria-hidden="true" />
		<span class="flex-1 min-w-0 text-[15px] font-medium">{m.licenses_title()}</span>
		<ChevronRightIcon class="size-[18px] shrink-0 text-surface-600-400" aria-hidden="true" />
	</a>
</div>
