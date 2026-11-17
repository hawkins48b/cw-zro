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
 * - `accurate`: the entered pressure, temperature and humidity. Since #172 (owner decision of
 *   2026-11-17) the pressure is always station pressure, as a Kestrel-type meter reads it or the
 *   weather fill gives it, and is used as entered; the mode has no altitude box. With station
 *   pressure the site altitude changes no result except where the engine's minimum altitude ends the
 *   flight, so the engine gets ACCURATE_ENGINE_ALTITUDE, never the stored altitude. A saved Accurate
 *   state with QNH (`pressureRef` `qnh`, before #172) is converted to station pressure when it is
 *   read (accurateStationAtmosphere).
 *
 * Every custom atmosphere goes through calculateShotPoint's own guards (isUsableAtmosphere on the
 * values given, the minimum altitude, hasPositiveDensity on the atmosphere actually built). The
 * sea-level pressure of isa and estimate is passed as 1013.25 hPa, inside its limits, so their
 * pressure limits never reject a usable altitude; the entered altitude and temperature are checked
 * as in accurate.
 */
import { Atmo, UNew, Unit } from 'js-ballistics';
import { readDecimal } from './decimal.js';
import { altitudeLimits, pressureLimits, temperatureLimits } from './inputLimits.js';
import { STANDARD_SEA_LEVEL_HPA, stationPressure, stationPressureRatio } from './stationPressure.js';

/** @typedef {'isa'|'estimate'|'accurate'} AtmosphereMode */
/** @typedef {'sunny'|'cloudy'|'rain'|'snow'} Weather */
/** @typedef {'qnh'|'station'} PressureRef */

export const ATMOSPHERE_MODES = /** @type {const} */ (['isa', 'estimate', 'accurate']);
export const PRESSURE_REFS = /** @type {const} */ (['qnh', 'station']);

/** Relative humidity in % of each weather of the estimate mode (owner decision on #148). */
export const WEATHER_HUMIDITY = Object.freeze({ sunny: 40, cloudy: 65, rain: 90, snow: 80 });

export const DEFAULT_WEATHER = 'cloudy';

/**
 * The pressure reference of a stored state that has none, or a damaged one: QNH, which is what the
 * pages computed before #148 (Scope View) and #151 (Ballistic). Such a state in Accurate mode is
 * converted to station pressure when it is read (#172).
 */
export const DEFAULT_PRESSURE_REF = 'qnh';

/**
 * The site altitude handed to the engine in Accurate mode (#172), in metres. With station pressure
 * the altitude changes no result (measured on the test loads from -1000 to 10000 m, 100 to 3000 m:
 * at most 0.0008 cm of drop), except that the engine ends every flight whose bullet goes below
 * ENGINE_CONFIG.minimumAltitude (-1410.748 ft, about -430 m). From about 4142 m up, that floor lies
 * further below the muzzle than the engine's maximum drop (ENGINE_CONFIG.maximumDrop, -15000 ft), so
 * it never ends an Accurate flight, and no hidden altitude can stop a shot. 5000 m is inside the
 * altitude limits, and the bullet stays well under the 11 km where the standard temperature stops
 * falling. ENGINE_CONFIG is not imported here (it would load the engine with the stores):
 * scopeAtmosphere.test.js checks the value against it.
 */
export const ACCURATE_ENGINE_ALTITUDE_M = 5000;

/** Decimals of a converted pressure box (#172): 1 in hPa, 2 in inHg, as the weather fill writes. */
export const PRESSURE_BOX_DECIMALS = Object.freeze({ hpa: 1, inhg: 2 });

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

/** A box read as the calculators read it; anything but a number or text (damaged storage) is NaN. */
const boxNumber = (value) => (typeof value === 'string' || typeof value === 'number' ? readDecimal(value) : NaN);

/** A number rounded to some decimals, with 0 for -0. */
function rounded(value, decimals) {
	const result = Math.round(value * 10 ** decimals) / 10 ** decimals;
	return result === 0 ? 0 : result;
}

