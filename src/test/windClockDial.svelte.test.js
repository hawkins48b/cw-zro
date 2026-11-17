import { flushSync, mount, unmount } from 'svelte';
import { afterEach, describe, expect, it, vi } from 'vitest';
import WindDial from '#lib/components/WindDial.svelte';

// The wind dial as a shooter's clock (#165), mounted in jsdom: hour numerals, the target at 12,
// the highlight and the arrow turned to where the wind comes from, and the hour in aria-valuetext.

let app;
let target;

function show(direction, onchange = () => {}) {
	target = document.createElement('div');
	document.body.appendChild(target);
	app = mount(WindDial, { target, props: { direction, onchange } });
	flushSync();
	return target.querySelector('[role="slider"]');
}

afterEach(() => {
	if (app) unmount(app);
	target?.remove();
	app = undefined;
});

/** The rotation of the transformed elements (highlight circle, arrow group), in degrees. */
function rotations(el) {
	return [...el.querySelectorAll('[transform^="rotate("]')].map((n) =>
		Number(n.getAttribute('transform').match(/rotate\(([-\d.]+)/)[1])
	);
}

describe('WindDial shooter clock (#165)', () => {
	it('shows the hours 1 to 11 and no degree labels or Wind icon', () => {
		const dial = show('90');
		const texts = [...dial.querySelectorAll('text')].map((t) => t.textContent);
		expect(texts).toEqual(['1', '2', '3', '4', '5', '6', '7', '8', '9', '10', '11']);
		expect(dial.querySelector('svg.lucide-wind')).toBeNull();
	});

	it.each([
		['90', 90, "3 o'clock, 90°"],
		['0', 0, "12 o'clock, 0°"],
		['37', 37, "1 o'clock, 37°"],
		['-90', 270, "9 o'clock, 270°"],
		['400,5', 40.5, "1 o'clock, 41°"],
		['', 0, "12 o'clock, 0°"],
		['Infinity', 0, "12 o'clock, 0°"],
		['1e999', 0, "12 o'clock, 0°"]
	])('turns the highlight and the arrow to %j (from %s°) and announces it', (direction, deg, text) => {
		const dial = show(direction);
		const turns = rotations(dial);
		expect(turns.length).toBe(2);
		for (const turn of turns) expect(turn).toBeCloseTo(deg, 6);
		expect(dial.getAttribute('aria-valuetext')).toBe(text);
	});

	it('draws the arrow head inward, short of the shooter in the centre', () => {
		const dial = show('90');
		const head = dial.querySelector('polygon').getAttribute('points');
		const tip = head.split(' ')[0].split(',').map(Number);
		expect(tip).toEqual([50, 43]);
	});

	it('turns the numeral on the highlight white, only on a whole hour', () => {
		let dial = show('90');
		const three = [...dial.querySelectorAll('text')].find((t) => t.textContent === '3');
		expect(three.getAttribute('class')).toContain('fill-white');
		unmount(app);
		target.remove();
		dial = show('95');
		const all = [...dial.querySelectorAll('text')];
		expect(all.some((t) => t.getAttribute('class').includes('fill-white'))).toBe(false);
	});

	it('keeps the keyboard steps of #155', () => {
		const onchange = vi.fn();
		const dial = show('90', onchange);
		for (const [key, value] of [
			['ArrowRight', '95'],
			['ArrowLeft', '85'],
			['PageDown', '105'],
			['PageUp', '75'],
			['Home', '0']
		]) {
			dial.dispatchEvent(new KeyboardEvent('keydown', { key, bubbles: true }));
			expect(onchange).toHaveBeenLastCalledWith(value);
		}
	});
});
