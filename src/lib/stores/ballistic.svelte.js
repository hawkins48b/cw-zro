import { WIND_FROM_TARGET, migrateStoredWind, pageWind, patchWind } from '#lib/utils/storedWind.js';
import {
	ISA_ATMOSPHERE,
	patchedAtmosphere,
	storedBallisticAtmosphere,
	storedBallisticOptions,
	storedObject,
	storedRange
} from '#lib/utils/storedState.js';
import { activeWindPreset, windPresetSpeed } from '#lib/utils/windPreset.js';
import { localStore } from './localStore.svelte.js';

const DEFAULT_COLUMNS = ['rangeYd', 'elevIn', 'elevMOA', 'velFps', 'energyFtlb', 'time'];

// Direction where the wind comes from, since #106: 90 is from the right.
const DEFAULT_WIND = { speed: '0', speedUnit: 'mph', direction: '90', directionConvention: WIND_FROM_TARGET };

const DEFAULT_OPTIONS = {
	showAnnotations: true,
	visibleColumns: DEFAULT_COLUMNS,
	velChartUnit: 'fps',
	// The chart of the Bullet Path card (#151): 'drop' or 'velocity'.
	chartMode: 'drop'
};

const store = localStore('zro-ballistic', () => ({
	range: { distance: '500', unit: 'yd', step: '25' },
	atmosphere: { ...ISA_ATMOSPHERE },
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
	/**
	 * The boxes, plus mode, weather and pressureRef, as on the Scope View (#151). Hand it to
	 * scopeAtmosphereParams. State saved before #151 reads as the page computed it then.
	 */
	get atmosphere() {
		return storedBallisticAtmosphere(state().atmosphere);
	},
	/** The wind to show. Never hand this to a calculator: use storedWind. */
	get wind() {
		return pageWind(state().wind, DEFAULT_WIND);
	},
	/** The wind as stored, for the calculators: shotWinds decides what a damaged value gives. */
	get storedWind() {
		return state().wind;
	},
	/** The preset the shown wind speed matches in its unit, or null (#151, as the Scope View). */
	get windPreset() {
		const wind = this.wind;
		return activeWindPreset(wind.speed, wind.speedUnit);
	},
	get options() {
		return storedBallisticOptions(state().options, DEFAULT_OPTIONS);
	},

	setRange(patch) {
		store.value = { ...state(), range: { ...this.range, ...patch } };
	},
	/** Change the atmosphere as the Scope View does: see patchedAtmosphere in storedState.js. */
	setAtmosphere(patch) {
		store.value = { ...state(), atmosphere: patchedAtmosphere(this.atmosphere, patch) };
	},
	setWind(patch) {
		store.value = { ...state(), wind: patchWind(state().wind, patch, DEFAULT_WIND) };
	},
	/** Set the speed of a preset in the speed unit shown; the direction stays (#151). */
	applyWindPreset(preset) {
		const speed = windPresetSpeed(preset, this.wind.speedUnit);
		if (speed !== null) this.setWind({ speed });
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
		store.value = { ...state(), atmosphere: { ...ISA_ATMOSPHERE } };
	}
};
