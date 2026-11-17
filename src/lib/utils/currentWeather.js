import { UNew, Unit } from 'js-ballistics';
import {
	ALTITUDE_LIMITS,
	HUMIDITY_LIMITS,
	PRESSURE_LIMITS,
	TEMPERATURE_LIMITS,
	altitudeLimits,
	pressureLimits,
	temperatureLimits
} from './inputLimits.js';

/**
 * Current weather at the user's location (#152; owner decisions of 2026-11-16).
 *
 * On a tap of "Use current weather here" in the Accurate atmosphere, the page asks the device for
 * its position, sends only the latitude and longitude, rounded to 2 decimals (about 1 km), to
 * Open-Meteo, and fills altitude, sea-level pressure (QNH), temperature and humidity once. Nothing
 * runs before the tap; nothing is cached or stored here (the filled boxes are stored by the page's
 * own atmosphere store, as typed values are). See docs/data-and-privacy.md.
 *
 * Since #154 the same request asks for MeteoSwiss ICON-CH1 inside its area and Open-Meteo's default
 * models elsewhere; weatherModel tells the card which one answered, for the attribution.
 *
 * Errors are WeatherError with one of four codes, which the atmosphere card shows:
 * - 'denied': the user or the platform refused the location.
 * - 'unavailable': no geolocation, no position in time, or a position that is not a coordinate.
 * - 'network': the request failed, timed out, was refused, or answered with an HTTP error.
 * - 'invalid': the answer is not JSON, or a value is missing, in another unit or out of the limits.
 * On any error the page leaves the boxes as they were.
 */

/** Open-Meteo forecast API; the key-less, non-commercial endpoint. Also in `csp` (vite.config.js). */
export const WEATHER_ENDPOINT = 'https://api.open-meteo.com/v1/forecast';

/** The current values asked for, in Open-Meteo's default units: °C, %, hPa. */
export const WEATHER_FIELDS = 'temperature_2m,relative_humidity_2m,pressure_msl';

/**
 * The models asked for (#154, owner decision of 2026-11-16): MeteoSwiss ICON-CH1 first, then
 * Open-Meteo's default ("best match"). With both, `current` holds plain keys whose values are
 * ICON-CH1's inside its area (Switzerland and around) and the default's elsewhere.
 */
export const WEATHER_MODELS = 'meteoswiss_icon_ch1,best_match';

/** Open-Meteo's name of the MeteoSwiss model, the suffix of its `hourly` keys. */
export const ICON_CH1 = 'meteoswiss_icon_ch1';

/** Open-Meteo's name of its default model choice. */
export const BEST_MATCH = 'best_match';

/**
 * The same three fields asked hourly, for the first forecast hour only: not used for any value, only
 * to tell which model answered. ICON-CH1 keys there end in `_meteoswiss_icon_ch1` when that model has
 * the point; outside its area they are plain.
 */
const MODEL_FORECAST_HOURS = 1;

/** Units Open-Meteo gives for those fields by default. Another unit in the answer is rejected. */
const EXPECTED_UNITS = { temperature_2m: '°C', relative_humidity_2m: '%', pressure_msl: 'hPa' };

/** The weather request is aborted after this, in ms. */
export const FETCH_TIMEOUT_MS = 10_000;

/** Options of getCurrentPosition: a fix of up to 5 minutes ago is fine; 15 s to find one. */
export const GEOLOCATION_OPTIONS = Object.freeze({
	enableHighAccuracy: true,
	timeout: 15_000,
	maximumAge: 300_000
});

/**
 * Longest wait for the position, in ms, permission prompt included. The geolocation timeout only
 * starts once the user allowed it, and some browsers never answer a prompt that was dismissed, which
 * would leave the button busy for good.
 */
export const POSITION_WAIT_MS = 60_000;

/** The digits kept of a coordinate: 2 decimals, about 1.1 km of latitude. */
const COORDINATE_DECIMALS = 2;

export class WeatherError extends Error {
	/**
	 * @param {'denied'|'unavailable'|'network'|'invalid'} code
	 * @param {unknown} [cause]
	 */
	constructor(code, cause) {
		super(`Current weather: ${code}`, cause === undefined ? undefined : { cause });
		this.name = 'WeatherError';
		this.code = code;
	}
}

