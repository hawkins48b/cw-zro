/**
 * Stored profile list (#120). A list that is not a list, or an entry that is not a profile, threw
 * on every route; a name, ammo or zero distance that cannot become text threw on the profile, compare
 * and edit pages. The calculators keep the stored profile, so shownProfile must not change a result.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { Unit } from 'js-ballistics';
import { Calculator } from '#lib/utils/ballisticEngine.js';
import fs, { readdirSync } from 'node:fs';
import path, { join } from 'node:path';
import {
	MAX_AMMO_LENGTH,
	MAX_NAME_LENGTH,
	UNUSABLE_IDS,
	cutText,
	findProfileIdRenames,
	normalizeProfiles,
	renameActiveProfileId,
	renameCompareEntries,
	profileForStoredId,
	shownProfile,
	storedProfileId
} from '#lib/utils/storedProfiles.js';
import { duplicateProfile } from '#lib/utils/profileOps.js';
import { calculateShotPoint } from '#lib/utils/ballisticCalculator.js';
import { isUsableZeroDistance } from '#lib/utils/zeroDistance.js';
import { readDecimal } from '#lib/utils/decimal.js';
import { P223_G1 } from './fixtures/ballisticProfiles.js';

const throwsAsText = JSON.parse('{"toString":1}');

/** The app's default profile, as profiles.svelte.js seeds it. */
const DEFAULT_PROFILE = {
	id: 'p1',
	name: 'Example Colt M4',
	barrelTwist: '',
	barrelTwistUnit: 'in',
	opticName: 'Aimpoint CompM2',
	opticHeight: '3.5',
	opticHeightUnit: 'in',
	zeroDist: 25,
	zeroUnit: 'yd',
	bulletBrand: 'M193',
	bulletDiameter: '0.223',
	bulletDiameterUnit: 'in',
	bulletWeight: '55',
	bulletWeightUnit: 'gr',
	bcType: 'G1',
	bc: '0.285',
	bulletLength: '',
	bulletLengthUnit: 'in',
	velocity: '3000',
	velocityUnit: 'fps',
	temperature: '59',
	temperatureUnit: 'f',
	tempModifier: '',
	spinDrift: false,
	tempSensitivity: false,
	reticleType: 'red-dot',
	elevationClickValue: '0.5',
	elevationClickUnit: 'MOA',
	windageClickValue: '0.5',
	windageClickUnit: 'MOA',
	clickLink: true,
	ammo: 'M193 55 gr',
	optic: 'Aimpoint CompM2'
};

const DAMAGED_VALUES = [
	['null', null],
	['an object', {}],
	['an object that cannot become text', throwsAsText],
	['an array', ['100']],
	['a boolean', true]
];

/** Reading a profile the way the list, compare and edit pages do. None of this may throw. */
function readLikeThePages(profile) {
	profile.name.localeCompare(profile.name);
	profile.ammo.localeCompare(profile.ammo);
	profile.name.toLowerCase().includes('x');
	profile.ammo.toLowerCase().includes('x');
	profile.reticleType.toUpperCase();
	String(profile.zeroDist);
	return `${profile.name} ${profile.ammo} ${profile.optic} ${profile.zeroDist} ${profile.velocity} ${profile.reticleType}`;
}

describe('normalizeProfiles', () => {
	it('keeps a good list, with the same profiles', () => {
		const list = [DEFAULT_PROFILE, { ...P223_G1, id: 'p2' }];
		const read = normalizeProfiles(list);
		expect(read).toEqual(list);
		expect(read[0]).toBe(list[0]);
	});

	it.each([['null', null], ['missing', undefined], ['an object', { a: 1 }], ['text', 'x'], ['a number', 5], ['a boolean', true]])(
		'gives no profiles for a list of %s',
		(_, value) => {
			expect(normalizeProfiles(value)).toEqual([]);
		}
	);

	it('leaves out entries that are not profiles', () => {
		const numberId = { ...DEFAULT_PROFILE, id: 7 };
		const list = [null, 5, 'x', [], [DEFAULT_PROFILE], { ...DEFAULT_PROFILE, id: throwsAsText }, { name: 'no id' }, DEFAULT_PROFILE, numberId];
		expect(normalizeProfiles(list)).toEqual([DEFAULT_PROFILE, { ...numberId, id: '7' }]);
	});

	it('lets the store migration read every entry', () => {
		const list = [null, 5, { ...DEFAULT_PROFILE, reticleType: undefined }];
		expect(() => normalizeProfiles(list).forEach((p) => p.reticleType === undefined)).not.toThrow();
	});
});

