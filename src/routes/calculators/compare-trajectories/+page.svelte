<script>
	import { m } from '$lib/paraglide/messages.js';
</script>

<svelte:head>
	<title>{m.calc_compare()} — {m.app_name()}</title>
</svelte:head>

<header class="space-y-2 mb-8">
	<h1 class="h1">{m.calc_compare()}</h1>
	<p class="text-surface-500">{m.calc_compare_desc()}</p>
</header>
