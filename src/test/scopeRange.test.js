/**
 * Scope view range (security review of #93): a stored range above 3000, which the old box allowed,
 * must give no result and the range message, never a result for another distance.
 */
import { describe, it, expect } from 'vitest';
import { MAX_SCOPE_ANGLE_DEG, isUsableScopeAngle, isUsableScopeRange, scopeEffectiveRange } from '#lib/utils/scopeRange.js';
import { storedElevation } from '#lib/utils/storedState.js';

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

/**
 * Typed cosine (#121): only a finite cosine above 0 and at most 1 is used. 2 used to double the
 * range, -1 to give a result for the absolute range, Infinity no result, all without a message.
 */
describe('typed cosine (#121)', () => {
	const RANGE = { distance: '2000', unit: 'yd' };
	const cos = (angle) => ({ angle, unit: 'cos' });

	it.each([
		['0'],
		['-0.0001'],
		['-1'],
		['-0,5'],
		['1.0001'],
		['1,0001'],
		['2'],
		['Infinity'],
		['-Infinity'],
		['NaN'],
		['abc'],
		['1e999'],
		[0],
		[2],
		[Number.POSITIVE_INFINITY],
		[Number.NaN]
	])('rejects %j: no result, and the page shows the message', (angle) => {
		expect(isUsableScopeAngle(cos(angle))).toBe(false);
		expect(scopeEffectiveRange(RANGE, cos(angle))).toBeNull();
	});

	it.each([
		['1e-9', 2000e-9],
		['0.0001', 0.2],
		['0,5', 1000],
		['0.866', 1732],
		['0.9999', 1999.8],
		['1', 2000],
		['1,0', 2000],
		[1, 2000],
		[0.5, 1000]
	])('accepts %j and gives the same range as before', (angle, distance) => {
		expect(isUsableScopeAngle(cos(angle))).toBe(true);
		const result = scopeEffectiveRange(RANGE, cos(angle));
		expect(result.unit).toBe('yd');
		expect(result.distance).toBeCloseTo(distance, 9);
		// Before #121: raw * (angle || 1), with the angle read the same way.
		const typed = typeof angle === 'number' ? angle : Number(angle.replace(',', '.'));
		expect(result.distance).toBe(2000 * typed);
	});

	it.each([[''], ['   '], [null], [undefined]])('takes an empty cosine %j as flat, as before', (angle) => {
		expect(isUsableScopeAngle(cos(angle))).toBe(true);
		expect(scopeEffectiveRange(RANGE, cos(angle))).toEqual({ distance: 2000, unit: 'yd' });
	});

	it('does not check a cosine with the angle section closed', () => {
		expect(isUsableScopeAngle(null)).toBe(true);
		expect(scopeEffectiveRange(RANGE, null)).toEqual({ distance: 2000, unit: 'yd' });
	});

	it.each([['0'], ['2'], ['-1'], ['60']])('leaves an angle of %j in degrees as before', (angle) => {
		expect(isUsableScopeAngle({ angle, unit: 'deg' })).toBe(true);
		expect(scopeEffectiveRange(RANGE, { angle, unit: 'deg' })).not.toBeNull();
	});

	it('agrees with isUsableScopeAngle on every cosine, for a usable range', () => {
		for (const angle of ['', '0', '0.5', '1', '1.5', '-1', 'Infinity', 'abc']) {
			expect(scopeEffectiveRange(RANGE, cos(angle)) !== null).toBe(isUsableScopeAngle(cos(angle)));
		}
	});
});

/**
 * Angle in degrees (#129, owner decision): only an angle strictly between -90 and 90 is used. 90
 * gave a range of 0, 180 a negative range read as positive, and 360 the full range, all without a
 * message.
 */
describe('angle in degrees (#129)', () => {
	const RANGE = { distance: '2000', unit: 'yd' };
	const deg = (angle) => ({ angle, unit: 'deg' });
	/** The range before #129: raw * cos(angle in degrees), an unreadable angle as 0. */
	const before = (angle) => 2000 * Math.cos((((typeof angle === 'number' ? angle : parseFloat(angle.replace(',', '.'))) || 0) * Math.PI) / 180);

	it('is 90 degrees at most, not included', () => {
		expect(MAX_SCOPE_ANGLE_DEG).toBe(90);
	});

	it.each([
		['90'],
		['-90'],
		['90.0'],
		['90,0001'],
		['-90.0001'],
		['91'],
		['120'],
		['180'],
		['-180'],
		['270'],
		['360'],
		['720'],
		['1e9'],
		['Infinity'],
		['-Infinity'],
		['1e999'],
		['NaN'],
		['abc'],
		[',' ],
		[90],
		[-90],
		[360],
		[Number.POSITIVE_INFINITY],
		[Number.NEGATIVE_INFINITY],
		[Number.NaN]
	])('rejects %j: no result, and the page shows the message', (angle) => {
		expect(isUsableScopeAngle(deg(angle))).toBe(false);
		expect(scopeEffectiveRange(RANGE, deg(angle))).toBeNull();
	});

	it.each([
		['0'],
		['-0'],
		['1e-9'],
		['30'],
		['-30'],
		['45,5'],
		['60'],
		['89'],
		['89.9999'],
		['-89.9999'],
		['5abc'],
		[0],
		[89.999999],
		[-45]
	])('accepts %j and gives the same range as before', (angle) => {
		expect(isUsableScopeAngle(deg(angle))).toBe(true);
		const result = scopeEffectiveRange(RANGE, deg(angle));
		expect(result.unit).toBe('yd');
		expect(result.distance).toBe(before(angle));
		expect(result.distance).toBeGreaterThan(0);
	});

	it.each([[''], ['  '], [null], [undefined]])('takes an empty angle %j as flat, as before', (angle) => {
		expect(isUsableScopeAngle(deg(angle))).toBe(true);
		expect(scopeEffectiveRange(RANGE, deg(angle))).toEqual({ distance: 2000, unit: 'yd' });
	});

	it('does not check an angle with the section closed', () => {
		expect(scopeEffectiveRange(RANGE, null)).toEqual({ distance: 2000, unit: 'yd' });
	});

	it.each([
		[{ angle: 90, unit: 'deg' }, false],
		[{ angle: '180', unit: 'deg' }, false],
		[{ angle: 'abc', unit: 'deg' }, false],
		[{ angle: 45, unit: 'deg' }, true],
		[{ angle: {}, unit: 'deg' }, true],
		[{ angle: [95], unit: 'deg' }, true],
		[{ angle: 95 }, false],
		[{ angle: 0.5 }, true]
	])('checks the stored angle %j as a typed one', (stored, usable) => {
		const elevation = storedElevation(stored);
		expect(isUsableScopeAngle(elevation)).toBe(usable);
		expect(scopeEffectiveRange(RANGE, elevation) !== null).toBe(usable);
	});

	it('agrees with isUsableScopeAngle on every angle, for a usable range', () => {
		for (const angle of ['', '0', '45', '89.9', '90', '-90', '135', '360', 'Infinity', 'abc']) {
			expect(scopeEffectiveRange(RANGE, deg(angle)) !== null).toBe(isUsableScopeAngle(deg(angle)));
		}
	});
});
