/**
 * First run (#150): when the splash opens the Welcome screen, and the sample profile it offers.
 */
import { describe, it, expect } from 'vitest';
import { Unit } from 'js-ballistics';
import { isFirstRun, startPath } from '#lib/utils/firstRun.js';
import { SAMPLE_PROFILE } from '#lib/utils/sampleProfile.js';
import { isValid, validateProfile } from '#lib/utils/profileValidation.js';
import { calculateShotPoint } from '#lib/utils/ballisticCalculator.js';
import { normalizeProfiles } from '#lib/utils/storedProfiles.js';

const USABLE = { id: 'p1', name: 'Load' };

describe('isFirstRun', () => {
	it.each([
		['a missing key', undefined],
		['a missing key read as null', null],
		['an empty list', []],
		['a damaged list (an object)', { a: 1 }],
		['a damaged list (text)', 'x'],
		['a damaged list (a number)', 5],
		['a list of entries that are not profiles', [null, 5, 'x', [], {}, { id: {} }, { id: true }]]
	])('is a first run with %s', (_, stored) => {
		expect(isFirstRun(stored)).toBe(true);
		expect(startPath(stored)).toBe('/welcome');
	});

	it.each([
		['one usable profile', [USABLE]],
		['one usable profile among damaged entries', [null, USABLE, 5]],
		['a profile with a number id', [{ id: 7 }]],
		['a profile whose id is renumbered for links', [{ id: 'new' }]],
		['the example profile seeded before #150', [{ ...SAMPLE_PROFILE, id: 'uuid' }]]
	])('is not a first run with %s', (_, stored) => {
		expect(isFirstRun(stored)).toBe(false);
		expect(startPath(stored)).toBe('/scope-view');
	});

	it('gives the same answer on the list as the store reads it', () => {
		for (const stored of [undefined, [], [null], [USABLE]]) {
			expect(isFirstRun(normalizeProfiles(stored))).toBe(isFirstRun(stored));
		}
	});
});

describe('SAMPLE_PROFILE', () => {
	it('is the example profile seeded before #150, values unchanged', () => {
		expect({ ...SAMPLE_PROFILE }).toEqual({
			name: 'Example Colt M4',
			barrelTwist: '',
			barrelTwistUnit: 'in',
			opticName: 'Aimpoint CompM2',
			opticHeight: '3.5',
			opticHeightUnit: 'in',
			zeroDist: 25,
			zeroUnit: 'yd',
			bulletBrand: 'M193',
			bulletDiameter: '0.223',
			bulletDiameterUnit: 'in',
			bulletWeight: '55',
			bulletWeightUnit: 'gr',
			bcType: 'G1',
			bc: '0.285',
			bulletLength: '',
			bulletLengthUnit: 'in',
			velocity: '3000',
			velocityUnit: 'fps',
			temperature: '59',
			temperatureUnit: 'f',
			tempModifier: '',
			spinDrift: false,
			tempSensitivity: false,
			reticleType: 'red-dot',
			elevationClickValue: '0.5',
			elevationClickUnit: 'MOA',
			windageClickValue: '0.5',
			windageClickUnit: 'MOA',
			clickLink: true,
			ammo: 'M193 55\u202fgr',
			optic: 'Aimpoint CompM2'
		});
	});

	it('has no id (profiles.add gives a fresh one) and cannot be changed in place', () => {
		expect('id' in SAMPLE_PROFILE).toBe(false);
		expect(Object.isFrozen(SAMPLE_PROFILE)).toBe(true);
	});

	it('passes the profile form validation', () => {
		expect(validateProfile(SAMPLE_PROFILE, false, false)).toEqual({});
		expect(isValid(validateProfile(SAMPLE_PROFILE, SAMPLE_PROFILE.spinDrift, SAMPLE_PROFILE.tempSensitivity))).toBe(true);
	});

	it('is usable: it ends a first run and gives a result at 100 yd', () => {
		expect(isFirstRun([{ ...SAMPLE_PROFILE, id: 'x' }])).toBe(false);
		const point = calculateShotPoint({ ...SAMPLE_PROFILE, id: 'x' }, { distance: 100, unit: 'yd' }, null, null);
		expect(point).not.toBeNull();
		expect(point.distance.In(Unit.Yard)).toBeCloseTo(100, 3);
		expect(Number.isFinite(point.height.In(Unit.Inch))).toBe(true);
		expect(Number.isFinite(point.velocity.In(Unit.FPS))).toBe(true);
	});
});
