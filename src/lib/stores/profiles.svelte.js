import { addProfile, removeProfile, updateProfile } from '#lib/utils/profileOps.js';
import { normalizeProfiles } from '#lib/utils/storedProfiles.js';
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

/** The usable stored profiles (#120): storage can hold any JSON value. */
const readList = () => normalizeProfiles(store.value);

// One-time migration: add optic click adjustment fields to profiles that lack them
{
	let migrated = false;
	for (const p of readList()) {
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

// The list operations are those of profileOps.js, which is tested. A write keeps only the usable
// profiles, so a damaged list is replaced by a usable one when the user saves.
export const profiles = {
	/** The profiles as stored, for the calculators. Pages show them through shownProfile. */
	get list() {
		return readList();
	},
	add(profile) {
		const { list, id } = addProfile(readList(), profile);
		store.value = list;
		return id;
	},
	update(id, data) {
		const { list, success } = updateProfile(readList(), id, data);
		if (success) store.value = list;
		return success;
	},
	remove(id) {
		const { list, removed } = removeProfile(readList(), id);
		if (removed) store.value = list;
		return removed;
	},
	get(id) {
		return readList().find((p) => p.id === id);
	}
};
