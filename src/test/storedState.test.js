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
	storedMpbrTarget,
	storedRotation,
	storedSolveFor,
	storedText,
	storedValidationAtmosphere,
	storedValidationMeasure
} from '#lib/utils/storedState.js';
import { calculateFullTrajectory, calculateMPBR, calculateShotPoint, hasNoAirDensity } from '#lib/utils/ballisticCalculator.js';
import { calculateTrajectoryValidation } from '#lib/utils/trajectoryValidation.js';
import { ballisticPageTrajectory, isUsableBallisticRange } from '#lib/utils/ballisticPage.js';
import { isUsableScopeAngle, isUsableScopeRange, scopeEffectiveRange } from '#lib/utils/scopeRange.js';
import { isUsableRange } from '#lib/utils/inputLimits.js';
import { readDecimal } from '#lib/utils/decimal.js';
import { P223_G1, P308_G1, WIND_10MPH } from './fixtures/ballisticProfiles.js';

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

/*
 * #127: the MPBR and Trajectory Validation stores. The page reads the target, the observation, the
 * choice to solve for and the atmosphere through these readers, and passes the same values to the
 * calculators, so what the page shows and the result agree.
 */

const ISA_VALIDATION = { useISA: true, altitude: '0', altitudeUnit: 'ft', pressure: '29.92', pressureUnit: 'inhg', temperature: '59', temperatureUnit: 'f', humidity: '0' };
const MEASURE = { type: 'angle', direction: 'below', distanceValue: '0', distanceUnit: 'in', angleValue: '2', angleUnit: 'moa' };
const EMPTY_MEASURE = { type: 'angle', direction: 'below', distanceValue: '', distanceUnit: 'in', angleValue: '', angleUnit: 'moa' };

/** The validation as the page runs it, from what the store reads. */
function pageValidation(profile, range, measure, solveFor, atmosphere) {
	const atmo = atmosphere.useISA ? null : atmosphere;
	const value = measure.type === 'distance' ? measure.distanceValue : measure.angleValue;
	const unit = measure.type === 'distance' ? measure.distanceUnit : measure.angleUnit;
	return calculateTrajectoryValidation(profile, range, measure.type, value, unit, solveFor, atmo, measure.direction);
}

describe('storedMpbrTarget', () => {
	it('keeps a good target', () => {
		expect(storedMpbrTarget({ size: '8', unit: 'in' })).toEqual({ size: '8', unit: 'in' });
		expect(storedMpbrTarget({ size: 40, unit: 'cm' })).toEqual({ size: 40, unit: 'cm' });
	});

	it.each(DAMAGED_SECTIONS)('reads a target of %s as an empty box in inches', (_, value) => {
		expect(storedMpbrTarget(value)).toEqual({ size: '', unit: 'in' });
	});

	it.each(DAMAGED_VALUES)('reads a size of %s as an empty box', (_, size) => {
		const read = storedMpbrTarget({ size, unit: 'cm' });
		expect(read).toEqual({ size: '', unit: 'cm' });
		expect(() => readLikeThePage(read.size)).not.toThrow();
	});

	it.each([['mm'], ['CM'], [{}], [['cm']], [null], [true]])('reads the unit %j as in, as calculateMPBR does', (unit) => {
		expect(storedMpbrTarget({ size: '8', unit }).unit).toBe('in');
	});
});

describe('a damaged MPBR target gives no result, before the engine', () => {
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

	it('reaches the stub with a good size, so the stub is live', () => {
		calculateMPBR(P223_G1, storedMpbrTarget({ size: '8', unit: 'in' }).size, 'in');
		expect(reached()).toBe(true);
	});

	it('reached the engine with an array before #127: it read as 8', () => {
		calculateMPBR(P223_G1, ['8'], 'in');
		expect(reached()).toBe(true);
	});

	it.each([...DAMAGED_VALUES.map(([n, v]) => [`a size of ${n}`, { size: v, unit: 'in' }]),
		...DAMAGED_SECTIONS.map(([n, v]) => [`a target of ${n}`, v])])('for %s', (_, target) => {
		const read = storedMpbrTarget(target);
		// The page keeps its Calculate button off for an empty size, and calculateMPBR gives no result.
		expect(read.size).toBe('');
		expect(calculateMPBR(P223_G1, read.size, read.unit)).toBeNull();
		expect(reached()).toBe(false);
	});
});