/**
 * The error code to show for anything thrown while getting the weather. Anything that is not a
 * WeatherError reads as 'invalid': the boxes stay unchanged either way.
 * @param {unknown} error
 * @returns {'denied'|'unavailable'|'network'|'invalid'}
 */
export function weatherErrorCode(error) {
	return error instanceof WeatherError ? error.code : 'invalid';
}

/** 0 for -0, so that no box or URL shows "-0". */
const unsigned = (n) => (n === 0 ? 0 : n);

/**
 * A coordinate rounded to 2 decimals, or null when it is not a finite number within ±limit.
 * @param {unknown} value
 * @param {number} limit - 90 for a latitude, 180 for a longitude
 * @returns {number|null}
 */
export function roundCoordinate(value, limit) {
	if (typeof value !== 'number' || !Number.isFinite(value) || Math.abs(value) > limit) return null;
	return unsigned(Math.round(value * 10 ** COORDINATE_DECIMALS) / 10 ** COORDINATE_DECIMALS);
}

/**
 * The request URL: the rounded latitude and longitude, and fixed parameters (the three fields
 * current and for the first hour, the models), nothing else.
 * @param {number} latitude
 * @param {number} longitude
 * @returns {string}
 * @throws {WeatherError} 'unavailable' when a coordinate is not usable
 */
export function weatherUrl(latitude, longitude) {
	const lat = roundCoordinate(latitude, 90);
	const lon = roundCoordinate(longitude, 180);
	if (lat === null || lon === null) throw new WeatherError('unavailable');
	const query = [
		`latitude=${lat.toFixed(COORDINATE_DECIMALS)}`,
		`longitude=${lon.toFixed(COORDINATE_DECIMALS)}`,
		`current=${WEATHER_FIELDS}`,
		`hourly=${WEATHER_FIELDS}`,
		`models=${WEATHER_MODELS}`,
		`forecast_hours=${MODEL_FORECAST_HOURS}`
	].join('&');
	return `${WEATHER_ENDPOINT}?${query}`;
}

/**
 * The device position, once. Geolocation error codes: 1 PERMISSION_DENIED is 'denied'; 2
 * POSITION_UNAVAILABLE, 3 TIMEOUT, anything else, no answer within `wait`, or no geolocation at all
 * are 'unavailable'.
 *
 * @param {Geolocation|undefined} geolocation
 * @param {{ options?: PositionOptions, wait?: number, setTimer?: typeof setTimeout,
 *   clearTimer?: typeof clearTimeout }} [deps]
 * @returns {Promise<{ latitude: number, longitude: number, altitude: number|null }>}
 */
export function currentPosition(
	geolocation,
	{ options = GEOLOCATION_OPTIONS, wait = POSITION_WAIT_MS, setTimer = setTimeout, clearTimer = clearTimeout } = {}
) {
	return new Promise((resolve, reject) => {
		if (!geolocation || typeof geolocation.getCurrentPosition !== 'function') {
			reject(new WeatherError('unavailable'));
			return;
		}
		let settled = false;
		const timer = setTimer(() => finish(reject, new WeatherError('unavailable')), wait);
		function finish(settle, value) {
			if (settled) return;
			settled = true;
			clearTimer(timer);
			settle(value);
		}
		try {
			geolocation.getCurrentPosition(
				(position) => {
					const coords = position?.coords;
					const altitude = coords?.altitude;
					finish(resolve, {
						latitude: coords?.latitude,
						longitude: coords?.longitude,
						altitude: typeof altitude === 'number' && Number.isFinite(altitude) ? altitude : null
					});
				},
				(error) => finish(reject, new WeatherError(error?.code === 1 ? 'denied' : 'unavailable', error)),
				options
			);
		} catch (error) {
			finish(reject, new WeatherError('unavailable', error));
		}
	});
}

/**
 * The answer of a weather request, parsed. No cookie, no referrer, no HTTP cache; aborted after
 * `timeout` ms or when `signal` aborts.
 *
 * @param {string} url
 * @param {{ fetch?: typeof fetch, timeout?: number, signal?: AbortSignal,
 *   setTimer?: typeof setTimeout, clearTimer?: typeof clearTimeout }} [deps]
 * @returns {Promise<unknown>}
 * @throws {WeatherError} 'network' for a failed, aborted or non-2xx request; 'invalid' for a body
 *   that is not JSON
 */
