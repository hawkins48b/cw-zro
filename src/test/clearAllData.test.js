/**
 * "Clear all data on this device" (#166): every key the app writes is removed, keys of others are
 * kept, and the stores read as on a first launch without writing anything back.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { APP_STORAGE_KEYS, appStorageKeys, clearAppStorage } from '#lib/utils/appStorage.js';
import { isFirstRun } from '#lib/utils/firstRun.js';
import { SAMPLE_PROFILE } from '#lib/utils/sampleProfile.js';

vi.mock('$app/env', () => ({ browser: true }));

/** A plain Storage. */
function memoryStorage(values = {}) {
	const data = new Map(Object.entries(values));
	return {
		get length() {
			return data.size;
		},
		key: (i) => [...data.keys()][i] ?? null,
		getItem: (k) => (data.has(k) ? data.get(k) : null),
		setItem: (k, v) => data.set(k, String(v)),
		removeItem: (k) => data.delete(k),
		data
	};
}

describe('APP_STORAGE_KEYS', () => {
	it('lists every key of docs/data-and-privacy.md', () => {
		expect([...APP_STORAGE_KEYS].sort()).toEqual(
			[
				'zro-active-profile',
				'zro-ballistic',
				'zro-compare-traj',
				'zro-dark-mode',
				'zro-locale',
				'zro-mpbr',
				'zro-profiles',
				'zro-scope-view',
				'zro-traj-validation'
			].sort()
		);
	});
});

describe('clearAppStorage', () => {
	it('removes the app keys and any zro- key, and keeps the others', () => {
		const values = Object.fromEntries(APP_STORAGE_KEYS.map((k) => [k, '1']));
		const storage = memoryStorage({ ...values, 'zro-old-key': 'x', other: 'keep', 'ZRO-upper': 'keep' });
		const removed = clearAppStorage(/** @type {any} */ (storage));
		expect(removed.sort()).toEqual([...APP_STORAGE_KEYS, 'zro-old-key'].sort());
		expect([...storage.data.keys()].sort()).toEqual(['ZRO-upper', 'other']);
	});

	it('finds the keys before removing, so none is skipped', () => {
		const storage = memoryStorage({ 'zro-a': '1', 'zro-b': '1', 'zro-c': '1' });
		expect(appStorageKeys(/** @type {any} */ (storage))).toHaveLength(3);
		clearAppStorage(/** @type {any} */ (storage));
		expect(storage.length).toBe(0);
	});

	it('never throws on storage that refuses', () => {
		const storage = { get length() { throw new Error('denied'); } };
		expect(clearAppStorage(/** @type {any} */ (storage))).toEqual([]);
		expect(clearAppStorage(/** @type {any} */ (null))).toEqual([]);
	});
});

describe('clearAllData', () => {
	beforeEach(() => {
		localStorage.clear();
		vi.stubGlobal('matchMedia', () => ({ matches: false }));
	});
	afterEach(() => vi.unstubAllGlobals());

	it('empties local storage and puts the stores back to a first run', async () => {
		vi.resetModules();
		localStorage.setItem('zro-profiles', JSON.stringify([{ ...SAMPLE_PROFILE, id: 'a' }]));
		localStorage.setItem('zro-active-profile', JSON.stringify('a'));
		localStorage.setItem('zro-dark-mode', 'true');
		localStorage.setItem('zro-locale', 'fr');
		localStorage.setItem('zro-mpbr', JSON.stringify({ target: { size: '20', unit: 'cm' } }));
		localStorage.setItem('unrelated', 'keep');
		const { profiles } = await import('#lib/stores/profiles.svelte.js');
		const { activeProfile } = await import('#lib/stores/activeProfile.svelte.js');
		const { settings } = await import('#lib/stores/settings.svelte.js');
		const { mpbr } = await import('#lib/stores/mpbr.svelte.js');
		const { scopeView } = await import('#lib/stores/scopeView.svelte.js');
		const { formDraft } = await import('#lib/stores/formDraft.svelte.js');
		const { clearAllData } = await import('#lib/stores/clearAllData.js');
		document.documentElement.classList.add('dark');
		formDraft.save({ form: {} });
		expect(activeProfile.id).toBe('a');
		expect(profiles.count).toBe(1);
		expect(settings.darkMode).toBe(true);
		expect(localStorage.getItem('zro-scope-view')).not.toBeNull();

		const removed = clearAllData();

		expect(removed).toEqual(expect.arrayContaining(['zro-profiles', 'zro-active-profile', 'zro-dark-mode', 'zro-locale', 'zro-mpbr', 'zro-scope-view']));
		expect(Object.keys(localStorage)).toEqual(['unrelated']);
		expect(profiles.list).toEqual([]);
		expect(profiles.count).toBe(0);
		expect(isFirstRun(profiles.list)).toBe(true);
		expect(activeProfile.id).toBeNull();
		expect(activeProfile.profile).toBeNull();
		expect(settings.darkMode).toBe(false);
		expect(document.documentElement.classList.contains('dark')).toBe(false);
		expect(mpbr.target).toEqual({ size: '8', unit: 'in' });
		expect(formDraft.pending).toBeNull();
		// Nothing is written back until the user saves something.
		expect(Object.keys(localStorage)).toEqual(['unrelated']);
	});
});
