/** Hold to repeat of the − and + buttons (#168). */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
	HOLD_DELAY_MS,
	HOLD_FAST_AFTER,
	HOLD_FAST_STEPS,
	HOLD_INTERVAL_MS,
	createHoldRepeat,
	holdSteps
} from '#lib/utils/holdRepeat.js';

beforeEach(() => vi.useFakeTimers());
afterEach(() => vi.useRealTimers());

describe('holdSteps', () => {
	it('makes one step for the first repeats, then ten', () => {
		expect(holdSteps(1)).toBe(1);
		expect(holdSteps(HOLD_FAST_AFTER)).toBe(1);
		expect(holdSteps(HOLD_FAST_AFTER + 1)).toBe(HOLD_FAST_STEPS);
	});
});

describe('createHoldRepeat', () => {
	it('steps once at once and nothing more on a short press', () => {
		const fire = vi.fn();
		const hold = createHoldRepeat(fire);
		hold.start();
		expect(fire.mock.calls).toEqual([[1]]);
		vi.advanceTimersByTime(HOLD_DELAY_MS - 1);
		hold.stop();
		vi.advanceTimersByTime(5000);
		expect(fire).toHaveBeenCalledTimes(1);
		expect(hold.active).toBe(false);
	});

	it('repeats after the delay and speeds up after the first repeats', () => {
		const fire = vi.fn();
		const hold = createHoldRepeat(fire);
		hold.start();
		vi.advanceTimersByTime(HOLD_DELAY_MS);
		expect(fire).toHaveBeenCalledTimes(2);
		vi.advanceTimersByTime(HOLD_INTERVAL_MS * (HOLD_FAST_AFTER - 1));
		expect(fire.mock.calls.map(([n]) => n)).toEqual(Array(HOLD_FAST_AFTER + 1).fill(1));
		vi.advanceTimersByTime(HOLD_INTERVAL_MS);
		expect(fire).toHaveBeenLastCalledWith(HOLD_FAST_STEPS);
		hold.stop();
		const count = fire.mock.calls.length;
		vi.advanceTimersByTime(5000);
		expect(fire).toHaveBeenCalledTimes(count);
	});

	it('starts over from one step on the next press', () => {
		const fire = vi.fn();
		const hold = createHoldRepeat(fire);
		hold.start();
		vi.advanceTimersByTime(HOLD_DELAY_MS + HOLD_INTERVAL_MS * HOLD_FAST_AFTER);
		hold.stop();
		fire.mockClear();
		hold.start();
		vi.advanceTimersByTime(HOLD_DELAY_MS);
		expect(fire.mock.calls).toEqual([[1], [1]]);
		hold.stop();
	});
});
