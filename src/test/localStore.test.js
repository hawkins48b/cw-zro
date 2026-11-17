// localStore keeps working when storage refuses a write (full or blocked). The wind conversion of
// #106 writes while the store module loads, so a throw there would stop the page loading.
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

vi.mock('$app/env', () => ({ browser: true }));

import { localStore } from '#lib/stores/localStore.svelte.js';

describe('localStore when storage refuses a write', () => {
	let saved;
	beforeEach(() => {
		saved = { 'zro-test': JSON.stringify({ a: 1 }) };
		vi.stubGlobal('localStorage', {
			getItem: (k) => saved[k] ?? null,
			setItem: () => {
				throw new Error('QuotaExceededError');
			}
		});
		vi.spyOn(console, 'warn').mockImplementation(() => {});
	});
	afterEach(() => {
		vi.unstubAllGlobals();
		vi.restoreAllMocks();
	});

	it('seeds a default without throwing', () => {
		const store = localStore('zro-missing', { b: 2 });
		expect(store.value).toEqual({ b: 2 });
	});

	it('keeps a new value in memory when it cannot be saved', () => {
		const store = localStore('zro-test', {});
		expect(() => {
			store.value = { a: 3 };
		}).not.toThrow();
		expect(store.value).toEqual({ a: 3 });
		expect(saved['zro-test']).toBe(JSON.stringify({ a: 1 }));
		expect(console.warn).toHaveBeenCalled();
	});
});

describe('localStore.trySet (security review of #166)', () => {
	afterEach(() => {
		vi.unstubAllGlobals();
		vi.restoreAllMocks();
	});

	it('keeps the old value and returns false when storage refuses the write', () => {
		const saved = { 'zro-test': JSON.stringify([1]) };
		let refuse = true;
		vi.stubGlobal('localStorage', {
			getItem: (k) => saved[k] ?? null,
			setItem: (k, v) => {
				if (refuse) throw new Error('QuotaExceededError');
				saved[k] = v;
			}
		});
		vi.spyOn(console, 'warn').mockImplementation(() => {});
		const store = localStore('zro-test', []);
		expect(store.trySet([1, 2])).toBe(false);
		expect(store.value).toEqual([1]);
		refuse = false;
		expect(store.trySet([1, 2])).toBe(true);
		expect(store.value).toEqual([1, 2]);
		expect(saved['zro-test']).toBe('[1,2]');
	});
});
