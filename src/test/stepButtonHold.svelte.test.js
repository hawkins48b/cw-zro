import { flushSync, mount, unmount } from 'svelte';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import StepperField from '#lib/components/StepperField.svelte';
import { HOLD_DELAY_MS, HOLD_FAST_AFTER, HOLD_INTERVAL_MS } from '#lib/utils/holdRepeat.js';

// − and + held down (#168), on StepperField in jsdom: a tap is one step, a hold repeats and speeds
// up, release / leave / cancel stop it, the limits hold, keyboard clicks make one step.

let app;
let target;
let value;

function show(start, spec) {
	value = start;
	target = document.createElement('div');
	document.body.appendChild(target);
	const props = $state({
		value: start,
		spec,
		decreaseLabel: 'down',
		increaseLabel: 'up',
		onchange: (text) => {
			value = text;
			props.value = text;
		}
	});
	app = mount(StepperField, { target, props });
	flushSync();
	return {
		down: target.querySelector('button[aria-label="down"]'),
		up: target.querySelector('button[aria-label="up"]')
	};
}

const press = (el, type) => el.dispatchEvent(new MouseEvent(type, { bubbles: true, button: 0 }));
const tick = (ms) => {
	vi.advanceTimersByTime(ms);
	flushSync();
};

beforeEach(() => vi.useFakeTimers());
afterEach(() => {
	if (app) unmount(app);
	target?.remove();
	app = undefined;
	vi.useRealTimers();
});

const SPEC = { step: 10, min: -500, max: 9000, start: 0 };

describe('StepButton hold to repeat (#168)', () => {
	it('makes one step on a tap, and ignores the pointer click after it', () => {
		const { up } = show('100', SPEC);
		press(up, 'pointerdown');
		press(up, 'pointerup');
		up.dispatchEvent(new MouseEvent('click', { bubbles: true, detail: 1 }));
		tick(2000);
		expect(value).toBe('110');
	});

	it('repeats while held, then ten steps a repeat', () => {
		const { up } = show('0', SPEC);
		press(up, 'pointerdown');
		tick(HOLD_DELAY_MS + HOLD_INTERVAL_MS * (HOLD_FAST_AFTER - 1));
		expect(value).toBe(String(10 * (1 + HOLD_FAST_AFTER)));
		tick(HOLD_INTERVAL_MS);
		expect(value).toBe(String(10 * (1 + HOLD_FAST_AFTER) + 100));
		press(up, 'pointerup');
		const held = value;
		tick(2000);
		expect(value).toBe(held);
	});

	it.each(['pointerleave', 'pointercancel'])('stops on %s', (type) => {
		const { down } = show('1000', SPEC);
		press(down, 'pointerdown');
		tick(HOLD_DELAY_MS);
		press(down, type);
		tick(2000);
		expect(value).toBe('980');
	});

	it('stays within the limits', () => {
		const { up } = show('8950', SPEC);
		press(up, 'pointerdown');
		tick(HOLD_DELAY_MS + HOLD_INTERVAL_MS * 30);
		press(up, 'pointerup');
		expect(value).toBe('9000');
	});

	it('ignores other mouse buttons', () => {
		const { up } = show('100', SPEC);
		up.dispatchEvent(new MouseEvent('pointerdown', { bubbles: true, button: 2 }));
		tick(2000);
		expect(value).toBe('100');
	});

	it('makes one step on a keyboard click (detail 0)', () => {
		const { down } = show('100', SPEC);
		down.dispatchEvent(new MouseEvent('click', { bubbles: true, detail: 0 }));
		flushSync();
		expect(value).toBe('90');
	});

	it('blocks the context menu of a long tap', () => {
		const { up } = show('100', SPEC);
		const e = new MouseEvent('contextmenu', { bubbles: true, cancelable: true });
		up.dispatchEvent(e);
		expect(e.defaultPrevented).toBe(true);
	});
});
