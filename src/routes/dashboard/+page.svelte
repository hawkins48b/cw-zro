<script>
	import { m } from '$lib/paraglide/messages.js';
</script>

<svelte:head>
	<title>{m.dashboard_title()} — {m.app_name()}</title>
</svelte:head>

<header class="space-y-2 mb-8">
	<h1 class="h1">{m.dashboard_welcome()}</h1>
	<p class="text-surface-500">{m.dashboard_subtitle()}</p>
</header>
