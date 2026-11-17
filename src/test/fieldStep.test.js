/**
 * − and + steps of the Scope View fields and the shared wind and atmosphere cards (#166). Pure text
 * maths: no engine call. The limits come from the calculators' own checks.
 */
import { describe, it, expect } from 'vitest';
import { decimalsOf, fieldStepSpec, maxWindSpeed, stepValue } from '#lib/utils/fieldStep.js';
import { shotWinds } from '#lib/utils/shotWind.js';
import { isUsableScopeAngle } from '#lib/utils/scopeRange.js';
import { isUsableAtmosphere } from '#lib/utils/inputLimits.js';
import { storedRotation } from '#lib/utils/storedState.js';

const up = (value, field, unit) => {
	const spec = fieldStepSpec(field, unit);
	return stepValue(value, spec.step, spec);
};
const down = (value, field, unit) => {
	const spec = fieldStepSpec(field, unit);
	return stepValue(value, -spec.step, spec);
};

describe('decimalsOf', () => {
	it('counts the decimals as JavaScript writes the number', () => {
		expect(decimalsOf(0)).toBe(0);
		expect(decimalsOf(10)).toBe(0);
		expect(decimalsOf(0.5)).toBe(1);
		expect(decimalsOf(-29.92)).toBe(2);
		expect(decimalsOf(1e-7)).toBe(7);
		expect(decimalsOf(1e21)).toBe(0);
		expect(decimalsOf(NaN)).toBe(0);
	});
});

describe('stepValue', () => {
	const plain = { step: 0.1, start: 0 };

	it('adds without float noise', () => {
		expect(stepValue('0.2', 0.1, plain)).toBe('0.3');
		expect(stepValue('0.1', 0.2, plain)).toBe('0.3');
		expect(stepValue('1.1', -0.1, plain)).toBe('1');
	});

	it('keeps the decimals of the value when it has more than the step', () => {
		expect(stepValue('29.921', 0.01, { step: 0.01, start: 0 })).toBe('29.931');
		expect(stepValue('12.5', 1, { step: 1, start: 0 })).toBe('13.5');
	});

	it('reads the box as the calculators do', () => {
		expect(stepValue('1,5', 0.5, { step: 0.5, start: 0 })).toBe('2');
		expect(stepValue(' 7 ', 1, { step: 1, start: 0 })).toBe('8');
		expect(stepValue('90abc', 5, { step: 5, start: 0 })).toBe('95');
		expect(stepValue(4, 1, { step: 1, start: 0 })).toBe('5');
	});

	it('starts from spec.start for an empty box, text or an infinite value', () => {
		const spec = { step: 1, start: 10 };
		for (const value of ['', '   ', 'abc', 'Infinity', '-Infinity', null, undefined, {}]) {
			expect(stepValue(value, 1, spec)).toBe('11');
			expect(stepValue(value, -1, spec)).toBe('9');
		}
	});

	it('clamps to min and max, and brings an out-of-range value back', () => {
		const spec = { step: 10, min: -1000, max: 10000, start: 0 };
		expect(stepValue('9995', 10, spec)).toBe('10000');
		expect(stepValue('10000', 10, spec)).toBe('10000');
		expect(stepValue('20000', -10, spec)).toBe('10000');
		expect(stepValue('-995', -10, spec)).toBe('-1000');
		expect(stepValue('-5000', 10, spec)).toBe('-1000');
	});

	it('keeps an exclusive end one last decimal inside', () => {
		const spec = { step: 1, min: -90, max: 90, minExclusive: true, maxExclusive: true, start: 0 };
		expect(stepValue('89', 1, spec)).toBe('89');
		expect(stepValue('-89', -1, spec)).toBe('-89');
		expect(stepValue('89.5', 1, spec)).toBe('89.9');
	});

	it('rounds a clamped end down to the decimals in use, never past it', () => {
		expect(stepValue('35.39', 0.01, { step: 0.01, min: 8.86, max: 35.4, start: 0 })).toBe('35.4');
		expect(stepValue('223', 1, { step: 1, min: 0, max: 223.69, start: 0 })).toBe('223');
	});

	it('goes round with wrap', () => {
		const spec = { step: 5, wrap: 360, start: 0 };
		expect(stepValue('355', 5, spec)).toBe('0');
		expect(stepValue('0', -5, spec)).toBe('355');
		expect(stepValue('', -5, spec)).toBe('355');
		expect(stepValue('722', 5, spec)).toBe('7');
		expect(stepValue('0.7', 5, spec)).toBe('5.7');
	});

	it('writes -0 as 0', () => {
		expect(stepValue('-1', 1, { step: 1, start: 0 })).toBe('0');
		expect(stepValue('-0.5', 0.5, { step: 0.5, start: 0 })).toBe('0');
	});
});

