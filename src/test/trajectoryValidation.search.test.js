/**
 * The validation search on made-up curves (#82, #83). The real measure rises with velocity
 * everywhere it was sampled, so shapes it does not have are tested here, with the shot replaced:
 * nothing reaches the library, so none of these searches can stall the run.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { calculateShotPoint } from '#lib/utils/ballisticCalculator.js';
import { calculateTrajectoryValidation } from '#lib/utils/trajectoryValidation.js';

vi.mock('#lib/utils/ballisticCalculator.js', () => ({ calculateShotPoint: vi.fn() }));

const profile = { velocity: '3000', bc: '0.3', zeroDist: 25, zeroUnit: 'yd' };
const range = { distance: 100, unit: 'yd' };

/** Make the measure at a velocity follow curve; a null from curve is a failed shot. */
function flyOn(curve) {
	calculateShotPoint.mockImplementation((shotProfile) => {
		const measure = curve(parseFloat(shotProfile.velocity));
		if (measure === null) return null;
		const value = { In: () => measure };
		return { slantHeight: value, dropAngle: value, firedAt: parseFloat(shotProfile.velocity) };
	});
}

const solve = (value, direction = 'below') =>
	calculateTrajectoryValidation(profile, range, 'distance', value, 'in', 'velocity', null, direction);

describe('trajectory validation search', () => {
	beforeEach(() => {
		calculateShotPoint.mockReset();
	});

	it('solves a rising curve, as a check on this setup', () => {
		flyOn((v) => (v - 2000) / 10);
		const result = solve('50', 'above');
		expect(result.validatedVelocity).toBe(2500);
		expect(result.validatedPoint.firedAt).toBe(2500);
	});

	it.each([
		['below the goal', '50', 'above'],
		['above the goal', '500', 'below']
	])('gives no value on a falling curve that starts %s', (_, value, direction) => {
		flyOn((v) => (direction === 'above' ? -v / 10 : (5000 - v) / 10));
		expect(solve(value, direction).error).toBe('no_solution');
	});

	it('does not settle on the falling side of a hump', () => {
		// Peak at 2000, with the goal of 50 met at 1500 and 2500. The search starts past the
		// peak, under the goal, so it walks up and away. The price is a missed root, not a wrong one.
		flyOn((v) => 100 - Math.abs(v - 2000) / 10);
		expect(solve('50', 'above').error).toBe('no_solution');
	});

	it('reports no solution on a flat curve that never reaches the goal', () => {
		flyOn(() => 8);
		expect(solve('9', 'above').error).toBe('no_solution');
	});

	it('does not accept the last good shot when the next one fails', () => {
		flyOn((v) => (v < 2500 ? null : (v - 2000) / 10));
		expect(solve('10', 'above').error).toBe('no_solution');
	});

	it('still solves past failed shots when the goal is on the good side of them', () => {
		flyOn((v) => (v < 2400 ? null : (v - 2000) / 10));
		const result = solve('45', 'above');
		expect(result.validatedVelocity).toBe(2450);
	});

	it('fires the rounded value when the search stops between whole numbers', () => {
		// Steep enough that only a bracket can end this: each fps moves the measure by 3.
		flyOn((v) => (v - 2000.4) * 3);
		const result = solve('1', 'above');
		expect(result.error).toBeUndefined();
		expect(result.validatedPoint.firedAt).toBe(result.validatedVelocity);
		expect(Number.isInteger(result.validatedVelocity)).toBe(true);
	});

	it('gives up after a bounded number of shots', () => {
		// Crossings shrink the step, then the curve stays under the goal: a walk of thousands
		// of small steps to the upper bound. This curve changes between shots at one velocity,
		// which a real one cannot, so only the number of shots means anything here.
		let shots = 0;
		flyOn(() => (shots++ < 7 && shots % 2 === 0 ? 1000 : -1000));
		solve('5', 'above');
		expect(calculateShotPoint.mock.calls.length).toBeGreaterThanOrEqual(200);
		expect(calculateShotPoint.mock.calls.length).toBeLessThanOrEqual(202);
	});
});

/**
 * The clock is fake and each shot advances it, so these depend on the number of shots only.
 * The budget is 5000 ms, and the clock is read once at the start and once before each shot.
 */