describe('profile ids are read as text (#131)', () => {
	const ids = (list) => normalizeProfiles(list).map((p) => p.id);
	const named = (id, name = `p${id}`) => ({ ...DEFAULT_PROFILE, id, name });

	it.each([
		[1, '1'],
		[0, '0'],
		[-3, '-3'],
		[1.5, '1.5'],
		[1e21, '1e+21']
	])('reads the number id %j as %j, and keeps the other fields', (id, text) => {
		const stored = named(id, 'Number');
		const [read] = normalizeProfiles([stored]);
		expect(read).toEqual({ ...stored, id: text });
		expect(stored.id).toBe(id);
	});

	it('keeps a profile with a text id as the stored object', () => {
		const list = [named('a'), named('1')];
		const read = normalizeProfiles(list);
		expect(read[0]).toBe(list[0]);
		expect(read[1]).toBe(list[1]);
	});

	it.each([
		['a number and its text', [named(1, 'first'), named('1', 'second')], ['1', '1-2']],
		['its text and the number', [named('1', 'first'), named(1, 'second')], ['1', '1-2']],
		['the same text twice', [named('a'), named('a')], ['a', 'a-2']],
		['three times', [named(1), named('1'), named(1)], ['1', '1-2', '1-3']],
		['a later profile already holding the new id', [named(1), named('1'), named('1-2')], ['1', '1-3', '1-2']],
		['an earlier profile already holding the new id', [named('1-2'), named(1), named('1')], ['1-2', '1', '1-3']],
		['a uuid twice', [named('2b6c'), named('x'), named('2b6c')], ['2b6c', 'x', '2b6c-2']]
	])('gives a later duplicate a new id: %s', (_, list, expected) => {
		const read = ids(list);
		expect(read).toEqual(expected);
		expect(new Set(read).size).toBe(read.length);
	});

	it('gives the same ids at every read, and keeps the duplicate itself', () => {
		const list = [named(1, 'first'), named('1', 'second')];
		expect(ids(list)).toEqual(ids(list));
		expect(normalizeProfiles(list)[1]).toEqual({ ...list[1], id: '1-2' });
	});

	it('reads a list with many copies of one id quickly, each with its own id', () => {
		const list = Array.from({ length: 20000 }, (_, i) => named(i % 2 ? 1 : '1'));
		const start = performance.now();
		const read = ids(list);
		expect(performance.now() - start).toBeLessThan(1000);
		expect(new Set(read).size).toBe(list.length);
		expect(read.slice(0, 3)).toEqual(['1', '1-2', '1-3']);
	});

	it('keeps the ids a save writes back', () => {
		const once = normalizeProfiles([named(1), named('1'), named(1)]);
		expect(normalizeProfiles(once).map((p) => p.id)).toEqual(['1', '1-2', '1-3']);
	});

	it.each([
		[1, '1'],
		['1', '1'],
		['p1', 'p1'],
		[0, '0'],
		[null, null],
		[undefined, null],
		[{}, null],
		[['1'], null],
		[true, null],
		[throwsAsText, null]
	])('reads the stored active id %j as %j', (value, expected) => {
		expect(storedProfileId(value)).toBe(expected);
	});
});

/**
 * Ids that cannot be used in a link are renumbered on read (#134, owner decision). Pages link to
 * `/profiles/<id>` without encoding the id and look it up by the decoded route parameter.
 */
