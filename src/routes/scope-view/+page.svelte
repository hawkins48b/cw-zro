<script>
	import { m } from '$lib/paraglide/messages.js';
</script>

<svelte:head>
	<title>{m.scope_view_title()} — {m.app_name()}</title>
</svelte:head>

<header class="space-y-2 mb-8 hidden sm:block">
	<h1 class="h1">{m.scope_view_title()}</h1>
	<p class="text-surface-500">{m.scope_view_subtitle()}</p>
</header>
