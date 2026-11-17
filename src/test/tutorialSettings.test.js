/**
 * Settings of the 3D tutorial (#182): stored values, the phone and Capacitor quality default, the
 * range card's steps and limits (fieldStep.js, inputLimits.js), and the WebGL check.
 */
import { describe, it, expect, vi } from 'vitest';
import {
	PHONE_MAX_WIDTH,
	defaultQuality,
	isCapacitorApp,
	isPhone,
	storedQuality,
	storedSceneWeather,
	storedTerrain,
	storedTutorialRange
} from '#lib/utils/storedTutorial.js';
import { fieldStepSpec, stepValue } from '#lib/utils/fieldStep.js';
import { MAX_DISTANCE, TARGET_ELEVATION_LIMITS, targetElevationLimits } from '#lib/utils/inputLimits.js';
import { hasWebGL } from '#lib/utils/webgl.js';
import { MOBILE_BUILD, TUTORIAL_PATH, isTutorialAvailable, withoutUnavailableTutorial } from '#lib/utils/tutorialAvailability.js';

const throwsAsText = JSON.parse('{"toString":1}');

describe('stored tutorial values', () => {
	it('reads a range and a terrain, with units as the calculators read them', () => {
		expect(storedTutorialRange({ distance: '300', unit: 'm' })).toEqual({ distance: '300', unit: 'm' });
		expect(storedTutorialRange({ distance: 250, unit: 'M' })).toEqual({ distance: 250, unit: 'yd' });
		expect(storedTerrain({ altitude: '1200', elevation: '-40', unit: 'm' })).toEqual({ altitude: '1200', elevation: '-40', unit: 'm' });
		expect(storedTerrain({ altitude: 1, elevation: 2, unit: 'feet' })).toEqual({ altitude: 1, elevation: 2, unit: 'ft' });
	});

	it.each([[null], ['x'], [[]], [{ distance: throwsAsText, altitude: [], elevation: {} }]])('reads %j as empty boxes', (stored) => {
		expect(storedTutorialRange(stored)).toEqual({ distance: '', unit: 'yd' });
		expect(storedTerrain(stored)).toEqual({ altitude: '', elevation: '', unit: 'ft' });
	});

	it('reads weather and quality from their lists only', () => {
		for (const w of ['sunny', 'cloudy', 'rain', 'snow']) expect(storedSceneWeather(w)).toBe(w);
		for (const w of ['fog', null, 1, throwsAsText]) expect(storedSceneWeather(w)).toBe('sunny');
		for (const q of ['low', 'medium', 'high']) expect(storedQuality(q, 'low')).toBe(q);
		for (const q of ['ultra', null, 1, ['low']]) expect(storedQuality(q, 'low')).toBe('low');
	});
});

describe('quality default and Capacitor (owner decisions of 2026-11-17)', () => {
	const env = (coarse, width, capacitor) => ({
		matchMedia: (q) => ({ matches: q === '(pointer: coarse)' && coarse }),
		innerWidth: width,
		...(capacitor ? { Capacitor: { getPlatform: () => capacitor } } : {})
	});

	it('takes a coarse pointer narrower than 768 px for a phone', () => {
		expect(isPhone(env(true, 390))).toBe(true);
		expect(isPhone(env(true, PHONE_MAX_WIDTH - 1))).toBe(true);
		expect(isPhone(env(true, PHONE_MAX_WIDTH))).toBe(false); // tablet
		expect(isPhone(env(false, 390))).toBe(false); // narrow desktop window
		expect(isPhone({})).toBe(false);
		expect(isPhone({ matchMedia: () => { throw new Error('no'); }, innerWidth: 300 })).toBe(false);
	});

	it('knows the Capacitor apps by their bridge', () => {
		expect(isCapacitorApp(env(false, 1200, 'android'))).toBe(true);
		expect(isCapacitorApp(env(false, 1200, 'ios'))).toBe(true);
		expect(isCapacitorApp(env(false, 1200, 'web'))).toBe(false);
		expect(isCapacitorApp({ Capacitor: { getPlatform: () => { throw new Error('broken'); } } })).toBe(false);
	});

	it('is Low on phones, Medium elsewhere (the Capacitor apps have no tutorial)', () => {
		expect(defaultQuality(env(true, 390))).toBe('low');
		expect(defaultQuality(env(true, 1024))).toBe('medium');
		expect(defaultQuality(env(false, 1400))).toBe('medium');
	});
});

