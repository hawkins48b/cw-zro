import { Unit } from 'js-ballistics';
import { calculateShotPoint } from './ballisticCalculator.js';
import { readDecimal } from './decimal.js';
import { MAX_DISTANCE, MIN_BC } from './inputLimits.js';

/**
 * Most shots one search may fire. A full walk across the velocity range is 100 shots and each
 * halving adds about two, so this is a backstop that a working search never reaches. The
 * library runs synchronously: nothing can interrupt a search that does not end by itself.
 */
const MAX_SHOTS = 200;

/**
 * Time one search may spend, in ms. MAX_SHOTS limits shots, not time, and near the limits of a
 * very long zero one failed shot can take seconds, while the page runs this on every keystroke.
 * On a desktop a normal solve takes under 0.2 s and a 5000 yd zero about 0.9 s. Phones are
 * slower, so a tighter budget would turn valid long-range answers into errors. Beyond that a
 * solvable goal can run out of time (a 20000 yd zero took 16 s), which is reported as a timeout.
 *
 * It is checked before each shot. One shot cannot be interrupted, so the budget does not stop
 * a single slow or hung shot, and a search can overrun it by the length of its last shot. The
 * shot at the rounded answer is also fired past the budget, but only after a search converged.
 */
const SEARCH_BUDGET_MS = 5000;

/**
 * Binary-search either the muzzle velocity or ballistic coefficient that
 * produces the observed drop or angular adjustment at a given range.
 *
 * @param {object} profile      - flat v2 profile (from profiles store)
 * @param {object} range        - { distance: number|string, unit: 'yd'|'m' }
 * @param {'distance'|'angle'} measureType
 * @param {number|string} measureValue  - observed value, its sign is ignored
 * @param {'in'|'cm'|'moa'|'mrad'} measureUnit
 * @param {'velocity'|'bc'} solveFor
 * @param {object|null} atmosphere - { altitude, altitudeUnit, pressure, pressureUnit, temperature, temperatureUnit, humidity } or null for ISA
 * @param {'below'|'above'} direction - where the bullet was seen relative to the line of sight
 * @returns {{ solveFor, initialVelocity, validatedVelocity, initialBc, validatedBc, initialPoint, validatedPoint, suggestAbove }
 *   | { error: 'range' } | { error: 'minimum_altitude' } | { error: 'no_solution', suggestAbove?: true }
 *   | { error: 'timeout', suggestAbove?: true } | null}
 *   'minimum_altitude': with a custom atmosphere, the profile's own shot gave no result because the
 *   engine ended it at its minimum altitude (flightStop.js). A later shot of the search that ends
 *   there only counts as a failed shot.
 *   validatedPoint is the shot at exactly validatedVelocity and validatedBc. suggestAbove is
 *   true when the goal is below the line of sight but the profile's own shot is above it at
 *   this range, so the observation was probably meant as above.
 */
