import { browser } from '$app/environment';

const STORAGE_KEY = 'zro-profiles';

function load() {
	if (!browser) return [];
	try {
		const raw = localStorage.getItem(STORAGE_KEY);
		return raw ? JSON.parse(raw) : [];
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
