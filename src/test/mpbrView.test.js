/**
 * MPBR page presentation (#166): chart markers and the zero the profile gets. No engine call: the
 * results are written out by hand.
 */
import { describe, it, expect } from 'vitest';
import { chartLabelAnchor, mpbrChartMarkers, mpbrZeroChange } from '#lib/utils/mpbrView.js';

const result = {
	optimalZero: 24,
	nearZero: 24,
	farZero: 235,
	mpbrMin: 0,
	mpbrMax: 268.7,
	maxOrdinate: { elevation: 10, distance: 143.2 },
	halfTarget: 10,
	trajectory: [],
	useMetric: true
};

describe('mpbrChartMarkers', () => {
	it('places near and far zero on the line of sight, the apex at the max. ordinate, the end on the zone bottom', () => {
		expect(mpbrChartMarkers(result)).toEqual([
			{ id: 'near', x: 24, y: 0 },
			{ id: 'far', x: 235, y: 0 },
			{ id: 'apex', x: 143.2, y: 10 },
			{ id: 'end', x: 268.7, y: -10 }
		]);
	});

	it('leaves out what the result does not have', () => {
		const markers = mpbrChartMarkers({ ...result, farZero: null, maxOrdinate: null });
		expect(markers.map((p) => p.id)).toEqual(['near', 'end']);
	});

	it('gives no end marker without a point blank range', () => {
		expect(mpbrChartMarkers({ ...result, mpbrMax: 0 }).map((p) => p.id)).not.toContain('end');
	});

	it('ignores values that are not finite numbers', () => {
		const markers = mpbrChartMarkers({ ...result, nearZero: NaN, farZero: '235', halfTarget: Infinity });
		expect(markers.map((p) => p.id)).toEqual(['apex']);
	});

	it('gives nothing without a result', () => {
		expect(mpbrChartMarkers(null)).toEqual([]);
	});
});

describe('chartLabelAnchor', () => {
	it('anchors labels near the ends into the plot', () => {
		expect(chartLabelAnchor(10, 300)).toBe('start');
		expect(chartLabelAnchor(150, 300)).toBe('middle');
		expect(chartLabelAnchor(290, 300)).toBe('end');
	});

	it('centres when the axis has no length', () => {
		expect(chartLabelAnchor(10, 0)).toBe('middle');
		expect(chartLabelAnchor(10, NaN)).toBe('middle');
	});
});

describe('mpbrZeroChange', () => {
	it('goes from the profile zero to the near zero, in the result unit', () => {
		const change = mpbrZeroChange({ zeroDist: '200', zeroUnit: 'm' }, result);
		expect(change.before).toEqual({ value: 200, unit: 'm' });
		expect(change.after).toEqual({ value: 24, unit: 'm' });
		expect(change.same).toBe(false);
		expect(change.usable).toBe(true);
	});

	it('saves the patch the page saved before #166 (#110): the near zero as a number', () => {
		expect(mpbrZeroChange({ zeroDist: '100', zeroUnit: 'yd' }, result).patch).toEqual({
			zeroDist: 24,
			zeroUnit: 'm'
		});
		const yards = mpbrZeroChange({ zeroDist: '100', zeroUnit: 'm' }, { ...result, useMetric: false });
		expect(yards.patch).toEqual({ zeroDist: 24, zeroUnit: 'yd' });
	});

	it('says when the profile already zeroes there', () => {
		expect(mpbrZeroChange({ zeroDist: '24', zeroUnit: 'm' }, result).same).toBe(true);
		expect(mpbrZeroChange({ zeroDist: 24, zeroUnit: 'm' }, result).same).toBe(true);
		// Same number, other unit: a change.
		expect(mpbrZeroChange({ zeroDist: '24', zeroUnit: 'yd' }, result).same).toBe(false);
	});

	it('reads the profile zero as the calculators do: comma, sign', () => {
		expect(mpbrZeroChange({ zeroDist: '-24,5', zeroUnit: 'm' }, result).before.value).toBe(24.5);
	});

	it('shows no before value for an unreadable zero', () => {
		expect(mpbrZeroChange({ zeroDist: '', zeroUnit: 'm' }, result).before.value).toBeNull();
		expect(mpbrZeroChange({ zeroDist: { a: 1 }, zeroUnit: 'xx' }, result).before).toEqual({ value: null, unit: 'yd' });
	});

	it('marks a zero past the longest one as not usable (#93)', () => {
		expect(mpbrZeroChange({ zeroDist: '100', zeroUnit: 'm' }, { ...result, optimalZero: 1e9 }).usable).toBe(false);
	});

	it('gives nothing without a profile or a result', () => {
		expect(mpbrZeroChange(null, result)).toBeNull();
		expect(mpbrZeroChange({ zeroDist: '100' }, null)).toBeNull();
	});
});
