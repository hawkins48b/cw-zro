import { normalizeCompareEntries } from '#lib/utils/compareEntries.js';
import { normalizeYAxisUnit } from '#lib/utils/yAxisUnit.js';
import { localStore } from './localStore.svelte.js';

const defaults = {
	entries: [],
	range: { distance: '500', unit: 'yd' },
	yAxis: 'in'
};

const _store = localStore('zro-compare-traj', defaults);

const readEntries = () => normalizeCompareEntries(_store.value.entries);

export const compareTrajectories = {
	get entries() { return readEntries(); },
	get range() { return _store.value.range; },
	get yAxis() { return normalizeYAxisUnit(_store.value.yAxis); },

	addEntry(profileId, zeroDist, zeroUnit) {
		const id = crypto.randomUUID();
		const entries = [...readEntries(), { id, profileId, zeroDist, zeroUnit }];
		_store.value = { ..._store.value, entries };
	},
	updateEntry(id, patch) {
		const entries = readEntries().map((e) =>
			e.id === id ? { ...e, ...patch, id } : e
		);
		_store.value = { ..._store.value, entries };
	},
	removeEntry(id) {
		const entries = readEntries().filter((e) => e.id !== id);
		_store.value = { ..._store.value, entries };
	},
	setRange(patch) {
		_store.value = { ..._store.value, range: { ..._store.value.range, ...patch } };
	},
	setYAxis(unit) {
		_store.value = { ..._store.value, yAxis: unit };
	}
};
