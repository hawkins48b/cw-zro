/**
 * NaN guards around the engine (#113). A NaN sight height or elevation hangs fire for good, and
 * neither try/catch nor a Vitest timeout can stop that. So nothing here runs the hang: the engine
 * is stubbed, and the checks count calls, because each calculator's catch would swallow a throw.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { Ammo, Atmo, Calculator, DragModel, Shot, Table, UNew, Unit, Weapon } from 'js-ballistics';
import {
	calculateShotPoint,
	calculateFullTrajectory,
	calculateMPBR
} from '#lib/utils/ballisticCalculator.js';
import { generateImperialDopeCard } from '#lib/utils/dopeCardImperial.js';
import { generateMetricDopeCard } from '#lib/utils/dopeCardMetric.js';
import { hasFiniteElevation } from '#lib/utils/zeroDistance.js';
import { P308_G1 } from './fixtures/ballisticProfiles.js';

const card = vi.hoisted(() => ({ labels: [] }));

vi.mock('pdf-lib', () => ({
	rgb: () => ({}),
	StandardFonts: {},
	PDFDocument: {
		load: async () => ({
			embedFont: async () => ({}),
			getPages: () => [
				{
					getSize: () => ({ height: 612 }),
					drawText: (text) => card.labels.push(text),
					drawLine: () => {},
					drawCircle: () => {},
					drawRectangle: () => {}
				}
			]
		})
	}
}));

const RANGE = { distance: 300, unit: 'yd', step: 100 };
const CARDS = [
	['imperial', generateImperialDopeCard],
	['metric', generateMetricDopeCard]
];
const BAD_HEIGHTS = [
	['empty text', ''],
	['text', 'abc'],
	['null', null],
	['undefined', undefined],
	['an overflow', '1e999']
];

const realZero = Calculator.prototype.setWeaponZero;
const realFire = Calculator.prototype.fire;

/** Counts the shots fired with an elevation that is not finite, without flying them. */
function watchFire() {
	const watch = { bad: 0, good: 0 };
	vi.spyOn(Calculator.prototype, 'fire').mockImplementation(function (args) {
		if (Number.isFinite(args.shot.barrelElevation.In(Unit.Radian))) {
			watch.good += 1;
			return realFire.call(this, args);
		}
		watch.bad += 1;
		throw new Error('fired a shot with a NaN elevation');
	});
	return watch;
}

/** Makes the solver return NaN from the given solve on, as it does without an error. */
function solveToNaN(fromSolve = 1) {
	let solves = 0;
	vi.spyOn(Calculator.prototype, 'setWeaponZero').mockImplementation(function (shot, distance) {
		solves += 1;
		if (solves < fromSolve) return realZero.call(this, shot, distance);
		shot.weapon.zeroElevation = UNew.Radian(NaN);
		return shot.weapon.zeroElevation;
	});
	return () => solves;
}

