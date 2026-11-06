import { describe, it, expect } from 'vitest';
import { migrateClockWind, pageWind, patchWind } from '#lib/utils/storedWind.js';
import { shotWinds } from '#lib/utils/shotWind.js';

const fallback = { speed: '0', speedUnit: 'mph', direction: '90' };
const throwsAsText = JSON.parse('{"toString":1}');

/** Reading the wind the way the pages and WindInput do. None of this may throw. */
function readLikeThePage(wind) {
	parseFloat(wind.speed);
	parseFloat(wind.direction);
	return `${wind.speed} ${wind.speedUnit} ${wind.direction}`;
}

describe('pageWind', () => {
	it('checks that the test value really throws as text', () => {
		expect(() => parseFloat(throwsAsText)).toThrow();
	});

	it('leaves a good wind as it is', () => {
		const wind = { speed: '10', speedUnit: 'mps', direction: '45' };
		expect(pageWind(wind, fallback)).toEqual(wind);
		expect(pageWind({ speed: 10, speedUnit: 'mph', direction: 45 }, fallback)).toEqual({
			speed: 10,
			speedUnit: 'mph',
			direction: 45
		});
	});

	it.each([
		['null', null],
		['nothing', undefined],
		['text', 'wind'],
		['a number', 5],
		['a boolean', true],
		['an array', [1, 2]]
	])('uses the fallback for a wind of %s, and the shot has no wind', (_, stored) => {
		expect(pageWind(stored, fallback)).toEqual(fallback);
		expect(shotWinds(stored)).toEqual([]);
	});

	it.each([
		['an object that cannot become text', throwsAsText],
		['an array holding one', [throwsAsText]],
		['an array', [10]],
		['an object', {}],
		['a boolean', true]
	])('shows no speed for %s, and the shot gives no result', (_, speed) => {
		const stored = { speed, speedUnit: 'mph', direction: '90' };
		const wind = pageWind(stored, fallback);
		expect(wind.speed).toBe('');
		expect(() => readLikeThePage(wind)).not.toThrow();
		expect(shotWinds(stored)).toBeNull();
	});

	it.each([
		['an object that cannot become text', throwsAsText],
		['an array', [90]],
		['a boolean', false],
		['null', null]
	])('shows no direction for %s, and the shot gives no result', (_, direction) => {
		const stored = { speed: '10', speedUnit: 'mph', direction };
		const wind = pageWind(stored, fallback);
		expect(wind.direction).toBe('');
		expect(() => readLikeThePage(wind)).not.toThrow();
		expect(shotWinds(stored)).toBeNull();
	});

	it('reads a damaged unit as mph, as the shot does', () => {
		const stored = { speed: '10', speedUnit: 'knots', direction: '90' };
		expect(pageWind(stored, fallback).speedUnit).toBe('mph');
		const asMph = { ...stored, speedUnit: 'mph' };
		expect(shotWinds(stored)[0].velocity.rawValue).toBe(shotWinds(asMph)[0].velocity.rawValue);
	});
});

describe('patchWind', () => {
	it('replaces only the changed field', () => {
		const stored = { speed: '10', speedUnit: 'mph', direction: '45' };
		expect(patchWind(stored, { speed: '5' }, fallback)).toEqual({ ...stored, speed: '5' });
	});

	it('starts from the fallback when the stored value is not a wind', () => {
		for (const stored of [null, undefined, 'wind', [1]]) {
			expect(patchWind(stored, { speed: '5' }, fallback)).toEqual({ ...fallback, speed: '5' });
		}
	});

	it('keeps no result until the damaged field is set', () => {
		const stored = { speed: '10', speedUnit: 'mph', direction: throwsAsText };
		const speedSet = patchWind(stored, { speed: '5' }, fallback);
		expect(shotWinds(speedSet)).toBeNull();
		expect(shotWinds(patchWind(speedSet, { direction: '90' }, fallback))).toHaveLength(1);
	});

	it('recovers from a damaged speed once it is set', () => {
		const stored = { speed: throwsAsText, speedUnit: 'mph', direction: '90' };
		expect(shotWinds(patchWind(stored, { speed: '5' }, fallback))).toHaveLength(1);
	});
});

describe('migrateClockWind', () => {
	const old = (direction, directionUnit = 'clock') => ({
		speed: '10',
		speedUnit: 'mph',
		direction,
		directionUnit
	});

	it.each([
		['3', '90'],
		['12', '0'],
		['9', '270'],
		[3, '90'],
		['', '0'],
		[undefined, '0']
	])('turns clock %s into %s degrees', (clock, degrees) => {
		expect(migrateClockWind(old(clock))).toEqual({
			speed: '10',
			speedUnit: 'mph',
			direction: degrees
		});
	});

	it('keeps a direction already in degrees', () => {
		expect(migrateClockWind(old('45', 'deg')).direction).toBe('45');
	});

	it.each([
		['an object that cannot become text', throwsAsText],
		['an array holding one', [throwsAsText]],
		['true', true],
		['false', false],
		['null', null]
	])('does not throw on %s, and the shot gives no result', (_, direction) => {
		const migrated = migrateClockWind(old(direction));
		expect(migrated.direction).toBe(direction);
		expect(migrated).not.toHaveProperty('directionUnit');
		expect(shotWinds(migrated)).toBeNull();
	});
});
