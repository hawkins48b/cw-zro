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
	maxTableStep,
	tableStep,
	tableStepLimit
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
			p.slantHeight.In(Unit.Inch)
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

/**
 * The maximum step (#133, owner decision): the range. A step above it, or infinite, shows the
 * maximum under the box, and the table reads it as the range: before, 1e9 or 1e999 on a 3000 yd
 * range gave no table, and a step above a 1000 yd range only the muzzle row.
 */
describe('maxTableStep (#133)', () => {
	it.each([
		['1000', 1000],
		['333,3', 333.3],
		[3000, 3000],
		['-500', 500],
		['1', 1],
		['0.5', 1],
		['0,01', 1],
		['', Infinity],
		['0', Infinity],
		['abc', Infinity],
		['Infinity', Infinity],
		['1e999', Infinity],
		[null, Infinity],
		[undefined, Infinity]
	])('is %j for a range of %j', (distance, expected) => {
		expect(maxTableStep(distance)).toBe(expected);
	});
});

describe('tableStep with a range (#133)', () => {
	const IN_RANGE = ['1', '1,5', '7', '25', '100', '999', '999.99', '1000', '', '0', 'abc', '0.001', '-50', 25, 1000];

	it.each(IN_RANGE)('reads %j as without a range, up to the range', (step) => {
		expect(tableStep(step, '1000')).toBe(tableStep(step));
	});

	it.each(STEPS)('reads %j as before #133 without a range', (step) => {
		expect(tableStep(step)).toBe(stepBefore(step));
	});

	it.each([
		['1000.01', 1000],
		['1001', 1000],
		['5000', 1000],
		['1e9', 1000],
		['1e999', 1000],
		['Infinity', 1000],
		['-1e999', 1000],
		['-5000', 1000],
		[Infinity, 1000],
		[1e9, 1000]
	])('reads %j above a 1000 range as the range', (step, expected) => {
		expect(tableStep(step, '1000')).toBe(expected);
	});

	it('reads the empty box, 25, as the range on a range under 25', () => {
		expect(tableStep('', '10')).toBe(10);
		expect(tableStep('', '10')).toBe(tableStep('', 10));
	});

	it('keeps the minimum on a range under it', () => {
		expect(tableStep('0.5', '0.5')).toBe(1);
		expect(tableStep('1e9', '0.5')).toBe(1);
	});
});

describe('tableStepLimit: which message the step box shows (#130, #133)', () => {
	it.each([
		['1', '1000', null],
		['25', '1000', null],
		['1000', '1000', null],
		['1000,0', '1000', null],
		['333.3', '333,3', null],
		['', '1000', null],
		['  ', '10', null],
		['1', '0.5', null],
		['1000.01', '1000', 'max'],
		['1001', '1000', 'max'],
		['26', '25', 'max'],
		['1e9', '3000', 'max'],
		['1e999', '3000', 'max'],
		['Infinity', '3000', 'max'],
		[Infinity, '3000', 'max'],
		['Infinity', '', 'max'],
		['1e999', undefined, 'max'],
		['2', '0.5', 'max'],
		['0.999', '1000', 'min'],
		['0', '1000', 'min'],
		['-50', '1000', 'min'],
		['-5000', '1000', 'min'],
		['-1e999', '1000', 'min'],
		['abc', '1000', 'min'],
		['NaN', '1000', 'min'],
		[NaN, '1000', 'min'],
		['5000', '', null],
		['5000', 'abc', null]
	])('step %j on a range of %j: %j', (step, distance, expected) => {
		expect(tableStepLimit(step, distance)).toBe(expected);
		expect(isUsableTableStep(step, distance)).toBe(expected === null);
	});

	it('shows the maximum for a stored step above the range, which is not damaged', () => {
		const range = (step) => storedRange({ distance: '500', step }, { step: true });
		expect(tableStepLimit(range('1000').step, range('1000').distance)).toBe('max');
		expect(tableStepLimit(range(1e9).step, range(1e9).distance)).toBe('max');
		expect(tableStepLimit(range('500').step, range('500').distance)).toBeNull();
	});

	it('shows nothing for a damaged stored step, read as an empty box (25)', () => {
		const stored = storedRange({ distance: '500', step: { big: 1e9 } }, { step: true });
		expect(tableStepLimit(stored.step, stored.distance)).toBeNull();
		expect(tableStep(stored.step, stored.distance)).toBe(25);
	});

	it('gives one chart tick for an infinite step, not 0', () => {
		expect(chartTickAmount(3000, tableStep('1e999', '3000'))).toBe(1);
	});
});

describe('a step above the range gives the table of the range (#133)', () => {
	beforeAll(() => {
		vi.spyOn(console, 'warn').mockImplementation(() => {});
	});
	afterAll(() => {
		vi.restoreAllMocks();
	});
	const result = (step, distance = '1000') => calculateFullTrajectory(P308_G1, { distance, unit: 'yd', step }, null, null);
	const rows = (step, distance) =>
		result(step, distance).trajectory.map((p) => [p.distance.In(Unit.Yard), p.slantHeight.In(Unit.Inch)]);

	it('gives the muzzle row and the row at the range for a step equal to the range', () => {
		const table = rows('1000');
		expect(table).toHaveLength(2);
		expect(table[0][0]).toBe(0);
		expect(table[1][0]).toBeCloseTo(1000, 6);
	});

	it.each([['1001'], ['5000'], ['1e9'], ['1e999'], ['Infinity'], ['-5000']])('gives the rows of step 1000 for %j', (step) => {
		expect(rows(step)).toEqual(rows('1000'));
	});

	it.each([['1e9'], ['1e999'], ['Infinity']])('gives a table on a 3000 yd range for %j, where there was none', (step) => {
		expect(rows(step, '3000')).toEqual(rows('3000', '3000'));
		expect(rows(step, '3000')).toHaveLength(2);
	});

	it('gives the same key points as any other step', () => {
		const keys = ({ nearZero, farZero, maxApex, maxDrop, subsonicDist }) => ({ nearZero, farZero, maxApex, maxDrop, subsonicDist });
		expect(keys(result('1e999', '1500'))).toEqual(keys(result('25', '1500')));
	});
});
