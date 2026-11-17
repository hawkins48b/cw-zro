<script>
	/**
	 * Profile editor, used by /profiles/new and /profiles/[id] (#166). Sections follow the guided
	 * setup: 1 Rifle & scope, 2 Ammunition (tonal card + Change → Ammo Library), 3 Velocity (with
	 * temperature sensitivity), 4 Zero, 5 Spin drift (twist + bullet length under one switch).
	 *
	 * Phone: own header, pinned Cancel / Save bar (the layout hides its header and tab bar on these
	 * routes). Tablet (md): two columns. Desktop (lg): form + summary card that stays in view; from xl
	 * also a section index on the left.
	 *
	 * The fields, units, validation, limits and stored values are those of the form before #166
	 * (validateProfile, buildProfileData); only the layout changed.
	 *
	 * @prop {object}   initialData  - Existing profile fields for edit (shownProfile), or {} for new.
	 * @prop {Function} onSave(data) - Called with the assembled profile object on submit.
	 * @prop {Function} onCancel()   - Cancel, back arrow.
	 * @prop {string}   [title]      - Heading (default "Edit profile" / "New profile" from isNew).
	 * @prop {boolean}  [isNew]      - New profile: no subtitle, no "In use".
	 * @prop {boolean}  [inUse]      - The profile edited is the one in use: shows "In use".
	 */
	import { m } from '#lib/paraglide/messages.js';
	import { goto } from '$app/navigation';
	import { page } from '$app/state';
	import { localizeHref } from '#lib/paraglide/runtime.js';
	import { tick, untrack } from 'svelte';
	import { ArrowLeft, Link, ChevronDown, ChevronRight, RefreshCw, Library } from '@lucide/svelte';
	import UnitField from '#lib/components/UnitField.svelte';
	import ChipGroup from '#lib/components/ChipGroup.svelte';
	import SwitchRow from '#lib/components/SwitchRow.svelte';
	import AmmoSummaryCard from '#lib/components/picker/AmmoSummaryCard.svelte';
	import {
		validateProfile,
		isValid,
		buildProfileData,
		profileFieldLimits
	} from '#lib/utils/profileValidation.js';
	import { MAX_NAME_LENGTH } from '#lib/utils/storedProfiles.js';
	import { formatLimit } from '#lib/utils/format.js';
	import { ammoSelection } from '#lib/stores/ammoSelection.svelte.js';
	import { formDraft } from '#lib/stores/formDraft.svelte.js';
	import {
		hasValue,
		numberText,
		withUnit,
		bcText,
		reticleText,
		temperatureText,
		spinText,
		profileTitle
	} from '#lib/components/profile/profileLabels.js';

	let { initialData = {}, onSave, onCancel, title = undefined, isNew = false, inUse = false } = $props();

	const uid = $props.id();

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
	/** The bullet fields are shown (they always are while the ammunition is incomplete). */
	let ammoOpen = $state(false);
	/** The ammunition was just taken from the Ammo Library. */
	let ammoFromLibrary = $state(false);

	$effect(() => {
		// If a draft was saved (e.g. before navigating to ammo-selector), restore it.
		// Read draft with untrack so that formDraft.clear() below doesn't re-trigger
		// this effect (which would fall through to the initialData branch and reset fields).
		const draft = untrack(() => formDraft.pending);
		if (draft) {
			Object.assign(form, draft.form);
			spinDrift = draft.spinDrift;
			tempSensitivity = draft.tempSensitivity;
			ammoOpen = draft.ammoOpen ?? false;
			ammoFromLibrary = draft.ammoFromLibrary ?? false;
			formDraft.clear();
			return;
		}
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
		ammoFromLibrary = true;
		ammoSelection.clear();
	});

	let tempModifierUnit = $derived(
		form.temperatureUnit === 'f' ? m.unit_fps_per_f() : m.unit_fps_per_c()
	);

	let errors = $state({});
	let submitted = $state(false);

	const UNIT_LABELS = {
		in: () => m.unit_in(),
		cm: () => m.unit_cm(),
		mm: () => m.unit_mm(),
		gr: () => m.unit_gr(),
		g: () => m.unit_g(),
		yd: () => m.unit_yd(),
		m: () => m.unit_m(),
		fps: () => m.unit_fps(),
		mps: () => m.unit_mps()
	};

	/** The message for a value outside a field's limits, in the unit chosen now. */
	function rangeError(key) {
		const limits = profileFieldLimits(key, form);
		if (!limits) return m.validation_positive_number();
		const min = limits.min !== undefined ? formatLimit(limits.min) : '';
		const max = limits.max !== undefined ? formatLimit(limits.max) : '';
		const unit = limits.unit ? UNIT_LABELS[limits.unit]() : '';
		switch (limits.kind) {
			case 'above_zero_max':
				return m.validation_range_above_zero({ max, unit });
			case 'range':
				return unit ? m.validation_range({ min, max, unit }) : m.validation_range_no_unit({ min, max });
			default:
				return m.validation_range_below_max({ min, max, unit });
		}
	}

	function fieldError(key) {
		if (!submitted || !errors[key]) return '';
		if (errors[key] === 'required') return m.validation_required();
		if (errors[key] === 'out_of_range') return rangeError(key);
		return m.validation_positive_number();
	}

	const BULLET_FIELDS = ['bulletBrand', 'bulletDiameter', 'bulletWeight', 'bc'];

	/** The bullet numbers are all there, so the tonal card can stand for them. */
	let ammoComplete = $derived(BULLET_FIELDS.every((k) => hasValue(form[k])));
	let showAmmoFields = $derived(ammoOpen || !ammoComplete);

	async function save() {
		const e = validateProfile(form, spinDrift, tempSensitivity);
		if (!isValid(e)) {
			errors = e;
			submitted = true;
			// A bullet error opens the bullet fields, so it can be seen.
			if (BULLET_FIELDS.some((k) => e[k])) ammoOpen = true;
			await tick();
			formEl?.querySelector('[aria-invalid="true"]')?.focus();
			return;
		}
		errors = {};
		// A comma is stored as a decimal point (#117): Number('1,5') would be NaN.
		onSave(buildProfileData(form, spinDrift, tempSensitivity));
	}

	function openAmmoLibrary() {
		formDraft.save({ form: { ...form }, spinDrift, tempSensitivity, ammoOpen, ammoFromLibrary });
		goto(localizeHref('/profiles/ammo-selector') + '?return=' + page.url.pathname);
	}

	// ── Section index (xl) ─────────────────────────────────────────────────
	let formEl = $state(null);
	let activeSection = $state('rifle');

	let sections = $derived([
		{
			key: 'rifle',
			n: 1,
			label: m.setup_step_rifle(),
			sub: [form.name.trim(), hasValue(form.elevationClickValue) ? `${numberText(form.elevationClickValue)} ${form.elevationClickUnit}` : '']
				.filter(Boolean)
				.join(' · ')
		},
		{
			key: 'ammo',
			n: 2,
			label: m.setup_step_ammo(),
			sub: [form.bulletBrand.trim(), hasValue(form.bulletWeight) ? withUnit(form.bulletWeight, form.bulletWeightUnit) : '']
				.filter(Boolean)
				.join(' · ')
		},
		{ key: 'velocity', n: 3, label: m.setup_step_velocity(), sub: hasValue(form.velocity) ? withUnit(form.velocity, form.velocityUnit) : '' },
		{ key: 'zero', n: 4, label: m.profile_editor_section_zero(), sub: hasValue(form.zeroDist) ? withUnit(form.zeroDist, form.zeroUnit) : '' },
		{ key: 'spin', n: 5, label: m.profile_editor_section_spin(), sub: spinDrift ? m.profile_editor_on() : m.profile_editor_off() }
	]);

	function goToSection(e, key) {
		e.preventDefault();
		const el = document.getElementById(`${uid}-${key}`);
		el?.scrollIntoView({ behavior: 'smooth', block: 'start' });
		document.getElementById(`${uid}-${key}-h`)?.focus({ preventScroll: true });
		activeSection = key;
	}

	$effect(() => {
		if (!formEl || typeof IntersectionObserver === 'undefined') return;
		const observer = new IntersectionObserver(
			(entries) => {
				const visible = entries.filter((en) => en.isIntersecting).sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top);
				if (visible[0]) activeSection = visible[0].target.dataset.section;
			},
			{ rootMargin: '0px 0px -60% 0px' }
		);
		formEl.querySelectorAll('[data-section]').forEach((el) => observer.observe(el));
		return () => observer.disconnect();
	});

	// ── Summary (lg) ───────────────────────────────────────────────────────
	let clickSummary = $derived.by(() => {
		const elev = hasValue(form.elevationClickValue) ? `${numberText(form.elevationClickValue)} ${form.elevationClickUnit}` : '—';
		if (form.clickLink) return m.profile_editor_click_both({ value: elev });
		const wind = hasValue(form.windageClickValue) ? `${numberText(form.windageClickValue)} ${form.windageClickUnit}` : '—';
		return m.profile_editor_click_split({ elevation: elev, windage: wind });
	});
	let summaryGroups = $derived([
		{
			heading: m.setup_step_rifle(),
			rows: [
				[m.profile_optic_name(), form.opticName.trim() || '—'],
				[m.profile_optic_height(), withUnit(form.opticHeight, form.opticHeightUnit)],
				[m.profiles_key_reticle(), reticleText(form.reticleType)],
				[m.profiles_key_clicks(), clickSummary]
			]
		},
		{
			heading: m.setup_step_ammo(),
			rows: [
				[
					m.profile_editor_bullet(),
					[withUnit(form.bulletWeight, form.bulletWeightUnit), withUnit(form.bulletDiameter, form.bulletDiameterUnit)].join(' · ')
				],
				[m.setup_ammo_bc(), bcText(form)]
			]
		},
		{
			heading: m.profile_editor_velocity_zero(),
			rows: [
				[m.profile_measures_velocity(), withUnit(form.velocity, form.velocityUnit)],
				[m.profile_measures_temperature(), temperatureText(form, tempSensitivity)],
				[m.profile_optic_zero_dist(), withUnit(form.zeroDist, form.zeroUnit)]
			]
		},
		{
			heading: m.profile_editor_section_spin(),
			rows: [[m.profile_editor_section_spin(), spinText(form, spinDrift)]]
		}
	]);

	let heading = $derived(title ?? (isNew ? m.profiles_new() : m.profiles_edit_profile()));
	// The name as saved, so the subtitle does not change while typing.
	const savedTitle = untrack(() => (isNew ? '' : profileTitle(initialData)));

	const focusRing = 'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary-500';
	const sectionCard = 'card preset-filled-surface-100-900 border border-surface-200-800 p-4 flex flex-col gap-3.5 scroll-mt-6';
	const cancelBtn = `btn preset-outlined-surface-300-700 hover:preset-tonal-surface font-semibold ${focusRing}`;
	const saveBtn = `btn preset-filled-primary-500 font-semibold ${focusRing}`;
