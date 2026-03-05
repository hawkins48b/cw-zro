import { localStore } from './localStore.svelte.js';

const store = localStore('zro-mpbr', () => ({
	target: { size: '8', unit: 'in' }
}));

export const mpbr = {
	get target() {
		return store.value.target;
	},
	setTarget(patch) {
		store.value = { ...store.value, target: { ...store.value.target, ...patch } };
	}
};
