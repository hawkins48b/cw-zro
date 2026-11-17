<script>
	/**
	 * Settings, Data (#166): how many profiles this device holds, linking to Profiles, where they
	 * are exported and imported.
	 */
	import { ChevronRightIcon, ListIcon } from '@lucide/svelte';
	import { m } from '#lib/paraglide/messages.js';
	import { localizeHref } from '#lib/paraglide/runtime.js';
	import { profiles } from '#lib/stores/profiles.svelte.js';
	import { card, linkRow, rowIcon } from './settingsStyles.js';

	let count = $derived(profiles.count);
</script>

<div class="{card} overflow-hidden">
	<a href={localizeHref('/profiles')} class="{linkRow} min-h-[60px]">
		<ListIcon class={rowIcon} aria-hidden="true" />
		<span class="flex-1 min-w-0">
			<span class="block text-[15px] font-medium">{m.nav_profiles()}</span>
			<span class="block mt-0.5 text-xs text-surface-600-400">
				{count === 1 ? m.settings_data_profiles_one() : m.settings_data_profiles({ count })}
			</span>
		</span>
		<ChevronRightIcon class="size-[18px] shrink-0 text-surface-600-400" aria-hidden="true" />
	</a>
</div>