export async function fetchWeather(
	url,
	{
		fetch: fetchFn = globalThis.fetch,
		timeout = FETCH_TIMEOUT_MS,
		signal,
		setTimer = setTimeout,
		clearTimer = clearTimeout
	} = {}
) {
	if (typeof fetchFn !== 'function') throw new WeatherError('network');
	const controller = new AbortController();
	const abort = () => controller.abort();
	if (signal?.aborted) abort();
	signal?.addEventListener?.('abort', abort, { once: true });
	const timer = setTimer(abort, timeout);
	try {
		let response;
		try {
			response = await fetchFn(url, {
				method: 'GET',
				credentials: 'omit',
				referrerPolicy: 'no-referrer',
				cache: 'no-store',
				signal: controller.signal
			});
		} catch (error) {
			throw new WeatherError('network', error);
		}
		if (!response?.ok) throw new WeatherError('network');
		try {
			return await response.json();
		} catch (error) {
			// A body cut off by the timeout or the network is a network failure; anything else is
			// not JSON.
			throw new WeatherError(controller.signal.aborted || error?.name !== 'SyntaxError' ? 'network' : 'invalid', error);
		}
	} finally {
		clearTimer(timer);
		signal?.removeEventListener?.('abort', abort);
	}
}

const isFiniteNumber = (value) => typeof value === 'number' && Number.isFinite(value);
const within = (value, { min, max }) => value >= min && value <= max;

/**
 * The metric values of an Open-Meteo answer: temperature (°C), relative humidity (%) and
 * sea-level pressure (hPa) under `current`, each a finite number within the app's limits, and the
 * model's ground `elevation` (m), null when missing or outside the altitude limits. The units in
 * `current_units`, when given, must be Open-Meteo's defaults.
 *
 * @param {unknown} json
 * @returns {{ temperature: number, humidity: number, pressure: number, elevation: number|null }}
 * @throws {WeatherError} 'invalid'
 */
export function readWeather(json) {
	const current = json?.current;
	if (!current || typeof current !== 'object') throw new WeatherError('invalid');
	const units = json.current_units;
	if (units !== undefined) {
		if (!units || typeof units !== 'object') throw new WeatherError('invalid');
		for (const [field, unit] of Object.entries(EXPECTED_UNITS)) {
			if (units[field] !== undefined && units[field] !== unit) throw new WeatherError('invalid');
		}
	}
	const temperature = current.temperature_2m;
	const humidity = current.relative_humidity_2m;
	const pressure = current.pressure_msl;
	if (
		!isFiniteNumber(temperature) ||
		!within(temperature, TEMPERATURE_LIMITS.c) ||
		!isFiniteNumber(humidity) ||
		!within(humidity, HUMIDITY_LIMITS) ||
		!isFiniteNumber(pressure) ||
		!within(pressure, PRESSURE_LIMITS.hpa)
	) {
		throw new WeatherError('invalid');
	}
	const elevation = json.elevation;
	return {
		temperature,
		humidity,
		pressure,
		elevation: isFiniteNumber(elevation) && within(elevation, ALTITUDE_LIMITS.m) ? elevation : null
	};
}

/**
 * The model that filled the values: ICON_CH1 when the `hourly` block has
 * `temperature_2m_meteoswiss_icon_ch1`, `relative_humidity_2m_meteoswiss_icon_ch1` and
 * `pressure_msl_meteoswiss_icon_ch1` arrays whose first value is a finite number (owner decision),
 * else BEST_MATCH. Never throws: a missing or odd `hourly` block only means the default.
 *
 * @param {unknown} json
 * @returns {typeof ICON_CH1 | typeof BEST_MATCH}
 */
export function weatherModel(json) {
	const hourly = json && typeof json === 'object' ? json.hourly : undefined;
	if (!hourly || typeof hourly !== 'object') return BEST_MATCH;
	for (const field of WEATHER_FIELDS.split(',')) {
		const values = hourly[`${field}_${ICON_CH1}`];
		if (!Array.isArray(values) || !isFiniteNumber(values[0])) return BEST_MATCH;
	}
	return ICON_CH1;
}

/**
 * The site altitude in metres (owner decision): the device's GPS altitude when it is a finite number
 * within the altitude limits, else Open-Meteo's ground elevation. GPS altitude is usually height
 * above the WGS84 ellipsoid, not above sea level, and is not corrected.
 *
 * @param {number|null|undefined} gpsAltitude
 * @param {number|null|undefined} elevation
 * @returns {{ altitude: number, source: 'gps'|'elevation' }}
 * @throws {WeatherError} 'invalid' when neither is usable
 */
