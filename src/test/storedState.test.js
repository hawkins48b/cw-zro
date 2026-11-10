/**
 * Stored state of the Scope View, Ballistic and compare pages (#120). localStorage can hold any JSON
 * value. Each damaged case of the issue must give the page a shape it can render, and a damaged
 * value must not start giving a result for a value the user did not enter. The engine is stubbed
 * wherever no result is expected, so a missing guard fails on the stub instead of running the shot.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { Calculator, Unit } from 'js-ballistics';
import {
	MAX_ROTATION,
	isRecord,
	storedAtmosphere,
	storedBallisticOptions,
	storedElevation,
	storedObject,
	storedRange,
	storedRotation,
	storedText
} from '#lib/utils/storedState.js';
import { calculateFullTrajectory, calculateShotPoint, hasNoAirDensity } from '#lib/utils/ballisticCalculator.js';
import { ballisticPageTrajectory, isUsableBallisticRange } from '#lib/utils/ballisticPage.js';
import { isUsableScopeAngle, isUsableScopeRange, scopeEffectiveRange } from '#lib/utils/scopeRange.js';
import { isUsableRange } from '#lib/utils/inputLimits.js';
import { readDecimal } from '#lib/utils/decimal.js';
import { P223_G1, WIND_10MPH } from './fixtures/ballisticProfiles.js';

const throwsAsText = JSON.parse('{"toString":1}');

/** Field values that are not a number or text. */
const DAMAGED_VALUES = [
	['null', null],
	['missing', undefined],
	['an object', {}],
	['an object that cannot become text', throwsAsText],
	['an array', ['500']],
	['a boolean', true]
];

/** Section values that are not an object with fields. */
const DAMAGED_SECTIONS = [
	['null', null],
	['missing', undefined],
	['text', 'x'],
	['a number', 5],
	['a boolean', true],
	['an array', [{ distance: '500' }]],
	['an object that cannot become text', throwsAsText]
];

/** Reading a value the way the pages do: in a text box, with readDecimal and parseInt. */
function readLikeThePage(value) {
	readDecimal(value);
	parseInt(/** @type {any} */ (value));
	return `${value}`;
}

const DEFAULT_OPTIONS = {
	showAtmosphere: false,
	showWind: false,
	showVelocityChart: false,
	showAnnotations: true,
	visibleColumns: ['rangeYd', 'elevIn', 'elevMOA', 'velFps', 'energyFtlb', 'time'],
	velChartUnit: 'fps'
};

it('uses a test value that really throws as text', () => {
	expect(() => parseFloat(throwsAsText)).toThrow();
	expect(() => `${throwsAsText}`).toThrow();
});

describe('storedText and storedObject', () => {
	it('keep numbers, text and objects', () => {
		expect(storedText('500')).toBe('500');
		expect(storedText(500)).toBe(500);
		expect(storedText('')).toBe('');
		expect(storedObject({ a: 1 })).toEqual({ a: 1 });
		expect(isRecord({})).toBe(true);
	});

	it.each(DAMAGED_VALUES)('read %s as an empty box', (_, value) => {
		expect(storedText(value)).toBe('');
	});

	it.each(DAMAGED_SECTIONS.filter(([, value]) => !isRecord(value)))(
		'read a section of %s as an empty one',
		(_, value) => {
			expect(storedObject(value)).toEqual({});
		}
	);

	it('keeps an object that cannot become text: its fields are missing, so they read as empty', () => {
		expect(storedObject(throwsAsText)).toBe(throwsAsText);
		expect(storedText(storedObject(throwsAsText).distance)).toBe('');
	});
});

describe('storedRange', () => {
	it('leaves a good range as it is', () => {
		expect(storedRange({ distance: '500', unit: 'yd' })).toEqual({ distance: '500', unit: 'yd' });
		expect(storedRange({ distance: 600, unit: 'm' })).toEqual({ distance: 600, unit: 'm' });
		expect(storedRange({ distance: '500', unit: 'yd', step: '25' }, { step: true })).toEqual({
			distance: '500',
			unit: 'yd',
			step: '25'
		});
	});

	it('reads the unit as the calculators do: m, else yd', () => {
		for (const unit of ['yd', 'ft', '', null, {}, ['m'], throwsAsText]) {
			expect(storedRange({ distance: '1', unit }).unit).toBe('yd');
		}
	});

	it.each(DAMAGED_SECTIONS)('reads a range of %s as an empty box, with the message', (_, range) => {
		const read = storedRange(range, { step: true });
		expect(read).toEqual({ distance: '', unit: 'yd', step: '' });
		expect(() => readLikeThePage(read.distance)).not.toThrow();
		expect(isUsableBallisticRange(read.distance)).toBe(false);
		expect(isUsableScopeRange(read.distance)).toBe(false);
		expect(isUsableRange(readDecimal(storedRange(range).distance))).toBe(false);
	});

	it.each(DAMAGED_VALUES)('reads a distance or step of %s as an empty box', (_, value) => {
		const read = storedRange({ distance: value, unit: 'm', step: value }, { step: true });
		expect(read).toEqual({ distance: '', unit: 'm', step: '' });
		expect(() => readLikeThePage(read.distance)).not.toThrow();
		expect(() => readLikeThePage(read.step)).not.toThrow();
	});
});

