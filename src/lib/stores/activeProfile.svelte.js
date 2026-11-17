import { canDeleteProfile, nextActiveAfterDelete } from '#lib/utils/profileOps.js';
import { storedProfileId } from '#lib/utils/storedProfiles.js';
import { localStore } from './localStore.svelte.js';
import { profiles } from './profiles.svelte.js';

// profiles is imported first, so it has rewritten a stored id renumbered for links (#134) before
// this store reads it.
// Not seeded (#150): a first run that leaves the Welcome or the setup writes nothing to storage.
const store = localStore('zro-active-profile', () => profiles.list[0]?.id ?? null, { seed: false });

export const activeProfile = {
	get id() {
		// A stored id that was renumbered on read (#134) still finds its profile, under its new id.
		const found = profiles.findStored(storedProfileId(store.value));
		return found ? found.id : (profiles.list[0]?.id ?? null);
	},
	setActive(id) {
		store.value = id;
	},
	get profile() {
		return profiles.findStored(storedProfileId(store.value)) || profiles.list[0] || null;
	}
};

/**
 * Deletes a profile (#166). Refused when it is the last profile (canDeleteProfile) or not found.
 * Deleting the profile in use first makes the next one in list order active, else the previous one
 * (nextActiveAfterDelete). Here, not in the profiles store, which cannot import this one.
 * @param {string} id
 * @returns {boolean} whether the profile was deleted
 */
export function deleteProfile(id) {
	const list = profiles.list;
	if (!canDeleteProfile(list) || !list.some((p) => p.id === id)) return false;
	if (activeProfile.id === id) activeProfile.setActive(nextActiveAfterDelete(list, id));
	return profiles.remove(id);
}
