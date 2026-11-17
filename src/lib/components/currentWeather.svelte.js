import { onDestroy } from 'svelte';
import { getLocale } from '#lib/paraglide/runtime.js';
import {
	createWeatherFill,
	isCurrentWeatherAvailable,
	readCurrentWeather,
	weatherTime
} from '#lib/utils/currentWeather.js';

/**
 * "Use current weather here" for a page with ScopeAtmosphereCard (#152): the Scope View and the
 * Ballistic page. Call it during component init. Nothing is asked or sent until request() runs,
 * which only the card's button calls. The logic is in utils/currentWeather.js.
 *
 * @param {{ atmosphere: { mode: string }, setAtmosphere: (patch: object) => void }} store
 * @param {{ env?: typeof globalThis }} [options] - for tests: the window the browser APIs come from
 */
export function useCurrentWeather(store, { env = globalThis } = {}) {
	let status = $state({ state: 'idle' });

	const fill = createWeatherFill({
		read: ({ signal }) =>
			readCurrentWeather({ geolocation: env.navigator?.geolocation, fetch: env.fetch?.bind(env), signal }),
		getAtmosphere: () => store.atmosphere,
		apply: (patch) => store.setAtmosphere(patch),
		onstatus: (next) => (status = next),
		formatTime: (date) => weatherTime(date, getLocale())
	});

	// Leaving the Accurate mode drops a running request and the line under the button.
	$effect(() => {
		if (store.atmosphere.mode !== 'accurate') fill.cancel();
	});
	// Leaving the page: a late answer writes nothing.
	onDestroy(() => fill.dispose());

	return {
		/** Whether the card shows the button: not on the desktop build, nor without geolocation. */
		available: isCurrentWeatherAvailable(env),
		get status() {
			return status;
		},
		request: () => fill.request(),
		/**
		 * The card's onchange, with the status reset of a change after a fill.
		 * @param {Record<string, unknown>} patch
		 */
		onchange(patch) {
			fill.changed(patch);
			store.setAtmosphere(patch);
		}
	};
}
