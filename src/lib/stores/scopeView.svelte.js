import { migrateClockWind, pageWind, patchWind } from '#lib/utils/storedWind.js';
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

// One-time migration: convert stored clock direction to degrees
if (store.value.wind?.directionUnit !== undefined) {
	store.value = { ...store.value, wind: migrateClockWind(store.value.wind) };
}

export const scopeView = {
	get range() {
		return store.value.range;
	},
	get elevation() {
		return store.value.elevation;
	},
	get atmosphere() {
		return store.value.atmosphere;
	},
	/** The wind to show. Never hand this to a calculator: use storedWind. */
	get wind() {
		return pageWind(store.value.wind, DEFAULT_WIND);
	},
	/** The wind as stored, for the calculators: shotWinds decides what a damaged value gives. */
	get storedWind() {
		return store.value.wind;
	},
	get rotation() {
		return store.value.rotation ?? 0;
	},

	setRange(patch) {
		store.value = { ...store.value, range: { ...store.value.range, ...patch } };
	},
	setElevation(patch) {
		store.value = { ...store.value, elevation: { ...store.value.elevation, ...patch } };
	},
	setAtmosphere(patch) {
		if (patch.useISA === true) {
			store.value = { ...store.value, atmosphere: { useISA: true, ...ISA_DEFAULTS } };
		} else {
			store.value = { ...store.value, atmosphere: { ...store.value.atmosphere, ...patch } };
		}
	},
	setWind(patch) {
		store.value = { ...store.value, wind: patchWind(store.value.wind, patch, DEFAULT_WIND) };
	},
	setRotation(angle) {
		store.value = { ...store.value, rotation: angle };
	},
	resetRotation() {
		store.value = { ...store.value, rotation: 0 };
	},
	resetAtmosphere() {
		store.value = {
			...store.value,
			atmosphere: { useISA: true, ...ISA_DEFAULTS }
		};
	}
};
