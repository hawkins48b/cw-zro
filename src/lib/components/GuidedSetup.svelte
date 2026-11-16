<script module>
	/**
	 * The form fields each step asks for (#150), for onValidateStep: keep only the errors of these.
	 * Step 2 also carries bulletLength when a library pick filled it (not checked: spin drift is off).
	 */
	export const STEP_FIELDS = {
		1: ['name', 'opticName', 'opticHeight', 'zeroDist', 'elevationClickValue'],
		2: ['bulletBrand', 'bulletDiameter', 'bulletWeight', 'bc'],
		3: ['velocity']
	};

	export const STEP_COUNT = 3;
</script>

<script>
	/**
	 * Guided profile setup (#150): three steps, full screen (the layout shows no navigation on
	 * /setup). All values stay in one local form, so Back keeps what was entered. The field names and
	 * default units are those of ProfileForm, so the result can go through the same validation.
	 *
	 * @prop {Function} onValidateStep(step, form) - Returns the errors of that step's fields, as
	 *   validateProfile does: { [field]: 'required' | 'invalid_number' | 'out_of_range' }. Empty or
	 *   missing = valid. Called when Next is pressed, then live on that step to clear fixed errors.
	 * @prop {Function} onSave(form) - Called on the last step once it is valid, with a plain copy of
	 *   the form (strings as typed, windage = elevation).
	 * @prop {Function} onExit()     - Back on step 1 (header arrow or footer button).
	 */
	import { tick } from 'svelte';
	import { m } from '#lib/paraglide/messages.js';
	import { ArrowLeftIcon } from '@lucide/svelte';
	import SetupRifleStep from '#lib/components/setup/SetupRifleStep.svelte';
	import SetupAmmoStep from '#lib/components/setup/SetupAmmoStep.svelte';
	import SetupVelocityStep from '#lib/components/setup/SetupVelocityStep.svelte';
	import { profileFieldLimits } from '#lib/utils/profileValidation.js';
	import { formatLimit } from '#lib/utils/format.js';

	let { onValidateStep, onSave, onExit } = $props();

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
	let submitted = $state({ 1: false, 2: false, 3: false });
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
		return onValidateStep?.(s, form) ?? {};
	}

	function hasErrors(e) {
		return Object.values(e).some(Boolean);
	}

	/** Errors of the current step, live once Next was pressed on it. */
	let errors = $derived(submitted[step] ? validate(step) : {});

	const steps = [
		{ labelKey: 'setup_step_rifle', titleKey: 'setup_rifle_title', introKey: 'setup_rifle_intro', nextKey: 'setup_next_ammo' },
		{ labelKey: 'setup_step_ammo', titleKey: 'setup_ammo_title', introKey: 'setup_ammo_intro', nextKey: 'setup_next_velocity' },
		{ labelKey: 'setup_step_velocity', titleKey: 'setup_velocity_title', introKey: 'setup_velocity_intro', nextKey: 'setup_save' }
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

	async function goTo(s) {
		step = s;
		await tick();
		bodyEl?.scrollTo({ top: 0 });
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
			onSave?.($state.snapshot(form));
		}
	}

	function back() {
		if (step > 1) goTo(step - 1);
		else onExit?.();
	}

	const focusRing = 'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary-500';
	const column = 'mx-auto w-full max-w-md';
</script>

<form
	class="h-full flex flex-col"
	style="padding-left: var(--safe-area-left); padding-right: var(--safe-area-right);"
	novalidate
	onsubmit={(e) => {
		e.preventDefault();
		next();
	}}
>
	<!-- Header and progress -->
	<div class="shrink-0 border-b border-surface-200-800">
		<div class="{column} px-2 pt-2 pb-3 sm:px-4">
			<div class="flex items-center gap-1">
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

			<ol class="mt-3 px-2 grid grid-cols-3 gap-2" aria-label={m.setup_progress()}>
				{#each steps as s, i (s.labelKey)}
					{@const n = i + 1}
					<li aria-current={n === step ? 'step' : undefined} class="flex flex-col gap-1.5">
						<span
							class="h-1.5 rounded-full {n <= step ? 'bg-primary-500' : 'bg-surface-200-800'}"
							aria-hidden="true"
						></span>
						<span
							class="text-[11px] leading-tight {n === step
								? 'font-bold text-primary-700-300'
								: 'text-surface-600-400'}"
						>
							{m[s.labelKey]()}
						</span>
					</li>
				{/each}
			</ol>
		</div>
	</div>

	<!-- Step body -->
	<div bind:this={bodyEl} class="flex-1 min-h-0 overflow-y-auto">
		<div class="{column} px-4 pt-5 pb-6 sm:px-6">
			<h1 bind:this={headingEl} tabindex="-1" class="text-2xl leading-tight font-extrabold tracking-tight outline-none">
				{m[current.titleKey]()}
			</h1>
			<p class="mt-2 mb-5 text-[15px] leading-relaxed text-surface-600-400">{m[current.introKey]()}</p>

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
			{:else}
				<SetupVelocityStep bind:form error={fieldError} />
			{/if}
		</div>
	</div>

	<!-- Sticky footer -->
	<div class="shrink-0 border-t border-surface-200-800 bg-surface-50-950">
		<div class="{column} px-4 py-3 sm:px-6 flex gap-2.5">
			<button
				type="button"
				class="btn preset-outlined-surface-300-700 hover:preset-tonal-surface h-12 px-5 text-[15px] font-semibold {focusRing}"
				onclick={back}
			>
				{m.common_back()}
			</button>
			<button
				type="submit"
				class="btn preset-filled-primary-500 flex-1 min-w-0 h-12 text-[15px] font-semibold {focusRing}"
			>
				<span class="truncate">{m[current.nextKey]()}</span>
			</button>
		</div>
	</div>
</form>
