import { describe, it, expect } from 'vitest';
import {
	validateProfile,
	isValid,
	buildAmmoString,
	profileFieldLimits,
	normalizedNumbers
} from '#lib/utils/profileValidation.js';

// A fully valid form (all visible fields populated, no toggles)
const validForm = {
	name: 'Remington 700',
	opticName: 'Vortex Razor',
	opticHeight: '1.5',
	zeroDist: '100',
	bulletBrand: 'Sierra',
	bulletDiameter: '0.308',
	bulletWeight: '168',
	bc: '0.475',
	velocity: '2650',
	bulletWeightUnit: 'gr',
	// spin drift fields (not required when spinDrift=false)
	barrelTwist: '',
	bulletLength: '',
	// temp fields (not required when tempSensitivity=false)
	temperature: '',
	tempModifier: '',
	// click adjustment fields
	elevationClickValue: '0.5',
	elevationClickUnit: 'MOA',
	windageClickValue: '0.5',
	windageClickUnit: 'MOA',
	clickLink: true,
	reticleType: 'red-dot'
};

// ── validateProfile ────────────────────────────────────────────────────────

describe('validateProfile — valid form', () => {
	it('returns no errors for a fully valid form', () => {
		const errors = validateProfile(validForm, false, false);
		expect(isValid(errors)).toBe(true);
	});

	it('ignores spin drift fields when spinDrift is false', () => {
		const errors = validateProfile({ ...validForm, barrelTwist: '', bulletLength: '' }, false, false);
		expect(errors.barrelTwist).toBeUndefined();
		expect(errors.bulletLength).toBeUndefined();
	});

	it('ignores temp fields when tempSensitivity is false', () => {
		const errors = validateProfile({ ...validForm, temperature: '', tempModifier: '' }, false, false);
		expect(errors.temperature).toBeUndefined();
		expect(errors.tempModifier).toBeUndefined();
	});
});

describe('validateProfile — required text fields', () => {
	it('flags empty name', () => {
		const e = validateProfile({ ...validForm, name: '' }, false, false);
		expect(e.name).toBe('required');
	});

	it('flags whitespace-only name', () => {
		const e = validateProfile({ ...validForm, name: '   ' }, false, false);
		expect(e.name).toBe('required');
	});

	it('flags empty opticName', () => {
		const e = validateProfile({ ...validForm, opticName: '' }, false, false);
		expect(e.opticName).toBe('required');
	});

	it('flags empty bulletBrand', () => {
		const e = validateProfile({ ...validForm, bulletBrand: '' }, false, false);
		expect(e.bulletBrand).toBe('required');
	});
});

describe('validateProfile — required numeric fields', () => {
	const numericCases = [
		['opticHeight', '0'],
		['zeroDist', '0'],
		['bulletDiameter', '0'],
		['bulletWeight', '0'],
		['bc', '0'],
		['velocity', '0']
	];

	for (const [field, zeroVal] of numericCases) {
		it(`flags empty ${field} as required`, () => {
			const e = validateProfile({ ...validForm, [field]: '' }, false, false);
			expect(e[field]).toBe('required');
		});

		it(`flags zero ${field} as invalid_number`, () => {
			const e = validateProfile({ ...validForm, [field]: zeroVal }, false, false);
			expect(e[field]).toBe('invalid_number');
		});

		it(`flags negative ${field} as invalid_number`, () => {
			const e = validateProfile({ ...validForm, [field]: '-1' }, false, false);
			expect(e[field]).toBe('invalid_number');
		});

		it(`flags non-numeric ${field} as invalid_number`, () => {
			const e = validateProfile({ ...validForm, [field]: 'abc' }, false, false);
			expect(e[field]).toBe('invalid_number');
		});
	}
});

describe('validateProfile — spin drift fields', () => {
	const spinForm = { ...validForm, barrelTwist: '10', bulletLength: '1.225' };

	it('passes when spin drift fields are valid', () => {
		const e = validateProfile(spinForm, true, false);
		expect(e.barrelTwist).toBeUndefined();
		expect(e.bulletLength).toBeUndefined();
	});

	it('flags empty barrelTwist when spinDrift is on', () => {
		const e = validateProfile({ ...spinForm, barrelTwist: '' }, true, false);
		expect(e.barrelTwist).toBe('required');
	});

	it('flags non-positive barrelTwist', () => {
		const e = validateProfile({ ...spinForm, barrelTwist: '0' }, true, false);
		expect(e.barrelTwist).toBe('invalid_number');
	});

	it('flags empty bulletLength when spinDrift is on', () => {
		const e = validateProfile({ ...spinForm, bulletLength: '' }, true, false);
		expect(e.bulletLength).toBe('required');
	});

	it('flags non-positive bulletLength', () => {
		const e = validateProfile({ ...spinForm, bulletLength: '-0.5' }, true, false);
		expect(e.bulletLength).toBe('invalid_number');
	});
});

