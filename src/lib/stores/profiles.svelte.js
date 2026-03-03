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
	reticleType: 'red-dot',
	elevationClickValue: '0.5',
	elevationClickUnit: 'MOA',
	windageClickValue: '0.5',
	windageClickUnit: 'MOA',
	clickLink: true,
	ammo: 'M193 55\u202fgr',
	optic: 'Aimpoint CompM2'
};

const store = localStore('zro-profiles', () => [{ ...DEFAULT_PROFILE, id: crypto.randomUUID() }]);

// One-time migration: add optic click adjustment fields to profiles that lack them
if (Array.isArray(store.value)) {
	let migrated = false;
	for (const p of store.value) {
		if (p.reticleType === undefined) {
			p.reticleType = 'red-dot';
			p.elevationClickValue = '0.5';
			p.elevationClickUnit = 'MOA';
			p.windageClickValue = '0.5';
			p.windageClickUnit = 'MOA';
			p.clickLink = true;
			migrated = true;
		}
	}
	if (migrated) store.persist();
}

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
