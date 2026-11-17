/**
 * Pure validation and data-building helpers for profile forms.
 * No Svelte or i18n dependencies — fully testable in Node/jsdom.
 */
import { normalizeDecimal, parseDecimal } from './decimal.js';
import {
	MAX_DISTANCE,
	MAX_BC,
	MAX_VELOCITY_FPS,
	MIN_BC,
	MIN_VELOCITY_FPS,
	barrelTwistLimits,
	bulletDiameterLimits,
	bulletLengthLimits,
	bulletWeightLimits,
	maxSightHeight,
	velocityInFps
} from './inputLimits.js';
import { MIN_ZERO_DISTANCE } from './zeroDistance.js';

/** Marks a value of a shape no field can hold. It is not empty and never reads as a number. */
const NOT_A_NUMBER = '\u0000';

/**
 * A form value as text. A stored profile can hold a number, and null means empty. Any other shape
 * (an array, object or boolean from tampered storage) is invalid: String(['1', '2']) would read
 * as 1,2 = 1.2 here while the calculators read 1.
 */
const text = (value) => {
	if (value === null || value === undefined) return '';
	if (typeof value === 'string') return value;
	if (typeof value === 'number') return String(value);
	return NOT_A_NUMBER;
};

/**
 * Returns true when the value is a plain finite decimal number greater than zero. A comma reads as
 * a decimal point. Infinity, hex and overflowing exponents are not numbers (#89).
 */
function isPositiveNumber(value) {
	return parseDecimal(text(value)) > 0;
}

/** Returns true when the value is a plain finite decimal number (including 0 and negatives). */
function isAnyNumber(value) {
	return parseDecimal(text(value)) !== null;
}

/**
 * Velocity limits as shown in the form, in its unit. Checked against MIN_VELOCITY_FPS and
 * MAX_VELOCITY_FPS through velocityInFps, as the calculators convert: 15.24 m/s is just over
 * 50 fps, and 3048 m/s is just over 10000 fps, so it is out like 10000 fps.
 */
const VELOCITY_SHOWN = {
	fps: { min: MIN_VELOCITY_FPS, max: MAX_VELOCITY_FPS },
	mps: { min: 15.24, max: 3048 }
};

/**
 * The limits of a numeric profile field with one, for its error message, in the unit chosen in the
 * form. Null for a field without limits beyond being positive. A BC has no unit, so it has none.
 *
 * | kind            | Allowed              | Fields                                         |
 * |-----------------|----------------------|------------------------------------------------|
 * | 'above_zero_max'| over 0, up to max    | opticHeight                                    |
 * | 'range'         | min to max           | zeroDist, bulletWeight, bulletDiameter,        |
 * |                 |                      | barrelTwist, bulletLength (#125), bc (#147)    |
 * | 'min_below_max' | min to under max     | velocity                                       |
 *
 * @param {string} key
 * @param {object} form
 * @returns {{ kind: string, min?: number, max?: number, unit?: string } | null}
 */
export function profileFieldLimits(key, form) {
	switch (key) {
		case 'opticHeight': {
			const unit = form.opticHeightUnit === 'cm' ? 'cm' : 'in';
			return { kind: 'above_zero_max', max: maxSightHeight(unit), unit };
		}
		case 'zeroDist':
			return {
				kind: 'range',
				min: MIN_ZERO_DISTANCE,
				max: MAX_DISTANCE,
				unit: form.zeroUnit === 'm' ? 'm' : 'yd'
			};
		case 'bc':
			return { kind: 'range', min: MIN_BC, max: MAX_BC };
		case 'velocity': {
			const unit = form.velocityUnit === 'mps' ? 'mps' : 'fps';
			return { kind: 'min_below_max', ...VELOCITY_SHOWN[unit], unit };
		}
		case 'bulletWeight': {
			const unit = form.bulletWeightUnit === 'g' ? 'g' : 'gr';
			return { kind: 'range', ...bulletWeightLimits(unit), unit };
		}
		case 'bulletDiameter': {
			const unit = form.bulletDiameterUnit === 'mm' ? 'mm' : 'in';
			return { kind: 'range', ...bulletDiameterLimits(unit), unit };
		}
		case 'barrelTwist': {
			const unit = form.barrelTwistUnit === 'mm' ? 'mm' : 'in';
			return { kind: 'range', ...barrelTwistLimits(unit), unit };
		}
		case 'bulletLength': {
			const unit = form.bulletLengthUnit === 'mm' ? 'mm' : 'in';
			return { kind: 'range', ...bulletLengthLimits(unit), unit };
		}
		default:
			return null;
	}
}

/**
 * Whether a positive number lies within the limits of its field. The same checks as the
 * calculators (inputLimits.js, zeroDistance.js), so that a saved profile gives a result.
 */
function isWithinLimits(key, value, form) {
	switch (key) {
		case 'opticHeight':
			return value <= maxSightHeight(form.opticHeightUnit);
		case 'zeroDist':
			return value >= MIN_ZERO_DISTANCE && value <= MAX_DISTANCE;
		case 'bc':
			return value >= MIN_BC && value <= MAX_BC;
		case 'velocity': {
			const fps = velocityInFps(value, form.velocityUnit);
			return fps >= MIN_VELOCITY_FPS && fps < MAX_VELOCITY_FPS;
		}
		case 'bulletWeight':
		case 'bulletDiameter':
		case 'barrelTwist':
		case 'bulletLength': {
			const { min, max } = profileFieldLimits(key, form);
			return value >= min && value <= max;
		}
		default:
			return true;
	}
}