describe('fieldStepSpec', () => {
	it('wind speed: 0.5 m/s or 1 mph, from 0 to the shotWinds limit', () => {
		expect(up('3.5', 'windSpeed', 'mps')).toBe('4');
		expect(up('', 'windSpeed', 'mps')).toBe('0.5');
		expect(down('0', 'windSpeed', 'mps')).toBe('0');
		expect(down('0.3', 'windSpeed', 'mps')).toBe('0');
		expect(up('7.8', 'windSpeed', 'mph')).toBe('8.8');
		expect(up('100', 'windSpeed', 'mps')).toBe('100');
		expect(up('500', 'windSpeed', 'mph')).toBe(String(Math.floor(maxWindSpeed('mph'))));
		expect(maxWindSpeed('mph')).toBeCloseTo(223.694, 3);
	});

	it('wind speed: a step never gives a speed shotWinds rejects', () => {
		for (const [value, unit] of [['99.9', 'mps'], ['223', 'mph'], ['223.6', 'mph'], ['1e9', 'mph']]) {
			const speed = up(value, 'windSpeed', unit);
			expect(shotWinds({ speed, speedUnit: unit, direction: '90' })).not.toBeNull();
		}
	});

	it('wind direction: 5° round the dial, empty from 0', () => {
		expect(up('90', 'windDirection')).toBe('95');
		expect(down('0', 'windDirection')).toBe('355');
		expect(up('', 'windDirection')).toBe('5');
		expect(up('357', 'windDirection')).toBe('2');
	});

	it('angle in degrees: 1°, kept inside -90 to 90', () => {
		expect(up('0', 'angle', 'deg')).toBe('1');
		expect(up('', 'angle', 'deg')).toBe('1');
		expect(up('89', 'angle', 'deg')).toBe('89');
		expect(down('-89', 'angle', 'deg')).toBe('-89');
		expect(down('120', 'angle', 'deg')).toBe('89');
		for (const value of ['89', '89.9', '-89.4', '500']) {
			expect(isUsableScopeAngle({ angle: up(value, 'angle', 'deg'), unit: 'deg' })).toBe(true);
			expect(isUsableScopeAngle({ angle: down(value, 'angle', 'deg'), unit: 'deg' })).toBe(true);
		}
	});

	it('angle as a cosine: 0.01, above 0 and at most 1, empty from 1 (flat)', () => {
		expect(down('', 'angle', 'cos')).toBe('0.99');
		expect(up('', 'angle', 'cos')).toBe('1');
		expect(up('0.99', 'angle', 'cos')).toBe('1');
		expect(down('0.01', 'angle', 'cos')).toBe('0.01');
		// A long out-of-range value comes back just inside 0, never in exponent form (#166 review).
		expect(down('-21.226756174486994', 'angle', 'cos')).toBe('0.001');
		expect(up('-21.226756174486994', 'angle', 'cos')).toBe('0.001');
		expect(down('0.866', 'angle', 'cos')).toBe('0.856');
		for (const value of ['0.01', '1', '0', '2', '-1']) {
			expect(isUsableScopeAngle({ angle: down(value, 'angle', 'cos'), unit: 'cos' })).toBe(true);
			expect(isUsableScopeAngle({ angle: up(value, 'angle', 'cos'), unit: 'cos' })).toBe(true);
		}
	});

	it('altitude: 10 m or 10 ft within altitudeLimits', () => {
		expect(up('450', 'altitude', 'm')).toBe('460');
		expect(down('', 'altitude', 'ft')).toBe('-10');
		expect(up('9995', 'altitude', 'm')).toBe('10000');
		expect(up('32805', 'altitude', 'ft')).toBe('32808');
		expect(down('-3280', 'altitude', 'ft')).toBe('-3281');
	});

	it('pressure: 1 hPa or 0.01 inHg within pressureLimits, empty from the standard pressure', () => {
		expect(up('1018', 'pressure', 'hpa')).toBe('1019');
		expect(up('', 'pressure', 'hpa')).toBe('1014');
		expect(up('29.92', 'pressure', 'inhg')).toBe('29.93');
		expect(down('', 'pressure', 'inhg')).toBe('29.91');
		expect(down('8.86', 'pressure', 'inhg')).toBe('8.86');
		expect(up('1200', 'pressure', 'hpa')).toBe('1200');
		expect(down('1018', 'pressure', 'inhg')).toBe('35.4');
	});

	it('temperature: 1° within temperatureLimits, empty from 0 °C or 32 °F as before', () => {
		expect(up('8', 'temperature', 'c')).toBe('9');
		expect(up('', 'temperature', 'c')).toBe('1');
		expect(down('', 'temperature', 'f')).toBe('31');
		expect(up('70', 'temperature', 'c')).toBe('70');
		expect(down('-130', 'temperature', 'f')).toBe('-130');
	});

	it('humidity: 5 % from 0 to 100, empty from 65 %', () => {
		expect(up('60', 'humidity')).toBe('65');
		expect(up('', 'humidity')).toBe('70');
		expect(up('98', 'humidity')).toBe('100');
		expect(down('3', 'humidity')).toBe('0');
	});

	it('a step keeps a usable atmosphere usable', () => {
		const units = { altitudeUnit: 'm', pressureUnit: 'hpa', temperatureUnit: 'c' };
		const ends = { altitude: '10000', pressure: '1200', temperature: '70', humidity: '100' };
		const values = {
			altitude: Number(up(ends.altitude, 'altitude', 'm')),
			pressure: Number(up(ends.pressure, 'pressure', 'hpa')),
			temperature: Number(up(ends.temperature, 'temperature', 'c')),
			humidity: Number(up(ends.humidity, 'humidity'))
		};
		expect(isUsableAtmosphere(values, units)).toBe(true);
	});

	it('cant: 1° within the slider, as a number storedRotation keeps', () => {
		expect(up(0, 'cant')).toBe('1');
		expect(up(90, 'cant')).toBe('90');
		expect(down(-90, 'cant')).toBe('-90');
		expect(storedRotation(Number(down(-90, 'cant')))).toBe(-90);
	});

	it('throws on an unknown field', () => {
		expect(() => fieldStepSpec('nope')).toThrow();
	});
});