describe('profile ids that cannot be used in a link (#134)', () => {
	const ids = (list) => normalizeProfiles(list).map((p) => p.id);
	const named = (id, name = `p${id}`) => ({ ...DEFAULT_PROFILE, id, name });

	/** The id a page reads back from a link to the profile, as the router decodes it, or null. */
	function idFromLink(id) {
		const url = new URL(`/profiles/${id}`, 'http://localhost');
		const match = /^\/profiles\/([^/]+)$/.exec(url.pathname);
		if (!match || url.search || url.hash) return null;
		const decoded = decodeURIComponent(match[1]);
		return decoded === 'new' ? null : decoded;
	}

	it.each([
		['empty', '', 'profile'],
		['"new"', 'new', 'profile'],
		['"."', '.', 'profile'],
		['".."', '..', 'profile'],
		['a slash', 'a/b', 'a-b'],
		['a question mark', 'a?b', 'a-b'],
		['a hash', 'a#b', 'a-b'],
		['a percent sign', 'a%41', 'a-41'],
		['a backslash', 'a\\b', 'a-b'],
		['spaces at its ends', ' a ', '-a-'],
		['a tab and a line break', 'a\tb\n', 'a-b-'],
		['a carriage return', 'a\rb', 'a-b'],
		['a control character at its end', 'a\u0001', 'a-'],
		['only a slash', '/', '-'],
		['several', '/a?b#c/', '-a-b-c-']
	])('renumbers an id with %s', (_, id, expected) => {
		const stored = named(id, 'Kept');
		const [read] = normalizeProfiles([stored]);
		expect(read).toEqual({ ...stored, id: expected });
		expect(stored.id).toBe(id);
		expect(idFromLink(read.id)).toBe(read.id);
		expect(idFromLink(id)).not.toBe(id);
	});

	it.each([['p1'], ['2b6c1f0e-8a1d-4c47-9a0a-1d9c3f6f8e11'], ['1'], ['new-2'], ['profile'], ['news'], ['a.b'], ['...'], ['é'], ['a-b'], ['a b'], ['a\u00a0b']])(
		'keeps the usable id %j as the stored object',
		(id) => {
			const list = [named(id)];
			expect(normalizeProfiles(list)[0]).toBe(list[0]);
			expect(idFromLink(id)).toBe(id);
		}
	);

	it.each([
		['an id stored later', [named('a/b'), named('a-b')], ['a-b-2', 'a-b']],
		['an id stored earlier', [named('a-b'), named('a/b')], ['a-b', 'a-b-2']],
		['two ids that become the same', [named('a/b'), named('a?b'), named('a#b')], ['a-b', 'a-b-2', 'a-b-3']],
		['an empty id next to "profile"', [named(''), named('profile')], ['profile-2', 'profile']],
		['"new" and an empty id', [named('new'), named(''), named('profile-2')], ['profile', 'profile-3', 'profile-2']],
		['a duplicate of the new id', [named('a/b'), named('a-b'), named('a-b')], ['a-b-2', 'a-b', 'a-b-3']],
		['the number id of a duplicate', [named(1), named('1'), named('1-2'), named('1/2')], ['1', '1-3', '1-2', '1-2-2']]
	])('gives no two profiles the same id: %s', (_, list, expected) => {
		const read = ids(list);
		expect(read).toEqual(expected);
		expect(new Set(read).size).toBe(read.length);
		for (const id of read) expect(idFromLink(id)).toBe(id);
	});

	it('gives the same ids at every read, and keeps them after a save', () => {
		const list = [named(''), named('new'), named('a/b'), named('a-b'), named('x'), named('x')];
		const once = normalizeProfiles(list);
		expect(ids(list)).toEqual(once.map((p) => p.id));
		expect(normalizeProfiles(once)).toEqual(once);
		for (const [i, profile] of normalizeProfiles(once).entries()) expect(profile).toBe(once[i]);
	});

	it('gives every profile of a mixed list an id a link reads back, with no two the same', () => {
		const odd = ['', 'new', '.', '..', '/', '?', '#', '%', '\\', ' ', '\t', 'a b', ' a', 'profile', 'profile-2', '-', 1, '1', 'new-2'];
		const read = ids([...odd, ...odd].map((id) => named(id)));
		expect(new Set(read).size).toBe(read.length);
		for (const id of read) expect(idFromLink(id)).toBe(id);
	});

	it('renumbers an id that is a static route under /profiles/', () => {
		expect(ids([named('ammo-selector')])).toEqual(['profile']);
		expect(ids([named('ammo-selector-2')])).toEqual(['ammo-selector-2']);
	});

	it('lists every static route under /profiles/ as unusable', () => {
		// Vitest runs from the project root (vite.config.js).
		const routes = readdirSync(join(process.cwd(), 'src/routes/profiles'), { withFileTypes: true })
			.filter((entry) => entry.isDirectory() && !entry.name.startsWith('[') && !entry.name.startsWith('('))
			.map((entry) => entry.name);
		expect(routes).toEqual(expect.arrayContaining(['new', 'ammo-selector']));
		for (const route of routes) expect(UNUSABLE_IDS.has(route), `route /profiles/${route}`).toBe(true);
	});

	it.each([
		['a long run of spaces inside', 'a' + ' '.repeat(100000) + 'a'],
		['a long run of spaces at the start', ' '.repeat(100000) + 'a'],
		['a long run of spaces at the end', 'a' + ' '.repeat(100000)],
		['only spaces', ' '.repeat(100000)],
		['spaces and tabs inside', 'a' + ' \t'.repeat(50000) + 'a'],
		['a million spaces inside', 'a' + ' '.repeat(1000000) + 'a']
	])('reads an id with %s in linear time (security review of #134)', (_, id) => {
		const start = performance.now();
		const [read] = normalizeProfiles([named(id)]);
		expect(performance.now() - start).toBeLessThan(200);
		expect(read.id).toHaveLength(id.length);
		expect(idFromLink(read.id)).toBe(read.id);
	});

	describe('findProfileIdRenames', () => {
		it('maps each renumbered stored id to the id it reads as', () => {
			const list = [named('p1'), named('a/b'), named(''), named('new'), named('a-b'), named('a/b')];
			expect([...findProfileIdRenames(list)]).toEqual([
				['a/b', 'a-b-2'],
				['', 'profile'],
				['new', 'profile-2']
			]);
		});

		it('leaves out ids a profile still reads as: number ids and duplicates (#131)', () => {
			expect(findProfileIdRenames([named(1), named('1'), named(7)]).size).toBe(0);
		});

		it.each([[null], ['x'], [{}], [[]], [[null, 5]]])('is empty for %j', (value) => {
			expect(findProfileIdRenames(value).size).toBe(0);
		});

		it('never maps from an id a profile reads as', () => {
			const odd = ['', 'new', 'ammo-selector', '.', '..', '/', '?', '#', '%', '\\', ' ', '\t', 'a b', ' a', 'profile', 'profile-2', '-', 1, '1'];
			const list = [...odd, ...odd].map((id) => named(id));
			const readIds = new Set(ids(list));
			for (const [from, to] of findProfileIdRenames(list)) {
				expect(readIds.has(from)).toBe(false);
				expect(readIds.has(to)).toBe(true);
			}
		});
	});

	describe('renaming stored references (security review of #134)', () => {
		const renames = new Map([['a/b', 'a-b'], ['', 'profile']]);
		const entry = { id: 'e1', profileId: 'a/b', zeroDist: '100', zeroUnit: 'yd' };

		it.each([
			['a/b', 'a-b'],
			['', 'profile'],
			['x', 'x'],
			[7, 7],
			[null, null],
			[undefined, undefined]
		])('reads the active id %j as %j', (value, expected) => {
			expect(renameActiveProfileId(value, renames)).toBe(expected);
		});

		it.each([[{}], [['a/b']], [true]])('leaves the damaged active id %j as stored', (value) => {
			expect(renameActiveProfileId(value, renames)).toBe(value);
		});

		it('points each matching compare entry at the new id, and leaves the rest', () => {
			const other = { id: 'e2', profileId: 'x' };
			const state = { entries: [null, entry, 5, other, { id: 'e3', profileId: 3 }], range: { distance: '500', unit: 'yd' }, yAxis: 'in' };
			const read = renameCompareEntries(state, renames);
			expect(read).toEqual({ ...state, entries: [null, { ...entry, profileId: 'a-b' }, 5, other, { id: 'e3', profileId: 3 }] });
			expect(read.entries[3]).toBe(other);
			expect(state.entries[1].profileId).toBe('a/b');
		});

		it.each([[null], ['x'], [[entry]], [{ entries: 'a/b' }], [{ entries: [{ ...entry, profileId: 'x' }] }], [{}]])(
			'gives back %j itself when no entry changes',
			(value) => {
				expect(renameCompareEntries(value, renames)).toBe(value);
			}
		);
	});

	describe('profileForStoredId: a stored reference to a renumbered profile', () => {
		const list = [named('p1', 'First'), named('a/b', 'Slash'), named('', 'Empty'), named('new', 'New'), named('a-b', 'Dash')];

		it.each([
			['p1', 'p1', 'First'],
			['a/b', 'a-b-2', 'Slash'],
			['', 'profile', 'Empty'],
			['new', 'profile-2', 'New'],
			['a-b', 'a-b', 'Dash'],
			['a-b-2', 'a-b-2', 'Slash'],
			['profile-2', 'profile-2', 'New']
		])('finds the profile stored or read with the id %j', (stored, id, name) => {
			const found = profileForStoredId(list, stored);
			expect(found.id).toBe(id);
			expect(found.name).toBe(name);
		});

		it('finds the first of several profiles stored with the same id, as before', () => {
			const found = profileForStoredId([named('a/b', 'A'), named('a/b', 'B')], 'a/b');
			expect(found).toMatchObject({ id: 'a-b', name: 'A' });
			expect(profileForStoredId([named(1, 'A'), named('1', 'B')], '1')).toMatchObject({ id: '1', name: 'A' });
		});

		it.each([[null], [undefined], [1], ['none']])('finds nothing for %j', (stored) => {
			expect(profileForStoredId(list, stored)).toBeUndefined();
		});

		it.each([[null], ['x'], [{}], [5]])('finds nothing in a stored list of %j', (value) => {
			expect(profileForStoredId(value, 'p1')).toBeUndefined();
		});
	});
});

