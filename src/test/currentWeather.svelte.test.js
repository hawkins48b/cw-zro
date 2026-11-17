import { flushSync, mount, unmount } from 'svelte';
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { SAMPLE_PROFILE } from '#lib/utils/sampleProfile.js';
import { WEATHER_ENDPOINT } from '#lib/utils/currentWeather.js';

// "Use current weather here" (#152), on the card and on the two pages that show it, mounted in
// jsdom (the `components` Vitest project, Svelte's client build). fetch and geolocation are spies:
// nothing reaches the network or a real location.

const METRIC_ACCURATE = {
	useISA: false,
	mode: 'accurate',
	weather: 'sunny',
	pressureRef: 'station',
	altitude: '100',
	altitudeUnit: 'm',
	pressure: '990',
	pressureUnit: 'hpa',
	temperature: '20',
	temperatureUnit: 'c',
	humidity: '40'
};

const ANSWER = {
	elevation: 512,
	current_units: { temperature_2m: '°C', relative_humidity_2m: '%', pressure_msl: 'hPa' },
	current: { temperature_2m: 8.4, relative_humidity_2m: 71, pressure_msl: 1018.6 }
};

// Live-API shapes (#154, probed 2026-11-16) for models=meteoswiss_icon_ch1,best_match: inside the
// ICON-CH1 area the hourly keys carry the model suffix; outside they are plain.
const UNITS = { temperature_2m: '°C', relative_humidity_2m: '%', pressure_msl: 'hPa' };
const BERN = {
	elevation: 511,
	current_units: UNITS,
	current: { temperature_2m: 8.1, relative_humidity_2m: 88, pressure_msl: 1009.0 },
	hourly: {
		time: ['2026-11-16T23:00'],
		temperature_2m_meteoswiss_icon_ch1: [8.1],
		relative_humidity_2m_meteoswiss_icon_ch1: [88],
		pressure_msl_meteoswiss_icon_ch1: [1009.0],
		temperature_2m_best_match: [8.6],
		relative_humidity_2m_best_match: [84],
		pressure_msl_best_match: [1008.8]
	}
};
const BERLIN = {
	elevation: 30,
	current_units: UNITS,
	current: { temperature_2m: 7.9, relative_humidity_2m: 73, pressure_msl: 999.9 },
	hourly: { time: ['2026-11-16T23:00'], temperature_2m: [7.9], relative_humidity_2m: [73], pressure_msl: [999.9] }
};
const ERROR_ANSWER = { error: true, reason: 'No data is available for this location' };

const METEOSWISS = 'a[href="https://www.meteoswiss.admin.ch/"]';

const BUTTON = 'Use current weather here';

let fetchSpy;
let geolocation;
let target;
let component;

/** A geolocation spy that answers with this position, or fails with this code. */
function setGeolocation({ altitude = 498.7, code, hold = false } = {}) {
	const calls = [];
	geolocation = {
		getCurrentPosition: vi.fn((success, failure) => {
			calls.push({ success, failure });
			if (hold) return;
			if (code !== undefined) failure({ code });
			else success({ coords: { latitude: 46.2276, longitude: 7.3594, altitude } });
		})
	};
	Object.defineProperty(window.navigator, 'geolocation', { value: geolocation, configurable: true });
	return calls;
}

function setUserAgent(value) {
	Object.defineProperty(window.navigator, 'userAgent', { value, configurable: true });
}

const buttonsNamed = (name) => [...target.querySelectorAll('button')].filter((b) => b.textContent.trim() === name);
const stored = (key) => JSON.parse(localStorage.getItem(key)).atmosphere;

function render(Component, props = {}) {
	component = mount(Component, { target, props });
	flushSync();
}

beforeAll(() => {
	window.matchMedia = () => ({ matches: false, addEventListener() {}, removeEventListener() {} });
	localStorage.setItem('zro-profiles', JSON.stringify([{ ...SAMPLE_PROFILE, id: 'p1' }]));
	localStorage.setItem('zro-active-profile', JSON.stringify('p1'));
});

beforeEach(() => {
	fetchSpy = vi.fn(async () => ({ ok: true, json: async () => ANSWER }));
	window.fetch = fetchSpy;
	setGeolocation();
	setUserAgent('Mozilla/5.0 (Linux; Android 15) AppleWebKit/537.36 Chrome/142 Mobile Safari/537.36');
	target = document.createElement('div');
	document.body.append(target);
});

afterEach(() => {
	if (component) unmount(component);
	component = null;
	target.remove();
});

