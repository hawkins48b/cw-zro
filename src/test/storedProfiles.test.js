/**
 * Stored profile list (#120). A list that is not a list, or an entry that is not a profile, threw
 * on every route; a name, ammo or zero distance that cannot become text threw on the profile, compare
 * and edit pages. The calculators keep the stored profile, so shownProfile must not change a result.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { Calculator, Unit } from 'js-ballistics';
import { normalizeProfiles, shownProfile } from '#lib/utils/storedProfiles.js';
import { duplicateProfile } from '#lib/utils/profileOps.js';
import { calculateShotPoint } from '#lib/utils/ballisticCalculator.js';
import { isUsableZeroDistance } from '#lib/utils/zeroDistance.js';
import { readDecimal } from '#lib/utils/decimal.js';
import { P223_G1 } from './fixtures/ballisticProfiles.js';

const throwsAsText = JSON.parse('{"toString":1}');

/** The app's default profile, as profiles.svelte.js seeds it. */
const DEFAULT_PROFILE = {
	id: 'p1',
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
	ammo: 'M193 55 gr',
	optic: 'Aimpoint CompM2'
};

const DAMAGED_VALUES = [
	['null', null],
	['an object', {}],
	['an object that cannot become text', throwsAsText],
	['an array', ['100']],
	['a boolean', true]
];

/** Reading a profile the way the list, compare and edit pages do. None of this may throw. */
function readLikeThePages(profile) {
	profile.name.localeCompare(profile.name);
	profile.ammo.localeCompare(profile.ammo);
	profile.name.toLowerCase().includes('x');
	profile.ammo.toLowerCase().includes('x');
	profile.reticleType.toUpperCase();
	String(profile.zeroDist);
	return `${profile.name} ${profile.ammo} ${profile.optic} ${profile.zeroDist} ${profile.velocity} ${profile.reticleType}`;
}

describe('normalizeProfiles', () => {
	it('keeps a good list, with the same profiles', () => {
		const list = [DEFAULT_PROFILE, { ...P223_G1, id: 'p2' }];
		const read = normalizeProfiles(list);
		expect(read).toEqual(list);
		expect(read[0]).toBe(list[0]);
	});

	it.each([['null', null], ['missing', undefined], ['an object', { a: 1 }], ['text', 'x'], ['a number', 5], ['a boolean', true]])(
		'gives no profiles for a list of %s',
		(_, value) => {
			expect(normalizeProfiles(value)).toEqual([]);
		}
	);

	it('leaves out entries that are not profiles', () => {
		const numberId = { ...DEFAULT_PROFILE, id: 7 };
		const list = [null, 5, 'x', [], [DEFAULT_PROFILE], { ...DEFAULT_PROFILE, id: throwsAsText }, { name: 'no id' }, DEFAULT_PROFILE, numberId];
		expect(normalizeProfiles(list)).toEqual([DEFAULT_PROFILE, numberId]);
	});

	it('lets the store migration read every entry', () => {
		const list = [null, 5, { ...DEFAULT_PROFILE, reticleType: undefined }];
		expect(() => normalizeProfiles(list).forEach((p) => p.reticleType === undefined)).not.toThrow();
	});
});

