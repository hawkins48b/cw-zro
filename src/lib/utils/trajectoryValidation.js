import { Unit } from 'js-ballistics';
import { calculateShotPoint } from './ballisticCalculator.js';

/**
 * Binary-search either the muzzle velocity or ballistic coefficient that
 * produces the observed drop or angular adjustment at a given range.
 *
 * @param {object} profile      - flat v2 profile (from profiles store)
 * @param {object} range        - { distance: number|string, unit: 'yd'|'m' }
 * @param {'distance'|'angle'} measureType
 * @param {number|string} measureValue  - observed value
 * @param {'in'|'cm'|'moa'|'mrad'} measureUnit
 * @param {'velocity'|'bc'} solveFor
 * @returns {{ initialVelocity, validatedVelocity, initialBc, validatedBc, initialPoint, validatedPoint } | null}
 */
export function calculateTrajectoryValidation(
	profile,
	range,
	measureType,
	measureValue,
	measureUnit,
	solveFor = 'velocity'
) {
	try {
		const rangeVal = parseFloat(range.distance);
		const targetVal = parseFloat(measureValue);
		const initialVelocity = parseFloat(profile.velocity);
		const initialBc = parseFloat(profile.bc);

		if (!isFinite(rangeVal) || rangeVal <= 0) return null;
		if (!isFinite(targetVal)) return null;
		if (!isFinite(initialVelocity) || initialVelocity <= 0) return null;
		if (!isFinite(initialBc) || initialBc <= 0) return null;

		// Range must exceed zero distance
		const zeroVal = parseFloat(profile.zeroDist);
		if (!isFinite(zeroVal) || zeroVal <= 0) return null;

		// Convert both distances to yards for comparison
		const rangeYd = range.unit === 'm' ? rangeVal * 1.09361 : rangeVal;
		const zeroYd = profile.zeroUnit === 'm' ? zeroVal * 1.09361 : zeroVal;
		if (rangeYd <= zeroYd) return null;

		const rangeObj = { distance: rangeVal, unit: range.unit };
		const goal = Math.round(targetVal * 10) / 10;

		function getMeasure(point) {
			if (!point) return null;
			if (measureType === 'distance') {
				const u = measureUnit === 'cm' ? Unit.Centimeter : Unit.Inch;
				return Math.round(point.targetDrop.In(u) * 10) / 10;
			}
			// angle
			const u = measureUnit === 'mrad' ? Unit.MRad : Unit.MOA;
			return Math.round(point.dropAdjustment.In(u) * 10) / 10;
		}

		// Parameter-specific config
		const isVelocity = solveFor === 'velocity';
		const initialParam = isVelocity ? initialVelocity : initialBc;
		const initialStep = isVelocity ? 100 : 0.1;
		const minStep = isVelocity ? 1 : 0.001;
		const maxParam = isVelocity ? 10000 : 2.0;
		const minParam = isVelocity ? 0 : 0.01;

		function makeProfile(paramVal) {
			if (isVelocity) return { ...profile, velocity: String(paramVal) };
			return { ...profile, bc: String(paramVal) };
		}

		// Initial shot
		const initialPoint = calculateShotPoint(profile, rangeObj, null, null);
		if (!initialPoint) return null;

		let currentParam = initialParam;
		let step = initialStep;
		let currentPoint = initialPoint;
		let currentMeasure = getMeasure(initialPoint);
		if (currentMeasure === null) return null;

		// Binary search — direction is the same for both velocity and BC:
		// higher parameter → bullet retains speed → less drop → measure increases
		// so if currentMeasure > goal, decrease the parameter.
		while (currentMeasure !== goal && step >= minStep && currentParam < maxParam && currentParam > minParam) {
			const wasAbove = currentMeasure > goal;
			currentParam = wasAbove ? currentParam - step : currentParam + step;
			if (currentParam <= minParam || currentParam >= maxParam) break;

			const modProfile = makeProfile(currentParam);
			const newPoint = calculateShotPoint(modProfile, rangeObj, null, null);
			if (!newPoint) { step = 0; break; }

			const newMeasure = getMeasure(newPoint);
			if (newMeasure === null) { step = 0; break; }

			// Halve step when crossing the goal
			if ((wasAbove && newMeasure < goal) || (!wasAbove && newMeasure > goal)) {
				step /= 2;
			}

			currentMeasure = newMeasure;
			currentPoint = newPoint;
		}

		if (currentParam >= maxParam || currentParam <= minParam) return null;

		return {
			solveFor,
			initialVelocity,
			validatedVelocity: isVelocity ? Math.round(currentParam) : initialVelocity,
			initialBc,
			validatedBc: isVelocity ? initialBc : Math.round(currentParam * 1000) / 1000,
			initialPoint,
			validatedPoint: currentPoint
		};
	} catch (e) {
		console.error('Trajectory validation error:', e);
		return null;
	}
}
