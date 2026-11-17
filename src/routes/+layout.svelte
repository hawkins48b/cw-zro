<script>
	import '../app.css';
	import favicon from '#lib/assets/favicon.svg';
	import { page } from '$app/state';
	import { m } from '#lib/paraglide/messages.js';
	import { localizeHref, deLocalizeHref, getLocale } from '#lib/paraglide/runtime.js';
	import { ArrowLeftIcon, ListIcon, CalculatorIcon, SlidersHorizontalIcon } from '@lucide/svelte';
	import ReticleIcon from '#lib/components/ReticleIcon.svelte';
	import DarkModeToggle from '#lib/components/DarkModeToggle.svelte';
	import { settings, applyDarkMode } from '#lib/stores/settings.svelte.js';
	import { profiles } from '#lib/stores/profiles.svelte.js';
	import { shownProfile } from '#lib/utils/storedProfiles.js';
	import { profileName } from '#lib/components/profile/profileLabels.js';

	let { children } = $props();

	// One list for the three navigations (#149): phone tab bar, tablet rail, desktop sidebar. Each is
	// its own <nav> shown at its breakpoint by CSS. shortKey is the label under the icon (tab bar,
	// rail); the sidebar uses labelKey. subItems are only listed in the sidebar, in the hub's order.
	const navItems = [
		{ href: '/scope-view', labelKey: 'nav_scope_view', shortKey: 'nav_scope_short', icon: ReticleIcon },
		{
			href: '/calculators',
			labelKey: 'nav_calculators',
			shortKey: 'nav_calculators',
			icon: CalculatorIcon,
			subItems: [
				{ href: '/calculators/ballistic', labelKey: 'calc_ballistic' },
				{ href: '/calculators/dope-cards', labelKey: 'calc_dope_cards' },
				{ href: '/calculators/mpbr', labelKey: 'calc_mpbr' },
				{ href: '/calculators/compare-trajectories', labelKey: 'calc_compare' },
				{ href: '/calculators/trajectory-validation', labelKey: 'calc_trajectory_validation' }
			]
		},
		{ href: '/profiles', labelKey: 'nav_profiles', shortKey: 'nav_profiles', icon: ListIcon },
		{
			href: '/settings',
			labelKey: 'nav_settings',
			shortKey: 'nav_settings',
			icon: SlidersHorizontalIcon,
			// #166: Settings pages; exact, since About contains Licences and Settings contains them all.
			subItems: [
				{ href: '/settings', labelKey: 'settings_general', exact: true },
				{ href: '/settings/about', labelKey: 'settings_about', exact: true },
				{ href: '/settings/privacy', labelKey: 'settings_privacy', exact: true },
				{ href: '/settings/about/licenses', labelKey: 'settings_licenses_short', exact: true }
			]
		}
	];

	// The path without its /fr or /de prefix, so a nav item is active in every language.
	let currentPath = $derived(deLocalizeHref(page.url.pathname));

	// The profile editor (#166) has its own header (back, title, Cancel / Save) on phone and tablet,
	// and a pinned Cancel / Save bar instead of the tab bar on phones.
	let editor = $derived(/^\/profiles\/(?!ammo-selector\/?$)[^/]+\/?$/.test(currentPath));

	// Desktop sidebar (#166): under Profiles, on its sub-pages, every profile (rifle · ammunition)
	// linking to its editor, then "+ New profile".
	let profileSubItems = $derived.by(() => {
		if (!currentPath.startsWith('/profiles/')) return null;
		const items = profiles.list.map(shownProfile).map((p) => {
			const ammo = p.bulletBrand?.trim();
			return { href: `/profiles/${p.id}`, label: ammo ? `${profileName(p)} · ${ammo}` : profileName(p) };
		});
		items.push({ href: '/profiles/new', label: `+ ${m.profiles_new()}` });
		return items;
	});

	// Settings (#166): from 768 px the Settings pane (settings/+layout.svelte) holds the title.
	let settingsSection = $derived(currentPath === '/settings' || currentPath.startsWith('/settings/'));

	// First-run screens (#150) are full screen: no header, rail, sidebar or tab bar.
	const bareRoutes = ['/welcome', '/setup'];
	let bare = $derived(bareRoutes.includes(currentPath.replace(/\/$/, '') || '/'));

	function isActive(href) {
		const path = currentPath;
		if (href === '/scope-view') return path === '/scope-view' || path === '/';
		return path === href || path.startsWith(`${href}/`);
	}

	/** aria-current for a link: "page" on the page itself, "true" on a section the page is in. */
	function currentAttr(href) {
		if (currentPath === href || (href === '/scope-view' && currentPath === '/')) return 'page';
		return isActive(href) ? 'true' : undefined;
	}

	const focusRing = 'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary-500';

	let pageTitle = $derived.by(() => {
		const path = deLocalizeHref(page.url.pathname);
		if (path === '/profiles/new') return m.profiles_new();
		if (path.startsWith('/profiles/ammo-selector')) return m.ammo_selector_title();
		if (path.startsWith('/profiles/')) return m.profiles_edit();
		if (path.startsWith('/profiles')) return m.profiles_title();
		if (path.startsWith('/calculators/compare-trajectories/add')) return m.compare_pick_profile();
		if (path.startsWith('/calculators/compare-trajectories')) return m.compare_title();
		if (path.startsWith('/calculators/ballistic')) return m.ballistic_title();
		if (path.startsWith('/calculators/mpbr')) return m.calc_mpbr();
		if (path.startsWith('/calculators/trajectory-validation')) return m.traj_val_title();
		if (path.startsWith('/calculators/dope-cards/precision-guide')) return m.dope_guide_title();
		if (path.startsWith('/calculators/dope-cards')) return m.dope_title();
		if (path.startsWith('/calculators')) return m.calculators_title();
		if (path.startsWith('/settings/about/licenses')) return m.licenses_title();
		if (path.startsWith('/settings/about')) return m.about_title();
		if (path.startsWith('/settings/privacy')) return m.privacy_title();
		if (path.startsWith('/settings')) return m.settings_title();
		return m.scope_view_title();
	});

	let canGoBack = $derived.by(() => {
		const path = deLocalizeHref(page.url.pathname);
		const topLevel = ['/', '/scope-view', '/calculators', '/profiles', '/settings'];
		return !topLevel.includes(path);
	});

	$effect(() => {
		applyDarkMode(settings.darkMode);
	});

	// The static build serves one index.html for every locale, so its lang is always the base one.
	// The language buttons reload the page, so this runs again after each switch.
	$effect(() => {
		document.documentElement.lang = getLocale();
	});