describe('trajectory validation time budget', () => {
	let now;

	/** Make every shot take msPerShot, or whatever msForShot(shot number) returns. */
	function shotsTake(msForShot, curve) {
		let shots = 0;
		flyOn((v) => {
			now += msForShot(++shots);
			return curve(v);
		});
	}

	beforeEach(() => {
		calculateShotPoint.mockReset();
		now = 1000;
		vi.spyOn(performance, 'now').mockImplementation(() => now);
	});

	afterEach(() => {
		vi.restoreAllMocks();
	});

	it('reports a timeout when the budget runs out before the search converges', () => {
		shotsTake(() => 2000, (v) => (v - 2000) / 10);
		expect(solve('50', 'above')).toEqual({ error: 'timeout' });
		// Fired at 0, 2000 and 4000 ms; at 6000 ms the budget is gone.
		expect(calculateShotPoint.mock.calls.length).toBe(3);
	});

	it('stops on the failed-shot path too', () => {
		// Only the first shot is good, so every later one takes the back-off branch.
		shotsTake(() => 2000, (v) => (v === 3000 ? -100 : null));
		expect(solve('50', 'above')).toEqual({ error: 'timeout' });
		expect(calculateShotPoint.mock.calls.length).toBe(3);
	});

	it('still suggests above when the budget runs out', () => {
		shotsTake(() => 2000, (v) => (v - 2000) / 10);
		expect(solve('50', 'below')).toEqual({ error: 'timeout', suggestAbove: true });
	});

	it('still reports no solution for an unreachable goal inside the budget', () => {
		shotsTake(() => 1, () => 8);
		expect(solve('9', 'above')).toEqual({ error: 'no_solution' });
	});

	it('reports no solution when the search had finished as the budget ran out', () => {
		// Every shot after the first fails, so the step halves down to its minimum. The last of those
		// shots uses up the budget, but the search had nothing left to try: the goal is out of reach.
		const clean = () => (v) => (v === 3000 ? -100 : null);
		shotsTake(() => 1, clean());
		expect(solve('50', 'above')).toEqual({ error: 'no_solution' });
		const shots = calculateShotPoint.mock.calls.length;

		calculateShotPoint.mockReset();
		now = 1000;
		shotsTake((shot) => (shot === shots ? 9000 : 1), clean());
		expect(solve('50', 'above')).toEqual({ error: 'no_solution' });
		expect(calculateShotPoint.mock.calls.length).toBe(shots);
	});

	it('does not fire another shot once the budget is gone', () => {
		shotsTake((shot) => (shot === 1 ? 5000 : 1), (v) => (v - 2000) / 10);
		expect(solve('50', 'above').error).toBe('timeout');
		expect(calculateShotPoint.mock.calls.length).toBe(1);
	});

	it('returns an exact hit reached on the shot that used up the budget', () => {
		// 3000, then 2900 ... the goal of 50 is met at 2500, the sixth shot, which takes 9 s.
		shotsTake((shot) => (shot === 6 ? 9000 : 1), (v) => (v - 2000) / 10);
		const result = solve('50', 'above');
		expect(result.validatedVelocity).toBe(2500);
		expect(result.validatedPoint.firedAt).toBe(2500);
		expect(calculateShotPoint.mock.calls.length).toBe(6);
	});

	it('returns a bracketed answer closed by the shot that used up the budget', () => {
		// Each fps moves the measure by 3, so no shot equals the goal, which lies at 2000.73.
		// Shots 2000 and then 2001.5625, the 19th, close the bracket. A clean search goes on to
		// step back onto 2000; this one stops, on the other end of the same bracket.
		const curve = (v) => (v - 2000.4) * 3;
		shotsTake(() => 1, curve);
		expect(solve('1', 'above').validatedVelocity).toBe(2000);
		expect(calculateShotPoint.mock.calls.length).toBe(20);

		calculateShotPoint.mockReset();
		now = 1000;
		shotsTake((shot) => (shot === 19 ? 9000 : 1), curve);
		const late = solve('1', 'above');
		expect(late.validatedVelocity).toBe(2002);
		expect(late.validatedPoint.firedAt).toBe(2002);
	});

	it('leaves a normal solve alone', () => {
		shotsTake(() => 3, (v) => (v - 2000.4) * 3);
		const timed = solve('1', 'above');
		vi.restoreAllMocks();
		flyOn((v) => (v - 2000.4) * 3);
		const plain = solve('1', 'above');
		expect(timed.error).toBeUndefined();
		expect(timed.validatedVelocity).toBe(plain.validatedVelocity);
	});

	it('runs right up to the budget', () => {
		// 2500 is the sixth shot: the clock reads 4999 before it, just inside the budget.
		shotsTake((shot) => (shot === 5 ? 4995 : 1), (v) => (v - 2000) / 10);
		expect(solve('50', 'above').validatedVelocity).toBe(2500);
	});
});
