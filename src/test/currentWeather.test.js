import { readFileSync } from 'fs';
import { describe, expect, it, vi } from 'vitest';
import { APP_SCHEME } from '../../electron/navigation.js';
import {
	FETCH_TIMEOUT_MS,
	GEOLOCATION_OPTIONS,
	POSITION_WAIT_MS,
	WEATHER_ENDPOINT,
	WeatherError,
	createWeatherFill,
	currentPosition,
	fetchWeather,
	isCurrentWeatherAvailable,
	readCurrentWeather,
	readWeather,
	roundCoordinate,
	siteAltitude,
	weatherErrorCode,
	weatherPatch,
	weatherTime,
	weatherUrl
} from '#lib/utils/currentWeather.js';

// Current weather at the location (#152). Every browser API is injected: nothing here reaches the
// network or a real geolocation.

/** An Open-Meteo answer as the API gives it, with the default units. */
function answer(current = {}, extra = {}) {
	return {
		latitude: 46.22,
		longitude: 7.36,
		elevation: 512,
		current_units: { time: 'iso8601', interval: 'seconds', temperature_2m: '°C', relative_humidity_2m: '%', pressure_msl: 'hPa' },
		current: { time: '2026-11-16T13:45', interval: 900, temperature_2m: 8.4, relative_humidity_2m: 71, pressure_msl: 1018.6, ...current },
		...extra
	};
}

const okResponse = (body) => ({ ok: true, status: 200, json: async () => body });

/** A geolocation that answers at once with these coords, or fails with this code. */
function geolocationWith({ coords, code } = {}) {
	return {
		getCurrentPosition: vi.fn((success, failure) => {
			if (code !== undefined) failure({ code, message: 'x' });
			else success({ coords: { latitude: 46.2276, longitude: 7.3594, altitude: null, ...coords }, timestamp: 0 });
		})
	};
}

/** Expect a promise or function to fail with this WeatherError code. */
async function expectCode(promiseOrFn, code) {
	let error;
	try {
		await (typeof promiseOrFn === 'function' ? promiseOrFn() : promiseOrFn);
	} catch (e) {
		error = e;
	}
	expect(error).toBeInstanceOf(WeatherError);
	expect(error.code).toBe(code);
}

describe('roundCoordinate', () => {
	it('keeps 2 decimals', () => {
		expect(roundCoordinate(46.227612, 90)).toBe(46.23);
		expect(roundCoordinate(7.359444, 180)).toBe(7.36);
		expect(roundCoordinate(-33.868819, 90)).toBe(-33.87);
		expect(roundCoordinate(151.209295, 180)).toBe(151.21);
	});

	it('gives 0, not -0, near the equator and the meridian', () => {
		expect(Object.is(roundCoordinate(-0.004, 90), 0)).toBe(true);
		expect(Object.is(roundCoordinate(-0, 180), 0)).toBe(true);
	});

	it('takes the ends and refuses anything else', () => {
		expect(roundCoordinate(90, 90)).toBe(90);
		expect(roundCoordinate(-180, 180)).toBe(-180);
		for (const bad of [90.001, -91, NaN, Infinity, -Infinity, '46.2', null, undefined, {}]) {
			expect(roundCoordinate(bad, 90)).toBeNull();
		}
	});
});

describe('weatherUrl', () => {
	it('sends only the rounded latitude and longitude and the three fields', () => {
		const url = new URL(weatherUrl(46.227612, 7.359444));
		expect(url.origin + url.pathname).toBe(WEATHER_ENDPOINT);
		expect([...url.searchParams.keys()]).toEqual(['latitude', 'longitude', 'current']);
		expect(url.searchParams.get('latitude')).toBe('46.23');
		expect(url.searchParams.get('longitude')).toBe('7.36');
		expect(url.searchParams.get('current')).toBe('temperature_2m,relative_humidity_2m,pressure_msl');
		expect(url.hash).toBe('');
	});

	it('writes exactly 2 decimals, with no -0', () => {
		expect(weatherUrl(-0.001, -0.004)).toBe(
			'https://api.open-meteo.com/v1/forecast?latitude=0.00&longitude=0.00&current=temperature_2m,relative_humidity_2m,pressure_msl'
		);
		expect(weatherUrl(-33.8, 151)).toContain('latitude=-33.80&longitude=151.00&');
	});

	it('refuses a position that is not a coordinate', async () => {
		for (const [lat, lon] of [
			[NaN, 7],
			[46, Infinity],
			[91, 7],
			[46, 181],
			[undefined, 7],
			['46', '7']
		]) {
			await expectCode(() => weatherUrl(lat, lon), 'unavailable');
		}
	});
});

