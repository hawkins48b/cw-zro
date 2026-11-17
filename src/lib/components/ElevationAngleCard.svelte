<script>
	import { m } from '#lib/paraglide/messages.js';
	import StepperField from '#lib/components/StepperField.svelte';
	import { fieldStepSpec } from '#lib/utils/fieldStep.js';
	import { formatNumber } from '#lib/utils/format.js';
	import { isUsableScopeAngle } from '#lib/utils/scopeRange.js';

	/**
	 * Elevation (uphill or downhill) angle card of the Scope View (#166) and the Ballistic page
	 * (#173): one box with − / +, deg / cos chips inside it, and the hint or the angle message under
	 * it. The page applies the angle (scopeAngleCosine in utils/scopeRange.js); this card only shows
	 * the box and reports changes.
	 *
	 * @prop {string|number} angle  - As stored (storedElevation / storedBallisticElevation).
	 * @prop {'deg'|'cos'} unit
	 * @prop {(patch: { angle?: string, unit?: 'deg'|'cos' }) => void} onchange
	 * @prop {string} [limitMessage] - An error of the page's own, shown when the angle is within the
	 *   Scope View's limits but the page cannot use it (the Ballistic table's MIN_TABLE_COSINE).
	 *   Empty: the Scope View's hint and messages only.
	 */
	let { angle, unit, onchange, limitMessage = '' } = $props();

	const uid = $props.id();

	let angleUsable = $derived(isUsableScopeAngle({ angle, unit }));
	let message = $derived(
		!angleUsable
			? unit === 'deg'
				? m.scope_view_deg_invalid()
				: m.scope_view_cos_invalid()
			: limitMessage || m.scope_view_angle_hint()
	);
	let isError = $derived(!angleUsable || !!limitMessage);
	// − / + (#166): 1° in degrees, 0.01 as a cosine (utils/fieldStep.js).
	let angleSpec = $derived(fieldStepSpec('angle', unit));
	let angleStepText = $derived(
		unit === 'deg' ? `${formatNumber(angleSpec.step)}°` : formatNumber(angleSpec.step)
	);
</script>

<section class="card preset-filled-surface-100-900 border border-surface-200-800 px-3.5 py-3 space-y-2">
	<h2 class="text-sm font-semibold">
		<label for="{uid}-angle">{m.scope_view_angle()}</label>
	</h2>
	<StepperField
		id="{uid}-angle"
		value={angle}
		onchange={(value) => onchange({ angle: value })}
		spec={angleSpec}
		decreaseLabel={m.scope_view_step_angle_down({ step: angleStepText })}
		increaseLabel={m.scope_view_step_angle_up({ step: angleStepText })}
		units={[
			{ value: 'deg', label: m.unit_deg() },
			{ value: 'cos', label: m.unit_cos() }
		]}
		{unit}
		unitsLabel={m.scope_view_angle_unit()}
		onunitchange={(value) => onchange({ unit: value })}
		{message}
		messageType={isError ? 'error' : 'hint'}
	/>
</section>
