<script>
	import { m } from '$lib/paraglide/messages.js';
	import { localizeHref } from '$lib/paraglide/runtime';
</script>

<svelte:head>
	<title>{m.profiles_title()} — {m.app_name()}</title>
</svelte:head>

<header class="flex items-center justify-between mb-8">
	<div class="space-y-2">
		<h1 class="h1">{m.profiles_title()}</h1>
		<p class="text-surface-500">{m.profiles_subtitle()}</p>
	</div>
	<a href={localizeHref('/profiles/new')} class="btn preset-filled-primary-500">
		{m.profiles_new()}
	</a>
</header>

<p class="text-surface-400">{m.profiles_empty()}</p>
