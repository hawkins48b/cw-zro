/**
 * Precision dope card calculation (#157): options and requirement checks, the input guards with the
 * engine stubbed (never run a hang, see docs/testing.md#hangs), and the card's numbers on the real
 * engine: the owner's sample profile at 700 m, a 100 yd zero, MOA clicks, the angle mode, imperial
 * columns and a range past the flight limit. The unit choice of #160: the presets, a mixed choice,
 * and the guard of the units option.
 */
import { describe, it, expect, vi, afterEach } from 'vitest';
import { UNew, Unit } from 'js-ballistics';
import { Calculator } from '#lib/utils/ballisticEngine.js';
import {
	PRECISION_MAX_DISTANCE,
	PRECISION_MIN_DISTANCE,
	PRECISION_COLUMNS,
	PRECISION_UNIT_PRESETS,
	WIND_ANGLES,
	computePrecisionCard,
	isUsableMaxDistance,
	precisionCardRequirements,
	precisionPageDistances,
	precisionColumns,
	precisionUnits,
	windFactor
} from '#lib/utils/precisionCard.js';
import { precisionUnitPreset } from '#lib/utils/precisionCardFormat.js';
import { P308_G1 } from './fixtures/ballisticProfiles.js';

/**
 * The owner's sample on the design (issue #157, canvas note n6): 6.5 Creedmoor 140 gr, G7 0.326,
 * 820 m/s, sight height 4.5 cm, twist 1:8" right, length 1.37 in, zero 100 m, 0.1 MRAD clicks.
 */
const SAMPLE = Object.freeze({
	name: 'Tikka T3x',
	ammo: '6.5 Creedmoor 140 gr',
	opticName: 'Vortex Viper',
	barrelTwist: '8',
	barrelTwistUnit: 'in',
	opticHeight: '4.5',
	opticHeightUnit: 'cm',
	zeroDist: 100,
	zeroUnit: 'm',
	bulletDiameter: '0.264',
	bulletDiameterUnit: 'in',
	bulletWeight: '140',
	bulletWeightUnit: 'gr',
	bcType: 'G7',
	bc: '0.326',
	bulletLength: '1.37',
	bulletLengthUnit: 'in',
	velocity: '820',
	velocityUnit: 'mps',
	temperature: '15',
	temperatureUnit: 'c',
	tempModifier: '',
	spinDrift: false,
	tempSensitivity: false,
	reticleType: 'mrad',
	elevationClickValue: '0.1',
	elevationClickUnit: 'MRAD',
	windageClickValue: '0.1',
	windageClickUnit: 'MRAD'
});

/** P308_G1 (100 yd zero) with a MOA reticle and 1/4 MOA clicks. */
const P308_MOA = Object.freeze({
	...P308_G1,
	reticleType: 'moa',
	elevationClickValue: '0.25',
	elevationClickUnit: 'MOA',
	windageClickValue: '0.25',
	windageClickUnit: 'MOA'
});

const METRIC_CLICKS = { maxDistance: 1000, correction: 'clicks', units: 'metric' };

const page = (card, distance) => card.pages.find((p) => p.distance === distance);

afterEach(() => {
	vi.restoreAllMocks();
});

describe('maximum distance and pages', () => {
	it.each([100, 150.5, 800, 3000])('takes %s', (value) => {
		expect(isUsableMaxDistance(value)).toBe(true);
	});

	it.each([
		['99', 99],
		['3001', 3001],
		['0', 0],
		['-500', -500],
		['NaN', NaN],
		['Infinity', Infinity],
		['a string', '500'],
		['null', null],
		['undefined', undefined]
	])('refuses %s', (_, value) => {
		expect(isUsableMaxDistance(value)).toBe(false);
	});

	it('has the limits of the issue', () => {
		expect(PRECISION_MIN_DISTANCE).toBe(100);
		expect(PRECISION_MAX_DISTANCE).toBe(3000);
	});

	it('gives one page per whole 100', () => {
		expect(precisionPageDistances(100)).toEqual([100]);
		expect(precisionPageDistances(199)).toEqual([100]);
		expect(precisionPageDistances(850)).toEqual([100, 200, 300, 400, 500, 600, 700, 800]);
		const all = precisionPageDistances(3000);
		expect(all).toHaveLength(30);
		expect(all.at(-1)).toBe(3000);
	});

	it('gives no pages for a maximum that is not usable', () => {
		expect(precisionPageDistances(50)).toEqual([]);
		expect(precisionPageDistances(NaN)).toEqual([]);
		expect(precisionPageDistances('800')).toEqual([]);
	});
});

