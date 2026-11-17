<script>
	/**
	 * Range card of the 3D ballistic tutorial (#182): target distance, shooter altitude and target
	 * elevation (relative to the shooter), each a − / + box with its unit chips inside (StepperField,
	 * as on the Scope View and the shared cards). The card computes nothing: a step or a typed value
	 * goes to `onchange` as text, the way the other pages pass typed values to their store.
	 *
	 * Steps and limits: fieldStepSpec in utils/fieldStep.js.
	 * - distance ('targetDistance'): 25 m or yd, 1 to MAX_DISTANCE, a step from an empty box starts at
	 *   300 (the default, #180);
	 * - altitude ('altitude'): 10 m or ft within the Atmosphere card's limits;
	 * - elevation ('targetElevation'): 1 m or 5 ft, within TARGET_ELEVATION_LIMITS (±500 m, ±1640 ft),
	 *   a step from an empty box starts at 0.
	 *
	 * @prop {{ distance: string, unit: 'm'|'yd' }} range
	 * @prop {{ altitude: string, elevation: string, unit: 'm'|'ft' }} terrain
	 *   One height unit for the shooter altitude and the target elevation.
	 * @prop {(patch: { distance?: string, unit?: 'm'|'yd' }) => void} onrangechange
	 * @prop {(patch: { altitude?: string, elevation?: string, unit?: 'm'|'ft' }) => void} onterrainchange
	 * @prop {string} [distanceError]  - Error under the distance box ('' for none).
	 * @prop {string} [altitudeError]  - Error under the altitude box ('' shows the hint).
	 * @prop {string} [elevationError] - Error under the elevation box ('' shows the hint).
	 * @prop {string} [slope] - The slope to the target, formatted with its unit ('2.3°'); '' hides it.
	 */
	import { m } from '#lib/paraglide/messages.js';
	import { fieldStepSpec } from '#lib/utils/fieldStep.js';
	import { formatNumber } from '#lib/utils/format.js';
	import StepperField from '#lib/components/StepperField.svelte';

	let {
		range,
		terrain,
		onrangechange,
		onterrainchange,
		distanceError = '',
		altitudeError = '',
		elevationError = '',
		slope = ''
	} = $props();

	const uid = $props.id();

	const distanceSpec = fieldStepSpec('targetDistance');
	let altitudeSpec = $derived(fieldStepSpec('altitude', terrain.unit));
	let elevationSpec = $derived(fieldStepSpec('targetElevation', terrain.unit));

	let distUnit = $derived(range.unit === 'm' ? m.unit_m() : m.unit_yd());
	let heightUnit = $derived(terrain.unit === 'm' ? m.unit_m() : m.unit_ft());
	let distanceStep = $derived(`${formatNumber(distanceSpec.step)} ${distUnit}`);
	let altitudeStep = $derived(`${formatNumber(altitudeSpec.step)} ${heightUnit}`);
	let elevationStep = $derived(`${formatNumber(elevationSpec.step)} ${heightUnit}`);

	let distanceUnits = $derived([
		{ value: 'm', label: m.unit_m() },
		{ value: 'yd', label: m.unit_yd() }
	]);
	let heightUnits = $derived([
		{ value: 'm', label: m.unit_m() },
		{ value: 'ft', label: m.unit_ft() }
	]);
</script>

<section
	class="card preset-filled-surface-100-900 border border-surface-200-800 px-3.5 py-3 space-y-2.5 min-w-0"
	aria-labelledby="{uid}-title"
>
	<h2 id="{uid}-title" class="text-sm font-semibold">{m.tutorial_range_title()}</h2>

	<StepperField
		id="{uid}-distance"
		label={m.tutorial_target_distance()}
		value={range.distance}
		onchange={(text) => onrangechange?.({ distance: text })}
		spec={distanceSpec}
		placeholder="300"
		decreaseLabel={m.tutorial_step_distance_down({ step: distanceStep })}
		increaseLabel={m.tutorial_step_distance_up({ step: distanceStep })}
		units={distanceUnits}
		unit={range.unit}
		unitsLabel={m.tutorial_distance_unit()}
		onunitchange={(unit) => onrangechange?.({ unit })}
		message={distanceError}
		messageType="error"
	/>

	<StepperField
		id="{uid}-altitude"
		label={m.tutorial_shooter_altitude()}
		value={terrain.altitude}
		onchange={(text) => onterrainchange?.({ altitude: text })}
		spec={altitudeSpec}
		decreaseLabel={m.scope_view_step_altitude_down({ step: altitudeStep })}
		increaseLabel={m.scope_view_step_altitude_up({ step: altitudeStep })}
		units={heightUnits}
		unit={terrain.unit}
		unitsLabel={m.tutorial_height_unit()}
		onunitchange={(unit) => onterrainchange?.({ unit })}
		message={altitudeError || m.tutorial_shooter_altitude_hint()}
		messageType={altitudeError ? 'error' : 'hint'}
	/>

	<StepperField
		id="{uid}-elevation"
		label={m.tutorial_target_elevation()}
		value={terrain.elevation}
		onchange={(text) => onterrainchange?.({ elevation: text })}
		spec={elevationSpec}
		decreaseLabel={m.tutorial_step_elevation_down({ step: elevationStep })}
		increaseLabel={m.tutorial_step_elevation_up({ step: elevationStep })}
		units={heightUnits}
		unit={terrain.unit}
		unitsLabel={m.tutorial_height_unit()}
		onunitchange={(unit) => onterrainchange?.({ unit })}
		message={elevationError || m.tutorial_target_elevation_hint()}
		messageType={elevationError ? 'error' : 'hint'}
		describedby={slope ? `${uid}-slope` : ''}
	/>
	{#if slope}
		<p id="{uid}-slope" class="text-xs text-surface-600-400">{m.tutorial_slope({ angle: slope })}</p>
	{/if}
</section>
