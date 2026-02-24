import { browser } from '$app/environment';

const STORAGE_KEY = 'zro-profiles';

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

function load() {
	if (!browser) return [];
	try {
		const raw = localStorage.getItem(STORAGE_KEY);
		if (raw) return JSON.parse(raw);
		// Seed default profile on first launch
		const defaults = [{ ...DEFAULT_PROFILE, id: crypto.randomUUID() }];
		localStorage.setItem(STORAGE_KEY, JSON.stringify(defaults));
		return defaults;
	} catch {
		return [];
	}
}

function save(data) {
	if (!browser) return;
	localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
}

let list = $state(load());

export const profiles = {
	get list() {
		return list;
	},
	add(profile) {
		const id = crypto.randomUUID();
		list.push({ ...profile, id });
		save(list);
		return id;
	},
	update(id, data) {
		const i = list.findIndex((p) => p.id === id);
		if (i === -1) return false;
		list[i] = { ...list[i], ...data, id };
		save(list);
		return true;
	},
	remove(id) {
		const i = list.findIndex((p) => p.id === id);
		if (i === -1) return false;
		list.splice(i, 1);
		save(list);
		return true;
	},
	get(id) {
		return list.find((p) => p.id === id);
	}
};