describe('requirements', () => {
	it('accepts the sample profile', () => {
		const req = precisionCardRequirements(SAMPLE);
		expect(req.usable).toBe(true);
		expect(req.zero).toEqual({ ok: true, value: 100, unit: 'm' });
		expect(req.reticle).toEqual({ ok: true, type: 'mrad', unit: 'MRAD' });
		expect(req.clicks).toEqual({ ok: true, elevation: { value: 0.1, unit: 'MRAD' }, windage: { value: 0.1, unit: 'MRAD' } });
		expect(req.spinDrift).toEqual({ ok: true });
	});

	it('refuses a zero of 200 m', () => {
		const req = precisionCardRequirements({ ...SAMPLE, zeroDist: 200 });
		expect(req.zero).toEqual({ ok: false, value: 200, unit: 'm' });
		expect(req.usable).toBe(false);
	});

	it.each([[99.9], [101], ['abc'], [null]])('refuses a zero of %s', (zeroDist) => {
		const req = precisionCardRequirements({ ...SAMPLE, zeroDist });
		expect(req.zero.ok).toBe(false);
		expect(req.usable).toBe(false);
	});

	it('takes a zero of 100 yd, and 100 as text', () => {
		expect(precisionCardRequirements({ ...SAMPLE, zeroUnit: 'yd' }).zero).toEqual({ ok: true, value: 100, unit: 'yd' });
		expect(precisionCardRequirements({ ...SAMPLE, zeroDist: '100' }).zero.ok).toBe(true);
	});

	it('gives no zero value or unit for a zero that is not a number', () => {
		expect(precisionCardRequirements({ ...SAMPLE, zeroDist: 'abc' }).zero).toEqual({ ok: false, value: null, unit: null });
	});

	it('refuses a red-dot reticle, and an unknown one', () => {
		for (const reticleType of ['red-dot', '', undefined, 'MRAD', 42]) {
			const req = precisionCardRequirements({ ...SAMPLE, reticleType });
			expect(req.reticle.ok).toBe(false);
			expect(req.reticle.unit).toBeNull();
			expect(req.usable).toBe(false);
		}
	});

	it('reads mil-dot as MRAD and moa as MOA', () => {
		expect(precisionCardRequirements({ ...SAMPLE, reticleType: 'mil-dot' }).reticle).toEqual({ ok: true, type: 'mil-dot', unit: 'MRAD' });
		expect(precisionCardRequirements({ ...SAMPLE, reticleType: 'moa' }).reticle).toEqual({ ok: true, type: 'moa', unit: 'MOA' });
	});

	it.each(['CM', 'IN', 'FT', 'M', 'mrad', undefined])('refuses %s elevation or windage clicks', (unit) => {
		expect(precisionCardRequirements({ ...SAMPLE, elevationClickUnit: unit }).clicks.ok).toBe(false);
		expect(precisionCardRequirements({ ...SAMPLE, windageClickUnit: unit }).clicks.ok).toBe(false);
		expect(precisionCardRequirements({ ...SAMPLE, windageClickUnit: unit }).usable).toBe(false);
	});

	it.each(['0', '', '-0.1', 'abc', 'Infinity', null])('refuses a click value of %s', (value) => {
		const req = precisionCardRequirements({ ...SAMPLE, elevationClickValue: value });
		expect(req.clicks.ok).toBe(false);
		expect(req.clicks.elevation.value).toBeNull();
	});

	it('takes MOA clicks and a comma', () => {
		const req = precisionCardRequirements({ ...P308_MOA, windageClickValue: '0,25' });
		expect(req.clicks).toEqual({ ok: true, elevation: { value: 0.25, unit: 'MOA' }, windage: { value: 0.25, unit: 'MOA' } });
		expect(req.usable).toBe(true);
	});

	it('does not need spin drift', () => {
		for (const changes of [
			{ barrelTwist: '' },
			{ bulletLength: '' },
			{ barrelTwist: '0.5' },
			{ barrelTwist: '101' },
			{ bulletLength: '5' },
			{ barrelTwist: '1e999' }
		]) {
			const req = precisionCardRequirements({ ...SAMPLE, ...changes });
			expect(req.spinDrift.ok).toBe(false);
			expect(req.usable).toBe(true);
		}
	});

	it('takes a left-hand (negative) twist and millimetres', () => {
		expect(precisionCardRequirements({ ...SAMPLE, barrelTwist: '-8' }).spinDrift.ok).toBe(true);
		expect(precisionCardRequirements({ ...SAMPLE, barrelTwist: '203', barrelTwistUnit: 'mm', bulletLength: '34.8', bulletLengthUnit: 'mm' }).spinDrift.ok).toBe(true);
	});

	it('takes no profile without throwing', () => {
		for (const profile of [null, undefined, 'x', 42]) {
			expect(precisionCardRequirements(profile).usable).toBe(false);
		}
	});
});

