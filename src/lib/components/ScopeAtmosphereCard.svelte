<script>
	import { Sun, Cloud, CloudRain, CloudSnow, MapPin, Loader, ExternalLink } from '@lucide/svelte';
	import { m } from '#lib/paraglide/messages.js';
	import { readDecimal } from '#lib/utils/decimal.js';
	import { formatLimit, formatNumber } from '#lib/utils/format.js';
	import { fieldStepSpec } from '#lib/utils/fieldStep.js';
	import {
		HUMIDITY_LIMITS,
		altitudeLimits,
		pressureLimits,
		temperatureLimits
	} from '#lib/utils/inputLimits.js';
	import { altitudeTooLowMessage } from '#lib/components/altitudeMessage.js';
	import ChipGroup from '#lib/components/ChipGroup.svelte';
	import StepperField from '#lib/components/StepperField.svelte';

	/**
	 * Atmosphere card of the Scope View (#148) and the Ballistic page (#151), with three modes (owner
	 * decisions). The Trajectory Validation page keeps AtmosphereCard.
	 *
	 * - isa: altitude only; a line shows the standard pressure and temperature used (`used`).
	 * - estimate: altitude, weather, temperature (± 1 and quick picks); a line shows what is used.
	 * - accurate: station pressure, temperature, humidity (#172: no QNH / Station choice, no altitude;
	 *   the page hands the engine a fixed altitude, see scopeAtmosphereParams).
	 *
	 * The card computes nothing: the page gives what is used, already formatted with units.
 *
 * Every number box has − and + (#166, StepperField): altitude 10 m or ft, pressure 1 hPa or
 * 0.01 inHg, temperature 1°, humidity 5 %, within the limits the calculators check
 * (utils/fieldStep.js). A step sends the new text through onchange, as typing does.
	 *
	 * @prop {object} atmosphere
	 * @prop {'isa'|'estimate'|'accurate'} atmosphere.mode
	 * @prop {string} atmosphere.altitude          @prop {'ft'|'m'} atmosphere.altitudeUnit
	 * @prop {string} atmosphere.pressure          @prop {'inhg'|'hpa'} atmosphere.pressureUnit
	 * @prop {string} atmosphere.temperature       @prop {'f'|'c'} atmosphere.temperatureUnit
	 * @prop {string} atmosphere.humidity
	 * @prop {'sunny'|'cloudy'|'rain'|'snow'|null} atmosphere.weather
	 * @prop {{ pressure: string, temperature: string, humidity: string } | null} used
	 *   What the calculation uses in isa and estimate modes, formatted with units ('960 hPa', '12 °C',
	 *   '65 %'). Null shows dashes (no usable altitude, or not computed yet).
	 * @prop {boolean} altitudeTooLow - The engine stopped at its minimum altitude (#125); shown under
	 *   the altitude box of isa and estimate. Accurate has no altitude box, and its fixed engine
	 *   altitude never reaches that stop (#172).
	 * @prop {boolean} noAirDensity   - Values within limits that give no air density (#107), accurate mode.
	 * @prop {(patch: object) => void} onchange - Called with the changed fields, e.g. { mode: 'estimate' },
	 *   { weather: 'rain' }, { temperature: '9' }.
	 *
	 * Current weather (#152), accurate mode only. The page owns the request; the card only shows it.
	 * @prop {boolean} weatherAvailable - Show the button (web and mobile; false on the desktop build).
	 * @prop {{ state: 'idle'|'loading'|'done'|'error',
	 *          error?: 'denied'|'unavailable'|'network'|'invalid',
	 *          time?: string, model?: 'meteoswiss_icon_ch1'|'best_match' }} weatherStatus
	 *   time: when the fields were filled, already formatted for the locale ('14:05'), for state 'done'.
	 *   model: which model filled them (#154); 'meteoswiss_icon_ch1' also credits MeteoSwiss.
	 *   On 'error' the page leaves the fields unchanged.
	 * @prop {() => void} [onweather] - Called on a tap of the button. The page fills the fields through
	 *   its own setAtmosphere, the same way as onchange.
	 */
	let {
		atmosphere,
		used = null,
		altitudeTooLow = false,
		noAirDensity = false,
		onchange,
		weatherAvailable = false,
		weatherStatus = { state: 'idle' },
		onweather
	} = $props();

	let weatherLoading = $derived(weatherStatus?.state === 'loading');

	/** The error line of a failed weather request, or ''. Unknown codes read as 'invalid'. */
	let weatherError = $derived.by(() => {
		if (weatherStatus?.state !== 'error') return '';
		switch (weatherStatus.error) {
			case 'denied':
				return m.scope_view_current_weather_error_denied();
			case 'unavailable':
				return m.scope_view_current_weather_error_unavailable();
			case 'network':
				return m.scope_view_current_weather_error_network();
			default:
				return m.scope_view_current_weather_error_invalid();
		}
	});

	const uid = $props.id();

	/**
	 * The range message of a box whose value the calculators reject (isUsableAtmosphere), or ''.
	 * The box is read as the calculators read it, with a comma as a decimal point. As in AtmosphereCard.
	 */
	function rangeError(value, limits, unit) {
		const number = readDecimal(value);
		if (number >= limits.min && number <= limits.max) return '';
		return m.validation_range({ min: formatLimit(limits.min), max: formatLimit(limits.max), unit });
	}

	let altitudeUnitLabel = $derived(atmosphere.altitudeUnit === 'm' ? m.unit_m() : m.unit_ft());
	let temperatureUnitLabel = $derived(atmosphere.temperatureUnit === 'c' ? m.unit_c() : m.unit_f());
	let pressureUnitLabel = $derived(atmosphere.pressureUnit === 'hpa' ? m.unit_hpa() : m.unit_inhg());

	let altitudeError = $derived(
		rangeError(atmosphere.altitude, altitudeLimits(atmosphere.altitudeUnit), altitudeUnitLabel)
	);
	let pressureError = $derived(
		rangeError(
			atmosphere.pressure,
			pressureLimits(atmosphere.pressureUnit),
			pressureUnitLabel
		)
	);
	let temperatureError = $derived(
		rangeError(atmosphere.temperature, temperatureLimits(atmosphere.temperatureUnit), temperatureUnitLabel)
	);
	let humidityError = $derived(rangeError(atmosphere.humidity, HUMIDITY_LIMITS, '%'));

	const MODES = [
		{ value: 'isa', label: m.scope_view_atmo_mode_isa() },
		{ value: 'estimate', label: m.scope_view_atmo_mode_estimate() },
		{ value: 'accurate', label: m.scope_view_atmo_mode_accurate() }
	];

	const WEATHER = [
		{ value: 'sunny', label: () => m.scope_view_weather_sunny(), icon: Sun },
		{ value: 'cloudy', label: () => m.scope_view_weather_cloudy(), icon: Cloud },
		{ value: 'rain', label: () => m.scope_view_weather_rain(), icon: CloudRain },
		{ value: 'snow', label: () => m.scope_view_weather_snow(), icon: CloudSnow }
	];

	// Quick picks: round values in the unit shown (−10 to 30 °C, and the same temperatures in °F).
	let quickTemps = $derived(atmosphere.temperatureUnit === 'c' ? [-10, 0, 10, 20, 30] : [14, 32, 50, 68, 86]);

	// − / + steps (#166), in the unit shown: utils/fieldStep.js.
	let altitudeSpec = $derived(fieldStepSpec('altitude', atmosphere.altitudeUnit));
	let pressureSpec = $derived(fieldStepSpec('pressure', atmosphere.pressureUnit));
	let temperatureSpec = $derived(fieldStepSpec('temperature', atmosphere.temperatureUnit));
	const HUMIDITY_SPEC = fieldStepSpec('humidity');

	const stepText = (spec, unit) => `${formatNumber(spec.step)} ${unit}`;
	let altitudeStep = $derived(stepText(altitudeSpec, altitudeUnitLabel));
	let pressureStep = $derived(stepText(pressureSpec, pressureUnitLabel));
	const humidityStep = stepText(HUMIDITY_SPEC, '%');

	const signed = (n) => (n < 0 ? `−${Math.abs(n)}` : String(n));

	const ALTITUDE_UNITS = [
		{ value: 'ft', label: m.unit_ft() },
		{ value: 'm', label: m.unit_m() }
	];
	const TEMPERATURE_UNITS = [
		{ value: 'f', label: m.unit_f() },
		{ value: 'c', label: m.unit_c() }
	];
