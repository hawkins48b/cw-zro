import {
	Calculator,
	EulerIntegrationEngine,
	TrajectoryRangeError,
	ZeroFindingError,
	defaultEngineConfig
} from 'js-ballistics';

/**
 * Why a flight gave no result, as js-ballistics reports it (#125, owner decision of 2026-11-10).
 *
 * The engine ends every flight whose bullet goes below an altitude of MINIMUM_FLIGHT_ALTITUDE_FT
 * (-1410.748 ft, -430 m): the site altitude plus the height of the bullet over the muzzle. A low
 * custom altitude inside its limits (down to -1000 m) can therefore give no result. The pages say so
 * instead of the general no-result text, from the stop reason the engine reports, never from the
 * empty result alone:
 *
 * - `fire` throws TrajectoryRangeError with reason MinimumAltitudeReached.
 * - The zero solve catches that error itself and extrapolates from the cut flight, so it can end in
 *   ZeroFindingError or a NaN elevation with the reason lost. The calculator below runs the same
 *   Euler engine, with a subclass that only notes a minimum altitude stop and throws the same error
 *   on, so that a failed zero solve can tell whether the floor cut its flights. Results are the
 *   same: the integration is the engine's own.
 */

/** Lowest altitude of a flight, in ft: the engine stops the bullet below it. */
export const MINIMUM_FLIGHT_ALTITUDE_FT = defaultEngineConfig.cMinimumAltitude;

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
 * A Calculator on the default Euler engine that notes, in `stops.minimumAltitude`, any flight the
 * engine ended at its minimum altitude, in the zero solve or in a fire.
 *
 * @returns {{ calc: Calculator, stops: { minimumAltitude: boolean } }}
 */
export function createFlightCalculator() {
	const stops = { minimumAltitude: false };
	class StopNotingEngine extends EulerIntegrationEngine {
		_integrate(...args) {
			try {
				return super._integrate(...args);
			} catch (e) {
				if (isMinimumAltitudeStop(e)) stops.minimumAltitude = true;
				throw e;
			}
		}
	}
	return { calc: new Calculator({ engine: StopNotingEngine }), stops };
}

/**
 * Whether a calculation that gave no result ended because of the minimum altitude.
 *
 * @param {unknown} error - what the calculation threw, or null when it stopped without a throw
 *   (a zero solve that gave a NaN or infinite elevation)
 * @param {{ minimumAltitude: boolean }} stops - from createFlightCalculator
 * @returns {boolean} true when a fire ended at the minimum altitude, or when the zero solve failed
 *   after the minimum altitude cut one of its flights. False for any other failure, also when the
 *   zero solve was cut but solved and a later fire failed for another reason.
 */
export function endedAtMinimumAltitude(error, stops) {
	if (error === null || error === undefined) return stops.minimumAltitude;
	if (isMinimumAltitudeStop(error)) return true;
	return error instanceof ZeroFindingError && stops.minimumAltitude;
}
