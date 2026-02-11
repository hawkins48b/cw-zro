<script>
	import { m } from '$lib/paraglide/messages.js';
	import DarkModeToggle from '$lib/components/DarkModeToggle.svelte';
	import LanguageSwitcher from '$lib/components/LanguageSwitcher.svelte';
</script>

<svelte:head>
	<title>{m.settings_title()} — {m.app_name()}</title>
</svelte:head>

<header class="space-y-2 mb-8">
	<h1 class="h1">{m.settings_title()}</h1>
</header>

<div class="space-y-6">
	<!-- Dark Mode -->
	<div class="card p-6 flex items-center justify-between">
		<span class="font-medium">{m.settings_dark_mode()}</span>
		<DarkModeToggle />
	</div>

	<!-- Language -->
	<div class="card p-6 flex items-center justify-between">
		<span class="font-medium">{m.settings_language()}</span>
		<LanguageSwitcher />
	</div>

	<!-- About -->
	<div class="card p-6 space-y-4">
		<h2 class="h3">{m.about_title()}</h2>
		<p class="text-surface-500">{m.about_description()}</p>
		<p class="text-sm text-surface-400">{m.about_version({ version: '2.0.0' })}</p>
	</div>
</div>
