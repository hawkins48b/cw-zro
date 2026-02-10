<script>
	import { page } from '$app/state';
	import { m } from '$lib/paraglide/messages.js';
</script>

<svelte:head>
	<title>{m.profiles_edit()} — {m.app_name()}</title>
</svelte:head>

<header class="space-y-2 mb-8">
	<h1 class="h1">{m.profiles_edit()}</h1>
	<p class="text-surface-500">ID: {page.params.id}</p>
</header>
