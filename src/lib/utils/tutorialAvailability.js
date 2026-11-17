import { isCapacitorApp } from './storedTutorial.js';

/**
 * Whether this bundle is the mobile (Capacitor) build: `__MOBILE_BUILD__`, set by vite.config.js
 * from `BUILD_TARGET=capacitor`. False in the web and desktop builds and in the tests.
 */
export const MOBILE_BUILD = typeof __MOBILE_BUILD__ === 'boolean' ? __MOBILE_BUILD__ : false;

/** The tutorial's route, for the hub and the sidebar. */
export const TUTORIAL_PATH = '/calculators/ballistic-tutorial';

/**
 * Whether the 3D ballistic tutorial is offered (#182, owner decision of 2026-11-17): not in the
 * Capacitor apps, whose single bundle would otherwise carry three.js on every screen. The mobile
 * build leaves the scene out at build time (the page imports it only when `__MOBILE_BUILD__` is
 * false); this also checks the runtime bridge, so a web build opened in a Capacitor web view does
 * not offer it either. Web and Electron keep it.
 *
 * @param {boolean} [mobileBuild] - MOBILE_BUILD, or a value in the tests
 * @param {{ Capacitor?: any }} [env] - globalThis, or a stand-in in the tests
 * @returns {boolean}
 */
export function isTutorialAvailable(mobileBuild = MOBILE_BUILD, env = globalThis) {
	return !mobileBuild && !isCapacitorApp(env);
}

/**
 * A navigation list without the tutorial's entry where it is not available.
 * @template {{ href: string }} T
 * @param {T[]} items
 * @param {boolean} available - isTutorialAvailable()
 * @returns {T[]}
 */
export function withoutUnavailableTutorial(items, available) {
	return available ? items : items.filter((item) => item.href !== TUTORIAL_PATH);
}