describe('guards (engine stubbed)', () => {
	/** setWeaponZero throws: a guard must stop every call before it. */
	function stubEngine() {
		vi.spyOn(console, 'error').mockImplementation(() => {});
		const solve = vi.spyOn(Calculator.prototype, 'setWeaponZero').mockImplementation(() => {
			throw new Error('setWeaponZero reached');
		});
		const fire = vi.spyOn(Calculator.prototype, 'fire').mockImplementation(() => {
			throw new Error('fire reached');
		});
		return { solve, fire };
	}

	it('the stub is live: a usable profile reaches it', () => {
		const { solve } = stubEngine();
		expect(computePrecisionCard(SAMPLE, METRIC_CLICKS)).toBeNull();
		expect(solve).toHaveBeenCalledOnce();
	});

	it.each([
		['a zero of 200 m', { zeroDist: 200 }],
		['a red-dot reticle', { reticleType: 'red-dot' }],
		['linear clicks', { elevationClickUnit: 'CM' }],
		['a NaN sight height', { opticHeight: '' }],
		['a sight height past 25.4 cm', { opticHeight: '25.5' }],
		['an overflowing velocity', { velocity: '1e999' }],
		['a NaN velocity', { velocity: 'abc' }],
		['a velocity of 1e15', { velocity: '1e15' }],
		['a velocity under 50 fps', { velocity: '15' }],
		['a BC of 0.00001', { bc: '0.00001' }],
		['a BC above 2', { bc: '2.1' }],
		['a bullet weight of 0', { bulletWeight: '0' }],
		['a bullet diameter past 1 in', { bulletDiameter: '1.5' }],
		['a hex weight', { bulletWeight: '0x10' }],
		['a powder sensitivity that stops the bullet', { tempSensitivity: true, temperature: '60', tempModifier: '100' }],
		['a NaN powder sensitivity', { tempSensitivity: true, temperature: 'abc', tempModifier: '1' }]
	])('stops %s before the engine', (_, changes) => {
		const { solve, fire } = stubEngine();
		expect(computePrecisionCard({ ...SAMPLE, ...changes }, METRIC_CLICKS)).toBeNull();
		expect(solve).not.toHaveBeenCalled();
		expect(fire).not.toHaveBeenCalled();
	});

	it.each([
		['a maximum distance of 50', { maxDistance: 50 }],
		['a maximum distance past 3000', { maxDistance: 3100 }],
		['a NaN maximum distance', { maxDistance: NaN }],
		['a maximum distance as text', { maxDistance: '800' }],
		['an unknown correction', { correction: 'mils' }],
		['unknown units', { units: 'si' }],
		['units as an array', { units: ['mps', 'hpa', 'c'] }],
		['an unknown wind unit', { units: { wind: 'kmh', pressure: 'hpa', temperature: 'c' } }],
		['an inherited unit name', { units: { wind: 'mps', pressure: 'toString', temperature: 'c' } }],
		['a missing temperature', { units: { wind: 'mps', pressure: 'hpa' } }],
		['inherited units', { units: Object.create(PRECISION_UNIT_PRESETS.metric) }]
	])('stops %s before the engine', (_, changes) => {
		const { solve, fire } = stubEngine();
		expect(computePrecisionCard(SAMPLE, { ...METRIC_CLICKS, ...changes })).toBeNull();
		expect(solve).not.toHaveBeenCalled();
		expect(fire).not.toHaveBeenCalled();
	});

	it('takes no profile or options without throwing', () => {
		const { solve } = stubEngine();
		expect(computePrecisionCard(null, METRIC_CLICKS)).toBeNull();
		expect(computePrecisionCard(SAMPLE, null)).toBeNull();
		expect(computePrecisionCard(SAMPLE, undefined)).toBeNull();
		expect(solve).not.toHaveBeenCalled();
	});

	it.each([
		['an infinite twist', { barrelTwist: 'Infinity' }],
		['a twist of 0.5 in', { barrelTwist: '0.5' }],
		['a length of 1e999', { bulletLength: '1e999' }],
		['a length of 5 in', { bulletLength: '5' }]
	])('gives the engine no twist with %s, and the card no spin drift', (_, changes) => {
		const twists = [];
		const real = Calculator.prototype.setWeaponZero;
		vi.spyOn(Calculator.prototype, 'setWeaponZero').mockImplementation(function (shot, distance) {
			twists.push(shot.weapon.twist.In(Unit.Inch));
			return real.call(this, shot, distance);
		});
		const card = computePrecisionCard({ ...SAMPLE, ...changes }, { ...METRIC_CLICKS, maxDistance: 300 });
		expect(twists).toEqual([0]);
		expect(card?.spinDrift).toBe(false);
		expect(card?.pages.every((p) => p.spinDrift === null)).toBe(true);
	});

	it('a NaN zero elevation fires nothing', () => {
		vi.spyOn(console, 'error').mockImplementation(() => {});
		vi.spyOn(Calculator.prototype, 'setWeaponZero').mockImplementation((shot) => {
			shot.weapon.zeroElevation = UNew.Radian(NaN);
			return shot.weapon.zeroElevation;
		});
		const fire = vi.spyOn(Calculator.prototype, 'fire');
		expect(computePrecisionCard(SAMPLE, METRIC_CLICKS)).toBeNull();
		expect(fire).not.toHaveBeenCalled();
	});
});

