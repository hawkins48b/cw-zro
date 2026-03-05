let pending = $state(null);

export const ammoSelection = {
	get pending() { return pending; },
	set(ammo) { pending = ammo; },
	clear() { pending = null; }
};