describe('a damaged range gives no result, before the engine', () => {
	let solver;
	let fire;
	const reached = () => solver.mock.calls.length + fire.mock.calls.length > 0;

	beforeEach(() => {
		solver = vi.spyOn(Calculator.prototype, 'setWeaponZero').mockImplementation(() => {
			throw new Error('setWeaponZero reached');
		});
		fire = vi.spyOn(Calculator.prototype, 'fire').mockImplementation(() => {
			throw new Error('fire reached');
		});
		vi.spyOn(console, 'error').mockImplementation(() => {});
	});

	afterEach(() => {
		vi.restoreAllMocks();
	});

	it('reaches the stub with a good range, so the stub is live', () => {
		calculateShotPoint(P223_G1, storedRange({ distance: '500', unit: 'yd' }), null, null);
		expect(reached()).toBe(true);
	});

	it('reached the engine with an array before #120: it read as 500', () => {
		calculateShotPoint(P223_G1, { distance: ['500'], unit: 'yd' }, null, null);
		expect(reached()).toBe(true);
	});

	it.each([...DAMAGED_VALUES.map(([n, v]) => [`a distance of ${n}`, { distance: v, unit: 'yd', step: '25' }]),
		...DAMAGED_SECTIONS.map(([n, v]) => [`a range of ${n}`, v])])(
		'on the Ballistic page, for %s',
		(_, range) => {
			expect(ballisticPageTrajectory(P223_G1, storedRange(range, { step: true }), null, null).result).toBeNull();
			expect(reached()).toBe(false);
		}
	);

	it.each([...DAMAGED_VALUES.map(([n, v]) => [`a distance of ${n}`, { distance: v, unit: 'yd' }]),
		...DAMAGED_SECTIONS.map(([n, v]) => [`a range of ${n}`, v])])(
		'on the Scope View and compare pages, for %s',
		(_, range) => {
			const read = storedRange(range);
			expect(scopeEffectiveRange(read, null)).toBeNull();
			expect(calculateShotPoint(P223_G1, read, null, null)).toBeNull();
			// The compare page reads the distance and checks it before it calculates.
			expect(isUsableRange(readDecimal(read.distance))).toBe(false);
			expect(reached()).toBe(false);
		}
	);
});

describe('a damaged Ballistic step', () => {
	it('is 25, as an empty box is, and changes no calculated value', () => {
		const range = { distance: '300', unit: 'yd' };
		const empty = calculateFullTrajectory(P223_G1, { ...range, step: '' }, null, null);
		const damaged = calculateFullTrajectory(P223_G1, storedRange({ ...range, step: throwsAsText }, { step: true }), null, null);
		const typed = calculateFullTrajectory(P223_G1, { ...range, step: '25' }, null, null);
		const rows = (r) => r.trajectory.map((p) => [p.distance.In(Unit.Yard), p.targetDrop.In(Unit.Inch)]);
		expect(rows(damaged)).toEqual(rows(empty));
		expect(rows(damaged)).toEqual(rows(typed));
	});
});