describe('the sample profile (real engine)', () => {
	const card = computePrecisionCard(SAMPLE, METRIC_CLICKS);

	it('gives the design values at 700 m', () => {
		const p700 = page(card, 700);
		expect(p700.elevation).toBe(58);
		expect(p700.extras).toEqual([
			{ distance: 725, value: 3 },
			{ distance: 750, value: 7 },
			{ distance: 775, value: 10 }
		]);
		expect(p700.time).toBe(1.07);
		expect(p700.spinDrift).toEqual({ value: 1, direction: 'left' });
		// The design's rays I (30°), II (60°) and III (90°), as before #159.
		const ray = (angle) => p700.wind.map((w) => w.values[WIND_ANGLES.indexOf(angle)]);
		expect(ray(90)).toEqual([6, 12, 18, 24]);
		expect(ray(60)).toEqual([5, 11, 16, 21]);
		expect(ray(30)).toEqual([3, 6, 9, 12]);
		// The rays between the hours (#159).
		expect(ray(15)).toEqual([2, 3, 5, 6]);
		expect(ray(45)).toEqual([4, 9, 13, 17]);
		expect(ray(75)).toEqual([6, 12, 18, 24]);
		expect(p700.pressure).toEqual([0, -1, -3, -4, -5, -6]);
		expect(p700.temperature).toEqual([-2, -1, -1, 0, 1, 1, 2, 3]);
		expect(p700.clickSize).toBe(7);
	});

	it('has a page every 100 m to the maximum, in metres', () => {
		expect(card.pages.map((p) => p.distance)).toEqual([100, 200, 300, 400, 500, 600, 700, 800, 900, 1000]);
		expect(card.lastDistance).toBe(1000);
		expect(card.distanceUnit).toBe('m');
		expect(card.sizeUnit).toBe('cm');
		expect(card.units).toEqual({ wind: 'mps', pressure: 'hpa', temperature: 'c' });
		expect(card.columns).toEqual({
			pressure: PRECISION_COLUMNS.pressure.hpa,
			temperature: PRECISION_COLUMNS.temperature.c,
			wind: PRECISION_COLUMNS.wind.mps
		});
	});

	it('is zeroed at 100: no elevation there, and the reference column is 0 everywhere', () => {
		expect(page(card, 100).elevation).toBe(0);
		const ref = PRECISION_COLUMNS.temperature.c.columns.indexOf(15);
		for (const p of card.pages) expect(p.temperature[ref]).toBe(0);
	});

	it('dials more with distance, less in thin or warm air', () => {
		for (let i = 1; i < card.pages.length; i++) {
			expect(card.pages[i].elevation).toBeGreaterThan(card.pages[i - 1].elevation);
		}
		const p1000 = page(card, 1000);
		for (let i = 1; i < p1000.pressure.length; i++) expect(p1000.pressure[i]).toBeLessThanOrEqual(p1000.pressure[i - 1]);
		for (let i = 1; i < p1000.temperature.length; i++) expect(p1000.temperature[i]).toBeGreaterThanOrEqual(p1000.temperature[i - 1]);
	});

	it('wind grows from 15° to 90° and with the ring speed', () => {
		for (const p of card.pages) {
			for (const w of p.wind) {
				expect(w.values).toHaveLength(6);
				for (let r = 1; r < w.values.length; r++) expect(w.values[r]).toBeGreaterThanOrEqual(w.values[r - 1]);
			}
			for (let i = 1; i < p.wind.length; i++) expect(p.wind[i].values.at(-1)).toBeGreaterThanOrEqual(p.wind[i - 1].values.at(-1));
		}
	});

	it('gives each ray the full crosswind times the sine of its angle (#159)', () => {
		expect(WIND_ANGLES).toEqual([15, 30, 45, 60, 75, 90]);
		expect(WIND_ANGLES.map((a) => Math.round(windFactor(a) * 1000) / 1000)).toEqual([0.259, 0.5, 0.707, 0.866, 0.966, 1]);
		expect(windFactor(90)).toBe(1);
		// In angle mode a ray is the 90° value times its factor, give or take the rounding of both.
		const angle = computePrecisionCard(SAMPLE, { ...METRIC_CLICKS, correction: 'angle' });
		for (const p of angle.pages) {
			for (const w of p.wind) {
				const full = w.values.at(-1);
				w.values.forEach((v, r) => expect(Math.abs(v - full * windFactor(WIND_ANGLES[r]))).toBeLessThanOrEqual(0.1 + 1e-9));
			}
		}
	});

	it('removes spin drift from the wind values', () => {
		const without = computePrecisionCard({ ...SAMPLE, barrelTwist: '' }, METRIC_CLICKS);
		for (const p of card.pages) {
			const q = page(without, p.distance);
			p.wind.forEach((w, i) => expect(Math.abs(w.values.at(-1) - q.wind[i].values.at(-1))).toBeLessThanOrEqual(1));
		}
	});

	it('uses spin drift whatever the profile switch says', () => {
		expect(computePrecisionCard({ ...SAMPLE, spinDrift: true }, METRIC_CLICKS)).toEqual(card);
	});

	it('dials right for a left-hand twist', () => {
		const left = computePrecisionCard({ ...SAMPLE, barrelTwist: '-8' }, METRIC_CLICKS);
		expect(page(left, 700).spinDrift).toEqual({ value: 1, direction: 'right' });
		expect(page(left, 100).spinDrift).toEqual({ value: 0, direction: null });
	});

	it('includes powder sensitivity in the temperature columns', () => {
		const sensitive = computePrecisionCard({ ...SAMPLE, tempSensitivity: true, temperature: '15', tempModifier: '2' }, METRIC_CLICKS);
		const p1000 = page(sensitive, 1000);
		const plain = page(card, 1000);
		// Powder measured at 15 °C: the reference is the same shot.
		expect(p1000.elevation).toBe(plain.elevation);
		expect(p1000.temperature[0]).toBeLessThan(plain.temperature[0]);
		expect(p1000.temperature.at(-1)).toBeGreaterThan(plain.temperature.at(-1));
		// Pressure columns are at 15 °C, the powder's own temperature.
		expect(p1000.pressure).toEqual(plain.pressure);
	});

	it('leaves the cold columns empty when the powder cannot fly there', () => {
		// 2690 fps at 15 °C, 66.5 fps per °C slower: under 50 fps at -25 °C.
		const card2 = computePrecisionCard({ ...SAMPLE, tempSensitivity: true, temperature: '15', tempModifier: '66.5' }, { ...METRIC_CLICKS, maxDistance: 300 });
		const p = page(card2, 300);
		expect(p.temperature.at(-1)).toBeNull();
		expect(p.temperature[0]).not.toBeNull();
	});

	it('prints the angle in the reticle unit in angle mode', () => {
		const angle = computePrecisionCard(SAMPLE, { ...METRIC_CLICKS, correction: 'angle' });
		const p700 = page(angle, 700);
		expect(angle.correction).toBe('angle');
		expect(p700.elevation).toBe(5.8);
		for (const p of angle.pages) {
			const values = [p.elevation, ...p.extras.map((e) => e.value), ...p.pressure, ...p.temperature, p.spinDrift.value, ...p.wind.flatMap((w) => w.values)];
			for (const v of values) if (v !== null) expect(Math.abs(Math.round(v * 10) - v * 10)).toBeLessThan(1e-9);
		}
	});
});