describe('ScopeAtmosphereCard', () => {
	let Card;
	beforeAll(async () => {
		Card = (await import('#lib/components/ScopeAtmosphereCard.svelte')).default;
	});

	const props = (extra) => ({ atmosphere: { ...METRIC_ACCURATE }, onchange() {}, onweather: vi.fn(), ...extra });

	it('shows the button only when available and in the Accurate mode', () => {
		render(Card, props({ weatherAvailable: false }));
		expect(buttonsNamed(BUTTON)).toHaveLength(0);
		unmount(component);
		for (const mode of ['isa', 'estimate']) {
			render(Card, props({ weatherAvailable: true, atmosphere: { ...METRIC_ACCURATE, mode } }));
			expect(buttonsNamed(BUTTON)).toHaveLength(0);
			unmount(component);
		}
		render(Card, props({ weatherAvailable: true }));
		expect(buttonsNamed(BUTTON)).toHaveLength(1);
	});

	it('calls onweather only on a tap', () => {
		const p = props({ weatherAvailable: true });
		render(Card, p);
		expect(p.onweather).not.toHaveBeenCalled();
		buttonsNamed(BUTTON)[0].click();
		expect(p.onweather).toHaveBeenCalledOnce();
	});

	it('disables the button while loading, shows the error and the attribution after a fill', () => {
		render(Card, props({ weatherAvailable: true, weatherStatus: { state: 'loading' } }));
		expect(buttonsNamed('Getting weather…')[0].disabled).toBe(true);
		unmount(component);
		render(Card, props({ weatherAvailable: true, weatherStatus: { state: 'error', error: 'denied' } }));
		expect(target.textContent).toContain('Location access is off');
		unmount(component);
		render(Card, props({ weatherAvailable: true, weatherStatus: { state: 'done', time: '14:05' } }));
		expect(target.textContent).toContain('Filled from current weather at 14:05');
		const link = target.querySelector('a[href="https://open-meteo.com/"]');
		expect(link.target).toBe('_blank');
		expect(target.querySelector(METEOSWISS)).toBeNull();
		expect(target.textContent).not.toContain('MeteoSwiss');
	});

	it('credits MeteoSwiss and names ICON-CH1 after an ICON-CH1 fill, next to Open-Meteo', () => {
		render(Card, props({ weatherAvailable: true, weatherStatus: { state: 'done', time: '14:05', model: 'meteoswiss_icon_ch1' } }));
		const line = target.querySelector('a[href="https://open-meteo.com/"]').parentElement;
		expect(line.textContent.replace(/\s+/g, ' ')).toContain(
			'Weather data: Open-Meteo.com (opens in a new window), Source: MeteoSwiss (ICON-CH1 model) (opens in a new window)'
		);
		const link = target.querySelector(METEOSWISS);
		expect(link.target).toBe('_blank');
		expect(link.rel).toBe('noopener noreferrer');
		unmount(component);
		render(Card, props({ weatherAvailable: true, weatherStatus: { state: 'done', time: '14:05', model: 'best_match' } }));
		expect(target.querySelector(METEOSWISS)).toBeNull();
	});
});

