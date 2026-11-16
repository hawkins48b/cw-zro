/** The o'clock hint of the Scope View wind direction (#148). Display only. */
import { describe, it, expect } from 'vitest';
import { clockHour } from '#lib/utils/windDirection.js';

describe('clockHour', () => {
	it.each([
		[0, 12],
		[90, 3],
		[180, 6],
		[270, 9],
		[360, 12],
		[-90, 9],
		[14.9, 12],
		[15, 1],
		[44.9, 1],
		[45, 2],
		[345, 12],
		[725, 12]
	])('%s° is %s o\'clock', (degrees, hour) => {
		expect(clockHour(degrees)).toBe(hour);
	});

	it.each([NaN, Infinity, -Infinity, '90', null, undefined])('gives null for %s', (value) => {
		expect(clockHour(/** @type {any} */ (value))).toBeNull();
	});
});
