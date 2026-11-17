<script>
	/**
	 * Language links: each stores the choice (#96) and shows the same page in its locale without a
	 * reload (#178). The links stay real links, so a new tab or a click before the app has started
	 * still works.
	 *
	 * @prop {'group'|'chips'} variant
	 *   group: joined buttons (Settings).
	 *   chips: separate pills with a 44 px touch area (Welcome screen, #150).
	 *   settings: the Language row of the Settings Display card (#166): label, a three-way track
	 *     with each language's own name and code, and a hint that the choice is kept.
	 * @prop {string} class - Extra classes on the wrapper.
	 */
	import { page } from '$app/state';
	import { goto } from '$app/navigation';
	import { localizeHref, locales, getLocale } from '#lib/paraglide/runtime.js';
	import { m } from '#lib/paraglide/messages.js';
	import { storeLocale } from '#lib/utils/storedLocale.js';
	import { isPlainClick, localeHref, switchLocale } from '#lib/utils/switchLocale.js';

	let { variant = 'group', class: cls = '' } = $props();

	const localeLabels = { en: 'EN', fr: 'FR', de: 'DE' };
	// Each language in its own language, the same on every page (marked with lang=).
	const localeNames = { en: 'English', fr: 'Français', de: 'Deutsch' };
	const uid = $props.id();

	/** @param {MouseEvent} event @param {string} locale */
	function pick(event, locale) {
		if (!isPlainClick(event)) {
			storeLocale(locale);
			return;
		}
		event.preventDefault();
		if (locale === getLocale()) return;
		switchLocale(locale, { url: page.url, localizeHref, goto, storeLocale });
	}

	const focusRing = 'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary-500';
</script>

{#if variant === 'settings'}
	<div class="flex flex-col gap-2 {cls}">
		<span id="{uid}-label" class="text-[15px] font-medium">{m.settings_language()}</span>
		<div
			role="group"
			aria-labelledby="{uid}-label"
			aria-describedby="{uid}-hint"
			class="grid grid-cols-3 gap-0.5 p-[3px] rounded-container bg-surface-200-800"
		>
			{#each locales as locale (locale)}
				{@const active = getLocale() === locale}
				<a
					href={localeHref(page.url, locale, localizeHref)}
					class="h-12 min-w-0 px-1 rounded-base flex flex-col items-center justify-center leading-tight text-sm {focusRing} {active
						? 'bg-surface-50-950 shadow-sm font-bold'
						: 'font-medium hover:text-surface-950-50 hover:bg-surface-50-950/50'}"
					aria-current={active ? 'true' : undefined}
					rel="alternate"
					hreflang={locale}
					lang={locale}
					onclick={(event) => pick(event, locale)}
				>
					<span class="max-w-full truncate">{localeNames[locale] ?? locale}</span>
					<span class="text-[11px] font-medium text-surface-600-400">{localeLabels[locale] ?? locale.toUpperCase()}</span>
				</a>
			{/each}
		</div>
		<span id="{uid}-hint" class="text-xs text-surface-600-400">{m.settings_language_hint()}</span>
	</div>
{:else if variant === 'chips'}
	<div role="group" aria-label={m.settings_language()} class="flex items-center gap-1.5 {cls}">
		{#each locales as locale (locale)}
			{@const active = getLocale() === locale}
			<a
				href={localeHref(page.url, locale, localizeHref)}
				class="chip touch-hit min-w-11 h-8 px-3 rounded-full text-xs font-semibold {focusRing} {active
					? 'preset-filled-primary-500'
					: 'preset-outlined-surface-300-700 hover:preset-tonal-surface'}"
				aria-current={active ? 'true' : undefined}
				rel="alternate"
				hreflang={locale}
				onclick={(event) => pick(event, locale)}
			>
				{localeLabels[locale] ?? locale.toUpperCase()}
			</a>
		{/each}
	</div>
{:else}
	<div class="btn-group preset-outlined-surface-200-800 {cls}">
		{#each locales as locale}
			<a
				href={localeHref(page.url, locale, localizeHref)}
				class="btn btn-sm {getLocale() === locale ? 'preset-filled-primary-500' : ''}"
				rel="alternate"
				hreflang={locale}
				onclick={(event) => pick(event, locale)}
			>
				{localeLabels[locale] ?? locale.toUpperCase()}
			</a>
		{/each}
	</div>
{/if}
