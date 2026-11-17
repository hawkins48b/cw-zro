/**
 * Trajectory Validation page presentation (#166): before → after, Apply's patch and the
 * observation on the chart. No search runs: the results are written out by hand.
 */
import { describe, it, expect } from 'vitest';
import {
	validationChange,
	validationObservationPoint,
	validationPatch,
	validationPicture,
	PICTURE_REACH
} from '#lib/utils/validationView.js';

const velocityResult = {
	solveFor: 'velocity',
	initialVelocity: 780,
	validatedVelocity: 766,
	initialBc: 0.505,
	validatedBc: 0.505
};
const bcResult = {
	solveFor: 'bc',
	initialVelocity: 780,
	validatedVelocity: 780,
	initialBc: 0.505,
	validatedBc: 0.462
};

describe('validationChange', () => {
	it('velocity: before, after, difference and percent', () => {
		expect(validationChange(velocityResult)).toEqual({
			field: 'velocity',
			before: 780,
			after: 766,
			diff: -14,
			percent: -1.8,
			same: false
		});
	});

	it('BC: the difference without floating point noise', () => {
		const change = validationChange(bcResult);
		expect(change.field).toBe('bc');
		expect(change.diff).toBe(-0.043);
		expect(change.percent).toBe(-8.5);
	});

	it('keeps a decimal profile velocity in the difference', () => {
		expect(validationChange({ ...velocityResult, initialVelocity: 780.5 }).diff).toBe(-14.5);
	});

	it('says when nothing changes', () => {
		const change = validationChange({ ...velocityResult, validatedVelocity: 780 });
		expect(change.same).toBe(true);
		expect(change.percent).toBe(0);
	});

	it('gives no percent on a zero before value', () => {
		expect(validationChange({ ...velocityResult, initialVelocity: 0 }).percent).toBeNull();
	});

	it('gives nothing for an error, null or non-finite values', () => {
		expect(validationChange(null)).toBeNull();
		expect(validationChange({ error: 'no_solution' })).toBeNull();
		expect(validationChange({ ...velocityResult, validatedVelocity: NaN })).toBeNull();
	});
});

describe('validationPatch', () => {
	it('saves the solved field as text, as before #166', () => {
		expect(validationPatch(velocityResult)).toEqual({ velocity: '766' });
		expect(validationPatch(bcResult)).toEqual({ bc: '0.462' });
	});

	it('saves nothing on an error', () => {
		expect(validationPatch({ error: 'timeout' })).toBeNull();
		expect(validationPatch(null)).toBeNull();
	});
});

describe('validationObservationPoint', () => {
	it('puts a below observation under the line of sight, at the range', () => {
		expect(validationObservationPoint('600', '4.6', 'below')).toEqual({ x: 600, y: -4.6 });
	});

	it('puts an above observation over it; the typed sign is ignored', () => {
		expect(validationObservationPoint(600, '-4.6', 'above')).toEqual({ x: 600, y: 4.6 });
	});

	it('rounds the value to 0.1, as the search goal', () => {
		expect(validationObservationPoint('500', '2,46', 'below')).toEqual({ x: 500, y: -2.5 });
	});

	it('gives nothing for an empty, zero or unreadable value or range', () => {
		expect(validationObservationPoint('600', '', 'below')).toBeNull();
		expect(validationObservationPoint('600', '0', 'below')).toBeNull();
		expect(validationObservationPoint('', '4', 'below')).toBeNull();
		expect(validationObservationPoint('abc', '4', 'below')).toBeNull();
		expect(validationObservationPoint('-5', '4', 'below')).toBeNull();
	});
});

describe('validationPicture (#194)', () => {
	it('puts the larger value at the reach, the other to scale, below as down', () => {
		expect(validationPicture(-10, '20', 'below')).toEqual({ predictedY: PICTURE_REACH / 2, observedY: PICTURE_REACH, example: false });
		expect(validationPicture(-20, '10', 'below')).toEqual({ predictedY: PICTURE_REACH, observedY: PICTURE_REACH / 2, example: false });
	});

	it('draws above the aim point as up, and ignores the sign of the typed value', () => {
		expect(validationPicture(4, '-8', 'above')).toEqual({ predictedY: -PICTURE_REACH / 2, observedY: -PICTURE_REACH, example: false });
	});

	it('reads a decimal comma', () => {
		expect(validationPicture(-5, '2,5', 'below').observedY).toBe(PICTURE_REACH / 2);
	});

	it.each([
		['no calculator value', null, '12'],
		['an empty observation', -10, ''],
		['an observation of 0', -10, '0'],
		['text', -10, 'abc']
	])('is an example for %s, on the side chosen', (_, predicted, observed) => {
		expect(validationPicture(predicted, observed, 'below')).toEqual({ predictedY: PICTURE_REACH * 0.6, observedY: PICTURE_REACH, example: true });
		expect(validationPicture(predicted, observed, 'above').observedY).toBe(-PICTURE_REACH);
	});
});
