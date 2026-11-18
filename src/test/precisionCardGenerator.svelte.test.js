import { flushSync, mount, unmount } from 'svelte';
import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest';

// The precision card generator's maximum distance (#198) in jsdom: the m / yd chips inside the box,
// no Metric / Imperial presets, the box rounded to the nearest hundred when it loses focus, and the
// card always given a whole hundred. jsdom applies no CSS, so the look is not checked here.

const profileRef = vi.hoisted(() => ({ current: null }));
const generate = vi.hoisted(() => vi.fn(async () => null));

vi.mock('#lib/stores/activeProfile.svelte.js', () => ({
	activeProfile: {
		get id() {
			return profileRef.current?.id ?? null;
		},
		get profile() {
			return profileRef.current;
		}
	}
}));
vi.mock('#lib/utils/precisionCardPdf.js', () => ({ generatePrecisionDopeCard: generate }));

const PROFILE = Object.freeze({
	id: 'p1',
	name: 'Test',
	zeroDist: 100,
	zeroUnit: 'yd',
	reticleType: 'mrad',
	elevationClickValue: '0.1',
	elevationClickUnit: 'MRAD',
	windageClickValue: '0.1',
	windageClickUnit: 'MRAD'
});

let Generator;
let app;
let target;

beforeAll(async () => {
	Generator = (await import('#lib/components/PrecisionCardGenerator.svelte')).default;
});

afterEach(() => {
	if (app) unmount(app);
	target?.remove();
	app = undefined;
	generate.mockClear();
});

function show(profile = PROFILE) {
	profileRef.current = profile;
	target = document.createElement('div');
	document.body.appendChild(target);
	app = mount(Generator, { target, props: { save: vi.fn() } });
	flushSync();
}

const box = () => target.querySelector('input[type="text"]');
const buttonNamed = (name) => [...target.querySelectorAll('button')].find((el) => el.textContent.trim() === name);
const download = () => [...target.querySelectorAll('button')].find((el) => el.textContent.includes('Download'));

function type(text) {
	const input = box();
	input.value = text;
	input.dispatchEvent(new Event('input', { bubbles: true }));
	flushSync();
}

function blur() {
	box().dispatchEvent(new FocusEvent('blur'));
	flushSync();
}

describe('PrecisionCardGenerator maximum distance (#198)', () => {
	it('has the m / yd chips inside the maximum distance box, the zero unit pressed', () => {
		show();
		const field = box().closest('.input');
		const chips = [...field.querySelectorAll('button[aria-pressed]')].map((b) => [b.textContent.trim(), b.getAttribute('aria-pressed')]);
		expect(chips).toEqual([
			['m', 'false'],
			['yd', 'true']
		]);
	});

	it('has no Metric / Imperial presets', () => {
		show();
		expect(buttonNamed('Metric')).toBeUndefined();
		expect(buttonNamed('Imperial')).toBeUndefined();
		expect(target.querySelector('[aria-label="Unit presets"]')).toBeNull();
	});

	it.each([
		['850', '900'],
		['849', '800'],
		['1234,5', '1200'],
		['3040', '3000'],
		['150', '200']
	])('rounds %s to %s when the box loses focus', (typed, shown) => {
		show();
		type(typed);
		blur();
		expect(box().value).toBe(shown);
	});

	it('leaves text that rounds out of the limits as typed, with the error', () => {
		show();
		type('3100');
		blur();
		expect(box().value).toBe('3100');
		expect(box().getAttribute('aria-invalid')).toBe('true');
		expect(download().disabled).toBe(true);
	});

	it('steps by 100 within the limits, then rounds on blur', () => {
		show();
		type('850');
		const plus = target.querySelector('button[aria-label^="Increase the maximum distance by 100"]');
		// A keyboard click (detail 0) makes one step.
		plus.dispatchEvent(new MouseEvent('click', { bubbles: true, detail: 0 }));
		flushSync();
		expect(box().value).toBe('950');
		type('2950');
		plus.dispatchEvent(new MouseEvent('click', { bubbles: true, detail: 0 }));
		plus.dispatchEvent(new MouseEvent('click', { bubbles: true, detail: 0 }));
		flushSync();
		expect(box().value).toBe('3000');
	});

	it('gives the card a whole hundred even before the box loses focus, in the chosen unit', async () => {
		show();
		type('850');
		const m = [...box().closest('.input').querySelectorAll('button[aria-pressed]')].find((b) => b.textContent.trim() === 'm');
		m.click();
		flushSync();
		download().click();
		await vi.waitFor(() => expect(generate).toHaveBeenCalledTimes(1));
		const options = generate.mock.calls[0][1];
		expect(options.maxDistance).toBe(900);
		expect(options.distanceUnit).toBe('m');
		expect(options.units).toEqual({ wind: 'mph', pressure: 'inhg', temperature: 'f' });
	});
});