describe('a 100 yd zero with MOA clicks (real engine)', () => {
	const card = computePrecisionCard(P308_MOA, { maxDistance: 1000, correction: 'clicks', units: 'imperial' });

	it('has its pages and steps in yards and the click size in inches', () => {
		expect(card.distanceUnit).toBe('yd');
		expect(card.sizeUnit).toBe('in');
		expect(card.pages.map((p) => p.distance)).toEqual([100, 200, 300, 400, 500, 600, 700, 800, 900, 1000]);
		expect(page(card, 500).extras.map((e) => e.distance)).toEqual([525, 550, 575]);
		// 1/4 MOA at 100 yd is 0.26 in; at 1000 yd 2.62 in.
		expect(page(card, 100).clickSize).toBe(0.3);
		expect(page(card, 1000).clickSize).toBe(2.6);
	});

	it('counts quarter-MOA clicks of the MOA angle', () => {
		const angle = computePrecisionCard(P308_MOA, { maxDistance: 1000, correction: 'angle', units: 'imperial' });
		expect(angle.reticleUnit).toBe('MOA');
		for (const p of card.pages) {
			const moa = page(angle, p.distance).elevation;
			expect(p.elevation).toBe(Math.round(moa / 0.25));
		}
	});

	it('has the imperial columns', () => {
		expect(card.columns.pressure).toEqual({ unit: 'inHg', reference: 29.92, columns: [29.5, 28.0, 26.5, 25.0, 23.5, 22.0] });
		expect(card.columns.temperature).toEqual({ unit: 'F', reference: 59, columns: [110, 90, 70, 50, 30, 10, -10] });
		expect(card.columns.wind).toEqual({ unit: 'mph', speeds: [5, 10, 15, 20] });
		for (const p of card.pages) {
			expect(p.pressure).toHaveLength(6);
			expect(p.temperature).toHaveLength(7);
			expect(p.wind.map((w) => w.speed)).toEqual([5, 10, 15, 20]);
		}
	});

	it('the units option changes the columns, not the distances or the elevation', () => {
		const metric = computePrecisionCard(P308_MOA, { maxDistance: 1000, correction: 'clicks', units: 'metric' });
		expect(metric.distanceUnit).toBe('yd');
		expect(metric.pages.map((p) => p.elevation)).toEqual(card.pages.map((p) => p.elevation));
		expect(metric.pages[0].temperature).toHaveLength(8);
	});

	it('uses each turret its own click', () => {
		const mixed = computePrecisionCard({ ...P308_MOA, windageClickValue: '0.1', windageClickUnit: 'MRAD' }, { maxDistance: 1000, correction: 'clicks', units: 'imperial' });
		expect(mixed.pages.map((p) => p.elevation)).toEqual(card.pages.map((p) => p.elevation));
		const w = page(mixed, 1000).wind[3].values.at(-1);
		const moa = page(card, 1000).wind[3].values.at(-1);
		// 0.1 MRAD is 0.344 MOA, so fewer clicks than at 0.25 MOA.
		expect(w).toBeLessThan(moa);
		expect(Math.abs(w * 0.34377 - moa * 0.25)).toBeLessThan(0.4);
	});
});