export function calculateTrajectoryValidation(
	profile,
	range,
	measureType,
	measureValue,
	measureUnit,
	solveFor = 'velocity',
	atmosphere = null,
	direction = 'below'
) {
	try {
		const rangeVal = readDecimal(range.distance);
		const targetVal = readDecimal(measureValue);
		const initialVelocity = readDecimal(profile.velocity);
		const initialBc = readDecimal(profile.bc);

		if (!isFinite(rangeVal) || rangeVal < 100 || rangeVal > MAX_DISTANCE) return null;
		if (!isFinite(targetVal) || targetVal === 0) return null;
		if (!isFinite(initialVelocity) || initialVelocity <= 0) return null;
		if (!isFinite(initialBc) || initialBc <= 0) return null;

		// Range must exceed zero distance
		const zeroVal = readDecimal(profile.zeroDist);
		if (!isFinite(zeroVal) || zeroVal <= 0) return null;

		// Convert both distances to yards for comparison
		const rangeYd = range.unit === 'm' ? rangeVal * 1.09361 : rangeVal;
		const zeroYd = profile.zeroUnit === 'm' ? zeroVal * 1.09361 : zeroVal;
		if (rangeYd <= zeroYd) return { error: 'range' };

		const rangeObj = { distance: rangeVal, unit: range.unit };

		// js-ballistics gives slantHeight and dropAngle the same sign: negative with the bullet
		// below the line of sight (dial up), positive above it (dial down). Users enter a positive
		// value and say which side it is on, so the sign of the goal comes from direction alone.
		const magnitude = Math.round(Math.abs(targetVal) * 10) / 10;
		const goal = direction === 'above' ? magnitude : -magnitude;

		function getMeasure(point) {
			if (!point) return null;
			const value =
				measureType === 'distance'
					? point.slantHeight.In(measureUnit === 'cm' ? Unit.Centimeter : Unit.Inch)
					: point.dropAngle.In(measureUnit === 'mrad' ? Unit.MRad : Unit.MOA);
			return Number.isFinite(value) ? Math.round(value * 10) / 10 : null;
		}

		// Parameter-specific config
		const isVelocity = solveFor === 'velocity';
		const initialParam = isVelocity ? initialVelocity : initialBc;
		const initialStep = isVelocity ? 100 : 0.1;
		const minStep = isVelocity ? 1 : 0.001;
		// The velocity bound is in the profile's unit. calculateShotPoint also stops anything from
		// 10000 fps up (MAX_VELOCITY_FPS), so an m/s search fails there, as on a bound.
		const maxParam = isVelocity ? 10000 : 2.0;
		const minParam = isVelocity ? 0 : MIN_BC;

		/** Fire at a parameter value. Null when it is out of bounds or the shot fails. */
		function shoot(paramVal) {
			if (paramVal <= minParam || paramVal >= maxParam) return null;
			const modProfile = isVelocity
				? { ...profile, velocity: String(paramVal) }
				: { ...profile, bc: String(paramVal) };
			return calculateShotPoint(modProfile, rangeObj, atmosphere, null);
		}

		const deadline = performance.now() + SEARCH_BUDGET_MS;

		// Initial shot. A custom altitude too low for this shot has its own message (#125).
		const report = {};
		const initialPoint = calculateShotPoint(profile, rangeObj, atmosphere, null, { report });
		if (!initialPoint && atmosphere && report.minimumAltitude) return { error: 'minimum_altitude' };
		const initialMeasure = getMeasure(initialPoint);
		if (initialMeasure === null) return { error: 'no_solution' };

		const suggestAbove = direction !== 'above' && initialPoint.slantHeight.In(Unit.Inch) > 0;
		const noSolution = suggestAbove
			? { error: 'no_solution', suggestAbove }
			: { error: 'no_solution' };
		if (initialParam <= minParam || initialParam >= maxParam) return noSolution;

		// current* is always the last good shot: a failed one never replaces it.
		let currentParam = initialParam;
		let step = initialStep;
		let currentPoint = initialPoint;
		let currentMeasure = initialMeasure;

		// The closest good shots on each side of the goal.
		let paramUnderGoal = -Infinity;
		let paramOverGoal = Infinity;
		function recordShot(paramVal, measure) {
			if (measure < goal) paramUnderGoal = Math.max(paramUnderGoal, paramVal);
			if (measure > goal) paramOverGoal = Math.min(paramOverGoal, paramVal);
		}
		recordShot(currentParam, currentMeasure);

		// Binary search. The direction is the same for velocity and BC, above and below the line of
		// sight, and for slantHeight and dropAngle: a higher parameter means less bullet drop
		// relative to the sight line, so the signed measure rises, also inside a short zero where
		// the zero angle moves with the parameter. Fine sweeps of the search range found no second
		// root, only jitter from the integrator just past a long zero at low velocity, about 1 in
		// over at most a dozen fps. Where the measure does fall, the search cannot settle on it: it
		// moves up from a shot under the goal and down from a shot over it, so it only ever closes
		// on a rising crossing and otherwise walks away to a bound, which is no solution.
		for (
			let shots = 0;
			shots < MAX_SHOTS && currentMeasure !== goal && step >= minStep && performance.now() < deadline;
			shots++
		) {
			const wasAbove = currentMeasure > goal;
			const nextParam = wasAbove ? currentParam - step : currentParam + step;
			const newPoint = shoot(nextParam);
			const newMeasure = getMeasure(newPoint);

			// A bound or a failed shot: stay on the last good shot and come back with a smaller step,
			// since the goal can still lie between here and there.
			if (newMeasure === null) {
				step /= 2;
				continue;
			}

			// Halve step when crossing the goal
			if ((wasAbove && newMeasure < goal) || (!wasAbove && newMeasure > goal)) {
				step /= 2;
			}

			currentParam = nextParam;
			currentMeasure = newMeasure;
			currentPoint = newPoint;
			recordShot(currentParam, currentMeasure);
		}

		// Converged means the last good shot measures exactly the goal, at the 0.1 the measure is
		// rounded to, or that two good shots on either side of the goal are less than 2 minStep
		// apart. That is the width of the last step the search takes, the finest it can resolve:
		// at long range one step moves the measure by more than 0.1, so it can jump over the goal
		// without ever equalling it, and that is still an answer. Stopping for any other reason
		// (only one side seen, bounds or failed shots, out of shots or time) means the goal was not reached.
		const converged = currentMeasure === goal || paramOverGoal - paramUnderGoal < 2 * minStep;
		if (!converged) {
			// Time is the only reason left for a search that could still have moved. It says nothing
			// about the goal, so it must not read as no solution.
			const stillSearching = currentMeasure !== goal && step >= minStep;
			return stillSearching && performance.now() >= deadline
				? { ...noSolution, error: 'timeout' }
				: noSolution;
		}

		// The answer is rounded for display and for saving to the profile, so the point has to come
		// from the rounded value. Rounding moves it by at most half a minStep, which keeps it within
		// the search's resolution.
		const validatedParam = isVelocity
			? Math.round(currentParam)
			: Math.round(currentParam * 1000) / 1000;
		const validatedPoint = validatedParam === currentParam ? currentPoint : shoot(validatedParam);
		if (getMeasure(validatedPoint) === null) return noSolution;

		return {
			solveFor,
			initialVelocity,
			validatedVelocity: isVelocity ? validatedParam : initialVelocity,
			initialBc,
			validatedBc: isVelocity ? initialBc : validatedParam,
			initialPoint,
			validatedPoint,
			suggestAbove
		};
	} catch (e) {
		console.error('Trajectory validation error:', e);
		return null;
	}
}
