/**
 * The stores on damaged storage (#120): each case of the issue's table, read through the real
 * stores with localStore replaced by plain values. A store must import, give the page a usable
 * shape, and recover when the user changes a value, without storage being cleared.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';

const storage = vi.hoisted(() => ({ values: /** @type {Record<string, any>} */ ({}) }));

vi.mock('#lib/stores/localStore.svelte.js', () => ({
	localStore: (key, init, { seed = true } = {}) => ({
		get value() {
			if (!(key in storage.values)) {
				const value = typeof init === 'function' ? init() : init;
				// As the real store: without seed, a missing key is not written.
				if (!seed) return value;
				storage.values[key] = value;
			}
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

describe('zro-profiles ids read as text (#131)', () => {
	const load_ = async (value, active) => {
		const { profiles } = await load('#lib/stores/profiles.svelte.js', { 'zro-profiles': value, 'zro-active-profile': active });
		const { activeProfile } = await import('#lib/stores/activeProfile.svelte.js');
		return { profiles, activeProfile };
	};
	const second = { ...GOOD_PROFILE, id: 7, name: 'Seven' };

	it('opens a profile stored with a number id by the id in its URL', async () => {
		const { profiles } = await load_([GOOD_PROFILE, second], 'p1');
		expect(profiles.get('7')).toEqual({ ...second, id: '7' });
		expect(profiles.get(7)).toBeUndefined();
	});

	it('makes a profile stored with a number id active, also when it is not first', async () => {
		const { activeProfile } = await load_([GOOD_PROFILE, second], 'p1');
		expect(activeProfile.profile.id).toBe('p1');
		activeProfile.setActive('7');
		expect(activeProfile.id).toBe('7');
		expect(activeProfile.profile.name).toBe('Seven');
	});

	it.each([[7], ['7']])('reads the stored active id %j as the profile stored with the id 7', async (active) => {
		const { activeProfile } = await load_([GOOD_PROFILE, second], active);
		expect(activeProfile.id).toBe('7');
		expect(activeProfile.profile.name).toBe('Seven');
	});

	it.each([[{}], [['7']], [true]])('reads a damaged stored active id %j as the first profile', async (active) => {
		const { activeProfile } = await load_([GOOD_PROFILE, second], active);
		expect(activeProfile.id).toBe('p1');
		expect(activeProfile.profile.id).toBe('p1');
	});

	it('edits and deletes each of two profiles stored with the ids 1 and "1" on its own', async () => {
		const a = { ...GOOD_PROFILE, id: 1, name: 'A' };
		const b = { ...GOOD_PROFILE, id: '1', name: 'B' };
		const { profiles } = await load_([a, b], 1);
		expect(profiles.list.map((p) => [p.id, p.name])).toEqual([['1', 'A'], ['1-2', 'B']]);
		expect(profiles.update('1-2', { name: 'B2' })).toBe(true);
		expect(profiles.get('1').name).toBe('A');
		expect(storage.values['zro-profiles'].map((p) => p.id)).toEqual(['1', '1-2']);
		expect(profiles.remove('1')).toBe(true);
		expect(profiles.list.map((p) => [p.id, p.name])).toEqual([['1-2', 'B2']]);
	});

	it('migrates the click fields of a profile stored with a number id', async () => {
		const old = { ...GOOD_PROFILE, id: 3 };
		delete old.reticleType;
		const { profiles } = await load_([old], 3);
		expect(profiles.get('3')).toMatchObject({ reticleType: 'red-dot', elevationClickValue: '0.5', clickLink: true });
		expect(storage.values['zro-profiles'][0]).toMatchObject({ id: '3', reticleType: 'red-dot' });
	});
});

describe('zro-profiles ids that cannot be used in a link (#134)', () => {
	const load_ = async (value, active, extra = {}) => {
		const { profiles } = await load('#lib/stores/profiles.svelte.js', { 'zro-profiles': value, 'zro-active-profile': active, ...extra });
		const { activeProfile } = await import('#lib/stores/activeProfile.svelte.js');
		return { profiles, activeProfile };
	};
	const slash = { ...GOOD_PROFILE, id: 'a/b', name: 'Slash' };
	const empty = { ...GOOD_PROFILE, id: '', name: 'Empty' };
	const isNew = { ...GOOD_PROFILE, id: 'new', name: 'New' };

	it('opens, edits and deletes each renumbered profile by its new id', async () => {
		const { profiles } = await load_([GOOD_PROFILE, slash, empty, isNew], 'p1');
		expect(profiles.list.map((p) => p.id)).toEqual(['p1', 'a-b', 'profile', 'profile-2']);
		expect(profiles.get('a-b').name).toBe('Slash');
		expect(profiles.get('new')).toBeUndefined();
		expect(profiles.update('profile', { name: 'Was empty' })).toBe(true);
		expect(storage.values['zro-profiles'].map((p) => p.id)).toEqual(['p1', 'a-b', 'profile', 'profile-2']);
		expect(profiles.remove('profile-2')).toBe(true);
		expect(profiles.list.map((p) => [p.id, p.name])).toEqual([['p1', 'Load'], ['a-b', 'Slash'], ['profile', 'Was empty']]);
	});

	it.each([
		['a/b', 'a-b', 'Slash'],
		['', 'profile', 'Empty'],
		['new', 'profile-2', 'New']
	])('keeps the stored active id %j on its profile, under its new id', async (active, id, name) => {
		const { activeProfile } = await load_([GOOD_PROFILE, slash, empty, isNew], active);
		expect(activeProfile.id).toBe(id);
		expect(activeProfile.profile.name).toBe(name);
	});

	it('makes a renumbered profile active by its new id', async () => {
		const { activeProfile } = await load_([GOOD_PROFILE, slash], 'p1');
		activeProfile.setActive('a-b');
		expect(activeProfile.id).toBe('a-b');
		expect(activeProfile.profile.name).toBe('Slash');
	});

	describe('references survive any save (security review of #134)', () => {
		const x = { ...GOOD_PROFILE, id: 'x', name: 'Rifle X' };
		const ab = { ...GOOD_PROFILE, id: 'a/b', name: 'Rifle AB' };
		const entry = { id: 'e1', profileId: 'a/b', zeroDist: '100', zeroUnit: 'yd' };
		const other = { id: 'e2', profileId: 'x', zeroDist: '200', zeroUnit: 'yd' };
		const loadAll = async (active = 'a/b', compare = { entries: [entry, other], range: { distance: '500', unit: 'yd' }, yAxis: 'in' }) => {
			const { profiles } = await load('#lib/stores/profiles.svelte.js', {
				'zro-profiles': [x, ab],
				'zro-active-profile': active,
				'zro-compare-traj': compare
			});
			const { activeProfile } = await import('#lib/stores/activeProfile.svelte.js');
			const { compareTrajectories } = await import('#lib/stores/compareTrajectories.svelte.js');
			return { profiles, activeProfile, compareTrajectories };
		};
		const entryProfile = (profiles, compareTrajectories, id) =>
			profiles.findStored(compareTrajectories.entries.find((e) => e.id === id).profileId);

		it('writes the new ids and the references at load', async () => {
			await loadAll();
			expect(storage.values['zro-profiles'].map((p) => p.id)).toEqual(['x', 'a-b']);
			expect(storage.values['zro-active-profile']).toBe('a-b');
			expect(storage.values['zro-compare-traj'].entries.map((e) => e.profileId)).toEqual(['a-b', 'x']);
		});

		it.each([
			['edits another profile', (profiles) => profiles.update('x', { name: 'Rifle X2' })],
			['edits the profile itself', (profiles) => profiles.update('a-b', { velocity: '2900' })],
			['adds a profile', (profiles) => profiles.add({ ...GOOD_PROFILE, id: undefined, name: 'New' })],
			['removes another profile', (profiles) => profiles.remove('x')]
		])('keeps the active profile on Rifle AB when the user %s', async (_, change) => {
			const { profiles, activeProfile } = await loadAll();
			change(profiles);
			expect(activeProfile.id).toBe('a-b');
			expect(activeProfile.profile.name).toBe('Rifle AB');
		});

		it.each([
			['edits another profile', (profiles) => profiles.update('x', { name: 'Rifle X2' })],
			['adds a profile', (profiles) => profiles.add({ ...GOOD_PROFILE, id: undefined, name: 'New' })],
			['removes another profile', (profiles) => profiles.remove('x')]
		])('keeps the compare entry on Rifle AB when the user %s', async (_, change) => {
			const { profiles, compareTrajectories } = await loadAll();
			change(profiles);
			expect(entryProfile(profiles, compareTrajectories, 'e1').name).toBe('Rifle AB');
		});

		it('drops the compare entry only when its own profile is removed', async () => {
			const { profiles, compareTrajectories } = await loadAll();
			profiles.remove('a-b');
			expect(entryProfile(profiles, compareTrajectories, 'e1')).toBeUndefined();
			expect(entryProfile(profiles, compareTrajectories, 'e2').name).toBe('Rifle X');
		});

		it('keeps both references when the first session loads only the profiles store (/profiles/new)', async () => {
			// Session 1: only the profiles store loads, and writes the renumbered list.
			await load('#lib/stores/profiles.svelte.js', {
				'zro-profiles': [x, ab],
				'zro-active-profile': 'a/b',
				'zro-compare-traj': { entries: [entry, other], range: { distance: '500', unit: 'yd' }, yAxis: 'in' }
			});
			expect(storage.values['zro-profiles'].map((p) => p.id)).toEqual(['x', 'a-b']);
			// Session 2: a fresh start on the same storage, with no rename left to find.
			vi.resetModules();
			const { profiles } = await import('#lib/stores/profiles.svelte.js');
			const { activeProfile } = await import('#lib/stores/activeProfile.svelte.js');
			const { compareTrajectories } = await import('#lib/stores/compareTrajectories.svelte.js');
			expect(activeProfile.id).toBe('a-b');
			expect(activeProfile.profile.name).toBe('Rifle AB');
			expect(entryProfile(profiles, compareTrajectories, 'e1').name).toBe('Rifle AB');
			expect(entryProfile(profiles, compareTrajectories, 'e2').name).toBe('Rifle X');
		});

		it('keeps both references when the first session loads only the active profile', async () => {
			await load('#lib/stores/profiles.svelte.js', {
				'zro-profiles': [x, ab],
				'zro-active-profile': 'a/b',
				'zro-compare-traj': { entries: [entry], range: { distance: '500', unit: 'yd' }, yAxis: 'in' }
			});
			await import('#lib/stores/activeProfile.svelte.js');
			vi.resetModules();
			const { profiles } = await import('#lib/stores/profiles.svelte.js');
			const { compareTrajectories } = await import('#lib/stores/compareTrajectories.svelte.js');
			expect(entryProfile(profiles, compareTrajectories, 'e1').name).toBe('Rifle AB');
		});

		it('writes no reference key that was not stored', async () => {
			await load('#lib/stores/profiles.svelte.js', { 'zro-profiles': [x, ab] });
			expect('zro-active-profile' in storage.values).toBe(false);
			expect('zro-compare-traj' in storage.values).toBe(false);
		});

		it.each([
			['text', 'x'],
			['null', null],
			['entries not a list', { entries: 'a/b' }],
			['an array', [entry]]
		])('leaves a damaged compare state (%s) as stored', async (_, compare) => {
			await load('#lib/stores/profiles.svelte.js', { 'zro-profiles': [x, ab], 'zro-active-profile': 'a/b', 'zro-compare-traj': compare });
			expect(storage.values['zro-compare-traj']).toBe(compare);
			expect(storage.values['zro-active-profile']).toBe('a-b');
		});

		it.each([[{}], [['a/b']], [true]])('leaves a damaged active id %j as stored', async (active) => {
			await load('#lib/stores/profiles.svelte.js', { 'zro-profiles': [x, ab], 'zro-active-profile': active });
			expect(storage.values['zro-active-profile']).toBe(active);
		});

		it('rewrites the compare entries when the compare store loads first', async () => {
			storage.values = {
				'zro-profiles': [x, ab],
				'zro-compare-traj': { entries: [entry], range: { distance: '500', unit: 'yd' }, yAxis: 'in' }
			};
			vi.resetModules();
			const { compareTrajectories } = await import('#lib/stores/compareTrajectories.svelte.js');
			expect(compareTrajectories.entries[0].profileId).toBe('a-b');
			expect(storage.values['zro-profiles'].map((p) => p.id)).toEqual(['x', 'a-b']);
		});

		it('leaves damaged compare entries and other references as stored', async () => {
			const damaged = { id: 'e3', profileId: 5 };
			await loadAll('x', { entries: [damaged, entry, null], range: { distance: '500', unit: 'yd' }, yAxis: 'in' });
			expect(storage.values['zro-active-profile']).toBe('x');
			expect(storage.values['zro-compare-traj'].entries).toEqual([damaged, { ...entry, profileId: 'a-b' }, null]);
		});

		it('writes nothing when no id is renumbered', async () => {
			const list = [x, { ...GOOD_PROFILE, id: 'y' }];
			const compare = { entries: [{ ...entry, profileId: 'y' }], range: { distance: '500', unit: 'yd' }, yAxis: 'in' };
			await load('#lib/stores/profiles.svelte.js', { 'zro-profiles': list, 'zro-active-profile': 'y', 'zro-compare-traj': compare });
			await import('#lib/stores/activeProfile.svelte.js');
			await import('#lib/stores/compareTrajectories.svelte.js');
			expect(storage.values['zro-profiles']).toBe(list);
			expect(storage.values['zro-compare-traj']).toBe(compare);
			expect(storage.values['zro-active-profile']).toBe('y');
		});

		it.each([['a stored active id that is a number', 7, '7'], ['the second of two duplicates', '1', '1']])(
			'leaves %s as it was (#131)',
			async (_, active, id) => {
				const list = [{ ...GOOD_PROFILE, id: active === 7 ? 7 : '1', name: 'First' }, { ...GOOD_PROFILE, id: '1', name: 'Second' }];
				const { activeProfile } = await load_(list, active);
				expect(activeProfile.id).toBe(id);
				expect(activeProfile.profile.name).toBe('First');
			}
		);
	});
});

describe('zro-mpbr (#127)', () => {
	const good = { target: { size: '8', unit: 'in' } };
	const load_ = (value) => load('#lib/stores/mpbr.svelte.js', { 'zro-mpbr': value });

	it('reads good data as it is', async () => {
		const { mpbr } = await load_(good);
		expect(mpbr.target).toEqual(good.target);
		const { mpbr: metric } = await load_({ target: { size: 20, unit: 'cm' } });
		expect(metric.target).toEqual({ size: 20, unit: 'cm' });
	});

	it.each([
		['wholly null', null],
		['text', 'x'],
		['a number', 5],
		['an array', [good]],
		['target missing', {}],
		['target null', { target: null }],
		['target text', { target: 'x' }],
		['target an array', { target: ['8'] }],
		['size an object', { target: { size: throwsAsText, unit: 'in' } }],
		['size an array', { target: { size: ['8'], unit: 'in' } }],
		['size a boolean', { target: { size: true, unit: 'in' } }],
		['size null', { target: { size: null, unit: 'in' } }]
	])('shows an empty size with %s, and recovers when the user enters one', async (_, value) => {
		const { mpbr } = await load_(value);
		expect(mpbr.target).toEqual({ size: '', unit: 'in' });
		expect(() => readLikeThePage(mpbr.target.size)).not.toThrow();
		mpbr.setTarget({ size: '10' });
		expect(mpbr.target).toEqual({ size: '10', unit: 'in' });
		expect(storage.values['zro-mpbr'].target).toEqual({ size: '10', unit: 'in' });
	});

	it.each([[throwsAsText], [{}], ['mm'], [null], [['cm']]])('reads the unit %j as in', async (unit) => {
		const { mpbr } = await load_({ target: { size: '8', unit } });
		expect(mpbr.target).toEqual({ size: '8', unit: 'in' });
		mpbr.setTarget({ unit: 'cm' });
		expect(storage.values['zro-mpbr'].target).toEqual({ size: '8', unit: 'cm' });
	});
});

describe('zro-traj-validation (#127)', () => {
	const ISA = { useISA: true, altitude: '0', altitudeUnit: 'ft', pressure: '29.92', pressureUnit: 'inhg', temperature: '59', temperatureUnit: 'f', humidity: '0' };
	const measure = { type: 'angle', direction: 'below', distanceValue: '0', distanceUnit: 'in', angleValue: '2', angleUnit: 'moa' };
	const good = { range: { distance: '300', unit: 'yd' }, measure, solveFor: 'velocity', atmosphere: ISA };
	const EMPTY_MEASURE = { type: 'angle', direction: 'below', distanceValue: '', distanceUnit: 'in', angleValue: '', angleUnit: 'moa' };
	const load_ = (value) => load('#lib/stores/trajectoryValidation.svelte.js', { 'zro-traj-validation': value });

	it('reads good data as it is', async () => {
		const { trajectoryValidation: tv } = await load_(good);
		expect(tv.range).toEqual(good.range);
		expect(tv.measure).toEqual(measure);
		expect(tv.direction).toBe('below');
		expect(tv.solveFor).toBe('velocity');
		expect(tv.atmosphere).toEqual(ISA);
	});

	it.each([
		['wholly null', null],
		['text', 'x'],
		['a number', 5],
		['an array', [good]]
	])('reads a store of %s as empty sections, and the standard atmosphere, as a missing one was', async (_, value) => {
		const { trajectoryValidation: tv } = await load_(value);
		expect(tv.range).toEqual({ distance: '', unit: 'yd' });
		expect(tv.measure).toEqual(EMPTY_MEASURE);
		expect(tv.solveFor).toBe('velocity');
		expect(tv.atmosphere).toEqual(ISA);
	});

	it.each([
		['range null', { ...good, range: null }, 'range', { distance: '', unit: 'yd' }],
		['range text', { ...good, range: 'x' }, 'range', { distance: '', unit: 'yd' }],
		['range.distance an object', { ...good, range: { distance: throwsAsText, unit: 'm' } }, 'range', { distance: '', unit: 'm' }],
		['range.distance an array', { ...good, range: { distance: ['300'], unit: 'yd' } }, 'range', { distance: '', unit: 'yd' }],
		['measure null', { ...good, measure: null }, 'measure', EMPTY_MEASURE],
		['measure text', { ...good, measure: 'x' }, 'measure', EMPTY_MEASURE],
		['measure missing', { ...good, measure: undefined }, 'measure', EMPTY_MEASURE],
		['measure.angleValue an object', { ...good, measure: { ...measure, angleValue: throwsAsText } }, 'measure', { ...measure, angleValue: '' }],
		['measure.angleValue an array', { ...good, measure: { ...measure, angleValue: ['2'] } }, 'measure', { ...measure, angleValue: '' }],
		['measure.type an object', { ...good, measure: { ...measure, type: {} } }, 'measure', measure],
		['measure.type unknown', { ...good, measure: { ...measure, type: 'foo' } }, 'measure', measure],
		['measure.angleUnit an object', { ...good, measure: { ...measure, angleUnit: {} } }, 'measure', measure],
		['measure.direction an object', { ...good, measure: { ...measure, direction: {} } }, 'measure', measure],
		['atmosphere text', { ...good, atmosphere: 'x' }, 'atmosphere', { useISA: false, altitude: '', altitudeUnit: 'ft', pressure: '', pressureUnit: 'inhg', temperature: '', temperatureUnit: 'f', humidity: '' }],
		['atmosphere.pressure an array', { ...good, atmosphere: { ...ISA, useISA: false, pressure: ['29.92'] } }, 'atmosphere', { ...ISA, useISA: false, pressure: '' }],
		['atmosphere null, read as the standard one as before', { ...good, atmosphere: null }, 'atmosphere', ISA],
		['solveFor an object', { ...good, solveFor: {} }, 'solveFor', 'velocity'],
		['solveFor unknown', { ...good, solveFor: 'x' }, 'solveFor', 'velocity'],
		['solveFor null', { ...good, solveFor: null }, 'solveFor', 'velocity']
	])('reads %s as a usable value', async (_, value, field, expected) => {
		const { trajectoryValidation: tv } = await load_(value);
		expect(tv[field]).toEqual(expected);
		expect(() => readLikeThePage(tv.range.distance)).not.toThrow();
		expect(() => readLikeThePage(tv.measure.angleValue)).not.toThrow();
		expect(() => readLikeThePage(tv.atmosphere.altitude)).not.toThrow();
	});

	it('recovers when the user enters values, also on a store of text', async () => {
		const { trajectoryValidation: tv } = await load_('x');
		tv.setRange({ distance: '300' });
		tv.setMeasure({ angleValue: '2' });
		tv.setSolveFor('bc');
		expect(storage.values['zro-traj-validation']).toEqual({
			range: { distance: '300', unit: 'yd' },
			measure: { ...EMPTY_MEASURE, angleValue: '2' },
			solveFor: 'bc'
		});
		expect(tv.atmosphere).toEqual(ISA);
	});

	it('keeps the other sections when one damaged section is set', async () => {
		const { trajectoryValidation: tv } = await load_({ ...good, measure: null });
		tv.setMeasure({ type: 'distance', distanceValue: '4' });
		expect(tv.measure).toEqual({ ...EMPTY_MEASURE, type: 'distance', distanceValue: '4' });
		expect(tv.range).toEqual(good.range);
		expect(storage.values['zro-traj-validation'].atmosphere).toEqual(ISA);
	});

	it('restores the standard atmosphere over a damaged one, and turns it off with its values', async () => {
		const { trajectoryValidation: tv } = await load_({ ...good, atmosphere: 'x' });
		tv.setAtmosphere({ useISA: true });
		expect(tv.atmosphere).toEqual(ISA);
		tv.setAtmosphere({ useISA: false });
		expect(tv.atmosphere).toEqual({ ...ISA, useISA: false });
	});
});