export function siteAltitude(gpsAltitude, elevation) {
	if (isFiniteNumber(gpsAltitude) && within(gpsAltitude, ALTITUDE_LIMITS.m)) {
		return { altitude: gpsAltitude, source: 'gps' };
	}
	if (isFiniteNumber(elevation) && within(elevation, ALTITUDE_LIMITS.m)) {
		return { altitude: elevation, source: 'elevation' };
	}
	throw new WeatherError('invalid');
}

const round = (value, decimals) => unsigned(Math.round(value * 10 ** decimals) / 10 ** decimals);

/** A rounded value in the unit of its box, checked against that box's limits. */
function boxValue(value, limits) {
	if (!Number.isFinite(value) || !within(value, limits)) throw new WeatherError('invalid');
	return String(value);
}

/**
 * The atmosphere patch for the card's boxes, in the units they show: altitude whole (ft or m),
 * pressure as QNH with 1 decimal in hPa or 2 in inHg, temperature with 1 decimal (°C or °F), humidity
 * whole. Mode stays accurate; pressureRef becomes 'qnh', since pressure_msl is a sea-level pressure.
 * Units are not changed. Conversions are js-ballistics', as the calculators use.
 *
 * @param {{ temperature: number, humidity: number, pressure: number }} weather - from readWeather
 * @param {number} altitude - metres, from siteAltitude
 * @param {{ altitudeUnit?: string, pressureUnit?: string, temperatureUnit?: string }} units - the
 *   card's current units; anything but 'm', 'hpa', 'c' reads as ft, inHg, °F, as the calculators do
 * @returns {{ mode: 'accurate', pressureRef: 'qnh', altitude: string, pressure: string,
 *   temperature: string, humidity: string }}
 * @throws {WeatherError} 'invalid' when a converted value falls outside its box's limits
 */
export function weatherPatch(weather, altitude, units) {
	const altitudeUnit = units?.altitudeUnit === 'm' ? 'm' : 'ft';
	const pressureUnit = units?.pressureUnit === 'hpa' ? 'hpa' : 'inhg';
	const temperatureUnit = units?.temperatureUnit === 'c' ? 'c' : 'f';

	const altitudeValue = round(altitudeUnit === 'm' ? altitude : UNew.Meter(altitude).In(Unit.Foot), 0);
	const pressureValue =
		pressureUnit === 'hpa' ? round(weather.pressure, 1) : round(UNew.hPa(weather.pressure).In(Unit.InHg), 2);
	const temperatureValue = round(
		temperatureUnit === 'c' ? weather.temperature : UNew.Celsius(weather.temperature).In(Unit.Fahrenheit),
		1
	);

	return {
		mode: 'accurate',
		pressureRef: 'qnh',
		altitude: boxValue(altitudeValue, altitudeLimits(altitudeUnit)),
		pressure: boxValue(pressureValue, pressureLimits(pressureUnit)),
		temperature: boxValue(temperatureValue, temperatureLimits(temperatureUnit)),
		humidity: boxValue(round(weather.humidity, 0), HUMIDITY_LIMITS)
	};
}

/**
 * Position, then weather: the metric values and the site altitude, not yet in the boxes' units, so
 * that the page converts with the units shown when the answer arrives, and the model that answered.
 *
 * @param {{ geolocation?: Geolocation, fetch?: typeof fetch, signal?: AbortSignal,
 *   setTimer?: typeof setTimeout, clearTimer?: typeof clearTimeout }} deps
 * @returns {Promise<{ weather: ReturnType<typeof readWeather>, altitude: number,
 *   altitudeSource: 'gps'|'elevation', model: typeof ICON_CH1 | typeof BEST_MATCH }>}
 */
export async function readCurrentWeather({ geolocation, fetch: fetchFn, signal, setTimer, clearTimer } = {}) {
	const position = await currentPosition(geolocation, { setTimer, clearTimer });
	if (signal?.aborted) throw new WeatherError('network');
	const json = await fetchWeather(weatherUrl(position.latitude, position.longitude), {
		fetch: fetchFn,
		signal,
		setTimer,
		clearTimer
	});
	const weather = readWeather(json);
	const { altitude, source } = siteAltitude(position.altitude, weather.elevation);
	return { weather, altitude, altitudeSource: source, model: weatherModel(json) };
}

