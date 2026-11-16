<script>
	/**
	 * Guided setup, step 3: muzzle velocity (#150).
	 *
	 * @prop {object}   form       - Bindable setup form (GuidedSetup).
	 * @prop {Function} error(key) - The error message to show under a field, or ''.
	 */
	import { m } from '#lib/paraglide/messages.js';
	import UnitField from '#lib/components/UnitField.svelte';

	let { form = $bindable(), error } = $props();
</script>

<div class="flex flex-col gap-4">
	<UnitField
		label={m.setup_field_velocity()}
		hint={m.setup_field_velocity_hint()}
		invalid={error('velocity')}
		bind:value={form.velocity}
		bind:unit={form.velocityUnit}
		units={[{ value: 'fps', label: m.unit_fps() }, { value: 'mps', label: m.unit_mps() }]}
	/>
</div>
