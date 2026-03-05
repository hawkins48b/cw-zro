<script>
	import { m } from '$lib/paraglide/messages.js';
	import { localizeHref } from '$lib/paraglide/runtime';
	import { profiles } from '$lib/stores/profiles.svelte.js';
	import { activeProfile } from '$lib/stores/activeProfile.svelte.js';
	import { Plus, Pencil, Trash2, Crosshair, Copy, ArrowUp, ArrowDown, Search } from '@lucide/svelte';
	import { fly, fade } from 'svelte/transition';
	import { usePress } from 'svelte-gestures';
	import { swipe } from '$lib/actions/swipe.js';

	let sortBy = $state('recent');
	let sortDesc = $state(true);
	let searchActive = $state(false);
	let searchQuery = $state('');
	let searchInput = $state(null);

	$effect(() => {
		if (searchActive && searchInput) searchInput.focus();
	});

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
			default: // 'recent'
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

	// ── Long press (context menu) ──────────────────────────────────────────

	function makePressHandler() {
		return usePress(
			(e) => {
				const wrapper = e.detail.target?.closest('[data-card-id]');
				if (!wrapper) return;
				wrapper.addEventListener('click', stopClick, { capture: true, once: true });
				openContextMenu(wrapper.dataset.cardId);
			},
			() => ({ timeframe: 500, spread: 10, triggerBeforeFinished: true, touchAction: 'auto' })
		);
	}

	function stopClick(e) {
		e.stopPropagation();
	}

	const pinnedPress = makePressHandler();
	const listPress = makePressHandler();

	// ── Delete confirmation ────────────────────────────────────────────────

	let deleteConfirmId = $state(null);
	let deleteSource = $state(null); // 'swipe' | 'menu'
	let deleteConfirmProfile = $derived(profiles.list.find((p) => p.id === deleteConfirmId) ?? null);

	function requestDelete(id, source = 'menu') {
		deleteConfirmId = id;
		deleteSource = source;
	}

	function confirmDelete() {
		const id = deleteConfirmId;
		const source = deleteSource;
		deleteConfirmId = null;
		deleteSource = null;
		if (source === 'swipe') {
			swipeRefs[id]?.flyOut(() => collapseAndRemove(id));
		} else {
			setTimeout(() => collapseAndRemove(id), 50);
		}
	}

	function cancelDelete() {
		const id = deleteConfirmId;
		const source = deleteSource;
		deleteConfirmId = null;
		deleteSource = null;
		if (source === 'swipe') {
			swipeRefs[id]?.snapBack();
		}
	}

	// ── Context menu ───────────────────────────────────────────────────────

	let contextMenuId = $state(null);
	let contextMenuProfile = $derived(profiles.list.find((p) => p.id === contextMenuId));

	function openContextMenu(id) {
		contextMenuId = id;
	}

	function closeContextMenu() {
		contextMenuId = null;
	}

	function duplicateProfile(id) {
		const src = profiles.get(id);
		if (!src) return;
		const { id: _id, ...rest } = src;
		profiles.add({ ...rest, name: `${rest.name} - Copy` });
		closeContextMenu();
	}

	function deleteFromMenu(id) {
		closeContextMenu();
		setTimeout(() => requestDelete(id, 'menu'), 180);
	}

	// ── Tap: activate profile ──────────────────────────────────────────────

	function handleCardTap(id) {
		if (id !== activeProfile.id) activeProfile.setActive(id);
	}

	// ── Swipe refs & background state ─────────────────────────────────────

	const swipeRefs = {};

	function setSwipeRef(id, api) {
		if (api) swipeRefs[id] = api;
		else delete swipeRefs[id];
	}

	let swipeActive = $state({});

	// ── Collapse & remove ──────────────────────────────────────────────────

	let itemRefs = $state({});

	function collapseAndRemove(id) {
		const el = itemRefs[id];
		if (!el) { removeFromList(id); return; }
		const h = el.getBoundingClientRect().height;
		el.animate(
			[{ height: `${h}px`, overflow: 'hidden' }, { height: '0px', overflow: 'hidden' }],
			{ duration: 220, easing: 'ease', fill: 'forwards' }
		).onfinish = () => removeFromList(id);
	}

	function removeFromList(id) {
		if (activeProfile.id === id) activeProfile.setActive(profiles.list.find((p) => p.id !== id)?.id ?? null);
		profiles.remove(id);
		delete swipeActive[id];
		delete swipeRefs[id];
		delete itemRefs[id];
	}

	// ── Misc ───────────────────────────────────────────────────────────────

	function zeroLabel(profile) {
		return `${profile.zeroDist}\u202f${profile.zeroUnit === 'yd' ? m.unit_yd() : m.unit_m()}`;
	}

	function velocityLabel(profile) {
		return `${profile.velocity}\u202f${profile.velocityUnit === 'fps' ? m.unit_fps() : m.unit_mps()}`;
	}

	const reticleLabels = {
		'red-dot': () => m.scope_view_reticle_red_dot(),
		'moa': () => m.scope_view_reticle_moa(),
		'mrad': () => m.scope_view_reticle_mrad(),
		'mil-dot': () => m.scope_view_reticle_mil_dot()
	};

	function reticleLabel(profile) {
		return reticleLabels[profile.reticleType]?.() ?? profile.reticleType;
	}

	const sortOptions = [
		{ value: 'recent', labelKey: 'profiles_sort_recent' },
		{ value: 'name', labelKey: 'profiles_sort_name' },
		{ value: 'ammo', labelKey: 'profiles_sort_ammo' }
	];
