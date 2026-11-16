/**
 * The atmosphere modes of the Scope View (#148, owner decision of 2026-11-16).
 *
 * - `isa`: the standard atmosphere at the entered altitude. At altitude 0 this is `null`, the
 *   standard atmosphere calculateShotPoint has always used, so no saved result changes: before
 *   #148 the standard atmosphere ignored the altitude, and choosing it reset the altitude to 0.
 *   At any other altitude the standard pressure and temperature of that altitude are passed as a
 *   custom atmosphere (1013.25 hPa at sea level, scaled to the site by stationPressure; ISA
 *   temperature; 0 % humidity), which gives the same Atmo as `Atmo.icao` at that altitude.
 * - `estimate`: the standard pressure at the entered altitude (passed as a sea-level pressure of
 *   1013.25 hPa), the entered temperature, and a humidity from the weather: Sunny 40 %,
 *   Cloudy 65 %, Rain 90 %, Snow 80 %.
 * - `accurate`: the entered boxes. `pressureRef` `qnh` converts the entered pressure to the site
 *   with stationPressure, as before #148; `station` uses it as entered.
 *
 * Every custom atmosphere goes through calculateShotPoint's own guards (isUsableAtmosphere on the
 * values given, the minimum altitude, hasPositiveDensity on the atmosphere actually built). The
 * sea-level pressure of isa and estimate is passed as 1013.25 hPa, inside its limits, so their
 * pressure limits never reject a usable altitude; the entered altitude and temperature are checked
 * as in accurate.
 */
import { Atmo, UNew, Unit } from 'js-ballistics';
import { readDecimal } from './decimal.js';
import { altitudeLimits, temperatureLimits } from './inputLimits.js';
import { STANDARD_SEA_LEVEL_HPA, stationPressureRatio } from './stationPressure.js';

/** @typedef {'isa'|'estimate'|'accurate'} AtmosphereMode */
/** @typedef {'sunny'|'cloudy'|'rain'|'snow'} Weather */
/** @typedef {'qnh'|'station'} PressureRef */

export const ATMOSPHERE_MODES = /** @type {const} */ (['isa', 'estimate', 'accurate']);
export const PRESSURE_REFS = /** @type {const} */ (['qnh', 'station']);

/** Relative humidity in % of each weather of the estimate mode (owner decision on #148). */
export const WEATHER_HUMIDITY = Object.freeze({ sunny: 40, cloudy: 65, rain: 90, snow: 80 });

export const DEFAULT_WEATHER = 'cloudy';
export const DEFAULT_PRESSURE_REF = 'qnh';

/** Whether a value is one of the atmosphere modes. */
export const isAtmosphereMode = (value) => ATMOSPHERE_MODES.includes(/** @type {any} */ (value));

/** Whether a value is one of the weathers. Own keys only: `toString` is no weather. */
export const isWeather = (value) =>
	typeof value === 'string' && Object.prototype.hasOwnProperty.call(WEATHER_HUMIDITY, value);

/** Whether a value is one of the pressure references. */
export const isPressureRef = (value) => PRESSURE_REFS.includes(/** @type {any} */ (value));

/**
 * The entered altitude as a Distance, or null when it is out of its limits (or not a number).
 * @param {{ altitude: unknown, altitudeUnit: string }} atmosphere
 */
function usableAltitude(atmosphere) {
	const value = readDecimal(atmosphere.altitude);
	const limits = altitudeLimits(atmosphere.altitudeUnit);
	if (!(value >= limits.min && value <= limits.max)) return null;
	return atmosphere.altitudeUnit === 'm' ? UNew.Meter(value) : UNew.Foot(value);
}

/**
 * The atmosphere to hand to calculateShotPoint for the stored Scope View atmosphere (read by
 * storedScopeAtmosphere): `null` for the standard atmosphere at sea level, otherwise a custom
 * atmosphere in the shape calculateShotPoint reads. A value out of its limits is passed as it is,
 * so the calculator's guards reject it and there is no result.
 *
 * @param {{ mode: AtmosphereMode, weather: Weather, pressureRef: PressureRef, altitude: string|number,
 *   altitudeUnit: 'ft'|'m', pressure: string|number, pressureUnit: 'inhg'|'hpa',
 *   temperature: string|number, temperatureUnit: 'f'|'c', humidity: string|number }} atmosphere
 * @returns {object|null}
 */
