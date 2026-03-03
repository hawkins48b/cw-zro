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

const store = localStore('zro-scope-view', () => ({
	range: { distance: '500', unit: 'yd' },
	elevation: { angle: '0', unit: 'deg' },
	atmosphere: { useISA: true, ...ISA_DEFAULTS },
	wind: { speed: '0', speedUnit: 'mph', direction: '90' },
	rotation: 0
}));

// One-time migration: convert stored clock direction to degrees
if (store.value.wind?.directionUnit !== undefined) {
	const w = store.value.wind;
	const deg =
		w.directionUnit === 'clock'
			? String((parseInt(w.direction || '12') % 12) * 30)
			: w.direction;
	store.value = { ...store.value, wind: { speed: w.speed, speedUnit: w.speedUnit, direction: deg } };
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
	get wind() {
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
		store.value = { ...store.value, wind: { ...store.value.wind, ...patch } };
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