describe('a damaged MPBR unit changes no result', () => {
	it('gives the inch result, as before, and the page labels it in inches', () => {
		const silence = vi.spyOn(console, 'warn').mockImplementation(() => {});
		const inch = calculateMPBR(P308_G1, '8', 'in');
		const damaged = storedMpbrTarget({ size: '8', unit: 'mm' });
		expect(damaged.unit).toBe('in');
		const read = calculateMPBR(P308_G1, damaged.size, damaged.unit);
		const raw = calculateMPBR(P308_G1, '8', 'mm');
		silence.mockRestore();
		expect(inch).not.toBeNull();
		expect(read.useMetric).toBe(false);
		expect([read.optimalZero, read.mpbrMax, read.maxOrdinate]).toEqual([inch.optimalZero, inch.mpbrMax, inch.maxOrdinate]);
		expect([raw.optimalZero, raw.mpbrMax, raw.maxOrdinate]).toEqual([inch.optimalZero, inch.mpbrMax, inch.maxOrdinate]);
	});
});

describe('storedValidationMeasure', () => {
	it('keeps a good observation', () => {
		expect(storedValidationMeasure(MEASURE)).toEqual(MEASURE);
		const other = { type: 'distance', direction: 'above', distanceValue: 4, distanceUnit: 'cm', angleValue: '1', angleUnit: 'mrad' };
		expect(storedValidationMeasure(other)).toEqual(other);
	});

	it.each(DAMAGED_SECTIONS)('reads an observation of %s as empty boxes', (_, value) => {
		expect(storedValidationMeasure(value)).toEqual(EMPTY_MEASURE);
	});

	it.each(DAMAGED_VALUES)('reads a value of %s as an empty box', (_, value) => {
		const read = storedValidationMeasure({ ...MEASURE, angleValue: value, distanceValue: value });
		expect(read.angleValue).toBe('');
		expect(read.distanceValue).toBe('');
	});

	it.each([['foo'], [{}], [null], [['distance']], ['Distance']])('reads the type %j as angle, as the calculation does', (type) => {
		expect(storedValidationMeasure({ ...MEASURE, type }).type).toBe('angle');
	});

	it.each([[{}], ['mm'], [null]])('reads the units %j as in and MOA, and the direction as below', (value) => {
		const read = storedValidationMeasure({ ...MEASURE, distanceUnit: value, angleUnit: value, direction: value });
		expect([read.distanceUnit, read.angleUnit, read.direction]).toEqual(['in', 'moa', 'below']);
	});
});

describe('storedSolveFor', () => {
	it.each([
		['bc', 'bc'],
		['velocity', 'velocity'],
		[undefined, 'velocity'],
		[null, 'velocity'],
		[{}, 'velocity'],
		['x', 'velocity'],
		['BC', 'velocity'],
		[['bc'], 'velocity'],
		[throwsAsText, 'velocity']
	])('reads %j as %j', (value, expected) => {
		expect(storedSolveFor(value)).toBe(expected);
	});
});

describe('storedValidationAtmosphere', () => {
	it('keeps a good atmosphere', () => {
		expect(storedValidationAtmosphere(ISA_VALIDATION, ISA_VALIDATION)).toEqual(ISA_VALIDATION);
		const custom = { ...ISA_VALIDATION, useISA: false, altitude: '1000', altitudeUnit: 'm' };
		expect(storedValidationAtmosphere(custom, ISA_VALIDATION)).toEqual(custom);
	});

	it.each([[undefined], [null]])('reads %j as the standard atmosphere, as the page did', (value) => {
		const read = storedValidationAtmosphere(value, ISA_VALIDATION);
		expect(read).toEqual(ISA_VALIDATION);
		expect(read).not.toBe(ISA_VALIDATION);
	});

	it.each(DAMAGED_SECTIONS.filter(([, v]) => v !== null && v !== undefined))('reads %s as a custom atmosphere with empty boxes', (_, value) => {
		expect(storedValidationAtmosphere(value, ISA_VALIDATION)).toEqual(storedAtmosphere(value));
		expect(storedValidationAtmosphere(value, ISA_VALIDATION).useISA).toBe(false);
	});
});