describe('storedAtmosphere', () => {
	const ISA = {
		useISA: true,
		altitude: '0',
		altitudeUnit: 'ft',
		pressure: '29.92',
		pressureUnit: 'inhg',
		temperature: '59',
		temperatureUnit: 'f',
		humidity: '0'
	};
	const CUSTOM = {
		useISA: false,
		altitude: '1500',
		altitudeUnit: 'm',
		pressure: '1013',
		pressureUnit: 'hpa',
		temperature: '20',
		temperatureUnit: 'c',
		humidity: 50
	};

	it('leaves a good atmosphere as it is', () => {
		expect(storedAtmosphere(ISA)).toEqual(ISA);
		expect(storedAtmosphere(CUSTOM)).toEqual(CUSTOM);
	});

	it('reads useISA as the pages did: any truthy value is the standard atmosphere', () => {
		expect(storedAtmosphere({ ...ISA, useISA: 'yes' }).useISA).toBe(true);
		expect(storedAtmosphere({ ...ISA, useISA: 0 }).useISA).toBe(false);
		expect(storedAtmosphere({ ...ISA, useISA: undefined }).useISA).toBe(false);
	});

	it('reads units as the calculators and limits do', () => {
		const read = storedAtmosphere({ ...CUSTOM, altitudeUnit: {}, pressureUnit: ['hpa'], temperatureUnit: 'C' });
		expect([read.altitudeUnit, read.pressureUnit, read.temperatureUnit]).toEqual(['ft', 'inhg', 'f']);
	});

	it.each(DAMAGED_SECTIONS)(
		'reads an atmosphere of %s as a custom one with empty boxes',
		(_, atmosphere) => {
			const read = storedAtmosphere(atmosphere);
			expect(read).toEqual({
				useISA: false,
				altitude: '',
				altitudeUnit: 'ft',
				pressure: '',
				pressureUnit: 'inhg',
				temperature: '',
				temperatureUnit: 'f',
				humidity: ''
			});
			expect(hasNoAirDensity(read)).toBe(false);
		}
	);

	describe('gives no result for a damaged atmosphere, before the engine', () => {
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

		const range = { distance: '300', unit: 'yd', step: '50' };
		/** The atmosphere the pages hand to the calculators: null for the standard one. */
		const shotAtmo = (read) => (read.useISA ? null : read);

		it('reaches the stub with a good custom atmosphere', () => {
			calculateShotPoint(P223_G1, range, shotAtmo(storedAtmosphere(CUSTOM)), null);
			expect(solver).toHaveBeenCalled();
		});

		it.each(DAMAGED_SECTIONS)('for an atmosphere of %s', (_, atmosphere) => {
			const atmo = shotAtmo(storedAtmosphere(atmosphere));
			expect(calculateShotPoint(P223_G1, range, atmo, null)).toBeNull();
			expect(calculateFullTrajectory(P223_G1, range, atmo, null)).toBeNull();
			expect(solver).not.toHaveBeenCalled();
		});

		for (const field of ['altitude', 'pressure', 'temperature', 'humidity']) {
			it.each(DAMAGED_VALUES)(`for a custom ${field} of %s`, (_, value) => {
				const read = storedAtmosphere({ ...CUSTOM, [field]: value });
				expect(read[field]).toBe('');
				expect(() => readLikeThePage(read[field])).not.toThrow();
				expect(calculateShotPoint(P223_G1, range, shotAtmo(read), null)).toBeNull();
				expect(calculateFullTrajectory(P223_G1, range, shotAtmo(read), null)).toBeNull();
				expect(solver).not.toHaveBeenCalled();
			});
		}

		it('uses the standard atmosphere when it is chosen, whatever the custom boxes hold', () => {
			calculateShotPoint(P223_G1, range, shotAtmo(storedAtmosphere({ ...ISA, altitude: throwsAsText })), null);
			expect(solver).toHaveBeenCalled();
		});
	});
});

describe('storedElevation', () => {
	it('leaves a good angle as it is', () => {
		expect(storedElevation({ angle: '30', unit: 'deg' })).toEqual({ angle: '30', unit: 'deg' });
		expect(storedElevation({ angle: '0.5', unit: 'cos' })).toEqual({ angle: '0.5', unit: 'cos' });
	});

	it.each([...DAMAGED_SECTIONS.map(([n, v]) => [`an angle section of ${n}`, v]),
		...DAMAGED_VALUES.map(([n, v]) => [`an angle of ${n}`, { angle: v, unit: 'deg' }]),
		...DAMAGED_VALUES.map(([n, v]) => [`a cosine of ${n}`, { angle: v, unit: 'cos' }])])(
		'reads %s as an empty box, a flat shot',
		(_, elevation) => {
			const read = storedElevation(elevation);
			expect(read.angle).toBe('');
			expect(() => readLikeThePage(read.angle)).not.toThrow();
			expect(isUsableScopeAngle(read)).toBe(true);
			expect(scopeEffectiveRange({ distance: '600', unit: 'yd' }, read)).toEqual({ distance: 600, unit: 'yd' });
		}
	);

	it('reads the unit as scopeEffectiveRange does: deg, else a cosine', () => {
		for (const unit of [null, undefined, {}, throwsAsText, ['deg'], 'DEG', 'cos']) {
			expect(storedElevation({ angle: '1', unit }).unit).toBe('cos');
		}
		expect(storedElevation(null).unit).toBe('cos');
	});

	describe('a missing or damaged unit changes no result (security review of #120)', () => {
		const range = { distance: '500', unit: 'yd' };

		it.each([[null], [undefined], [{}], [throwsAsText]])(
			'still gives no result for 30 with a unit of %j, as before',
			(unit) => {
				// Before: read as a cosine of 30, 15000 yd, which every calculator rejects.
				const before = scopeEffectiveRange(range, { angle: '30', unit: /** @type {any} */ (unit) });
				expect(before.distance).toBe(15000);
				expect(isUsableRange(before.distance)).toBe(false);
				expect(calculateShotPoint(P223_G1, before, null, null)).toBeNull();
				// Now: the same cosine, rejected one step earlier, so the cosine message shows. Not 433 yd.
				const read = storedElevation({ angle: '30', unit });
				expect(read.unit).toBe('cos');
				expect(isUsableScopeAngle(read)).toBe(false);
				expect(scopeEffectiveRange(range, read)).toBeNull();
			}
		);

		it('reads 0.9 without a unit as a cosine, 450 yd, as before', () => {
			const before = scopeEffectiveRange(range, /** @type {any} */ ({ angle: '0.9' }));
			expect(before).toEqual({ distance: 450, unit: 'yd' });
			expect(scopeEffectiveRange(range, storedElevation({ angle: '0.9' }))).toEqual(before);
		});

		it('keeps an angle in degrees', () => {
			expect(scopeEffectiveRange(range, storedElevation({ angle: '60', unit: 'deg' })).distance).toBeCloseTo(250, 10);
		});
	});
});