</script>

<svelte:head>
	<title>{m.profiles_title()} — {m.app_name()}</title>
</svelte:head>

<svelte:window onkeydown={(e) => {
	if (e.key !== 'Escape') return;
	if (deleteConfirmId !== null) cancelDelete();
	else closeContextMenu();
}} />


{#if profiles.list.length === 0}
	<!-- Toolbar with just the add button -->
	<div class="flex justify-end mb-4 max-w-2xl">
		<a
			href={localizeHref('/profiles/new')}
			class="btn btn-icon preset-filled-primary-500"
			title={m.profiles_new()}
		>
			<Plus class="size-5" />
		</a>
	</div>
	<p class="text-surface-400">{m.profiles_empty()}</p>
{:else}
	<!-- Active profile pinned above the filter -->
	{#if activeProfile.profile}
		{@const profile = activeProfile.profile}
		<div class="mb-6 max-w-2xl" bind:this={itemRefs[profile.id]}>
			<div
				class="card select-none preset-tonal-primary"
				data-card-id={profile.id}
				{...pinnedPress}
			>
				<div class="p-4 flex items-start gap-3">
					<div class="flex-1 min-w-0">
						<p class="font-semibold text-lg leading-snug">{profile.name}</p>
						<p class="text-sm mt-0.5 opacity-70">{profile.ammo} — {velocityLabel(profile)}</p>
					</div>
					<a
						href={localizeHref(`/profiles/${profile.id}`)}
						class="btn btn-icon preset-tonal-primary hidden sm:flex shrink-0 -mr-1"
						title={m.common_edit()}
					>
						<Pencil class="size-4" />
					</a>
				</div>
				<div class="border-t border-primary-500/20 px-4 py-2.5 flex items-center gap-2.5 text-sm opacity-70">
					<Crosshair class="size-3.5 shrink-0" />
					<span class="truncate">{profile.optic}</span>
					<span class="chip text-xs font-semibold preset-filled-primary-500 shrink-0 ml-auto">
						{reticleLabel(profile)}
					</span>
					<span class="chip text-xs font-semibold preset-filled-primary-500 shrink-0">
						{zeroLabel(profile)}
					</span>
				</div>
			</div>
		</div>
	{/if}

	<!-- Sort filter + search + add button -->
	<div class="flex items-center gap-2 mb-2 max-w-2xl">
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
		<a
			href={localizeHref('/profiles/new')}
			class="btn btn-icon preset-filled-primary-500 shrink-0"
			title={m.profiles_new()}
		>
			<Plus class="size-5" />
		</a>
	</div>

	<!-- Search input -->
	{#if searchActive}
		<div class="mb-4 max-w-2xl" transition:fly={{ y: -8, duration: 180, opacity: 0 }}>
			<input
				type="search"
				class="input w-full"
				placeholder={m.profiles_search_placeholder()}
				bind:value={searchQuery}
				bind:this={searchInput}
			/>
		</div>
	{/if}

	{#if profiles.list.length > 1}
		{#if filteredProfiles.length === 0 && searchQuery.trim()}
			<p class="text-surface-400 max-w-2xl">{m.profiles_no_results()}</p>
		{:else}
		<!-- listPress spread here so one pointer-controls instance covers all list cards -->
		<div class="grid gap-3 max-w-2xl" {...listPress}>
			{#each filteredProfiles as profile (profile.id)}
				{@const isActive = profile.id === activeProfile.id}
				<div bind:this={itemRefs[profile.id]} data-card-id={profile.id}>
					<div
						class="relative overflow-hidden rounded-container"
						class:bg-error-500={swipeActive[profile.id]}
					>
						{#if !isActive}
							<div class="absolute inset-y-0 right-0 flex items-center pr-5">
								<Trash2 class="size-5 text-white" />
							</div>
						{/if}

						<!-- Card — swipe action handles horizontal drag -->
						<div
							class="card select-none relative {isActive
								? 'preset-tonal-primary'
								: 'preset-outlined-surface-200-800 bg-surface-50-950'}"
							style:border-radius="0"
							use:swipe={{
								canSwipe: !isActive,
								ref: (api) => setSwipeRef(profile.id, api)
							}}
							onswipedelete={() => requestDelete(profile.id, 'swipe')}
							onswipechange={(e) => { swipeActive[profile.id] = e.detail.active; }}
						>
							<!-- Tap area -->
							<div
								class="p-4 flex items-start gap-3 cursor-pointer"
								role="button"
								tabindex="0"
								onclick={() => handleCardTap(profile.id)}
								onkeydown={(e) => e.key === 'Enter' && handleCardTap(profile.id)}
							>
								<div class="flex-1 min-w-0">
									<div class="flex items-center gap-2 flex-wrap">
										<p class="font-semibold text-lg leading-snug">{profile.name}</p>
										{#if isActive}
											<span class="chip text-xs preset-filled-primary-500">{m.profiles_active()}</span>
										{/if}
									</div>
									<p class="text-sm mt-0.5 {isActive ? 'opacity-70' : 'text-surface-500'}">
										{profile.ammo} — {velocityLabel(profile)}
									</p>
								</div>

								<a
									href={localizeHref(`/profiles/${profile.id}`)}
									class="btn btn-icon {isActive ? 'preset-tonal-primary' : 'preset-tonal-surface'} hidden sm:flex shrink-0 -mr-1"
									title={m.common_edit()}
									onclick={(e) => e.stopPropagation()}
								>
									<Pencil class="size-4" />
								</a>
							</div>

							<div
								role="button"
								tabindex="0"
								onclick={() => handleCardTap(profile.id)}
								onkeydown={(e) => e.key === 'Enter' && handleCardTap(profile.id)}
								class="border-t px-4 py-2.5 flex items-center gap-2.5 text-sm cursor-pointer
									{isActive ? 'border-primary-500/20 opacity-70' : 'border-surface-200-800 text-surface-500'}"
							>
								<Crosshair class="size-3.5 shrink-0" />
								<span class="truncate">{profile.optic}</span>
								<span
									class="chip text-xs font-semibold shrink-0 ml-auto
										{isActive ? 'preset-filled-primary-500' : 'preset-tonal-primary'}"
								>
									{reticleLabel(profile)}
								</span>
								<span
									class="chip text-xs font-semibold shrink-0
										{isActive ? 'preset-filled-primary-500' : 'preset-tonal-primary'}"
								>
									{zeroLabel(profile)}
								</span>
							</div>
						</div>
					</div>
				</div>
			{/each}
		</div>
		{/if}
	{/if}
{/if}

<!-- Delete confirmation dialog -->
{#if deleteConfirmId !== null}
	<div
		transition:fade={{ duration: 180 }}
		class="fixed inset-0 z-50 bg-black/50"
		role="presentation"
		onclick={cancelDelete}
	></div>
	<div
		transition:fly={{ y: 16, duration: 220, opacity: 0 }}
		class="fixed inset-0 z-50 flex items-center justify-center p-4 pointer-events-none"
	>
		<div
			class="card preset-filled-surface-100-900 p-6 w-full max-w-sm shadow-2xl pointer-events-auto"
			role="dialog"
			aria-modal="true"
			aria-labelledby="delete-dialog-title"
			aria-describedby="delete-dialog-desc"
		>
			<h2 id="delete-dialog-title" class="h5 mb-2">{m.profiles_delete()}</h2>
			<p id="delete-dialog-desc" class="text-surface-500 mb-6">
				{m.profiles_delete_confirm({ name: deleteConfirmProfile?.name ?? '' })}
			</p>
			<footer class="flex gap-2 justify-end">
				<button class="btn preset-tonal-surface" onclick={cancelDelete}>
					{m.common_cancel()}
				</button>
				<button class="btn preset-filled-error-500" onclick={confirmDelete}>
					{m.common_delete()}
				</button>
			</footer>
		</div>
	</div>
{/if}

<!-- Context menu bottom sheet -->
{#if contextMenuId}
	<div
		transition:fade={{ duration: 180 }}
		class="fixed inset-0 z-40 bg-black/50"
		role="presentation"
		onclick={closeContextMenu}
	></div>

	<div
		transition:fly={{ y: 320, duration: 280, opacity: 1 }}
		class="fixed bottom-0 inset-x-0 z-50 bg-surface-100-900 rounded-t-2xl shadow-2xl
			max-w-lg mx-auto px-4 pt-3 pb-8"
	>
		<div class="w-10 h-1 bg-surface-300-700 rounded-full mx-auto mb-4"></div>
		<p class="font-semibold text-center mb-5 truncate px-4">{contextMenuProfile?.name}</p>

		<div class="grid gap-2">
			<a
				href={localizeHref(`/profiles/${contextMenuId}`)}
				class="btn preset-tonal-surface justify-start gap-3 h-12"
			>
				<Pencil class="size-5" />
				{m.common_edit()}
			</a>
			<button
				class="btn preset-tonal-surface justify-start gap-3 h-12"
				onclick={() => duplicateProfile(contextMenuId)}
			>
				<Copy class="size-5" />
				{m.profiles_duplicate()}
			</button>
			{#if contextMenuId !== activeProfile.id}
				<button
					class="btn preset-tonal-error justify-start gap-3 h-12"
					onclick={() => deleteFromMenu(contextMenuId)}
				>
					<Trash2 class="size-5" />
					{m.common_delete()}
				</button>
			{/if}
		</div>

		<button class="btn preset-outlined-surface-200-800 w-full mt-3 h-11" onclick={closeContextMenu}>
			{m.common_cancel()}
		</button>
	</div>
{/if}