</script>

<svelte:head>
	<link rel="icon" href={favicon} />
</svelte:head>

<div class="h-dvh flex flex-col" style="padding-top: var(--safe-area-top); padding-bottom: var(--safe-area-bottom);">
	{#if bare}
	<main class="flex-1 min-h-0">
		{@render children()}
	</main>
	{:else}
	<div class="flex-1 flex overflow-hidden">
		<!-- Tablet rail (sm to lg): logo, labelled items, theme button -->
		<nav
			aria-label={m.nav_main()}
			class="hidden sm:flex lg:hidden w-24 shrink-0 flex-col items-center gap-1.5 py-5 overflow-y-auto border-r border-surface-200-800 bg-surface-100-900"
		>
			<img src={favicon} alt="ZRO" class="size-10 mb-4 shrink-0" />
			{#each navItems as item (item.href)}
				{@const Icon = item.icon}
				{@const active = isActive(item.href)}
				<a
					href={localizeHref(item.href)}
					aria-current={currentAttr(item.href)}
					class="w-20 flex flex-col items-center gap-1 py-1.5 rounded-container text-[11px] leading-tight text-center {focusRing} {active
						? 'font-semibold text-primary-700-300'
						: 'text-surface-600-400 hover:text-surface-950-50'}"
				>
					<span
						class="w-14 h-8 rounded-full flex items-center justify-center {active ? 'preset-tonal-primary' : ''}"
					>
						<Icon class="size-[22px]" aria-hidden="true" />
					</span>
					{m[item.shortKey]()}
				</a>
			{/each}
			<div class="flex-1"></div>
			<DarkModeToggle class="border border-surface-200-800" />
		</nav>

		<!-- Desktop sidebar (lg and up) -->
		<aside class="hidden lg:flex w-60 shrink-0 flex-col overflow-y-auto border-r border-surface-200-800 bg-surface-100-900">
			<div class="flex items-center gap-3 px-[18px] py-[18px] border-b border-surface-200-800">
				<img src={favicon} alt="" class="size-[38px] shrink-0" />
				<div>
					<p class="font-extrabold text-xl leading-none">ZRO</p>
					<p class="text-xs leading-none mt-1 text-surface-600-400">{m.app_tagline()}</p>
				</div>
			</div>
			<nav aria-label={m.nav_main()} class="flex flex-col gap-0.5 px-2.5 py-3">
				{#each navItems as item (item.href)}
					{@const Icon = item.icon}
					{@const subItems = item.href === '/profiles' ? profileSubItems : item.subItems}
					<!-- A section whose own page is also a sub-item (Settings > General) fills the sub-item only. -->
					{@const current =
						currentAttr(item.href) === 'page' && subItems?.some((s) => s.href === item.href)
							? 'true'
							: currentAttr(item.href)}
					<a
						href={localizeHref(item.href)}
						aria-current={current}
						class="flex items-center gap-2.5 h-10 px-2.5 rounded-base text-sm {focusRing} {current === 'page'
							? 'preset-filled-primary-500 font-semibold'
							: current
								? 'font-semibold hover:preset-tonal-surface'
								: 'hover:preset-tonal-surface'}"
					>
						<Icon class="size-[18px] shrink-0" aria-hidden="true" />
						{m[item.labelKey]()}
					</a>
					{#if subItems}
						<div class="ml-[19px] pl-2.5 border-l border-surface-200-800 flex flex-col gap-0.5">
							{#each subItems as sub (sub.href)}
								{@const subActive = sub.exact ? currentPath.replace(/(.)\/$/, '$1') === sub.href : isActive(sub.href)}
								<a
									href={localizeHref(sub.href)}
									aria-current={sub.exact ? (subActive ? 'page' : undefined) : currentAttr(sub.href)}
									class="flex items-center min-h-[34px] px-2.5 py-1 rounded-base text-[13px] leading-tight break-words {focusRing} {subActive
										? 'preset-filled-primary-500 font-semibold'
										: 'text-surface-600-400 hover:preset-tonal-surface hover:text-surface-950-50'}"
								>
									{sub.label ?? m[sub.labelKey]()}
								</a>
							{/each}
						</div>
					{/if}
				{/each}
			</nav>
			<div class="flex-1"></div>
			<div class="px-[18px] py-3.5 border-t border-surface-200-800 flex flex-col gap-3">
				<DarkModeToggle variant="segmented" />
				<p class="text-xs text-surface-600-400">v{__APP_VERSION__}</p>
			</div>
		</aside>

		<!-- Page content with header inside scroll area -->
		<main class="flex-1 min-w-0 overflow-y-auto">
			<header class="{editor ? 'hidden' : 'flex'} {settingsSection ? 'md:hidden' : ''} items-center gap-1 pl-4 pr-2 py-2 sm:pl-6 sm:pr-4 lg:hidden">
				{#if canGoBack}
					<button
						type="button"
						onclick={() => history.back()}
						class="btn-icon size-11 shrink-0 -ml-2 rounded-base hover:preset-tonal-surface {focusRing}"
						aria-label={m.common_back()}
						title={m.common_back()}
					>
						<ArrowLeftIcon class="size-5" aria-hidden="true" />
					</button>
				{/if}
				<span class="flex-1 min-w-0 truncate font-bold text-xl">{pageTitle}</span>
				<!-- The rail has its own theme button on tablets -->
				<DarkModeToggle class="sm:hidden" />
			</header>
			<div class="px-2 pb-2 sm:px-2 sm:pb-6 lg:px-8 lg:py-8">
				{@render children()}
			</div>
		</main>
	</div>

	<!-- Phone tab bar (below sm) -->
	<nav
		aria-label={m.nav_main()}
		class="{editor ? 'hidden' : 'grid'} sm:hidden grid-cols-4 px-1.5 pt-1.5 pb-1 border-t border-surface-200-800 bg-surface-100-900"
	>
		{#each navItems as item (item.href)}
			{@const Icon = item.icon}
			{@const active = isActive(item.href)}
			<a
				href={localizeHref(item.href)}
				aria-current={currentAttr(item.href)}
				class="flex flex-col items-center gap-[3px] py-1.5 min-h-11 rounded-container text-[11px] leading-tight text-center {focusRing} {active
					? 'font-semibold text-primary-700-300'
					: 'text-surface-600-400'}"
			>
				<span class="w-[52px] h-7 rounded-full flex items-center justify-center {active ? 'preset-tonal-primary' : ''}">
					<Icon class="size-5" aria-hidden="true" />
				</span>
				{m[item.shortKey]()}
			</a>
		{/each}
	</nav>
	{/if}
</div>
