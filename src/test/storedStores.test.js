/**
 * The stores on damaged storage (#120): each case of the issue's table, read through the real
 * stores with localStore replaced by plain values. A store must import, give the page a usable
 * shape, and recover when the user changes a value, without storage being cleared.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';

const storage = vi.hoisted(() => ({ values: /** @type {Record<string, any>} */ ({}) }));

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

const throwsAsText = JSON.parse('{"toString":1}');

/** Import a store afresh on the given storage, so that its import-time migration runs on it. */
async function load(path, values) {
	vi.resetModules();
	storage.values = { ...values };
	return import(path);
}

/** Reading a value the way the pages do. None of this may throw. */
const readLikeThePage = (value) => `${value} ${parseFloat(/** @type {any} */ (value))}`;

const GOOD_PROFILE = {
	id: 'p1',
	name: 'Load',
	ammo: 'Ammo',
	optic: 'Optic',
	zeroDist: 100,
	zeroUnit: 'yd',
	velocity: '3000',
	velocityUnit: 'fps',
	reticleType: 'red-dot'
};

describe('zro-scope-view', () => {
	const scope = {
		range: { distance: '500', unit: 'yd' },
		elevation: { angle: '0', unit: 'deg' },
		atmosphere: { useISA: true, altitude: '0', altitudeUnit: 'ft', pressure: '29.92', pressureUnit: 'inhg', temperature: '59', temperatureUnit: 'f', humidity: '0' },
		wind: { speed: '0', speedUnit: 'mph', direction: '90' },
		rotation: 0
	};
	const load_ = (value) => load('#lib/stores/scopeView.svelte.js', { 'zro-scope-view': value });

	it.each([
		['wholly null', null],
		['text', 'x'],
		['range null', { ...scope, range: null }],
		['atmosphere null', { ...scope, atmosphere: null }],
		['elevation null', { ...scope, elevation: null }],
		['rotation an object', { ...scope, rotation: throwsAsText }],
		['range.distance an object', { ...scope, range: { distance: throwsAsText, unit: 'yd' } }],
		['an array', [scope]]
	])('imports and gives a usable shape with %s', async (_, value) => {
		const { scopeView } = await load_(value);
		expect(() => readLikeThePage(scopeView.range.distance)).not.toThrow();
		expect(['yd', 'm']).toContain(scopeView.range.unit);
		expect(() => readLikeThePage(scopeView.elevation.angle)).not.toThrow();
		expect(typeof scopeView.atmosphere.useISA).toBe('boolean');
		expect(() => readLikeThePage(scopeView.atmosphere.altitude)).not.toThrow();
		expect(Number.isFinite(scopeView.rotation)).toBe(true);
		expect(() => `rotate(${scopeView.rotation}, 200, 200)`).not.toThrow();
		expect(() => readLikeThePage(scopeView.wind.speed)).not.toThrow();
	});

	it.each([[true], [[1]], ['5'], [500]])('gives no cant for a stored rotation of %j', async (rotation) => {
		const { scopeView } = await load_({ ...scope, rotation });
		expect(scopeView.rotation).toBe(0);
	});

	it('shows a damaged range as an empty box, and recovers when the user sets one', async () => {
		const { scopeView } = await load_({ ...scope, range: null });
		expect(scopeView.range).toEqual({ distance: '', unit: 'yd' });
		scopeView.setRange({ distance: '300' });
		expect(scopeView.range).toEqual({ distance: '300', unit: 'yd' });
		expect(storage.values['zro-scope-view'].range).toEqual({ distance: '300', unit: 'yd' });
	});

	it('keeps the other fields when a damaged state is changed', async () => {
		const { scopeView } = await load_('x');
		scopeView.setRotation(5);
		scopeView.setAtmosphere({ useISA: true });
		expect(scopeView.rotation).toBe(5);
		expect(scopeView.atmosphere.useISA).toBe(true);
		expect(storage.values['zro-scope-view']).toMatchObject({ rotation: 5, atmosphere: { useISA: true } });
	});

	it('still migrates a stored clock wind', async () => {
		const { scopeView } = await load_({ ...scope, wind: { speed: '5', speedUnit: 'mph', direction: '3', directionUnit: 'clock' } });
		expect(scopeView.wind).toEqual({ speed: '5', speedUnit: 'mph', direction: '90' });
	});
});

