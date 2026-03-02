<script>
	import { m } from '$lib/paraglide/messages.js';

	let { atmosphere, onchange } = $props();
</script>

<div class="card preset-filled-surface-100-900">
	<div class="p-4 space-y-4">
		<!-- ISA toggle -->
		<label class="flex items-center gap-2 cursor-pointer select-none border-b border-surface-200-800 pb-2">
			<input
				type="checkbox"
				class="checkbox"
				checked={atmosphere.useISA}
				onchange={(e) => onchange({ useISA: e.target.checked })}
			/>
			<span class="text-sm">{m.ballistic_use_isa()}</span>
		</label>

		{#if !atmosphere.useISA}
			<!-- Altitude -->
			<div class="space-y-1.5">
				<span class="text-sm font-medium">{m.ballistic_altitude()}</span>
				<div class="input !flex !items-center gap-2">
					<input
						class="flex-1 min-w-0 bg-transparent border-none outline-none shadow-none p-0 text-sm"
						type="text"
						inputmode="decimal"
						value={atmosphere.altitude}
						oninput={(e) => onchange({ altitude: e.target.value })}
					/>
					<div class="flex gap-1 shrink-0">
						{#each [{ value: 'ft', label: m.unit_ft() }, { value: 'm', label: m.unit_m() }] as opt}
							<button
								type="button"
								class="chip text-xs {atmosphere.altitudeUnit === opt.value ? 'preset-filled-primary-500' : 'preset-tonal-surface'}"
								onclick={() => onchange({ altitudeUnit: opt.value })}
							>{opt.label}</button>
						{/each}
					</div>
				</div>
			</div>

			<!-- Pressure -->
			<div class="space-y-1.5">
				<span class="text-sm font-medium">{m.ballistic_pressure()}</span>
				<div class="input !flex !items-center gap-2">
					<input
						class="flex-1 min-w-0 bg-transparent border-none outline-none shadow-none p-0 text-sm"
						type="text"
						inputmode="decimal"
						value={atmosphere.pressure}
						oninput={(e) => onchange({ pressure: e.target.value })}
					/>
					<div class="flex gap-1 shrink-0">
						{#each [{ value: 'inhg', label: m.unit_inhg() }, { value: 'hpa', label: m.unit_hpa() }] as opt}
							<button
								type="button"
								class="chip text-xs {atmosphere.pressureUnit === opt.value ? 'preset-filled-primary-500' : 'preset-tonal-surface'}"
								onclick={() => onchange({ pressureUnit: opt.value })}
							>{opt.label}</button>
						{/each}
					</div>
				</div>
			</div>

			<!-- Temperature -->
			<div class="space-y-1.5">
				<span class="text-sm font-medium">{m.ballistic_atmo_temp()}</span>
				<div class="input !flex !items-center gap-2">
					<input
						class="flex-1 min-w-0 bg-transparent border-none outline-none shadow-none p-0 text-sm"
						type="text"
						inputmode="decimal"
						value={atmosphere.temperature}
						oninput={(e) => onchange({ temperature: e.target.value })}
					/>
					<div class="flex gap-1 shrink-0">
						{#each [{ value: 'f', label: m.unit_f() }, { value: 'c', label: m.unit_c() }] as opt}
							<button
								type="button"
								class="chip text-xs {atmosphere.temperatureUnit === opt.value ? 'preset-filled-primary-500' : 'preset-tonal-surface'}"
								onclick={() => onchange({ temperatureUnit: opt.value })}
							>{opt.label}</button>
						{/each}
					</div>
				</div>
			</div>

			<!-- Humidity -->
			<div class="space-y-1.5">
				<span class="text-sm font-medium">{m.ballistic_humidity()}</span>
				<div class="input !flex !items-center gap-2">
					<input
						class="flex-1 min-w-0 bg-transparent border-none outline-none shadow-none p-0 text-sm"
						type="text"
						inputmode="decimal"
						value={atmosphere.humidity}
						oninput={(e) => onchange({ humidity: e.target.value })}
					/>
					<span class="text-sm text-surface-500-400 shrink-0">%</span>
				</div>
			</div>
		{:else}
			<!-- ICAO standard values -->
			<div class="text-sm text-surface-500-400 space-y-0.5">
				<p>0 {m.unit_ft()}, 29.92 {m.unit_inhg()}, 59 {m.unit_f()}, 0% {m.ballistic_humidity()}</p>
				<p>0 {m.unit_m()}, 1013.25 {m.unit_hpa()}, 15 {m.unit_c()}, 0% {m.ballistic_humidity()}</p>
			</div>
		{/if}
	</div>
</div>
