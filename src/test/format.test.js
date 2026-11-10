import { describe, it, expect } from 'vitest';
import { escapeHtmlText, formatLimit } from '#lib/utils/format.js';

describe('escapeHtmlText', () => {
	it('escapes markup', () => {
		expect(escapeHtmlText('<img src=x onerror=alert(1)>')).toBe(
			'&lt;img src=x onerror=alert(1)&gt;'
		);
		expect(escapeHtmlText('<b>Rifle</b> @ 100 m')).toBe(
			'&lt;b&gt;Rifle&lt;/b&gt; @ 100 m'
		);
	});

	it('escapes the ampersand first, so entities are not escaped twice', () => {
		expect(escapeHtmlText('<')).toBe('&lt;');
		expect(escapeHtmlText('>')).toBe('&gt;');
		expect(escapeHtmlText('&')).toBe('&amp;');
		expect(escapeHtmlText('Smith & Wesson')).toBe('Smith &amp; Wesson');
	});

	it('keeps text that already looks like an entity as literal text', () => {
		expect(escapeHtmlText('&lt;b&gt;')).toBe('&amp;lt;b&amp;gt;');
	});

	it('leaves accents and both kinds of quote unchanged', () => {
		for (const name of ['Müller Précision', "Tom's rifle", 'The "long" one', 'Tir à 300 m']) {
			expect(escapeHtmlText(name)).toBe(name);
		}
	});

	it('turns non-string values into text', () => {
		expect(escapeHtmlText(100)).toBe('100');
		expect(escapeHtmlText('')).toBe('');
	});

	it('gives the original text back through innerHTML, with no child elements', () => {
		const names = [
			'<img src=x onerror=alert(1)>',
			'<script>alert(1)</script> @ 100 m',
			'</div><b>Rifle</b>',
			'Smith & Wesson',
			'&lt;b&gt;',
			'&amp;',
			"Tom's \"Müller\" à 300 m"
		];
		for (const name of names) {
			const el = document.createElement('div');
			el.innerHTML = escapeHtmlText(name);
			expect(el.textContent).toBe(name);
			expect(el.children).toHaveLength(0);
		}
	});
});

describe('formatLimit', () => {
	it('writes a limit without thousands grouping, so it reads back as typed', () => {
		expect(formatLimit(3000)).toBe('3000');
		expect(formatLimit(25.4)).toBe('25.4');
		expect(formatLimit(-130)).toBe('-130');
		expect(formatLimit(0.01)).toBe('0.01');
	});
});
