import { WIND_FROM_TARGET, migrateStoredWind, pageWind, patchWind } from '#lib/utils/storedWind.js';
import {
	storedAtmosphere,
	storedBallisticOptions,
	storedObject,
	storedRange
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

const DEFAULT_COLUMNS = ['rangeYd', 'elevIn', 'elevMOA', 'velFps', 'energyFtlb', 'time'];

// Direction where the wind comes from, since #106: 90 is from the right.
const DEFAULT_WIND = { speed: '0', speedUnit: 'mph', direction: '90', directionConvention: WIND_FROM_TARGET };

const DEFAULT_OPTIONS = {
	showAtmosphere: false,
	showWind: false,
	showVelocityChart: false,
	showAnnotations: true,
	visibleColumns: DEFAULT_COLUMNS,
	velChartUnit: 'fps'
};

const store = localStore('zro-ballistic', () => ({
	range: { distance: '500', unit: 'yd', step: '25' },
	atmosphere: { useISA: true, ...ISA_DEFAULTS },
	wind: DEFAULT_WIND,
	options: DEFAULT_OPTIONS
}));

// The stored state, or an empty one when it is not an object (#120). Each getter checks its field:
// see storedState.js.
const state = () => storedObject(store.value);

// One-time migration of the direction to where the wind comes from (#106). A wind already converted
// comes back as the same object, so nothing is written.
const migratedWind = migrateStoredWind(state().wind);
if (migratedWind !== state().wind) {
	store.value = { ...state(), wind: migratedWind };
}

export const ballistic = {
	get range() {
		return storedRange(state().range, { step: true });
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
	get options() {
		return storedBallisticOptions(state().options, DEFAULT_OPTIONS);
	},

	setRange(patch) {
		store.value = { ...state(), range: { ...this.range, ...patch } };
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
	setOptions(patch) {
		store.value = { ...state(), options: { ...this.options, ...patch } };
	},
	toggleColumn(col) {
		const cols = this.options.visibleColumns;
		const next = cols.includes(col) ? cols.filter((c) => c !== col) : [...cols, col];
		this.setOptions({ visibleColumns: next });
	},
	resetAtmosphere() {
		store.value = { ...state(), atmosphere: { useISA: true, ...ISA_DEFAULTS } };
	}
};
