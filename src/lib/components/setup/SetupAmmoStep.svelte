<script>
	/**
	 * Guided setup, step 2: ammunition (#150).
	 *
	 * The user picks a load from the library (src/lib/data/ammo.json), which fills the bullet fields
	 * of the form, or enters the numbers from the box. "Edit" opens the fields filled from the pick.
	 *
	 * @prop {object}      form       - Bindable setup form (GuidedSetup).
	 * @prop {object|null} pick       - Bindable: the library entry picked, or null.
	 * @prop {boolean}     manual     - Bindable: the bullet fields are shown.
	 * @prop {Function}    error(key) - The error message to show under a field, or ''.
	 * @prop {boolean}     missing    - Next was pressed with bullet errors while the fields are hidden.
	 */
	import { tick } from 'svelte';
	import { m } from '#lib/paraglide/messages.js';
	import UnitField from '#lib/components/UnitField.svelte';
	import TextField from '#lib/components/setup/TextField.svelte';
	import { MAX_NAME_LENGTH } from '#lib/utils/storedProfiles.js';
	import { formatNumber } from '#lib/utils/format.js';
	import ammoData from '#lib/data/ammo.json';
	import PickerSearch from '#lib/components/picker/PickerSearch.svelte';
	import PickerList from '#lib/components/picker/PickerList.svelte';
	import PickerRow from '#lib/components/picker/PickerRow.svelte';
	import AmmoSummaryCard from '#lib/components/picker/AmmoSummaryCard.svelte';

	let {
		form = $bindable(),
		pick = $bindable(null),
		manual = $bindable(false),
		error,
		missing = false
	} = $props();

	const uid = $props.id();
	let query = $state('');
	let brandInput = $state(null);

	const UNIT_LABELS = {
		in: () => m.unit_in(),
		mm: () => m.unit_mm(),
		cm: () => m.unit_cm(),
		gr: () => m.unit_gr(),
		g: () => m.unit_g()
	};

	/** Case-insensitive, and "7.5x55" matches "75x55" or "7.5 x 55" (as the Ammo Library page). */
	function normalize(s) {
		return s.toLowerCase().replace(/[\s\W]+/g, '');
	}

	let matches = $derived.by(() => {
		const q = normalize(query);
		return q ? ammoData.filter((item) => normalize(item.brand).includes(q)) : ammoData;
	});

	function withUnit(value, unit) {
		const key = String(unit).toLowerCase();
		return `${formatNumber(value)} ${UNIT_LABELS[key]?.() ?? key}`;
	}

	function rowDetail(item) {
		return m.setup_ammo_row_detail({
			weight: withUnit(item.weight, item.weightUnit),
			bc: formatNumber(item.ballisticCoefficient),
			model: item.ballisticCoefficientProfile
		});
	}

	/** Fills the bullet fields from a library entry, as ProfileForm does with the Ammo Library. */
	function choose(item) {
		pick = item;
		manual = false;
		form.bulletBrand = item.brand;
		form.bulletDiameter = String(item.diameter);
		form.bulletDiameterUnit = item.diameterUnit.toLowerCase();
		form.bulletWeight = String(item.weight);
		form.bulletWeightUnit = item.weightUnit.toLowerCase();
		form.bc = String(item.ballisticCoefficient);
		form.bcType = item.ballisticCoefficientProfile;
		if (item.length) {
			form.bulletLength = String(item.length);
			form.bulletLengthUnit = item.lengthUnit.toLowerCase();
		}
	}

	async function openFields(clear) {
		if (clear) {
			pick = null;
			form.bulletBrand = '';
			form.bulletDiameter = '';
			form.bulletWeight = '';
			form.bc = '';
			form.bulletLength = '';
		}
		manual = true;
		await tick();
		brandInput?.focus();
	}
</script>

