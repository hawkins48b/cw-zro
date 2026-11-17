/**
 * Reading the stored state of the 3D ballistic tutorial (#182), store `zro-ballistic-tutorial`.
 *
 * The rules are those of storedState.js (#120): localStorage can hold any JSON value, so each field
 * is checked when it is read. A distance or a height that is not a number or text is an empty box,
 * which gives no trajectory (distance) or reads as 0 (elevation, altitude), and the page shows its
 * message. Units are read as the calculators read them: `m`, anything else is the other unit. The
 * scene settings (weather, quality) only change the picture, so a damaged one falls back to its
 * default.
 */
import { storedObject, storedText } from './storedState.js';

/** Default target distance, in the unit of the range (#180: 300 m or yd). */
export const DEFAULT_TUTORIAL_DISTANCE = '300';

/** The scene weathers: the Atmosphere card's values, visual only (#180). */
export const SCENE_WEATHERS = Object.freeze(['sunny', 'cloudy', 'rain', 'snow']);

/** The scene qualities (#182). */
export const SCENE_QUALITIES = Object.freeze(['low', 'medium', 'high']);

/** Weather of a new or damaged state. */
export const DEFAULT_SCENE_WEATHER = 'sunny';

/**
 * A stored range: `{ distance, unit }`, unit `m` or else `yd`.
 * @param {unknown} stored
 * @returns {{ distance: string|number, unit: 'm'|'yd' }}
 */
export function storedTutorialRange(stored) {
	const range = storedObject(stored);
	return { distance: storedText(range.distance), unit: range.unit === 'm' ? 'm' : 'yd' };
}

/**
 * The stored terrain: shooter altitude and target elevation, in one height unit, `m` or else `ft`.
 * @param {unknown} stored
 * @returns {{ altitude: string|number, elevation: string|number, unit: 'm'|'ft' }}
 */
export function storedTerrain(stored) {
	const terrain = storedObject(stored);
	return {
		altitude: storedText(terrain.altitude),
		elevation: storedText(terrain.elevation),
		unit: terrain.unit === 'm' ? 'm' : 'ft'
	};
}

/**
 * The stored scene weather: one of SCENE_WEATHERS, else DEFAULT_SCENE_WEATHER.
 * @param {unknown} stored
 * @returns {'sunny'|'cloudy'|'rain'|'snow'}
 */
export function storedSceneWeather(stored) {
	return /** @type {any} */ (SCENE_WEATHERS.includes(/** @type {any} */ (stored)) ? stored : DEFAULT_SCENE_WEATHER);
}

/**
 * The stored quality: one of SCENE_QUALITIES, else `fallback`.
 * @param {unknown} stored
 * @param {'low'|'medium'|'high'} fallback
 * @returns {'low'|'medium'|'high'}
 */
export function storedQuality(stored, fallback) {
	return /** @type {any} */ (SCENE_QUALITIES.includes(/** @type {any} */ (stored)) ? stored : fallback);
}

/** Widest screen still taken for a phone, in CSS pixels, not included (owner decision of 2026-11-17). */
export const PHONE_MAX_WIDTH = 768;

/**
 * Whether the device is taken for a phone (owner decision of 2026-11-17): a coarse pointer (touch)
 * and a window narrower than PHONE_MAX_WIDTH. A tablet or a touch laptop is wider, so it is not.
 *
 * @param {{ matchMedia?: (query: string) => { matches: boolean }, innerWidth?: number }} [env]
 * @returns {boolean}
 */
export function isPhone(env = globalThis) {
	let coarse = false;
	try {
		coarse = !!env?.matchMedia?.('(pointer: coarse)')?.matches;
	} catch {
		// no matchMedia: not a phone
	}
	const width = Number(env?.innerWidth);
	return coarse && Number.isFinite(width) && width < PHONE_MAX_WIDTH;
}

/**
 * Whether this is a Capacitor app (Android or iOS): its native bridge sets window.Capacitor, as
 * platformLabel reads it. Used by isTutorialAvailable.
 * @param {{ Capacitor?: any }} [env]
 * @returns {boolean}
 */
export function isCapacitorApp(env = globalThis) {
	try {
		const platform = env?.Capacitor?.getPlatform?.();
		return platform === 'android' || platform === 'ios';
	} catch {
		return false;
	}
}

/**
 * The quality of a first visit (#180, owner decision of 2026-11-17): Low on phones (isPhone), Medium
 * elsewhere. The page stores it at once, so it is remembered. The Capacitor apps have no tutorial
 * (tutorialAvailability.js), so they need no case here.
 *
 * @param {object} [env] - globalThis, or a stand-in in the tests
 * @returns {'low'|'medium'}
 */
export function defaultQuality(env = globalThis) {
	return isPhone(env) ? 'low' : 'medium';
}
