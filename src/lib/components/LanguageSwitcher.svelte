<script>
	import { page } from '$app/state';
	import { localizeHref, locales, getLocale } from '$lib/paraglide/runtime';

	const localeLabels = { en: 'EN', fr: 'FR', de: 'DE' };
</script>

<div class="btn-group preset-outlined-surface-200-800">
	{#each locales as locale}
		<a
			href={localizeHref(page.url.pathname, { locale })}
			class="btn btn-sm {getLocale() === locale ? 'preset-filled-primary-500' : ''}"
			data-sveltekit-reload
			rel="alternate"
			hreflang={locale}
		>
			{localeLabels[locale] ?? locale.toUpperCase()}
		</a>
	{/each}
</div>