export function scopeAtmosphereParams(atmosphere) {
	const { altitude, altitudeUnit } = atmosphere;
	if (atmosphere.mode === 'accurate') {
		return {
			altitude,
			altitudeUnit,
			pressure: atmosphere.pressure,
			pressureUnit: atmosphere.pressureUnit,
			pressureRef: atmosphere.pressureRef === 'station' ? 'station' : 'qnh',
			temperature: atmosphere.temperature,
			temperatureUnit: atmosphere.temperatureUnit,
			humidity: atmosphere.humidity
		};
	}
	// Standard sea-level pressure, scaled to the site altitude by the calculator (stationPressure).
	const standardPressure = { pressure: STANDARD_SEA_LEVEL_HPA, pressureUnit: 'hpa', pressureRef: 'qnh' };
	if (atmosphere.mode === 'estimate') {
		return {
			altitude,
			altitudeUnit,
			...standardPressure,
			temperature: atmosphere.temperature,
			temperatureUnit: atmosphere.temperatureUnit,
			humidity: WEATHER_HUMIDITY[isWeather(atmosphere.weather) ? atmosphere.weather : DEFAULT_WEATHER]
		};
	}
	// isa. Altitude 0 is the standard atmosphere calculateShotPoint has always used.
	if (readDecimal(altitude) === 0) return null;
	const site = usableAltitude(atmosphere);
	// Out of its limits: passed as entered, so that isUsableAtmosphere rejects it.
	const temperature = site ? Atmo.standardTemperature(site).In(Unit.Celsius) : 15;
	return { altitude, altitudeUnit, ...standardPressure, temperature, temperatureUnit: 'c', humidity: 0 };
}

/**
 * What the isa and estimate modes use, in the units of the stored boxes (pressure unit and
 * temperature unit), for the line under the card. The pressure is the pressure at the site.
 * Null in accurate mode (the boxes show it), and when the altitude, or in estimate mode the
 * temperature, is out of its limits (the card shows dashes and the box its message).
 *
 * @param {Parameters<typeof scopeAtmosphereParams>[0]} atmosphere
 * @returns {{ pressure: number, pressureUnit: 'inhg'|'hpa', temperature: number,
 *   temperatureUnit: 'f'|'c', humidity: number } | null}
 */
export function usedScopeAtmosphere(atmosphere) {
	if (atmosphere.mode !== 'isa' && atmosphere.mode !== 'estimate') return null;
	const site = usableAltitude(atmosphere);
	if (!site) return null;
	const pressureUnit = atmosphere.pressureUnit === 'hpa' ? 'hpa' : 'inhg';
	const temperatureUnit = atmosphere.temperatureUnit === 'c' ? 'c' : 'f';
	const hPa = STANDARD_SEA_LEVEL_HPA * stationPressureRatio(site);
	const pressure = pressureUnit === 'hpa' ? hPa : UNew.hPa(hPa).In(Unit.InHg);
	if (atmosphere.mode === 'isa') {
		const standard = Atmo.standardTemperature(site);
		return {
			pressure,
			pressureUnit,
			temperature: standard.In(temperatureUnit === 'c' ? Unit.Celsius : Unit.Fahrenheit),
			temperatureUnit,
			humidity: 0
		};
	}
	const temperature = readDecimal(atmosphere.temperature);
	const limits = temperatureLimits(temperatureUnit);
	if (!(temperature >= limits.min && temperature <= limits.max)) return null;
	return {
		pressure,
		pressureUnit,
		temperature,
		temperatureUnit,
		humidity: WEATHER_HUMIDITY[isWeather(atmosphere.weather) ? atmosphere.weather : DEFAULT_WEATHER]
	};
}

/**
 * The used values as text for the card: hPa without decimals, inHg with two, the temperature with
 * at most one decimal, the humidity in whole percent. Number formatting and unit labels are given
 * by the caller (the page passes formatNumber and the messages), so this stays a plain function.
 *
 * @param {ReturnType<typeof usedScopeAtmosphere>} used
 * @param {{ number: (value: number, options: Intl.NumberFormatOptions) => string,
 *   units: { hpa: string, inhg: string, c: string, f: string } }} format
 * @returns {{ pressure: string, temperature: string, humidity: string } | null}
 */
export function formatUsedAtmosphere(used, { number, units }) {
	if (!used) return null;
	const digits = used.pressureUnit === 'hpa' ? 0 : 2;
	// Rounded first, so that -0.04 °C shows as 0, not -0.
	const temperature = Math.round(used.temperature * 10) / 10 || 0;
	return {
		pressure: `${number(used.pressure, { minimumFractionDigits: digits, maximumFractionDigits: digits })} ${units[used.pressureUnit]}`,
		temperature: `${number(temperature, { maximumFractionDigits: 1 })} ${units[used.temperatureUnit]}`,
		humidity: `${number(used.humidity, { maximumFractionDigits: 0 })} %`
	};
}
