/** Settings > About (#166): which build runs, and its version. */
import { describe, expect, it } from 'vitest';
import { APP_SCHEME } from '../../electron/navigation.js';
import { APP_VERSION, isDesktopApp, platformLabel } from '#lib/utils/platform.js';
import pkg from '../../package.json';

const browserUa = 'Mozilla/5.0 (Linux; Android 15) Chrome/140 Mobile Safari/537.36';
const electronUa = 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 zro/2.0.0 Chrome/142 Electron/45.2.3 Safari/537.36';

describe('platformLabel', () => {
	it('reads the Capacitor bridge on Android and iOS', () => {
		expect(platformLabel({ Capacitor: { getPlatform: () => 'android' }, navigator: { userAgent: browserUa } })).toBe('android');
		expect(platformLabel({ Capacitor: { getPlatform: () => 'ios' }, location: { protocol: 'capacitor:' } })).toBe('ios');
	});

	it('reads the desktop app from its scheme or its user agent', () => {
		expect(platformLabel({ location: { protocol: `${APP_SCHEME}:` } })).toBe('desktop');
		expect(platformLabel({ navigator: { userAgent: electronUa }, location: { protocol: 'https:' } })).toBe('desktop');
		expect(isDesktopApp({ navigator: { userAgent: browserUa }, location: { protocol: 'https:' } })).toBe(false);
	});

	it('is web otherwise, also with a Capacitor bridge that says web, lies or throws', () => {
		expect(platformLabel({ navigator: { userAgent: browserUa }, location: { protocol: 'https:' } })).toBe('web');
		expect(platformLabel({ Capacitor: { getPlatform: () => 'web' } })).toBe('web');
		expect(platformLabel({ Capacitor: { getPlatform: () => '<b>x</b>' } })).toBe('web');
		expect(platformLabel({ Capacitor: { getPlatform: () => { throw new Error('bridge'); } } })).toBe('web');
		expect(platformLabel({ Capacitor: {} })).toBe('web');
		expect(platformLabel(undefined)).toBe('web');
		expect(platformLabel({})).toBe('web');
	});

	it('reads this test environment (jsdom) as web', () => {
		expect(platformLabel()).toBe('web');
	});
});

describe('APP_VERSION', () => {
	it('is the package.json version', () => {
		expect(APP_VERSION).toBe(pkg.version);
	});
});
