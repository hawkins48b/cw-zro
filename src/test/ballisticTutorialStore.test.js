/**
 * The 3D tutorial's own store, zro-ballistic-tutorial (#182): defaults (units of the profile in
 * use, quality of the device), damaged storage (#120 rules), the wind migration of #106, and the
 * API the shared wind and atmosphere cards and useCurrentWeather use, as on the Scope View store.
 */
import { describe, it, expect, vi, afterEach } from 'vitest';

const storage = vi.hoisted(() => ({ values: /** @type {Record<string, any>} */ ({}) }));
const profile = vi.hoisted(() => ({ value: /** @type {any} */ (null) }));

vi.mock('#lib/stores/localStore.svelte.js', () => ({
	localStore: (key, init) => ({
		get value() {
			if (!(key in storage.values)) storage.values[key] = typeof init === 'function' ? init() : init;
			return storage.values[key];
		},
		set value(v) {
			storage.values[key] = v;
		},
		persist() {}
	})
}));

vi.mock('#lib/stores/activeProfile.svelte.js', () => ({
	activeProfile: {
		get profile() {
			return profile.value;
		}
	}
}));

const KEY = 'zro-ballistic-tutorial';
const throwsAsText = JSON.parse('{"toString":1}');

async function load(value, { zeroUnit = 'm' } = {}) {
	vi.resetModules();
	profile.value = zeroUnit ? { zeroUnit } : null;
	storage.values = value === undefined ? {} : { [KEY]: value };
	return (await import('#lib/stores/ballisticTutorial.svelte.js')).ballisticTutorial;
}

afterEach(() => {
	vi.unstubAllGlobals();
});

describe('zro-ballistic-tutorial defaults', () => {
	it('stores 300 m, flat terrain in metres, ISA, no wind in m/s, sunny, on a first visit with a metric profile', async () => {
		const tutorial = await load(undefined, { zeroUnit: 'm' });
		expect(tutorial.range).toEqual({ distance: '300', unit: 'm' });
		expect(tutorial.terrain).toEqual({ altitude: '0', elevation: '0', unit: 'm' });
		expect(tutorial.atmosphere).toMatchObject({ mode: 'isa', useISA: true });
		expect(tutorial.wind).toEqual({ speed: '0', speedUnit: 'mps', direction: '90' });
		expect(tutorial.weather).toBe('sunny');
		// jsdom: no coarse pointer, no Capacitor.
		expect(tutorial.quality).toBe('medium');
		expect(storage.values[KEY]).toMatchObject({ range: { distance: '300', unit: 'm' }, quality: 'medium' });
	});

	it('uses yards, feet and mph with a profile zeroed in yards', async () => {
		const tutorial = await load(undefined, { zeroUnit: 'yd' });
		expect(tutorial.range).toEqual({ distance: '300', unit: 'yd' });
		expect(tutorial.terrain.unit).toBe('ft');
		expect(tutorial.wind.speedUnit).toBe('mph');
	});

	it('uses metres without a profile', async () => {
		const tutorial = await load(undefined, { zeroUnit: null });
		expect(tutorial.range.unit).toBe('m');
	});

	it('starts in Low quality on a phone, and remembers it', async () => {
		vi.stubGlobal('matchMedia', (query) => ({ matches: query === '(pointer: coarse)' }));
		vi.stubGlobal('innerWidth', 390);
		expect((await load(undefined)).quality).toBe('low');
		expect(storage.values[KEY].quality).toBe('low');
	});

	it('keeps a quality chosen before, on any device', async () => {
		vi.stubGlobal('matchMedia', (query) => ({ matches: query === '(pointer: coarse)' }));
		vi.stubGlobal('innerWidth', 390);
		expect((await load({ quality: 'high' })).quality).toBe('high');
	});
});

