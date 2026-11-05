import { describe, it, expect, vi, beforeEach } from 'vitest';
import { Y_AXIS_UNITS, normalizeYAxisUnit } from '#lib/utils/yAxisUnit.js';
import { compareTrajectories } from '#lib/stores/compareTrajectories.svelte.js';

const stored = vi.hoisted(() => ({ value: {} }));

vi.mock('#lib/stores/localStore.svelte.js', () => ({ localStore: () => stored }));

describe('normalizeYAxisUnit', () => {
	it('keeps every allowed unit', () => {
		expect(Y_AXIS_UNITS).toEqual(['in', 'ft', 'yd', 'cm', 'm']);
		for (const unit of Y_AXIS_UNITS) {
			expect(normalizeYAxisUnit(unit)).toBe(unit);
		}
	});

	it('replaces a markup value', () => {
		expect(normalizeYAxisUnit('<img src=x onerror=alert(1)>')).toBe('in');
	});

	it('replaces a missing value', () => {
		expect(normalizeYAxisUnit(undefined)).toBe('in');
		expect(normalizeYAxisUnit(null)).toBe('in');
		expect(normalizeYAxisUnit('')).toBe('in');
	});

	it('replaces other unknown values', () => {
		for (const value of ['mm', 'IN', ' in', 'constructor', '__proto__', 0, true, {}, ['m']]) {
			expect(normalizeYAxisUnit(value)).toBe('in');
		}
	});
});

describe('compareTrajectories.yAxis', () => {
	beforeEach(() => {
		stored.value = {};
	});

	it('returns a valid stored unit unchanged', () => {
		for (const unit of Y_AXIS_UNITS) {
			stored.value = { yAxis: unit };
			expect(compareTrajectories.yAxis).toBe(unit);
		}
	});

	it('returns in for a stored markup value', () => {
		stored.value = { yAxis: '<img src=x onerror=alert(1)>' };
		expect(compareTrajectories.yAxis).toBe('in');
	});

	it('returns in when nothing is stored', () => {
		expect(compareTrajectories.yAxis).toBe('in');
	});
});