<!--
	One column; two from a 672 px wide step (the desktop setup card, #166 SetupDesktop board): the
	search and list on the left, what the pick filled in (or the fields) on the right.
-->
<div class="@container">
	<div class="grid grid-cols-1 gap-4 @2xl:grid-cols-2 @2xl:items-start">
		<div class="flex flex-col gap-4 min-w-0">
			<!-- Search, library and the pick: the picker pattern, shared with the Ammo Library (#166) -->
			<PickerSearch
				bind:value={query}
				label={m.setup_ammo_search()}
				placeholder={m.setup_ammo_search_placeholder()}
				controls="{uid}-list"
			/>

			{#if matches.length === 0}
				<p class="mx-1 text-sm text-surface-600-400" role="status">{m.ammo_selector_no_results()}</p>
			{:else}
				<PickerList id="{uid}-list" label={m.ammo_selector_library()} class="max-h-72">
					{#each matches as item (item)}
						<PickerRow title={item.brand} detail={rowDetail(item)} selected={pick === item} onclick={() => choose(item)} />
					{/each}
				</PickerList>
			{/if}
		</div>

		<div class="flex flex-col gap-4 min-w-0">
			<p class="mx-1 text-xs text-surface-600-400">{m.ammo_selector_disclaimer()}</p>

			<!-- What the pick filled in -->
			{#if pick && !manual}
				{#snippet editButton()}
					<button
						type="button"
						class="btn btn-sm touch-hit min-w-11 -my-1 px-2 font-semibold underline underline-offset-2 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary-500"
						onclick={() => openFields(false)}
					>
						{m.common_edit()}
					</button>
				{/snippet}
				<AmmoSummaryCard
					title={m.setup_ammo_filled({ brand: pick.brand })}
					values={{
						weight: withUnit(form.bulletWeight, form.bulletWeightUnit),
						bc: `${formatNumber(Number(form.bc))}\u00a0${form.bcType}`,
						diameter: withUnit(form.bulletDiameter, form.bulletDiameterUnit),
						length: form.bulletLength ? withUnit(form.bulletLength, form.bulletLengthUnit) : '—'
					}}
					action={editButton}
				/>
			{/if}

			{#if !manual}
				{#if missing}
					<p class="mx-1 text-xs text-error-500" role="alert">{m.setup_ammo_missing()}</p>
				{/if}
				<button
					type="button"
					class="self-start min-h-11 px-1 text-sm font-semibold text-primary-700-300 underline underline-offset-2 rounded-base focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary-500"
					onclick={() => openFields(true)}
				>
					{m.setup_ammo_not_listed()}
				</button>
			{:else}
				<!-- The numbers from the box -->
				<fieldset class="card preset-filled-surface-100-900 border border-surface-200-800 p-4">
					<legend class="float-left w-full mb-4 text-sm font-semibold">{m.setup_ammo_box_legend()}</legend>
					<div class="clear-left flex flex-col gap-4">
						<TextField
							label={m.profile_ammo_brand()}
							hint={m.profile_ammo_brand_hint()}
							placeholder={m.profile_ammo_brand_placeholder()}
							maxlength={MAX_NAME_LENGTH}
							invalid={error('bulletBrand')}
							bind:value={form.bulletBrand}
							bind:input={brandInput}
						/>

						<UnitField
							label={m.profile_ammo_diameter()}
							hint={m.profile_ammo_diameter_hint()}
							invalid={error('bulletDiameter')}
							bind:value={form.bulletDiameter}
							bind:unit={form.bulletDiameterUnit}
							units={[{ value: 'in', label: m.unit_in() }, { value: 'mm', label: m.unit_mm() }]}
						/>

						<UnitField
							label={m.profile_ammo_weight()}
							hint={m.profile_ammo_weight_hint()}
							invalid={error('bulletWeight')}
							bind:value={form.bulletWeight}
							bind:unit={form.bulletWeightUnit}
							units={[{ value: 'gr', label: m.unit_gr() }, { value: 'g', label: m.unit_g() }]}
						/>

						<UnitField
							label={m.profile_ammo_bc()}
							hint={m.profile_ammo_bc_hint()}
							invalid={error('bc')}
							bind:value={form.bc}
							bind:unit={form.bcType}
							units={[{ value: 'G1', label: 'G1' }, { value: 'G7', label: 'G7' }]}
							placeholder="0.500"
						/>
					</div>
				</fieldset>
			{/if}
		</div>
	</div>
</div>