describe('currentPosition', () => {
	it('asks once, with high accuracy, a 15 s timeout and a fix of up to 5 minutes', async () => {
		const geolocation = geolocationWith({ coords: { altitude: 498.7 } });
		await expect(currentPosition(geolocation)).resolves.toEqual({ latitude: 46.2276, longitude: 7.3594, altitude: 498.7 });
		expect(geolocation.getCurrentPosition).toHaveBeenCalledOnce();
		expect(geolocation.getCurrentPosition.mock.calls[0][2]).toEqual({ enableHighAccuracy: true, timeout: 15000, maximumAge: 300000 });
		expect(GEOLOCATION_OPTIONS).toEqual({ enableHighAccuracy: true, timeout: 15000, maximumAge: 300000 });
	});

	it('gives a null altitude when the device has none or a damaged one', async () => {
		for (const altitude of [null, undefined, NaN, Infinity, '500']) {
			const position = await currentPosition(geolocationWith({ coords: { altitude } }));
			expect(position.altitude).toBeNull();
		}
	});

	it('maps PERMISSION_DENIED to denied, and POSITION_UNAVAILABLE, TIMEOUT and others to unavailable', async () => {
		await expectCode(currentPosition(geolocationWith({ code: 1 })), 'denied');
		await expectCode(currentPosition(geolocationWith({ code: 2 })), 'unavailable');
		await expectCode(currentPosition(geolocationWith({ code: 3 })), 'unavailable');
		await expectCode(currentPosition(geolocationWith({ code: 99 })), 'unavailable');
	});

	it('is unavailable without geolocation, or when the call throws', async () => {
		await expectCode(currentPosition(undefined), 'unavailable');
		await expectCode(currentPosition({}), 'unavailable');
		await expectCode(
			currentPosition({
				getCurrentPosition() {
					throw new Error('blocked');
				}
			}),
			'unavailable'
		);
	});

	it('gives up after POSITION_WAIT_MS when the prompt never answers, and ignores a late answer', async () => {
		vi.useFakeTimers();
		try {
			let late;
			const promise = currentPosition({ getCurrentPosition: (success) => (late = success) });
			const check = expectCode(promise, 'unavailable');
			vi.advanceTimersByTime(POSITION_WAIT_MS);
			await check;
			expect(() => late({ coords: { latitude: 1, longitude: 2 } })).not.toThrow();
		} finally {
			vi.useRealTimers();
		}
	});
});

