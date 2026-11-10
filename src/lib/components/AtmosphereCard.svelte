<script>
	import { m } from '#lib/paraglide/messages.js';
	import { readDecimal } from '#lib/utils/decimal.js';
	import { formatLimit } from '#lib/utils/format.js';
	import {
		HUMIDITY_LIMITS,
		altitudeLimits,
		pressureLimits,
		temperatureLimits
	} from '#lib/utils/inputLimits.js';

	import { altitudeTooLowMessage } from '#lib/components/altitudeMessage.js';
	import { hasNoAirDensity } from '#lib/utils/ballisticCalculator.js';

	/**
	 * altitudeTooLow: the page's result is missing because the engine ended the flight at its
	 * minimum altitude (#125, flightStop.js). Shown under the altitude box when the box itself is valid.
	 */
	let { atmosphere, onchange, altitudeTooLow = false } = $props();

	/**
	 * The range message of a box whose value the calculators reject (isUsableAtmosphere), or ''.
	 * The box is read as the calculators read it, with a comma as a decimal point.
	 */
	function rangeError(value, limits, unit) {
		const number = readDecimal(value);
		if (number >= limits.min && number <= limits.max) return '';
		return m.validation_range({ min: formatLimit(limits.min), max: formatLimit(limits.max), unit });
	}

	let altitudeError = $derived(
		rangeError(
			atmosphere.altitude,
			altitudeLimits(atmosphere.altitudeUnit),
			atmosphere.altitudeUnit === 'm' ? m.unit_m() : m.unit_ft()
		)
	);
	let pressureError = $derived(
		rangeError(
			atmosphere.pressure,
			pressureLimits(atmosphere.pressureUnit),
			atmosphere.pressureUnit === 'hpa' ? m.unit_hpa() : m.unit_inhg()
		)
	);
	let temperatureError = $derived(
		rangeError(
			atmosphere.temperature,
			temperatureLimits(atmosphere.temperatureUnit),
			atmosphere.temperatureUnit === 'c' ? m.unit_c() : m.unit_f()
		)
	);
	let humidityError = $derived(rangeError(atmosphere.humidity, HUMIDITY_LIMITS, '%'));
	// Values within their limits whose air density is not above 0 give no result (#107).
	let noAirDensity = $derived(!atmosphere.useISA && hasNoAirDensity(atmosphere));
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
				{#if altitudeError}
					<p class="text-xs text-error-500">{altitudeError}</p>
				{:else if altitudeTooLow}
					<p class="text-xs text-warning-800-200" role="alert">{altitudeTooLowMessage(atmosphere.altitudeUnit)}</p>
				{/if}
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
				{#if pressureError}
					<p class="text-xs text-error-500">{pressureError}</p>
				{:else if noAirDensity}
					<p class="text-xs text-error-500" role="alert">{m.ballistic_air_too_thin()}</p>
				{:else}
					<p class="text-xs text-surface-600-400">{m.ballistic_pressure_hint()}</p>
				{/if}
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
				{#if temperatureError}
					<p class="text-xs text-error-500">{temperatureError}</p>
				{/if}
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
					<span class="text-sm text-surface-600-400 shrink-0">%</span>
				</div>
				{#if humidityError}
					<p class="text-xs text-error-500">{humidityError}</p>
				{/if}
			</div>
		{:else}
			<!-- ICAO standard values -->
			<div class="text-sm text-surface-600-400 space-y-0.5">
				<p>0 {m.unit_ft()}, 29.92 {m.unit_inhg()}, 59 {m.unit_f()}, 0% {m.ballistic_humidity()}</p>
				<p>0 {m.unit_m()}, 1013.25 {m.unit_hpa()}, 15 {m.unit_c()}, 0% {m.ballistic_humidity()}</p>
			</div>
		{/if}
	</div>
</div>
