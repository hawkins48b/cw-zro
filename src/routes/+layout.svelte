<script>
	import '../app.css';
	import favicon from '$lib/assets/favicon.svg';
	import { page } from '$app/state';
	import { m } from '$lib/paraglide/messages.js';
	import { localizeHref } from '$lib/paraglide/runtime';
	import { AppBar, Navigation } from '@skeletonlabs/skeleton-svelte';
	import {
		CrosshairIcon,
		CalculatorIcon,
		TelescopeIcon,
		SettingsIcon
	} from '@lucide/svelte';
	import DarkModeToggle from '$lib/components/DarkModeToggle.svelte';
	import { settings, applyDarkMode } from '$lib/stores/settings.svelte.js';
	import { browser } from '$app/environment';

	let { children } = $props();

	let innerWidth = $state(browser ? window.innerWidth : 1024);

	let navLayout = $derived(
		innerWidth < 640 ? 'bar' : innerWidth < 1024 ? 'rail' : 'sidebar'
	);

	const navItems = [
		{ href: '/scope-view', labelKey: 'nav_scope_view', icon: TelescopeIcon },
		{ href: '/profiles', labelKey: 'nav_profiles', icon: CrosshairIcon },
		{ href: '/calculators', labelKey: 'nav_calculators', icon: CalculatorIcon }
	];

	function isActive(href) {
		const path = page.url.pathname;
		if (href === '/scope-view') return path === '/scope-view' || path === '/';
		return path.startsWith(href);
	}

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
				<a href={localizeHref('/scope-view')} class="flex items-center gap-2">
					<img src={favicon} alt="ZRO" class="size-8" />
					<span class="font-bold text-xl hidden sm:inline">ZRO</span>
				</a>
			</AppBar.Lead>
			<AppBar.Headline>
				<!-- Empty on mobile, page context comes from content -->
			</AppBar.Headline>
			<AppBar.Trail>
				<DarkModeToggle />
				<a href={localizeHref('/settings')} class="btn btn-icon preset-tonal-surface" aria-label={m.nav_settings()}>
					<SettingsIcon class="size-5" />
				</a>
			</AppBar.Trail>
		</AppBar.Toolbar>
	</AppBar>

	<!-- Main area: sidebar/rail + content -->
	<div class="flex-1 flex overflow-hidden">
		<!-- Side navigation (tablet/desktop) -->
		{#if navLayout !== 'bar'}
			<Navigation layout={navLayout} class={navLayout === 'sidebar' ? 'grid grid-rows-[1fr_auto] gap-4' : ''}>
				<Navigation.Content>
					<Navigation.Menu>
						{#each navItems as item}
							{@const Icon = item.icon}
							{@const active = isActive(item.href)}
							<Navigation.TriggerAnchor
								href={localizeHref(item.href)}
								class={active ? 'preset-filled-primary-500' : ''}
							>
								<Icon class={navLayout === 'rail' ? 'size-5' : 'size-4'} />
								<Navigation.TriggerText>{m[item.labelKey]()}</Navigation.TriggerText>
							</Navigation.TriggerAnchor>
						{/each}
					</Navigation.Menu>
				</Navigation.Content>
			</Navigation>
		{/if}

		<!-- Page content -->
		<main class="flex-1 overflow-y-auto p-4 sm:p-6 lg:p-8">
			{@render children()}
		</main>
	</div>

	<!-- Bottom bar navigation (mobile) -->
	{#if navLayout === 'bar'}
		<Navigation layout="bar">
			<Navigation.Menu class="grid grid-cols-3 gap-1">
				{#each navItems as item}
					{@const Icon = item.icon}
					{@const active = isActive(item.href)}
					<Navigation.TriggerAnchor
						href={localizeHref(item.href)}
						class={active ? 'preset-filled-primary-500' : ''}
					>
						<Icon class="size-5" />
						<Navigation.TriggerText class="text-xs">{m[item.labelKey]()}</Navigation.TriggerText>
					</Navigation.TriggerAnchor>
				{/each}
			</Navigation.Menu>
		</Navigation>
	{/if}
</div>
