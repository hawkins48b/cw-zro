import {
	ISA_ATMOSPHERE,
	patchedAtmosphere,
	storedObject,
	storedRange,
	storedSolveFor,
	storedValidationAtmosphere,
	storedValidationMeasure
} from '#lib/utils/storedState.js';
import { localStore } from './localStore.svelte.js';

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
	atmosphere: { ...ISA_ATMOSPHERE }
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
	/** ISA / Estimate / Accurate as on the Scope View (#194): hand it to scopeAtmosphereParams. */
	get atmosphere() { return storedValidationAtmosphere(state().atmosphere); },
	setRange(patch) {
		_store.value = { ...state(), range: { ...this.range, ...patch } };
	},
	setMeasure(patch) {
		_store.value = { ...state(), measure: { ...this.measure, ...patch } };
	},
	setSolveFor(val) {
		_store.value = { ...state(), solveFor: val };
	},
	/** Change the atmosphere as the Scope View does: see patchedAtmosphere in storedState.js. */
	setAtmosphere(patch) {
		_store.value = { ...state(), atmosphere: patchedAtmosphere(this.atmosphere, patch) };
	}
};
