<script>
	/**
	 * Reusable profile form — used by both /profiles/new and /profiles/[id].
	 *
	 * @prop {string}   title        - Page title (already translated).
	 * @prop {object}   initialData  - Existing profile fields for edit, or {} for new.
	 * @prop {Function} onSave(data) - Called with the assembled profile object on submit.
	 * @prop {Function} onCancel()   - Called when the user cancels or presses back.
	 */
	import { m } from '$lib/paraglide/messages.js';
	import { goto } from '$app/navigation';
	import { page } from '$app/state';
	import { localizeHref } from '$lib/paraglide/runtime.js';
	import { ToggleLeft, ToggleRight, Search, Link, Link2Off } from '@lucide/svelte';
	import UnitField from '$lib/components/UnitField.svelte';
	import { validateProfile, isValid, buildAmmoString } from '$lib/utils/profileValidation.js';
	import { ammoSelection } from '$lib/stores/ammoSelection.svelte.js';

	let { initialData = {}, onSave, onCancel } = $props();

	let form = $state({
		name: '',
		barrelTwist: '',
		barrelTwistUnit: 'in',
		opticName: '',
		opticHeight: '',
		opticHeightUnit: 'in',
		zeroDist: '',
		zeroUnit: 'yd',
		bulletBrand: '',
		bulletDiameter: '',
		bulletDiameterUnit: 'in',
		bulletWeight: '',
		bulletWeightUnit: 'gr',
		bcType: 'G1',
		bc: '',
		bulletLength: '',
		bulletLengthUnit: 'in',
		velocity: '',
		velocityUnit: 'fps',
		temperature: '',
		temperatureUnit: 'f',
		tempModifier: '',
		reticleType: 'red-dot',
		elevationClickValue: '0.5',
		elevationClickUnit: 'MOA',
		windageClickValue: '0.5',
		windageClickUnit: 'MOA',
		clickLink: true
	});

	let spinDrift = $state(false);
	let tempSensitivity = $state(false);

	$effect(() => {
		form.name = initialData.name ?? '';
		form.barrelTwist = initialData.barrelTwist ?? '';
		form.barrelTwistUnit = initialData.barrelTwistUnit ?? 'in';
		form.opticName = initialData.opticName ?? '';
		form.opticHeight = initialData.opticHeight != null ? String(initialData.opticHeight) : '';
		form.opticHeightUnit = initialData.opticHeightUnit ?? 'in';
		form.zeroDist = initialData.zeroDist != null ? String(initialData.zeroDist) : '';
		form.zeroUnit = initialData.zeroUnit ?? 'yd';
		form.bulletBrand = initialData.bulletBrand ?? '';
		form.bulletDiameter = initialData.bulletDiameter != null ? String(initialData.bulletDiameter) : '';
		form.bulletDiameterUnit = initialData.bulletDiameterUnit ?? 'in';
		form.bulletWeight = initialData.bulletWeight != null ? String(initialData.bulletWeight) : '';
		form.bulletWeightUnit = initialData.bulletWeightUnit ?? 'gr';
		form.bcType = initialData.bcType ?? 'G1';
		form.bc = initialData.bc != null ? String(initialData.bc) : '';
		form.bulletLength = initialData.bulletLength != null ? String(initialData.bulletLength) : '';
		form.bulletLengthUnit = initialData.bulletLengthUnit ?? 'in';
		form.velocity = initialData.velocity != null ? String(initialData.velocity) : '';
		form.velocityUnit = initialData.velocityUnit ?? 'fps';
		form.temperature = initialData.temperature != null ? String(initialData.temperature) : '';
		form.temperatureUnit = initialData.temperatureUnit ?? 'f';
		form.tempModifier = initialData.tempModifier != null ? String(initialData.tempModifier) : '';
		form.reticleType = initialData.reticleType ?? 'red-dot';
		form.elevationClickValue = initialData.elevationClickValue ?? '0.5';
		form.elevationClickUnit = initialData.elevationClickUnit ?? 'MOA';
		form.windageClickValue = initialData.windageClickValue ?? '0.5';
		form.windageClickUnit = initialData.windageClickUnit ?? 'MOA';
		form.clickLink = initialData.clickLink ?? true;
		spinDrift = initialData.spinDrift ?? false;
		tempSensitivity = initialData.tempSensitivity ?? false;
	});

	$effect(() => {
		if (form.clickLink) {
			form.windageClickValue = form.elevationClickValue;
			form.windageClickUnit = form.elevationClickUnit;
		}
	});

	$effect(() => {
		const sel = ammoSelection.pending;
		if (!sel) return;
		form.bulletBrand = sel.brand;
		form.bulletDiameter = String(sel.diameter);
		form.bulletDiameterUnit = sel.diameterUnit.toLowerCase();
		form.bulletWeight = String(sel.weight);
		form.bulletWeightUnit = sel.weightUnit.toLowerCase();
		form.bc = String(sel.ballisticCoefficient);
		form.bcType = sel.ballisticCoefficientProfile;
		if (sel.length) {
			form.bulletLength = String(sel.length);
			form.bulletLengthUnit = sel.lengthUnit.toLowerCase();
		}
		ammoSelection.clear();
	});

	let tempModifierUnit = $derived(
		form.temperatureUnit === 'f' ? m.unit_fps_per_f() : m.unit_fps_per_c()
	);

	let errors = $state({});
	let submitted = $state(false);

	function fieldError(key) {
		if (!submitted || !errors[key]) return '';
		return errors[key] === 'required'
			? m.validation_required()
			: m.validation_positive_number();
	}

	function save() {
		const e = validateProfile(form, spinDrift, tempSensitivity);
		if (!isValid(e)) {
			errors = e;
			submitted = true;
			return;
		}
		errors = {};
		const data = {
			...form,
			zeroDist: Number(form.zeroDist) || 0,
			spinDrift,
			tempSensitivity,
			ammo: buildAmmoString(form.bulletBrand, form.bulletWeight, form.bulletWeightUnit),
			optic: form.opticName || '—'
		};
		if (data.clickLink) {
			data.windageClickValue = data.elevationClickValue;
			data.windageClickUnit = data.elevationClickUnit;
		}
		onSave(data);
	}
