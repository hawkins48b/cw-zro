import { localStore } from './localStore.svelte.js';

const defaults = {
	entries: [],
	range: { distance: '500', unit: 'yd' },
	yAxis: 'in'
};

const _store = localStore('zro-compare-traj', defaults);

export const compareTrajectories = {
	get entries() { return _store.value.entries; },
	get range() { return _store.value.range; },
	get yAxis() { return _store.value.yAxis ?? 'in'; },

	addEntry(profileId, zeroDist, zeroUnit) {
		const id = crypto.randomUUID();
		const entries = [..._store.value.entries, { id, profileId, zeroDist, zeroUnit }];
		_store.value = { ..._store.value, entries };
	},
	updateEntry(id, patch) {
		const entries = _store.value.entries.map((e) =>
			e.id === id ? { ...e, ...patch, id } : e
		);
		_store.value = { ..._store.value, entries };
	},
	removeEntry(id) {
		const entries = _store.value.entries.filter((e) => e.id !== id);
		_store.value = { ..._store.value, entries };
	},
	setRange(patch) {
		_store.value = { ..._store.value, range: { ..._store.value.range, ...patch } };
	},
	setYAxis(unit) {
		_store.value = { ..._store.value, yAxis: unit };
	}
};
