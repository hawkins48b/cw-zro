<script>
	import { m } from '$lib/paraglide/messages.js';
	import { localizeHref } from '$lib/paraglide/runtime';
	import LanguageSwitcher from '$lib/components/LanguageSwitcher.svelte';
	import { InfoIcon, ShieldIcon, ChevronRightIcon } from '@lucide/svelte';
</script>

<svelte:head>
	<title>{m.settings_title()} — {m.app_name()}</title>
</svelte:head>

<div class="space-y-3 lg:max-w-xl">
	<!-- Language -->
	<div class="card p-4 flex items-center justify-between">
		<span class="font-medium">{m.settings_language()}</span>
		<LanguageSwitcher />
	</div>

	<!-- About -->
	<a href={localizeHref('/settings/about')} class="card p-4 hover:preset-tonal-primary flex items-center gap-4">
		<InfoIcon class="size-6 text-primary-500 shrink-0" />
		<span class="font-medium flex-1">{m.settings_about()}</span>
		<ChevronRightIcon class="size-5 text-surface-400 shrink-0" />
	</a>

	<!-- Privacy -->
	<a href={localizeHref('/settings/privacy')} class="card p-4 hover:preset-tonal-primary flex items-center gap-4">
		<ShieldIcon class="size-6 text-primary-500 shrink-0" />
		<span class="font-medium flex-1">{m.settings_privacy()}</span>
		<ChevronRightIcon class="size-5 text-surface-400 shrink-0" />
	</a>
</div>
