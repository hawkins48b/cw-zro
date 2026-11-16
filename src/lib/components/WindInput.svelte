<script>
	import { m } from '#lib/paraglide/messages.js';
	import { readDecimal } from '#lib/utils/decimal.js';
	import WindDial from '#lib/components/WindDial.svelte';

	let { speed, speedUnit, direction, onchange } = $props();

	// Quick wind presets — mps and mph values are independent round numbers
	const WIND_PRESETS = [
		{ key: 'no_wind', mps: 0, mph: 0, label: () => m.scope_view_wind_no_wind(), hint: () => m.scope_view_wind_hint_no_wind() },
		{ key: 'light_wind', mps: 3.5, mph: 8, label: () => m.scope_view_wind_light_wind(), hint: () => m.scope_view_wind_hint_light_wind() },
		{ key: 'strong_wind', mps: 9, mph: 20, label: () => m.scope_view_wind_strong_wind(), hint: () => m.scope_view_wind_hint_strong_wind() }
	];

	let activePreset = $derived(
		WIND_PRESETS.find((p) => {
			const target = speedUnit === 'mph' ? p.mph : p.mps;
			return Math.abs((readDecimal(speed) || 0) - target) < 0.01;
		}) ?? null
	);

	function applyPreset(preset) {
		const value = speedUnit === 'mph' ? preset.mph : preset.mps;
		onchange({ speed: String(value) });
	}
</script>

<div class="space-y-3">
	<div class="flex items-start gap-4">
		<!-- ── Direction dial ──────────────────────────── -->
		<div class="shrink-0 flex flex-col items-center gap-1">
			<span class="text-xs font-semibold text-warning-500">{m.scope_view_wind_target_direction()}</span>
			<WindDial {direction} onchange={(value) => onchange({ direction: value })} />
			<span class="text-xs text-surface-600-400">{m.scope_view_wind_relative_to_shooter()}</span>
		</div>

		<!-- ── Speed & direction inputs ───────────────── -->
		<div class="flex-1 space-y-3 min-w-0">
			<!-- Wind speed -->
			<div class="space-y-1">
				<span class="text-xs text-surface-600-400">{m.scope_view_wind_speed()}</span>
				<div class="input !flex !items-center gap-2">
					<input
						class="w-10 shrink-0 bg-transparent border-none outline-none shadow-none p-0 text-sm"
						type="text"
						inputmode="decimal"
						placeholder="0"
						value={speed}
						oninput={(e) => onchange({ speed: e.target.value })}
					/>
					<div class="flex items-center gap-1 ml-auto shrink-0">
						{#each [{ value: 'mph', label: m.unit_mph() }, { value: 'mps', label: m.unit_mps() }] as opt}
							<button
								type="button"
								class="chip text-xs {speedUnit === opt.value
									? 'preset-filled-primary-500'
									: 'preset-tonal-surface'}"
								onclick={() => onchange({ speedUnit: opt.value })}
							>{opt.label}</button>
						{/each}
					</div>
				</div>
			</div>

			<!-- Wind direction (degrees only) -->
			<div class="space-y-1">
				<span class="text-xs text-surface-600-400">{m.scope_view_wind_dir()}</span>
				<div class="input !flex !items-center gap-2">
					<input
						class="w-10 shrink-0 bg-transparent border-none outline-none shadow-none p-0 text-sm"
						type="text"
						inputmode="decimal"
						placeholder="0"
						value={direction}
						oninput={(e) => onchange({ direction: e.target.value })}
					/>
					<span class="text-xs text-surface-600-400 ml-auto shrink-0">{m.unit_deg()}</span>
				</div>
				<p class="text-xs text-surface-600-400">{m.scope_view_wind_dir_from()}</p>
			</div>
		</div>
	</div>

	<!-- ── Quick wind presets ──────────────────────────────── -->
	<div class="space-y-2">
		<div class="flex gap-2">
			{#each WIND_PRESETS as preset}
				<button
					type="button"
					class="chip text-xs flex-1 {activePreset?.key === preset.key
						? 'preset-filled-primary-500'
						: 'preset-tonal-surface'}"
					onclick={() => applyPreset(preset)}
				>
					{preset.label()}
				</button>
			{/each}
		</div>
		{#if activePreset}
			<p class="text-xs text-surface-600-400 italic">{activePreset.hint()}</p>
		{/if}
	</div>
</div>