describe('a damaged validation value gives no result, before the engine', () => {
	let solver;
	let fire;
	const reached = () => solver.mock.calls.length + fire.mock.calls.length > 0;
	const range = { distance: '300', unit: 'yd' };

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

	it('reaches the stub with good values, so the stub is live', () => {
		pageValidation(P308_G1, storedRange(range), storedValidationMeasure(MEASURE), 'velocity', ISA_VALIDATION);
		expect(reached()).toBe(true);
	});

	it.each([
		['an angle array', { ...MEASURE, angleValue: ['2'] }],
		['a distance array', { ...MEASURE, type: 'distance', distanceValue: ['4'] }],
		['a custom pressure array', null, { ...ISA_VALIDATION, useISA: false, pressure: ['29.92'] }],
		['a range array', null, null, { distance: ['300'], unit: 'yd' }]
	])('reached the engine with %s before #127', (_, measure, atmosphere, rawRange) => {
		const m = measure ?? MEASURE;
		const value = m.type === 'distance' ? m.distanceValue : m.angleValue;
		const unit = m.type === 'distance' ? m.distanceUnit : m.angleUnit;
		const atmo = atmosphere ?? null;
		calculateTrajectoryValidation(P308_G1, rawRange ?? range, m.type, value, unit, 'velocity', atmo, 'below');
		expect(reached()).toBe(true);
	});

	it.each([
		...DAMAGED_VALUES.map(([n, v]) => [`an angle of ${n}`, { measure: { ...MEASURE, angleValue: v } }]),
		...DAMAGED_VALUES.map(([n, v]) => [`a distance of ${n}`, { measure: { ...MEASURE, type: 'distance', distanceValue: v } }]),
		...DAMAGED_SECTIONS.map(([n, v]) => [`an observation of ${n}`, { measure: v }]),
		...DAMAGED_VALUES.map(([n, v]) => [`a range distance of ${n}`, { range: { distance: v, unit: 'yd' } }]),
		...DAMAGED_SECTIONS.map(([n, v]) => [`a range of ${n}`, { range: v }]),
		...DAMAGED_VALUES.map(([n, v]) => [`a custom pressure of ${n}`, { atmosphere: { ...ISA_VALIDATION, useISA: false, pressure: v } }]),
		...DAMAGED_SECTIONS.filter(([, v]) => v !== null && v !== undefined).map(([n, v]) => [`an atmosphere of ${n}`, { atmosphere: v }])
	])('for %s', (_, stored) => {
		const result = pageValidation(
			P308_G1,
			storedRange('range' in stored ? stored.range : range),
			storedValidationMeasure('measure' in stored ? stored.measure : MEASURE),
			storedSolveFor('velocity'),
			storedValidationAtmosphere('atmosphere' in stored ? stored.atmosphere : ISA_VALIDATION, ISA_VALIDATION)
		);
		// A custom atmosphere out of its limits stops calculateShotPoint before the engine, so the
		// search reports no solution under the box's message, as for a typed value out of its limits.
		if ('atmosphere' in stored) expect(result).toEqual({ error: 'no_solution' });
		else expect(result).toBeNull();
		expect(reached()).toBe(false);
	});
});

describe('a damaged validation choice changes no result', () => {
	const range = { distance: '300', unit: 'yd' };
	let warn;
	beforeEach(() => {
		warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
	});
	afterEach(() => {
		warn.mockRestore();
	});

	it.each([
		['type', { type: 'foo' }, { type: 'angle' }],
		['angle unit', { angleUnit: {} }, { angleUnit: 'moa' }],
		['distance unit', { type: 'distance', distanceValue: '4', distanceUnit: 'mm' }, { type: 'distance', distanceValue: '4', distanceUnit: 'in' }],
		['direction', { direction: {} }, { direction: 'below' }]
	])('a damaged %s gives the result of what the page shows, as before', (_, damaged, shown) => {
		const raw = { ...MEASURE, ...damaged };
		const read = storedValidationMeasure(raw);
		expect(read).toEqual({ ...MEASURE, ...shown });
		const fromRead = pageValidation(P308_G1, range, read, 'velocity', ISA_VALIDATION);
		const before = calculateTrajectoryValidation(
			P308_G1,
			range,
			raw.type,
			raw.type === 'distance' ? raw.distanceValue : raw.angleValue,
			raw.type === 'distance' ? raw.distanceUnit : raw.angleUnit,
			'velocity',
			null,
			raw.direction === 'above' ? 'above' : 'below'
		);
		expect(fromRead).not.toBeNull();
		expect(fromRead.error).toBeUndefined();
		expect(fromRead.validatedVelocity).toBe(before.validatedVelocity);
	});

	it('a missing or null atmosphere stays the standard atmosphere', () => {
		const standard = pageValidation(P308_G1, range, MEASURE, 'velocity', ISA_VALIDATION);
		const missing = pageValidation(P308_G1, range, MEASURE, 'velocity', storedValidationAtmosphere(undefined, ISA_VALIDATION));
		const nulled = pageValidation(P308_G1, range, MEASURE, 'velocity', storedValidationAtmosphere(null, ISA_VALIDATION));
		expect(standard.validatedVelocity).toBeGreaterThan(0);
		expect(missing.validatedVelocity).toBe(standard.validatedVelocity);
		expect(nulled.validatedVelocity).toBe(standard.validatedVelocity);
	});
});