for (const [name, path, key] of [
	['Scope View', '../routes/scope-view/+page.svelte', 'zro-scope-view'],
	['Ballistic page', '../routes/calculators/ballistic/+page.svelte', 'zro-ballistic']
]) {
	describe(name, () => {
		let Page;
		let store;
		beforeAll(async () => {
			Page = (await import(path)).default;
			const module =
				key === 'zro-scope-view'
					? await import('#lib/stores/scopeView.svelte.js')
					: await import('#lib/stores/ballistic.svelte.js');
			store = module.scopeView ?? module.ballistic;
		}, 60_000);

		beforeEach(() => {
			store.setAtmosphere({ ...METRIC_ACCURATE });
		});

		it('asks for no location and sends nothing when it opens', () => {
			render(Page);
			expect(buttonsNamed(BUTTON)).toHaveLength(1);
			expect(geolocation.getCurrentPosition).not.toHaveBeenCalled();
			expect(fetchSpy).not.toHaveBeenCalled();
		});

		it('fills the four boxes as QNH on a tap, from the rounded position only', async () => {
			render(Page);
			buttonsNamed(BUTTON)[0].click();
			await vi.waitFor(() => expect(target.textContent).toContain('Filled from current weather at'));
			expect(geolocation.getCurrentPosition).toHaveBeenCalledOnce();
			expect(fetchSpy).toHaveBeenCalledOnce();
			expect(fetchSpy.mock.calls[0][0]).toBe(
				`${WEATHER_ENDPOINT}?latitude=46.23&longitude=7.36` +
					'&current=temperature_2m,relative_humidity_2m,pressure_msl' +
					'&hourly=temperature_2m,relative_humidity_2m,pressure_msl' +
					'&models=meteoswiss_icon_ch1,best_match&forecast_hours=1'
			);
			// An answer without an hourly block is the default model: no MeteoSwiss credit.
			expect(target.querySelector(METEOSWISS)).toBeNull();
			expect(stored(key)).toMatchObject({
				mode: 'accurate',
				pressureRef: 'qnh',
				altitude: '499',
				pressure: '1018.6',
				temperature: '8.4',
				humidity: '71',
				altitudeUnit: 'm',
				pressureUnit: 'hpa',
				temperatureUnit: 'c'
			});
			flushSync();
			expect([...target.querySelectorAll('input')].map((i) => i.value)).toEqual(
				expect.arrayContaining(['1018.6', '499', '8.4', '71'])
			);
		});

		it('credits MeteoSwiss ICON-CH1 for a Bern-shaped answer', async () => {
			window.fetch = vi.fn(async () => ({ ok: true, json: async () => BERN }));
			render(Page);
			buttonsNamed(BUTTON)[0].click();
			await vi.waitFor(() => expect(target.textContent).toContain('Filled from current weather at'));
			expect(target.querySelector(METEOSWISS)).not.toBeNull();
			expect(target.textContent).toContain('Source: MeteoSwiss (ICON-CH1 model)');
			expect(stored(key)).toMatchObject({ pressure: '1009', temperature: '8.1', humidity: '88', altitude: '499' });
		});

		it('names only Open-Meteo for a Berlin-shaped answer', async () => {
			window.fetch = vi.fn(async () => ({ ok: true, json: async () => BERLIN }));
			render(Page);
			buttonsNamed(BUTTON)[0].click();
			await vi.waitFor(() => expect(target.textContent).toContain('Filled from current weather at'));
			expect(target.querySelector('a[href="https://open-meteo.com/"]')).not.toBeNull();
			expect(target.querySelector(METEOSWISS)).toBeNull();
			expect(stored(key)).toMatchObject({ pressure: '999.9', temperature: '7.9', humidity: '73' });
		});

		it('still fills, as the default, when the ICON-CH1 hourly values are null or odd', async () => {
			const hourly = { ...BERN.hourly, pressure_msl_meteoswiss_icon_ch1: [null], temperature_2m_meteoswiss_icon_ch1: 'x' };
			window.fetch = vi.fn(async () => ({ ok: true, json: async () => ({ ...BERN, hourly }) }));
			render(Page);
			buttonsNamed(BUTTON)[0].click();
			await vi.waitFor(() => expect(target.textContent).toContain('Filled from current weather at'));
			expect(target.querySelector(METEOSWISS)).toBeNull();
			expect(stored(key)).toMatchObject({ pressure: '1009', temperature: '8.1', humidity: '88' });
		});

		it('leaves the boxes unchanged on an error answer', async () => {
			window.fetch = vi.fn(async () => ({ ok: true, json: async () => ERROR_ANSWER }));
			render(Page);
			buttonsNamed(BUTTON)[0].click();
			await vi.waitFor(() => expect(target.textContent).toContain('The weather service gave no usable values'));
			expect(stored(key)).toMatchObject(METRIC_ACCURATE);
			window.fetch = vi.fn(async () => ({ ok: false, status: 400, json: async () => ERROR_ANSWER }));
			buttonsNamed(BUTTON)[0].click();
			await vi.waitFor(() => expect(target.textContent).toContain('The weather service could not be reached'));
			expect(stored(key)).toMatchObject(METRIC_ACCURATE);
		});

		it('leaves the boxes unchanged and shows why when the location is refused', async () => {
			setGeolocation({ code: 1 });
			render(Page);
			buttonsNamed(BUTTON)[0].click();
			await vi.waitFor(() => expect(target.textContent).toContain('Location access is off'));
			expect(fetchSpy).not.toHaveBeenCalled();
			expect(stored(key)).toMatchObject(METRIC_ACCURATE);
		});

		it('leaves the boxes unchanged when offline', async () => {
			window.fetch = vi.fn(async () => Promise.reject(new TypeError('Failed to fetch')));
			render(Page);
			buttonsNamed(BUTTON)[0].click();
			await vi.waitFor(() => expect(target.textContent).toContain('The weather service could not be reached'));
			expect(stored(key)).toMatchObject(METRIC_ACCURATE);
		});

		it('writes nothing when the page is left before the answer', async () => {
			const calls = setGeolocation({ hold: true });
			render(Page);
			buttonsNamed(BUTTON)[0].click();
			flushSync();
			expect(buttonsNamed('Getting weather…')).toHaveLength(1);
			unmount(component);
			component = null;
			calls[0].success({ coords: { latitude: 46.2, longitude: 7.3, altitude: 500 } });
			await new Promise((resolve) => setTimeout(resolve, 0));
			expect(fetchSpy).not.toHaveBeenCalled();
			expect(stored(key)).toMatchObject(METRIC_ACCURATE);
		});

		it('writes nothing when the mode changes before the answer', async () => {
			const calls = setGeolocation({ hold: true });
			render(Page);
			buttonsNamed(BUTTON)[0].click();
			flushSync();
			store.setAtmosphere({ mode: 'estimate' });
			flushSync();
			calls[0].success({ coords: { latitude: 46.2, longitude: 7.3, altitude: 500 } });
			await new Promise((resolve) => setTimeout(resolve, 0));
			expect(fetchSpy).not.toHaveBeenCalled();
			expect(stored(key)).toMatchObject({ ...METRIC_ACCURATE, mode: 'estimate' });
		});

		it('hides the button on the desktop build', () => {
			setUserAgent('Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 zro/2.0.0 Chrome/142 Electron/45.2.3 Safari/537.36');
			render(Page);
			expect(buttonsNamed(BUTTON)).toHaveLength(0);
		});

		it('hides the button without geolocation', () => {
			Object.defineProperty(window.navigator, 'geolocation', { value: undefined, configurable: true });
			render(Page);
			expect(buttonsNamed(BUTTON)).toHaveLength(0);
		});
	});
}