describe('storedRotation', () => {
	it.each([[0], [1], [-1], [12.5], [MAX_ROTATION], [-MAX_ROTATION]])('keeps %j', (rotation) => {
		expect(storedRotation(rotation)).toBe(rotation);
	});

	it.each([
		['true', true],
		['[1]', [1]],
		['"5"', '5'],
		['an object', {}],
		['an object that cannot become text', throwsAsText],
		['null', null],
		['missing', undefined],
		['500, past the slider', 500],
		['-91, past the slider', -91]
	])('reads %s as no cant', (_, rotation) => {
		expect(storedRotation(rotation)).toBe(0);
		expect(() => `rotate(${storedRotation(rotation)}, 200, 200)`).not.toThrow();
	});

	describe('on the engine', () => {
		const range = { distance: '500', unit: 'yd' };
		const shoot = (cantAngle) => calculateShotPoint(P223_G1, range, null, WIND_10MPH, { cantAngle });
		const windage = (point) => point.windage.In(Unit.Inch);
		const flat = shoot(0);

		it('gave a 1° cant for a stored true or [1] before #120', () => {
			const oneDegree = windage(shoot(1));
			expect(oneDegree).not.toBeCloseTo(windage(flat), 2);
			expect(windage(shoot(/** @type {any} */ (true)))).toBe(oneDegree);
			expect(windage(shoot(/** @type {any} */ ([1])))).toBe(oneDegree);
		});

		it.each([[true], [[1]], ['5'], [500]])('gives the uncanted result for a stored %j', (rotation) => {
			expect(windage(shoot(storedRotation(rotation)))).toBe(windage(flat));
		});
	});
});

describe('storedBallisticOptions', () => {
	const ALL_COLUMNS = ['rangeYd', 'rangeM', 'elevIn', 'elevMOA', 'velFps', 'energyFtlb', 'time'].map((id) => ({ id }));

	it('leaves good options as they are', () => {
		const options = { ...DEFAULT_OPTIONS, showWind: true, visibleColumns: ['time'], velChartUnit: 'mps' };
		expect(storedBallisticOptions(options, DEFAULT_OPTIONS)).toEqual(options);
	});

	it.each(DAMAGED_SECTIONS)('uses the defaults for options of %s', (_, options) => {
		const read = storedBallisticOptions(options, DEFAULT_OPTIONS);
		expect(read).toEqual(DEFAULT_OPTIONS);
		expect(read.visibleColumns).not.toBe(DEFAULT_OPTIONS.visibleColumns);
	});

	it.each([['a number', 5], ['text', 'time'], ['an object', {}], ['null', null], ['a throwing object', throwsAsText]])(
		'uses the default columns for columns of %s',
		(_, visibleColumns) => {
			const read = storedBallisticOptions({ ...DEFAULT_OPTIONS, visibleColumns }, DEFAULT_OPTIONS);
			expect(read.visibleColumns).toEqual(DEFAULT_OPTIONS.visibleColumns);
			expect(() => ALL_COLUMNS.filter((c) => read.visibleColumns.includes(c.id))).not.toThrow();
		}
	);

	it('keeps only the texts of a column list', () => {
		const visibleColumns = ['time', 5, null, throwsAsText, ['elevIn'], 'elevIn'];
		expect(storedBallisticOptions({ visibleColumns }, DEFAULT_OPTIONS).visibleColumns).toEqual(['time', 'elevIn']);
	});

	it('uses the default for a flag that is not a boolean, and fps for any unit but mps', () => {
		const read = storedBallisticOptions(
			{ showWind: 'yes', showAnnotations: 0, showVelocityChart: throwsAsText, velChartUnit: {} },
			DEFAULT_OPTIONS
		);
		expect(read.showWind).toBe(false);
		expect(read.showAnnotations).toBe(true);
		expect(read.showVelocityChart).toBe(false);
		expect(read.velChartUnit).toBe('fps');
	});
});
