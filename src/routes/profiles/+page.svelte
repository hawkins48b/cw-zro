<script>
	import { m } from '$lib/paraglide/messages.js';
	import { localizeHref } from '$lib/paraglide/runtime';
	import { Plus, Pencil, Trash2, Crosshair, Copy, ArrowUp, ArrowDown } from '@lucide/svelte';
	import { fly, fade } from 'svelte/transition';

	// Mock data — replace with profiles.list once form is wired up
	let profileList = $state([
		{
			id: '1',
			name: 'Remington 700',
			ammo: '.308 Win · Sierra 168gr MatchKing',
			optic: 'Vortex Razor HD Gen II 4.5-27x56',
			zeroDist: 100,
			zeroUnit: 'yd'
		},
		{
			id: '2',
			name: 'Tikka T3x CTR',
			ammo: '6.5 Creedmoor · Hornady 140gr ELD Match',
			optic: 'Schmidt & Bender PMII 5-25x56',
			zeroDist: 200,
			zeroUnit: 'm'
		},
		{
			id: '3',
			name: 'Accuracy International AXMC',
			ammo: '.338 Lapua Mag · Lapua 250gr Scenar',
			optic: 'Kahles K525i 5-25x56',
			zeroDist: 300,
			zeroUnit: 'm'
		},
		{
			id: '4',
			name: 'Ruger Precision Rifle',
			ammo: '6.5 Creedmoor · Berger 130gr AR Hybrid',
			optic: 'Nightforce ATACR 5-25x56',
			zeroDist: 100,
			zeroUnit: 'yd'
		},
		{
			id: '5',
			name: 'Christensen Arms MPR',
			ammo: '.300 Win Mag · Hornady 212gr ELD-X',
			optic: 'Leupold Mark 5HD 5-25x56',
			zeroDist: 200,
			zeroUnit: 'yd'
		},
		{
			id: '6',
			name: 'Sako TRG-42',
			ammo: '.338 Lapua Mag · Berger 300gr OTM Tactical',
			optic: 'March Tactical 5-40x56',
			zeroDist: 100,
			zeroUnit: 'm'
		},
		{
			id: '7',
			name: 'Barrett MRAD',
			ammo: '.300 Norma Mag · Lapua 230gr Scenar-L',
			optic: 'Tangent Theta TT315M 5-25x56',
			zeroDist: 100,
			zeroUnit: 'm'
		}
	]);

	let activeId = $state('1');
	let sortBy = $state('recent');
	let sortDesc = $state(true); // true = newest first

	let activeProfile = $derived(profileList.find((p) => p.id === activeId));

	let sortedProfiles = $derived.by(() => {
		switch (sortBy) {
			case 'name':
				return [...profileList].sort((a, b) =>
					sortDesc ? a.name.localeCompare(b.name) : b.name.localeCompare(a.name)
				);
			case 'ammo':
				return [...profileList].sort((a, b) =>
					sortDesc ? a.ammo.localeCompare(b.ammo) : b.ammo.localeCompare(a.ammo)
				);
			default: // 'recent'
				return sortDesc ? [...profileList] : [...profileList].reverse();
		}
	});

	function handleSortClick(value) {
		if (value === sortBy) {
			sortDesc = !sortDesc;
		} else {
			sortBy = value;
		}
	}

	// --- Context menu ---
	let contextMenuId = $state(null);
	let contextMenuProfile = $derived(profileList.find((p) => p.id === contextMenuId));

	function openContextMenu(id) {
		contextMenuId = id;
	}

	function closeContextMenu() {
		contextMenuId = null;
	}

	function duplicateProfile(id) {
		const src = profileList.find((p) => p.id === id);
		if (!src) return;
		profileList = [...profileList, { ...src, id: crypto.randomUUID(), name: `${src.name} (copy)` }];
		closeContextMenu();
	}

	function deleteFromMenu(id) {
		closeContextMenu();
		setTimeout(() => collapseAndRemove(id), 180);
	}

	// --- Tap: activate profile ---
	const suppressNextClick = {};

	function handleCardTap(id) {
		if (suppressNextClick[id]) {
			suppressNextClick[id] = false;
			return;
		}
		if (id !== activeId) activeId = id;
	}

	// --- Long press: open context menu ---
	const LONG_PRESS_MS = 500;
	const longPressTimers = {};
	const longPressOrigin = {};
	let longPressingDown = $state({});

	function handlePointerDown(e, id) {
		// Don't start a long press from the desktop edit button (it stops propagation)
		longPressOrigin[id] = { x: e.clientX, y: e.clientY };
		longPressingDown[id] = true;
		suppressNextClick[id] = false;

		longPressTimers[id] = setTimeout(() => {
			longPressingDown[id] = false;
			suppressNextClick[id] = true;
			openContextMenu(id);
		}, LONG_PRESS_MS);
	}

	function handlePointerMove(e, id) {
		const o = longPressOrigin[id];
		if (!o || !longPressTimers[id]) return;
		if (Math.abs(e.clientX - o.x) > 8 || Math.abs(e.clientY - o.y) > 8) {
			cancelLongPress(id);
		}
	}

	function handlePointerUp(id) {
		cancelLongPress(id);
	}

	function cancelLongPress(id) {
		clearTimeout(longPressTimers[id]);
		delete longPressTimers[id];
		longPressingDown[id] = false;
	}

	// --- Swipe-to-delete ---
	let swipeOffsets = $state({});
	let swipeAnimating = $state({});
	const swipeStartX = {};
	let itemRefs = $state({});

	function startSwipe(e, id) {
		if (id === activeId) return;
		if (contextMenuId) closeContextMenu();
		swipeStartX[id] = e.touches[0].clientX;
		swipeAnimating[id] = false;
	}

	function moveSwipe(e, id) {
		const dx = e.touches[0].clientX - (swipeStartX[id] ?? 0);
		if (Math.abs(dx) > 8) cancelLongPress(id); // movement cancels long press
		if (dx < 0) swipeOffsets[id] = Math.max(dx, -100);
	}

	function endSwipe(id) {
		if ((swipeOffsets[id] ?? 0) < -60) {
			swipeAnimating[id] = true;
			swipeOffsets[id] = -600;
			setTimeout(() => collapseAndRemove(id), 300);
		} else {
			swipeAnimating[id] = true;
			swipeOffsets[id] = 0;
			setTimeout(() => (swipeAnimating[id] = false), 300);
		}
	}

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
		const newList = profileList.filter((p) => p.id !== id);
		profileList = newList;
		if (activeId === id) activeId = newList[0]?.id ?? null;
		delete swipeOffsets[id];
		delete swipeAnimating[id];
		delete itemRefs[id];
	}

	function zeroLabel(profile) {
		return `${profile.zeroDist}\u202f${profile.zeroUnit === 'yd' ? m.unit_yd() : m.unit_m()}`;
	}

	const sortOptions = [
		{ value: 'recent', labelKey: 'profiles_sort_recent' },
		{ value: 'name', labelKey: 'profiles_sort_name' },
		{ value: 'ammo', labelKey: 'profiles_sort_ammo' }
	];

	function cardTransform(id) {
		const x = swipeOffsets[id] ?? 0;
		const scale = longPressingDown[id] ? 0.96 : 1;
		return `translateX(${x}px) scale(${scale})`;
	}

	function cardTransition(id) {
		if (swipeAnimating[id]) return 'transform 300ms ease';
		if (longPressingDown[id]) return 'transform 500ms ease';
		return 'none';
	}