describe('NaN guards (#113)', () => {
	beforeEach(() => {
		card.labels = [];
		vi.stubGlobal('fetch', async () => ({ arrayBuffer: async () => new ArrayBuffer(0) }));
		vi.spyOn(console, 'error').mockImplementation(() => {});
	});

	afterEach(() => {
		vi.restoreAllMocks();
		vi.unstubAllGlobals();
	});

	describe.each(BAD_HEIGHTS)('with an optic height of %s', (_, opticHeight) => {
		const profile = { ...P308_G1, opticHeight };
		let solver;
		let fire;

		// fire too: the MPBR search fires before it solves, so a missing guard would really hang.
		beforeEach(() => {
			solver = vi.spyOn(Calculator.prototype, 'setWeaponZero').mockImplementation(() => {
				throw new Error('setWeaponZero reached with a bad optic height');
			});
			fire = vi.spyOn(Calculator.prototype, 'fire').mockImplementation(() => {
				throw new Error('fire reached with a bad optic height');
			});
		});

		it('calculateShotPoint gives no result', () => {
			expect(calculateShotPoint(profile, RANGE, null, null)).toBeNull();
			expect(solver).not.toHaveBeenCalled();
		});

		it('calculateFullTrajectory gives no result', () => {
			expect(calculateFullTrajectory(profile, RANGE, null, null)).toBeNull();
			expect(solver).not.toHaveBeenCalled();
		});

		it('calculateMPBR gives no result', () => {
			expect(calculateMPBR(profile, 30, 'in')).toBeNull();
			expect(solver).not.toHaveBeenCalled();
			expect(fire).not.toHaveBeenCalled();
		});

		it.each(CARDS)('the %s dope card prints nothing', async (_, generate) => {
			await generate(profile);
			expect(card.labels).toEqual([]);
			expect(solver).not.toHaveBeenCalled();
		});
	});

	describe('with a NaN from the solver', () => {
		it('calculateShotPoint does not fire', () => {
			const watch = watchFire();
			const solves = solveToNaN();
			expect(calculateShotPoint(P308_G1, RANGE, null, null)).toBeNull();
			expect(solves()).toBe(1);
			expect(watch).toEqual({ bad: 0, good: 0 });
		});

		it('calculateFullTrajectory does not fire', () => {
			const watch = watchFire();
			const solves = solveToNaN();
			expect(calculateFullTrajectory(P308_G1, RANGE, null, null)).toBeNull();
			expect(solves()).toBe(1);
			expect(watch).toEqual({ bad: 0, good: 0 });
		});

		it('calculateMPBR does not fire after the solve', () => {
			const watch = watchFire();
			const solves = solveToNaN();
			expect(calculateMPBR(P308_G1, 30, 'in')).toBeNull();
			expect(solves()).toBe(1);
			expect(watch.bad).toBe(0);
			// The search before the solve fired, so the solve was really reached.
			expect(watch.good).toBeGreaterThan(0);
		});

		it.each(CARDS)('the %s dope card does not fire', async (_, generate) => {
			const watch = watchFire();
			const solves = solveToNaN();
			await generate(P308_G1);
			expect(solves()).toBeGreaterThan(0);
			expect(watch).toEqual({ bad: 0, good: 0 });
			expect(card.labels).toEqual([]);
		});

		// The solve for the crossings search is the fifth, and it has its own limit check.
		it.each(CARDS)('the %s dope card does not fire the crossings search', async (_, generate) => {
			const watch = watchFire();
			const solves = solveToNaN(5);
			await generate(P308_G1);
			expect(solves()).toBe(5);
			expect(watch).toEqual({ bad: 0, good: 4 });
		});
	});

	// The real solver, not a stub: a saved rotation can hold Infinity, since JSON.parse('1e999') does.
	it('stops an infinite cant angle, which solves to NaN', () => {
		const watch = watchFire();
		expect(calculateShotPoint(P308_G1, RANGE, null, null, { cantAngle: Infinity })).toBeNull();
		expect(watch).toEqual({ bad: 0, good: 0 });
	});

	// Proves the stubs are live: without this, the checks above would also pass with a guard that
	// stopped everything.
	it('still fires a good shot, with and without cant', () => {
		const watch = watchFire();
		expect(calculateShotPoint(P308_G1, RANGE, null, null)).not.toBeNull();
		expect(calculateShotPoint(P308_G1, RANGE, null, null, { cantAngle: 5 })).not.toBeNull();
		expect(calculateFullTrajectory(P308_G1, RANGE, null, null)).not.toBeNull();
		expect(calculateMPBR(P308_G1, 30, 'in')).not.toBeNull();
		expect(watch.bad).toBe(0);
		expect(watch.good).toBeGreaterThan(3);
	});

	describe('with an optic height of 0', () => {
		const profile = { ...P308_G1, opticHeight: 0 };

		it('calculateShotPoint gives a result', () => {
			expect(calculateShotPoint(profile, RANGE, null, null)).not.toBeNull();
		});

		it('calculateFullTrajectory gives a result', () => {
			expect(calculateFullTrajectory(profile, RANGE, null, null)).not.toBeNull();
		});

		// No near crossing to save on a sight height of 0 (#109), so no result, but it gets past the
		// guards: the search fires.
		it('calculateMPBR reaches the engine and gives no result', () => {
			const firing = vi.spyOn(Calculator.prototype, 'fire');
			expect(calculateMPBR(profile, 30, 'in')).toBeNull();
			expect(firing).toHaveBeenCalled();
		});

		it.each(CARDS)('the %s dope card prints', async (_, generate) => {
			await generate(profile);
			expect(card.labels.length).toBeGreaterThan(0);
		});
	});

	describe('hasFiniteElevation', () => {
		// A real Shot, so these check the elevation the engine flies and not a copy of its formula.
		const shotAt = (elevation, cantAngle) => {
			const dm = new DragModel({
				bc: 0.45,
				dragTable: Table.G1,
				weight: UNew.Grain(168),
				diameter: UNew.Inch(0.308)
			});
			return new Shot({
				weapon: new Weapon({ sightHeight: UNew.Inch(2), zeroElevation: UNew.Radian(elevation) }),
				ammo: new Ammo({ dm, mv: UNew.FPS(2650) }),
				atmo: new Atmo(),
				winds: [],
				cantAngle
			});
		};

		it.each([0, 0.001, -0.001, 1.5])('accepts %s', (elevation) => {
			expect(hasFiniteElevation(shotAt(elevation))).toBe(true);
		});

		it.each([NaN, Infinity, -Infinity])('rejects %s', (elevation) => {
			expect(hasFiniteElevation(shotAt(elevation))).toBe(false);
		});

		it('rejects a finite elevation that an infinite cant turns to NaN', () => {
			const shot = shotAt(0.001, UNew.Radian(Infinity));
			expect(shot.weapon.zeroElevation.In(Unit.Radian)).toBe(0.001);
			expect(hasFiniteElevation(shot)).toBe(false);
		});
	});
});
