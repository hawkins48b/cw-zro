import { flushSync, mount, unmount } from 'svelte';
import { afterEach, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { PICTURE_REACH } from '#lib/utils/validationView.js';

// The Trajectory Validation picture (#194), mounted in jsdom: the three marks, to scale, and the text.

let Picture;
let component = null;
let target;

beforeAll(async () => {
	Picture = (await import('#lib/components/calc/ValidationImpactPicture.svelte')).default;
});
beforeEach(() => {
	target = document.createElement('div');
	document.body.append(target);
});
afterEach(() => {
	if (component) unmount(component);
	component = null;
	target.remove();
});

const render = (props) => {
	component = mount(Picture, {
		target,
		props: { type: 'angle', direction: 'below', predicted: -10, observed: '20', unit: 'MOA', format: (v) => String(v), ...props }
	});
	flushSync();
};
/** cy of the circles of the picture: lens, target rings, impacts, aim point. */
const marks = () => [...target.querySelectorAll('svg circle')].map((c) => Number(c.getAttribute('cy')));

describe('ValidationImpactPicture', () => {
	it('draws the calculator and observed impacts to scale below the aim point, with their values', () => {
		render();
		const ys = marks();
		expect(ys).toContain(120 + PICTURE_REACH / 2);
		expect(ys).toContain(120 + PICTURE_REACH);
		expect(target.textContent).toContain('Impact according to the ballistic calculator · 10 MOA');
		expect(target.textContent).toContain('Observed impact · 20 MOA');
		expect(target.querySelector('svg').getAttribute('aria-label')).toContain('Observed impact: 20 MOA');
		expect(target.textContent).toContain('correction that brought the real impact onto the aim point');
	});

	it('draws above the aim point for above, and explains a distance', () => {
		render({ type: 'distance', direction: 'above', predicted: 5, observed: '10', unit: 'cm' });
		expect(marks()).toContain(120 - PICTURE_REACH);
		expect(target.textContent).toContain('Measure on the target how far the real impact is from the aim point');
	});

	it('is an example without a result, and says so', () => {
		render({ predicted: null });
		expect(target.textContent).toContain('Example picture');
		expect(target.textContent).not.toContain('· ');
	});
});
