import { WIND_FROM_TARGET, migrateStoredWind, pageWind, patchWind } from '#lib/utils/storedWind.js';
import { ISA_ATMOSPHERE, patchedAtmosphere, storedObject, storedScopeAtmosphere } from '#lib/utils/storedState.js';
import {
	DEFAULT_TUTORIAL_DISTANCE,
	DEFAULT_SCENE_WEATHER,
	defaultQuality,
	storedQuality,
	storedSceneWeather,
	storedTerrain,
	storedTutorialRange
} from '#lib/utils/storedTutorial.js';
import { activeWindPreset, windPresetSpeed } from '#lib/utils/windPreset.js';
import { activeProfile } from './activeProfile.svelte.js';
import { localStore } from './localStore.svelte.js';

/**
 * The 3D ballistic tutorial's own saved state (#182, owner decision of 2026-11-17): not the
 * Ballistic page's nor the Scope View's. Same shape and rules as scopeView.svelte.js, so the shared
 * wind and atmosphere cards and useCurrentWeather take it as they take the Scope View store.
 *
 * - range: target distance along the line of sight, `m` or `yd`;
 * - terrain: shooter altitude (terrain only: the ballistics use the Atmosphere card) and target
 *   elevation relative to the shooter, in one height unit, `m` or `ft`;
 * - atmosphere and wind: as on the Scope View;
 * - weather and quality: the picture only.
 *
 * The first state follows the units of the profile in use (its zero unit: metres and m/s, or yards,
 * feet and mph), and the quality of the device (defaultQuality: Low on phones). It is stored at
 * once, so the quality is remembered. The Capacitor apps have no tutorial (#182).
 */
function defaults() {
	const metric = activeProfile.profile?.zeroUnit !== 'yd';
	return {
		range: { distance: DEFAULT_TUTORIAL_DISTANCE, unit: metric ? 'm' : 'yd' },
		terrain: { altitude: '0', elevation: '0', unit: metric ? 'm' : 'ft' },
		atmosphere: { ...ISA_ATMOSPHERE },
		wind: defaultWind(metric),
		weather: DEFAULT_SCENE_WEATHER,
		quality: defaultQuality()
	};
}

/** Direction where the wind comes from (#106): 90 is from the right. */
const defaultWind = (metric) => ({
	speed: '0',
	speedUnit: metric ? 'mps' : 'mph',
	direction: '90',
	directionConvention: WIND_FROM_TARGET
});

const store = localStore('zro-ballistic-tutorial', defaults);

/** The stored state, or an empty one when it is not an object (#120). */
const state = () => storedObject(store.value);

/** The wind shown when the stored one is not a wind object. */
const fallbackWind = () => defaultWind(storedTutorialRange(state().range).unit === 'm');

// A wind stored without the from-target marker is converted once, as on the other pages (#106).
// The tutorial never stored one, so this only runs on a state edited by hand.
const migratedWind = migrateStoredWind(state().wind);
if (migratedWind !== state().wind) {
	store.value = { ...state(), wind: migratedWind };
}

export const ballisticTutorial = {
	/** Target distance along the line of sight. */
	get range() {
		return storedTutorialRange(state().range);
	},
	/** Shooter altitude and target elevation. */
	get terrain() {
		return storedTerrain(state().terrain);
	},
	/** The boxes, plus mode, weather and pressureRef. Hand it to scopeAtmosphereParams. */
	get atmosphere() {
		return storedScopeAtmosphere(state().atmosphere);
	},
	/** The wind to show. Never hand this to a calculator: use storedWind. */
	get wind() {
		return pageWind(state().wind, fallbackWind());
	},
	/** The wind as stored, for the calculators: shotWinds decides what a damaged value gives. */
	get storedWind() {
		return state().wind;
	},
	/** The preset the shown wind speed matches in its unit, or null. */
	get windPreset() {
		const wind = this.wind;
		return activeWindPreset(wind.speed, wind.speedUnit);
	},
	/** The scene weather (visual only). */
	get weather() {
		return storedSceneWeather(state().weather);
	},
	/** The scene quality. A damaged value is the device's default. */
	get quality() {
		return storedQuality(state().quality, defaultQuality());
	},

	setRange(patch) {
		store.value = { ...state(), range: { ...this.range, ...patch } };
	},
	setTerrain(patch) {
		store.value = { ...state(), terrain: { ...this.terrain, ...patch } };
	},
	/** Change the atmosphere: see patchedAtmosphere in storedState.js. */
	setAtmosphere(patch) {
		store.value = { ...state(), atmosphere: patchedAtmosphere(this.atmosphere, patch) };
	},
	setWind(patch) {
		store.value = { ...state(), wind: patchWind(state().wind, patch, fallbackWind()) };
	},
	/** Set the speed of a preset in the speed unit shown; the direction stays. */
	applyWindPreset(preset) {
		const speed = windPresetSpeed(preset, this.wind.speedUnit);
		if (speed !== null) this.setWind({ speed });
	},
	setWeather(weather) {
		store.value = { ...state(), weather: storedSceneWeather(weather) };
	},
	setQuality(quality) {
		store.value = { ...state(), quality: storedQuality(quality, this.quality) };
	},
	resetAtmosphere() {
		store.value = { ...state(), atmosphere: { ...ISA_ATMOSPHERE } };
	}
};
