import { storedMpbrTarget, storedObject } from '#lib/utils/storedState.js';
import { localStore } from './localStore.svelte.js';

const store = localStore('zro-mpbr', () => ({
	target: { size: '8', unit: 'in' }
}));

// The stored state, or an empty one when it is not an object (#127). The target is checked when it
// is read: see storedState.js.
const state = () => storedObject(store.value);

export const mpbr = {
	get target() {
		return storedMpbrTarget(state().target);
	},
	setTarget(patch) {
		store.value = { ...state(), target: { ...this.target, ...patch } };
	}
};