</script>

<svelte:head>
	<title>{m.profiles_title()} — {m.app_name()}</title>
</svelte:head>

<svelte:window onkeydown={(e) => e.key === 'Escape' && closeContextMenu()} />

<!-- Page header -->
<header class="hidden sm:block mb-6">
	<div class="space-y-1">
		<h1 class="h1">{m.profiles_title()}</h1>
		<p class="text-surface-500">{m.profiles_subtitle()}</p>
	</div>
</header>

{#if profileList.length === 0}
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
	{#if activeProfile}
		{@const profile = activeProfile}
		<div class="mb-6 max-w-2xl" bind:this={itemRefs[profile.id]}>
			<div
				class="card select-none preset-tonal-primary"
				onpointerdown={(e) => handlePointerDown(e, profile.id)}
				onpointermove={(e) => handlePointerMove(e, profile.id)}
				onpointerup={() => handlePointerUp(profile.id)}
				onpointercancel={() => cancelLongPress(profile.id)}
			>
				<div class="p-4 flex items-start gap-3">
					<div class="flex-1 min-w-0">
						<p class="font-semibold text-lg leading-snug">{profile.name}</p>
						<p class="text-sm mt-0.5 opacity-70">{profile.ammo}</p>
					</div>
					<a
						href={localizeHref(`/profiles/${profile.id}`)}
						class="btn btn-icon preset-tonal-primary hidden sm:flex shrink-0 -mr-1"
						title={m.common_edit()}
						onpointerdown={(e) => e.stopPropagation()}
					>
						<Pencil class="size-4" />
					</a>
				</div>
				<div class="border-t border-primary-500/20 px-4 py-2.5 grid grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-2.5 text-sm opacity-70">
					<Crosshair class="size-3.5" />
					<span class="truncate">{profile.optic}</span>
					<span class="chip text-xs font-semibold preset-filled-primary-500">
						{zeroLabel(profile)}
					</span>
				</div>
			</div>
		</div>
	{/if}

	<!-- Sort filter + add button -->
	<div class="flex items-center gap-2 mb-4 max-w-2xl">
		<div class="flex gap-2 overflow-x-auto pb-1 flex-1">
			{#if profileList.length > 1}
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
		<a
			href={localizeHref('/profiles/new')}
			class="btn btn-icon preset-filled-primary-500 shrink-0"
			title={m.profiles_new()}
		>
			<Plus class="size-5" />
		</a>
	</div>

	{#if profileList.length > 1}
		<div class="grid gap-3 max-w-2xl">
			{#each sortedProfiles as profile (profile.id)}
				{@const isActive = profile.id === activeId}
				<div bind:this={itemRefs[profile.id]}>
					<div
						class="relative overflow-hidden rounded-container"
						class:bg-error-500={!isActive && (swipeOffsets[profile.id] ?? 0) < 0}
					>
						{#if !isActive}
							<div class="absolute inset-y-0 right-0 flex items-center pr-5">
								<Trash2 class="size-5 text-white" />
							</div>
						{/if}

						<!-- Card -->
						<div
							class="card select-none relative {isActive
								? 'preset-tonal-primary'
								: 'preset-outlined-surface-200-800 bg-surface-50-950'}"
							style:border-radius="0"
							style:transform={cardTransform(profile.id)}
							style:transition={cardTransition(profile.id)}
							ontouchstart={!isActive ? (e) => startSwipe(e, profile.id) : undefined}
							ontouchmove={!isActive ? (e) => moveSwipe(e, profile.id) : undefined}
							ontouchend={!isActive ? () => endSwipe(profile.id) : undefined}
							onpointerdown={(e) => handlePointerDown(e, profile.id)}
							onpointermove={(e) => handlePointerMove(e, profile.id)}
							onpointerup={() => handlePointerUp(profile.id)}
							onpointercancel={() => cancelLongPress(profile.id)}
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
										{profile.ammo}
									</p>
								</div>

								<a
									href={localizeHref(`/profiles/${profile.id}`)}
									class="btn btn-icon {isActive ? 'preset-tonal-primary' : 'preset-tonal-surface'} hidden sm:flex shrink-0 -mr-1"
									title={m.common_edit()}
									onclick={(e) => e.stopPropagation()}
									onpointerdown={(e) => e.stopPropagation()}
								>
									<Pencil class="size-4" />
								</a>
							</div>

							<div onclick={() => handleCardTap(profile.id)}
								class="border-t px-4 py-2.5 grid grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-2.5 text-sm cursor-pointer
									{isActive ? 'border-primary-500/20 opacity-70' : 'border-surface-200-800 text-surface-500'}"
							>
								<Crosshair class="size-3.5" />
								<span class="truncate">{profile.optic}</span>
								<span
									class="chip text-xs font-semibold
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
			{#if contextMenuId !== activeId}
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
