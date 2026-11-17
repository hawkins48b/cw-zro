<script>
	/**
	 * Ammo Library (#166): the picker pattern. A tap selects, "Use this ammunition" fills the bullet
	 * fields of the profile being edited (ammoSelection) and goes back to it; Cancel goes back without
	 * a change. Groups "From your profiles" and "Library". Desktop: a table with diameter, weight, BC,
	 * drag model and length, and the selection on the right.
	 */
	import { goto } from '$app/navigation';
	import { page } from '$app/state';
	import { localizeHref } from '#lib/paraglide/runtime.js';
	import { m } from '#lib/paraglide/messages.js';
	import { Check } from '@lucide/svelte';
	import { profiles } from '#lib/stores/profiles.svelte.js';
	import { ammoSelection } from '#lib/stores/ammoSelection.svelte.js';
	import { formDraft } from '#lib/stores/formDraft.svelte.js';
	import { safeReturnPath } from '#lib/utils/profileOps.js';
	import { shownProfile } from '#lib/utils/storedProfiles.js';
	import ammoData from '#lib/data/ammo.json';
	import PickerSearch from '#lib/components/picker/PickerSearch.svelte';
	import PickerList from '#lib/components/picker/PickerList.svelte';
	import PickerGroup from '#lib/components/picker/PickerGroup.svelte';
	import PickerRow from '#lib/components/picker/PickerRow.svelte';
	import AmmoSummaryCard from '#lib/components/picker/AmmoSummaryCard.svelte';
	import { withUnit, numberText } from '#lib/components/profile/profileLabels.js';

	const uid = $props.id();
	const returnPath = safeReturnPath(page.url.searchParams.get('return'));

	// The profile being edited, from the draft its form saved before coming here.
	const draftForm = formDraft.pending?.form ?? null;
	const forName = draftForm?.name?.trim() ?? '';

	// Extract unique ammo from existing profiles, read as the pages show them (#120)
	const profileAmmo = [...new Map(
		profiles.list
			.map(shownProfile)
			.filter(p => p.bulletBrand && p.bulletWeight && p.bulletDiameter && p.bc)
			.map(p => [
				p.bulletBrand + '|' + p.bulletWeight + '|' + p.bulletWeightUnit + '|' + p.bulletDiameter,
				{
					brand: p.bulletBrand,
					weight: Number(p.bulletWeight),
					weightUnit: p.bulletWeightUnit.toUpperCase(),
					diameter: Number(p.bulletDiameter),
					diameterUnit: p.bulletDiameterUnit.toUpperCase(),
					ballisticCoefficient: Number(p.bc),
					ballisticCoefficientProfile: p.bcType,
					length: p.bulletLength ? Number(p.bulletLength) : null,
					lengthUnit: p.bulletLengthUnit?.toUpperCase() ?? 'IN'
				}
			])
	).values()];

	// Every entry gets a key: the same load can be in both groups.
	const entries = [
		...profileAmmo.map((item, i) => ({ key: `p${i}`, group: 'profiles', item })),
		...ammoData.map((item, i) => ({ key: `l${i}`, group: 'library', item }))
	];

	/** The entry the profile already uses, selected on arrival (from its profiles first). */
	function initialKey() {
		if (!draftForm?.bulletBrand) return null;
		const same = (it) =>
			it.brand === draftForm.bulletBrand &&
			String(it.weight) === String(draftForm.bulletWeight) &&
			it.weightUnit.toLowerCase() === String(draftForm.bulletWeightUnit).toLowerCase();
		return entries.find((e) => same(e.item))?.key ?? null;
	}

	let query = $state('');
	let selectedKey = $state(initialKey());
	let selected = $derived(entries.find((e) => e.key === selectedKey)?.item ?? null);

	function normalize(s) {
		return s.toLowerCase().replace(/[\s\W]+/g, '');
	}

	let filtered = $derived.by(() => {
		const q = normalize(query);
		const shown = entries.filter((e) => !q || normalize(e.item.brand).includes(q));
		return {
			profiles: shown.filter((e) => e.group === 'profiles'),
			library: shown.filter((e) => e.group === 'library')
		};
	});

	const unit = (u) => String(u ?? '').toLowerCase();
	const v = {
		weight: (it) => withUnit(it.weight, unit(it.weightUnit)),
		diameter: (it) => withUnit(it.diameter, unit(it.diameterUnit)),
		length: (it) => (it.length ? withUnit(it.length, unit(it.lengthUnit)) : '—'),
		bc: (it) => numberText(it.ballisticCoefficient)
	};

	function rowDetail(it) {
		return `${v.weight(it)} · ${v.diameter(it)} · ${m.setup_ammo_bc()} ${v.bc(it)} ${it.ballisticCoefficientProfile}`;
	}

	function useSelected() {
		if (!selected) return;
		ammoSelection.set(selected);
		goto(localizeHref(returnPath));
	}

	function cancel() {
		goto(localizeHref(returnPath));
	}

	const focusRing = 'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary-500';
	let profilesHeading = $derived(`${m.ammo_selector_from_profiles()} · ${filtered.profiles.length}`);
	let libraryHeading = $derived(`${m.ammo_selector_library()} · ${filtered.library.length}`);
	let none = $derived(filtered.profiles.length === 0 && filtered.library.length === 0);