describe('shownProfile', () => {
	it('shows a good profile as it is', () => {
		expect(shownProfile(DEFAULT_PROFILE)).toEqual(DEFAULT_PROFILE);
		const metric = {
			...DEFAULT_PROFILE,
			opticHeightUnit: 'cm',
			zeroUnit: 'm',
			bulletDiameterUnit: 'mm',
			bulletWeightUnit: 'g',
			bcType: 'G7',
			bulletLengthUnit: 'mm',
			velocityUnit: 'mps',
			temperatureUnit: 'c',
			barrelTwistUnit: 'mm',
			spinDrift: true,
			tempSensitivity: true,
			clickLink: false,
			reticleType: 'mrad',
			elevationClickUnit: 'MRAD'
		};
		expect(shownProfile(metric)).toEqual(metric);
	});

	it('is null without a profile', () => {
		expect(shownProfile(null)).toBeNull();
		expect(shownProfile(undefined)).toBeNull();
	});

	it('leaves out fields no page reads', () => {
		expect(shownProfile({ ...DEFAULT_PROFILE, extra: throwsAsText })).not.toHaveProperty('extra');
	});

	for (const field of ['name', 'ammo', 'optic', 'opticName', 'bulletBrand']) {
		it.each(DAMAGED_VALUES)(`shows a ${field} of %s as empty text`, (_, value) => {
			const shown = shownProfile({ ...DEFAULT_PROFILE, [field]: value });
			expect(shown[field]).toBe('');
			expect(() => readLikeThePages(shown)).not.toThrow();
		});

		it(`shows a ${field} that is a number as text, so that it sorts and searches`, () => {
			const shown = shownProfile({ ...DEFAULT_PROFILE, [field]: 5 });
			expect(shown[field]).toBe('5');
			expect(() => readLikeThePages(shown)).not.toThrow();
		});
	}

	for (const field of ['zeroDist', 'velocity', 'opticHeight', 'bc', 'bulletWeight', 'bulletDiameter', 'barrelTwist', 'bulletLength', 'temperature', 'tempModifier']) {
		it.each(DAMAGED_VALUES)(`shows a ${field} of %s as an empty box`, (_, value) => {
			const shown = shownProfile({ ...DEFAULT_PROFILE, [field]: value });
			expect(shown[field]).toBe('');
			expect(() => readLikeThePages(shown)).not.toThrow();
			expect(() => readDecimal(shown[field])).not.toThrow();
		});
	}

	it.each(DAMAGED_VALUES)('agrees with the calculators on a zero distance of %s: neither can use it', (_, zeroDist) => {
		expect(isUsableZeroDistance(zeroDist)).toBe(false);
		expect(isUsableZeroDistance(shownProfile({ ...DEFAULT_PROFILE, zeroDist }).zeroDist)).toBe(false);
	});

	it.each(DAMAGED_VALUES)('shows a click value of %s as 0.5, the value the Scope View counts with', (_, value) => {
		const shown = shownProfile({ ...DEFAULT_PROFILE, elevationClickValue: value, windageClickValue: value });
		expect(shown.elevationClickValue).toBe('0.5');
		expect(shown.windageClickValue).toBe('0.5');
	});

	it.each(DAMAGED_VALUES)('shows a reticle or click unit of %s as its default', (_, value) => {
		const shown = shownProfile({ ...DEFAULT_PROFILE, reticleType: value, elevationClickUnit: value, windageClickUnit: value });
		expect([shown.reticleType, shown.elevationClickUnit, shown.windageClickUnit]).toEqual(['red-dot', 'MOA', 'MOA']);
		expect(() => readLikeThePages(shown)).not.toThrow();
	});

	it('reads spin drift and powder sensitivity as the calculators test them, and the click link as on by default', () => {
		expect(shownProfile({ ...DEFAULT_PROFILE, spinDrift: 'yes', tempSensitivity: {} })).toMatchObject({
			spinDrift: true,
			tempSensitivity: true
		});
		expect(shownProfile({ ...DEFAULT_PROFILE, spinDrift: 0, tempSensitivity: null })).toMatchObject({
			spinDrift: false,
			tempSensitivity: false
		});
		expect(shownProfile({ ...DEFAULT_PROFILE, clickLink: undefined }).clickLink).toBe(true);
		expect(shownProfile({ ...DEFAULT_PROFILE, clickLink: null }).clickLink).toBe(true);
		expect(shownProfile({ ...DEFAULT_PROFILE, clickLink: false }).clickLink).toBe(false);
	});

	describe('units, as the calculators read them', () => {
		const UNITS = {
			barrelTwistUnit: 'in',
			opticHeightUnit: 'in',
			zeroUnit: 'yd',
			bulletDiameterUnit: 'in',
			bulletWeightUnit: 'gr',
			bcType: 'G1',
			bulletLengthUnit: 'in',
			velocityUnit: 'fps',
			temperatureUnit: 'f'
		};

		it.each(DAMAGED_VALUES)('shows a unit of %s as the unit the calculators use', (_, value) => {
			const damaged = Object.fromEntries(Object.keys(UNITS).map((key) => [key, value]));
			expect(shownProfile({ ...DEFAULT_PROFILE, ...damaged })).toMatchObject(UNITS);
		});

		it('gives the result of the shown units for damaged ones', () => {
			const damaged = Object.fromEntries(Object.keys(UNITS).map((key) => [key, throwsAsText]));
			const profile = { ...P223_G1, ...damaged };
			const shown = shownProfile(profile);
			const shownUnits = Object.fromEntries(Object.keys(UNITS).map((key) => [key, shown[key]]));
			const range = { distance: '300', unit: 'yd' };
			const stored = calculateShotPoint(profile, range, null, null);
			const asShown = calculateShotPoint({ ...P223_G1, ...shownUnits }, range, null, null);
			expect(stored.slantHeight.In(Unit.Inch)).toBe(asShown.slantHeight.In(Unit.Inch));
			expect(stored.velocity.In(Unit.FPS)).toBe(asShown.velocity.In(Unit.FPS));
		});
	});
});

