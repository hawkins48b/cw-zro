<script>
	/**
	 * Guided setup, step 1: rifle and scope (#150).
	 *
	 * @prop {object}   form       - Bindable setup form (GuidedSetup).
	 * @prop {Function} error(key) - The error message to show under a field, or ''.
	 */
	import { m } from '#lib/paraglide/messages.js';
	import UnitField from '#lib/components/UnitField.svelte';
	import TextField from '#lib/components/setup/TextField.svelte';
	import { MAX_NAME_LENGTH } from '#lib/utils/storedProfiles.js';

	let { form = $bindable(), error } = $props();
</script>

<div class="flex flex-col gap-4">
	<TextField
		label={m.setup_field_name()}
		hint={m.profile_rifle_designation_hint()}
		placeholder={m.profile_rifle_designation_placeholder()}
		maxlength={MAX_NAME_LENGTH}
		invalid={error('name')}
		bind:value={form.name}
	/>

	<TextField
		label={m.setup_field_scope()}
		hint={m.profile_optic_name_hint()}
		placeholder={m.profile_optic_name_placeholder()}
		maxlength={MAX_NAME_LENGTH}
		invalid={error('opticName')}
		bind:value={form.opticName}
	/>

	<UnitField
		label={m.setup_field_scope_height()}
		hint={m.profile_optic_height_hint()}
		invalid={error('opticHeight')}
		bind:value={form.opticHeight}
		bind:unit={form.opticHeightUnit}
		units={[{ value: 'in', label: m.unit_in() }, { value: 'cm', label: m.unit_cm() }]}
	/>

	<UnitField
		label={m.setup_field_zero()}
		hint={m.profile_optic_zero_dist_hint()}
		invalid={error('zeroDist')}
		bind:value={form.zeroDist}
		bind:unit={form.zeroUnit}
		units={[{ value: 'yd', label: m.unit_yd() }, { value: 'm', label: m.unit_m() }]}
	/>

	<UnitField
		label={m.setup_field_click()}
		hint={m.setup_field_click_hint()}
		invalid={error('elevationClickValue')}
		bind:value={form.elevationClickValue}
		bind:unit={form.elevationClickUnit}
		units={[{ value: 'MOA', label: m.unit_moa() }, { value: 'MRAD', label: m.unit_mrad() }]}
		placeholder="0.5"
	/>
</div>