describe('validateProfile — temperature sensitivity fields', () => {
	const tempForm = { ...validForm, temperature: '-5', tempModifier: '1.5' };

	it('passes when temp fields are valid', () => {
		const e = validateProfile(tempForm, false, true);
		expect(e.temperature).toBeUndefined();
		expect(e.tempModifier).toBeUndefined();
	});

	it('accepts negative temperature (e.g. -20°C)', () => {
		const e = validateProfile({ ...tempForm, temperature: '-20' }, false, true);
		expect(e.temperature).toBeUndefined();
	});

	it('accepts zero temperature', () => {
		const e = validateProfile({ ...tempForm, temperature: '0' }, false, true);
		expect(e.temperature).toBeUndefined();
	});

	it('flags empty temperature when tempSensitivity is on', () => {
		const e = validateProfile({ ...tempForm, temperature: '' }, false, true);
		expect(e.temperature).toBe('required');
	});

	it('flags non-numeric temperature', () => {
		const e = validateProfile({ ...tempForm, temperature: 'warm' }, false, true);
		expect(e.temperature).toBe('invalid_number');
	});

	it('flags empty tempModifier', () => {
		const e = validateProfile({ ...tempForm, tempModifier: '' }, false, true);
		expect(e.tempModifier).toBe('required');
	});

	it('flags non-numeric tempModifier', () => {
		const e = validateProfile({ ...tempForm, tempModifier: 'fast' }, false, true);
		expect(e.tempModifier).toBe('invalid_number');
	});
});

describe('validateProfile — click adjustment fields', () => {
	it('passes with valid elevation click value when linked', () => {
		const e = validateProfile(validForm, false, false);
		expect(e.elevationClickValue).toBeUndefined();
	});

	it('flags empty elevation click value as required', () => {
		const e = validateProfile({ ...validForm, elevationClickValue: '' }, false, false);
		expect(e.elevationClickValue).toBe('required');
	});

	it('flags zero elevation click value as invalid_number', () => {
		const e = validateProfile({ ...validForm, elevationClickValue: '0' }, false, false);
		expect(e.elevationClickValue).toBe('invalid_number');
	});

	it('flags negative elevation click value as invalid_number', () => {
		const e = validateProfile({ ...validForm, elevationClickValue: '-1' }, false, false);
		expect(e.elevationClickValue).toBe('invalid_number');
	});

	it('skips windage validation when linked', () => {
		const e = validateProfile({ ...validForm, clickLink: true, windageClickValue: '' }, false, false);
		expect(e.windageClickValue).toBeUndefined();
	});

	it('validates windage click value when unlinked', () => {
		const e = validateProfile({ ...validForm, clickLink: false, windageClickValue: '' }, false, false);
		expect(e.windageClickValue).toBe('required');
	});

	it('flags non-positive windage click value when unlinked', () => {
		const e = validateProfile({ ...validForm, clickLink: false, windageClickValue: '0' }, false, false);
		expect(e.windageClickValue).toBe('invalid_number');
	});

	it('passes windage validation when unlinked and valid', () => {
		const e = validateProfile({ ...validForm, clickLink: false, windageClickValue: '0.25' }, false, false);
		expect(e.windageClickValue).toBeUndefined();
	});
});

// ── Plain finite decimals only (#89) and the decimal comma (#117) ─────────

