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

const store = localStore('zro-ballistic', () => ({
	range: { distance: '500', unit: 'yd', step: '25' },
	atmosphere: { useISA: true, ...ISA_DEFAULTS },
	wind: { speed: '0', speedUnit: 'mph', direction: '90' },
	options: {
		showAtmosphere: false,
		showWind: false,
		showVelocityChart: false,
		showAnnotations: true,
		visibleColumns: DEFAULT_COLUMNS,
		velChartUnit: 'fps'
	}
}));

export const ballistic = {
	get range() {
		return store.value.range;
	},
	get atmosphere() {
		return store.value.atmosphere;
	},
	get wind() {
		return store.value.wind;
	},
	get options() {
		return store.value.options;
	},

	setRange(patch) {
		store.value = { ...store.value, range: { ...store.value.range, ...patch } };
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
	setOptions(patch) {
		store.value = { ...store.value, options: { ...store.value.options, ...patch } };
	},
	toggleColumn(col) {
		const cols = store.value.options.visibleColumns ?? DEFAULT_COLUMNS;
		const next = cols.includes(col) ? cols.filter((c) => c !== col) : [...cols, col];
		this.setOptions({ visibleColumns: next });
	},
	resetAtmosphere() {
		store.value = { ...store.value, atmosphere: { useISA: true, ...ISA_DEFAULTS } };
	}
};
