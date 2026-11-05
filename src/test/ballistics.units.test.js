/**
 * Unit conversion checks for the ballistics reference tests (#70).
 *
 * The calculator converts every input through js-ballistics units, so a wrong factor in the
 * library shifts every result. Expected values come from the definitions of the units, not
 * from the library: 1 in = 25.4 mm, 1 yd = 0.9144 m, 1 ft = 0.3048 m, 1 mi = 1609.344 m,
 * 1 gr = 64.79891 mg, 1 MOA = 1/60 degree, 1 mrad = 0.001 rad, 1 ft-lbf = 1.3558179483 J,
 * 1 inHg = 33.8639 hPa at the conventional 0 C.
 *
 * Tolerance: relative 1e-8. The library's fps and grain factors carry nine significant digits,
 * which puts them about 3e-9 off the definitions: 0.00001 fps at 3000 fps, far below anything
 * a result can show, and any wrong factor is many orders larger. Pressure is relative 1e-5:
 * the inHg factor used here is itself given to six digits.
 */
import { describe, it, expect, vi } from 'vitest';
import { UNew, Unit } from 'js-ballistics';
import { formatNumber, formatFixed } from '#lib/utils/format.js';

const locale = vi.hoisted(() => ({ value: 'en' }));
vi.mock('#lib/paraglide/runtime.js', () => ({ getLocale: () => locale.value }));

const expectRatio = (actual, expected, relative = 1e-8) => {
	expect(Math.abs(actual - expected)).toBeLessThanOrEqual(Math.abs(expected) * relative);
};

describe('unit conversion by definition', () => {
	it.each([
		['inch to millimeter', () => UNew.Inch(1).In(Unit.Millimeter), 25.4],
		['inch to centimeter', () => UNew.Inch(1).In(Unit.Centimeter), 2.54],
		['yard to meter', () => UNew.Yard(1).In(Unit.Meter), 0.9144],
		['foot to meter', () => UNew.Foot(1).In(Unit.Meter), 0.3048],
		['meter to yard', () => UNew.Meter(1000).In(Unit.Yard), 1000 / 0.9144],
		['fps to m/s', () => UNew.FPS(1000).In(Unit.MPS), 304.8],
		['m/s to fps', () => UNew.MPS(800).In(Unit.FPS), 800 / 0.3048],
		['mph to m/s', () => UNew.MPH(10).In(Unit.MPS), 4.4704],
		['grain to gram', () => UNew.Grain(1000).In(Unit.Gram), 64.79891],
		['gram to grain', () => UNew.Gram(1).In(Unit.Grain), 1 / 0.06479891],
		['moa to degree', () => UNew.MOA(60).In(Unit.Degree), 1],
		['mrad to radian', () => UNew.MRad(1000).In(Unit.Radian), 1],
		['mrad to moa', () => UNew.MRad(1).In(Unit.MOA), (0.001 * 180 * 60) / Math.PI],
		['moa to mrad', () => UNew.MOA(1).In(Unit.MRad), (Math.PI / (180 * 60)) * 1000],
		['foot-pound to joule', () => UNew.FootPound(1000).In(Unit.Joule), 1355.8179483]
	])('converts %s', (_, convert, expected) => {
		expectRatio(convert(), expected);
	});

	it.each([
		['0 C', () => UNew.Celsius(0).In(Unit.Fahrenheit), 32],
		['100 C', () => UNew.Celsius(100).In(Unit.Fahrenheit), 212],
		['-40 F', () => UNew.Fahrenheit(-40).In(Unit.Celsius), -40],
		['59 F', () => UNew.Fahrenheit(59).In(Unit.Celsius), 15]
	])('converts temperature at %s', (_, convert, expected) => {
		expect(convert()).toBeCloseTo(expected, 9);
	});

	it('converts pressure between inHg and hPa', () => {
		expectRatio(UNew.InHg(29.92).In(Unit.hPa), 29.92 * 33.8639, 1e-5);
		expectRatio(UNew.hPa(1013.25).In(Unit.InHg), 1013.25 / 33.8639, 1e-5);
	});

	it('gives one MOA as 1.047 in at 100 yd, as used on the turrets', () => {
		const inches = Math.tan(UNew.MOA(1).In(Unit.Radian)) * 3600;
		expect(inches).toBeCloseTo(1.0472, 4);
	});

	it('gives one mrad as 10 cm at 100 m', () => {
		const cm = Math.tan(UNew.MRad(1).In(Unit.Radian)) * 10000;
		expect(cm).toBeCloseTo(10, 4);
	});
});

describe('number formatting', () => {
	it('uses the active locale', () => {
		locale.value = 'en';
		expect(formatNumber(1234.5)).toBe('1,234.5');
		locale.value = 'de';
		expect(formatNumber(1234.5)).toBe('1.234,5');
		locale.value = 'en';
	});

	it('fixes the number of decimals, one by default', () => {
		expect(formatFixed(2.0)).toBe('2.0');
		expect(formatFixed(2.345, 2)).toBe('2.35');
		expect(formatFixed(-8.88, 1)).toBe('-8.9');
		expect(formatFixed(1000, 0)).toBe('1,000');
	});
});