describe('fetchWeather', () => {
	const url = weatherUrl(46.2276, 7.3594);

	it('sends no cookie, no referrer, skips the HTTP cache and can be aborted', async () => {
		const fetch = vi.fn(async () => okResponse(answer()));
		await expect(fetchWeather(url, { fetch })).resolves.toEqual(answer());
		expect(fetch).toHaveBeenCalledOnce();
		const [calledUrl, init] = fetch.mock.calls[0];
		expect(calledUrl).toBe(url);
		expect(init).toMatchObject({ method: 'GET', credentials: 'omit', referrerPolicy: 'no-referrer', cache: 'no-store' });
		expect(init.signal).toBeInstanceOf(AbortSignal);
		expect(Object.keys(init).sort()).toEqual(['cache', 'credentials', 'method', 'referrerPolicy', 'signal']);
	});

	it('maps a failed request (offline, CORS, CSP) to network', async () => {
		await expectCode(fetchWeather(url, { fetch: async () => Promise.reject(new TypeError('Failed to fetch')) }), 'network');
		await expectCode(fetchWeather(url, { fetch: null }), 'network');
	});

	it('maps an HTTP error to network', async () => {
		for (const status of [400, 404, 429, 500, 503]) {
			await expectCode(fetchWeather(url, { fetch: async () => ({ ok: false, status, json: async () => ({ error: true }) }) }), 'network');
		}
	});

	it('maps a body that is not JSON to invalid', async () => {
		const fetch = async () => ({ ok: true, json: async () => JSON.parse('<html>') });
		await expectCode(fetchWeather(url, { fetch }), 'invalid');
	});

	it('aborts after FETCH_TIMEOUT_MS and maps it to network', async () => {
		expect(FETCH_TIMEOUT_MS).toBe(10000);
		vi.useFakeTimers();
		try {
			let signal;
			const fetch = (_u, init) =>
				new Promise((_resolve, reject) => {
					signal = init.signal;
					init.signal.addEventListener('abort', () => reject(new DOMException('aborted', 'AbortError')));
				});
			const check = expectCode(fetchWeather(url, { fetch }), 'network');
			vi.advanceTimersByTime(FETCH_TIMEOUT_MS - 1);
			expect(signal.aborted).toBe(false);
			vi.advanceTimersByTime(1);
			await check;
			expect(signal.aborted).toBe(true);
		} finally {
			vi.useRealTimers();
		}
	});

	it('aborts when the caller cancels', async () => {
		const outer = new AbortController();
		let inner;
		const fetch = (_u, init) =>
			new Promise((_resolve, reject) => {
				inner = init.signal;
				init.signal.addEventListener('abort', () => reject(new DOMException('aborted', 'AbortError')));
			});
		const check = expectCode(fetchWeather(url, { fetch, signal: outer.signal }), 'network');
		outer.abort();
		await check;
		expect(inner.aborted).toBe(true);
	});
});

describe('readWeather', () => {
	it('reads the three values and the elevation', () => {
		expect(readWeather(answer())).toEqual({ temperature: 8.4, humidity: 71, pressure: 1018.6, elevation: 512 });
	});

	it('accepts an answer without current_units', () => {
		const { current_units, ...rest } = answer();
		expect(readWeather(rest).pressure).toBe(1018.6);
	});

	it('takes the limits themselves', () => {
		expect(() => readWeather(answer({ temperature_2m: -90, relative_humidity_2m: 0, pressure_msl: 300 }))).not.toThrow();
		expect(() => readWeather(answer({ temperature_2m: 70, relative_humidity_2m: 100, pressure_msl: 1200 }))).not.toThrow();
	});

	it('rejects missing, damaged and out-of-limit values', async () => {
		const bad = [
			null,
			'text',
			{},
			{ current: null },
			{ current: 'x' },
			answer({ temperature_2m: undefined }),
			answer({ temperature_2m: null }),
			answer({ temperature_2m: '8.4' }),
			answer({ temperature_2m: NaN }),
			answer({ temperature_2m: -90.1 }),
			answer({ temperature_2m: 70.1 }),
			answer({ relative_humidity_2m: -1 }),
			answer({ relative_humidity_2m: 100.5 }),
			answer({ relative_humidity_2m: Infinity }),
			answer({ pressure_msl: 299.9 }),
			answer({ pressure_msl: 1200.1 }),
			answer({ pressure_msl: undefined }),
			answer({}, { current_units: { temperature_2m: '°F', relative_humidity_2m: '%', pressure_msl: 'hPa' } }),
			answer({}, { current_units: { temperature_2m: '°C', relative_humidity_2m: '%', pressure_msl: 'inHg' } }),
			answer({}, { current_units: 'x' }),
			answer({}, { current_units: null })
		];
		for (const json of bad) await expectCode(() => readWeather(json), 'invalid');
	});

	it('drops an elevation that is missing, damaged or out of the altitude limits', () => {
		for (const elevation of [undefined, null, NaN, '512', -1000.5, 10000.5]) {
			expect(readWeather(answer({}, { elevation })).elevation).toBeNull();
		}
		expect(readWeather(answer({}, { elevation: -1000 })).elevation).toBe(-1000);
		expect(readWeather(answer({}, { elevation: 0 })).elevation).toBe(0);
	});
});