describe('flight limit (real engine)', () => {
	/** A slow, draggy load that the engine stops past 300 yd. */
	const SLOW = { ...P308_MOA, velocity: '200', bc: '0.05' };

	it('gives no page past where the flight ends, and no extra past it', () => {
		const card = computePrecisionCard(SLOW, { maxDistance: 1000, correction: 'clicks', units: 'imperial' });
		expect(card.pages.map((p) => p.distance)).toEqual([100, 200, 300]);
		expect(card.lastDistance).toBe(300);
		const last = page(card, 300);
		expect(last.extras.at(-1).value).toBeNull();
		expect(last.extras[0].value).not.toBeNull();
	});

	it('stops the extras at the 3000 range limit', () => {
		const card = computePrecisionCard({ ...SAMPLE, bc: '0.6', velocity: '950' }, { maxDistance: 3000, correction: 'clicks', units: 'metric' });
		expect(card.lastDistance).toBe(3000);
		expect(page(card, 3000).extras.map((e) => e.value)).toEqual([null, null, null]);
		expect(page(card, 2900).extras.every((e) => e.value !== null)).toBe(true);
	});

	it('gives no card when the 100 page cannot be reached', () => {
		vi.spyOn(console, 'error').mockImplementation(() => {});
		expect(computePrecisionCard({ ...SLOW, velocity: '60', bc: '0.01' }, METRIC_CLICKS)).toBeNull();
	});
});

