<script>
	/**
	 * Guided profile setup (#150): four steps (#177: the fourth, spin drift and temperature
	 * sensitivity, is optional and can be skipped), full screen (the layout shows no navigation on
	 * /setup). From sm: a top bar and one centred card (#166). All values stay in one local form, so
	 * Back keeps what was entered. The field names and default units are those of ProfileForm, so the
	 * result can go through the same validation.
	 *
	 * @prop {Function} onValidateStep(step, form, advanced) - Returns the errors of that step's
	 *   fields, as validateProfile does: { [field]: 'required' | 'invalid_number' | 'out_of_range' }.
	 *   Empty or missing = valid. Called when Next is pressed, then live on that step to clear fixed
	 *   errors. advanced = { spinDrift, tempSensitivity }, the switches of step 4.
	 * @prop {Function} onSave(form, advanced) - Called on the last step once it is valid, with a plain
	 *   copy of the form (strings as typed, windage = elevation) and the switches. Skip calls it with
	 *   both switches off, without checking step 4.
	 * @prop {Function} onExit()     - Back on step 1 (header arrow or footer button).
	 * @prop {string}   [fullFormHref] - "Use the full form" link on step 1 (#177); none when empty.
	 */
	import { tick } from 'svelte';
	import { m } from '#lib/paraglide/messages.js';
	import { ArrowLeftIcon } from '@lucide/svelte';
	import favicon from '#lib/assets/favicon.svg';
	import DarkModeToggle from '#lib/components/DarkModeToggle.svelte';
	import SetupRifleStep from '#lib/components/setup/SetupRifleStep.svelte';
	import SetupAmmoStep from '#lib/components/setup/SetupAmmoStep.svelte';
	import SetupVelocityStep from '#lib/components/setup/SetupVelocityStep.svelte';
	import SetupAdvancedStep from '#lib/components/setup/SetupAdvancedStep.svelte';
	import { SETUP_STEP_COUNT as STEP_COUNT } from '#lib/utils/setupSteps.js';
	import { profileFieldLimits } from '#lib/utils/profileValidation.js';
	import { formatLimit } from '#lib/utils/format.js';

	let { onValidateStep, onSave, onExit, fullFormHref = '' } = $props();

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

	let step = $state(1);
	/** Steps on which Next was pressed: their errors are shown. */
	let submitted = $state({ 1: false, 2: false, 3: false, 4: false });
	/** Step 4 (#177): the two switches, off until turned on. */
	let advanced = $state({ spinDrift: false, tempSensitivity: false });
	/** Step 2: the library entry picked, and whether the bullet fields are open. */
	let ammoPick = $state(null);
	let ammoManual = $state(false);

	let bodyEl = $state(null);
	let headingEl = $state(null);

	// Clicks are linked in the guided setup: windage = elevation (ProfileForm's default).
	$effect(() => {
		form.windageClickValue = form.elevationClickValue;
		form.windageClickUnit = form.elevationClickUnit;
	});

	function validate(s) {
		return onValidateStep?.(s, form, advanced) ?? {};
	}

	function hasErrors(e) {
		return Object.values(e).some(Boolean);
	}

	/** Errors of the current step, live once Next was pressed on it. */
	let errors = $derived(submitted[step] ? validate(step) : {});

	const steps = [
		{ labelKey: 'setup_step_rifle', titleKey: 'setup_rifle_title', introKey: 'setup_rifle_intro', nextKey: 'setup_next_ammo' },
		{ labelKey: 'setup_step_ammo', titleKey: 'setup_ammo_title', introKey: 'setup_ammo_intro', nextKey: 'setup_next_velocity' },
		{ labelKey: 'setup_step_velocity', titleKey: 'setup_velocity_title', introKey: 'setup_velocity_intro', nextKey: 'setup_next_advanced' },
		{ labelKey: 'setup_step_advanced', titleKey: 'setup_advanced_title', introKey: 'setup_advanced_intro', nextKey: 'setup_save' }
	];
	let current = $derived(steps[step - 1]);

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

	/** Same messages as ProfileForm. */
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
		const e = errors[key];
		if (!e) return '';
		if (e === 'required') return m.validation_required();
		if (e === 'out_of_range') return rangeError(key);
		return m.validation_positive_number();
	}

	let ammoMissing = $derived(step === 2 && !ammoManual && hasErrors(errors));

	/** Step 4: the bullet length is still the one the library pick of step 2 filled in. */
	let lengthFromPick = $derived(
		Boolean(ammoPick?.length) && form.bulletLength === String(ammoPick.length) && form.bulletLengthUnit === ammoPick.lengthUnit.toLowerCase()
	);

	async function goTo(s) {
		step = s;
		await tick();
		bodyEl?.scrollTo({ top: 0 });
		// From sm the page scrolls as a whole (the form), not the step body.
		bodyEl?.closest('form')?.scrollTo({ top: 0 });
		headingEl?.focus();
	}

	async function focusFirstError() {
		await tick();
		bodyEl?.querySelector('[aria-invalid="true"]')?.focus();
	}

	function next() {
		const e = validate(step);
		if (hasErrors(e)) {
			submitted[step] = true;
			// A pick that fails (e.g. out of range) opens its fields, so the error can be seen.
			if (step === 2 && ammoPick) ammoManual = true;
			focusFirstError();
			return;
		}
		if (step < STEP_COUNT) {
			goTo(step + 1);
		} else {
			onSave?.($state.snapshot(form), $state.snapshot(advanced));
		}
	}

	/** Step 4: save without spin drift and temperature sensitivity, whatever the switches say. */
	function skip() {
		onSave?.($state.snapshot(form), { spinDrift: false, tempSensitivity: false });
	}

	function back() {
		if (step > 1) goTo(step - 1);
		else onExit?.();
	}

	const focusRing = 'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary-500';
	const column = 'mx-auto w-full max-w-md';