describe('siteAltitude', () => {
	it('uses the GPS altitude when it is a finite number', () => {
		expect(siteAltitude(498.7, 512)).toEqual({ altitude: 498.7, source: 'gps' });
		expect(siteAltitude(0, 512)).toEqual({ altitude: 0, source: 'gps' });
		expect(siteAltitude(-12, null)).toEqual({ altitude: -12, source: 'gps' });
	});

	it("falls back to Open-Meteo's elevation without a usable GPS altitude", () => {
		for (const gps of [null, undefined, NaN, Infinity, 10000.1, -1000.1]) {
			expect(siteAltitude(gps, 512)).toEqual({ altitude: 512, source: 'elevation' });
		}
	});

	it('is invalid with neither', async () => {
		await expectCode(() => siteAltitude(null, null), 'invalid');
		await expectCode(() => siteAltitude(NaN, 20000), 'invalid');
	});
});

describe('weatherPatch', () => {
	const weather = { temperature: 8.44, humidity: 70.6, pressure: 1018.64 };

	it('fills metric boxes: whole metres, 1 decimal hPa and °C, whole percent, as QNH', () => {
		expect(weatherPatch(weather, 498.7, { altitudeUnit: 'm', pressureUnit: 'hpa', temperatureUnit: 'c' })).toEqual({
			mode: 'accurate',
			pressureRef: 'qnh',
			altitude: '499',
			pressure: '1018.6',
			temperature: '8.4',
			humidity: '71'
		});
	});

	it('fills imperial boxes: whole feet, 2 decimal inHg, 1 decimal °F', () => {
		expect(weatherPatch(weather, 498.7, { altitudeUnit: 'ft', pressureUnit: 'inhg', temperatureUnit: 'f' })).toEqual({
			mode: 'accurate',
			pressureRef: 'qnh',
			altitude: '1636', // 498.7 m / 0.3048
			pressure: '30.08', // 1018.64 hPa / 33.8639
			temperature: '47.2', // 8.44 * 1.8 + 32 = 47.192
			humidity: '71'
		});
	});

	it('mixes units as the boxes show them, and reads unknown units as the calculators do', () => {
		expect(weatherPatch(weather, 100, { altitudeUnit: 'm', pressureUnit: 'inhg', temperatureUnit: 'c' })).toMatchObject({
			altitude: '100',
			pressure: '30.08',
			temperature: '8.4'
		});
		expect(weatherPatch(weather, 100, {})).toMatchObject({ altitude: '328', pressure: '30.08', temperature: '47.2' });
	});

	it('gives standard air as the standard boxes', () => {
		const patch = weatherPatch({ temperature: 15, humidity: 0, pressure: 1013.25 }, 0, { altitudeUnit: 'ft', pressureUnit: 'inhg', temperatureUnit: 'f' });
		expect(patch).toMatchObject({ altitude: '0', pressure: '29.92', temperature: '59', humidity: '0' });
	});

	it('writes no -0 and reads back with the app reader', () => {
		const patch = weatherPatch({ temperature: -0.04, humidity: 0.2, pressure: 1000 }, -0.3, { altitudeUnit: 'm', pressureUnit: 'hpa', temperatureUnit: 'c' });
		expect(patch).toMatchObject({ altitude: '0', temperature: '0', humidity: '0', pressure: '1000' });
		const negative = weatherPatch({ temperature: -12.36, humidity: 50, pressure: 990 }, -400, { altitudeUnit: 'm', pressureUnit: 'hpa', temperatureUnit: 'f' });
		expect(negative).toMatchObject({ altitude: '-400', temperature: '9.8' });
	});

	it('rejects a value that converts outside its box limits', async () => {
		// 1200 hPa is within the hPa limit but 35.44 inHg is above the inHg one (35.4).
		await expectCode(() => weatherPatch({ temperature: 10, humidity: 50, pressure: 1200 }, 0, { pressureUnit: 'inhg' }), 'invalid');
		expect(weatherPatch({ temperature: 10, humidity: 50, pressure: 1200 }, 0, { pressureUnit: 'hpa' }).pressure).toBe('1200');
	});
});

