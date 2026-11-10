/**
 * Number reading for typed and stored values (#89, #117). A comma reads as a decimal point, with no
 * thousands separator, so `1,500` is 1.5 (owner decision of 2026-11-10).
 */
import { describe, it, expect } from 'vitest';
import { parseDecimal, readDecimal, normalizeDecimal } from '#lib/utils/decimal.js';

describe('parseDecimal', () => {
	it.each([
		['1.5', 1.5],
		['1,5', 1.5],
		['1,500', 1.5],
		['2650', 2650],
		['  2650  ', 2650],
		['-20', -20],
		['+20', 20],
		['-0', -0],
		['0', 0],
		['.5', 0.5],
		[',5', 0.5],
		['5.', 5],
		['5,', 5],
		['1e3', 1000],
		['1E-3', 0.001],
		['1,5e2', 150],
		['0.308', 0.308],
		['007', 7],
		[2650, 2650],
		[-1.5, -1.5]
	])('reads %j as %s', (value, expected) => {
		expect(parseDecimal(value)).toBe(expected);
	});

	it.each([
		['empty text', ''],
		['blank text', '   '],
		['Infinity', 'Infinity'],
		['-Infinity', '-Infinity'],
		['an overflow', '1e999'],
		['a negative overflow', '-1e999'],
		['NaN', 'NaN'],
		['hex', '0x10'],
		['upper case hex', '0X1F'],
		['binary', '0b1'],
		['octal', '0o7'],
		['trailing text', '90abc'],
		['leading text', 'abc90'],
		['text', 'abc'],
		['two commas', '1,500,000'],
		['a comma and a point', '1.500,5'],
		['a point and a comma', '1,500.5'],
		['two points', '1.2.3'],
		['a space inside', '1 500'],
		['a sign alone', '-'],
		['a separator alone', ','],
		['an exponent alone', 'e5'],
		['an exponent without digits', '1e'],
		['two signs', '--1'],
		['the number Infinity', Infinity],
		['the number NaN', NaN],
		['null', null],
		['undefined', undefined],
		['an array', [90]],
		['an object', {}],
		['a boolean', true]
	])('rejects %s', (_, value) => {
		expect(parseDecimal(value)).toBeNull();
	});
});

describe('readDecimal', () => {
	it.each([
		['1,5', 1.5],
		['1.5', 1.5],
		['1,500', 1.5],
		['1,5,3', 1.5],
		[',5', 0.5],
		['-,5', -0.5],
		['  1,5', 1.5]
	])('reads a comma in %j as a decimal point: %s', (value, expected) => {
		expect(readDecimal(value)).toBe(expected);
	});

	// Every value without a comma reads as parseFloat reads it, so no result changes for them.
	it.each([
		['2650'],
		['90abc'],
		['10abc'],
		[' 90'],
		['-0'],
		['abc'],
		[''],
		['Infinity'],
		['1e999'],
		['0x10'],
		['1.2.3'],
		[2650],
		[NaN],
		[null],
		[undefined],
		[[90]],
		[true]
	])('reads %j as parseFloat does', (value) => {
		expect(Object.is(readDecimal(value), parseFloat(/** @type {any} */ (value)))).toBe(true);
	});
});

describe('normalizeDecimal', () => {
	it.each([
		['1,5', '1.5'],
		[' 1,5 ', '1.5'],
		['2650', '2650'],
		[' 2650 ', '2650'],
		['-0,25', '-0.25']
	])('stores %j as %j', (value, expected) => {
		expect(normalizeDecimal(value)).toBe(expected);
	});

	it.each([['abc'], [''], ['1,500,000'], ['Infinity']])('keeps %j, which is not a number', (value) => {
		expect(normalizeDecimal(value)).toBe(value);
	});

	it('keeps a value that is not text', () => {
		expect(normalizeDecimal(/** @type {any} */ (25))).toBe(25);
	});
});
