import { addProfile, removeProfile, updateProfile } from '#lib/utils/profileOps.js';
import {
	findProfileIdRenames,
	normalizeProfiles,
	profileForStoredId,
	renameActiveProfileId,
	renameCompareEntries
} from '#lib/utils/storedProfiles.js';
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

/**
 * Stored ids renumbered so that a link can carry them (#134), from the list as stored at load.
 * @type {ReadonlyMap<string, string>}
 */
const renamedProfileIds = findProfileIdRenames(store.value);

// The stored references to a profile id, the active profile and the Compare Trajectories entries,
// are rewritten to the new ids here, in the same step as the renumbered list is written below,
// whichever page the session starts on (security review of #134). Their stores import this module,
// so they are not loaded yet and read the rewritten values when they load. These are the same keys
// and the same localStore (JSON in localStorage) those stores use; nothing is written for a missing
// key (seed off) or when no reference changes, and damaged values are left as stored.
if (renamedProfileIds.size > 0) {
	const active = localStore('zro-active-profile', null, { seed: false });
	const activeId = renameActiveProfileId(active.value, renamedProfileIds);
	if (activeId !== active.value) active.value = activeId;
	const compare = localStore('zro-compare-traj', null, { seed: false });
	const compareState = renameCompareEntries(compare.value, renamedProfileIds);
	if (compareState !== compare.value) compare.value = compareState;
}

// One-time migration: add optic click adjustment fields to profiles that lack them, and write the
// ids renumbered for links (#134). It writes the usable list, as a save does: readList can give a copy of a profile (an id read as text, #131), so
// a change made in place would not reach storage.
{
	const CLICK_DEFAULTS = {
		reticleType: 'red-dot',
		elevationClickValue: '0.5',
		elevationClickUnit: 'MOA',
		windageClickValue: '0.5',
		windageClickUnit: 'MOA',
		clickLink: true
	};
	const list = readList();
	if (renamedProfileIds.size > 0 || list.some((p) => p.reticleType === undefined)) {
		store.value = list.map((p) => (p.reticleType === undefined ? { ...p, ...CLICK_DEFAULTS } : p));
	}
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
	},
	/**
	 * The profile a stored reference points at (active profile, compare entry), also when its id
	 * was renumbered on read (#134). Pages that look up an id from a link use get.
	 */
	findStored(id) {
		return profileForStoredId(store.value, id);
	}
};
