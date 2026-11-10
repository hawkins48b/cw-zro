import { normalizeCompareEntries } from '#lib/utils/compareEntries.js';
import { normalizeYAxisUnit } from '#lib/utils/yAxisUnit.js';
import { storedObject, storedRange } from '#lib/utils/storedState.js';
import { localStore } from './localStore.svelte.js';

const defaults = {
	entries: [],
	range: { distance: '500', unit: 'yd' },
	yAxis: 'in'
};

const _store = localStore('zro-compare-traj', defaults);

// The stored state, or an empty one when it is not an object (#120).
const state = () => storedObject(_store.value);
const readEntries = () => normalizeCompareEntries(state().entries);
const readRange = () => storedRange(state().range);

export const compareTrajectories = {
	get entries() { return readEntries(); },
	get range() { return readRange(); },
	get yAxis() { return normalizeYAxisUnit(state().yAxis); },

	addEntry(profileId, zeroDist, zeroUnit) {
		const id = crypto.randomUUID();
		const entries = [...readEntries(), { id, profileId, zeroDist, zeroUnit }];
		_store.value = { ...state(), entries };
	},
	updateEntry(id, patch) {
		const entries = readEntries().map((e) =>
			e.id === id ? { ...e, ...patch, id } : e
		);
		_store.value = { ...state(), entries };
	},
	removeEntry(id) {
		const entries = readEntries().filter((e) => e.id !== id);
		_store.value = { ...state(), entries };
	},
	setRange(patch) {
		_store.value = { ...state(), range: { ...readRange(), ...patch } };
	},
	setYAxis(unit) {
		_store.value = { ...state(), yAxis: unit };
	}
};
