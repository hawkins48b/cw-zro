/**
 * The guided setup's steps (#177): the errors each step shows, step 4 (spin drift and temperature
 * sensitivity) only with its switches on, where the setup goes once saved, and the "+ New profile"
 * links that lead to it.
 */
import { describe, it, expect } from 'vitest';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';
import {
	FULL_FORM_PATH,
	NEW_PROFILE_PATH,
	SETUP_STEP_COUNT,
	SETUP_STEP_FIELDS,
	setupSavedTarget,
	setupStepErrors
} from '#lib/utils/setupSteps.js';
import { validateProfile } from '#lib/utils/profileValidation.js';

/** A guided setup form with steps 1 to 3 valid (M193 from the library) and step 4 empty. */
const FORM = {
	name: 'My AR',
	barrelTwist: '',
	barrelTwistUnit: 'in',
	opticName: 'Red dot',
	opticHeight: '2.6',
	opticHeightUnit: 'in',
	zeroDist: '50',
	zeroUnit: 'yd',
	bulletBrand: 'M193',
	bulletDiameter: '0.224',
	bulletDiameterUnit: 'in',
	bulletWeight: '55',
	bulletWeightUnit: 'gr',
	bcType: 'G1',
	bc: '0.243',
	bulletLength: '19.81',
	bulletLengthUnit: 'mm',
	velocity: '3100',
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

describe('setup steps', () => {
	it('has four steps, each with its fields, and every field of validateProfile in one of them', () => {
		expect(SETUP_STEP_COUNT).toBe(4);
		expect(Object.keys(SETUP_STEP_FIELDS).map(Number)).toEqual([1, 2, 3, 4]);
		const all = Object.values(SETUP_STEP_FIELDS).flat();
		expect(new Set(all).size).toBe(all.length);
		// Every error the profile form can give for an empty form, with both switches on, has a step.
		// windageClickValue is checked only with unlinked clicks, which the setup does not offer.
		const errors = Object.keys(validateProfile({ clickLink: true }, true, true));
		expect(errors.filter((key) => !all.includes(key))).toEqual([]);
	});

	it('gives no error on a valid form, step 4 switches off', () => {
		for (let step = 1; step <= SETUP_STEP_COUNT; step++) expect(setupStepErrors(step, FORM)).toEqual({});
	});

	it('keeps each step to its own fields', () => {
		const form = { ...FORM, name: '', bc: '', velocity: '', barrelTwist: '' };
		expect(setupStepErrors(1, form)).toEqual({ name: 'required' });
		expect(setupStepErrors(2, form)).toEqual({ bc: 'required' });
		expect(setupStepErrors(3, form)).toEqual({ velocity: 'required' });
		expect(setupStepErrors(4, form, { spinDrift: true })).toEqual({ barrelTwist: 'required' });
	});

	it('checks nothing on step 4 with both switches off, whatever was typed', () => {
		const form = { ...FORM, barrelTwist: 'x', bulletLength: '', temperature: 'warm', tempModifier: '' };
		expect(setupStepErrors(4, form)).toEqual({});
		expect(setupStepErrors(4, form, { spinDrift: false, tempSensitivity: false })).toEqual({});
	});

	it('checks the twist and bullet length with spin drift on, as the profile form', () => {
		expect(setupStepErrors(4, { ...FORM, barrelTwist: '10' }, { spinDrift: true })).toEqual({});
		expect(setupStepErrors(4, { ...FORM, barrelTwist: '0' }, { spinDrift: true })).toEqual({ barrelTwist: 'invalid_number' });
		expect(setupStepErrors(4, { ...FORM, barrelTwist: '1000' }, { spinDrift: true })).toEqual({ barrelTwist: 'out_of_range' });
		expect(setupStepErrors(4, { ...FORM, barrelTwist: '10', bulletLength: '' }, { spinDrift: true })).toEqual({
			bulletLength: 'required'
		});
		expect(setupStepErrors(4, { ...FORM, barrelTwist: '10', bulletLength: '200' }, { spinDrift: true })).toEqual({
			bulletLength: 'out_of_range'
		});
		// Temperature fields are not checked with only spin drift on.
		expect(setupStepErrors(4, { ...FORM, barrelTwist: '10', temperature: 'x' }, { spinDrift: true })).toEqual({});
	});

	it('checks the temperature and modifier with temperature sensitivity on; both can be zero or negative', () => {
		const advanced = { tempSensitivity: true };
		expect(setupStepErrors(4, FORM, advanced)).toEqual({ temperature: 'required', tempModifier: 'required' });
		expect(setupStepErrors(4, { ...FORM, temperature: '-5', tempModifier: '0' }, advanced)).toEqual({});
		expect(setupStepErrors(4, { ...FORM, temperature: '15,5', tempModifier: '1,2' }, advanced)).toEqual({});
		expect(setupStepErrors(4, { ...FORM, temperature: 'warm', tempModifier: '1' }, advanced)).toEqual({
			temperature: 'invalid_number'
		});
		// Twist not checked with only temperature on.
		expect(setupStepErrors(4, { ...FORM, temperature: '15', tempModifier: '1' }, advanced)).toEqual({});
	});

	it('reads only true as a switch that is on', () => {
		expect(setupStepErrors(4, FORM, { spinDrift: 'yes', tempSensitivity: 1 })).toEqual({});
	});

	it('gives no error for a step that does not exist', () => {
		expect(setupStepErrors(0, FORM)).toEqual({});
		expect(setupStepErrors(5, { ...FORM, name: '' })).toEqual({});
	});
});

describe('setupSavedTarget', () => {
	it('goes to Scope View on first run, wherever it was opened from', () => {
		for (const fromPath of [null, '/welcome', '/profiles', '/calculators']) {
			expect(setupSavedTarget({ firstRun: true, fromPath })).toEqual({ path: '/scope-view', replace: true });
		}
	});

	it.each(['/profiles', '/scope-view', '/', '/calculators', '/calculators/ballistic', '/calculators/compare-trajectories/add'])(
		'goes back to %s, the page "+ New profile" was on',
		(fromPath) => {
			expect(setupSavedTarget({ firstRun: false, fromPath })).toEqual({ back: true });
		}
	);

	it.each(['/profiles/new', '/profiles/abc', '/profiles/abc/', '/profiles/ammo-selector', '/setup', '/welcome'])(
		'goes to the Profiles list instead of back to %s',
		(fromPath) => {
			expect(setupSavedTarget({ firstRun: false, fromPath })).toEqual({ path: '/profiles', replace: true });
		}
	);

	it('goes to the Profiles list when opened directly', () => {
		expect(setupSavedTarget({ firstRun: false, fromPath: null })).toEqual({ path: '/profiles', replace: true });
		expect(setupSavedTarget({ firstRun: false, fromPath: undefined })).toEqual({ path: '/profiles', replace: true });
	});
});

describe('"+ New profile" links', () => {
	it('lead to the guided setup, and the setup links the full form', () => {
		expect(NEW_PROFILE_PATH).toBe('/setup');
		expect(FULL_FORM_PATH).toBe('/profiles/new');
	});

	/** Every .svelte file under src/, path relative to src/. */
	function svelteFiles(dir) {
		return readdirSync(dir).flatMap((name) => {
			const path = join(dir, name);
			if (name === 'paraglide') return [];
			if (statSync(path).isDirectory()) return svelteFiles(path);
			return name.endsWith('.svelte') ? [path] : [];
		});
	}

	it('no page or component links to /profiles/new itself', () => {
		const src = 'src';
		const linking = svelteFiles(src)
			.filter((path) => /(['"`])\/profiles\/new\1/.test(readFileSync(path, 'utf8')))
			.map((path) => relative(src, path));
		// The layout only names the route for the page title.
		expect(linking).toEqual(['routes/+layout.svelte']);
		expect(readFileSync(join(src, 'routes/+layout.svelte'), 'utf8')).toContain("href: NEW_PROFILE_PATH");
	});

	it('the known entry points use NEW_PROFILE_PATH', () => {
		const src = 'src';
		for (const file of [
			'routes/+layout.svelte',
			'routes/profiles/+page.svelte',
			'routes/calculators/+page.svelte',
			'lib/components/ProfileInUseChip.svelte',
			'lib/components/compare/CompareAddPicker.svelte'
		]) {
			expect(readFileSync(join(src, file), 'utf8'), file).toContain('NEW_PROFILE_PATH');
		}
	});
});
