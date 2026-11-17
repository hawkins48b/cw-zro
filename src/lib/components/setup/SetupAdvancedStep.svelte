<script>
	/**
	 * Guided setup, step 4 (optional): spin drift and powder temperature sensitivity (#177).
	 *
	 * The same switches, fields, units, hints and validation as the profile form's Spin drift and
	 * Velocity sections (ProfileForm). The bullet length may already hold the length of the library
	 * pick of step 2.
	 *
	 * @prop {object}   form            - Bindable setup form (GuidedSetup).
	 * @prop {boolean}  spinDrift       - Bindable switch.
	 * @prop {boolean}  tempSensitivity - Bindable switch.
	 * @prop {boolean}  lengthFromPick  - The bullet length is the one of the ammunition picked.
	 * @prop {Function} error(key)      - The error message to show under a field, or ''.
	 */
	import { m } from '#lib/paraglide/messages.js';
	import UnitField from '#lib/components/UnitField.svelte';
	import SwitchRow from '#lib/components/SwitchRow.svelte';

	let {
		form = $bindable(),
		spinDrift = $bindable(false),
		tempSensitivity = $bindable(false),
		lengthFromPick = false,
		error
	} = $props();

	const uid = $props.id();

	let tempModifierUnit = $derived(form.temperatureUnit === 'f' ? m.unit_fps_per_f() : m.unit_fps_per_c());

	// min-w-0: a card must not grow to its content's width on a narrow phone (#177).
	const card = 'card min-w-0 preset-filled-surface-100-900 border border-surface-200-800 p-4 flex flex-col gap-3.5';
</script>

<div class="flex flex-col gap-4">
	<section class={card} aria-label={m.profile_editor_section_spin()}>
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
					invalid={error('barrelTwist')}
					bind:value={form.barrelTwist}
					bind:unit={form.barrelTwistUnit}
					units={[{ value: 'in', label: m.unit_in() }, { value: 'mm', label: m.unit_mm() }]}
					prefix="1 /"
					placeholder="10"
				/>

				<UnitField
					label={m.profile_ammo_length()}
					hint={lengthFromPick ? m.setup_advanced_length_from_pick() : m.profile_ammo_length_hint()}
					invalid={error('bulletLength')}
					bind:value={form.bulletLength}
					bind:unit={form.bulletLengthUnit}
					units={[{ value: 'in', label: m.unit_in() }, { value: 'mm', label: m.unit_mm() }]}
				/>
			</div>
		{/if}
	</section>

	<section class={card} aria-label={m.profile_editor_temp_title()}>
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
					invalid={error('temperature')}
					bind:value={form.temperature}
					bind:unit={form.temperatureUnit}
					units={[{ value: 'f', label: m.unit_f() }, { value: 'c', label: m.unit_c() }]}
				/>

				<UnitField
					label={m.profile_measures_temp_modifier()}
					hint={m.profile_measures_temp_modifier_hint()}
					invalid={error('tempModifier')}
					bind:value={form.tempModifier}
					suffix={tempModifierUnit}
				/>
			</div>
		{/if}
	</section>
</div>
