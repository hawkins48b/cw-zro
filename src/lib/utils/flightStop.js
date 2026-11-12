import { RangeError as TrajectoryRangeError, SolverRuntimeError, UNew, Unit } from 'js-ballistics';
import { Calculator, ENGINE_CONFIG } from './ballisticEngine.js';

/**
 * Why a flight gave no result, as js-ballistics reports it (#125, owner decision of 2026-11-10;
 * rechecked on js-ballistics 3.1.0 for #126).
 *
 * The engine ends every flight whose bullet goes below an altitude of MINIMUM_FLIGHT_ALTITUDE_FT
 * (-1410.748 ft, -430 m): the site altitude plus the height of the bullet over the muzzle. A low
 * custom altitude inside its limits (down to -1000 m) can therefore give no result. The pages say so
 * instead of the general no-result text, from the stop reason the engine reports, never from the
 * empty result alone. Only the public API of js-ballistics is used:
 *
 * - `fire` throws its RangeError with reason MinimumAltitudeReached: the engine returns why the
 *   flight ended, and HitResult.fromWasmHitOutput turns that into the error.
 * - The zero solve runs inside the WebAssembly engine, which does not say why it failed: a flight
 *   cut by the floor gives SolverRuntimeError ("Failed to interpolate trajectory at target
 *   distance") or ZeroFindingError. So after a failed solve, the calculator below fires the shot the
 *   solve started from, to the zero distance, and notes whether that flight ended at the minimum
 *   altitude. That extra fire only runs after a failure, on the same guarded values, and changes no
 *   result: the solve has already given none.
 */

/** Lowest altitude of a flight, in ft: the engine stops the bullet below it (ENGINE_CONFIG). */
export const MINIMUM_FLIGHT_ALTITUDE_FT = ENGINE_CONFIG.minimumAltitude;

/**
 * MINIMUM_FLIGHT_ALTITUDE_FT in an altitude unit, for the message: 'm', or feet for anything else,
 * as the calculators read the unit. Rounded to 0.1: -430 m, -1410.7 ft.
 * @param {string} unit
 * @returns {number}
 */
export function minimumFlightAltitude(unit) {
	const value = unit === 'm' ? MINIMUM_FLIGHT_ALTITUDE_FT * 0.3048 : MINIMUM_FLIGHT_ALTITUDE_FT;
	return Math.round(value * 10) / 10;
}

/**
 * Whether an error is the engine ending a flight at its minimum altitude.
 * @param {unknown} error
 * @returns {boolean}
 */
export function isMinimumAltitudeStop(error) {
	return (
		error instanceof TrajectoryRangeError &&
		error.reason === TrajectoryRangeError.MinimumAltitudeReached
	);
}

/**
 * Whether an error is a failed zero solve: SolverRuntimeError or one of its kinds (ZeroFindingError,
 * OutOfRangeError), but not the RangeError of a fire.
 * @param {unknown} error
 * @returns {boolean}
 */
function isZeroSolveFailure(error) {
	return error instanceof SolverRuntimeError && !(error instanceof TrajectoryRangeError);
}

/**
 * A Calculator (ballisticEngine.js) that notes, in `stops.minimumAltitude`, a fire the engine ended
 * at its minimum altitude, or a failed zero solve whose starting flight it ended there.
 *
 * @returns {{ calc: Calculator, stops: { minimumAltitude: boolean } }}
 */
export function createFlightCalculator() {
	const stops = { minimumAltitude: false };
	class StopNotingCalculator extends Calculator {
		setWeaponZero(shot, zeroDistance) {
			const start = shot.weapon.zeroElevation.In(Unit.Radian);
			try {
				return super.setWeaponZero(shot, zeroDistance);
			} catch (e) {
				if (isZeroSolveFailure(e)) {
					shot.weapon.zeroElevation = UNew.Radian(start);
					if (startEndsAtFloor(this, shot, zeroDistance)) stops.minimumAltitude = true;
				}
				throw e;
			}
		}

		fire(options) {
			try {
				return super.fire(options);
			} catch (e) {
				if (isMinimumAltitudeStop(e)) stops.minimumAltitude = true;
				throw e;
			}
		}
	}
	return { calc: new StopNotingCalculator(), stops };
}

/** Whether the shot, at the elevation it has, ends at the minimum altitude before a distance. */
function startEndsAtFloor(calc, shot, distance) {
	try {
		calc.fire({ shot, trajectoryRange: distance, trajectoryStep: distance });
		return false;
	} catch (e) {
		return isMinimumAltitudeStop(e);
	}
}

/**
 * Whether a calculation that gave no result ended because of the minimum altitude.
 *
 * @param {unknown} error - what the calculation threw, or null when it stopped without a throw
 *   (a zero solve that gave a NaN or infinite elevation)
 * @param {{ minimumAltitude: boolean }} stops - from createFlightCalculator
 * @returns {boolean} true when a fire ended at the minimum altitude, or when the zero solve failed
 *   and the flight it started from ended there. False for any other failure, also when a fire
 *   failed for another reason.
 */
export function endedAtMinimumAltitude(error, stops) {
	if (error === null || error === undefined) return stops.minimumAltitude;
	if (isMinimumAltitudeStop(error)) return true;
	return isZeroSolveFailure(error) && stops.minimumAltitude;
}
