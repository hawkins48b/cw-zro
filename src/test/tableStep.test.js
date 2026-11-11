/**
 * The Ballistic table step (#130, owner decision: at least 1, in the range unit). The step box
 * shows the minimum under a step below it, the table keeps the step calculateFullTrajectory has
 * always used, and the charts ask ApexCharts for at most MAX_CHART_TICKS x-axis ticks: before, a
 * step of 0.001 on a 3000 yd range asked for 3 million.
 */
import { describe, it, expect, vi, beforeAll, afterAll } from 'vitest';
import { Unit } from 'js-ballistics';
import {
	MAX_CHART_TICKS,
	MIN_TABLE_STEP,
	chartTickAmount,
	isUsableTableStep,
	tableStep
} from '#lib/utils/inputLimits.js';
import { storedRange } from '#lib/utils/storedState.js';
import { calculateFullTrajectory } from '#lib/utils/ballisticCalculator.js';
import { P308_G1 } from './fixtures/ballisticProfiles.js';

/** The table step as calculateFullTrajectory read it before #130, kept here to compare. */
const stepBefore = (step) => Math.max(1, Math.abs(parseFloat(typeof step === 'string' ? step.replace(',', '.') : step)) || 25);

const STEPS = ['25', '1', '1,5', '0.999', '0.5', '0.001', '0', '-0', '-50', '-0.5', '', ' ', 'abc', '5abc', 'Infinity', '1e999', '-1e999', '1e9', 'NaN', 25, 0.001, -3, 0];

describe('tableStep', () => {
	it('is 1 at its smallest', () => {
		expect(MIN_TABLE_STEP).toBe(1);
	});

	it('leaves the ticks of the default step on the longest range as they were', () => {
		expect(MAX_CHART_TICKS).toBe(3000 / 25);
	});

	it.each(STEPS)('reads %j as calculateFullTrajectory read it before #130', (step) => {
		expect(tableStep(step)).toBe(stepBefore(step));
	});

	it.each([
		['0.001', 1],
		['0.999', 1],
		['1', 1],
		['1,5', 1.5],
		['25', 25],
		['-50', 50],
		['', 25],
		['0', 25],
		['abc', 25],
		['1e999', Infinity]
	])('reads %j as %j', (step, expected) => {
		expect(tableStep(step)).toBe(expected);
	});

	it('reads a damaged stored step, an empty box after storedRange, as 25 (#120)', () => {
		expect(tableStep(storedRange({ distance: '500', step: {} }, { step: true }).step)).toBe(25);
	});
});

describe('isUsableTableStep: the step box message', () => {
	it.each(['1', '1.0', '1,5', '25', '3000', '5abc', 1, 25, '', '  '])('shows no message for %j', (step) => {
		expect(isUsableTableStep(step)).toBe(true);
	});

	it.each(['0.999', '0.5', '0.001', '0', '-0', '-1', '-50', 'abc', 'Infinity', '1e999', 'NaN', ',', 0.5, 0, -25, Infinity, NaN])(
		'shows the minimum for %j',
		(step) => {
			expect(isUsableTableStep(step)).toBe(false);
		}
	);

	it('shows no message for a damaged stored step, read as an empty box', () => {
		expect(isUsableTableStep(storedRange({ distance: '500', step: ['0.001'] }, { step: true }).step)).toBe(true);
	});

	it('shows the minimum for a stored step below it, which is not damaged', () => {
		expect(isUsableTableStep(storedRange({ distance: '500', step: '0.001' }, { step: true }).step)).toBe(false);
		expect(isUsableTableStep(storedRange({ distance: '500', step: 0.001 }, { step: true }).step)).toBe(false);
	});
});

describe('chartTickAmount', () => {
	it.each([
		[500, 25, 20],
		[1000, 25, 40],
		[1000, 50, 20],
		[100, 25, 4],
		[10, 25, 0],
		[3000, 50, 60],
		[3000, 25, MAX_CHART_TICKS],
		[2999.9, 25, MAX_CHART_TICKS],
		[3000, 10, MAX_CHART_TICKS],
		[3000, 1, MAX_CHART_TICKS],
		[3000, tableStep('0.001'), MAX_CHART_TICKS]
	])('gives %j / %j as %j ticks', (maxX, step, expected) => {
		expect(chartTickAmount(maxX, step)).toBe(expected);
	});

	it('never asks for more than MAX_CHART_TICKS', () => {
		for (const maxX of [1, 99.5, 500, 1000, 2999.9, 3000])
			for (const step of STEPS.map(tableStep)) {
				const ticks = chartTickAmount(maxX, step);
				expect(ticks === undefined || (Number.isInteger(ticks) && ticks >= 0 && ticks <= MAX_CHART_TICKS)).toBe(true);
			}
	});

	it.each([[0, 25], [-5, 25], [NaN, 25], [500, 0], [500, -1], [500, NaN]])('leaves %j / %j to ApexCharts', (maxX, step) => {
		expect(chartTickAmount(maxX, step)).toBeUndefined();
	});
});

describe('a step below the minimum changes no table', () => {
	beforeAll(() => {
		vi.spyOn(console, 'warn').mockImplementation(() => {});
	});
	afterAll(() => {
		vi.restoreAllMocks();
	});
	const rows = (step) =>
		calculateFullTrajectory(P308_G1, { distance: '1000', unit: 'yd', step }, null, null).trajectory.map((p) => [
			p.distance.In(Unit.Yard),
			p.targetDrop.In(Unit.Inch)
		]);

	it('gives the rows of step 1 for a step of 0.001, at most one per yard', () => {
		const one = rows('1');
		expect(rows('0.001')).toEqual(one);
		expect(one).toHaveLength(1001);
	});

	it('gives the rows of step 50 for -50, and of 25 for text', () => {
		expect(rows('-50')).toEqual(rows('50'));
		expect(rows('abc')).toEqual(rows('25'));
	});
});
