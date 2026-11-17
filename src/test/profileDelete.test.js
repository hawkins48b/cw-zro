/**
 * Deleting and importing profiles (#166): the last profile cannot be deleted, deleting the profile in
 * use makes the next (else the previous) one active, and an import appends without replacing a
 * profile or changing the active one. The utils, then the real stores on jsdom localStorage.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { appendImportedProfiles, canDeleteProfile, nextActiveAfterDelete } from '#lib/utils/profileOps.js';
import { SAMPLE_PROFILE } from '#lib/utils/sampleProfile.js';

vi.mock('$app/env', () => ({ browser: true }));

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;
const p = (id, name = id) => ({ ...SAMPLE_PROFILE, id, name });

describe('canDeleteProfile', () => {
	it.each([
		[[], false],
		[[p('a')], false],
		[[p('a'), p('b')], true],
		['x', false],
		[null, false]
	])('%j gives %s', (list, expected) => {
		expect(canDeleteProfile(list)).toBe(expected);
	});
});

describe('nextActiveAfterDelete', () => {
	const list = [p('a'), p('b'), p('c')];
	it('takes the next in list order', () => {
		expect(nextActiveAfterDelete(list, 'a')).toBe('b');
		expect(nextActiveAfterDelete(list, 'b')).toBe('c');
	});
	it('takes the previous for the last', () => {
		expect(nextActiveAfterDelete(list, 'c')).toBe('b');
	});
	it('gives null for the only profile, an unknown id or no list', () => {
		expect(nextActiveAfterDelete([p('a')], 'a')).toBeNull();
		expect(nextActiveAfterDelete(list, 'z')).toBeNull();
		expect(nextActiveAfterDelete(null, 'a')).toBeNull();
	});
});

describe('appendImportedProfiles', () => {
	it('appends after the stored profiles and changes none', () => {
		const stored = [p('a', 'K31')];
		const id = crypto.randomUUID();
		const { list, ids } = appendImportedProfiles(stored, [{ ...p(id, 'K31 (2)') }]);
		expect(list[0]).toBe(stored[0]);
		expect(list[1]).toMatchObject({ id, name: 'K31 (2)' });
		expect(ids).toEqual([id]);
	});

	it('gives a new id to an id that is taken, not a UUID, or missing', () => {
		const taken = crypto.randomUUID();
		const { list, ids } = appendImportedProfiles([p(taken)], [p(taken, 'X'), p('a', 'Y'), { ...SAMPLE_PROFILE }]);
		expect(list[0].name).toBe(taken);
		expect(ids).toHaveLength(3);
		for (const id of ids) {
			expect(id).toMatch(UUID);
			expect(id).not.toBe(taken);
		}
		expect(new Set(ids).size).toBe(3);
	});

	it('gives two imported profiles with the same id each their own', () => {
		const id = crypto.randomUUID();
		const { ids } = appendImportedProfiles([], [p(id), p(id)]);
		expect(ids[0]).toBe(id);
		expect(ids[1]).not.toBe(id);
	});

	it('leaves out entries that are not objects', () => {
		expect(appendImportedProfiles([], [null, 'x', [1]]).ids).toEqual([]);
		expect(appendImportedProfiles([], 'x').ids).toEqual([]);
	});
});

/** Load the profile stores afresh on this storage. */
async function loadStores(values) {
	vi.resetModules();
	localStorage.clear();
	for (const [key, value] of Object.entries(values)) localStorage.setItem(key, JSON.stringify(value));
	const { profiles, importProfiles } = await import('#lib/stores/profiles.svelte.js');
	const { activeProfile, deleteProfile } = await import('#lib/stores/activeProfile.svelte.js');
	return { profiles, importProfiles, activeProfile, deleteProfile };
}

const stored = (key) => JSON.parse(localStorage.getItem(key));

