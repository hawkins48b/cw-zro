/**
 * Scope view range (security review of #93): a stored range above 3000, which the old box allowed,
 * must give no result and the range message, never a result for another distance.
 */
import { describe, it, expect } from 'vitest';
import { isUsableScopeRange, scopeEffectiveRange } from '#lib/utils/scopeRange.js';

describe('isUsableScopeRange', () => {
	it.each([['1'], ['600'], ['3000'], ['600,5'], [3000]])('accepts %j', (distance) => {
		expect(isUsableScopeRange(distance)).toBe(true);
	});

	it.each([['3000.01'], ['3001'], ['5000'], ['9999'], ['0'], [''], ['abc'], ['Infinity'], [null]])(
		'rejects %j, so the page shows the message',
		(distance) => {
			expect(isUsableScopeRange(distance)).toBe(false);
		}
	);
});

describe('scopeEffectiveRange', () => {
	it('is the stored range with the angle section closed', () => {
		expect(scopeEffectiveRange({ distance: '600', unit: 'yd' }, null)).toEqual({ distance: 600, unit: 'yd' });
		expect(scopeEffectiveRange({ distance: '3000', unit: 'm' }, null)).toEqual({ distance: 3000, unit: 'm' });
	});

	it.each([['5000'], ['9999'], ['3000.01']])('is null for a stored %s, not 3000', (distance) => {
		expect(scopeEffectiveRange({ distance, unit: 'yd' }, null)).toBeNull();
		expect(scopeEffectiveRange({ distance, unit: 'yd' }, { angle: '60', unit: 'deg' })).toBeNull();
	});

	it('applies the cosine of an angle in degrees', () => {
		const result = scopeEffectiveRange({ distance: '600', unit: 'yd' }, { angle: '60', unit: 'deg' });
		expect(result.distance).toBeCloseTo(300, 10);
	});

	it('applies an entered cosine, with a decimal comma', () => {
		expect(scopeEffectiveRange({ distance: '600', unit: 'yd' }, { angle: '0,5', unit: 'cos' })).toEqual({
			distance: 300,
			unit: 'yd'
		});
	});

	it('takes an empty angle as flat', () => {
		expect(scopeEffectiveRange({ distance: '600', unit: 'yd' }, { angle: '', unit: 'deg' }).distance).toBe(600);
		expect(scopeEffectiveRange({ distance: '600', unit: 'yd' }, { angle: '', unit: 'cos' }).distance).toBe(600);
	});

	it('agrees with isUsableScopeRange on every stored range', () => {
		for (const distance of ['1', '600', '3000', '3000.01', '5000', '', 'abc']) {
			expect(scopeEffectiveRange({ distance, unit: 'yd' }, null) !== null).toBe(isUsableScopeRange(distance));
		}
	});
});
