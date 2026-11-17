import {
	storedObject,
	storedRange,
	storedSolveFor,
	storedValidationAtmosphere,
	storedValidationMeasure
} from '#lib/utils/storedState.js';
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

// The stored state, or an empty one when it is not an object (#127). Each getter checks its field:
// see storedState.js.
const state = () => storedObject(_store.value);

export const trajectoryValidation = {
	get range() { return storedRange(state().range); },
	get measure() { return storedValidationMeasure(state().measure); },
	// State saved before this field existed has no direction: read it as below.
	get direction() { return this.measure.direction; },
	get solveFor() { return storedSolveFor(state().solveFor); },
	get atmosphere() { return storedValidationAtmosphere(state().atmosphere, ISA_DEFAULTS); },
	setRange(patch) {
		_store.value = { ...state(), range: { ...this.range, ...patch } };
	},
	setMeasure(patch) {
		_store.value = { ...state(), measure: { ...this.measure, ...patch } };
	},
	setSolveFor(val) {
		_store.value = { ...state(), solveFor: val };
	},
	setAtmosphere(patch) {
		const updated = { ...this.atmosphere, ...patch };
		if (updated.useISA) Object.assign(updated, ISA_DEFAULTS, { useISA: true });
		_store.value = { ...state(), atmosphere: updated };
	}
};