</script>

{#snippet inUseBadge()}
	{#if inUse && !isNew}
		<span class="shrink-0 px-2 py-0.5 rounded-full preset-tonal-primary text-[10px] font-bold tracking-wide uppercase">
			{m.profiles_in_use()}
		</span>
	{/if}
{/snippet}

{#snippet sectionHeading(key, n, label, note = '')}
	<div>
		<h2 id="{uid}-{key}-h" tabindex="-1" class="text-[15px] font-semibold outline-none">
			<span class="text-primary-700-300">{n}</span> · {label}
		</h2>
		{#if note}
			<p class="mt-0.5 text-xs text-surface-600-400">{note}</p>
		{/if}
	</div>
{/snippet}

<form
	bind:this={formEl}
	class="flex flex-col gap-3 sm:gap-4 lg:gap-5"
	aria-labelledby="{uid}-title"
	onsubmit={(e) => {
		e.preventDefault();
		save();
	}}
>
	<!-- ── Header ─────────────────────────────────────────────── -->
	<header class="flex flex-wrap items-center gap-x-3 gap-y-2 -mx-2 px-1 py-2 border-b border-surface-200-800 sm:mx-0 sm:px-0 sm:pt-4 sm:pb-0 sm:border-0 lg:pt-0">
		<button
			type="button"
			class="lg:hidden btn-icon size-11 shrink-0 rounded-base hover:preset-tonal-surface {focusRing}"
			aria-label={m.profile_editor_back()}
			title={m.profile_editor_back()}
			onclick={onCancel}
		>
			<ArrowLeft class="size-5" aria-hidden="true" />
		</button>
		<div class="flex-1 basis-48 min-w-0">
			<nav aria-label={m.common_breadcrumb()} class="hidden lg:block mb-1.5 text-[13px] text-surface-600-400">
				<a href={localizeHref('/profiles')} class="font-medium text-primary-700-300 underline-offset-2 hover:underline {focusRing}">{m.profiles_title()}</a>
				{#if savedTitle}<span aria-hidden="true"> / </span><span aria-current="page">{savedTitle}</span>{/if}
			</nav>
			<div class="flex items-center gap-2">
				<h1 id="{uid}-title" class="min-w-0 truncate text-[17px] font-semibold sm:text-2xl sm:font-bold lg:text-[28px] tracking-tight">{heading}</h1>
				{@render inUseBadge()}
			</div>
			{#if savedTitle}
				<p class="sm:hidden mt-px text-xs text-surface-600-400 truncate">{savedTitle}</p>
			{/if}
			<p class="hidden sm:block mt-1 text-sm text-surface-600-400">
				{#if savedTitle}<span class="lg:hidden">{savedTitle}. </span>{/if}{m.profile_editor_intro()}
			</p>
		</div>
		<div class="hidden sm:flex gap-2">
			<button type="button" class="{cancelBtn} h-11 px-5 text-sm" onclick={onCancel}>{m.common_cancel()}</button>
			<button type="submit" class="{saveBtn} h-11 px-6 text-sm">{m.common_save()}</button>
		</div>
	</header>

	<div class="flex flex-col gap-4 lg:grid lg:grid-cols-[minmax(0,1fr)_280px] xl:grid-cols-[180px_minmax(0,1fr)_300px] lg:items-start lg:gap-6">
		<!-- ── Section index (xl) ─────────────────────────────── -->
		<nav aria-label={m.profile_editor_sections()} class="hidden xl:flex sticky top-6 flex-col gap-0.5">
			<p class="ml-2.5 mb-1.5 text-xs font-bold tracking-wider uppercase text-surface-600-400" aria-hidden="true">
				{m.profile_editor_sections_heading()}
			</p>
			{#each sections as s (s.key)}
				{@const on = activeSection === s.key}
				<a
					href="#{uid}-{s.key}"
					aria-current={on ? 'true' : undefined}
					class="flex gap-2.5 px-2.5 py-2 rounded-base {focusRing} {on ? 'bg-primary-500/10 dark:bg-primary-400/15' : 'hover:preset-tonal-surface'}"
					onclick={(e) => goToSection(e, s.key)}
				>
					<span
						class="size-[22px] shrink-0 rounded-full flex items-center justify-center text-xs font-bold {on
							? 'bg-primary-600 dark:bg-primary-500 text-white'
							: 'border border-surface-400-600'}"
						aria-hidden="true"
					>
						{s.n}
					</span>
					<span class="min-w-0">
						<span class="block text-sm {on ? 'font-semibold' : 'font-medium'}">{s.label}</span>
						{#if s.sub}
							<span class="block text-xs text-surface-600-400 truncate">{s.sub}</span>
						{/if}
					</span>
				</a>
			{/each}
		</nav>

		<!-- ── Sections: one column (phone), two (tablet), one (desktop) ── -->
		<div class="flex flex-col gap-4 md:grid md:grid-cols-2 md:items-start lg:flex">
			<div class="flex flex-col gap-4 min-w-0">
				<!-- 1 · Rifle & scope -->
				<section id="{uid}-rifle" data-section="rifle" aria-labelledby="{uid}-rifle-h" class={sectionCard}>
					{@render sectionHeading('rifle', 1, m.setup_step_rifle())}

					<!-- Weapon designation (name, optic and brand stay plain <input maxlength>: storedProfiles.test.js reads them) -->
					<div class="space-y-1.5">
						<label for="{uid}-name" class="text-sm font-medium block">{m.profile_rifle_designation()}</label>
						<input id="{uid}-name" class="input" type="text" maxlength={MAX_NAME_LENGTH} bind:value={form.name} placeholder={m.profile_rifle_designation_placeholder()} aria-describedby="{uid}-name-note" aria-invalid={fieldError('name') ? 'true' : undefined} />
						{#if fieldError('name')}
							<p id="{uid}-name-note" class="text-xs text-error-500">{fieldError('name')}</p>
						{:else}
							<p id="{uid}-name-note" class="text-xs text-surface-600-400">{m.profile_rifle_designation_hint()}</p>
						{/if}
					</div>

					<!-- Optic name -->
					<div class="space-y-1.5">
						<label for="{uid}-optic" class="text-sm font-medium block">{m.profile_optic_name()}</label>
						<input id="{uid}-optic" class="input" type="text" maxlength={MAX_NAME_LENGTH} bind:value={form.opticName} placeholder={m.profile_optic_name_placeholder()} aria-describedby="{uid}-optic-note" aria-invalid={fieldError('opticName') ? 'true' : undefined} />
						{#if fieldError('opticName')}
							<p id="{uid}-optic-note" class="text-xs text-error-500">{fieldError('opticName')}</p>
						{:else}
							<p id="{uid}-optic-note" class="text-xs text-surface-600-400">{m.profile_optic_name_hint()}</p>
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

					<!-- Reticle type -->
					<div class="space-y-1.5">
						<span class="text-sm font-medium block" aria-hidden="true">{m.profile_optic_reticle_type()}</span>
						<ChipGroup
							label={m.profile_optic_reticle_type()}
							class="flex-wrap"
							value={form.reticleType}
							onselect={(v) => (form.reticleType = v)}
							options={[
								{ value: 'red-dot', label: m.scope_view_reticle_red_dot() },
								{ value: 'moa', label: m.scope_view_reticle_moa() },
								{ value: 'mrad', label: m.scope_view_reticle_mrad() },
								{ value: 'mil-dot', label: m.scope_view_reticle_mil_dot() }
							]}
						/>
						<p class="text-xs text-surface-600-400">{m.profile_optic_reticle_type_hint()}</p>
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

					<!-- Click link -->
					<div>
						<SwitchRow
							bind:checked={form.clickLink}
							title={m.profile_editor_click_same()}
							hint={m.profile_optic_click_link()}
						>
							{#snippet icon()}<Link class="size-4" />{/snippet}
						</SwitchRow>
						{#if form.clickLink}
							<p class="ml-11 text-xs text-surface-600-400">
								{m.profile_editor_windage_linked({
									value: hasValue(form.elevationClickValue) ? `${numberText(form.elevationClickValue)} ${form.elevationClickUnit}` : '—'
								})}
							</p>
						{/if}
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
				</section>

				<!-- 2 · Ammunition -->
				<section id="{uid}-ammo" data-section="ammo" aria-labelledby="{uid}-ammo-h" class={sectionCard}>
					{@render sectionHeading('ammo', 2, m.setup_step_ammo())}

					{#snippet changeButton()}
						<button
							type="button"
							class="btn shrink-0 h-11 px-3.5 gap-1.5 text-[13px] font-semibold border border-current rounded-base {focusRing}"
							onclick={openAmmoLibrary}
						>
							<RefreshCw class="size-4" aria-hidden="true" />
							{m.profile_editor_ammo_change()}
						</button>
					{/snippet}

					{#if ammoComplete}
						<AmmoSummaryCard
							title={form.bulletBrand}
							subtitle={ammoFromLibrary ? m.profile_editor_ammo_from_library() : ''}
							label={m.setup_step_ammo()}
							values={{
								weight: withUnit(form.bulletWeight, form.bulletWeightUnit),
								bc: bcText(form),
								diameter: withUnit(form.bulletDiameter, form.bulletDiameterUnit),
								length: withUnit(form.bulletLength, form.bulletLengthUnit)
							}}
							action={changeButton}
						/>
						<p class="text-xs leading-snug text-surface-600-400">{m.profile_editor_ammo_check()}</p>
						<button
							type="button"
							class="self-start min-h-11 flex items-center gap-2 text-sm font-semibold text-primary-700-300 rounded-base {focusRing}"
							aria-expanded={showAmmoFields}
							aria-controls="{uid}-ammo-fields"
							onclick={() => (ammoOpen = !ammoOpen)}
						>
							{#if showAmmoFields}
								<ChevronDown class="size-4" aria-hidden="true" />
							{:else}
								<ChevronRight class="size-4" aria-hidden="true" />
							{/if}
							{m.profile_editor_ammo_edit_numbers()}
						</button>
					{:else}
						<button
							type="button"
							class="btn preset-tonal-primary h-12 gap-2 text-sm font-semibold {focusRing}"
							onclick={openAmmoLibrary}
						>
							<Library class="size-[18px]" aria-hidden="true" />
							{m.profile_editor_ammo_choose()}
						</button>
						<p class="text-xs leading-snug text-surface-600-400">{m.profile_editor_ammo_or_type()}</p>
					{/if}

					{#if showAmmoFields}
						<div id="{uid}-ammo-fields" class="flex flex-col gap-3.5">
							<!-- Bullet brand -->
							<div class="space-y-1.5">
								<label for="{uid}-brand" class="text-sm font-medium block">{m.profile_ammo_brand()}</label>
								<input id="{uid}-brand" class="input" type="text" maxlength={MAX_NAME_LENGTH} bind:value={form.bulletBrand} placeholder={m.profile_ammo_brand_placeholder()} aria-describedby="{uid}-brand-note" aria-invalid={fieldError('bulletBrand') ? 'true' : undefined} />
								{#if fieldError('bulletBrand')}
									<p id="{uid}-brand-note" class="text-xs text-error-500">{fieldError('bulletBrand')}</p>
								{:else}
									<p id="{uid}-brand-note" class="text-xs text-surface-600-400">{m.profile_ammo_brand_hint()}</p>
								{/if}
							</div>

							<UnitField
								label={m.profile_ammo_diameter()}
								hint={m.profile_ammo_diameter_hint()}
								invalid={fieldError('bulletDiameter')}
								bind:value={form.bulletDiameter}
								bind:unit={form.bulletDiameterUnit}
								units={[{ value: 'in', label: m.unit_in() }, { value: 'mm', label: m.unit_mm() }]}
							/>

							<UnitField
								label={m.profile_ammo_weight()}
								hint={m.profile_ammo_weight_hint()}
								invalid={fieldError('bulletWeight')}
								bind:value={form.bulletWeight}
								bind:unit={form.bulletWeightUnit}
								units={[{ value: 'gr', label: m.unit_gr() }, { value: 'g', label: m.unit_g() }]}
							/>

							<UnitField
								label={m.profile_ammo_bc()}
								hint={m.profile_ammo_bc_hint()}
								invalid={fieldError('bc')}
								bind:value={form.bc}
								bind:unit={form.bcType}
								units={[{ value: 'G1', label: 'G1' }, { value: 'G7', label: 'G7' }]}
								placeholder="0.500"
							/>
						</div>
					{/if}
				</section>
			</div>

			<div class="flex flex-col gap-4 min-w-0">
				<!-- 3 · Velocity -->
				<section id="{uid}-velocity" data-section="velocity" aria-labelledby="{uid}-velocity-h" class={sectionCard}>
					{@render sectionHeading('velocity', 3, m.setup_step_velocity())}

					<UnitField
						label={m.profile_measures_velocity()}
						hint={m.profile_measures_velocity_hint()}
						invalid={fieldError('velocity')}
						bind:value={form.velocity}
						bind:unit={form.velocityUnit}
						units={[{ value: 'fps', label: m.unit_fps() }, { value: 'mps', label: m.unit_mps() }]}
					/>

					<SwitchRow
						bind:checked={tempSensitivity}
						title={m.profile_editor_temp_title()}
						hint={m.profile_editor_temp_hint()}
						controls="{uid}-temp-fields"
					/>

					{#if tempSensitivity}
						<div id="{uid}-temp-fields" class="flex flex-col gap-3.5">
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
						</div>
					{/if}
				</section>

				<!-- 4 · Zero -->
				<section id="{uid}-zero" data-section="zero" aria-labelledby="{uid}-zero-h" class={sectionCard}>
					{@render sectionHeading('zero', 4, m.profile_editor_section_zero())}

					<UnitField
						label={m.profile_optic_zero_dist()}
						hint={m.profile_optic_zero_dist_hint()}
						invalid={fieldError('zeroDist')}
						bind:value={form.zeroDist}
						bind:unit={form.zeroUnit}
						units={[{ value: 'yd', label: m.unit_yd() }, { value: 'm', label: m.unit_m() }]}
					/>
				</section>

				<!-- 5 · Spin drift -->
				<section id="{uid}-spin" data-section="spin" aria-labelledby="{uid}-spin-h" class={sectionCard}>
					{@render sectionHeading('spin', 5, m.profile_editor_section_spin(), m.profile_editor_optional())}

					<SwitchRow
						bind:checked={spinDrift}
						title={m.profile_editor_section_spin()}
						hint={m.profile_editor_spin_hint()}
						controls="{uid}-spin-fields"
					/>

					{#if spinDrift}
						<div id="{uid}-spin-fields" class="flex flex-col gap-3.5">
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

							<UnitField
								label={m.profile_ammo_length()}
								hint={m.profile_ammo_length_hint()}
								invalid={fieldError('bulletLength')}
								bind:value={form.bulletLength}
								bind:unit={form.bulletLengthUnit}
								units={[{ value: 'in', label: m.unit_in() }, { value: 'mm', label: m.unit_mm() }]}
							/>
						</div>
					{/if}
				</section>
			</div>
		</div>

		<!-- ── Summary (lg) ─────────────────────────────────────── -->
		<aside aria-label={m.profile_editor_summary()} class="hidden lg:flex sticky top-6 flex-col gap-3">
			<div class="card preset-filled-surface-100-900 border border-surface-200-800 overflow-hidden">
				<div class="px-4 py-3.5 bg-surface-200-800 border-b border-surface-200-800">
					<p class="text-xs font-bold tracking-wider uppercase text-surface-600-400">{m.profile_editor_summary()}</p>
					<p class="mt-1.5 flex flex-wrap items-center gap-2 text-[17px] font-bold">
						<span class="min-w-0 break-words">{profileTitle(form)}</span>
						{@render inUseBadge()}
					</p>
					<p class="mt-0.5 text-[13px] text-surface-600-400">{m.profile_editor_summary_live()}</p>
				</div>
				<div class="px-4 pt-3 pb-4 flex flex-col gap-3.5 tabular-nums">
					{#each summaryGroups as group (group.heading)}
						<div>
							<p class="mb-1 text-xs font-bold tracking-wider uppercase text-surface-600-400">{group.heading}</p>
							<dl>
								{#each group.rows as [term, value] (term)}
									<div class="flex justify-between gap-3 py-1.5 border-t border-surface-200-800 text-[13px]">
										<dt class="text-surface-600-400">{term}</dt>
										<dd class="font-semibold text-right min-w-0 break-words">{value}</dd>
									</div>
								{/each}
							</dl>
						</div>
					{/each}
				</div>
			</div>
			<button type="submit" class="{saveBtn} h-12 text-[15px]">{m.setup_save()}</button>
		</aside>
	</div>

	<!-- ── Phone: pinned Cancel / Save (the tab bar is hidden on this route) ── -->
	<div
		class="sm:hidden sticky bottom-0 z-10 -mx-4 mt-2 px-4 pt-3 pb-3 border-t border-surface-200-800 bg-surface-50-950 grid grid-cols-2 gap-2.5"
	>
		<button type="button" class="{cancelBtn} h-12 text-[15px]" onclick={onCancel}>{m.common_cancel()}</button>
		<button type="submit" class="{saveBtn} h-12 text-[15px]">{m.common_save()}</button>
	</div>
</form>
