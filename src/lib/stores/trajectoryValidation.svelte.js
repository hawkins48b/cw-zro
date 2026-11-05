import { localStore } from './localStore.svelte.js';

const ISA_DEFAULTS = {
	useISA: true,
	altitude: '0',
	altitudeUnit: 'ft',
	pressure: '29.92',
	pressureUnit: 'inhg',
	temperature: '59',
	temperatureUnit: 'f',
	humidity: '0'
};

const defaults = {
	range: {
		distance: '100',
		unit: 'yd'
	},
	measure: {
		type: 'angle',      // 'angle' | 'distance'
		direction: 'below', // 'below' | 'above': bullet relative to line of sight
		distanceValue: '0',
		distanceUnit: 'in', // 'in' | 'cm'
		angleValue: '0',
		angleUnit: 'moa'    // 'moa' | 'mrad'
	},
	solveFor: 'velocity',   // 'velocity' | 'bc'
	atmosphere: { ...ISA_DEFAULTS }
};

const _store = localStore('zro-traj-validation', defaults);

export const trajectoryValidation = {
	get range() { return _store.value.range; },
	get measure() { return _store.value.measure; },
	// State saved before this field existed has no direction: read it as below.
	get direction() { return _store.value.measure.direction === 'above' ? 'above' : 'below'; },
	get solveFor() { return _store.value.solveFor ?? 'velocity'; },
	get atmosphere() { return _store.value.atmosphere ?? { ...ISA_DEFAULTS }; },
	setRange(patch) {
		_store.value = { ..._store.value, range: { ..._store.value.range, ...patch } };
	},
	setMeasure(patch) {
		_store.value = { ..._store.value, measure: { ..._store.value.measure, ...patch } };
	},
	setSolveFor(val) {
		_store.value = { ..._store.value, solveFor: val };
	},
	setAtmosphere(patch) {
		const current = _store.value.atmosphere ?? { ...ISA_DEFAULTS };
		const updated = { ...current, ...patch };
		if (updated.useISA) Object.assign(updated, ISA_DEFAULTS, { useISA: true });
		_store.value = { ..._store.value, atmosphere: updated };
	}
};
