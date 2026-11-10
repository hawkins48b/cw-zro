import { migrateClockWind, pageWind, patchWind } from '#lib/utils/storedWind.js';
import {
	storedAtmosphere,
	storedElevation,
	storedObject,
	storedRange,
	storedRotation
} from '#lib/utils/storedState.js';
import { localStore } from './localStore.svelte.js';

const ISA_DEFAULTS = {
	altitude: '0',
	altitudeUnit: 'ft',
	pressure: '29.92',
	pressureUnit: 'inhg',
	temperature: '59',
	temperatureUnit: 'f',
	humidity: '0'
};

const DEFAULT_WIND = { speed: '0', speedUnit: 'mph', direction: '90' };

const store = localStore('zro-scope-view', () => ({
	range: { distance: '500', unit: 'yd' },
	elevation: { angle: '0', unit: 'deg' },
	atmosphere: { useISA: true, ...ISA_DEFAULTS },
	wind: DEFAULT_WIND,
	rotation: 0
}));

// The stored state, or an empty one when it is not an object (#120). Each getter checks its field:
// see storedState.js.
const state = () => storedObject(store.value);

// One-time migration: convert stored clock direction to degrees
if (state().wind?.directionUnit !== undefined) {
	store.value = { ...state(), wind: migrateClockWind(state().wind) };
}

export const scopeView = {
	get range() {
		return storedRange(state().range);
	},
	get elevation() {
		return storedElevation(state().elevation);
	},
	get atmosphere() {
		return storedAtmosphere(state().atmosphere);
	},
	/** The wind to show. Never hand this to a calculator: use storedWind. */
	get wind() {
		return pageWind(state().wind, DEFAULT_WIND);
	},
	/** The wind as stored, for the calculators: shotWinds decides what a damaged value gives. */
	get storedWind() {
		return state().wind;
	},
	/** The cant in degrees: 0 unless a finite number within the slider's range is stored. */
	get rotation() {
		return storedRotation(state().rotation);
	},

	setRange(patch) {
		store.value = { ...state(), range: { ...this.range, ...patch } };
	},
	setElevation(patch) {
		store.value = { ...state(), elevation: { ...this.elevation, ...patch } };
	},
	setAtmosphere(patch) {
		if (patch.useISA === true) {
			store.value = { ...state(), atmosphere: { useISA: true, ...ISA_DEFAULTS } };
		} else {
			store.value = { ...state(), atmosphere: { ...this.atmosphere, ...patch } };
		}
	},
	setWind(patch) {
		store.value = { ...state(), wind: patchWind(state().wind, patch, DEFAULT_WIND) };
	},
	setRotation(angle) {
		store.value = { ...state(), rotation: angle };
	},
	resetRotation() {
		store.value = { ...state(), rotation: 0 };
	},
	resetAtmosphere() {
		store.value = {
			...state(),
			atmosphere: { useISA: true, ...ISA_DEFAULTS }
		};
	}
};