describe('zro-ballistic', () => {
	const ISA = { useISA: true, altitude: '0', altitudeUnit: 'ft', pressure: '29.92', pressureUnit: 'inhg', temperature: '59', temperatureUnit: 'f', humidity: '0' };
	const options = {
		showAtmosphere: false,
		showWind: false,
		showVelocityChart: false,
		showAnnotations: true,
		visibleColumns: ['rangeYd', 'elevIn', 'elevMOA', 'velFps', 'energyFtlb', 'time'],
		velChartUnit: 'fps'
	};
	const ball = { range: { distance: '500', unit: 'yd', step: '25' }, atmosphere: ISA, wind: { speed: '0', speedUnit: 'mph', direction: '90' }, options };
	const load_ = (value) => load('#lib/stores/ballistic.svelte.js', { 'zro-ballistic': value });

	it.each([
		['wholly null', null],
		['text', 'x'],
		['range null', { ...ball, range: null }],
		['atmosphere null', { ...ball, atmosphere: null }],
		['options null', { ...ball, options: null }],
		['range.distance an object', { ...ball, range: { ...ball.range, distance: throwsAsText } }],
		['range.step an object', { ...ball, range: { ...ball.range, step: throwsAsText } }],
		['atmosphere.altitude an object', { ...ball, atmosphere: { ...ISA, useISA: false, altitude: throwsAsText } }],
		['visibleColumns a number', { ...ball, options: { ...options, visibleColumns: 5 } }]
	])('gives a usable shape with %s', async (_, value) => {
		const { ballistic } = await load_(value);
		expect(() => readLikeThePage(ballistic.range.distance)).not.toThrow();
		expect(() => readLikeThePage(ballistic.range.step)).not.toThrow();
		expect(() => readLikeThePage(ballistic.atmosphere.altitude)).not.toThrow();
		expect(typeof ballistic.atmosphere.useISA).toBe('boolean');
		expect(typeof ballistic.options.showWind).toBe('boolean');
		expect(() => ['time'].filter((id) => ballistic.options.visibleColumns.includes(id))).not.toThrow();
		ballistic.toggleColumn('time');
		expect(Array.isArray(storage.values['zro-ballistic'].options.visibleColumns)).toBe(true);
	});

	it('shows a damaged range as empty boxes, and keeps the step when the user sets the range', async () => {
		const { ballistic } = await load_({ ...ball, range: { distance: throwsAsText, unit: 'm', step: '50' } });
		expect(ballistic.range).toEqual({ distance: '', unit: 'm', step: '50' });
		ballistic.setRange({ distance: '400' });
		expect(ballistic.range).toEqual({ distance: '400', unit: 'm', step: '50' });
	});

	it('shows a damaged atmosphere as a custom one with empty boxes, until the standard one is chosen', async () => {
		const { ballistic } = await load_({ ...ball, atmosphere: null });
		expect(ballistic.atmosphere.useISA).toBe(false);
		expect(ballistic.atmosphere.altitude).toBe('');
		ballistic.setAtmosphere({ useISA: true });
		expect(ballistic.atmosphere).toEqual(ISA);
	});

	it('toggles a column on top of damaged columns', async () => {
		const { ballistic } = await load_({ ...ball, options: { ...options, visibleColumns: 5 } });
		ballistic.toggleColumn('time');
		expect(ballistic.options.visibleColumns).toEqual(options.visibleColumns.filter((c) => c !== 'time'));
	});
});

describe('zro-compare-traj', () => {
	const cmp = { entries: [], range: { distance: '500', unit: 'yd' }, yAxis: 'in' };
	const load_ = (value) => load('#lib/stores/compareTrajectories.svelte.js', { 'zro-compare-traj': value });

	it.each([
		['wholly null', null],
		['text', 'x'],
		['range null', { ...cmp, range: null }],
		['range text', { ...cmp, range: 'x' }],
		['range.distance an object', { ...cmp, range: { distance: throwsAsText, unit: 'yd' } }]
	])('gives a usable range with %s', async (_, value) => {
		const { compareTrajectories } = await load_(value);
		expect(compareTrajectories.range).toEqual({ distance: '', unit: 'yd' });
		expect(compareTrajectories.entries).toEqual([]);
		expect(compareTrajectories.yAxis).toBe('in');
		compareTrajectories.setRange({ distance: '300' });
		expect(compareTrajectories.range).toEqual({ distance: '300', unit: 'yd' });
	});
});

describe('zro-profiles', () => {
	const load_ = async (value, active = 'p1') => {
		const { profiles } = await load('#lib/stores/profiles.svelte.js', { 'zro-profiles': value, 'zro-active-profile': active });
		const { activeProfile } = await import('#lib/stores/activeProfile.svelte.js');
		return { profiles, activeProfile };
	};

	it.each([['null', null], ['an object', { a: 1 }], ['text', 'x'], ['a number', 5]])(
		'imports a list of %s as no profiles, and saving one writes a list',
		async (_, value) => {
			const { profiles, activeProfile } = await load_(value);
			expect(profiles.list).toEqual([]);
			expect(activeProfile.profile).toBeNull();
			expect(activeProfile.id).toBeNull();
			const id = profiles.add({ ...GOOD_PROFILE, id: undefined });
			expect(storage.values['zro-profiles']).toEqual([{ ...GOOD_PROFILE, id }]);
			expect(profiles.get(id).name).toBe('Load');
		}
	);

	it('imports a list with entries that are not profiles, and migrates the others', async () => {
		const old = { ...GOOD_PROFILE };
		delete old.reticleType;
		const { profiles, activeProfile } = await load_([null, 5, old]);
		expect(profiles.list).toHaveLength(1);
		expect(profiles.list[0]).toMatchObject({ reticleType: 'red-dot', elevationClickValue: '0.5', clickLink: true });
		expect(activeProfile.profile.id).toBe('p1');
	});

	it('updates and removes on a list with damaged entries', async () => {
		const { profiles } = await load_([null, GOOD_PROFILE, { ...GOOD_PROFILE, id: 'p2' }]);
		expect(profiles.update('p1', { name: 'New' })).toBe(true);
		expect(profiles.get('p1').name).toBe('New');
		expect(profiles.update('nope', { name: 'x' })).toBe(false);
		expect(profiles.remove('p2')).toBe(true);
		expect(profiles.remove('p2')).toBe(false);
		expect(storage.values['zro-profiles']).toEqual([{ ...GOOD_PROFILE, name: 'New' }]);
	});

	it('keeps a profile whose name, ammo or zero cannot become text, as stored, for the calculators', async () => {
		const damaged = { ...GOOD_PROFILE, name: throwsAsText, ammo: throwsAsText, zeroDist: throwsAsText };
		const { profiles, activeProfile } = await load_([damaged]);
		expect(profiles.get('p1')).toEqual(damaged);
		expect(activeProfile.profile).toEqual(damaged);
	});
});