/** Electron's app scheme (electron/navigation.js, APP_SCHEME), as location.protocol gives it. */
const ELECTRON_PROTOCOL = 'app:';

/**
 * Whether to show "Use current weather here": web and mobile (Capacitor) with geolocation and
 * fetch. Not on the desktop build, which refuses every permission (electron/permissions.js): it
 * loads from app://-, and its user agent names Electron.
 *
 * @param {{ navigator?: Navigator, location?: Location, fetch?: unknown, AbortController?: unknown }} env
 * @returns {boolean}
 */
export function isCurrentWeatherAvailable(env) {
	const nav = env?.navigator;
	if (!nav?.geolocation || typeof nav.geolocation.getCurrentPosition !== 'function') return false;
	if (env.location?.protocol === ELECTRON_PROTOCOL) return false;
	if (/\bElectron\//.test(String(nav.userAgent ?? ''))) return false;
	return typeof env.fetch === 'function' && typeof env.AbortController === 'function';
}

/**
 * The time of a fill for the card, hour and minute in the locale ('14:05', '2:05 PM'), or '' when
 * the date or locale cannot be formatted.
 * @param {Date} date
 * @param {string} locale
 * @returns {string}
 */
export function weatherTime(date, locale) {
	try {
		return new Intl.DateTimeFormat(locale, { hour: '2-digit', minute: '2-digit' }).format(date);
	} catch {
		return '';
	}
}

/**
 * The fill behind the button, for a page: one request at a time, a late answer ignored after
 * cancel(), the boxes changed in one apply() call or not at all.
 *
 * @param {{
 *   read: (deps: { signal: AbortSignal }) => ReturnType<typeof readCurrentWeather>,
 *   getAtmosphere: () => { mode: string, altitudeUnit?: string, pressureUnit?: string, temperatureUnit?: string },
 *   apply: (patch: ReturnType<typeof weatherPatch>) => void,
 *   onstatus: (status: { state: 'idle'|'loading'|'done'|'error', error?: string, time?: string,
 *     model?: typeof ICON_CH1 | typeof BEST_MATCH }) => void,
 *   now?: () => Date,
 *   formatTime?: (date: Date) => string
 * }} deps
 */
export function createWeatherFill({ read, getAtmosphere, apply, onstatus, now = () => new Date(), formatTime = () => '' }) {
	const IDLE = Object.freeze({ state: 'idle' });
	let status = IDLE;
	let run = 0;
	let controller = null;

	function set(next) {
		status = next;
		onstatus(next);
	}

	function stop() {
		run += 1;
		controller?.abort();
		controller = null;
	}

	return {
		get status() {
			return status;
		},

		/** On a tap. Ignored while a request runs, and outside the Accurate mode. */
		async request() {
			if (status.state === 'loading' || getAtmosphere()?.mode !== 'accurate') return;
			const id = ++run;
			controller = new AbortController();
			set({ state: 'loading' });
			try {
				const { weather, altitude, model } = await read({ signal: controller.signal });
				if (id !== run) return;
				const atmosphere = getAtmosphere();
				if (atmosphere?.mode !== 'accurate') {
					set(IDLE);
					return;
				}
				apply(weatherPatch(weather, altitude, atmosphere));
				set({ state: 'done', time: formatTime(now()), model: model === ICON_CH1 ? ICON_CH1 : BEST_MATCH });
			} catch (error) {
				if (id !== run) return;
				set({ state: 'error', error: weatherErrorCode(error) });
			} finally {
				if (id === run) controller = null;
			}
		},

		/** Leaving the Accurate mode: a running request is dropped, and the status cleared. */
		cancel() {
			stop();
			if (status.state !== 'idle') set(IDLE);
		},

		/** Leaving the page: a running request is dropped; nothing is reported any more. */
		dispose() {
			stop();
			status = IDLE;
		},

		/**
		 * After a change on the atmosphere card. A mode other than accurate cancels; any other change
		 * clears a done or error line. A change while loading keeps the request: its values replace
		 * the boxes when it answers, converted to the units shown then.
		 * @param {Record<string, unknown>} patch
		 */
		changed(patch) {
			if (patch && 'mode' in patch && patch.mode !== 'accurate') this.cancel();
			else if (status.state === 'done' || status.state === 'error') set(IDLE);
		}
	};
}