describe('the calculators keep the stored profile', () => {
	let solver;
	beforeEach(() => {
		solver = vi.spyOn(Calculator.prototype, 'setWeaponZero').mockImplementation(() => {
			throw new Error('setWeaponZero reached');
		});
		vi.spyOn(Calculator.prototype, 'fire').mockImplementation(() => {
			throw new Error('fire reached');
		});
		vi.spyOn(console, 'error').mockImplementation(() => {});
	});
	afterEach(() => {
		vi.restoreAllMocks();
	});

	it('would give a result if the shown empty twist reached them, so they must not get it', () => {
		const stored = { ...P223_G1, spinDrift: true, barrelTwist: {} };
		expect(calculateShotPoint(stored, { distance: '300', unit: 'yd' }, null, null)).toBeNull();
		expect(solver).not.toHaveBeenCalled();
		calculateShotPoint({ ...stored, barrelTwist: shownProfile(stored).barrelTwist }, { distance: '300', unit: 'yd' }, null, null);
		expect(solver).toHaveBeenCalled();
	});
});

describe('duplicateProfile with a damaged name', () => {
	it.each(DAMAGED_VALUES)('copies a profile named %s as " - Copy"', (_, name) => {
		const { list } = duplicateProfile([{ ...DEFAULT_PROFILE, name }], 'p1');
		expect(list[1].name).toBe(' - Copy');
	});
});

