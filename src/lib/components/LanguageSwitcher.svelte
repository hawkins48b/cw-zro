<script>
	/**
	 * Language links: each reloads the page in its locale and stores the choice (#96).
	 *
	 * @prop {'group'|'chips'} variant
	 *   group: joined buttons (Settings).
	 *   chips: separate pills with a 44 px touch area (Welcome screen, #150).
	 * @prop {string} class - Extra classes on the wrapper.
	 */
	import { page } from '$app/state';
	import { localizeHref, locales, getLocale } from '#lib/paraglide/runtime.js';
	import { m } from '#lib/paraglide/messages.js';
	import { storeLocale } from '#lib/utils/storedLocale.js';

	let { variant = 'group', class: cls = '' } = $props();

	const localeLabels = { en: 'EN', fr: 'FR', de: 'DE' };
	const focusRing = 'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary-500';
</script>

{#if variant === 'chips'}
	<div role="group" aria-label={m.settings_language()} class="flex items-center gap-1.5 {cls}">
		{#each locales as locale (locale)}
			{@const active = getLocale() === locale}
			<a
				href={localizeHref(page.url.pathname, { locale })}
				class="chip touch-hit min-w-11 h-8 px-3 rounded-full text-xs font-semibold {focusRing} {active
					? 'preset-filled-primary-500'
					: 'preset-outlined-surface-300-700 hover:preset-tonal-surface'}"
				aria-current={active ? 'true' : undefined}
				data-sveltekit-reload
				rel="alternate"
				hreflang={locale}
				onclick={() => storeLocale(locale)}
			>
				{localeLabels[locale] ?? locale.toUpperCase()}
			</a>
		{/each}
	</div>
{:else}
	<div class="btn-group preset-outlined-surface-200-800 {cls}">
		{#each locales as locale}
			<a
				href={localizeHref(page.url.pathname, { locale })}
				class="btn btn-sm {getLocale() === locale ? 'preset-filled-primary-500' : ''}"
				data-sveltekit-reload
				rel="alternate"
				hreflang={locale}
				onclick={() => storeLocale(locale)}
			>
				{localeLabels[locale] ?? locale.toUpperCase()}
			</a>
		{/each}
	</div>
{/if}
