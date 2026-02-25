import { localStore } from './localStore.svelte.js';
import { profiles } from './profiles.svelte.js';

const store = localStore('zro-active-profile', () => profiles.list[0]?.id ?? null);

export const activeProfile = {
	get id() {
		const id = store.value;
		if (id && profiles.get(id)) return id;
		return profiles.list[0]?.id ?? null;
	},
	setActive(id) {
		store.value = id;
	},
	get profile() {
		const id = store.value;
		return (id && profiles.get(id)) || profiles.list[0] || null;
	}
};