describe('the units option (#160)', () => {
	const METRIC = { wind: 'mps', pressure: 'hpa', temperature: 'c' };
	const IMPERIAL = { wind: 'mph', pressure: 'inhg', temperature: 'f' };

	it('reads the preset names and the units of each quantity', () => {
		expect(precisionUnits('metric')).toEqual(METRIC);
		expect(precisionUnits('imperial')).toEqual(IMPERIAL);
		const mixed = { wind: 'mph', pressure: 'hpa', temperature: 'f' };
		const read = precisionUnits(mixed);
		expect(read).toEqual(mixed);
		// A frozen copy, never the caller's object.
		expect(read).not.toBe(mixed);
		expect(Object.isFrozen(read)).toBe(true);
		expect(precisionUnits(Object.freeze({ ...METRIC }))).toEqual(METRIC);
	});

	it('names the preset of a choice, and none for a mixed one', () => {
		expect(precisionUnitPreset(METRIC)).toBe('metric');
		expect(precisionUnitPreset('imperial')).toBe('imperial');
		expect(precisionUnitPreset({ ...IMPERIAL, wind: 'mps' })).toBeNull();
		expect(precisionUnitPreset(null)).toBeNull();
	});

	it.each([
		['an unknown preset', 'si'],
		['a preset in capitals', 'Metric'],
		['an inherited preset name', 'toString'],
		['__proto__ as a preset', '__proto__'],
		['null', null],
		['undefined', undefined],
		['a number', 1],
		['a function', () => METRIC],
		['an array', ['mps', 'hpa', 'c']],
		['an array with the keys', Object.assign([], METRIC)],
		['an empty object', {}],
		['a missing key', { wind: 'mps', pressure: 'hpa' }],
		['an extra key', { ...METRIC, distance: 'm' }],
		['an unknown unit', { ...METRIC, temperature: 'k' }],
		['a unit in capitals', { ...METRIC, pressure: 'hPa' }],
		['the printed symbol', { ...METRIC, wind: 'm/s' }],
		['an inherited unit name', { ...METRIC, wind: 'constructor' }],
		['__proto__ as a unit', { ...METRIC, temperature: '__proto__' }],
		['hasOwnProperty as a unit', { ...METRIC, pressure: 'hasOwnProperty' }],
		['a unit as an object', { ...METRIC, wind: { toString: () => 'mps' } }],
		['a unit as a String object', { ...METRIC, wind: new String('mps') }],
		['inherited keys', Object.create(METRIC)],
		['a __proto__ key from JSON', JSON.parse('{"wind":"mps","pressure":"hpa","__proto__":{"temperature":"c"}}')],
		['a symbol key added', { ...METRIC, [Symbol('x')]: 1 }]
	])('refuses %s', (_, units) => {
		expect(precisionUnits(units)).toBeNull();
		expect(precisionColumns(units)).toBeNull();
	});

	it('refuses an object that throws when read, without throwing', () => {
		const getter = { wind: 'mps', pressure: 'hpa', get temperature() { throw new Error('read'); } };
		const proxy = new Proxy({}, { ownKeys() { throw new Error('keys'); } });
		expect(precisionUnits(getter)).toBeNull();
		expect(precisionUnits(proxy)).toBeNull();
	});

	it('reads each key once, so a getter cannot change its answer', () => {
		let reads = 0;
		const units = {
			wind: 'mps',
			pressure: 'hpa',
			get temperature() {
				reads += 1;
				return reads === 1 ? 'c' : 'kelvin';
			}
		};
		expect(precisionUnits(units)).toEqual(METRIC);
		expect(reads).toBe(1);
	});

	it('stops a damaged units option before the engine', () => {
		vi.spyOn(console, 'error').mockImplementation(() => {});
		const solve = vi.spyOn(Calculator.prototype, 'setWeaponZero').mockImplementation(() => {
			throw new Error('setWeaponZero reached');
		});
		const throwing = { wind: 'mps', pressure: 'hpa', get temperature() { throw new Error('read'); } };
		for (const units of [throwing, { ...METRIC, wind: '__proto__' }, [], 'si']) {
			expect(computePrecisionCard(SAMPLE, { ...METRIC_CLICKS, units })).toBeNull();
		}
		expect(solve).not.toHaveBeenCalled();
	});
});

describe('unit presets and mixed units (real engine, #160)', () => {
	const METRIC = { wind: 'mps', pressure: 'hpa', temperature: 'c' };
	const IMPERIAL = { wind: 'mph', pressure: 'inhg', temperature: 'f' };

	it.each([
		['the sample, clicks', SAMPLE, 'clicks'],
		['the sample, angle', SAMPLE, 'angle'],
		['P308 MOA (yd), clicks', P308_MOA, 'clicks'],
		['P308 MOA (yd), angle', P308_MOA, 'angle']
	])('%s: a preset name and its units give the same card', (_, profile, correction) => {
		for (const [name, units] of [['metric', METRIC], ['imperial', IMPERIAL]]) {
			const byName = computePrecisionCard(profile, { maxDistance: 1200, correction, units: name });
			const byUnits = computePrecisionCard(profile, { maxDistance: 1200, correction, units });
			expect(byName).not.toBeNull();
			expect(byUnits).toEqual(byName);
			expect(byName.units).toEqual(units);
		}
	});

	it('computes each table from its own unit: mph rings, hPa columns, °F columns', () => {
		const options = { maxDistance: 1000, correction: 'clicks' };
		const metric = computePrecisionCard(SAMPLE, { ...options, units: 'metric' });
		const imperial = computePrecisionCard(SAMPLE, { ...options, units: 'imperial' });
		const mixed = computePrecisionCard(SAMPLE, { ...options, units: { wind: 'mph', pressure: 'hpa', temperature: 'f' } });
		expect(mixed.units).toEqual({ wind: 'mph', pressure: 'hpa', temperature: 'f' });
		expect(mixed.columns.pressure).toBe(PRECISION_COLUMNS.pressure.hpa);
		expect(mixed.columns.temperature).toBe(PRECISION_COLUMNS.temperature.f);
		expect(mixed.columns.wind).toBe(PRECISION_COLUMNS.wind.mph);
		// Distances follow the zero, whatever the units.
		expect(mixed.distanceUnit).toBe('m');
		expect(mixed.sizeUnit).toBe('cm');
		mixed.pages.forEach((p, i) => {
			const m = metric.pages[i];
			const im = imperial.pages[i];
			expect(p.distance).toBe(m.distance);
			expect(p.elevation).toBe(m.elevation);
			expect(p.extras).toEqual(m.extras);
			expect(p.spinDrift).toEqual(m.spinDrift);
			expect(p.time).toBe(m.time);
			expect(p.clickSize).toBe(m.clickSize);
			expect(p.pressure).toEqual(m.pressure);
			expect(p.temperature).toEqual(im.temperature);
			expect(p.temperature).toHaveLength(7);
			expect(p.wind).toEqual(im.wind);
		});
		// And the other way round: m/s rings with inHg and °C.
		const other = computePrecisionCard(SAMPLE, { ...options, units: { wind: 'mps', pressure: 'inhg', temperature: 'c' } });
		other.pages.forEach((p, i) => {
			expect(p.pressure).toEqual(imperial.pages[i].pressure);
			expect(p.temperature).toEqual(metric.pages[i].temperature);
			expect(p.wind).toEqual(metric.pages[i].wind);
		});
	});

	it('mph rings give more windage than the m/s rings of the same index past the first', () => {
		// 5 mph is 2.24 m/s, 20 mph 8.94 m/s: every mph ring is a little stronger.
		const options = { maxDistance: 1000, correction: 'angle' };
		const mps = computePrecisionCard(SAMPLE, { ...options, units: { wind: 'mps', pressure: 'hpa', temperature: 'c' } });
		const mph = computePrecisionCard(SAMPLE, { ...options, units: { wind: 'mph', pressure: 'hpa', temperature: 'c' } });
		const at = (card) => page(card, 1000).wind.map((w) => w.values.at(-1));
		at(mph).forEach((v, i) => expect(v).toBeGreaterThanOrEqual(at(mps)[i]));
	});
});

