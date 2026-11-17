import { DEFAULT_CONFIG, HitResult, IntegrationMethod, TrajFlag, UNew, Unit, WasmManager } from 'js-ballistics';

/**
 * The solver of the whole app (#77, owner decision of 2026-11-11). js-ballistics 3 solves in
 * WebAssembly (bclibc, LGPL-3.0), which has to be loaded once: importing this module waits for that,
 * so no calculation can run before it is ready.
 */
const engine = await WasmManager.init();

/**
 * The integrator: RK4, the default of js-ballistics 3 (owner decision of 2026-11-12 on #77). The app
 * used Euler on 2.2. Measured on the recorded baselines, 3.1's RK4 is closer to the old 2.2 Euler
 * results than 3.1's Euler is, because the density and drag corrections of 3.1 and Euler's own error
 * go opposite ways.
 */
export const ENGINE_METHOD = IntegrationMethod.RK4;

/**
 * The settings of the engine. stepMultiplier scales RK4's step too: 0.5 halves the default step.
 * Against the 2.2 baselines (#77), 0.5 gave the smallest largest shift and the smallest total one
 * (largest 10.7 tolerances, against 18.2 for 1 and 10.9 for 0.25). The limits are those of 2.2, so
 * that a flight stops where it did and the zero search has as many tries: 3.1 defaults to 40 zero
 * iterations, a floor of -1500 ft and a drop limit of -10000 ft; 2.2 had 60, -1410.748 ft and
 * -15000 ft. Gravity, the minimum velocity and the zero accuracy did not change.
 */
export const ENGINE_CONFIG = Object.freeze({
	...DEFAULT_CONFIG,
	stepMultiplier: 0.5,
	maxIterations: 60,
	minimumAltitude: -1410.748,
	maximumDrop: -15000
});

/**
 * The rows the app asks for besides the range table: the zero and Mach crossings. Version 3 also has
 * an exact apex row, which 2.2 never gave: it would add a point to the charts and move their axes.
 */
export const EVENT_ROWS = TrajFlag.RANGE | TrajFlag.ZERO | TrajFlag.MACH;

/**
 * Where the zero search starts over, in radians. It starts from the elevation of the shot and gives
 * up with SolverRuntimeError if that flight never gets to the distance (it ends at the minimum
 * altitude first), as a flat shot does on a long zero of a slow or low BC load, though 2.2 solved
 * those. Measured for #77 on the test loads and three extreme ones, zeros of 100 to 3000 yd and m
 * (726 cases): 55 of them need this second start on RK4, and then 2.2 and 3.1 solve the same 647
 * cases, on the same low arc (at most 0.0025 rad apart, on a load near its maximum reach). Past
 * 3000, which no calculator accepts (#93), 3 of 1034 long zeros that 2.2 solved failed on the earlier
 * Euler candidate: no result, never a wrong one.
 */
const LONG_ZERO_START = 0.5;

/**
 * The Calculator of js-ballistics with ENGINE_METHOD and ENGINE_CONFIG, and synchronous. The library
 * only makes its own Calculator async to load the engine, and the calculations run inside reactive
 * page state, which an async result would race. The tests stub these two methods.
 */
export class Calculator {
	/**
	 * Same as Calculator.setWeaponZero of js-ballistics: sets and returns the zero elevation.
	 * Throws ZeroFindingError, OutOfRangeError or SolverRuntimeError when there is no zero.
	 *
	 * @param {Shot} shot
	 * @param {Distance} zeroDistance
	 * @returns {Angular} the new zero elevation, also set on shot.weapon
	 */
	setWeaponZero(shot, zeroDistance) {
		const solve = () =>
			engine.findZeroAngle(shot.toWasmShotProps(ENGINE_METHOD, ENGINE_CONFIG), zeroDistance.In(Unit.Foot));
		let elevation;
		try {
			elevation = solve();
		} catch (e) {
			// ZeroFindingError and OutOfRangeError have their own names: those are real answers.
			if (e.name !== 'SolverRuntimeError') throw e;
			const start = shot.weapon.zeroElevation;
			shot.weapon.zeroElevation = UNew.Radian(LONG_ZERO_START);
			try {
				elevation = solve();
			} catch (retryError) {
				// A failed solve leaves the shot as it was given, as the first try does.
				shot.weapon.zeroElevation = start;
				throw retryError;
			}
		}
		shot.weapon.zeroElevation = UNew.Radian(elevation - shot.lookAngle.In(Unit.Radian));
		return shot.weapon.zeroElevation;
	}

	/**
	 * Same as Calculator.fire of js-ballistics. Throws its RangeError when the flight ends before the
	 * range, with the reason the engine gave and the rows so far in incompleteTrajectory.
	 *
	 * @param {object} options
	 * @param {Shot} options.shot
	 * @param {Distance} options.trajectoryRange
	 * @param {Distance} options.trajectoryStep
	 * @param {number} [options.filterFlags] - TrajFlag rows to return, for instance EVENT_ROWS
	 * @returns {HitResult}
	 */
	fire({ shot, trajectoryRange, trajectoryStep, filterFlags = TrajFlag.RANGE }) {
		const output = engine.integrate(shot.toWasmShotProps(ENGINE_METHOD, ENGINE_CONFIG), {
			range_limit_ft: trajectoryRange.In(Unit.Foot),
			range_step_ft: trajectoryStep.In(Unit.Foot),
			time_step: 0,
			filter_flags: filterFlags
		});
		return HitResult.fromWasmHitOutput(shot, output, true, filterFlags);
	}
}
