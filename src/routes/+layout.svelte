<script>
	import '../app.css';
	import favicon from '$lib/assets/favicon.svg';
	import { page } from '$app/state';
	import { m } from '$lib/paraglide/messages.js';
	import { localizeHref, deLocalizeHref } from '$lib/paraglide/runtime';
	import { AppBar, Navigation } from '@skeletonlabs/skeleton-svelte';
	import {
		ListIcon,
		CalculatorIcon,
		SettingsIcon
	} from '@lucide/svelte';
	import ReticleIcon from '$lib/components/ReticleIcon.svelte';
	import DarkModeToggle from '$lib/components/DarkModeToggle.svelte';
	import { settings, applyDarkMode } from '$lib/stores/settings.svelte.js';
	import { browser } from '$app/environment';

	let { children } = $props();

	let innerWidth = $state(browser ? window.innerWidth : 1024);

	let sideNavLayout = $derived(innerWidth < 1024 ? 'rail' : 'sidebar');

	const navItems = [
		{ href: '/scope-view', labelKey: 'nav_scope_view', icon: ReticleIcon },
		{ href: '/calculators', labelKey: 'nav_calculators', icon: CalculatorIcon },
		{ href: '/profiles', labelKey: 'nav_profiles', icon: ListIcon }
	];

	function isActive(href) {
		const path = page.url.pathname;
		if (href === '/scope-view') return path === '/scope-view' || path === '/';
		return path.startsWith(href);
	}

	let pageTitle = $derived.by(() => {
		const path = deLocalizeHref(page.url.pathname);
		if (path.startsWith('/profiles')) return m.profiles_title();
		if (path.startsWith('/calculators')) return m.calculators_title();
		if (path.startsWith('/settings')) return m.settings_title();
		return m.scope_view_title();
	});

	$effect(() => {
		applyDarkMode(settings.darkMode);
	});
</script>

<svelte:window bind:innerWidth />

<svelte:head>
	<link rel="icon" href={favicon} />
</svelte:head>

<div class="h-screen flex flex-col">
	<!-- Top AppBar -->
	<AppBar>
		<AppBar.Toolbar class="grid-cols-[auto_1fr_auto]">
			<AppBar.Lead>
				<a href={localizeHref('/scope-view')} class="hidden sm:flex items-center gap-2">
					<img src={favicon} alt="ZRO" class="size-8" />
					<span class="font-bold text-xl">{m.app_tagline()}</span>
				</a>
				<div class="flex items-center gap-2 sm:hidden">
					<img src={favicon} alt="ZRO" class="size-8" />
					<span class="font-bold text-lg">{pageTitle}</span>
				</div>
			</AppBar.Lead>
			<AppBar.Headline>
				<!-- Empty on mobile, page context comes from content -->
			</AppBar.Headline>
			<AppBar.Trail>
				<DarkModeToggle />
				<a href={localizeHref('/settings')} class="btn btn-icon sm:preset-tonal-surface" aria-label={m.nav_settings()}>
					<SettingsIcon class="size-5" />
				</a>
			</AppBar.Trail>
		</AppBar.Toolbar>
	</AppBar>

	<!-- Main area: sidebar/rail + content -->
	<div class="flex-1 flex overflow-hidden">
		<!-- Side navigation (tablet/desktop) — hidden on mobile via CSS -->
		<div class="hidden sm:contents">
			<Navigation layout={sideNavLayout} class={sideNavLayout === 'sidebar' ? 'grid grid-rows-[1fr_auto] gap-4' : ''}>
				<Navigation.Content>
					<Navigation.Menu>
						{#each navItems as item}
							{@const Icon = item.icon}
							{@const active = isActive(item.href)}
							<Navigation.TriggerAnchor
								href={localizeHref(item.href)}
								class={active ? 'preset-filled-primary-500' : ''}
							>
								<Icon class={sideNavLayout === 'rail' ? 'size-5' : 'size-4'} />
								<Navigation.TriggerText>{m[item.labelKey]()}</Navigation.TriggerText>
							</Navigation.TriggerAnchor>
						{/each}
					</Navigation.Menu>
				</Navigation.Content>
			</Navigation>
		</div>

		<!-- Page content -->
		<main class="flex-1 overflow-y-auto p-4 sm:p-6 lg:p-8">
			{@render children()}
		</main>
	</div>

	<!-- Bottom bar navigation (mobile) — hidden on tablet+ via CSS -->
	<div class="sm:hidden">
		<Navigation layout="bar" class="!p-0">
			<Navigation.Menu class="grid grid-cols-3 !gap-0">
				{#each navItems as item}
					{@const Icon = item.icon}
					{@const active = isActive(item.href)}
					<Navigation.TriggerAnchor
						href={localizeHref(item.href)}
						class="{active ? 'preset-filled-primary-500' : ''} !rounded-none !py-2.5"
					>
						<Icon class="size-6" />
					</Navigation.TriggerAnchor>
				{/each}
			</Navigation.Menu>
		</Navigation>
	</div>
</div>
