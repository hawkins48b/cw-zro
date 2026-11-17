import { describe, it, expect } from 'vitest';
import { hasExtraTerms } from '#lib/utils/licenseKind.js';

describe('hasExtraTerms (#166, Licences page highlight)', () => {
	it('reads plain permissive licences as without extra terms', () => {
		for (const id of ['MIT', 'ISC', 'Apache-2.0', 'BSD-3-Clause', '0BSD']) {
			expect(hasExtraTerms(id)).toBe(false);
		}
	});

	it('highlights copyleft and custom licences', () => {
		expect(hasExtraTerms('LGPL-3.0')).toBe(true);
		expect(hasExtraTerms('LGPL-3.0-only')).toBe(true);
		expect(hasExtraTerms('SEE LICENSE IN LICENSE.md')).toBe(true);
		expect(hasExtraTerms('ApexCharts licence')).toBe(true);
	});

	it('takes the permissive choice of an OR expression', () => {
		expect(hasExtraTerms('(MIT OR Apache-2.0)')).toBe(false);
		expect(hasExtraTerms('MIT OR GPL-3.0')).toBe(false);
		expect(hasExtraTerms('LGPL-3.0 OR GPL-3.0')).toBe(true);
	});

	it('needs every part of an AND expression permissive', () => {
		expect(hasExtraTerms('MIT AND ISC')).toBe(false);
		expect(hasExtraTerms('(MIT AND LGPL-3.0)')).toBe(true);
	});

	it('highlights a missing or empty licence', () => {
		expect(hasExtraTerms(undefined)).toBe(true);
		expect(hasExtraTerms('')).toBe(true);
		expect(hasExtraTerms(42)).toBe(true);
	});
});