describe('readCurrentWeather', () => {
	it('asks the position, then the weather at the rounded position, and keeps the GPS altitude', async () => {
		const geolocation = geolocationWith({ coords: { altitude: 498.7 } });
		const fetch = vi.fn(async () => okResponse(answer()));
		const result = await readCurrentWeather({ geolocation, fetch });
		expect(fetch.mock.calls[0][0]).toBe(weatherUrl(46.23, 7.36));
		expect(result).toEqual({ weather: { temperature: 8.4, humidity: 71, pressure: 1018.6, elevation: 512 }, altitude: 498.7, altitudeSource: 'gps' });
	});

	it("uses Open-Meteo's elevation without a GPS altitude", async () => {
		const result = await readCurrentWeather({ geolocation: geolocationWith(), fetch: async () => okResponse(answer()) });
		expect(result).toMatchObject({ altitude: 512, altitudeSource: 'elevation' });
	});

	it('sends nothing when the location is refused or unavailable', async () => {
		for (const [code, expected] of [
			[1, 'denied'],
			[2, 'unavailable'],
			[3, 'unavailable']
		]) {
			const fetch = vi.fn();
			await expectCode(readCurrentWeather({ geolocation: geolocationWith({ code }), fetch }), expected);
			expect(fetch).not.toHaveBeenCalled();
		}
		const fetch = vi.fn();
		await expectCode(readCurrentWeather({ geolocation: undefined, fetch }), 'unavailable');
		expect(fetch).not.toHaveBeenCalled();
	});

	it('sends nothing when cancelled while the position was found', async () => {
		const controller = new AbortController();
		controller.abort();
		const fetch = vi.fn();
		await expectCode(readCurrentWeather({ geolocation: geolocationWith(), fetch, signal: controller.signal }), 'network');
		expect(fetch).not.toHaveBeenCalled();
	});
});

describe('weatherErrorCode', () => {
	it('keeps a WeatherError code and reads anything else as invalid', () => {
		expect(weatherErrorCode(new WeatherError('denied'))).toBe('denied');
		expect(weatherErrorCode(new Error('x'))).toBe('invalid');
		expect(weatherErrorCode(undefined)).toBe('invalid');
	});
});

