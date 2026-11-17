/**
 * Hold to repeat for the − and + buttons (#168). A press makes one step at once; held, the step
 * repeats after HOLD_DELAY_MS every HOLD_INTERVAL_MS, and from the HOLD_FAST_AFTER-th repeat on each
 * repeat makes HOLD_FAST_STEPS steps, so large changes (0 to 2000 m) take a few seconds. Display
 * input only: each step goes through the field's own step function and limits.
 */

/** Wait before the first repeat, in ms. */
export const HOLD_DELAY_MS = 400;
/** Time between repeats, in ms. */
export const HOLD_INTERVAL_MS = 100;
/** Repeats made one step at a time before speeding up. */
export const HOLD_FAST_AFTER = 10;
/** Steps per repeat once sped up. */
export const HOLD_FAST_STEPS = 10;

/**
 * The number of steps of the n-th repeat (1 = first repeat after the delay).
 * @param {number} repeat
 * @returns {number}
 */
export function holdSteps(repeat) {
	return repeat > HOLD_FAST_AFTER ? HOLD_FAST_STEPS : 1;
}

/**
 * A press-and-hold repeater.
 *
 * @param {(steps: number) => void} fire - Called with the number of steps to make.
 * @returns {{ start: () => void, stop: () => void, readonly active: boolean }}
 */
export function createHoldRepeat(fire) {
	/** @type {ReturnType<typeof setTimeout> | null} */
	let timer = null;
	let repeat = 0;

	function stop() {
		if (timer !== null) clearTimeout(timer);
		timer = null;
		repeat = 0;
	}

	function tick() {
		repeat += 1;
		fire(holdSteps(repeat));
		timer = setTimeout(tick, HOLD_INTERVAL_MS);
	}

	function start() {
		stop();
		fire(1);
		timer = setTimeout(tick, HOLD_DELAY_MS);
	}

	return {
		start,
		stop,
		get active() {
			return timer !== null;
		}
	};
}
