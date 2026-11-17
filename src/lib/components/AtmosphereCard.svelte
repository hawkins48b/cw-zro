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
	import SwitchRow from '#lib/components/SwitchRow.svelte';

	/**
	 * altitudeTooLow: the page's result is missing because the engine ended the flight at its
	 * minimum altitude (#125, flightStop.js). Shown under the altitude box when the box itself is valid.
	 */
	/**
	 * Trajectory Validation, step 3 (#166): title, an ISA switch with its hint, then the four
	 * fields (two columns from sm) and the QNH hint once under them.
	 *
	 * @prop {string} [title]   - Card heading (already translated).
	 * @prop {string} [isaHint] - Shown under the switch while ISA is on.
	 */
	let { atmosphere, onchange, altitudeTooLow = false, title = '', isaHint = '' } = $props();
	const uid = $props.id();

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

<section
	class="card preset-filled-surface-100-900 border border-surface-200-800 p-4 space-y-3"
	aria-labelledby={title ? `${uid}-title` : undefined}
>
	{#if title}
		<h2 id="{uid}-title" class="text-[15px] font-semibold">{title}</h2>
	{/if}
	<SwitchRow
		bind:checked={() => atmosphere.useISA, (v) => onchange({ useISA: v })}
		title={m.ballistic_use_isa()}
		controls="{uid}-fields"
	/>
	<div id="{uid}-fields">
		{#if !atmosphere.useISA}
		<div class="grid grid-cols-1 sm:grid-cols-2 gap-3">
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
								aria-pressed={atmosphere.altitudeUnit === opt.value}
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
								aria-pressed={atmosphere.temperatureUnit === opt.value}
								onclick={() => onchange({ temperatureUnit: opt.value })}
							>{opt.label}</button>
						{/each}
					</div>
				</div>
				{#if temperatureError}
					<p class="text-xs text-error-500">{temperatureError}</p>
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
								aria-pressed={atmosphere.pressureUnit === opt.value}
								onclick={() => onchange({ pressureUnit: opt.value })}
							>{opt.label}</button>
						{/each}
					</div>
				</div>
				{#if pressureError}
					<p class="text-xs text-error-500">{pressureError}</p>
				{:else if noAirDensity}
					<p class="text-xs text-error-500" role="alert">{m.ballistic_air_too_thin()}</p>
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
		</div>
		<p class="mt-3 text-xs text-surface-600-400">{m.ballistic_pressure_hint()}</p>
		{:else}
			{#if isaHint}
				<p class="text-xs leading-snug text-surface-600-400">{isaHint}</p>
			{/if}
			<!-- ICAO standard values -->
			<div class="mt-2 text-xs text-surface-600-400 space-y-0.5">
				<p>0 {m.unit_ft()}, 29.92 {m.unit_inhg()}, 59 {m.unit_f()}, 0% {m.ballistic_humidity()}</p>
				<p>0 {m.unit_m()}, 1013.25 {m.unit_hpa()}, 15 {m.unit_c()}, 0% {m.ballistic_humidity()}</p>
			</div>
		{/if}
	</div>
</section>
