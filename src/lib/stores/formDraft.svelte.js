let pending = $state(null);

export const formDraft = {
	get pending() { return pending; },
	save(data) { pending = data; },
	clear() { pending = null; }
};