/**
 * A sea-level (QNH) pressure box as the station pressure at the entered altitude, in the same unit
 * (#172): what the calculators made of it before (stationPressure, #107), rounded to 1 decimal in
 * hPa or 2 in inHg (PRESSURE_BOX_DECIMALS). Any unit but `hpa` is inHg, as the calculators read it.
 *
 * - A pressure out of its limits (or not a number) is returned as it is: it is out of the same
 *   limits as station pressure, so there is still no result and the box shows its message.
 * - A pressure within its limits with an altitude out of its limits (or not a number) gives an
 *   empty box: there was no result, and there is no altitude to convert with, so the box shows its
 *   message instead of a result for air the user did not enter.
 * - A converted value can fall out of the pressure limits (QNH 1013 hPa above about 9100 m, or above
 *   1200 hPa below sea level): it is kept, so there is no result and the box shows its message.
 *
 * @param {unknown} pressure - the stored box
 * @param {string} pressureUnit
 * @param {unknown} altitude - the stored altitude box
 * @param {string} altitudeUnit
 * @returns {string|number|unknown}
 */
export function stationPressureBox(pressure, pressureUnit, altitude, altitudeUnit) {
	const unit = pressureUnit === 'hpa' ? 'hpa' : 'inhg';
	const value = boxNumber(pressure);
	const limits = pressureLimits(unit);
	if (!(value >= limits.min && value <= limits.max)) return pressure;
	const site = Number.isNaN(boxNumber(altitude)) ? null : usableAltitude({ altitude, altitudeUnit });
	if (!site) return '';
	const seaLevel = unit === 'hpa' ? UNew.hPa(value) : UNew.InHg(value);
	const station = stationPressure(seaLevel, site).In(unit === 'hpa' ? Unit.hPa : Unit.InHg);
	return String(rounded(station, PRESSURE_BOX_DECIMALS[unit]));
}

/**
 * An Accurate atmosphere with station pressure (#172): one with `pressureRef` `qnh` (or anything but
 * `station`) has its pressure box converted by stationPressureBox with its own altitude, and
 * `pressureRef` `station`. The altitude box is kept, for ISA and Estimate. Any other atmosphere, and
 * an Accurate one already in station pressure, is returned as it is, so this can run on every read:
 * the next change on the card stores the converted values.
 *
 * ISA and Estimate states keep a `qnh` reference: they do not use the pressure box, and when the user
 * switches back to Accurate the box is converted with the altitude then, which is what the page
 * computed on that switch before #172.
 *
 * @template {{ mode: string, pressureRef?: string, pressure: unknown, pressureUnit: string,
 *   altitude: unknown, altitudeUnit: string }} T
 * @param {T} atmosphere
 * @returns {T}
 */
export function accurateStationAtmosphere(atmosphere) {
	if (atmosphere.mode !== 'accurate' || atmosphere.pressureRef === 'station') return atmosphere;
	return {
		...atmosphere,
		pressure: stationPressureBox(atmosphere.pressure, atmosphere.pressureUnit, atmosphere.altitude, atmosphere.altitudeUnit),
		pressureRef: 'station'
	};
}

/**
 * The atmosphere to hand to calculateShotPoint for the stored Scope View atmosphere (read by
 * storedScopeAtmosphere): `null` for the standard atmosphere at sea level, otherwise a custom
 * atmosphere in the shape calculateShotPoint reads. A value out of its limits is passed as it is,
 * so the calculator's guards reject it and there is no result.
 *
 * Accurate passes the pressure as station pressure (`pressureRef` `station`) at
 * ACCURATE_ENGINE_ALTITUDE_M, whatever altitude is stored (#172). An Accurate atmosphere still in QNH
 * is converted first (accurateStationAtmosphere); the stores already read it converted.
 *
 * @param {{ mode: AtmosphereMode, weather: Weather, pressureRef: PressureRef, altitude: string|number,
 *   altitudeUnit: 'ft'|'m', pressure: string|number, pressureUnit: 'inhg'|'hpa',
 *   temperature: string|number, temperatureUnit: 'f'|'c', humidity: string|number }} atmosphere
 * @returns {object|null}
 */
export function scopeAtmosphereParams(atmosphere) {
	const { altitude, altitudeUnit } = atmosphere;
	if (atmosphere.mode === 'accurate') {
		const station = accurateStationAtmosphere(atmosphere);
		return {
			altitude: ACCURATE_ENGINE_ALTITUDE_M,
			altitudeUnit: 'm',
			pressure: station.pressure,
			pressureUnit: station.pressureUnit,
			pressureRef: 'station',
			temperature: station.temperature,
			temperatureUnit: station.temperatureUnit,
			humidity: station.humidity
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
