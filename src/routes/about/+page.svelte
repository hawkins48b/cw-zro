<script>
	import { m } from '$lib/paraglide/messages.js';
</script>

<svelte:head>
	<title>{m.about_title()} — {m.app_name()}</title>
</svelte:head>

<header class="space-y-2 mb-8">
	<h1 class="h1">{m.about_title()}</h1>
</header>

<div class="card p-6 space-y-4">
	<p class="text-surface-500">{m.about_description()}</p>
	<p class="text-sm text-surface-400">{m.about_version({ version: '2.0.0' })}</p>
</div>
