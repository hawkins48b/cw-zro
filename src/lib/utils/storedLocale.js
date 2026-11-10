/**
 * The language choice, kept on the device (#96).
 *
 * The base locale (en) has no URL prefix, so `/` always reads as English, and the desktop app
 * (app://) and the mobile apps start there. The language the user picks is therefore stored in
 * localStorage, and at start a URL without a locale prefix is sent to the stored language. A URL
 * with a prefix (/fr, /de) wins and is not stored.
 */

/** localStorage key of the language the user picked: 'en', 'fr' or 'de', as plain text. */
export const LOCALE_STORAGE_KEY = 'zro-locale';

/**
 * The stored language, or null when there is none or storage cannot be read. The value is not
 * checked here: startupLocaleRedirect ignores anything that is not a locale.
 *
 * @param {Storage} [storage]
 * @returns {string|null}
 */
export function readStoredLocale(storage = globalThis.localStorage) {
	try {
		return storage?.getItem(LOCALE_STORAGE_KEY) ?? null;
	} catch {
		// Storage access denied (private mode, sandbox): no stored language.
		return null;
	}
}

/**
 * Store the language the user picked, the base locale included, so that it can be chosen back.
 *
 * @param {string} locale
 * @param {Storage} [storage]
 */
export function storeLocale(locale, storage = globalThis.localStorage) {
	try {
		storage?.setItem(LOCALE_STORAGE_KEY, locale);
	} catch {
		// Storage full or denied: the choice holds until the app restarts.
	}
}

/** Language cookie that Paraglide wrote before #96, for 400 days. The URL always won over it. */
export const LEGACY_LOCALE_COOKIE = 'PARAGLIDE_LOCALE';

/**
 * Delete the language cookie of earlier versions, so that it is no longer sent to the web host.
 * Nothing in it is kept: it held the language of the last page, not a choice.
 *
 * @param {Document} [doc]
 */
export function clearLegacyLocaleCookie(doc = globalThis.document) {
	try {
		if (doc && doc.cookie.includes(`${LEGACY_LOCALE_COOKIE}=`)) {
			doc.cookie = `${LEGACY_LOCALE_COOKIE}=; path=/; max-age=0`;
		}
	} catch {
		// document.cookie throws on opaque origins (sandbox): nothing to delete there.
	}
}

/**
 * Where to send the app at start, or null to stay.
 *
 * - The URL has a locale (urlLocale is not the base locale): the URL wins.
 * - Nothing stored, the base locale stored, or a value that is not a locale: stay.
 * - Otherwise: the same path, query and hash in the stored locale.
 *
 * Null also when the localized address has no locale of its own, so that it cannot loop, and when
 * it leaves the current protocol and host, so that it cannot be an open redirect.
 *
 * @param {URL} url - current address
 * @param {unknown} stored - value of readStoredLocale()
 * @param {object} i18n
 * @param {readonly string[]} i18n.locales
 * @param {string} i18n.baseLocale
 * @param {(url: string) => string|undefined} i18n.urlLocale - locale of a URL (Paraglide's
 *   extractLocaleFromUrl): the base locale for a URL without a prefix
 * @param {(href: string, options: { locale: string }) => string} i18n.localizeHref
 * @returns {string|null}
 */
export function startupLocaleRedirect(url, stored, { locales, baseLocale, urlLocale, localizeHref }) {
	if (urlLocale(url.href) !== baseLocale) return null;
	if (typeof stored !== 'string' || stored === baseLocale || !locales.includes(stored)) return null;
	const target = localizeHref(url.pathname + url.search + url.hash, { locale: stored });
	if (typeof target !== 'string') return null;
	let resolved;
	try {
		resolved = new URL(target, url);
	} catch {
		return null;
	}
	// A path such as //evil.example or /\evil.example localizes to a protocol-relative address
	// on another host. Only the same protocol and host are followed. Not .origin: it is "null"
	// for app:// and capacitor://.
	if (resolved.protocol !== url.protocol || resolved.host !== url.host) return null;
	if (urlLocale(resolved.href) !== stored) return null;
	return target;
}