describe('validateProfile — numbers that are not plain decimals (#89)', () => {
	const POSITIVE_FIELDS = [
		'opticHeight',
		'zeroDist',
		'bulletDiameter',
		'bulletWeight',
		'bc',
		'velocity',
		'elevationClickValue'
	];
	const NOT_PLAIN = [
		['Infinity', 'Infinity'],
		['an overflow', '1e999'],
		['hex', '0x10'],
		['binary', '0b1'],
		['trailing text', '100abc'],
		['two separators', '1,500,000']
	];

	for (const field of POSITIVE_FIELDS) {
		it.each(NOT_PLAIN)(`flags %s in ${field} as invalid_number`, (_, value) => {
			const e = validateProfile({ ...validForm, [field]: value }, false, false);
			expect(e[field]).toBe('invalid_number');
		});
	}

	it.each(NOT_PLAIN)('flags %s in the unlinked windage click value', (_, value) => {
		const e = validateProfile({ ...validForm, clickLink: false, windageClickValue: value }, false, false);
		expect(e.windageClickValue).toBe('invalid_number');
	});

	it.each(NOT_PLAIN)('flags %s in the spin drift fields', (_, value) => {
		const e = validateProfile({ ...validForm, barrelTwist: value, bulletLength: value }, true, false);
		expect(e.barrelTwist).toBe('invalid_number');
		expect(e.bulletLength).toBe('invalid_number');
	});

	it.each([...NOT_PLAIN, ['-Infinity', '-Infinity']])(
		'flags %s in the temperature sensitivity fields',
		(_, value) => {
			const e = validateProfile({ ...validForm, temperature: value, tempModifier: value }, false, true);
			expect(e.temperature).toBe('invalid_number');
			expect(e.tempModifier).toBe('invalid_number');
		}
	);

	// Security review of this change: String(['1', '2']) is '1,2', which would pass as 1.2 while the
	// calculators read 1.
	it.each([
		['an array of two numbers', ['1', '2']],
		['an array holding a number', [2650]],
		['an object', {}],
		['an object that cannot become text', { toString: 1 }],
		['true', true],
		['false', false]
	])('flags a stored %s as invalid_number', (_, value) => {
		for (const field of POSITIVE_FIELDS) {
			expect(validateProfile({ ...validForm, [field]: value }, false, false)[field]).toBe('invalid_number');
		}
		const e = validateProfile({ ...validForm, temperature: value, tempModifier: value }, false, true);
		expect(e.temperature).toBe('invalid_number');
		expect(e.tempModifier).toBe('invalid_number');
	});

	it.each([[NaN], [Infinity], [-Infinity]])('flags a stored number %s as invalid_number', (value) => {
		expect(validateProfile({ ...validForm, velocity: value }, false, false).velocity).toBe('invalid_number');
	});

	it('reads a stored number in a field without throwing', () => {
		const e = validateProfile({ ...validForm, elevationClickValue: 0.25, zeroDist: 100 }, false, false);
		expect(isValid(e)).toBe(true);
	});
});

describe('validateProfile — decimal comma (#117)', () => {
	it('accepts a comma in every numeric field', () => {
		const form = {
			...validForm,
			opticHeight: '1,5',
			zeroDist: '100,5',
			bulletDiameter: '0,308',
			bulletWeight: '168,5',
			bc: '0,475',
			velocity: '2650,5',
			elevationClickValue: '0,25',
			clickLink: false,
			windageClickValue: '0,1',
			barrelTwist: '10,5',
			bulletLength: '1,225',
			temperature: '-5,5',
			tempModifier: '1,5'
		};
		expect(validateProfile(form, true, true)).toEqual({});
	});

	it('stores a comma as a decimal point', () => {
		expect(
			normalizedNumbers({ ...validForm, opticHeight: ' 1,5 ', bc: '0,475', velocity: '2650', temperature: '-5,5' })
		).toMatchObject({ opticHeight: '1.5', bc: '0.475', velocity: '2650', temperature: '-5.5' });
	});

	it('leaves text fields and unit fields alone', () => {
		const result = normalizedNumbers({ ...validForm, name: 'Rifle, 1,5', opticHeightUnit: 'in' });
		expect(result).not.toHaveProperty('name');
		expect(result).not.toHaveProperty('opticHeightUnit');
	});
});

// ── Limits shared with the calculators (#90, #92, #93, #114, #119) ─────────

