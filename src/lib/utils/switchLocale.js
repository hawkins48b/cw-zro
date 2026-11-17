/**
 * Language switch without a page reload (#178).
 *
 * The language links used to reload the whole app (#96), which showed a white page. Now a click
 * stores the choice and navigates in the app to the same page in the new language. The root layout
 * is keyed on the URL locale, so every message renders again in that language. Where the browser
 * has View Transitions, the old and new texts cross-fade; with reduced motion they swap at once.
 */

import { tick } from 'svelte';

/**
 * True when the click should be left to the browser: another button, a modifier key (new tab or
 * window), or a click already handled.
 *
 * @param {MouseEvent} event
 */
export function isPlainClick(event) {
	return (
		!event.defaultPrevented &&
		event.button === 0 &&
		!event.metaKey &&
		!event.ctrlKey &&
		!event.shiftKey &&
		!event.altKey
	);
}

/**
 * The same page, query and hash in another language. A path such as //evil.example or
 * /\evil.example would localize to an address on another host, so anything that leaves the
 * current protocol and host gives the start page in that language instead (as
 * startupLocaleRedirect does, #96). Not .origin: it is "null" for app:// and capacitor://.
 *
 * @param {URL} url - The current page URL.
 * @param {string} locale
 * @param {(href: string, options: { locale: string }) => string} localizeHref
 */
export function localeHref(url, locale, localizeHref) {
	const target = localizeHref(url.pathname, { locale }) + url.search + url.hash;
	try {
		const resolved = new URL(target, url);
		if (resolved.protocol === url.protocol && resolved.host === url.host) return target;
	} catch {
		// Not a URL: the start page below.
	}
	return localizeHref('/', { locale });
}

/**
 * Switch to `locale` in place: store it, navigate in the app (no history entry, no scroll, focus
 * kept on the language button), keep the scroll position of the page content, and cross-fade
 * where supported.
 *
 * @param {string} locale
 * @param {object} deps
 * @param {URL} deps.url - The current page URL.
 * @param {(href: string, options: { locale: string }) => string} deps.localizeHref
 * @param {(href: string, options: object) => Promise<void>} deps.goto
 * @param {(locale: string) => void} deps.storeLocale
 * @param {Document} [deps.doc]
 * @returns {Promise<void>}
 */
export async function switchLocale(locale, { url, localizeHref, goto, storeLocale, doc = globalThis.document }) {
	storeLocale(locale);
	const href = localeHref(url, locale, localizeHref);

	// The keyed layout rebuilds the scrolling <main>, so its scroll position is put back after.
	const scroller = () => doc?.querySelector('main');
	const top = scroller()?.scrollTop ?? 0;
	// The language buttons are rebuilt too (there can be two switchers on a page): the focused one
	// is found again by its position among them, for keyboard users.
	const buttons = () => [...(doc?.querySelectorAll('[hreflang]') ?? [])];
	const focused = buttons().indexOf(/** @type {Element} */ (doc?.activeElement));

	const update = async () => {
		try {
			await goto(href, { replace: true, reset: false });
		} catch {
			// The in-app navigation failed: load the page in that language, as before #178.
			doc?.defaultView?.location.assign(href);
			return;
		}
		await tick();
		const main = scroller();
		if (main) main.scrollTop = top;
		if (focused >= 0) /** @type {HTMLElement|undefined} */ (buttons()[focused])?.focus({ preventScroll: true });
	};

	const reduced = globalThis.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
	if (doc && typeof doc.startViewTransition === 'function' && !reduced) {
		const transition = doc.startViewTransition(update);
		// A skipped transition (hidden tab, another one started) still runs update.
		transition.ready?.catch(() => {});
		transition.finished?.catch(() => {});
		await transition.updateCallbackDone;
		return;
	}
	await update();
}
