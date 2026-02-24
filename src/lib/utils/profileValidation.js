/**
 * Pure validation and data-building helpers for profile forms.
 * No Svelte or i18n dependencies — fully testable in Node/jsdom.
 */

/** Returns true when the trimmed string is a valid number greater than zero. */
function isPositiveNumber(str) {
	const n = Number(str?.trim());
	return str?.trim() !== '' && !isNaN(n) && n > 0;
}

/** Returns true when the trimmed string is any valid finite number (including 0 and negatives). */
function isAnyNumber(str) {
	const trimmed = str?.trim();
	return trimmed !== '' && trimmed != null && !isNaN(Number(trimmed));
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
 *
 * @param {object}  form
 * @param {boolean} spinDrift
 * @param {boolean} tempSensitivity
 * @returns {{ [field: string]: 'required' | 'invalid_number' }}
 */
export function validateProfile(form, spinDrift, tempSensitivity) {
	const errors = {};

	// ── Text fields: required, non-empty ──────────────────────────────────
	if (!form.name?.trim()) errors.name = 'required';
	if (!form.opticName?.trim()) errors.opticName = 'required';
	if (!form.bulletBrand?.trim()) errors.bulletBrand = 'required';

	// ── Numeric fields: required AND must be a positive number ────────────
	const positiveFields = [
		['opticHeight', form.opticHeight],
		['zeroDist', form.zeroDist],
		['bulletDiameter', form.bulletDiameter],
		['bulletWeight', form.bulletWeight],
		['bc', form.bc],
		['velocity', form.velocity]
	];

	for (const [key, val] of positiveFields) {
		if (!val?.trim()) {
			errors[key] = 'required';
		} else if (!isPositiveNumber(val)) {
			errors[key] = 'invalid_number';
		}
	}

	// ── Spin drift fields ────────────────────────────────────────────────
	if (spinDrift) {
		if (!form.barrelTwist?.trim()) {
			errors.barrelTwist = 'required';
		} else if (!isPositiveNumber(form.barrelTwist)) {
			errors.barrelTwist = 'invalid_number';
		}

		if (!form.bulletLength?.trim()) {
			errors.bulletLength = 'required';
		} else if (!isPositiveNumber(form.bulletLength)) {
			errors.bulletLength = 'invalid_number';
		}
	}

	// ── Temperature sensitivity fields ───────────────────────────────────
	if (tempSensitivity) {
		if (!form.temperature?.trim()) {
			errors.temperature = 'required';
		} else if (!isAnyNumber(form.temperature)) {
			errors.temperature = 'invalid_number';
		}

		if (!form.tempModifier?.trim()) {
			errors.tempModifier = 'required';
		} else if (!isAnyNumber(form.tempModifier)) {
			errors.tempModifier = 'invalid_number';
		}
	}

	return errors;
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