describe('validateProfile — limits', () => {
	const errorFor = (change, key) => validateProfile({ ...validForm, ...change }, false, false)[key];

	it.each([
		['10 in', { opticHeight: '10' }],
		['25.4 cm', { opticHeight: '25.4', opticHeightUnit: 'cm' }],
		['25,4 cm', { opticHeight: '25,4', opticHeightUnit: 'cm' }]
	])('accepts a sight height of %s', (_, change) => {
		expect(errorFor(change, 'opticHeight')).toBeUndefined();
	});

	it.each([
		['10.01 in', { opticHeight: '10.01' }],
		['25.41 cm', { opticHeight: '25.41', opticHeightUnit: 'cm' }],
		['11 in', { opticHeight: '11', opticHeightUnit: 'in' }]
	])('rejects a sight height of %s', (_, change) => {
		expect(errorFor(change, 'opticHeight')).toBe('out_of_range');
	});

	it.each([['1'], ['3000'], ['1,5'], ['100']])('accepts a zero distance of %s', (zeroDist) => {
		expect(errorFor({ zeroDist }, 'zeroDist')).toBeUndefined();
		expect(errorFor({ zeroDist, zeroUnit: 'm' }, 'zeroDist')).toBeUndefined();
	});

	it.each([['0.99'], ['0.2'], ['0.001'], ['3000.01'], ['3500']])('rejects a zero distance of %s', (zeroDist) => {
		expect(errorFor({ zeroDist }, 'zeroDist')).toBe('out_of_range');
		expect(errorFor({ zeroDist, zeroUnit: 'm' }, 'zeroDist')).toBe('out_of_range');
	});

	it.each([['0.01'], ['0,01'], ['2.5']])('accepts a BC of %s', (bc) => {
		expect(errorFor({ bc }, 'bc')).toBeUndefined();
	});

	it.each([['0.0099'], ['0.001'], ['1e-9']])('rejects a BC of %s', (bc) => {
		expect(errorFor({ bc }, 'bc')).toBe('out_of_range');
	});

	it.each([
		['50 fps', '50', 'fps'],
		['9999.99 fps', '9999.99', 'fps'],
		['15.24 m/s', '15.24', 'mps'],
		['3047.99 m/s', '3047.99', 'mps']
	])('accepts a velocity of %s', (_, velocity, velocityUnit) => {
		expect(errorFor({ velocity, velocityUnit }, 'velocity')).toBeUndefined();
	});

	it.each([
		['49.99 fps', '49.99', 'fps'],
		['10000 fps', '10000', 'fps'],
		['1e15 fps', '1e15', 'fps'],
		['15.23 m/s', '15.23', 'mps'],
		['3048 m/s', '3048', 'mps']
	])('rejects a velocity of %s', (_, velocity, velocityUnit) => {
		expect(errorFor({ velocity, velocityUnit }, 'velocity')).toBe('out_of_range');
	});

	it('keeps invalid_number for a value that is not positive', () => {
		expect(errorFor({ zeroDist: '0' }, 'zeroDist')).toBe('invalid_number');
		expect(errorFor({ opticHeight: '-1' }, 'opticHeight')).toBe('invalid_number');
	});
});

describe('profileFieldLimits', () => {
	it.each([
		['opticHeight', { opticHeightUnit: 'in' }, { kind: 'above_zero_max', max: 10, unit: 'in' }],
		['opticHeight', { opticHeightUnit: 'cm' }, { kind: 'above_zero_max', max: 25.4, unit: 'cm' }],
		['zeroDist', { zeroUnit: 'yd' }, { kind: 'range', min: 1, max: 3000, unit: 'yd' }],
		['zeroDist', { zeroUnit: 'm' }, { kind: 'range', min: 1, max: 3000, unit: 'm' }],
		['bc', {}, { kind: 'min', min: 0.01 }],
		['velocity', { velocityUnit: 'fps' }, { kind: 'min_below_max', min: 50, max: 10000, unit: 'fps' }],
		['velocity', { velocityUnit: 'mps' }, { kind: 'min_below_max', min: 15.24, max: 3048, unit: 'mps' }]
	])('states the limits of %s with %j', (key, units, expected) => {
		expect(profileFieldLimits(key, { ...validForm, ...units })).toEqual(expected);
	});

	it('has none for a field that only has to be positive', () => {
		expect(profileFieldLimits('bulletWeight', validForm)).toBeNull();
	});
});

// ── isValid ────────────────────────────────────────────────────────────────

describe('isValid', () => {
	it('returns true for empty errors object', () => {
		expect(isValid({})).toBe(true);
	});

	it('returns false when any error exists', () => {
		expect(isValid({ name: 'required' })).toBe(false);
	});
});

// ── buildAmmoString ────────────────────────────────────────────────────────

describe('buildAmmoString', () => {
	it('combines brand and weight with narrow no-break space', () => {
		const result = buildAmmoString('Sierra', '168', 'gr');
		expect(result).toBe('Sierra 168\u202fgr');
	});

	it('returns just the brand when weight is empty', () => {
		expect(buildAmmoString('Sierra', '', 'gr')).toBe('Sierra');
	});

	it('returns just the weight when brand is empty', () => {
		expect(buildAmmoString('', '168', 'gr')).toBe('168\u202fgr');
	});

	it('returns fallback dash when both are empty', () => {
		expect(buildAmmoString('', '', 'gr')).toBe('—');
	});

	it('trims whitespace from brand and weight', () => {
		expect(buildAmmoString('  M193  ', '  55  ', 'gr')).toBe('M193 55\u202fgr');
	});

	it('uses the weight unit as-is', () => {
		expect(buildAmmoString('Match', '9.7', 'g')).toBe('Match 9.7\u202fg');
	});
});
