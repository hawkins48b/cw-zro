/**
 * Which build of the app is running, and its version (Settings > About, #166). The web and mobile
 * builds share one bundle (CLAUDE.md), so the platform is read at run time, not at build time.
 */

/** Electron's app scheme (electron/navigation.js, APP_SCHEME), as location.protocol gives it. */
export const ELECTRON_PROTOCOL = 'app:';

/**
 * Whether this is the desktop (Electron) app: it loads from app://-, and its user agent names
 * Electron. The preload exposes nothing (electron/preload.cjs), so there is no global to read.
 * @param {{ navigator?: { userAgent?: string }, location?: { protocol?: string } }} [env]
 * @returns {boolean}
 */
export function isDesktopApp(env = globalThis) {
	if (env?.location?.protocol === ELECTRON_PROTOCOL) return true;
	return /\bElectron\//.test(String(env?.navigator?.userAgent ?? ''));
}

/**
 * 'android' or 'ios' in the Capacitor apps, 'desktop' in Electron, else 'web'. Capacitor's native
 * bridge sets window.Capacitor (the app does not import @capacitor/core); on the web it is not there.
 * @param {{ Capacitor?: any, navigator?: { userAgent?: string }, location?: { protocol?: string } }} [env]
 * @returns {'web' | 'android' | 'ios' | 'desktop'}
 */
export function platformLabel(env = globalThis) {
	let native = null;
	try {
		native = env?.Capacitor?.getPlatform?.();
	} catch {
		// a broken bridge reads as no bridge
	}
	if (native === 'android' || native === 'ios') return native;
	if (isDesktopApp(env)) return 'desktop';
	return 'web';
}

/**
 * The app version: package.json `version`, set at build time by vite.config.js (`__APP_VERSION__`),
 * the one the sidebar shows.
 */
export const APP_VERSION = typeof __APP_VERSION__ === 'string' ? __APP_VERSION__ : '';