describe('profile text length (#141)', () => {
	const long = 'x'.repeat(500);

	it('cuts a longer stored name, optic name, ammo brand and ammo text when read', () => {
		const stored = { ...DEFAULT_PROFILE, id: 'a', name: long, opticName: long, optic: long, bulletBrand: long, ammo: long };
		const [read] = normalizeProfiles([stored]);
		expect(read.name).toHaveLength(MAX_NAME_LENGTH);
		expect(read.opticName).toHaveLength(MAX_NAME_LENGTH);
		expect(read.optic).toHaveLength(MAX_NAME_LENGTH);
		expect(read.bulletBrand).toHaveLength(MAX_NAME_LENGTH);
		expect(read.ammo).toHaveLength(MAX_AMMO_LENGTH);
		expect(read.velocity).toBe(stored.velocity);
		expect(stored.name).toBe(long);
	});

	it('keeps texts within the limit, and the stored object itself', () => {
		const stored = { ...DEFAULT_PROFILE, id: 'a', name: 'n'.repeat(MAX_NAME_LENGTH), ammo: 'a'.repeat(MAX_AMMO_LENGTH) };
		expect(normalizeProfiles([stored])[0]).toBe(stored);
	});

	it('cuts the text of a renumbered profile too', () => {
		const [read] = normalizeProfiles([{ ...DEFAULT_PROFILE, id: 7, name: long }]);
		expect(read).toMatchObject({ id: '7', name: 'x'.repeat(MAX_NAME_LENGTH) });
	});

	it('leaves values that are not text for shownProfile', () => {
		const stored = { ...DEFAULT_PROFILE, id: 'a', name: ['x'.repeat(100)], bulletBrand: 12345 };
		expect(normalizeProfiles([stored])[0]).toBe(stored);
		expect(shownProfile(stored).name).toBe('');
	});

	it('shows a long stored name cut on every page', () => {
		expect(shownProfile(normalizeProfiles([{ ...DEFAULT_PROFILE, id: 'a', name: long }])[0]).name).toHaveLength(MAX_NAME_LENGTH);
	});

	it('does not leave half of an emoji at the cut', () => {
		expect(cutText('x'.repeat(MAX_NAME_LENGTH - 1) + '🎯', MAX_NAME_LENGTH)).toBe('x'.repeat(MAX_NAME_LENGTH - 1));
		expect(cutText('x'.repeat(MAX_NAME_LENGTH - 2) + '🎯', MAX_NAME_LENGTH)).toBe('x'.repeat(MAX_NAME_LENGTH - 2) + '🎯');
		expect(cutText('short', MAX_NAME_LENGTH)).toBe('short');
	});

	it('limits the rifle designation, optic name and ammo brand inputs of the profile form', () => {
		const source = fs.readFileSync(path.join(process.cwd(), 'src/lib/components/ProfileForm.svelte'), 'utf8');
		for (const field of ['name', 'opticName', 'bulletBrand']) {
			const input = source.match(new RegExp(`<input[^>]*bind:value=\\{form\\.${field}\\}[^>]*>`))?.[0];
			expect(input, field).toContain('maxlength={MAX_NAME_LENGTH}');
		}
		expect(source).toContain("import { MAX_NAME_LENGTH } from '#lib/utils/storedProfiles.js'");
	});
});
