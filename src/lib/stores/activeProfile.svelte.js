import { storedProfileId } from '#lib/utils/storedProfiles.js';
import { localStore } from './localStore.svelte.js';
import { profiles } from './profiles.svelte.js';

// profiles is imported first, so it has rewritten a stored id renumbered for links (#134) before
// this store reads it.
const store = localStore('zro-active-profile', () => profiles.list[0]?.id ?? null);

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
