<script>
	/**
	 * The profile picker (#166): search, sort chips (Recent / Rifle / Ammo), one list card, the
	 * selected row tinted with a check badge. The picker pattern of the guided setup's ammunition step
	 * (PickerSearch, PickerList, PickerRow), so both look the same.
	 *
	 * Used by: Profiles (tap = put in use), Import review (multiple, grouped by file), and later the
	 * calculators' profile sheet and Compare "Add profile". Show the selection's summary next to it
	 * with ProfileSummaryCard.
	 *
	 * @prop {object[]} profiles      - Profiles as shownProfile gives them (each with `id`), in stored
	 *                                  order (oldest first): "Recent" sorts on that order.
	 * @prop {string|null} [selectedId] - Single choice: the selected profile.
	 * @prop {(id: string) => void} [onselect] - Single choice: a row was tapped.
	 * @prop {boolean} [multiple]     - Checkbox rows instead (import review).
	 * @prop {string[]} [checkedIds]  - multiple: the checked rows.
	 * @prop {(id: string) => void} [ontoggle] - multiple: a row was tapped.
	 * @prop {string[]} [newIds]      - Rows marked "New" (just imported).
	 * @prop {Record<string,string>} [badges] - Outlined badge per id (Compare "On chart"); "New" wins.
	 * @prop {Record<string,string>} [notes] - Warning line per id (e.g. "imported as a copy").
	 * @prop {{ heading: string, note?: string, ids: string[] }[]} [groups] - Show the rows under
	 *                                  these headings, in this order (sorting is then off).
	 * @prop {boolean} [searchable]   - Show the search field (default true).
	 * @prop {boolean} [sortable]     - Show the sort chips when there is more than one profile.
	 * @prop {boolean} [showCount]    - "4 profiles" next to the sort chips.
	 * @prop {string} [label]         - Accessible name of the list (default "Profiles").
	 * @prop {string} [listClass]     - Classes for the list card, e.g. "max-h-80" or "flex-1 min-h-0".
	 * @prop {(p: object, selected: boolean) => string} [rowLabel] - Accessible name of a row.
	 */
	import { m } from '#lib/paraglide/messages.js';
	import { ArrowDown, ArrowUp } from '@lucide/svelte';
	import PickerSearch from '#lib/components/picker/PickerSearch.svelte';
	import PickerList from '#lib/components/picker/PickerList.svelte';
	import PickerRow from '#lib/components/picker/PickerRow.svelte';
	import PickerGroup from '#lib/components/picker/PickerGroup.svelte';
	import { profileName, profileRowDetail, ammoName } from '#lib/components/profile/profileLabels.js';

	let {
		profiles = [],
		selectedId = null,
		onselect,
		multiple = false,
		checkedIds = [],
		ontoggle,
		newIds = [],
		badges = {},
		notes = {},
		groups = null,
		searchable = true,
		sortable = true,
		showCount = false,
		label = undefined,
		listClass = '',
		rowLabel = undefined
	} = $props();

	const uid = $props.id();
	let query = $state('');
	let sortBy = $state('recent');
	let sortDesc = $state(true);

	/** Case-insensitive; "7.5x55" matches "75x55" and "7.5 x 55", as the Ammo Library. */
	function normalize(s) {
		return String(s ?? '').toLowerCase().replace(/[\s\W]+/g, '');
	}

	let sorted = $derived.by(() => {
		const list = [...profiles];
		if (groups) return list;
		const dir = sortDesc ? 1 : -1;
		if (sortBy === 'name') return list.sort((a, b) => dir * profileName(a).localeCompare(profileName(b)));
		if (sortBy === 'ammo') return list.sort((a, b) => dir * ammoName(a).localeCompare(ammoName(b)));
		// Recent: newest first (the list is stored oldest first), a second tap reverses.
		return sortDesc ? list.reverse() : list;
	});

	let shown = $derived.by(() => {
		const q = normalize(query);
		if (!q) return sorted;
		return sorted.filter((p) => normalize(`${p.name} ${ammoName(p)} ${p.ammo ?? ''}`).includes(q));
	});

	let byId = $derived(new Map(shown.map((p) => [p.id, p])));

	function pick(value) {
		if (value === sortBy) sortDesc = !sortDesc;
		else {
			sortBy = value;
			sortDesc = true;
		}
	}

	function isSelected(p) {
		return multiple ? checkedIds.includes(p.id) : p.id === selectedId;
	}

	function tap(p) {
		if (multiple) ontoggle?.(p.id);
		else onselect?.(p.id);
	}

	const sortOptions = [
		{ value: 'recent', label: () => m.profiles_sort_recent() },
		{ value: 'name', label: () => m.profiles_sort_name() },
		{ value: 'ammo', label: () => m.profiles_sort_ammo() }
	];

	const focusRing = 'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary-500';
	let count = $derived(profiles.length === 1 ? m.profiles_count_one() : m.profiles_count({ count: profiles.length }));
</script>

{#snippet row(p)}
	{@const selected = isSelected(p)}
	<PickerRow
		title={profileName(p)}
		detail={profileRowDetail(p)}
		badge={newIds.includes(p.id) ? m.profiles_new_badge() : (badges[p.id] ?? '')}
		badgeTone={newIds.includes(p.id) ? 'tonal' : 'outline'}
		note={notes[p.id] ?? ''}
		{selected}
		{multiple}
		ariaLabel={rowLabel?.(p, selected)}
		onclick={() => tap(p)}
	/>
{/snippet}

<div class="flex flex-col gap-2.5 min-h-0">
	{#if searchable}
		<PickerSearch
			bind:value={query}
			label={m.profiles_search()}
			placeholder={m.profiles_search_placeholder()}
			controls="{uid}-list"
		/>
	{/if}

	{#if (sortable && !groups && profiles.length > 1) || showCount}
		<div class="flex flex-wrap items-center justify-between gap-2">
			{#if sortable && !groups && profiles.length > 1}
				<div role="group" aria-label={m.profiles_sort_label()} class="flex items-center gap-1.5">
					<span class="ml-1 mr-0.5 text-xs text-surface-600-400" aria-hidden="true">{m.profiles_sort_short()}</span>
					{#each sortOptions as opt (opt.value)}
						{@const on = sortBy === opt.value}
						<button
							type="button"
							class="chip touch-hit h-9 min-w-11 px-3 text-[13px] {focusRing} {on
								? 'preset-filled-primary-500 font-semibold'
								: 'preset-tonal-surface font-medium'}"
							aria-pressed={on}
							onclick={() => pick(opt.value)}
						>
							{opt.label()}
							{#if on}
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
			{#if showCount}
				<span class="text-xs text-surface-600-400">{count}</span>
			{/if}
		</div>
	{/if}

	{#if shown.length === 0}
		<p class="mx-1 text-sm text-surface-600-400" role="status">{m.profiles_no_results()}</p>
	{:else if groups}
		<PickerList id="{uid}-list" label={label ?? m.profiles_title()} class={listClass} grouped>
			{#each groups as group (group.heading)}
				{@const items = group.ids.map((id) => byId.get(id)).filter(Boolean)}
				{#if items.length > 0}
					<PickerGroup heading={group.heading} note={group.note ?? ''} level="h3">
						{#each items as p (p.id)}
							{@render row(p)}
						{/each}
					</PickerGroup>
				{/if}
			{/each}
		</PickerList>
	{:else}
		<PickerList id="{uid}-list" label={label ?? m.profiles_title()} class={listClass}>
			{#each shown as p (p.id)}
				{@render row(p)}
			{/each}
		</PickerList>
	{/if}
</div>