describe('range card steps and limits', () => {
	it('steps the distance by 25 from 1 to MAX_DISTANCE, from 300 when empty', () => {
		const spec = fieldStepSpec('targetDistance');
		expect(spec).toEqual({ step: 25, min: 1, max: MAX_DISTANCE, start: 300 });
		expect(stepValue('', 25, spec)).toBe('325');
		expect(stepValue('10', -25, spec)).toBe('1');
		expect(stepValue('2990', 25, spec)).toBe('3000');
	});

	it('steps the elevation by 1 m or 5 ft within ±500 m (±1640 ft), from 0 when empty', () => {
		expect(TARGET_ELEVATION_LIMITS).toEqual({ m: { min: -500, max: 500 }, ft: { min: -1640, max: 1640 } });
		expect(targetElevationLimits('m')).toBe(TARGET_ELEVATION_LIMITS.m);
		expect(targetElevationLimits('anything')).toBe(TARGET_ELEVATION_LIMITS.ft);
		const metres = fieldStepSpec('targetElevation', 'm');
		const feet = fieldStepSpec('targetElevation', 'ft');
		expect(metres).toEqual({ step: 1, min: -500, max: 500, start: 0 });
		expect(feet).toEqual({ step: 5, min: -1640, max: 1640, start: 0 });
		expect(stepValue('', -1, metres)).toBe('-1');
		expect(stepValue('500', 1, metres)).toBe('500');
		expect(stepValue('1638', 5, feet)).toBe('1640');
		// 1640 ft stays within 500 m.
		expect(1640 * 0.3048).toBeLessThan(500);
	});
});

describe('hasWebGL', () => {
	it('is true with a WebGL 2 context, and releases it at once', () => {
		const loseContext = vi.fn();
		const getContext = vi.fn((kind) => (kind === 'webgl2' ? { getExtension: () => ({ loseContext }) } : null));
		expect(hasWebGL({ createElement: () => ({ getContext }) })).toBe(true);
		expect(loseContext).toHaveBeenCalledOnce();
	});

	it('is false with WebGL 1 only (three.js 0.187 needs WebGL 2), or no context, or a throw', () => {
		expect(hasWebGL({ createElement: () => ({ getContext: (k) => (k === 'webgl' ? {} : null) }) })).toBe(false);
		expect(hasWebGL({ createElement: () => ({ getContext: () => null }) })).toBe(false);
		expect(hasWebGL({ createElement: () => ({}) })).toBe(false);
		expect(hasWebGL({ createElement: () => { throw new Error('no canvas'); } })).toBe(false);
		expect(hasWebGL(/** @type {any} */ (undefined))).toBe(false);
	});

	it('is false in jsdom, which has no WebGL', () => {
		expect(hasWebGL(document)).toBe(false);
	});
});

describe('tutorial availability (owner decision of 2026-11-17: not in the Capacitor apps)', () => {
	const bridge = (platform) => ({ Capacitor: { getPlatform: () => platform } });

	it('is offered on the web and in Electron, not in the mobile build or a Capacitor web view', () => {
		expect(MOBILE_BUILD).toBe(false); // the tests run the web config
		expect(isTutorialAvailable(false, {})).toBe(true);
		expect(isTutorialAvailable(false, { location: { protocol: 'app:' } })).toBe(true);
		expect(isTutorialAvailable(false, bridge('web'))).toBe(true);
		expect(isTutorialAvailable(true, {})).toBe(false);
		expect(isTutorialAvailable(false, bridge('android'))).toBe(false);
		expect(isTutorialAvailable(false, bridge('ios'))).toBe(false);
		expect(isTutorialAvailable()).toBe(true); // jsdom
	});

	it('drops only the tutorial entry from a navigation list where it is not offered', () => {
		const items = [{ href: '/calculators/mpbr' }, { href: TUTORIAL_PATH }];
		expect(withoutUnavailableTutorial(items, true)).toEqual(items);
		expect(withoutUnavailableTutorial(items, false)).toEqual([{ href: '/calculators/mpbr' }]);
	});
});
