import { describe, it, expect } from 'vitest';
import {
	validateProfile,
	isValid,
	buildAmmoString
} from '$lib/utils/profileValidation.js';

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
	tempModifier: ''
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