describe('the distance unit chosen apart from the zero (#197, real engine)', () => {
	const options = { maxDistance: 1000, correction: 'angle', units: 'imperial' };
	const yards = computePrecisionCard(P308_MOA, options);
	const metres = computePrecisionCard(P308_MOA, { ...options, distanceUnit: 'm' });

	it('defaults to the zero unit, and the zero unit asked gives the same card', () => {
		expect(yards.distanceUnit).toBe('yd');
		expect(yards.zeroUnit).toBe('yd');
		expect(computePrecisionCard(P308_MOA, { ...options, distanceUnit: 'yd' })).toEqual(yards);
		const metric = computePrecisionCard(SAMPLE, { ...METRIC_CLICKS, distanceUnit: 'm' });
		expect(metric).toEqual(computePrecisionCard(SAMPLE, METRIC_CLICKS));
		expect(metric.zeroUnit).toBe('m');
	});

	it('a 100 yd zero gives a metre card: pages, steps and click size in metres, the zero kept', () => {
		expect(metres.distanceUnit).toBe('m');
		expect(metres.zeroUnit).toBe('yd');
		expect(metres.sizeUnit).toBe('cm');
		expect(metres.pages.map((p) => p.distance)).toEqual([100, 200, 300, 400, 500, 600, 700, 800, 900, 1000]);
		expect(page(metres, 500).extras.map((e) => e.distance)).toEqual([525, 550, 575]);
		// The zero is at 100 yd: at 100 yd nothing to dial, at 100 m (109.4 yd) a little up.
		expect(page(yards, 100).elevation).toBe(0);
		expect(page(metres, 100).elevation).toBeGreaterThanOrEqual(0);
		// Each metre page lies between the yard pages around it (1 m = 1.094 yd).
		for (const d of [300, 500, 800]) {
			const yd = Math.round(d / 0.9144);
			const low = Math.floor(yd / 100) * 100;
			expect(page(metres, d).elevation).toBeGreaterThanOrEqual(page(yards, low).elevation);
			expect(page(metres, d).elevation).toBeLessThanOrEqual(page(yards, low + 100).elevation);
		}
	});

	it('a 100 m zero gives a yard card with the click size in inches', () => {
		const card = computePrecisionCard(SAMPLE, { ...METRIC_CLICKS, correction: 'angle', distanceUnit: 'yd' });
		const own = computePrecisionCard(SAMPLE, { ...METRIC_CLICKS, correction: 'angle' });
		expect(card.distanceUnit).toBe('yd');
		expect(card.zeroUnit).toBe('m');
		expect(card.sizeUnit).toBe('in');
		// 100 yd is 91.4 m, short of the 100 m zero: the bullet is still a little high or level.
		expect(page(card, 100).elevation).toBeLessThanOrEqual(0);
		expect(page(own, 100).elevation).toBe(0);
		expect(page(card, 1000).elevation).toBeLessThan(page(own, 1000).elevation);
	});

	it.each([['km'], ['M'], [''], [null], [['m']], [{ toString: () => 'm' }]])('refuses the distance unit %j', (distanceUnit) => {
		expect(computePrecisionCard(P308_MOA, { ...options, distanceUnit })).toBeNull();
	});
});