</script>

<!-- Altitude with − / +, full width with the unit chips inside the box (isa and estimate, #167, #172). -->
{#snippet altitudeField()}
	{@const message = altitudeError || (altitudeTooLow ? altitudeTooLowMessage(atmosphere.altitudeUnit) : '')}
	<StepperField
		id="{uid}-alt"
		label={m.scope_view_altitude()}
		value={atmosphere.altitude}
		onchange={(text) => onchange({ altitude: text })}
		spec={altitudeSpec}
		decreaseLabel={m.scope_view_step_altitude_down({ step: altitudeStep })}
		increaseLabel={m.scope_view_step_altitude_up({ step: altitudeStep })}
		units={ALTITUDE_UNITS}
		unit={atmosphere.altitudeUnit}
		unitsLabel={m.scope_view_altitude_unit()}
		onunitchange={(value) => onchange({ altitudeUnit: value })}
		{message}
		messageType={altitudeError ? 'error' : 'warning'}
		placeholder=""
	/>
{/snippet}

<section class="@container card preset-filled-surface-100-900 border border-surface-200-800 px-3.5 py-3 space-y-2.5">
	<div class="flex items-center justify-between gap-2 flex-wrap">
		<h2 class="text-sm font-semibold">{m.scope_view_atmosphere()}</h2>
		<ChipGroup
			variant="segmented"
			label={m.scope_view_atmo_mode()}
			options={MODES}
			value={atmosphere.mode}
			onselect={(mode) => onchange({ mode })}
		/>
	</div>

	{#if atmosphere.mode === 'isa'}
		{@render altitudeField()}
		<p class="rounded-base preset-tonal-primary px-2.5 py-2 text-xs leading-relaxed" aria-live="polite">
			{m.scope_view_atmo_isa_used()}
			<strong>{used?.pressure ?? '—'}</strong> · <strong>{used?.temperature ?? '—'}</strong>.
			{m.scope_view_atmo_isa_note()}
		</p>
	{:else if atmosphere.mode === 'estimate'}
		{@render altitudeField()}

		<!-- Weather -->
		<div class="space-y-1">
			<span id="{uid}-weather" class="text-xs text-surface-600-400">{m.scope_view_weather()}</span>
			<div class="grid grid-cols-4 gap-1.5" role="group" aria-labelledby="{uid}-weather">
				{#each WEATHER as w (w.value)}
					{@const on = atmosphere.weather === w.value}
					{@const Icon = w.icon}
					<button
						type="button"
						class="h-14 rounded-base flex flex-col items-center justify-center gap-0.5 text-xs focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary-500 {on
							? 'preset-filled-primary-500 font-semibold'
							: 'border border-surface-300-700 hover:preset-tonal-surface'}"
						aria-pressed={on}
						onclick={() => onchange({ weather: w.value })}
					>
						<Icon class="size-5" aria-hidden="true" />
						{w.label()}
					</button>
				{/each}
			</div>
		</div>

		<!-- Temperature: − / + 1° with the unit chips inside the box, its own line, quick picks under
			it (#167) -->
		<div class="space-y-1">
			<div class="flex flex-col gap-1.5">
				<StepperField
					id="{uid}-temp"
					label={m.scope_view_atmo_temp()}
					value={atmosphere.temperature}
					onchange={(text) => onchange({ temperature: text })}
					spec={temperatureSpec}
					decreaseLabel={m.scope_view_temperature_colder()}
					increaseLabel={m.scope_view_temperature_warmer()}
					units={TEMPERATURE_UNITS}
					unit={atmosphere.temperatureUnit}
					unitsLabel={m.scope_view_temperature_unit()}
					onunitchange={(value) => onchange({ temperatureUnit: value })}
					placeholder=""
					invalid={!!temperatureError}
					describedby={temperatureError ? `${uid}-temp-msg` : ''}
				/>
				<div class="flex w-full gap-1" role="group" aria-label={m.scope_view_temperature_quick()}>
					{#each quickTemps as t (t)}
						<button
							type="button"
							class="touch-hit chip flex-1 min-w-0 px-0 {readDecimal(atmosphere.temperature) === t
								? 'preset-filled-primary-500'
								: 'preset-tonal-surface'} focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary-500"
							aria-pressed={readDecimal(atmosphere.temperature) === t}
							aria-label="{signed(t)} {temperatureUnitLabel}"
							onclick={() => onchange({ temperature: String(t) })}
						>
							{signed(t)}°
						</button>
					{/each}
				</div>
			</div>
			{#if temperatureError}
				<p id="{uid}-temp-msg" class="text-xs text-error-500" role="alert">{temperatureError}</p>
			{/if}
		</div>

		<p class="rounded-base preset-tonal-primary px-2.5 py-2 text-xs leading-relaxed" aria-live="polite">
			{m.scope_view_atmo_used()}
			<strong>{used?.pressure ?? '—'}</strong> {m.scope_view_atmo_used_pressure()} ·
			<strong>{used?.humidity ?? '—'}</strong> {m.scope_view_atmo_used_humidity()} ·
			<strong>{used?.temperature ?? '—'}</strong>
		</p>
	{:else}
		<!-- Accurate: station pressure, temperature and humidity, each on its own full-width line with
			its unit chips inside the box (#167). No altitude: with station pressure it changes no
			result (#172). -->
		<StepperField
			id="{uid}-press"
			label={m.scope_view_pressure_label()}
			value={atmosphere.pressure}
			onchange={(text) => onchange({ pressure: text })}
			spec={pressureSpec}
			decreaseLabel={m.scope_view_step_pressure_down({ step: pressureStep })}
			increaseLabel={m.scope_view_step_pressure_up({ step: pressureStep })}
			units={[
				{ value: 'inhg', label: m.unit_inhg() },
				{ value: 'hpa', label: m.unit_hpa() }
			]}
			unit={atmosphere.pressureUnit}
			unitsLabel={m.scope_view_pressure_unit()}
			onunitchange={(value) => onchange({ pressureUnit: value })}
			placeholder=""
			invalid={!!pressureError || noAirDensity}
			message={pressureError || (noAirDensity ? m.ballistic_air_too_thin() : m.scope_view_pressure_station_hint())}
			messageType={pressureError || noAirDensity ? 'error' : 'hint'}
		/>

		<div class="flex flex-col gap-2.5">
			<StepperField
				id="{uid}-temp"
				label={m.scope_view_atmo_temp()}
				value={atmosphere.temperature}
				onchange={(text) => onchange({ temperature: text })}
				spec={temperatureSpec}
				decreaseLabel={m.scope_view_temperature_colder()}
				increaseLabel={m.scope_view_temperature_warmer()}
				units={TEMPERATURE_UNITS}
				unit={atmosphere.temperatureUnit}
				unitsLabel={m.scope_view_temperature_unit()}
				onunitchange={(value) => onchange({ temperatureUnit: value })}
				placeholder=""
				message={temperatureError}
				messageType="error"
			/>
			<StepperField
				id="{uid}-hum"
				label={m.scope_view_humidity()}
				value={atmosphere.humidity}
				onchange={(text) => onchange({ humidity: text })}
				spec={HUMIDITY_SPEC}
				decreaseLabel={m.scope_view_step_humidity_down({ step: humidityStep })}
				increaseLabel={m.scope_view_step_humidity_up({ step: humidityStep })}
				suffix="%"
				placeholder=""
				message={humidityError}
				messageType="error"
			/>
		</div>

		{#if weatherAvailable && onweather}
			<!-- Current weather (#152): fills the three fields once, the pressure converted to station
				pressure (#172); the user can edit them after. -->
			<div class="space-y-1.5 pt-0.5">
				<button
					type="button"
					class="btn w-full h-11 rounded-base border border-surface-300-700 bg-transparent hover:preset-tonal-surface text-[13px] font-semibold gap-2 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary-500 disabled:opacity-60"
					disabled={weatherLoading}
					aria-busy={weatherLoading}
					aria-describedby="{uid}-wx-note"
					onclick={() => onweather()}
				>
					{#if weatherLoading}
						<Loader class="size-4 motion-safe:animate-spin" aria-hidden="true" />
						{m.scope_view_current_weather_loading()}
					{:else}
						<MapPin class="size-4" aria-hidden="true" />
						{m.scope_view_current_weather_button()}
					{/if}
				</button>

				{#if weatherError}
					<p class="text-xs text-error-500" role="alert">{weatherError}</p>
				{/if}

				<!-- Present from the start so that screen readers announce the change. -->
				<div aria-live="polite">
					{#if weatherStatus?.state === 'done'}
						<p class="rounded-base preset-tonal-primary px-2.5 py-2 text-xs leading-relaxed">
							{m.scope_view_current_weather_done({ time: weatherStatus.time ?? '' })}
							<!-- After an ICON-CH1 fill, MeteoSwiss is credited too: its open data needs a source credit (#154). -->
							<span class="block mt-0.5 text-surface-600-400">
								{m.scope_view_current_weather_attribution()}
								<a
									href="https://open-meteo.com/"
									target="_blank"
									rel="noopener noreferrer"
									class="inline-flex items-center gap-0.5 underline underline-offset-2 hover:text-primary-700-300 rounded-sm focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-primary-500"
								>
									Open-Meteo.com<ExternalLink class="size-3" aria-hidden="true" />
									<span class="sr-only">{m.scope_view_current_weather_new_window()}</span>
								</a>{#if weatherStatus.model === 'meteoswiss_icon_ch1'}, <a
										href="https://www.meteoswiss.admin.ch/"
										target="_blank"
										rel="noopener noreferrer"
										class="inline-flex items-center gap-0.5 underline underline-offset-2 hover:text-primary-700-300 rounded-sm focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-primary-500"
									>
										{m.scope_view_current_weather_model_icon_ch1()}<ExternalLink class="size-3" aria-hidden="true" />
										<span class="sr-only">{m.scope_view_current_weather_new_window()}</span>
									</a>
								{/if}
							</span>
						</p>
					{/if}
				</div>

				<p id="{uid}-wx-note" class="text-[11px] leading-snug text-surface-600-400">
					{m.scope_view_current_weather_note()}
				</p>
			</div>
		{/if}
	{/if}
</section>
