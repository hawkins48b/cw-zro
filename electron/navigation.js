// URL rules for the navigation guard in main.js. Kept free of Electron imports so that
// they can be tested with Vitest.

export const APP_SCHEME = 'app';
export const APP_HOST = '-';

function parse(url) {
	try {
		return new URL(url);
	} catch {
		return null;
	}
}

// Compares protocol and host, not origin: Node does not know the app scheme, so
// `new URL('app://-/').origin` is the string 'null' in the main process.
export function isAppUrl(url) {
	const parsed = parse(url);
	return parsed?.protocol === `${APP_SCHEME}:` && parsed.host === APP_HOST;
}

export function isExternalUrl(url) {
	return parse(url)?.protocol === 'https:';
}
