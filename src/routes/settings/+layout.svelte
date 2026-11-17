<script>
	/**
	 * Settings section (#166). Tablet (768 to 1023 px): two panes, the Settings pages on the left
	 * (General, About, Privacy, Licences) and the page on the right. Phone: one page at a time, the
	 * General page links to the others. Desktop: the root layout's sidebar lists the same pages.
	 */
	import { page } from '$app/state';
	import { m } from '#lib/paraglide/messages.js';
	import { localizeHref, deLocalizeHref } from '#lib/paraglide/runtime.js';
	import { SlidersHorizontalIcon, InfoIcon, ShieldIcon, ScaleIcon } from '@lucide/svelte';
	import { platformText } from '#lib/components/settings/platformText.js';
	import { APP_VERSION } from '#lib/utils/platform.js';
	import { focusRing } from '#lib/components/settings/settingsStyles.js';

	let { children } = $props();

	const pages = [
		{ href: '/settings', title: m.settings_general(), desc: m.settings_general_desc(), icon: SlidersHorizontalIcon },
		{ href: '/settings/about', title: m.settings_about(), desc: m.settings_about_desc({ version: APP_VERSION }), icon: InfoIcon },
		{ href: '/settings/privacy', title: m.settings_privacy(), desc: m.settings_privacy_desc(), icon: ShieldIcon },
		{ href: '/settings/about/licenses', title: m.licenses_title(), desc: m.settings_licenses_desc(), icon: ScaleIcon }
	];

	let currentPath = $derived(deLocalizeHref(page.url.pathname).replace(/(.)\/$/, '$1'));
</script>

<div class="md:flex md:items-start md:gap-6 md:pt-6 md:px-4 lg:block lg:p-0">
	<nav
		aria-labelledby="settings-pane-title"
		class="hidden md:flex lg:hidden sticky top-6 w-64 shrink-0 flex-col gap-1 pr-4 border-r border-surface-200-800 min-h-[calc(100dvh-4rem)]"
	>
		<h2 id="settings-pane-title" class="px-3 pb-3 text-2xl font-bold">{m.settings_title()}</h2>
		{#each pages as p (p.href)}
			{@const Icon = p.icon}
			{@const active = currentPath === p.href}
			<a
				href={localizeHref(p.href)}
				aria-current={active ? 'page' : undefined}
				class="flex items-start gap-3 px-3 py-2.5 rounded-container {focusRing} {active
					? 'preset-tonal-primary'
					: 'hover:preset-tonal-surface'}"
			>
				<Icon class="size-5 mt-0.5 shrink-0 {active ? '' : 'text-primary-700-300'}" aria-hidden="true" />
				<span class="min-w-0">
					<span class="block text-[15px] {active ? 'font-semibold' : 'font-medium'}">{p.title}</span>
					<span class="block mt-0.5 text-xs {active ? '' : 'text-surface-600-400'}">{p.desc}</span>
				</span>
			</a>
		{/each}
		<p class="mt-auto px-3 pt-6 text-xs text-surface-600-400">
			{m.settings_footer_build({ version: APP_VERSION, platform: platformText() })}<br />
			{m.about_mit_license()}
		</p>
	</nav>
	<div class="flex-1 min-w-0">
		{@render children()}
	</div>
</div>
