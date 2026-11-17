<script>
	import { m } from '#lib/paraglide/messages.js';
	import { readDecimal } from '#lib/utils/decimal.js';
	import { clockHour } from '#lib/utils/windDirection.js';
	import { fieldStepSpec } from '#lib/utils/fieldStep.js';
	import { formatNumber } from '#lib/utils/format.js';
	import StepperField from '#lib/components/StepperField.svelte';
	import ChipGroup from '#lib/components/ChipGroup.svelte';
	import WindDial from '#lib/components/WindDial.svelte';

	/**
	 * Wind card of the Scope View (#148) and the Ballistic page (#151): None / Light / Strong presets, speed with mph / m/s,
	 * direction dial, a − / + 5° direction box and an o'clock hint. The direction is where the wind
	 * comes from (#106).
	 *
	 * The presets' speeds are the page's business (owner decision on #148: Light 3.5 m/s or 7.8 mph,
	 * Strong 9 m/s or 20.1 mph): this card only reports the chip tapped and shows the one it is told.
	 *
	 * @prop {string} speed      - As typed (text), from scopeView.wind (the safe-to-show wind).
	 * @prop {'mph'|'mps'} speedUnit
	 * @prop {string} direction  - Degrees, where the wind comes from, as typed (text).
	 * @prop {'none'|'light'|'strong'|null} preset - The chip to mark: the preset the speed matches, or null.
	 * @prop {(patch: { speed?: string, speedUnit?: string, direction?: string }) => void} onchange
	 * @prop {(preset: 'none'|'light'|'strong') => void} onpreset
	 */
	let { speed, speedUnit, direction, preset = null, onchange, onpreset } = $props();

	const uid = $props.id();

	const PRESETS = [
		{ value: 'none', label: m.scope_view_wind_preset_none(), hint: () => m.scope_view_wind_hint_no_wind() },
		{ value: 'light', label: m.scope_view_wind_preset_light(), hint: () => m.scope_view_wind_hint_light_wind() },
		{ value: 'strong', label: m.scope_view_wind_preset_strong(), hint: () => m.scope_view_wind_hint_strong_wind() }
	];
	let activePreset = $derived(PRESETS.find((p) => p.value === preset) ?? null);

	// − / + steps (#166): utils/fieldStep.js. The direction turns by 5° in [0, 360), from 0 for a box
	// that is not a number, as the dial does.
	const DIRECTION_SPEC = fieldStepSpec('windDirection');
	let speedSpec = $derived(fieldStepSpec('windSpeed', speedUnit));
	let speedStepText = $derived(
		`${formatNumber(speedSpec.step)} ${speedUnit === 'mps' ? m.unit_mps() : m.unit_mph()}`
	);

	let hour = $derived(clockHour(readDecimal(direction)));
	let clockText = $derived.by(() => {
		if (hour === null) return '';
		if (hour === 12) return m.scope_view_wind_clock_12();
		if (hour === 3) return m.scope_view_wind_clock_3();
		if (hour === 6) return m.scope_view_wind_clock_6();
		if (hour === 9) return m.scope_view_wind_clock_9();
		return m.scope_view_wind_clock({ hour: String(hour) });
	});
</script>

<section class="@container card preset-filled-surface-100-900 border border-surface-200-800 px-3.5 py-3 space-y-2.5">
	<div class="flex items-center justify-between gap-2 flex-wrap">
		<h2 class="text-sm font-semibold">{m.scope_view_wind()}</h2>
		<ChipGroup
			label={m.scope_view_wind_presets()}
			options={PRESETS.map(({ value, label }) => ({ value, label }))}
			value={preset}
			onselect={(value) => onpreset?.(value)}
		/>
	</div>

	<!-- Large dial above the fields on phones and narrow columns (#155), beside them from 448 px of
		card width. -->
	<div class="flex flex-col gap-3 @md:flex-row @md:items-center @md:gap-4">
		<WindDial
			{direction}
			class="w-full max-w-60 aspect-square shrink-0 self-center @md:size-48"
			onchange={(value) => onchange({ direction: value })}
		/>

		<div class="flex-1 min-w-0 space-y-2">
			<!-- Speed: − / + by 0.5 m/s or 1 mph (#166) -->
			<StepperField
				id="{uid}-speed"
				label={m.scope_view_wind_speed()}
				value={speed}
				onchange={(text) => onchange({ speed: text })}
				spec={speedSpec}
				decreaseLabel={m.scope_view_step_speed_down({ step: speedStepText })}
				increaseLabel={m.scope_view_step_speed_up({ step: speedStepText })}
				units={[{ value: 'mph', label: m.unit_mph() }, { value: 'mps', label: m.unit_mps() }]}
				unit={speedUnit}
				unitsLabel={m.scope_view_wind_speed_unit()}
				onunitchange={(value) => onchange({ speedUnit: value })}
			/>

			<!-- Direction, where the wind comes from: − / + 5° round the dial -->
			<div class="space-y-0.5">
				<StepperField
					id="{uid}-dir"
					label={m.scope_view_wind_comes_from()}
					value={direction}
					onchange={(text) => onchange({ direction: text })}
					spec={DIRECTION_SPEC}
					decreaseLabel={m.scope_view_wind_turn_left({ step: String(DIRECTION_SPEC.step) })}
					increaseLabel={m.scope_view_wind_turn_right({ step: String(DIRECTION_SPEC.step) })}
					suffix="°"
					describedby="{uid}-clock"
				/>
				<p id="{uid}-clock" class="text-xs text-surface-600-400">{clockText}</p>
			</div>
		</div>
	</div>

	<p class="text-xs text-surface-600-400">
		{m.scope_view_wind_dir_from()}{#if activePreset}<br /><span class="italic">{activePreset.hint()}</span>{/if}
	</p>
</section>
