import { flushSync, mount, tick, unmount } from 'svelte';
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';

// The guided setup's optional step 4 (#177) in jsdom: four steps, the switches passed to the
// validation and the save, Skip saves with both off, the "Use the full form" link on step 1 only.
// jsdom applies no CSS, so the phone-width fix is not checked here.

let GuidedSetup;
let app;
let target;
let onValidateStep;
let onSave;

function show(props = {}) {
	target = document.createElement('div');
	document.body.appendChild(target);
	onValidateStep = vi.fn(() => ({}));
	onSave = vi.fn();
	app = mount(GuidedSetup, { target, props: { onValidateStep, onSave, onExit: vi.fn(), ...props } });
	flushSync();
}

/** Next (or Save on the last step): the form's submit button. */
async function next() {
	target.querySelector('button[type="submit"]').click();
	flushSync();
	await tick();
}

const heading = () => target.querySelector('h1').textContent.trim();
const switchNamed = (name) =>
	[...target.querySelectorAll('[role="switch"]')].find((el) => el.textContent.includes(name));
const buttonNamed = (name) => [...target.querySelectorAll('button')].find((el) => el.textContent.trim() === name);

beforeAll(async () => {
	// The theme button reads the system theme when it loads; jsdom has no matchMedia.
	window.matchMedia = () => ({ matches: false, addEventListener() {}, removeEventListener() {} });
	GuidedSetup = (await import('#lib/components/GuidedSetup.svelte')).default;
});

beforeEach(() => {
	// jsdom has no element scrolling; the setup scrolls the step to the top on each step.
	Element.prototype.scrollTo ??= () => {};
});

afterEach(() => {
	if (app) unmount(app);
	target?.remove();
	app = undefined;
});

describe('GuidedSetup step 4 (#177)', () => {
	it('has four steps, the fourth optional', async () => {
		show();
		expect(target.querySelectorAll('ol > li')).toHaveLength(4);
		for (let i = 0; i < 3; i++) await next();
		expect(heading()).toBe('Advanced (optional)');
		expect(target.querySelector('ol > li[aria-current="step"]').textContent).toContain('Advanced');
		expect(onSave).not.toHaveBeenCalled();
	});

	it('saves with both switches off when nothing is turned on', async () => {
		show();
		for (let i = 0; i < 4; i++) await next();
		expect(onSave).toHaveBeenCalledTimes(1);
		expect(onSave.mock.calls[0][1]).toEqual({ spinDrift: false, tempSensitivity: false });
		expect(onValidateStep).toHaveBeenLastCalledWith(4, expect.any(Object), { spinDrift: false, tempSensitivity: false });
	});

	it('shows the fields of a switch turned on and passes it to the validation and the save', async () => {
		show();
		for (let i = 0; i < 3; i++) await next();
		expect(target.querySelector('input')).toBeNull();
		switchNamed('Spin drift').click();
		flushSync();
		expect(target.querySelectorAll('input')).toHaveLength(2);
		switchNamed('Temperature sensitivity').click();
		flushSync();
		expect(target.querySelectorAll('input')).toHaveLength(4);
		await next();
		expect(onValidateStep).toHaveBeenLastCalledWith(4, expect.any(Object), { spinDrift: true, tempSensitivity: true });
		expect(onSave.mock.calls[0][1]).toEqual({ spinDrift: true, tempSensitivity: true });
	});

	it('does not save while step 4 has errors, and Skip saves without the switches', async () => {
		show();
		for (let i = 0; i < 3; i++) await next();
		switchNamed('Spin drift').click();
		flushSync();
		onValidateStep.mockImplementation((step, form, advanced) =>
			step === 4 && advanced.spinDrift ? { barrelTwist: 'required' } : {}
		);
		await next();
		expect(onSave).not.toHaveBeenCalled();
		expect(target.querySelector('[aria-invalid="true"]')).not.toBeNull();

		buttonNamed('Skip').click();
		flushSync();
		expect(onSave).toHaveBeenCalledTimes(1);
		expect(onSave.mock.calls[0][1]).toEqual({ spinDrift: false, tempSensitivity: false });
	});

	it('shows Skip on step 4 only', async () => {
		show();
		for (let step = 1; step <= 3; step++) {
			expect(buttonNamed('Skip'), `step ${step}`).toBeUndefined();
			await next();
		}
		expect(buttonNamed('Skip')).toBeDefined();
	});

	it('links the full form on step 1 when given, and not on other steps', async () => {
		show({ fullFormHref: '/profiles/new' });
		const link = () => [...target.querySelectorAll('a')].find((a) => a.textContent.trim() === 'Use the full form');
		expect(link()?.getAttribute('href')).toBe('/profiles/new');
		expect(link()?.hasAttribute('data-sveltekit-replacestate')).toBe(true);
		await next();
		expect(link()).toBeUndefined();
	});

	it('has no full form link without one (first run)', () => {
		show();
		expect(target.querySelector('a')).toBeNull();
	});
});