/**
 * Validates a profile form object.
 *
 * Returns a map of field name → error code for each invalid field.
 * An empty object means the form is valid.
 *
 * Error codes:
 *   'required'       — field is empty
 *   'invalid_number' — field has a value that is not a valid/positive number
 *   'out_of_range'   — a positive number outside the field's limits (profileFieldLimits)
 *
 * @param {object}  form
 * @param {boolean} spinDrift
 * @param {boolean} tempSensitivity
 * @returns {{ [field: string]: 'required' | 'invalid_number' | 'out_of_range' }}
 */
export function validateProfile(form, spinDrift, tempSensitivity) {
	const errors = {};

	// ── Text fields: required, non-empty ──────────────────────────────────
	if (!form.name?.trim()) errors.name = 'required';
	if (!form.opticName?.trim()) errors.opticName = 'required';
	if (!form.bulletBrand?.trim()) errors.bulletBrand = 'required';

	/** A required field that must be a positive number, within its limits if it has some. */
	function checkPositive(key) {
		const value = text(form[key]);
		if (!value.trim()) {
			errors[key] = 'required';
		} else if (!isPositiveNumber(value)) {
			errors[key] = 'invalid_number';
		} else if (!isWithinLimits(key, parseDecimal(value), form)) {
			errors[key] = 'out_of_range';
		}
	}

	/** A required field that can be any number. */
	function checkAny(key) {
		const value = text(form[key]);
		if (!value.trim()) {
			errors[key] = 'required';
		} else if (!isAnyNumber(value)) {
			errors[key] = 'invalid_number';
		}
	}

	// ── Numeric fields: required AND must be a positive number ────────────
	for (const key of ['opticHeight', 'zeroDist', 'bulletDiameter', 'bulletWeight', 'bc', 'velocity']) {
		checkPositive(key);
	}

	// ── Click adjustment fields ─────────────────────────────────────────
	checkPositive('elevationClickValue');
	if (!form.clickLink) checkPositive('windageClickValue');

	// ── Spin drift fields ────────────────────────────────────────────────
	if (spinDrift) {
		checkPositive('barrelTwist');
		checkPositive('bulletLength');
	}

	// ── Temperature sensitivity fields ───────────────────────────────────
	if (tempSensitivity) {
		checkAny('temperature');
		checkAny('tempModifier');
	}

	return errors;
}

/** Fields of the profile form that hold a number. */
const NUMERIC_FIELDS = [
	'opticHeight',
	'zeroDist',
	'bulletDiameter',
	'bulletWeight',
	'bc',
	'velocity',
	'elevationClickValue',
	'windageClickValue',
	'barrelTwist',
	'bulletLength',
	'temperature',
	'tempModifier'
];

/**
 * The numeric fields of a valid form as they are stored: trimmed, with a decimal point instead of a
 * comma (#117). The calculators read a comma too, but other code reads stored values with
 * parseFloat or Number. Text that is not a number is kept as it was.
 *
 * @param {object} form
 * @returns {object} the fields that hold text, normalized
 */
export function normalizedNumbers(form) {
	const result = {};
	for (const key of NUMERIC_FIELDS) {
		if (typeof form[key] === 'string') result[key] = normalizeDecimal(form[key]);
	}
	return result;
}

/** Returns true when the errors object has no keys. */
export function isValid(errors) {
	return Object.keys(errors).length === 0;
}

/**
 * Builds the ammo display string stored on the profile.
 *
 * @param {string} brand      - Bullet brand / designation
 * @param {string} weight     - Weight value (numeric string)
 * @param {string} weightUnit - 'gr' | 'g'
 * @returns {string}
 */
export function buildAmmoString(brand, weight, weightUnit) {
	const weightStr = weight?.trim() ? `${weight.trim()}\u202f${weightUnit}` : '';
	return [brand?.trim(), weightStr].filter(Boolean).join(' ') || '—';
}

/**
 * The profile as stored from a valid profile form (#150): the form's fields, the numbers as
 * normalizedNumbers gives them (a comma becomes a decimal point, #117), the zero distance as a
 * number, the two switches, and the ammo and optic text the lists show. With linked clicks the
 * windage is the elevation. ProfileForm and the guided setup both store this. Validate the form
 * with validateProfile first: this builds, it does not check.
 *
 * @param {object}  form
 * @param {boolean} spinDrift
 * @param {boolean} tempSensitivity
 * @returns {object}
 */
export function buildProfileData(form, spinDrift, tempSensitivity) {
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

/**
 * The profile the guided setup stores (#150), or null when its form is not valid. It is checked as
 * the profile form checks a new profile, with the same two switches: since #177 the setup's optional
 * step 4 can turn on spin drift and temperature sensitivity (off by default, and off when it is
 * skipped). Then built as ProfileForm builds it, so the fields of a switch that is off are stored as
 * typed, as the profile form stores them.
 *
 * @param {object}  form - the guided setup's form, values as typed
 * @param {boolean} [spinDrift]
 * @param {boolean} [tempSensitivity]
 * @returns {object | null}
 */
export function setupProfileData(form, spinDrift = false, tempSensitivity = false) {
	const spin = spinDrift === true;
	const temp = tempSensitivity === true;
	if (!isValid(validateProfile(form, spin, temp))) return null;
	return buildProfileData(form, spin, temp);
}