describe('zro-ballistic-tutorial on damaged storage', () => {
	it.each([
		['wholly null', null],
		['text', 'x'],
		['an array', [{}]],
		['range null', { range: null }],
		['terrain an object that throws as text', { terrain: { altitude: throwsAsText, elevation: [], unit: 1 } }],
		['range.distance an object', { range: { distance: throwsAsText, unit: 'm' } }],
		['atmosphere null', { atmosphere: null }],
		['wind text', { wind: 'x' }]
	])('imports and gives a usable shape with %s', async (_, value) => {
		const tutorial = await load(value);
		const read = (v) => `${v} ${parseFloat(/** @type {any} */ (v))}`;
		expect(() => read(tutorial.range.distance)).not.toThrow();
		expect(['m', 'yd']).toContain(tutorial.range.unit);
		expect(() => read(tutorial.terrain.altitude)).not.toThrow();
		expect(() => read(tutorial.terrain.elevation)).not.toThrow();
		expect(['m', 'ft']).toContain(tutorial.terrain.unit);
		expect(typeof tutorial.atmosphere.useISA).toBe('boolean');
		expect(() => read(tutorial.wind.speed)).not.toThrow();
		expect(['sunny', 'cloudy', 'rain', 'snow']).toContain(tutorial.weather);
		expect(['low', 'medium', 'high']).toContain(tutorial.quality);
	});

	it('reads a damaged distance as an empty box, and recovers when the user sets one', async () => {
		const tutorial = await load({ range: { distance: throwsAsText, unit: 'm' } });
		expect(tutorial.range).toEqual({ distance: '', unit: 'm' });
		tutorial.setRange({ distance: '450' });
		expect(storage.values[KEY].range).toEqual({ distance: '450', unit: 'm' });
	});

	it.each([['fog'], [null], [1], [['rain']]])('reads a stored weather of %j as sunny', async (weather) => {
		expect((await load({ weather })).weather).toBe('sunny');
	});

	it.each([['ultra'], [null], [2], [['high']]])('reads a stored quality of %j as the device default', async (quality) => {
		expect((await load({ quality })).quality).toBe('medium');
	});

	it('gives the calculators the wind as stored, and the page a usable one', async () => {
		const wind = { speed: throwsAsText, speedUnit: 'mps', direction: '45', directionConvention: 'from-target' };
		const tutorial = await load({ wind });
		expect(tutorial.storedWind).toBe(storage.values[KEY].wind);
		expect(tutorial.wind).toEqual({ speed: '', speedUnit: 'mps', direction: '45' });
	});

	it('converts a wind stored without the from-target marker once (#106)', async () => {
		const tutorial = await load({ wind: { speed: '5', speedUnit: 'mph', direction: '90' } });
		expect(tutorial.wind.direction).toBe('270');
		expect(storage.values[KEY].wind.directionConvention).toBe('from-target');
		const again = await load(storage.values[KEY]);
		expect(again.wind.direction).toBe('270');
	});
});

describe('zro-ballistic-tutorial changes', () => {
	it('keeps the other fields on each change', async () => {
		const tutorial = await load(undefined);
		tutorial.setTerrain({ elevation: '40' });
		tutorial.setRange({ unit: 'yd' });
		tutorial.setWeather('rain');
		tutorial.setQuality('high');
		tutorial.setWind({ speed: '4' });
		expect(storage.values[KEY]).toMatchObject({
			range: { distance: '300', unit: 'yd' },
			terrain: { altitude: '0', elevation: '40', unit: 'm' },
			weather: 'rain',
			quality: 'high',
			wind: { speed: '4', speedUnit: 'mps', direction: '90', directionConvention: 'from-target' }
		});
	});

	it('refuses a weather or quality that is not one', async () => {
		const tutorial = await load({ weather: 'snow', quality: 'high' });
		tutorial.setWeather('hail');
		tutorial.setQuality('ultra');
		expect(tutorial.weather).toBe('sunny');
		expect(tutorial.quality).toBe('high');
	});

	it('changes the atmosphere as the Scope View does, and resets it', async () => {
		const tutorial = await load(undefined);
		tutorial.setAtmosphere({ mode: 'accurate', pressureRef: 'station', temperature: '20' });
		expect(tutorial.atmosphere).toMatchObject({ mode: 'accurate', useISA: false, temperature: '20' });
		tutorial.resetAtmosphere();
		expect(tutorial.atmosphere).toMatchObject({ mode: 'isa', useISA: true });
	});

	it('sets a wind preset in the unit shown and keeps the direction', async () => {
		const tutorial = await load({ wind: { speed: '12', speedUnit: 'mps', direction: '45', directionConvention: 'from-target' } });
		expect(tutorial.windPreset).toBeNull();
		tutorial.applyWindPreset('strong');
		expect(tutorial.wind).toEqual({ speed: '9', speedUnit: 'mps', direction: '45' });
		expect(tutorial.windPreset).toBe('strong');
		tutorial.applyWindPreset('gale');
		expect(tutorial.wind.speed).toBe('9');
	});

	it('does not touch the Scope View or Ballistic keys', async () => {
		const tutorial = await load(undefined);
		tutorial.setRange({ distance: '500' });
		expect(Object.keys(storage.values)).toEqual([KEY]);
	});
});
