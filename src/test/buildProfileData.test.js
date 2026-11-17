/**
 * The stored profile built from a form (#150): buildProfileData, which ProfileForm and the guided
 * setup share, and setupProfileData, what the guided setup stores.
 */
import { describe, it, expect } from 'vitest';
import {
	buildAmmoString,
	buildProfileData,
	isValid,
	normalizedNumbers,
	setupProfileData,
	validateProfile
} from '#lib/utils/profileValidation.js';
import { parseDecimal } from '#lib/utils/decimal.js';
import { calculateShotPoint } from '#lib/utils/ballisticCalculator.js';
import ammoData from '#lib/data/ammo.json';

/** ProfileForm.save() before #150, copied as it was, to show the shared builder stores the same. */
function legacyBuild(form, spinDrift, tempSensitivity) {
	const data = {
		...form,
		...normalizedNumbers(form),
		zeroDist: parseDecimal(form.zeroDist) ?? 0,
		spinDrift,
		tempSensitivity,
		ammo: buildAmmoString(form.bulletBrand, form.bulletWeight, form.bulletWeightUnit),
		optic: form.opticName || '—'
	};
	if (data.clickLink) {
		data.windageClickValue = data.elevationClickValue;
		data.windageClickUnit = data.elevationClickUnit;
	}
	return data;
}

/** The empty form of ProfileForm and GuidedSetup: the same fields and default units. */
const EMPTY_FORM = {
	name: '',
	barrelTwist: '',
	barrelTwistUnit: 'in',
	opticName: '',
	opticHeight: '',
	opticHeightUnit: 'in',
	zeroDist: '',
	zeroUnit: 'yd',
	bulletBrand: '',
	bulletDiameter: '',
	bulletDiameterUnit: 'in',
	bulletWeight: '',
	bulletWeightUnit: 'gr',
	bcType: 'G1',
	bc: '',
	bulletLength: '',
	bulletLengthUnit: 'in',
	velocity: '',
	velocityUnit: 'fps',
	temperature: '',
	temperatureUnit: 'f',
	tempModifier: '',
	reticleType: 'red-dot',
	elevationClickValue: '0.5',
	elevationClickUnit: 'MOA',
	windageClickValue: '0.5',
	windageClickUnit: 'MOA',
	clickLink: true
};

const FORM = {
	...EMPTY_FORM,
	name: 'Remington 700',
	opticName: 'Vortex Razor',
	opticHeight: '1.5',
	zeroDist: '100',
	bulletBrand: 'Sierra MatchKing',
	bulletDiameter: '0.308',
	bulletWeight: '168',
	bc: '0.475',
	velocity: '2650'
};

describe('buildProfileData', () => {
	it.each([
		['a plain form', FORM, false, false],
		['comma decimals', { ...FORM, opticHeight: '1,5', zeroDist: '100,5', bc: '0,475', velocity: ' 2650,0 ' }, false, false],
		['metric units', { ...FORM, opticHeightUnit: 'cm', opticHeight: '4', zeroUnit: 'm', zeroDist: '100', bulletWeightUnit: 'g', bulletWeight: '10,9', velocityUnit: 'mps', velocity: '800' }, false, false],
		['spin drift and temperature on', { ...FORM, barrelTwist: '10', bulletLength: '1,215', temperature: '15', temperatureUnit: 'c', tempModifier: '-1,2' }, true, true],
		['linked clicks with an unlinked windage left over', { ...FORM, elevationClickValue: '0,1', elevationClickUnit: 'MRAD', windageClickValue: '0.25', windageClickUnit: 'MOA' }, false, false],
		['unlinked clicks', { ...FORM, clickLink: false, elevationClickValue: '0.1', elevationClickUnit: 'MRAD', windageClickValue: '0,25', windageClickUnit: 'MOA' }, false, false],
		['a number zero distance', { ...FORM, zeroDist: 25 }, false, false],
		['an empty optic name', { ...FORM, opticName: '' }, false, false],
		['no bullet weight', { ...FORM, bulletWeight: '' }, false, false]
	])('stores what ProfileForm stored before, with %s', (_, form, spinDrift, tempSensitivity) => {
		expect(buildProfileData(form, spinDrift, tempSensitivity)).toEqual(legacyBuild(form, spinDrift, tempSensitivity));
	});

	it('stores numbers with a decimal point, the zero as a number, and the ammo and optic text', () => {
		const data = buildProfileData({ ...FORM, opticHeight: '1,5', zeroDist: '100,5', bc: '0,475' }, false, false);
		expect(data).toMatchObject({
			opticHeight: '1.5',
			zeroDist: 100.5,
			bc: '0.475',
			spinDrift: false,
			tempSensitivity: false,
			ammo: 'Sierra MatchKing 168\u202fgr',
			optic: 'Vortex Razor'
		});
	});

	it('copies the elevation click to the windage when linked, and not otherwise', () => {
		const clicks = { elevationClickValue: '0,1', elevationClickUnit: 'MRAD', windageClickValue: '0.25', windageClickUnit: 'MOA' };
		expect(buildProfileData({ ...FORM, ...clicks }, false, false)).toMatchObject({
			elevationClickValue: '0.1',
			windageClickValue: '0.1',
			windageClickUnit: 'MRAD'
		});
		expect(buildProfileData({ ...FORM, ...clicks, clickLink: false }, false, false)).toMatchObject({
			elevationClickValue: '0.1',
			windageClickValue: '0.25',
			windageClickUnit: 'MOA'
		});
	});

	it('does not change the form', () => {
		const form = { ...FORM, opticHeight: '1,5' };
		const copy = { ...form };
		buildProfileData(form, false, false);
		expect(form).toEqual(copy);
	});
});

