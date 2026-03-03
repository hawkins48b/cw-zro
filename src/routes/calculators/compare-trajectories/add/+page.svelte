<script>
	import { m } from '$lib/paraglide/messages.js';
	import { localizeHref } from '$lib/paraglide/runtime';
	import { profiles } from '$lib/stores/profiles.svelte.js';
	import { compareTrajectories } from '$lib/stores/compareTrajectories.svelte.js';
	import { Crosshair, ArrowUp, ArrowDown, Search, Check, Plus } from '@lucide/svelte';
	import { fly } from 'svelte/transition';

	// ── Sort & search ───────────────────────────────────────────────
	let sortBy = $state('recent');
	let sortDesc = $state(true);
	let searchActive = $state(false);
	let searchQuery = $state('');
	let searchInput = $state(null);

	$effect(() => {
		if (searchActive && searchInput) searchInput.focus();
	});

	const sortOptions = [
		{ value: 'recent', labelKey: 'profiles_sort_recent' },
		{ value: 'name', labelKey: 'profiles_sort_name' },
		{ value: 'ammo', labelKey: 'profiles_sort_ammo' }
	];

	let sortedProfiles = $derived.by(() => {
		const list = profiles.list;
		switch (sortBy) {
			case 'name':
				return [...list].sort((a, b) =>
					sortDesc ? a.name.localeCompare(b.name) : b.name.localeCompare(a.name)
				);
			case 'ammo':
				return [...list].sort((a, b) =>
					sortDesc ? a.ammo.localeCompare(b.ammo) : b.ammo.localeCompare(a.ammo)
				);
			default:
				return sortDesc ? [...list] : [...list].reverse();
		}
	});

	let filteredProfiles = $derived.by(() => {
		const q = searchQuery.trim().toLowerCase();
		if (!q) return sortedProfiles;
		return sortedProfiles.filter(
			(p) => p.name.toLowerCase().includes(q) || p.ammo.toLowerCase().includes(q)
		);
	});

	// ── Set of already-added profile IDs ────────────────────────────
	let addedIds = $derived(new Set(compareTrajectories.entries.map((e) => e.profileId)));

	function handleSortClick(value) {
		if (value === sortBy) {
			sortDesc = !sortDesc;
		} else {
			sortBy = value;
		}
	}

	function toggleSearch() {
		searchActive = !searchActive;
		if (!searchActive) searchQuery = '';
	}

	function addProfile(profileId) {
		const profile = profiles.get(profileId);
		if (!profile) return;
		compareTrajectories.addEntry(
			profileId,
			String(profile.zeroDist ?? '100'),
			profile.zeroUnit ?? 'yd'
		);
	}

	function profileZeroLabel(profile) {
		return `${profile.zeroDist}\u202f${profile.zeroUnit === 'm' ? m.unit_m() : m.unit_yd()}`;
	}
</script>

<svelte:head>
	<title>{m.compare_pick_profile()} — {m.app_name()}</title>
</svelte:head>

<div class="space-y-4">

	{#if profiles.list.length === 0}
		<div class="py-12 text-center space-y-3">
			<p class="text-surface-500-400">{m.compare_no_profiles()}</p>
			<a href={localizeHref('/profiles/new')} class="btn preset-tonal-primary">{m.profiles_new()}</a>
		</div>
	{:else}

		<!-- Sort chips + search + new profile -->
		<div class="flex items-center gap-2 max-w-2xl">
			<div class="flex gap-2 overflow-x-auto pb-1 flex-1">
				{#if profiles.list.length > 1}
					{#each sortOptions as opt}
						{@const isActiveSort = sortBy === opt.value}
						<button
							class="chip shrink-0 {isActiveSort ? 'preset-filled-primary-500' : 'preset-tonal-surface'}"
							onclick={() => handleSortClick(opt.value)}
						>
							{m[opt.labelKey]()}
							{#if isActiveSort}
								{#if sortDesc}
									<ArrowDown class="size-3.5" />
								{:else}
									<ArrowUp class="size-3.5" />
								{/if}
							{/if}
						</button>
					{/each}
				{/if}
			</div>
			<button
				class="btn btn-icon shrink-0 {searchActive ? 'preset-filled-primary-500' : 'preset-tonal-surface'}"
				title={m.profiles_search()}
				onclick={toggleSearch}
			>
				<Search class="size-5" />
			</button>
		</div>

		<!-- Search input -->
		{#if searchActive}
			<div class="max-w-2xl" transition:fly={{ y: -8, duration: 180, opacity: 0 }}>
				<input
					type="search"
					class="input w-full"
					placeholder={m.profiles_search_placeholder()}
					bind:value={searchQuery}
					bind:this={searchInput}
				/>
			</div>
		{/if}

		<!-- Profile list -->
		{#if filteredProfiles.length === 0 && searchQuery.trim()}
			<p class="text-surface-400 max-w-2xl">{m.profiles_no_results()}</p>
		{:else}
			<div class="grid gap-2 max-w-2xl">
				{#each filteredProfiles as profile}
					{@const alreadyAdded = addedIds.has(profile.id)}
					<button
						type="button"
						class="card text-left transition-colors
							{alreadyAdded
								? 'preset-tonal-primary'
								: 'preset-outlined-surface-200-800 bg-surface-50-950 hover:preset-tonal-primary'}"
						onclick={() => addProfile(profile.id)}
					>
						<div class="p-3 flex items-start gap-3">
							<div class="flex-1 min-w-0">
								<p class="font-semibold leading-snug">{profile.name}</p>
								<p class="text-sm mt-0.5 {alreadyAdded ? 'opacity-70' : 'text-surface-500'}">{profile.ammo}</p>
							</div>
							{#if alreadyAdded}
								<Check class="size-5 shrink-0 mt-0.5" />
							{:else}
								<Plus class="size-5 text-surface-400 shrink-0 mt-0.5" />
							{/if}
						</div>
						<div class="border-t px-3 py-2 grid grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-2.5 text-sm
							{alreadyAdded ? 'border-primary-500/20 opacity-70' : 'border-surface-200-800 text-surface-500'}">
							<Crosshair class="size-3.5" />
							<span class="truncate">{profile.optic}</span>
							<span class="chip text-xs font-semibold {alreadyAdded ? 'preset-filled-primary-500' : 'preset-tonal-primary'}">
								{profileZeroLabel(profile)}
							</span>
						</div>
					</button>
				{/each}
			</div>
		{/if}

	{/if}
</div>