</script>

<!--
	Phone: full screen, header and progress at the top, the step scrolling, a sticky footer.
	sm and up (#166, SetupTablet and SetupDesktop boards): no rail or sidebar; a top bar (logo, "New
	profile", step, theme) and one centred card with the progress, the step and Back / Next. The page
	scrolls as a whole. The card wrapper is `display: contents` on phones, so the phone layout is the
	one of #150.
	Phone width (#177): nothing may be wider than the screen. The root clips sideways as a last guard;
	the causes are handled where they are (labels that wrap, cards with min-w-0, the step body that
	only scrolls up and down).
-->
<div class="h-full min-w-0 flex flex-col overflow-x-clip" style="padding-left: var(--safe-area-left); padding-right: var(--safe-area-right);">
	<!-- Top bar, sm and up -->
	<header
		class="hidden sm:flex shrink-0 flex-wrap items-center gap-x-4 gap-y-3 px-6 py-4 lg:px-10 lg:border-b lg:border-surface-200-800 lg:bg-surface-100-900"
	>
		<img src={favicon} alt="" class="size-9 shrink-0" />
		<div class="flex-1 min-w-0 flex flex-wrap items-baseline gap-x-3 gap-y-1">
			<span class="font-semibold text-[17px] lg:hidden">{m.profiles_new()}</span>
			<span class="hidden lg:block font-extrabold text-lg leading-none">ZRO</span>
			<span class="text-sm text-surface-600-400 lg:hidden">{m.setup_step_of({ step, total: STEP_COUNT })}</span>
			<span class="hidden lg:block w-full text-xs text-surface-600-400">
				{m.profiles_new()} · {m.setup_step_of({ step, total: STEP_COUNT })}
			</span>
		</div>
		<div class="lg:hidden">
			<DarkModeToggle class="border border-surface-200-800" />
		</div>
		<div class="hidden lg:block w-[180px]">
			<DarkModeToggle variant="segmented" />
		</div>
	</header>

	<form
		class="flex-1 min-h-0 flex flex-col sm:block sm:overflow-y-auto sm:px-6 sm:pt-1 sm:pb-6 lg:pt-10 lg:pb-14"
		novalidate
		onsubmit={(e) => {
			e.preventDefault();
			next();
		}}
	>
		<div
			class="contents sm:flex sm:flex-col sm:mx-auto sm:w-full sm:max-w-[680px] lg:max-w-[760px] sm:rounded-container sm:border sm:border-surface-200-800 sm:bg-surface-100-900 sm:shadow-sm"
		>
			<!-- Header and progress -->
			<div class="shrink-0 border-b border-surface-200-800 sm:border-0">
				<div class="{column} px-2 pt-2 pb-3 sm:max-w-none sm:px-7 sm:pt-6 sm:pb-0">
					<div class="flex items-center gap-1 sm:hidden">
						<button
							type="button"
							onclick={back}
							class="btn-icon size-11 shrink-0 rounded-base hover:preset-tonal-surface {focusRing}"
							aria-label={m.common_back()}
							title={m.common_back()}
						>
							<ArrowLeftIcon class="size-5" aria-hidden="true" />
						</button>
						<span class="flex-1 min-w-0 truncate font-bold text-xl">{m.profiles_new()}</span>
						<span class="shrink-0 pr-2 text-sm text-surface-600-400">
							{m.setup_step_of({ step, total: STEP_COUNT })}
						</span>
					</div>

					<ol class="mt-3 px-2 grid grid-cols-4 gap-2 sm:mt-0 sm:px-0" aria-label={m.setup_progress()}>
						{#each steps as s, i (s.labelKey)}
							{@const n = i + 1}
							<li aria-current={n === step ? 'step' : undefined} class="min-w-0 flex flex-col gap-1.5">
								<span
									class="h-1.5 sm:h-1 rounded-full {n <= step ? 'bg-primary-500' : 'bg-surface-200-800'}"
									aria-hidden="true"
								></span>
								<span
									class="text-[11px] sm:text-xs leading-tight break-words hyphens-auto {n === step
										? 'font-bold text-primary-700-300'
										: 'text-surface-600-400 sm:font-medium'}"
								>
									<span class="hidden sm:inline">{n} · </span>{m[s.labelKey]()}
								</span>
							</li>
						{/each}
					</ol>
				</div>
			</div>

			<!-- Step body: scrolls inside on phones, with the page from sm -->
			<div bind:this={bodyEl} class="flex-1 min-h-0 overflow-y-auto overflow-x-hidden sm:flex-none sm:overflow-visible">
				<div class="{column} px-4 pt-5 pb-6 sm:max-w-none sm:px-7 sm:pt-5 sm:pb-5">
					<h1
						bind:this={headingEl}
						tabindex="-1"
						class="text-2xl sm:text-[26px] leading-tight font-extrabold sm:font-bold tracking-tight outline-none"
					>
						{m[current.titleKey]()}
					</h1>
					<p class="mt-2 mb-5 text-[15px] leading-relaxed text-surface-600-400">{m[current.introKey]()}</p>

					{#if step === 1 && fullFormHref}
						<!-- #177: the profile form with every field; it replaces this page in the history. -->
						<p class="-mt-3 mb-4 text-sm">
							<a
								href={fullFormHref}
								data-sveltekit-replacestate
								class="font-semibold text-primary-700-300 underline underline-offset-2 hover:no-underline rounded-sm {focusRing}"
							>
								{m.setup_full_form()}
							</a>
						</p>
					{/if}

					{#if step === 1}
						<SetupRifleStep bind:form error={fieldError} />
					{:else if step === 2}
						<SetupAmmoStep
							bind:form
							bind:pick={ammoPick}
							bind:manual={ammoManual}
							error={fieldError}
							missing={ammoMissing}
						/>
					{:else if step === 3}
						<SetupVelocityStep bind:form error={fieldError} />
					{:else}
						<SetupAdvancedStep
							bind:form
							bind:spinDrift={advanced.spinDrift}
							bind:tempSensitivity={advanced.tempSensitivity}
							{lengthFromPick}
							error={fieldError}
						/>
					{/if}
				</div>
			</div>

			<!-- Footer: sticky on phones, the bottom of the card from sm -->
			<div class="shrink-0 border-t border-surface-200-800 bg-surface-50-950 sm:bg-transparent">
				<div class="{column} px-4 py-3 sm:max-w-none sm:px-7 sm:py-4 flex {step === STEP_COUNT ? 'gap-2' : 'gap-2.5'} sm:gap-2.5">
					<!-- Step 4 has three buttons: narrower padding on phones, so Save keeps its label. -->
					<button
						type="button"
						class="btn preset-outlined-surface-300-700 hover:preset-tonal-surface h-12 {step === STEP_COUNT ? 'px-3' : 'px-5'} sm:px-5 text-[15px] font-semibold {focusRing}"
						onclick={back}
					>
						{m.common_back()}
					</button>
					{#if step === STEP_COUNT}
						<button
							type="button"
							class="btn preset-tonal-surface hover:preset-outlined-surface-300-700 h-12 px-3 sm:px-5 sm:ml-auto text-[15px] font-semibold {focusRing}"
							onclick={skip}
						>
							{m.setup_skip()}
						</button>
					{/if}
					<button
						type="submit"
						class="btn preset-filled-primary-500 flex-1 sm:flex-none {step === STEP_COUNT ? '' : 'sm:ml-auto'} sm:min-w-56 min-w-0 h-12 text-[15px] font-semibold {focusRing}"
					>
						{#if step === STEP_COUNT}
							<span class="truncate sm:hidden">{m.common_save()}</span>
							<span class="hidden sm:inline truncate">{m[current.nextKey]()}</span>
						{:else}
							<span class="truncate">{m[current.nextKey]()}</span>
						{/if}
					</button>
				</div>
			</div>
		</div>
	</form>
</div>
