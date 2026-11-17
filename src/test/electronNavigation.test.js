import { describe, expect, it } from 'vitest';
import { isAppUrl, isExternalUrl } from '../../electron/navigation.js';

describe('isAppUrl', () => {
	it.each([
		'app://-',
		'app://-/',
		'app://-/calculators/ballistic',
		'app://-/fr/settings/about?x=1#top',
		'APP://-/scope-view'
	])('accepts %s', (url) => {
		expect(isAppUrl(url)).toBe(true);
	});

	it.each([
		'https://github.com/hawkins48b/cw-zro',
		'http://-/',
		'file:///etc/passwd',
		'blob:app://-/0b6f2c3a',
		'data:text/html,<script>alert(1)</script>',
		'javascript:alert(1)',
		'app://evil/',
		'app://-.evil/',
		'app://-@evil/',
		'app://-:8080/',
		'app:/-/',
		'about:blank',
		'',
		'not a url',
		null,
		undefined
	])('rejects %s', (url) => {
		expect(isAppUrl(url)).toBe(false);
	});
});

describe('isExternalUrl', () => {
	it.each(['https://github.com/o-murphy/js-ballistics', 'HTTPS://example.com/'])(
		'accepts %s',
		(url) => {
			expect(isExternalUrl(url)).toBe(true);
		}
	);

	it.each([
		'http://example.com/',
		'file:///etc/passwd',
		'smb://attacker/share',
		'ms-msdt:/id',
		'mailto:a@example.com',
		'javascript:alert(1)',
		'app://-/settings',
		'',
		'not a url',
		null,
		undefined
	])('rejects %s', (url) => {
		expect(isExternalUrl(url)).toBe(false);
	});
});
