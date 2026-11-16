<script>
	import { Plus, Minus } from '@lucide/svelte';
	import { m } from '#lib/paraglide/messages.js';
	import { readDecimal } from '#lib/utils/decimal.js';
	import { clockHour } from '#lib/utils/windDirection.js';
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

	const STEP = 5;

	/** Turn by ±5°, kept in [0, 360). A box that is not a number starts from 0, as the dial does. */
	function turn(delta) {
		const current = readDecimal(direction) || 0;
		const next = (((current + delta) % 360) + 360) % 360;
		onchange({ direction: String(next) });
	}

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

	<!-- Dial beside the fields from 320 px of card width, above them on a narrow tablet column. -->
	<div class="flex flex-col gap-3 @xs:flex-row @xs:items-center @xs:gap-3.5">
		<WindDial {direction} class="size-28 shrink-0 self-center" onchange={(value) => onchange({ direction: value })} />

		<div class="flex-1 min-w-0 space-y-2">
			<!-- Speed -->
			<div class="space-y-0.5">
				<label for="{uid}-speed" class="text-xs text-surface-600-400">{m.scope_view_wind_speed()}</label>
				<div class="input !flex !items-center gap-1 h-11">
					<input
						id="{uid}-speed"
						class="flex-1 w-8 min-w-0 bg-transparent border-none outline-none shadow-none p-0 font-semibold"
						type="text"
						inputmode="decimal"
						autocomplete="off"
						placeholder="0"
						value={speed}
						oninput={(e) => onchange({ speed: e.target.value })}
					/>
					<ChipGroup
						label={m.scope_view_wind_speed_unit()}
						options={[{ value: 'mph', label: m.unit_mph() }, { value: 'mps', label: m.unit_mps() }]}
						value={speedUnit}
						onselect={(value) => onchange({ speedUnit: value })}
					/>
				</div>
			</div>

			<!-- Direction, where the wind comes from -->
			<div class="space-y-0.5">
				<label for="{uid}-dir" class="text-xs text-surface-600-400">{m.scope_view_wind_comes_from()}</label>
				<div class="input !flex !items-center !p-0 h-11 overflow-hidden">
					<button
						type="button"
						class="h-full w-11 shrink-0 flex items-center justify-center preset-tonal-surface focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-primary-500"
						aria-label={m.scope_view_wind_turn_left({ step: String(STEP) })}
						onclick={() => turn(-STEP)}
					>
						<Minus class="size-4" />
					</button>
					<input
						id="{uid}-dir"
						class="flex-1 w-8 min-w-0 bg-transparent border-none outline-none shadow-none px-1 py-0 text-right font-semibold"
						type="text"
						inputmode="decimal"
						autocomplete="off"
						placeholder="0"
						value={direction}
						aria-describedby="{uid}-clock"
						oninput={(e) => onchange({ direction: e.target.value })}
					/>
					<span class="pr-1 text-sm" aria-hidden="true">°</span>
					<button
						type="button"
						class="h-full w-11 shrink-0 flex items-center justify-center preset-tonal-surface focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-primary-500"
						aria-label={m.scope_view_wind_turn_right({ step: String(STEP) })}
						onclick={() => turn(STEP)}
					>
						<Plus class="size-4" />
					</button>
				</div>
				<p id="{uid}-clock" class="text-xs text-surface-600-400">{clockText}</p>
			</div>
		</div>
	</div>

	<p class="text-xs text-surface-600-400">
		{m.scope_view_wind_dir_from()}{#if activePreset}<br /><span class="italic">{activePreset.hint()}</span>{/if}
	</p>
</section>
