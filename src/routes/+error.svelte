<script>
	import { page } from '$app/state';
	import { m } from '$lib/paraglide/messages.js';
	import { localizeHref } from '$lib/paraglide/runtime';
</script>

<svelte:head>
	<title>{m.error_page_title()}</title>
</svelte:head>

<div class="flex flex-col items-center justify-center gap-4 py-16">
	<h1 class="h1">{page.status}</h1>
	<p class="text-xl text-surface-500">{m.error_page_message()}</p>
	<a href={localizeHref('/dashboard')} class="btn preset-filled-primary-500">
		{m.error_go_home()}
	</a>
</div>
