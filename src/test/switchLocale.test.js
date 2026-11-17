/**
 * Language switch without a page reload (#178): the target address, the in-app navigation, the
 * stored choice, the scroll and focus kept, and the fallback to a full load. Uses the real
 * Paraglide runtime for the addresses.
 */
import { describe, it, expect, vi, afterEach } from 'vitest';
import { localizeHref } from '#lib/paraglide/runtime.js';
import { isPlainClick, localeHref, switchLocale } from '#lib/utils/switchLocale.js';

const at = (href) => new URL(href, 'https://zro.example');

describe('localeHref', () => {
	it('keeps the page, query and hash in the new language', () => {
		const url = at('/fr/calculators/ballistic?profile=a#chart');
		expect(localeHref(url, 'de', localizeHref)).toBe('/de/calculators/ballistic?profile=a#chart');
		expect(localeHref(url, 'en', localizeHref)).toBe('/calculators/ballistic?profile=a#chart');
		expect(localeHref(at('/settings'), 'fr', localizeHref)).toBe('/fr/settings');
	});

	it('gives the start page for a path that would leave the host', () => {
		for (const path of ['//evil.example/x', '/\\evil.example']) {
			const url = new URL('https://zro.example');
			url.pathname = path;
			const href = localeHref(url, 'fr', localizeHref);
			const resolved = new URL(href, url);
			expect(resolved.host).toBe('zro.example');
		}
	});

	it('keeps the app:// host of the desktop app', () => {
		const url = new URL('app://-/profiles');
		const resolved = new URL(localeHref(url, 'de', localizeHref), url);
		expect(resolved.protocol).toBe('app:');
		expect(resolved.pathname).toBe('/de/profiles');
	});
});

describe('isPlainClick', () => {
	const click = (init = {}) => new MouseEvent('click', { button: 0, cancelable: true, ...init });

	it('takes a plain left click', () => {
		expect(isPlainClick(click())).toBe(true);
	});

	it('leaves new-tab clicks and other buttons to the browser', () => {
		for (const key of ['metaKey', 'ctrlKey', 'shiftKey', 'altKey']) {
			expect(isPlainClick(click({ [key]: true }))).toBe(false);
		}
		expect(isPlainClick(click({ button: 1 }))).toBe(false);
		const handled = click();
		handled.preventDefault();
		expect(isPlainClick(handled)).toBe(false);
	});
});

describe('switchLocale', () => {
	afterEach(() => {
		document.body.innerHTML = '';
		delete document.startViewTransition;
	});

	function setup() {
		document.body.innerHTML =
			'<main><a hreflang="en" href="/">EN</a><a hreflang="fr" href="/fr">FR</a></main>';
		const main = document.querySelector('main');
		main.scrollTop = 120;
		document.querySelectorAll('a')[1].focus();
		// The keyed layout replaces the whole tree, as the real navigation does.
		const goto = vi.fn(async () => {
			document.body.innerHTML =
				'<main><a hreflang="en" href="/">EN</a><a hreflang="fr" href="/fr">FR</a></main>';
		});
		return { goto, storeLocale: vi.fn() };
	}

	it('stores the choice and navigates in the app, replacing the history entry', async () => {
		const { goto, storeLocale } = setup();
		await switchLocale('fr', { url: at('/settings?x=1'), localizeHref, goto, storeLocale });
		expect(storeLocale).toHaveBeenCalledWith('fr');
		expect(goto).toHaveBeenCalledWith('/fr/settings?x=1', { replace: true, reset: false });
	});

	it('puts back the scroll position and the focus on the rebuilt page', async () => {
		const { goto, storeLocale } = setup();
		await switchLocale('fr', { url: at('/settings'), localizeHref, goto, storeLocale });
		expect(document.querySelector('main').scrollTop).toBe(120);
		expect(document.activeElement).toBe(document.querySelectorAll('a')[1]);
	});

	it('runs inside a view transition when the browser has one', async () => {
		const { goto, storeLocale } = setup();
		document.startViewTransition = vi.fn((cb) => {
			const updateCallbackDone = cb();
			return { updateCallbackDone, ready: Promise.resolve(), finished: Promise.resolve() };
		});
		await switchLocale('de', { url: at('/profiles'), localizeHref, goto, storeLocale });
		expect(document.startViewTransition).toHaveBeenCalledOnce();
		expect(goto).toHaveBeenCalledWith('/de/profiles', { replace: true, reset: false });
	});

	it('falls back to a full load when the in-app navigation fails', async () => {
		const { storeLocale } = setup();
		const goto = vi.fn(async () => {
			throw new Error('navigation failed');
		});
		const assign = vi.fn();
		const doc = { querySelector: () => null, querySelectorAll: () => [], activeElement: null, defaultView: { location: { assign } } };
		await switchLocale('fr', { url: at('/profiles'), localizeHref, goto, storeLocale, doc });
		expect(assign).toHaveBeenCalledWith('/fr/profiles');
	});
});