describe('isCurrentWeatherAvailable', () => {
	const geolocation = { getCurrentPosition() {} };
	const web = {
		navigator: { geolocation, userAgent: 'Mozilla/5.0 (Linux; Android 15) Chrome/140 Mobile Safari/537.36' },
		location: { protocol: 'https:' },
		fetch() {},
		AbortController
	};

	it('shows the button on the web and in the mobile web views', () => {
		expect(isCurrentWeatherAvailable(web)).toBe(true);
		expect(isCurrentWeatherAvailable({ ...web, location: { protocol: 'capacitor:' } })).toBe(true);
	});

	it('hides it on the desktop build: its app scheme, or an Electron user agent', () => {
		expect(`${APP_SCHEME}:`).toBe('app:');
		expect(isCurrentWeatherAvailable({ ...web, location: { protocol: `${APP_SCHEME}:` } })).toBe(false);
		expect(
			isCurrentWeatherAvailable({
				...web,
				navigator: { geolocation, userAgent: 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 zro/2.0.0 Chrome/142 Electron/45.2.3 Safari/537.36' }
			})
		).toBe(false);
	});

	it('hides it without geolocation, fetch or AbortController', () => {
		expect(isCurrentWeatherAvailable({ ...web, navigator: { userAgent: 'x' } })).toBe(false);
		expect(isCurrentWeatherAvailable({ ...web, navigator: { geolocation: {}, userAgent: 'x' } })).toBe(false);
		expect(isCurrentWeatherAvailable({ ...web, fetch: undefined })).toBe(false);
		expect(isCurrentWeatherAvailable({ ...web, AbortController: undefined })).toBe(false);
		expect(isCurrentWeatherAvailable(undefined)).toBe(false);
	});

	it('the desktop app still refuses every permission', () => {
		const permissions = readFileSync('electron/permissions.js', 'utf8');
		expect(permissions).toContain('callback(false)');
		expect(permissions).not.toMatch(/geolocation/);
	});
});

describe('weatherTime', () => {
	const date = new Date(2026, 10, 16, 14, 5);

	it('formats hour and minute in the locale', () => {
		expect(weatherTime(date, 'de')).toBe('14:05');
		expect(weatherTime(date, 'fr')).toBe('14:05');
		expect(weatherTime(date, 'en')).toMatch(/^02:05\s?PM$/);
	});

	it('gives an empty string for a date or locale it cannot format', () => {
		expect(weatherTime(new Date(NaN), 'en')).toBe('');
		expect(weatherTime(date, 'not a locale!')).toBe('');
	});
});

describe('createWeatherFill', () => {
	const reading = { weather: { temperature: 8.4, humidity: 71, pressure: 1018.6, elevation: 512 }, altitude: 498.7 };
	const metric = { mode: 'accurate', altitudeUnit: 'm', pressureUnit: 'hpa', temperatureUnit: 'c' };

	function setup({ read = vi.fn(async () => reading), atmosphere = { ...metric } } = {}) {
		const state = { atmosphere };
		const statuses = [];
		const apply = vi.fn((patch) => (state.atmosphere = { ...state.atmosphere, ...patch }));
		const fill = createWeatherFill({
			read,
			getAtmosphere: () => state.atmosphere,
			apply,
			onstatus: (s) => statuses.push(s),
			now: () => new Date(2026, 10, 16, 14, 5),
			formatTime: (d) => `${d.getHours()}:${String(d.getMinutes()).padStart(2, '0')}`
		});
		return { fill, read, apply, statuses, state };
	}

	/** A read that waits until the test settles it. */
	function deferredRead() {
		let resolve, reject;
		const read = vi.fn(() => new Promise((res, rej) => ((resolve = res), (reject = rej))));
		return { read, resolve: (v) => resolve(v), reject: (e) => reject(e) };
	}

	it('reads nothing until a request', () => {
		const { read, apply, statuses } = setup();
		expect(read).not.toHaveBeenCalled();
		expect(apply).not.toHaveBeenCalled();
		expect(statuses).toEqual([]);
	});

	it('fills the four boxes in one change, as QNH, then reports the time', async () => {
		const { fill, apply, statuses, state } = setup();
		await fill.request();
		expect(apply).toHaveBeenCalledOnce();
		expect(apply.mock.calls[0][0]).toEqual({ mode: 'accurate', pressureRef: 'qnh', altitude: '499', pressure: '1018.6', temperature: '8.4', humidity: '71' });
		expect(statuses).toEqual([{ state: 'loading' }, { state: 'done', time: '14:05' }]);
		expect(state.atmosphere.mode).toBe('accurate');
	});

	it('leaves the boxes unchanged on every error, with its code', async () => {
		for (const code of ['denied', 'unavailable', 'network', 'invalid']) {
			const { fill, apply, statuses, state } = setup({ read: vi.fn(async () => Promise.reject(new WeatherError(code))) });
			const before = { ...state.atmosphere };
			await fill.request();
			expect(apply).not.toHaveBeenCalled();
			expect(state.atmosphere).toEqual(before);
			expect(statuses.at(-1)).toEqual({ state: 'error', error: code });
		}
	});

	it('leaves the boxes unchanged when a value converts outside the box limits', async () => {
		const read = vi.fn(async () => ({ ...reading, weather: { ...reading.weather, pressure: 1200 } }));
		const { fill, apply, statuses } = setup({ read, atmosphere: { ...metric, pressureUnit: 'inhg' } });
		await fill.request();
		expect(apply).not.toHaveBeenCalled();
		expect(statuses.at(-1)).toEqual({ state: 'error', error: 'invalid' });
	});

	it('ignores taps while loading', async () => {
		const deferred = deferredRead();
		const { fill, read } = setup({ read: deferred.read });
		const first = fill.request();
		fill.request();
		fill.request();
		expect(read).toHaveBeenCalledOnce();
		deferred.resolve(reading);
		await first;
		const second = fill.request();
		expect(read).toHaveBeenCalledTimes(2);
		deferred.resolve(reading);
		await second;
	});

	it('does nothing outside the Accurate mode', async () => {
		for (const mode of ['isa', 'estimate']) {
			const { fill, read, statuses } = setup({ atmosphere: { ...metric, mode } });
			await fill.request();
			expect(read).not.toHaveBeenCalled();
			expect(statuses).toEqual([]);
		}
	});

	it('converts with the units shown when the answer arrives', async () => {
		const deferred = deferredRead();
		const { fill, apply, state } = setup({ read: deferred.read });
		const pending = fill.request();
		state.atmosphere = { ...state.atmosphere, altitudeUnit: 'ft', pressureUnit: 'inhg', temperatureUnit: 'f' };
		deferred.resolve(reading);
		await pending;
		expect(apply.mock.calls[0][0]).toMatchObject({ altitude: '1636', pressure: '30.08', temperature: '47.1' });
	});

	it('writes nothing for a late answer after cancel, and aborts the request', async () => {
		const deferred = deferredRead();
		const { fill, apply, statuses } = setup({ read: deferred.read });
		const pending = fill.request();
		const signal = deferred.read.mock.calls[0][0].signal;
		fill.cancel();
		expect(signal.aborted).toBe(true);
		deferred.resolve(reading);
		await pending;
		expect(apply).not.toHaveBeenCalled();
		expect(statuses).toEqual([{ state: 'loading' }, { state: 'idle' }]);
	});

	it('writes nothing and reports nothing after dispose (page left)', async () => {
		const deferred = deferredRead();
		const { fill, apply, statuses } = setup({ read: deferred.read });
		const pending = fill.request();
		fill.dispose();
		deferred.resolve(reading);
		await pending;
		expect(apply).not.toHaveBeenCalled();
		expect(statuses).toEqual([{ state: 'loading' }]);
		expect(fill.status).toEqual({ state: 'idle' });
	});

	it('writes nothing when the mode changed before the answer', async () => {
		const deferred = deferredRead();
		const { fill, apply, statuses, state } = setup({ read: deferred.read });
		const pending = fill.request();
		state.atmosphere = { ...state.atmosphere, mode: 'estimate' };
		deferred.resolve(reading);
		await pending;
		expect(apply).not.toHaveBeenCalled();
		expect(statuses.at(-1)).toEqual({ state: 'idle' });
	});

	it('ignores a late error after cancel', async () => {
		const deferred = deferredRead();
		const { fill, statuses } = setup({ read: deferred.read });
		const pending = fill.request();
		fill.cancel();
		deferred.reject(new WeatherError('network'));
		await pending;
		expect(statuses.at(-1)).toEqual({ state: 'idle' });
	});

	it('clears the done or error line on a change after it, and cancels on leaving Accurate', async () => {
		const { fill, statuses } = setup();
		await fill.request();
		fill.changed({ temperature: '9' });
		expect(statuses.at(-1)).toEqual({ state: 'idle' });

		const failing = setup({ read: vi.fn(async () => Promise.reject(new WeatherError('network'))) });
		await failing.fill.request();
		failing.fill.changed({ pressureRef: 'station' });
		expect(failing.statuses.at(-1)).toEqual({ state: 'idle' });

		const deferred = deferredRead();
		const leaving = setup({ read: deferred.read });
		const pending = leaving.fill.request();
		leaving.fill.changed({ humidity: '50' });
		expect(leaving.fill.status).toEqual({ state: 'loading' });
		leaving.fill.changed({ mode: 'isa' });
		expect(leaving.fill.status).toEqual({ state: 'idle' });
		deferred.resolve(reading);
		await pending;
		expect(leaving.apply).not.toHaveBeenCalled();
	});
});
