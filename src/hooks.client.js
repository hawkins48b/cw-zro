import {
	baseLocale,
	extractLocaleFromUrl,
	locales,
	localizeHref
} from '#lib/paraglide/runtime.js';
import {
	clearLegacyLocaleCookie,
	readStoredLocale,
	startupLocaleRedirect
} from '#lib/utils/storedLocale.js';

/**
 * Before the first render: the language cookie of earlier versions is deleted, and a start without
 * a locale in the URL goes to the language the user picked last (#96). replace() leaves no history
 * entry, and the app does not start on this page.
 */
export function init() {
	clearLegacyLocaleCookie();
	const target = startupLocaleRedirect(new URL(window.location.href), readStoredLocale(), {
		locales,
		baseLocale,
		urlLocale: extractLocaleFromUrl,
		localizeHref
	});
	if (target) {
		window.location.replace(target);
		return new Promise(() => {});
	}
}
