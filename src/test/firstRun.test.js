/**
 * First run (#150): when the splash opens the Welcome screen, and the sample profile it offers.
 */
import { describe, it, expect } from 'vitest';
import { Unit } from 'js-ballistics';
import { isFirstRun, startPath } from '#lib/utils/firstRun.js';
import { SAMPLE_PROFILE, SAMPLE_PROFILES, SAMPLE_R700 } from '#lib/utils/sampleProfile.js';
import ammoData from '#lib/data/ammo.json';
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
			barrelTwist: '7',
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
			bulletLength: '0.745',
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

	it('matches the M193 in the ammo library and an M4 1:7 barrel (#175)', () => {
		const m193 = ammoData.find((item) => item.brand.startsWith('M193'));
		expect(m193).toMatchObject({ weight: 55, length: 18.92, lengthUnit: 'MM' });
		expect(Number(SAMPLE_PROFILE.bulletLength)).toBeCloseTo(m193.length / 25.4, 3);
		expect(SAMPLE_PROFILE.barrelTwist).toBe('7');
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

describe('SAMPLE_R700 and SAMPLE_PROFILES (#175)', () => {
	it('lists the M4 first (the active one), then the Remington 700, both frozen', () => {
		expect(SAMPLE_PROFILES).toEqual([SAMPLE_PROFILE, SAMPLE_R700]);
		expect(Object.isFrozen(SAMPLE_PROFILES)).toBe(true);
		expect(Object.isFrozen(SAMPLE_R700)).toBe(true);
		expect('id' in SAMPLE_R700).toBe(false);
		expect(SAMPLE_R700.name).toBe('Example Remington 700');
	});

	it('uses the 308 Winchester of the ammo library', () => {
		const lib = ammoData.find((item) => item.brand === SAMPLE_R700.bulletBrand);
		expect(lib).toBeDefined();
		expect(Number(SAMPLE_R700.bulletWeight)).toBe(lib.weight);
		expect(Number(SAMPLE_R700.bc)).toBe(lib.ballisticCoefficient);
		expect(SAMPLE_R700.bcType).toBe(lib.ballisticCoefficientProfile);
		expect(Number(SAMPLE_R700.bulletLength)).toBeCloseTo(lib.length / 25.4, 2);
	});

	it.each(SAMPLE_PROFILES.map((p) => [p.name, p]))('%s passes the validation, also with spin drift on', (_, profile) => {
		expect(validateProfile(profile, false, false)).toEqual({});
		expect(validateProfile(profile, true, false)).toEqual({});
	});

	it('gives a result at 600 yd, below the 100 yd zero', () => {
		const point = calculateShotPoint({ ...SAMPLE_R700, id: 'r' }, { distance: 600, unit: 'yd' }, null, null);
		expect(point).not.toBeNull();
		expect(point.distance.In(Unit.Yard)).toBeCloseTo(600, 3);
		expect(point.height.In(Unit.Inch)).toBeLessThan(0);
		expect(point.velocity.In(Unit.FPS)).toBeGreaterThan(1125);
	});
});