describe('deleteProfile (store)', () => {
	beforeEach(() => localStorage.clear());

	it('refuses the last profile', async () => {
		const s = await loadStores({ 'zro-profiles': [p('a')], 'zro-active-profile': 'a' });
		expect(s.deleteProfile('a')).toBe(false);
		expect(s.profiles.list).toHaveLength(1);
		expect(s.activeProfile.id).toBe('a');
	});

	it('refuses an unknown id', async () => {
		const s = await loadStores({ 'zro-profiles': [p('a'), p('b')], 'zro-active-profile': 'a' });
		expect(s.deleteProfile('z')).toBe(false);
		expect(s.profiles.list).toHaveLength(2);
	});

	it('makes the next profile active when the one in use is deleted', async () => {
		const s = await loadStores({ 'zro-profiles': [p('a'), p('b'), p('c')], 'zro-active-profile': 'b' });
		expect(s.deleteProfile('b')).toBe(true);
		expect(s.activeProfile.id).toBe('c');
		expect(stored('zro-active-profile')).toBe('c');
		expect(stored('zro-profiles').map((x) => x.id)).toEqual(['a', 'c']);
	});

	it('makes the previous profile active when the last in the list is deleted in use', async () => {
		const s = await loadStores({ 'zro-profiles': [p('a'), p('b')], 'zro-active-profile': 'b' });
		s.deleteProfile('b');
		expect(stored('zro-active-profile')).toBe('a');
	});

	it('keeps the active profile when another is deleted', async () => {
		const s = await loadStores({ 'zro-profiles': [p('a'), p('b')], 'zro-active-profile': 'a' });
		s.deleteProfile('b');
		expect(s.activeProfile.id).toBe('a');
	});

	it('makes the next one active when no active id is stored and the first is deleted', async () => {
		const s = await loadStores({ 'zro-profiles': [p('a'), p('b')] });
		expect(s.activeProfile.id).toBe('a');
		s.deleteProfile('a');
		expect(s.activeProfile.id).toBe('b');
	});
});

describe('importProfiles (store)', () => {
	it('appends, keeps every stored profile and the active one, and returns the new ids', async () => {
		const s = await loadStores({ 'zro-profiles': [p('a', 'K31'), p('b', 'M4')], 'zro-active-profile': 'b' });
		const imported = [{ ...SAMPLE_PROFILE, id: crypto.randomUUID(), name: 'K31 (2)' }, { ...SAMPLE_PROFILE, id: 'a', name: 'Z' }];
		const ids = s.importProfiles(imported);
		expect(ids).toHaveLength(2);
		expect(ids[0]).toBe(imported[0].id);
		expect(ids[1]).not.toBe('a');
		expect(s.profiles.list.map((x) => x.name)).toEqual(['K31', 'M4', 'K31 (2)', 'Z']);
		expect(s.profiles.get('a').name).toBe('K31');
		expect(s.activeProfile.id).toBe('b');
		expect(stored('zro-active-profile')).toBe('b');
	});

	it('keeps the first profile active when no active id is stored', async () => {
		const s = await loadStores({ 'zro-profiles': [p('a')] });
		s.importProfiles([{ ...SAMPLE_PROFILE, name: 'New' }]);
		expect(s.activeProfile.id).toBe('a');
	});

	it('adds nothing and returns null when storage refuses the list (security review of #166)', async () => {
		const s = await loadStores({ 'zro-profiles': [p('a', 'K31')], 'zro-active-profile': 'a' });
		const setItem = vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
			throw new Error('QuotaExceededError');
		});
		vi.spyOn(console, 'warn').mockImplementation(() => {});
		try {
			expect(s.importProfiles([{ ...SAMPLE_PROFILE, name: 'New' }])).toBeNull();
		} finally {
			setItem.mockRestore();
			vi.restoreAllMocks();
		}
		expect(s.profiles.list.map((x) => x.id)).toEqual(['a']);
		expect(stored('zro-profiles').map((x) => x.id)).toEqual(['a']);
		expect(s.activeProfile.id).toBe('a');
		// Storage works again: the same import goes through.
		expect(s.importProfiles([{ ...SAMPLE_PROFILE, name: 'New' }])).toHaveLength(1);
		expect(stored('zro-profiles')).toHaveLength(2);
	});

		it('writes nothing for an empty import', async () => {
		const s = await loadStores({});
		expect(s.importProfiles([])).toEqual([]);
		expect(localStorage.getItem('zro-profiles')).toBeNull();
	});
});
