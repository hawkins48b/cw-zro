import { localStore } from './localStore.svelte.js';

const defaults = {
	range: {
		distance: '100',
		unit: 'yd'
	},
	measure: {
		type: 'angle',      // 'angle' | 'distance'
		distanceValue: '0',
		distanceUnit: 'in', // 'in' | 'cm'
		angleValue: '0',
		angleUnit: 'moa'    // 'moa' | 'mrad'
	},
	solveFor: 'velocity'    // 'velocity' | 'bc'
};

const _store = localStore('zro-traj-validation', defaults);

export const trajectoryValidation = {
	get range() { return _store.value.range; },
	get measure() { return _store.value.measure; },
	get solveFor() { return _store.value.solveFor ?? 'velocity'; },
	setRange(patch) {
		_store.value = { ..._store.value, range: { ..._store.value.range, ...patch } };
	},
	setMeasure(patch) {
		_store.value = { ..._store.value, measure: { ..._store.value.measure, ...patch } };
	},
	setSolveFor(val) {
		_store.value = { ..._store.value, solveFor: val };
	}
};
