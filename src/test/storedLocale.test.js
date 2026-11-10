/**
 * The language choice survives a restart (#96): the stored language is applied at start when the
 * URL has no locale prefix, and a prefix in the URL wins. Uses the real Paraglide runtime.
 */
import { describe, it, expect } from 'vitest';
import {
	baseLocale,
	extractLocaleFromUrl,
	locales,
	localizeHref
} from '#lib/paraglide/runtime.js';
import {
	LEGACY_LOCALE_COOKIE,
	LOCALE_STORAGE_KEY,
	clearLegacyLocaleCookie,
	readStoredLocale,
	startupLocaleRedirect,
	storeLocale
} from '#lib/utils/storedLocale.js';

const I18N = { locales, baseLocale, urlLocale: extractLocaleFromUrl, localizeHref };
const at = (href) => new URL(href);
const redirect = (href, stored) => startupLocaleRedirect(at(href), stored, I18N);

/** An in-memory Storage, or one that throws on every access. */
function memoryStorage() {
	const data = new Map();
	return {
		getItem: (k) => (data.has(k) ? data.get(k) : null),
		setItem: (k, v) => data.set(k, String(v)),
		data
	};
}
const deniedStorage = {
	getItem() {
		throw new DOMException('denied', 'SecurityError');
	},
	setItem() {
		throw new DOMException('denied', 'QuotaExceededError');
	}
};

describe('startupLocaleRedirect', () => {
	it('sends an unprefixed start to the stored language', () => {
		expect(redirect('https://zro.example/', 'fr')).toBe('/fr/');
		expect(redirect('https://zro.example/', 'de')).toBe('/de/');
	});

	it('keeps the path, query and hash', () => {
		expect(redirect('https://zro.example/calculators/ballistic?x=1#top', 'de')).toBe(
			'/de/calculators/ballistic?x=1#top'
		);
	});

	it('lets a locale in the URL win', () => {
		expect(redirect('https://zro.example/fr/', 'de')).toBeNull();
		expect(redirect('https://zro.example/de/settings/privacy', 'fr')).toBeNull();
		expect(redirect('https://zro.example/fr', 'fr')).toBeNull();
	});

	it('stays on English when English or nothing is stored', () => {
		expect(redirect('https://zro.example/', 'en')).toBeNull();
		expect(redirect('https://zro.example/', null)).toBeNull();
	});

	it('ignores a stored value that is not a locale', () => {
		for (const stored of ['', 'FR', 'fr-CH', 'it', '"fr"', ' fr', 'javascript:alert(1)', '//evil.example', 42, {}]) {
			expect(redirect('https://zro.example/', stored)).toBeNull();
		}
	});

	it('works on the desktop and mobile origins', () => {
		expect(redirect('app://zro/', 'fr')).toBe('/fr/');
		expect(redirect('https://localhost/scope-view', 'de')).toBe('/de/scope-view');
		expect(redirect('capacitor://localhost/', 'fr')).toBe('/fr/');
	});

	it('cannot loop: the target has the stored locale, so it does not redirect again', () => {
		const first = redirect('https://zro.example/profiles?id=3', 'fr');
		expect(redirect(new URL(first, 'https://zro.example/').href, 'fr')).toBeNull();
	});

	it('never leaves the current host (open redirect)', () => {
		// Each path localizes to //evil.example/fr/, which would resolve to another host.
		for (const href of [
			'https://zro.example//evil.example',
			'https://zro.example///evil.example',
			'https://zro.example/\\evil.example',
			'https://zro.example//evil.example?a#b',
			'app://zro//evil.example',
			'capacitor://localhost//evil.example'
		]) {
			expect(redirect(href, 'fr'), href).toBeNull();
			expect(redirect(href, 'de'), href).toBeNull();
		}
	});

	it('rejects a localized address on another host', () => {
		const away = { ...I18N, localizeHref: () => 'https://evil.example/fr/' };
		expect(startupLocaleRedirect(at('https://zro.example/'), 'fr', away)).toBeNull();
		const otherScheme = { ...I18N, localizeHref: () => 'https://zro/fr/' };
		expect(startupLocaleRedirect(at('app://zro/'), 'fr', otherScheme)).toBeNull();
	});

	it('stays when the localized address has no locale', () => {
		const same = { ...I18N, localizeHref: (href) => href };
		expect(startupLocaleRedirect(at('https://zro.example/'), 'fr', same)).toBeNull();
		const broken = { ...I18N, localizeHref: () => undefined };
		expect(startupLocaleRedirect(at('https://zro.example/'), 'fr', broken)).toBeNull();
	});
});

describe('readStoredLocale and storeLocale', () => {
	it('round-trip the choice, English included', () => {
		const storage = memoryStorage();
		expect(readStoredLocale(storage)).toBeNull();
		storeLocale('de', storage);
		expect(storage.data.get(LOCALE_STORAGE_KEY)).toBe('de');
		expect(readStoredLocale(storage)).toBe('de');
		storeLocale('en', storage);
		expect(readStoredLocale(storage)).toBe('en');
	});

	it('do not throw when storage is denied or missing', () => {
		expect(readStoredLocale(deniedStorage)).toBeNull();
		expect(() => storeLocale('fr', deniedStorage)).not.toThrow();
		expect(readStoredLocale(null)).toBeNull();
		expect(() => storeLocale('fr', null)).not.toThrow();
	});

	it('use localStorage by default', () => {
		localStorage.removeItem(LOCALE_STORAGE_KEY);
		storeLocale('fr');
		expect(localStorage.getItem(LOCALE_STORAGE_KEY)).toBe('fr');
		expect(readStoredLocale()).toBe('fr');
		localStorage.removeItem(LOCALE_STORAGE_KEY);
	});
});

describe('clearLegacyLocaleCookie', () => {
	it('deletes the old language cookie and keeps the others', () => {
		document.cookie = `${LEGACY_LOCALE_COOKIE}=fr; path=/`;
		document.cookie = 'other=1; path=/';
		clearLegacyLocaleCookie();
		expect(document.cookie).not.toContain(LEGACY_LOCALE_COOKIE);
		expect(document.cookie).toContain('other=1');
		document.cookie = 'other=; path=/; max-age=0';
	});

	it('does not throw without a document or when cookies are denied', () => {
		expect(() => clearLegacyLocaleCookie(null)).not.toThrow();
		const denied = {
			get cookie() {
				throw new DOMException('denied', 'SecurityError');
			}
		};
		expect(() => clearLegacyLocaleCookie(denied)).not.toThrow();
	});
});