</script>

<form class="space-y-4 max-w-lg" onsubmit={(e) => { e.preventDefault(); save(); }}>

	<!-- ── Rifle ──────────────────────────────────────────────── -->
	<div class="card preset-filled-surface-100-900 p-4 space-y-4">
		<div class="flex items-center justify-between border-b border-surface-200-800 pb-2">
			<h2 class="h5">{m.profile_section_rifle()}</h2>
			<button
				type="button"
				class="btn btn-sm {spinDrift ? 'preset-tonal-primary' : 'preset-tonal-surface'}"
				onclick={() => spinDrift = !spinDrift}
				title={m.profile_toggle_spin_drift()}
			>
				{#if spinDrift}
					<ToggleRight class="size-4" />
				{:else}
					<ToggleLeft class="size-4" />
				{/if}
				{m.profile_toggle_spin_drift()}
			</button>
		</div>

		<!-- Weapon designation -->
		<div class="space-y-1.5">
			<span class="text-sm font-medium block">{m.profile_rifle_designation()}</span>
			<input
				class="input"
				type="text"
				bind:value={form.name}
				placeholder={m.profile_rifle_designation_placeholder()}
			/>
			{#if fieldError('name')}
				<p class="text-xs text-error-500">{fieldError('name')}</p>
			{:else}
				<p class="text-xs text-surface-500-400">{m.profile_rifle_designation_hint()}</p>
			{/if}
		</div>

		<!-- Barrel twist (spin drift only) -->
		{#if spinDrift}
		<UnitField
			label={m.profile_rifle_barrel_twist()}
			hint={m.profile_rifle_barrel_twist_hint()}
			invalid={fieldError('barrelTwist')}
			bind:value={form.barrelTwist}
			bind:unit={form.barrelTwistUnit}
			units={[{ value: 'in', label: m.unit_in() }, { value: 'mm', label: m.unit_mm() }]}
			prefix="1 /"
			placeholder="10"
		/>
		{/if}
	</div>

	<!-- ── Optic ──────────────────────────────────────────────── -->
	<div class="card preset-filled-surface-100-900 p-4 space-y-4">
		<h2 class="h5 border-b border-surface-200-800 pb-2">{m.profile_section_optic()}</h2>

		<!-- Optic name -->
		<div class="space-y-1.5">
			<span class="text-sm font-medium block">{m.profile_optic_name()}</span>
			<input
				class="input"
				type="text"
				bind:value={form.opticName}
				placeholder={m.profile_optic_name_placeholder()}
			/>
			{#if fieldError('opticName')}
				<p class="text-xs text-error-500">{fieldError('opticName')}</p>
			{:else}
				<p class="text-xs text-surface-500-400">{m.profile_optic_name_hint()}</p>
			{/if}
		</div>

		<!-- Optic height -->
		<UnitField
			label={m.profile_optic_height()}
			hint={m.profile_optic_height_hint()}
			invalid={fieldError('opticHeight')}
			bind:value={form.opticHeight}
			bind:unit={form.opticHeightUnit}
			units={[{ value: 'in', label: m.unit_in() }, { value: 'cm', label: m.unit_cm() }]}
		/>

		<!-- Zero distance -->
		<UnitField
			label={m.profile_optic_zero_dist()}
			hint={m.profile_optic_zero_dist_hint()}
			invalid={fieldError('zeroDist')}
			bind:value={form.zeroDist}
			bind:unit={form.zeroUnit}
			units={[{ value: 'yd', label: m.unit_yd() }, { value: 'm', label: m.unit_m() }]}
		/>

		<!-- Reticle type -->
		<div class="space-y-1.5">
			<span class="text-sm font-medium block">{m.profile_optic_reticle_type()}</span>
			<div class="flex gap-1 flex-wrap">
				{#each [
					{ value: 'red-dot', label: m.scope_view_reticle_red_dot() },
					{ value: 'moa', label: m.scope_view_reticle_moa() },
					{ value: 'mrad', label: m.scope_view_reticle_mrad() },
					{ value: 'mil-dot', label: m.scope_view_reticle_mil_dot() }
				] as type}
					<button
						type="button"
						class="chip text-xs {form.reticleType === type.value
							? 'preset-filled-primary-500'
							: 'preset-tonal-surface'}"
						onclick={() => (form.reticleType = type.value)}
					>
						{type.label}
					</button>
				{/each}
			</div>
			<p class="text-xs text-surface-500-400">{m.profile_optic_reticle_type_hint()}</p>
		</div>

		<!-- Elevation click value -->
		<UnitField
			label={m.profile_optic_click_elevation()}
			hint={m.profile_optic_click_hint()}
			invalid={fieldError('elevationClickValue')}
			bind:value={form.elevationClickValue}
			bind:unit={form.elevationClickUnit}
			units={[{ value: 'MOA', label: 'MOA' }, { value: 'MRAD', label: 'MRAD' }]}
			placeholder="0.5"
		/>

		<!-- Click link toggle -->
		<div class="flex items-center gap-2">
			<button
				type="button"
				class="btn btn-icon btn-sm {form.clickLink
					? 'preset-filled-primary-500'
					: 'preset-tonal-surface'}"
				title={m.profile_optic_click_link()}
				onclick={() => (form.clickLink = !form.clickLink)}
			>
				{#if form.clickLink}
					<Link class="size-4" />
				{:else}
					<Link2Off class="size-4" />
				{/if}
			</button>
			<span class="text-xs text-surface-500-400">{m.profile_optic_click_link()}</span>
		</div>

		<!-- Windage click value (only when unlinked) -->
		{#if !form.clickLink}
		<UnitField
			label={m.profile_optic_click_windage()}
			hint={m.profile_optic_click_hint()}
			invalid={fieldError('windageClickValue')}
			bind:value={form.windageClickValue}
			bind:unit={form.windageClickUnit}
			units={[{ value: 'MOA', label: 'MOA' }, { value: 'MRAD', label: 'MRAD' }]}
			placeholder="0.5"
		/>
		{/if}
	</div>

	<!-- ── Ammunition ─────────────────────────────────────────── -->
	<div class="card preset-filled-surface-100-900 p-4 space-y-4">
		<div class="flex items-center justify-between border-b border-surface-200-800 pb-2">
			<h2 class="h5">{m.profile_section_ammo()}</h2>
			<button
				type="button"
				class="btn btn-sm preset-tonal-surface"
				onclick={() => goto(localizeHref('/profiles/ammo-selector') + '?return=' + page.url.pathname)}
				title={m.ammo_selector_select()}
			>
				<Search class="size-4" />
			</button>
		</div>

		<!-- Bullet brand -->
		<div class="space-y-1.5">
			<span class="text-sm font-medium block">{m.profile_ammo_brand()}</span>
			<input
				class="input"
				type="text"
				bind:value={form.bulletBrand}
				placeholder={m.profile_ammo_brand_placeholder()}
			/>
			{#if fieldError('bulletBrand')}
				<p class="text-xs text-error-500">{fieldError('bulletBrand')}</p>
			{:else}
				<p class="text-xs text-surface-500-400">{m.profile_ammo_brand_hint()}</p>
			{/if}
		</div>

		<!-- Bullet diameter -->
		<UnitField
			label={m.profile_ammo_diameter()}
			hint={m.profile_ammo_diameter_hint()}
			invalid={fieldError('bulletDiameter')}
			bind:value={form.bulletDiameter}
			bind:unit={form.bulletDiameterUnit}
			units={[{ value: 'in', label: m.unit_in() }, { value: 'mm', label: m.unit_mm() }]}
		/>

		<!-- Bullet weight -->
		<UnitField
			label={m.profile_ammo_weight()}
			hint={m.profile_ammo_weight_hint()}
			invalid={fieldError('bulletWeight')}
			bind:value={form.bulletWeight}
			bind:unit={form.bulletWeightUnit}
			units={[{ value: 'gr', label: m.unit_gr() }, { value: 'g', label: m.unit_g() }]}
		/>

		<!-- Ballistic Coefficient -->
		<UnitField
			label={m.profile_ammo_bc()}
			hint={m.profile_ammo_bc_hint()}
			invalid={fieldError('bc')}
			bind:value={form.bc}
			bind:unit={form.bcType}
			units={[{ value: 'G1', label: 'G1' }, { value: 'G7', label: 'G7' }]}
			placeholder="0.500"
		/>

		<!-- Bullet length (spin drift only) -->
		{#if spinDrift}
		<UnitField
			label={m.profile_ammo_length()}
			hint={m.profile_ammo_length_hint()}
			invalid={fieldError('bulletLength')}
			bind:value={form.bulletLength}
			bind:unit={form.bulletLengthUnit}
			units={[{ value: 'in', label: m.unit_in() }, { value: 'mm', label: m.unit_mm() }]}
		/>
		{/if}
	</div>

	<!-- ── Measures ───────────────────────────────────────────── -->
	<div class="card preset-filled-surface-100-900 p-4 space-y-4">
		<div class="flex items-center justify-between border-b border-surface-200-800 pb-2">
			<h2 class="h5">{m.profile_section_measures()}</h2>
			<button
				type="button"
				class="btn btn-sm {tempSensitivity ? 'preset-tonal-primary' : 'preset-tonal-surface'}"
				onclick={() => tempSensitivity = !tempSensitivity}
				title={m.profile_toggle_temp_sensitivity()}
			>
				{#if tempSensitivity}
					<ToggleRight class="size-4" />
				{:else}
					<ToggleLeft class="size-4" />
				{/if}
				{m.profile_toggle_temp_sensitivity()}
			</button>
		</div>

		<!-- Muzzle velocity -->
		<UnitField
			label={m.profile_measures_velocity()}
			hint={m.profile_measures_velocity_hint()}
			invalid={fieldError('velocity')}
			bind:value={form.velocity}
			bind:unit={form.velocityUnit}
			units={[{ value: 'fps', label: m.unit_fps() }, { value: 'mps', label: m.unit_mps() }]}
		/>

		<!-- Temperature & modifier (temp sensitivity only) -->
		{#if tempSensitivity}
		<UnitField
			label={m.profile_measures_temperature()}
			hint={m.profile_measures_temperature_hint()}
			invalid={fieldError('temperature')}
			bind:value={form.temperature}
			bind:unit={form.temperatureUnit}
			units={[{ value: 'f', label: m.unit_f() }, { value: 'c', label: m.unit_c() }]}
		/>

		<UnitField
			label={m.profile_measures_temp_modifier()}
			hint={m.profile_measures_temp_modifier_hint()}
			invalid={fieldError('tempModifier')}
			bind:value={form.tempModifier}
			suffix={tempModifierUnit}
		/>
		{/if}
	</div>

	<!-- Save / cancel footer -->
	<div class="flex gap-2 pb-4">
		<button type="button" class="btn preset-tonal-surface flex-1" onclick={onCancel}>
			{m.common_cancel()}
		</button>
		<button type="submit" class="btn preset-filled-primary-500 flex-1">
			{m.common_save()}
		</button>
	</div>
</form>
