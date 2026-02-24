import { describe, it, expect } from 'vitest';
import {
	addProfile,
	updateProfile,
	removeProfile,
	getProfile,
	duplicateProfile
} from '$lib/utils/profileOps.js';

const makeProfile = (overrides = {}) => ({
	name: 'Remington 700',
	ammo: 'Sierra 168\u202fgr',
	optic: 'Vortex Razor',
	zeroDist: 100,
	zeroUnit: 'yd',
	...overrides
});

// ── addProfile ─────────────────────────────────────────────────────────────

describe('addProfile', () => {
	it('appends a profile with a generated UUID', () => {
		const { list, id } = addProfile([], makeProfile());
		expect(list).toHaveLength(1);
		expect(list[0].id).toBeDefined();
		expect(typeof list[0].id).toBe('string');
		expect(id).toBe(list[0].id);
	});

	it('does not mutate the original list', () => {
		const original = [];
		addProfile(original, makeProfile());
		expect(original).toHaveLength(0);
	});

	it('preserves existing profiles', () => {
		const existing = [makeProfile({ id: 'abc', name: 'Tikka' })];
		const { list } = addProfile(existing, makeProfile({ name: 'Remington 700' }));
		expect(list).toHaveLength(2);
		expect(list[0].name).toBe('Tikka');
		expect(list[1].name).toBe('Remington 700');
	});

	it('merges all profile fields', () => {
		const profile = makeProfile({ velocity: '2650', bc: '0.475' });
		const { list } = addProfile([], profile);
		expect(list[0].velocity).toBe('2650');
		expect(list[0].bc).toBe('0.475');
	});
});

// ── updateProfile ──────────────────────────────────────────────────────────

describe('updateProfile', () => {
	it('merges new data into the matching profile', () => {
		const { list: seed, id } = addProfile([], makeProfile({ name: 'Original' }));
		const { list, success } = updateProfile(seed, id, { name: 'Updated' });
		expect(success).toBe(true);
		expect(list[0].name).toBe('Updated');
		expect(list[0].id).toBe(id);
	});

	it('preserves unchanged fields', () => {
		const { list: seed, id } = addProfile([], makeProfile({ velocity: '2650' }));
		const { list } = updateProfile(seed, id, { name: 'New Name' });
		expect(list[0].velocity).toBe('2650');
	});

	it('does not mutate the original list', () => {
		const { list: seed, id } = addProfile([], makeProfile());
		updateProfile(seed, id, { name: 'Changed' });
		expect(seed[0].name).toBe('Remington 700');
	});

	it('returns success: false for an unknown id', () => {
		const { list: seed } = addProfile([], makeProfile());
		const { success } = updateProfile(seed, 'nonexistent-id', { name: 'X' });
		expect(success).toBe(false);
	});

	it('returns the original list unchanged when id not found', () => {
		const { list: seed } = addProfile([], makeProfile({ name: 'Stays' }));
		const { list } = updateProfile(seed, 'bad-id', { name: 'Changed' });
		expect(list[0].name).toBe('Stays');
	});
});

// ── removeProfile ──────────────────────────────────────────────────────────

describe('removeProfile', () => {
	it('removes the matching profile', () => {
		const { list: seed, id } = addProfile([], makeProfile());
		const { list, removed } = removeProfile(seed, id);
		expect(list).toHaveLength(0);
		expect(removed).toBe(true);
	});

	it('does not mutate the original list', () => {
		const { list: seed, id } = addProfile([], makeProfile());
		removeProfile(seed, id);
		expect(seed).toHaveLength(1);
	});

	it('leaves other profiles intact', () => {
		let list = [];
		({ list } = addProfile(list, makeProfile({ name: 'Keep' })));
		const { list: seed, id } = addProfile(list, makeProfile({ name: 'Remove' }));
		const { list: result } = removeProfile(seed, id);
		expect(result).toHaveLength(1);
		expect(result[0].name).toBe('Keep');
	});

	it('returns removed: false for an unknown id', () => {
		const { list: seed } = addProfile([], makeProfile());
		const { removed } = removeProfile(seed, 'nonexistent-id');
		expect(removed).toBe(false);
	});
});

// ── getProfile ─────────────────────────────────────────────────────────────

describe('getProfile', () => {
	it('returns the profile with the matching id', () => {
		const { list, id } = addProfile([], makeProfile({ name: 'Target' }));
		const found = getProfile(list, id);
		expect(found).not.toBeNull();
		expect(found.name).toBe('Target');
	});

	it('returns null for an unknown id', () => {
		const { list } = addProfile([], makeProfile());
		expect(getProfile(list, 'bad-id')).toBeNull();
	});

	it('returns null on an empty list', () => {
		expect(getProfile([], 'any-id')).toBeNull();
	});
});

// ── duplicateProfile ───────────────────────────────────────────────────────

describe('duplicateProfile', () => {
	it('creates a copy with " - Copy" appended to the name', () => {
		const { list: seed, id } = addProfile([], makeProfile({ name: 'Original' }));
		const { list } = duplicateProfile(seed, id);
		expect(list).toHaveLength(2);
		expect(list[1].name).toBe('Original - Copy');
	});

	it('gives the copy a new unique id', () => {
		const { list: seed, id } = addProfile([], makeProfile());
		const { list, id: newId } = duplicateProfile(seed, id);
		expect(newId).not.toBe(id);
		expect(list[1].id).toBe(newId);
	});

	it('copies all fields except the id', () => {
		const { list: seed, id } = addProfile([], makeProfile({ bc: '0.475', velocity: '2650' }));
		const { list } = duplicateProfile(seed, id);
		expect(list[1].bc).toBe('0.475');
		expect(list[1].velocity).toBe('2650');
	});

	it('does not mutate the original list', () => {
		const { list: seed, id } = addProfile([], makeProfile());
		duplicateProfile(seed, id);
		expect(seed).toHaveLength(1);
	});

	it('returns id: null for an unknown id', () => {
		const { list: seed } = addProfile([], makeProfile());
		const { id } = duplicateProfile(seed, 'bad-id');
		expect(id).toBeNull();
	});

	it('returns the original list unchanged when id not found', () => {
		const { list: seed } = addProfile([], makeProfile({ name: 'Stays' }));
		const { list } = duplicateProfile(seed, 'bad-id');
		expect(list).toHaveLength(1);
		expect(list[0].name).toBe('Stays');
	});
});