describe('shownProfile', () => {
	it('shows a good profile as it is', () => {
		expect(shownProfile(DEFAULT_PROFILE)).toEqual(DEFAULT_PROFILE);
		const metric = {
			...DEFAULT_PROFILE,
			opticHeightUnit: 'cm',
			zeroUnit: 'm',
			bulletDiameterUnit: 'mm',
			bulletWeightUnit: 'g',
			bcType: 'G7',
			bulletLengthUnit: 'mm',
			velocityUnit: 'mps',
			temperatureUnit: 'c',
			barrelTwistUnit: 'mm',
			spinDrift: true,
			tempSensitivity: true,
			clickLink: false,
			reticleType: 'mrad',
			elevationClickUnit: 'MRAD'
		};
		expect(shownProfile(metric)).toEqual(metric);
	});

	it('is null without a profile', () => {
		expect(shownProfile(null)).toBeNull();
		expect(shownProfile(undefined)).toBeNull();
	});

	it('leaves out fields no page reads', () => {
		expect(shownProfile({ ...DEFAULT_PROFILE, extra: throwsAsText })).not.toHaveProperty('extra');
	});

	for (const field of ['name', 'ammo', 'optic', 'opticName', 'bulletBrand']) {
		it.each(DAMAGED_VALUES)(`shows a ${field} of %s as empty text`, (_, value) => {
			const shown = shownProfile({ ...DEFAULT_PROFILE, [field]: value });
			expect(shown[field]).toBe('');
			expect(() => readLikeThePages(shown)).not.toThrow();
		});

		it(`shows a ${field} that is a number as text, so that it sorts and searches`, () => {
			const shown = shownProfile({ ...DEFAULT_PROFILE, [field]: 5 });
			expect(shown[field]).toBe('5');
			expect(() => readLikeThePages(shown)).not.toThrow();
		});
	}

	for (const field of ['zeroDist', 'velocity', 'opticHeight', 'bc', 'bulletWeight', 'bulletDiameter', 'barrelTwist', 'bulletLength', 'temperature', 'tempModifier']) {
		it.each(DAMAGED_VALUES)(`shows a ${field} of %s as an empty box`, (_, value) => {
			const shown = shownProfile({ ...DEFAULT_PROFILE, [field]: value });
			expect(shown[field]).toBe('');
			expect(() => readLikeThePages(shown)).not.toThrow();
			expect(() => readDecimal(shown[field])).not.toThrow();
		});
	}

	it.each(DAMAGED_VALUES)('agrees with the calculators on a zero distance of %s: neither can use it', (_, zeroDist) => {
		expect(isUsableZeroDistance(zeroDist)).toBe(false);
		expect(isUsableZeroDistance(shownProfile({ ...DEFAULT_PROFILE, zeroDist }).zeroDist)).toBe(false);
	});

	it.each(DAMAGED_VALUES)('shows a click value of %s as 0.5, the value the Scope View counts with', (_, value) => {
		const shown = shownProfile({ ...DEFAULT_PROFILE, elevationClickValue: value, windageClickValue: value });
		expect(shown.elevationClickValue).toBe('0.5');
		expect(shown.windageClickValue).toBe('0.5');
	});

	it.each(DAMAGED_VALUES)('shows a reticle or click unit of %s as its default', (_, value) => {
		const shown = shownProfile({ ...DEFAULT_PROFILE, reticleType: value, elevationClickUnit: value, windageClickUnit: value });
		expect([shown.reticleType, shown.elevationClickUnit, shown.windageClickUnit]).toEqual(['red-dot', 'MOA', 'MOA']);
		expect(() => readLikeThePages(shown)).not.toThrow();
	});

	it('reads spin drift and powder sensitivity as the calculators test them, and the click link as on by default', () => {
		expect(shownProfile({ ...DEFAULT_PROFILE, spinDrift: 'yes', tempSensitivity: {} })).toMatchObject({
			spinDrift: true,
			tempSensitivity: true
		});
		expect(shownProfile({ ...DEFAULT_PROFILE, spinDrift: 0, tempSensitivity: null })).toMatchObject({
			spinDrift: false,
			tempSensitivity: false
		});
		expect(shownProfile({ ...DEFAULT_PROFILE, clickLink: undefined }).clickLink).toBe(true);
		expect(shownProfile({ ...DEFAULT_PROFILE, clickLink: null }).clickLink).toBe(true);
		expect(shownProfile({ ...DEFAULT_PROFILE, clickLink: false }).clickLink).toBe(false);
	});

	describe('units, as the calculators read them', () => {
		const UNITS = {
			barrelTwistUnit: 'in',
			opticHeightUnit: 'in',
			zeroUnit: 'yd',
			bulletDiameterUnit: 'in',
			bulletWeightUnit: 'gr',
			bcType: 'G1',
			bulletLengthUnit: 'in',
			velocityUnit: 'fps',
			temperatureUnit: 'f'
		};

		it.each(DAMAGED_VALUES)('shows a unit of %s as the unit the calculators use', (_, value) => {
			const damaged = Object.fromEntries(Object.keys(UNITS).map((key) => [key, value]));
			expect(shownProfile({ ...DEFAULT_PROFILE, ...damaged })).toMatchObject(UNITS);
		});

		it('gives the result of the shown units for damaged ones', () => {
			const damaged = Object.fromEntries(Object.keys(UNITS).map((key) => [key, throwsAsText]));
			const profile = { ...P223_G1, ...damaged };
			const shown = shownProfile(profile);
			const shownUnits = Object.fromEntries(Object.keys(UNITS).map((key) => [key, shown[key]]));
			const range = { distance: '300', unit: 'yd' };
			const stored = calculateShotPoint(profile, range, null, null);
			const asShown = calculateShotPoint({ ...P223_G1, ...shownUnits }, range, null, null);
			expect(stored.targetDrop.In(Unit.Inch)).toBe(asShown.targetDrop.In(Unit.Inch));
			expect(stored.velocity.In(Unit.FPS)).toBe(asShown.velocity.In(Unit.FPS));
		});
	});
});

describe('the calculators keep the stored profile', () => {
	let solver;
	beforeEach(() => {
		solver = vi.spyOn(Calculator.prototype, 'setWeaponZero').mockImplementation(() => {
			throw new Error('setWeaponZero reached');
		});
		vi.spyOn(Calculator.prototype, 'fire').mockImplementation(() => {
			throw new Error('fire reached');
		});
		vi.spyOn(console, 'error').mockImplementation(() => {});
	});
	afterEach(() => {
		vi.restoreAllMocks();
	});

	it('would give a result if the shown empty twist reached them, so they must not get it', () => {
		const stored = { ...P223_G1, spinDrift: true, barrelTwist: {} };
		expect(calculateShotPoint(stored, { distance: '300', unit: 'yd' }, null, null)).toBeNull();
		expect(solver).not.toHaveBeenCalled();
		calculateShotPoint({ ...stored, barrelTwist: shownProfile(stored).barrelTwist }, { distance: '300', unit: 'yd' }, null, null);
		expect(solver).toHaveBeenCalled();
	});
});

describe('duplicateProfile with a damaged name', () => {
	it.each(DAMAGED_VALUES)('copies a profile named %s as " - Copy"', (_, name) => {
		const { list } = duplicateProfile([{ ...DEFAULT_PROFILE, name }], 'p1');
		expect(list[1].name).toBe(' - Copy');
	});
});