describe('setupProfileData (guided setup)', () => {
	const m193 = ammoData.find((item) => item.brand.startsWith('M193'));

	/** Step 2 filled from a library pick, as SetupAmmoStep.choose does. */
	function withPick(form, item) {
		const next = {
			...form,
			bulletBrand: item.brand,
			bulletDiameter: String(item.diameter),
			bulletDiameterUnit: item.diameterUnit.toLowerCase(),
			bulletWeight: String(item.weight),
			bulletWeightUnit: item.weightUnit.toLowerCase(),
			bc: String(item.ballisticCoefficient),
			bcType: item.ballisticCoefficientProfile
		};
		if (item.length) {
			next.bulletLength = String(item.length);
			next.bulletLengthUnit = item.lengthUnit.toLowerCase();
		}
		return next;
	}

	const STEP_1 = { name: 'My AR', opticName: 'Red dot', opticHeight: '2,6', zeroDist: '50', elevationClickValue: '0.5' };
	const STEP_3 = { velocity: '3100' };

	it('validates and builds a form filled from an ammo.json pick and steps 1 and 3', () => {
		const form = withPick({ ...EMPTY_FORM, ...STEP_1, ...STEP_3 }, m193);
		expect(validateProfile(form, false, false)).toEqual({});
		const data = setupProfileData(form);
		expect(data).toEqual(buildProfileData(form, false, false));
		expect(data).toMatchObject({
			name: 'My AR',
			opticName: 'Red dot',
			optic: 'Red dot',
			opticHeight: '2.6',
			zeroDist: 50,
			bulletBrand: m193.brand,
			bulletWeightUnit: 'gr',
			bcType: 'G1',
			velocity: '3100',
			spinDrift: false,
			tempSensitivity: false,
			reticleType: 'red-dot',
			clickLink: true,
			windageClickValue: '0.5',
			windageClickUnit: 'MOA'
		});
		// The stored profile gives a result.
		expect(calculateShotPoint({ ...data, id: 'x' }, { distance: 100, unit: 'yd' }, null, null)).not.toBeNull();
	});

	it('validates and builds a form from every ammo.json entry', () => {
		for (const item of ammoData) {
			const form = withPick({ ...EMPTY_FORM, ...STEP_1, ...STEP_3 }, item);
			expect(setupProfileData(form), item.brand).not.toBeNull();
		}
	});

	it.each([
		['no scope name', { opticName: '  ' }],
		['no rifle name', { name: '' }],
		['a sight height out of range', { opticHeight: '100' }],
		['a zero below its minimum', { zeroDist: '0' }],
		['text for a number', { velocity: 'fast' }],
		['a velocity out of range', { velocity: '20000' }],
		['no bullet', { bulletBrand: '', bulletDiameter: '', bulletWeight: '', bc: '' }],
		['no elevation click', { elevationClickValue: '' }]
	])('stores nothing with %s', (_, change) => {
		const form = { ...withPick({ ...EMPTY_FORM, ...STEP_1, ...STEP_3 }, m193), ...change };
		expect(isValid(validateProfile(form, false, false))).toBe(false);
		expect(setupProfileData(form)).toBeNull();
	});

	it('checks no spin drift or temperature field with both switches off (step 4 skipped)', () => {
		const form = { ...withPick({ ...EMPTY_FORM, ...STEP_1, ...STEP_3 }, m193), barrelTwist: '', temperature: 'x' };
		expect(setupProfileData(form)).not.toBeNull();
		expect(setupProfileData(form, false, false)).toEqual(setupProfileData(form));
	});

	// Step 4 (#177): spin drift and temperature sensitivity, as the profile form stores them.
	const STEP_4_SPIN = { barrelTwist: '7', barrelTwistUnit: 'in' };
	const STEP_4_TEMP = { temperature: '15', temperatureUnit: 'c', tempModifier: '-1,2' };

	it('stores spin drift with the twist and the length of the library pick', () => {
		const form = { ...withPick({ ...EMPTY_FORM, ...STEP_1, ...STEP_3 }, m193), ...STEP_4_SPIN };
		const data = setupProfileData(form, true, false);
		expect(data).toEqual(buildProfileData(form, true, false));
		expect(data).toEqual(legacyBuild(form, true, false));
		expect(data).toMatchObject({
			spinDrift: true,
			tempSensitivity: false,
			barrelTwist: '7',
			barrelTwistUnit: 'in',
			bulletLength: String(m193.length),
			bulletLengthUnit: m193.lengthUnit.toLowerCase()
		});
		expect(calculateShotPoint({ ...data, id: 'x' }, { distance: 300, unit: 'm' }, null, null)).not.toBeNull();
	});

	it('stores temperature sensitivity, a comma read as a decimal point', () => {
		const form = { ...withPick({ ...EMPTY_FORM, ...STEP_1, ...STEP_3 }, m193), ...STEP_4_TEMP };
		const data = setupProfileData(form, false, true);
		expect(data).toEqual(buildProfileData(form, false, true));
		expect(data).toMatchObject({ spinDrift: false, tempSensitivity: true, temperature: '15', temperatureUnit: 'c', tempModifier: '-1.2' });
	});

	it('stores both switches on together', () => {
		const form = { ...withPick({ ...EMPTY_FORM, ...STEP_1, ...STEP_3 }, m193), ...STEP_4_SPIN, ...STEP_4_TEMP };
		expect(setupProfileData(form, true, true)).toEqual(buildProfileData(form, true, true));
		expect(setupProfileData(form, true, true)).toMatchObject({ spinDrift: true, tempSensitivity: true });
	});

	it('keeps the step 4 values as typed when skipped, as the profile form does with its switches off', () => {
		const form = { ...withPick({ ...EMPTY_FORM, ...STEP_1, ...STEP_3 }, m193), ...STEP_4_SPIN, ...STEP_4_TEMP };
		const data = setupProfileData(form, false, false);
		expect(data).toEqual(legacyBuild(form, false, false));
		expect(data).toMatchObject({ spinDrift: false, tempSensitivity: false, barrelTwist: '7', tempModifier: '-1.2' });
	});

	it.each([
		['no twist', { barrelTwist: '' }, true, false],
		['a twist out of range', { barrelTwist: '1000' }, true, false],
		['no bullet length (manual ammunition)', { bulletLength: '' }, true, false],
		['a bullet length that is not a number', { bulletLength: 'long' }, true, false],
		['no temperature', { temperature: '' }, false, true],
		['a modifier that is not a number', { tempModifier: 'abc' }, false, true]
	])('stores nothing with %s and its switch on', (_, change, spinDrift, tempSensitivity) => {
		const form = { ...withPick({ ...EMPTY_FORM, ...STEP_1, ...STEP_3 }, m193), ...STEP_4_SPIN, ...STEP_4_TEMP, ...change };
		expect(setupProfileData(form, spinDrift, tempSensitivity)).toBeNull();
		// Skipped, the same form is stored.
		expect(setupProfileData(form, false, false)).not.toBeNull();
	});

	it('reads only true as a switch that is on', () => {
		const form = { ...withPick({ ...EMPTY_FORM, ...STEP_1, ...STEP_3 }, m193), barrelTwist: '' };
		expect(setupProfileData(form, 'yes', 1)).toMatchObject({ spinDrift: false, tempSensitivity: false });
	});
});
