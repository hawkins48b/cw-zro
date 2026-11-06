import { describe, it, expect, vi, beforeEach } from 'vitest';
import { compareSeriesName, normalizeCompareEntries } from '#lib/utils/compareEntries.js';
import { compareTrajectories } from '#lib/stores/compareTrajectories.svelte.js';

const stored = vi.hoisted(() => ({ value: {} }));

vi.mock('#lib/stores/localStore.svelte.js', () => ({ localStore: () => stored }));

const entry = { id: 'a', profileId: 'p', zeroDist: '100', zeroUnit: 'yd' };

describe('normalizeCompareEntries', () => {
	it.each([
		['a string', 'entries'],
		['an object', { 0: entry }],
		['a number', 3],
		['null', null],
		['nothing', undefined]
	])('gives no entries for %s', (_, value) => {
		expect(normalizeCompareEntries(value)).toEqual([]);
	});

	it.each([
		['null', null],
		['a number', 1],
		['a string', 'a'],
		['an array', []],
		['a numeric id', { ...entry, id: 1 }],
		['a missing id', { profileId: 'p', zeroDist: '100', zeroUnit: 'yd' }],
		['an object profileId', { ...entry, profileId: {} }],
		['a zero that cannot become text', { ...entry, zeroDist: { toString: 1 } }],
		['an array zero', { ...entry, zeroDist: [100] }],
		['a boolean zero', { ...entry, zeroDist: true }],
		['a null zero', { ...entry, zeroDist: null }],
		['an unknown unit', { ...entry, zeroUnit: 'ft' }],
		['a markup unit', { ...entry, zeroUnit: '<b>' }]
	])('leaves out %s and keeps the good entry', (_, bad) => {
		expect(normalizeCompareEntries([bad, entry])).toEqual([entry]);
	});

	it.each([
		['text', '100'],
		['a number', 100],
		['an empty zero, so its message shows', ''],
		['a rejected zero, so its message shows', '0']
	])('keeps an entry with %s', (_, zeroDist) => {
		const kept = { ...entry, zeroDist, zeroUnit: 'm' };
		expect(normalizeCompareEntries([kept])).toEqual([kept]);
	});
});

describe('compareTrajectories store', () => {
	beforeEach(() => {
		stored.value = { entries: 'damaged', range: {}, yAxis: 'in' };
	});

	it('reads damaged entries as none', () => {
		expect(compareTrajectories.entries).toEqual([]);
	});

	it('can add, change and remove on top of damaged entries', () => {
		compareTrajectories.addEntry('p', '100', 'yd');
		const [{ id }] = compareTrajectories.entries;
		compareTrajectories.updateEntry(id, { zeroDist: '200' });
		expect(compareTrajectories.entries[0].zeroDist).toBe('200');
		compareTrajectories.removeEntry(id);
		expect(compareTrajectories.entries).toEqual([]);
	});
});

describe('compareSeriesName', () => {
	it('escapes the profile name', () => {
		expect(compareSeriesName('<img src=x onerror=alert(1)>', '100', 'yd')).toBe(
			'&lt;img src=x onerror=alert(1)&gt; @ 100 yd'
		);
	});

	it('escapes the zero distance', () => {
		expect(compareSeriesName('Load', '<b>1</b>', 'm')).toBe('Load @ &lt;b&gt;1&lt;/b&gt; m');
	});

	it('escapes an ampersand once', () => {
		expect(compareSeriesName('Smith & Wesson', 100, 'yd')).toBe('Smith &amp; Wesson @ 100 yd');
	});
});
