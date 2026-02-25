import { localStore } from './localStore.svelte.js';

const DEFAULT_PROFILE = {
	name: 'Example Colt M4',
	barrelTwist: '',
	barrelTwistUnit: 'in',
	opticName: 'Aimpoint CompM2',
	opticHeight: '3.5',
	opticHeightUnit: 'in',
	zeroDist: 25,
	zeroUnit: 'yd',
	bulletBrand: 'M193',
	bulletDiameter: '0.223',
	bulletDiameterUnit: 'in',
	bulletWeight: '55',
	bulletWeightUnit: 'gr',
	bcType: 'G1',
	bc: '0.285',
	bulletLength: '',
	bulletLengthUnit: 'in',
	velocity: '3000',
	velocityUnit: 'fps',
	temperature: '59',
	temperatureUnit: 'f',
	tempModifier: '',
	spinDrift: false,
	tempSensitivity: false,
	ammo: 'M193 55\u202fgr',
	optic: 'Aimpoint CompM2'
};

const store = localStore('zro-profiles', () => [{ ...DEFAULT_PROFILE, id: crypto.randomUUID() }]);

export const profiles = {
	get list() {
		return store.value;
	},
	add(profile) {
		const id = crypto.randomUUID();
		store.value.push({ ...profile, id });
		store.persist();
		return id;
	},
	update(id, data) {
		const i = store.value.findIndex((p) => p.id === id);
		if (i === -1) return false;
		store.value[i] = { ...store.value[i], ...data, id };
		store.persist();
		return true;
	},
	remove(id) {
		const i = store.value.findIndex((p) => p.id === id);
		if (i === -1) return false;
		store.value.splice(i, 1);
		store.persist();
		return true;
	},
	get(id) {
		return store.value.find((p) => p.id === id);
	}
};
