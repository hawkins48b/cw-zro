import { WIND_FROM_TARGET, migrateStoredWind, pageWind, patchWind } from '#lib/utils/storedWind.js';
import {
	storedElevation,
	storedObject,
	storedRange,
	storedResultMode,
	storedRotation,
	storedScopeAtmosphere
} from '#lib/utils/storedState.js';
import { isAtmosphereMode } from '#lib/utils/scopeAtmosphere.js';
import { activeWindPreset, windPresetSpeed } from '#lib/utils/windPreset.js';
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

// The standard atmosphere with its default boxes, weather and pressure reference (#148). useISA is
// kept beside the mode, so state written now reads the same in a build from before #148.
const ISA_ATMOSPHERE = { useISA: true, mode: 'isa', weather: 'cloudy', pressureRef: 'qnh', ...ISA_DEFAULTS };

// Direction where the wind comes from, since #106: 90 is from the right.
const DEFAULT_WIND = { speed: '0', speedUnit: 'mph', direction: '90', directionConvention: WIND_FROM_TARGET };

const store = localStore('zro-scope-view', () => ({
	range: { distance: '500', unit: 'yd' },
	elevation: { angle: '0', unit: 'deg' },
	atmosphere: { ...ISA_ATMOSPHERE },
	wind: DEFAULT_WIND,
	rotation: 0,
	resultMode: 'dial'
}));

// The stored state, or an empty one when it is not an object (#120). Each getter checks its field:
// see storedState.js.
const state = () => storedObject(store.value);

// One-time migrations: a stored clock direction to degrees, then the direction to where the wind
// comes from (#106). A wind already converted comes back as the same object, so nothing is written.
const migratedWind = migrateStoredWind(state().wind, { clock: true });
if (migratedWind !== state().wind) {
	store.value = { ...state(), wind: migratedWind };
}

export const scopeView = {
	get range() {
		return storedRange(state().range);
	},
	get elevation() {
		return storedElevation(state().elevation);
	},
	/** The boxes, plus mode, weather and pressureRef (#148). Hand it to scopeAtmosphereParams. */
	get atmosphere() {
		return storedScopeAtmosphere(state().atmosphere);
	},
	/** The wind to show. Never hand this to a calculator: use storedWind. */
	get wind() {
		return pageWind(state().wind, DEFAULT_WIND);
	},
	/** The wind as stored, for the calculators: shotWinds decides what a damaged value gives. */
	get storedWind() {
		return state().wind;
	},
	/** The preset the shown wind speed matches in its unit, or null (#148). */
	get windPreset() {
		const wind = this.wind;
		return activeWindPreset(wind.speed, wind.speedUnit);
	},
	/** 'dial' or 'hold' (#148). */
	get resultMode() {
		return storedResultMode(state().resultMode);
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
	/**
	 * Change the atmosphere. `useISA: true` resets it to the standard atmosphere, as before #148;
	 * `useISA: false` is the accurate mode. A `mode` changes the mode only: the boxes are kept, so
	 * switching back shows what the user entered. useISA is written to match the mode.
	 */
	setAtmosphere(patch) {
		if (patch.useISA === true) {
			store.value = { ...state(), atmosphere: { ...ISA_ATMOSPHERE } };
			return;
		}
		const { useISA, ...rest } = patch;
		const next = { ...this.atmosphere, ...rest };
		if (useISA === false && rest.mode === undefined) next.mode = 'accurate';
		if (!isAtmosphereMode(next.mode)) next.mode = this.atmosphere.mode;
		next.useISA = next.mode === 'isa';
		store.value = { ...state(), atmosphere: next };
	},
	setWind(patch) {
		store.value = { ...state(), wind: patchWind(state().wind, patch, DEFAULT_WIND) };
	},
	/** Set the speed of a preset in the speed unit shown; the direction stays (#148). */
	applyWindPreset(preset) {
		const speed = windPresetSpeed(preset, this.wind.speedUnit);
		if (speed !== null) this.setWind({ speed });
	},
	setResultMode(mode) {
		store.value = { ...state(), resultMode: storedResultMode(mode) };
	},
	setRotation(angle) {
		store.value = { ...state(), rotation: angle };
	},
	resetRotation() {
		store.value = { ...state(), rotation: 0 };
	},
	resetAtmosphere() {
		store.value = { ...state(), atmosphere: { ...ISA_ATMOSPHERE } };
	}
};
