<script>
	import { m } from '#lib/paraglide/messages.js';
	import { localizeHref } from '#lib/paraglide/runtime.js';
	import { profiles } from '#lib/stores/profiles.svelte.js';
	import { activeProfile } from '#lib/stores/activeProfile.svelte.js';
	import { Plus, Pencil, Trash2, Copy, ArrowUp, ArrowDown, Search, Download, EllipsisVertical } from '@lucide/svelte';
	import { fly, fade } from 'svelte/transition';
	import { usePress } from 'svelte-gestures';
	import { swipe } from '#lib/actions/swipe.js';
	import { shownProfile } from '#lib/utils/storedProfiles.js';
	import { copyName } from '#lib/utils/profileOps.js';
	import { profileExportFile } from '#lib/utils/profileExport.js';

	let sortBy = $state('recent');
	let sortDesc = $state(true);
	let searchQuery = $state('');

	// The profiles as the page shows them (#120): names are text, so they sort and search.
	let shownProfiles = $derived(profiles.list.map(shownProfile));

	let sortedProfiles = $derived.by(() => {
		const list = shownProfiles;
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

	const listPress = makePressHandler();

	// ── Delete confirmation ────────────────────────────────────────────────

	let deleteConfirmId = $state(null);
	let deleteSource = $state(null); // 'swipe' | 'menu'
	let deleteConfirmProfile = $derived(shownProfiles.find((p) => p.id === deleteConfirmId) ?? null);

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
	let contextMenuProfile = $derived(shownProfiles.find((p) => p.id === contextMenuId));
	let sheetEl = $state(null);
	// The ⋮ button that opened the sheet: focus goes back to it when the sheet closes (#149).
	let sheetTrigger = null;

	function openContextMenu(id, trigger = null) {
		sheetTrigger = trigger;
		contextMenuId = id;
	}

	function closeContextMenu() {
		if (contextMenuId === null) return;
		contextMenuId = null;
		sheetTrigger?.focus();
		sheetTrigger = null;
	}

	// Move focus into the sheet when it opens, so keyboard and screen reader users land on its actions.
	$effect(() => {
		if (contextMenuId !== null && sheetEl) sheetEl.querySelector('a, button')?.focus();
	});

	function duplicateProfile(id) {
		const src = profiles.get(id);
		if (!src) return;
		const { id: _id, ...rest } = src;
		profiles.add({ ...rest, name: copyName(src) });
		closeContextMenu();
	}

	function deleteFromMenu(id) {
		closeContextMenu();
		setTimeout(() => requestDelete(id, 'menu'), 180);
	}

	/**
	 * Export one profile as a JSON file (#149), through a normal download, as the CSV and dope card
	 * downloads do. The file is built on the device from the stored profile; nothing is sent. A
	 * profile that is missing or not an object gives no file (profileExportFile).
	 * @param {string} id - the profile id, as in profiles.get(id)
	 */
	function exportProfile(id) {
		closeContextMenu();
		const file = profileExportFile(profiles.get(id), new Date());
		if (!file) return;
		const blob = new Blob([file.content], { type: file.type });
		const url = URL.createObjectURL(blob);
		const a = document.createElement('a');
		a.href = url;
		a.download = file.filename;
		a.click();
		URL.revokeObjectURL(url);
	}

	// ── Use: activate profile ──────────────────────────────────────────────
	// Only the Use button activates a profile now (#149): tapping the card body does nothing.

	function useProfile(id) {
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

	/** Meta line of a card: zero distance · muzzle velocity · elevation click, each left out when empty. */
	function metaLine(profile) {
		const parts = [];
		if (profile.zeroDist !== '') parts.push(m.profiles_meta_zero({ distance: zeroLabel(profile) }));
		if (profile.velocity !== '') parts.push(velocityLabel(profile));
		parts.push(`${profile.elevationClickUnit}\u00a0${profile.elevationClickValue}`);
		return parts.join(' · ');
	}

	const focusRing = 'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary-500';

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


{#snippet newProfileButton()}
	<a
		href={localizeHref('/profiles/new')}
		class="btn preset-filled-primary-500 w-full h-[50px] gap-2 text-[15px] font-semibold {focusRing}"
	>
		<Plus class="size-[18px]" strokeWidth={2.5} aria-hidden="true" />
		{m.profiles_new()}
	</a>
{/snippet}

<div class="max-w-2xl flex flex-col gap-2.5 px-2 sm:px-0">
	{#if profiles.list.length === 0}
		<!-- Empty state -->
		<div class="card preset-filled-surface-100-900 border border-surface-200-800 p-5 flex flex-col gap-4">
			<p class="text-sm leading-relaxed text-surface-600-400">{m.profiles_empty()}</p>
			{@render newProfileButton()}
		</div>
	{:else}
		<p class="mx-1 text-sm leading-relaxed text-surface-600-400">{m.profiles_intro()}</p>

		<!-- Search: always visible, filters by rifle or ammo -->
		<label
			class="input !flex !items-center gap-2 h-[46px] px-3 text-surface-600-400 focus-within:outline-2 focus-within:outline-offset-2 focus-within:outline-primary-500"
		>
			<Search class="size-[18px] shrink-0" aria-hidden="true" />
			<input
				type="search"
				class="flex-1 min-w-0 bg-transparent border-none outline-none shadow-none p-0 text-[15px] text-surface-950-50"
				placeholder={m.profiles_search_placeholder()}
				aria-label={m.profiles_search()}
				bind:value={searchQuery}
			/>
		</label>

		<!-- Sort chips: a second tap on the active one reverses the order -->
		{#if profiles.list.length > 1}
			<div role="group" aria-label={m.profiles_sort_label()} class="flex gap-1.5 overflow-x-auto py-1">
				{#each sortOptions as opt (opt.value)}
					{@const isActiveSort = sortBy === opt.value}
					<button
						type="button"
						class="chip touch-hit min-w-11 h-8 px-3 shrink-0 {focusRing} {isActiveSort
							? 'preset-filled-primary-500 font-semibold'
							: 'preset-tonal-surface'}"
						aria-pressed={isActiveSort}
						onclick={() => handleSortClick(opt.value)}
					>
						{m[opt.labelKey]()}
						{#if isActiveSort}
							{#if sortDesc}
								<ArrowDown class="size-3.5" aria-hidden="true" />
							{:else}
								<ArrowUp class="size-3.5" aria-hidden="true" />
							{/if}
						{/if}
					</button>
				{/each}
			</div>
		{/if}

		{#if filteredProfiles.length === 0 && searchQuery.trim()}
			<p class="mx-1 text-sm text-surface-600-400" role="status">{m.profiles_no_results()}</p>
		{:else}
			<!-- listPress spread here so one pointer-controls instance covers all list cards -->
			<ul class="flex flex-col gap-2.5" {...listPress}>
				{#each filteredProfiles as profile (profile.id)}
					{@const isActive = profile.id === activeProfile.id}
					{@const name = profile.name || m.scope_view_profile_unnamed()}
					<li bind:this={itemRefs[profile.id]} data-card-id={profile.id}>
						<div
							class="relative overflow-hidden rounded-container"
							class:bg-error-500={swipeActive[profile.id]}
						>
							{#if !isActive}
								<div class="absolute inset-y-0 right-0 flex items-center pr-5" aria-hidden="true">
									<Trash2 class="size-5 text-white" />
								</div>
							{/if}

							<!-- Card: the swipe action handles horizontal drag (inactive cards only) -->
							<div
								class="relative select-none flex items-center gap-2 py-2 pl-3.5 pr-1.5 rounded-container border border-surface-200-800 preset-filled-surface-100-900"
								use:swipe={{
									canSwipe: !isActive,
									ref: (api) => setSwipeRef(profile.id, api)
								}}
								onswipedelete={() => requestDelete(profile.id, 'swipe')}
								onswipechange={(e) => { swipeActive[profile.id] = e.detail.active; }}
							>
								<div class="flex-1 min-w-0 py-1">
									<p class="flex flex-wrap items-center gap-x-1.5 gap-y-0.5 text-[15px] font-semibold">
										<span class="min-w-0 break-words">{name}</span>
										{#if isActive}
											<span
												class="px-2 py-0.5 rounded-full preset-tonal-primary text-[10px] font-bold tracking-wide uppercase"
											>
												{m.profiles_in_use()}
											</span>
										{/if}
									</p>
									{#if profile.ammo}
										<p class="mt-0.5 text-[13px] text-surface-600-400 break-words">{profile.ammo}</p>
									{/if}
									<p class="mt-1 text-xs text-surface-600-400">{metaLine(profile)}</p>
								</div>

								{#if !isActive}
									<button
										type="button"
										class="btn preset-outlined-surface-300-700 h-11 px-3.5 shrink-0 text-[13px] font-semibold {focusRing}"
										aria-label={m.profiles_use_named({ name })}
										onclick={() => useProfile(profile.id)}
									>
										{m.profiles_use()}
									</button>
								{/if}
								<button
									type="button"
									class="btn-icon size-11 shrink-0 rounded-base text-surface-600-400 hover:preset-tonal-surface {focusRing}"
									aria-label={m.profiles_more_actions({ name })}
									aria-haspopup="dialog"
									title={m.profiles_more_actions({ name })}
									onclick={(e) => openContextMenu(profile.id, e.currentTarget)}
								>
									<EllipsisVertical class="size-[18px]" aria-hidden="true" />
								</button>
							</div>
						</div>
					</li>
				{/each}
			</ul>
		{/if}

		<div class="pt-1">
			{@render newProfileButton()}
		</div>
	{/if}
</div>

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
			max-w-lg mx-auto px-4 pt-3"
		style="padding-bottom: calc(2rem + var(--safe-area-bottom));"
		role="dialog"
		aria-modal="true"
		aria-labelledby="profile-sheet-title"
		bind:this={sheetEl}
	>
		<div class="w-10 h-1 bg-surface-300-700 rounded-full mx-auto mb-4" aria-hidden="true"></div>
		<p id="profile-sheet-title" class="font-semibold text-center mb-5 truncate px-4">
			{contextMenuProfile?.name || m.scope_view_profile_unnamed()}
		</p>

		<div class="grid gap-2">
			<a
				href={localizeHref(`/profiles/${contextMenuId}`)}
				class="btn preset-tonal-surface justify-start gap-3 h-12"
			>
				<Pencil class="size-5" aria-hidden="true" />
				{m.common_edit()}
			</a>
			<button
				class="btn preset-tonal-surface justify-start gap-3 h-12"
				onclick={() => duplicateProfile(contextMenuId)}
			>
				<Copy class="size-5" aria-hidden="true" />
				{m.profiles_duplicate()}
			</button>
			<button
				type="button"
				class="btn preset-tonal-surface justify-start gap-3 h-12"
				onclick={() => exportProfile(contextMenuId)}
			>
				<Download class="size-5" aria-hidden="true" />
				{m.profiles_export()}
			</button>
			{#if contextMenuId !== activeProfile.id}
				<button
					class="btn preset-tonal-error justify-start gap-3 h-12"
					onclick={() => deleteFromMenu(contextMenuId)}
				>
					<Trash2 class="size-5" aria-hidden="true" />
					{m.common_delete()}
				</button>
			{/if}
		</div>

		<button class="btn preset-outlined-surface-200-800 w-full mt-3 h-11" onclick={closeContextMenu}>
			{m.common_cancel()}
		</button>
	</div>
{/if}