</script>

<svelte:head>
	<title>{m.ammo_selector_title()} — {m.app_name()}</title>
</svelte:head>

{#snippet tableRows(rows)}
	{#each rows as e (e.key)}
		{@const on = e.key === selectedKey}
		<tr class="border-b border-surface-200-800 {on ? 'bg-primary-500/10 dark:bg-primary-400/15' : 'hover:bg-surface-200-800/50'}">
			<td class="w-9 pl-3">
				{#if on}
					<span class="size-[22px] rounded-full flex items-center justify-center bg-primary-600 dark:bg-primary-500 text-white" aria-hidden="true">
						<Check class="size-3.5" strokeWidth={3} />
					</span>
				{/if}
			</td>
			<th scope="row" class="p-0 text-left font-semibold">
				<button
					type="button"
					class="w-full min-h-11 pl-1 pr-3 text-left font-semibold rounded-base focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-primary-500"
					aria-pressed={on}
					onclick={() => (selectedKey = e.key)}
				>
					{e.item.brand}
				</button>
			</th>
			<td class="px-3 text-right">{v.diameter(e.item)}</td>
			<td class="px-3 text-right">{v.weight(e.item)}</td>
			<td class="px-3 text-right">{v.bc(e.item)}</td>
			<td class="px-3">{e.item.ballisticCoefficientProfile}</td>
			<td class="pl-3 pr-4 text-right">{v.length(e.item)}</td>
		</tr>
	{/each}
{/snippet}

{#snippet selection(large)}
	{#if selected}
		<AmmoSummaryCard
			title={large ? selected.brand : m.ammo_selector_selected_named({ name: selected.brand })}
			aside={large ? '' : m.ammo_selector_drag_model({ model: selected.ballisticCoefficientProfile })}
			label={m.ammo_selector_selected()}
			{large}
			values={{
				weight: v.weight(selected),
				bc: large ? `${v.bc(selected)} ${selected.ballisticCoefficientProfile}` : v.bc(selected),
				diameter: v.diameter(selected),
				length: v.length(selected)
			}}
			note={forName ? m.ammo_selector_fills({ name: forName }) : m.ammo_selector_fills_unnamed()}
		/>
	{:else}
		<p class="card preset-filled-surface-100-900 border border-dashed border-surface-300-700 px-3.5 py-3 text-sm text-surface-600-400">
			{m.ammo_selector_pick_one()}
		</p>
	{/if}
{/snippet}

{#snippet buttons(stacked)}
	<div class="{stacked ? 'flex flex-col-reverse' : 'grid grid-cols-2'} gap-2.5">
		<button
			type="button"
			class="btn preset-outlined-surface-300-700 hover:preset-tonal-surface h-12 text-[15px] {focusRing}"
			onclick={cancel}
		>
			{m.common_cancel()}
		</button>
		<button
			type="button"
			class="btn preset-filled-primary-500 h-12 text-[15px] font-semibold {focusRing}"
			disabled={!selected}
			onclick={useSelected}
		>
			{m.ammo_selector_use()}
		</button>
	</div>
{/snippet}

<div class="flex flex-col gap-3 sm:gap-4 lg:gap-5">
	<!-- Header: phone/tablet under the layout header; desktop breadcrumb + title -->
	<nav aria-label={m.common_breadcrumb()} class="hidden lg:flex items-center gap-2 text-[13px] text-surface-600-400">
		<a href={localizeHref('/profiles')} class="font-medium text-primary-700-300 underline-offset-2 hover:underline {focusRing}">{m.profiles_title()}</a>
		{#if forName}
			<span aria-hidden="true">/</span>
			<a href={localizeHref(returnPath)} class="font-medium text-primary-700-300 underline-offset-2 hover:underline {focusRing}">{forName}</a>
		{/if}
		<span aria-hidden="true">/</span>
		<span aria-current="page">{m.ammo_selector_title()}</span>
	</nav>
	<div>
		<h1 class="sr-only lg:not-sr-only lg:text-[28px] lg:font-bold lg:tracking-tight">{m.ammo_selector_title()}</h1>
		<p class="mx-1 lg:mx-0 lg:mt-1 text-sm text-surface-600-400">
			{forName ? m.ammo_selector_intro({ name: forName }) : m.ammo_selector_intro_unnamed()}
		</p>
	</div>

	<div class="flex flex-col gap-2.5 md:flex-row md:items-start md:gap-5 lg:gap-6">
		<!-- Phone and tablet: picker list -->
		<div class="lg:hidden flex flex-col gap-2.5 md:flex-1 min-w-0">
			<PickerSearch
				bind:value={query}
				label={m.setup_ammo_search()}
				placeholder={m.setup_ammo_search_placeholder()}
				controls="{uid}-list"
			/>
			{#if none}
				<p class="mx-1 text-sm text-surface-600-400" role="status">{m.ammo_selector_no_results()}</p>
			{:else}
				<PickerList id="{uid}-list" label={m.ammo_selector_title()} class="max-h-[55vh] md:max-h-[calc(100dvh-14rem)]" grouped>
					{#if filtered.profiles.length > 0}
						<PickerGroup heading={profilesHeading}>
							{#each filtered.profiles as e (e.key)}
								<PickerRow title={e.item.brand} detail={rowDetail(e.item)} selected={e.key === selectedKey} onclick={() => (selectedKey = e.key)} />
							{/each}
						</PickerGroup>
					{/if}
					{#if filtered.library.length > 0}
						<PickerGroup heading={libraryHeading}>
							{#each filtered.library as e (e.key)}
								<PickerRow title={e.item.brand} detail={rowDetail(e.item)} selected={e.key === selectedKey} onclick={() => (selectedKey = e.key)} />
							{/each}
						</PickerGroup>
					{/if}
				</PickerList>
			{/if}
		</div>

		<!-- Desktop: table -->
		<section aria-label={m.ammo_selector_title()} class="hidden lg:block flex-1 min-w-0 card preset-filled-surface-100-900 border border-surface-200-800 overflow-hidden">
			<div class="p-3.5 flex flex-wrap items-center gap-x-4 gap-y-2.5 border-b border-surface-200-800">
				<div class="flex-1 basis-72 max-w-[420px]">
					<PickerSearch
						bind:value={query}
						label={m.setup_ammo_search()}
						placeholder={m.setup_ammo_search_placeholder()}
						controls="{uid}-table"
					/>
				</div>
				<span class="text-[13px] text-surface-600-400">
					{m.ammo_selector_count({ profiles: filtered.profiles.length, library: filtered.library.length })}
				</span>
			</div>
			{#if none}
				<p class="px-4 py-6 text-sm text-surface-600-400" role="status">{m.ammo_selector_no_results()}</p>
			{:else}
				<div class="max-h-[620px] overflow-auto">
					<table id="{uid}-table" class="w-full min-w-[720px] border-collapse text-sm tabular-nums">
						<thead>
							<tr class="text-xs font-bold tracking-wide uppercase text-surface-600-400">
								<th scope="col" class="sticky top-0 z-[2] h-10 pl-3 bg-surface-200-800 border-b border-surface-200-800"><span class="sr-only">{m.ammo_selector_selected()}</span></th>
								<th scope="col" class="sticky top-0 z-[2] pl-1 pr-3 text-left bg-surface-200-800 border-b border-surface-200-800">{m.ammo_selector_col_name()}</th>
								<th scope="col" class="sticky top-0 z-[2] px-3 text-right bg-surface-200-800 border-b border-surface-200-800">{m.setup_ammo_diameter()}</th>
								<th scope="col" class="sticky top-0 z-[2] px-3 text-right bg-surface-200-800 border-b border-surface-200-800">{m.setup_ammo_weight()}</th>
								<th scope="col" class="sticky top-0 z-[2] px-3 text-right bg-surface-200-800 border-b border-surface-200-800">{m.setup_ammo_bc()}</th>
								<th scope="col" class="sticky top-0 z-[2] px-3 text-left bg-surface-200-800 border-b border-surface-200-800">{m.ammo_selector_col_model()}</th>
								<th scope="col" class="sticky top-0 z-[2] pl-3 pr-4 text-right bg-surface-200-800 border-b border-surface-200-800">{m.setup_ammo_length()}</th>
							</tr>
						</thead>
						{#if filtered.profiles.length > 0}
							<tbody>
								<tr><th scope="colgroup" colspan="7" class="pt-3.5 pb-1.5 px-4 text-left text-xs font-bold tracking-wider uppercase text-surface-600-400 border-b border-surface-200-800">{m.ammo_selector_from_profiles()}</th></tr>
								{@render tableRows(filtered.profiles)}
							</tbody>
						{/if}
						{#if filtered.library.length > 0}
							<tbody>
								<tr><th scope="colgroup" colspan="7" class="pt-[18px] pb-1.5 px-4 text-left text-xs font-bold tracking-wider uppercase text-surface-600-400 border-b border-surface-200-800">{m.ammo_selector_library()}</th></tr>
								{@render tableRows(filtered.library)}
							</tbody>
						{/if}
					</table>
				</div>
			{/if}
		</section>

		<!-- Selection and actions -->
		<div class="md:w-[300px] lg:w-[340px] md:shrink-0 md:sticky md:top-0 flex flex-col gap-2.5">
			<div class="lg:hidden">{@render selection(false)}</div>
			<div class="hidden lg:block">{@render selection(true)}</div>
			<p class="mx-1 lg:hidden text-xs text-surface-600-400">{m.ammo_selector_disclaimer()}</p>
			<div class="md:hidden">{@render buttons(false)}</div>
			<div class="hidden md:block">{@render buttons(true)}</div>
			<p class="hidden lg:block text-xs leading-snug text-surface-600-400">{m.ammo_selector_disclaimer()}</p>
		</div>
	</div>
</div>
