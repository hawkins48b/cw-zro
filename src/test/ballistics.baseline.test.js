/**
 * Layer 1 of the ballistics reference tests (#70): regression baseline.
 *
 * Purpose: js-ballistics is going from 2.2.0-beta.2 to 3.x (#77). These numbers are what the
 * app computes today with explicit inputs, so any change in results fails here. They are
 * written out by hand on purpose, not toMatchSnapshot, so a change cannot be accepted by
 * rerunning with -u. They are what the app does, NOT proof that it is right. The check
 * against outside data is layer 2, ballistics.published.test.js.
 *
 * If a test here fails after an upgrade, do not just copy the new number in. Check layer 2
 * first, then decide whether the shift is acceptable. Solver changes alone do show up: at
 * 1000 yd on P308_G1 with a 10 mph crosswind, the library's RK4 engine differs from the
 * Euler engine the app uses today by 0.32 in drop, 0.26 fps, 0.08 in wind drift and
 * 0.007 MOA zero angle. All of that is outside the tolerances below.
 *
 * Tolerances, absolute, on values recorded to the digits shown:
 *
 *   velocity      0.05 fps, 0.02 m/s
 *   time          0.0002 s
 *   drop, wind    0.01 in, 0.03 cm
 *   energy        0.5 ft-lb, 0.5 J
 *   zero angle    0.001 MOA, 0.0003 mrad
 *
 * Why these: the floor is float noise. The same load entered in exact metric units differs
 * from the imperial entry by about 0.000002 in and fps at 1000 yd, so these leave a margin of
 * thousands. The ceiling is the smallest change worth catching: at 1000 yd on P308_G1,
 * +0.1 % BC moves drop 0.35 in, velocity 0.81 fps, wind drift 0.15 in and time 0.00085 s, and
 * +1 fps muzzle velocity moves drop 0.37 in. Each is at least 4 times the matching tolerance
 * and drop is 30 times. At 100 yd the same changes are much smaller, so the long-range rows
 * carry the detection.
 *
 * Exact values, no tolerance: the quantized results. MPBR zeros are whole units and MPBR
 * distances are rounded to 0.1, the validation solver returns whole fps and 0.001 BC, and
 * getElevationValue/getWindageValue return display-rounded values. A small real change can
 * move one of these by a full step, which is a change users see, so it should fail.
 *
 * Key points are rounded to 0.1 by the app, so: 0.2 on near/far zero, max drop distance and
 * subsonic distance, 0.1 on apex and max drop elevation, and 5 units on the apex distance,
 * because these apex values were recorded from step 5 rows. The apex no longer depends on the
 * step (#85), and the max apex block below holds it to 1 unit.
 *
 * Known problems in the code are deliberately NOT pinned here.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
	Ammo,
	Atmo,
	Calculator,
	DragModel,
	EulerIntegrationEngine,
	Shot,
	Table,
	UNew,
	Unit,
	Weapon
} from 'js-ballistics';
import {
	calculateShotPoint,
	getElevationValue,
	getWindageValue,
	calculateFullTrajectory,
	calculateMPBR
} from '#lib/utils/ballisticCalculator.js';
import { calculateTrajectoryValidation } from '#lib/utils/trajectoryValidation.js';
import {
	P223_G1,
	P223_SHORT_ZERO,
	P308_G1,
	P65_G7,
	P338_G7_METRIC,
	P308_G1_METRIC_EXACT,
	P308_G1_METRIC_ROUNDED,
	ATMO_HOT_ALTITUDE,
	ATMO_COLD_METRIC,
	WIND_10MPH,
	WIND_4MPS
} from './fixtures/ballisticProfiles.js';

const TOL = {
	fps: 0.05,
	mps: 0.02,
	time: 0.0002,
	inch: 0.01,
	cm: 0.03,
	energy: 0.5,
	moa: 0.001,
	mrad: 0.0003
};

/** Assert |actual - expected| <= tolerance, naming the value on failure. */
function near(actual, expected, tolerance, label) {
	expect(Math.abs(actual - expected), `${label}: got ${actual}, recorded ${expected}`).toBeLessThanOrEqual(
		tolerance
	);
}

/**
 * Recorded outputs. Trajectory rows are
 * [distance, velocity, time s, drop, windage, energy]:
 * yd, fps, in, ft-lb in `imperial` and `hotAltitude`; m, m/s, cm, J in `metric` and `coldMetric`.
 *
 * - imperial: ICAO atmosphere, WIND_10MPH. metric: ICAO atmosphere, WIND_4MPS.
 * - hotAltitude: ATMO_HOT_ALTITUDE, 10 mph from 45 degrees.
 * - coldMetric: ATMO_COLD_METRIC, 4 m/s from 300 degrees.
 * - scope600yd: [elevation, windage] by display unit, 600 yd, WIND_10MPH.
 * - spinDriftIn: windage at 500 and 1000 yd, spin drift on, no wind.
 * - mpbr8in, mpbr20cm: re-recorded for #86, the only values here to change on purpose. The search
 *   used to walk zeros up to 200 on 5 unit rows, so optimalZero was a near crossing and mpbrMin,
 *   mpbrMax and the apex distance sat on the 5 unit grid. Now optimalZero is the far crossing and
 *   equals farZero, mpbrMax gains 2 to 8 units from the better arc, and the distances are read
 *   between step 1 rows. See the MPBR search block for the check against a brute force search.
 */
const REFERENCE = {
	P223_G1: {
		profile: P223_G1,
		imperial: [
			[100, 2848, 0.0988, 0, 1.09, 990.5],
			[300, 2156.59, 0.341, -9.29, 11.13, 567.9],
			[500, 1577.06, 0.6669, -49.55, 35.89, 303.7],
			[800, 1038.74, 1.3889, -232.2, 114.08, 131.8],
			[1000, 895.48, 2.0152, -503.62, 191.71, 97.9]
		],
		metric: [
			[100, 857.43, 0.1087, 0.08, 2.98, 1310.2],
			[300, 630.34, 0.3809, -32.11, 30.86, 708.1],
			[500, 445.5, 0.7594, -167.44, 101.25, 353.7],
			[800, 297.31, 1.6125, -803.33, 320.98, 157.5],
			[1000, 258.18, 2.3384, -1746.73, 530.3, 118.8]
		],
		zeroMoa: 4.1124,
		zeroMrad: 1.19625,
		keyPointsYd: { nearZero: 100.2, farZero: 124.2, maxApex: { distance: 110, elevation: 0 }, maxDrop: { distance: 1000, drop: -503.6 }, subsonicDist: 731.2 },
		keyPointsM: { nearZero: 91.7, farZero: 113.5, maxApex: { distance: 105, elevation: 0.1 }, maxDrop: { distance: 1000, drop: -1746.7 }, subsonicDist: 668.6 },
		hotAltitude: [
			[300, 2363.19, 0.3256, -8.16, 5.97, 682],
			[1000, 1070.6, 1.712, -363.72, 98.14, 140]
		],
		coldMetric: [
			[300, 668.35, 0.37, -29.82, -22.97, 796.1],
			[1000, 274.35, 2.1628, -1469.54, -399.26, 134.1]
		],
		scope600yd: { MOA: [-14.1, 8.9], MRAD: [-4.1, 2.6], IN: [-88.9, 55.9], FT: [-7.41, 4.66], CM: [-225.8, 142.1], M: [-2.26, 1.42] },
		spinDriftIn: [2.105, 15.93],
		mpbr8in: { optimalZero: 287, nearZero: 39, farZero: 287, mpbrMin: 0, mpbrMax: 332.3, maxOrdinate: { elevation: 4, distance: 170 }, halfTarget: 4, useMetric: false },
		mpbr20cm: { optimalZero: 261, nearZero: 36, farZero: 261, mpbrMin: 0, mpbrMax: 302.2, maxOrdinate: { elevation: 9.9, distance: 155 }, halfTarget: 10, useMetric: true }
	},
	P308_G1: {
		profile: P308_G1,
		imperial: [
			[100, 2456.69, 0.1176, 0, 0.77, 2251.2],
			[300, 2094.4, 0.3821, -15.29, 7.48, 1636.2],
			[500, 1765.42, 0.6943, -62.63, 22.57, 1162.5],
			[800, 1351.93, 1.2788, -223.98, 65.67, 681.7],
			[1000, 1151.82, 1.7616, -422.41, 110.8, 494.9]
		],
		metric: [
			[100, 743.41, 0.1291, -0.35, 2.1, 3008.5],
			[300, 623.65, 0.4228, -50.18, 20.57, 2117.2],
			[500, 516.29, 0.7755, -202.25, 62.59, 1451],
			[800, 386.65, 1.4505, -731.17, 184.01, 813.8],
			[1000, 330.41, 2.0134, -1395.79, 310.15, 594.3]
		],
		zeroMoa: 3.922,
		zeroMrad: 1.14087,
		keyPointsYd: { nearZero: 56, farZero: 100.2, maxApex: { distance: 80, elevation: 0.1 }, maxDrop: { distance: 1000, drop: -422.4 }, subsonicDist: null },
		keyPointsM: { nearZero: 51.2, farZero: 91.6, maxApex: { distance: 70, elevation: 0.3 }, maxDrop: { distance: 1000, drop: -1395.8 }, subsonicDist: 960 },
		hotAltitude: [
			[300, 2204.8, 0.3724, -14.47, 4.1, 1813.2],
			[1000, 1371.14, 1.589, -356.16, 57.08, 701.3]
		],
		coldMetric: [
			[300, 644.81, 0.4158, -48.5, -15.42, 2263.3],
			[1000, 358.82, 1.8925, -1252.37, -227.27, 700.9]
		],
		scope600yd: { MOA: [-16.3, 5.4], MRAD: [-4.7, 1.6], IN: [-102.2, 33.9], FT: [-8.51, 2.83], CM: [-259.5, 86.2], M: [-2.6, 0.86] },
		spinDriftIn: [2.346, 12.892],
		mpbr8in: { optimalZero: 249, nearZero: 21, farZero: 249, mpbrMin: 0, mpbrMax: 293.4, maxOrdinate: { elevation: 4, distance: 139 }, halfTarget: 4, useMetric: false },
		mpbr20cm: { optimalZero: 226, nearZero: 20, farZero: 226, mpbrMin: 0, mpbrMax: 266.4, maxOrdinate: { elevation: 9.9, distance: 126 }, halfTarget: 10, useMetric: true }
	},
	P65_G7: {
		profile: P65_G7,
		imperial: [
			[100, 2560.09, 0.1139, 0, 0.63, 2037.2],
			[300, 2274.31, 0.3626, -12.78, 5.94, 1607.8],
			[500, 2008.15, 0.6434, -52.6, 17.47, 1253.5],
			[800, 1640.46, 1.1392, -180.56, 49.35, 836.5],
			[1000, 1413.55, 1.5333, -328.3, 83.14, 621.1]
		],
		metric: [
			[100, 776.11, 0.1249, -0.21, 1.74, 2732.4],
			[300, 681.46, 0.3999, -42.14, 16.46, 2106.6],
			[500, 593.9, 0.7144, -169.16, 48.72, 1600.1],
			[800, 473.59, 1.28, -581.53, 139.4, 1017.4],
			[1000, 400.14, 1.7395, -1067.36, 237.54, 726.3]
		],
		zeroMoa: 4.1642,
		zeroMrad: 1.2113,
		keyPointsYd: { nearZero: 75, farZero: 100.2, maxApex: { distance: 90, elevation: 0 }, maxDrop: { distance: 1000, drop: -328.3 }, subsonicDist: null },
		keyPointsM: { nearZero: 68.7, farZero: 91.6, maxApex: { distance: 80, elevation: 0.1 }, maxDrop: { distance: 1000, drop: -1067.4 }, subsonicDist: null },
		hotAltitude: [
			[300, 2361.87, 0.3558, -12.24, 3.61, 1734],
			[1000, 1651.54, 1.4192, -290.38, 47.15, 847.8]
		],
		coldMetric: [
			[300, 698.38, 0.395, -41.01, -9.22, 2212.5],
			[1000, 445.34, 1.6503, -982.88, -127.46, 899.7]
		],
		scope600yd: { MOA: [-13.5, 4.1], MRAD: [-3.9, 1.2], IN: [-84.9, 26], FT: [-7.08, 2.16], CM: [-215.8, 65.9], M: [-2.16, 0.66] },
		spinDriftIn: [1.657, 8.119],
		mpbr8in: { optimalZero: 265, nearZero: 27, farZero: 265, mpbrMin: 0, mpbrMax: 312, maxOrdinate: { elevation: 4, distance: 149 }, halfTarget: 4, useMetric: false },
		mpbr20cm: { optimalZero: 241, nearZero: 25, farZero: 241, mpbrMin: 0, mpbrMax: 283.6, maxOrdinate: { elevation: 9.9, distance: 135 }, halfTarget: 10, useMetric: true }
	},
	P338_G7_METRIC: {
		profile: P338_G7_METRIC,
		imperial: [
			[100, 2820.31, 0.1037, 0.03, 0.53, 4415.1],
			[300, 2534.07, 0.3281, -9.58, 4.95, 3564.4],
			[500, 2264.53, 0.5786, -40.95, 14.49, 2846.5],
			[800, 1892.71, 1.0134, -141.28, 40.46, 1988.5],
			[1000, 1663.18, 1.3516, -255.18, 67.45, 1535.4]
		],
		metric: [
			[100, 855.44, 0.1137, 0, 1.46, 5927.9],
			[300, 760.53, 0.3616, -31.91, 13.73, 4685.5],
			[500, 671.78, 0.6415, -132.05, 40.39, 3655.7],
			[800, 550.23, 1.135, -454.19, 114.03, 2452.5],
			[1000, 475.54, 1.526, -825.6, 191.84, 1831.9]
		],
		zeroMoa: 3.8582,
		zeroMrad: 1.12231,
		keyPointsYd: { nearZero: 85.3, farZero: 109.5, maxApex: { distance: 95, elevation: 0 }, maxDrop: { distance: 1000, drop: -255.2 }, subsonicDist: null },
		keyPointsM: { nearZero: 78, farZero: 100.1, maxApex: { distance: 90, elevation: 0.1 }, maxDrop: { distance: 1000, drop: -825.6 }, subsonicDist: null },
		hotAltitude: [
			[300, 2621.43, 0.3226, -9.19, 3.06, 3814.4],
			[1000, 1903.56, 1.2633, -228.81, 39.23, 2011.3]
		],
		coldMetric: [
			[300, 777.78, 0.3576, -31.08, -7.28, 4900.4],
			[1000, 521.34, 1.4578, -767.47, -99.34, 2201.7]
		],
		scope600yd: { MOA: [-10.6, 3.4], MRAD: [-3.1, 1], IN: [-66.4, 21.4], FT: [-5.54, 1.79], CM: [-168.8, 54.5], M: [-1.69, 0.54] },
		spinDriftIn: [1.564, 7.386],
		mpbr8in: { optimalZero: 292, nearZero: 31, farZero: 292, mpbrMin: 0, mpbrMax: 343.4, maxOrdinate: { elevation: 4, distance: 164 }, halfTarget: 4, useMetric: false },
		mpbr20cm: { optimalZero: 265, nearZero: 28, farZero: 265, mpbrMin: 0, mpbrMax: 311.7, maxOrdinate: { elevation: 9.9, distance: 149 }, halfTarget: 10, useMetric: true }
	}
};

const PROFILES = Object.entries(REFERENCE);

function expectImperialRows(trajectory, rows) {
	for (const [distance, velocity, time, drop, windage, energy] of rows) {
		const p = trajectory.find((row) => Math.round(row.distance.In(Unit.Yard)) === distance);
		const at = `${distance} yd`;
		near(p.velocity.In(Unit.FPS), velocity, TOL.fps, `velocity ${at}`);
		near(p.time, time, TOL.time, `time ${at}`);
		near(p.targetDrop.In(Unit.Inch), drop, TOL.inch, `drop ${at}`);
		near(p.windage.In(Unit.Inch), windage, TOL.inch, `windage ${at}`);
		near(p.energy.In(Unit.FootPound), energy, TOL.energy, `energy ${at}`);
	}
}

function expectMetricRows(trajectory, rows) {
	for (const [distance, velocity, time, drop, windage, energy] of rows) {
		const p = trajectory.find((row) => Math.round(row.distance.In(Unit.Meter)) === distance);
		const at = `${distance} m`;
		near(p.velocity.In(Unit.MPS), velocity, TOL.mps, `velocity ${at}`);
		near(p.time, time, TOL.time, `time ${at}`);
		near(p.targetDrop.In(Unit.Centimeter), drop, TOL.cm, `drop ${at}`);
		near(p.windage.In(Unit.Centimeter), windage, TOL.cm, `windage ${at}`);
		near(p.energy.In(Unit.Joule), energy, TOL.energy, `energy ${at}`);
	}
}

const YD_1000 = { distance: 1000, unit: 'yd', step: 100 };
const M_1000 = { distance: 1000, unit: 'm', step: 100 };

describe.each(PROFILES)('trajectory baseline: %s', (_, ref) => {
	it('records drop, wind drift, velocity, time and energy in yd', () => {
		const result = calculateFullTrajectory(ref.profile, YD_1000, null, WIND_10MPH);
		expectImperialRows(result.trajectory, ref.imperial);
	});

	it('records drop, wind drift, velocity, time and energy in m', () => {
		const result = calculateFullTrajectory(ref.profile, M_1000, null, WIND_4MPS);
		expectMetricRows(result.trajectory, ref.metric);
	});

	it('records the zero angle', () => {
		const yd = calculateFullTrajectory(ref.profile, YD_1000, null, WIND_10MPH);
		const m = calculateFullTrajectory(ref.profile, M_1000, null, WIND_4MPS);
		// The muzzle row's trajectory angle is the bore elevation found by the zero search.
		near(yd.trajectory[0].angle.In(Unit.MOA), ref.zeroMoa, TOL.moa, 'zero angle');
		near(m.trajectory[0].angle.In(Unit.MRad), ref.zeroMrad, TOL.mrad, 'zero angle');
	});

	it.each([
		['yd', 'keyPointsYd'],
		['m', 'keyPointsM']
	])('records key trajectory points in %s', (unit, field) => {
		const result = calculateFullTrajectory(ref.profile, { distance: 1000, unit, step: 5 }, null, null);
		const expected = ref[field];
		near(result.nearZero, expected.nearZero, 0.2, 'near zero');
		near(result.farZero, expected.farZero, 0.2, 'far zero');
		near(result.maxApex.distance, expected.maxApex.distance, 5, 'apex distance');
		near(result.maxApex.elevation, expected.maxApex.elevation, 0.1, 'apex elevation');
		near(result.maxDrop.distance, expected.maxDrop.distance, 0.2, 'max drop distance');
		near(result.maxDrop.drop, expected.maxDrop.drop, 0.1, 'max drop');
		if (expected.subsonicDist === null) expect(result.subsonicDist).toBeNull();
		else near(result.subsonicDist, expected.subsonicDist, 0.2, 'subsonic distance');
		near(result.soundSpeedFPS, 1116.45, 0.01, 'speed of sound');
	});

	it('records a hot, high atmosphere with a quartering wind, imperial inputs', () => {
		const wind = { speed: '10', speedUnit: 'mph', direction: '45' };
		const result = calculateFullTrajectory(ref.profile, YD_1000, ATMO_HOT_ALTITUDE, wind);
		expectImperialRows(result.trajectory, ref.hotAltitude);
	});

	it('records a cold, high atmosphere with a quartering wind, metric inputs', () => {
		const wind = { speed: '4', speedUnit: 'mps', direction: '300' };
		const result = calculateFullTrajectory(ref.profile, M_1000, ATMO_COLD_METRIC, wind);
		expectMetricRows(result.trajectory, ref.coldMetric);
	});

	it('records spin drift', () => {
		const range = { distance: 1000, unit: 'yd', step: 500 };
		const result = calculateFullTrajectory({ ...ref.profile, spinDrift: true }, range, null, null);
		const windage = result.trajectory.slice(1).map((p) => p.windage.In(Unit.Inch));
		near(windage[0], ref.spinDriftIn[0], TOL.inch, 'spin drift 500 yd');
		near(windage[1], ref.spinDriftIn[1], TOL.inch, 'spin drift 1000 yd');
	});

	it('records the scope view adjustments in every display unit', () => {
		const point = calculateShotPoint(ref.profile, { distance: 600, unit: 'yd' }, null, WIND_10MPH);
		for (const [unit, [elevation, windage]] of Object.entries(ref.scope600yd)) {
			expect(getElevationValue(point, unit), `elevation ${unit}`).toBeCloseTo(elevation, 6);
			expect(getWindageValue(point, unit), `windage ${unit}`).toBeCloseTo(windage, 6);
		}
	});

	it('gives the same point from the scope view and the full trajectory', () => {
		const point = calculateShotPoint(ref.profile, { distance: 500, unit: 'yd' }, null, WIND_10MPH);
		const row = calculateFullTrajectory(ref.profile, YD_1000, null, WIND_10MPH).trajectory.find(
			(p) => Math.round(p.distance.In(Unit.Yard)) === 500
		);
		near(point.targetDrop.In(Unit.Inch), row.targetDrop.In(Unit.Inch), TOL.inch, 'drop');
		near(point.windage.In(Unit.Inch), row.windage.In(Unit.Inch), TOL.inch, 'windage');
		near(point.velocity.In(Unit.FPS), row.velocity.In(Unit.FPS), TOL.fps, 'velocity');
	});
});

describe('trajectory conventions', () => {
	const at600 = (profile, wind, options) =>
		calculateShotPoint(profile, { distance: 600, unit: 'yd' }, null, wind, options);

	it('keeps windage at zero without wind or spin drift', () => {
		expect(at600(P308_G1, null).windage.In(Unit.Inch)).toBe(0);
	});

	it('mirrors wind from the left and from the right', () => {
		const left = at600(P308_G1, { speed: '10', speedUnit: 'mph', direction: '90' });
		const right = at600(P308_G1, { speed: '10', speedUnit: 'mph', direction: '270' });
		expect(left.windage.In(Unit.Inch)).toBeGreaterThan(0);
		near(left.windage.In(Unit.Inch), -right.windage.In(Unit.Inch), TOL.inch, 'mirrored wind');
	});

	it('drifts a right-hand twist right and a negative twist left', () => {
		const right = at600({ ...P308_G1, spinDrift: true }, null);
		const left = at600({ ...P308_G1, spinDrift: true, barrelTwist: '-10' }, null);
		expect(right.windage.In(Unit.Inch)).toBeGreaterThan(0);
		near(left.windage.In(Unit.Inch), -right.windage.In(Unit.Inch), TOL.inch, 'mirrored spin');
	});

	it('reports below line of sight as negative drop and negative adjustment', () => {
		const point = at600(P308_G1, null);
		expect(point.targetDrop.In(Unit.Inch)).toBeLessThan(0);
		expect(getElevationValue(point, 'MOA')).toBeLessThan(0);
	});

	it('records a 5 degree cant', () => {
		const point = at600(P308_G1, null, { cantAngle: 5 });
		near(point.targetDrop.In(Unit.Inch), -102.3, TOL.inch, 'drop');
		near(point.windage.In(Unit.Inch), 2.01, TOL.inch, 'windage');
	});

	it('leaves velocity unchanged when powder and air temperature are equal', () => {
		const profile = { ...P308_G1, tempSensitivity: true, tempModifier: '1', temperature: '59' };
		const point = calculateShotPoint(profile, { distance: 1, unit: 'yd' }, null, null);
		const plain = calculateShotPoint(P308_G1, { distance: 1, unit: 'yd' }, null, null);
		near(point.velocity.In(Unit.FPS), plain.velocity.In(Unit.FPS), TOL.fps, 'velocity');
	});

	it('raises velocity when the air is warmer than the powder reference', () => {
		// Direction only. The size is tested in the powder sensitivity block below.
		const profile = { ...P308_G1, tempSensitivity: true, tempModifier: '1', temperature: '40' };
		const point = calculateShotPoint(profile, { distance: 1, unit: 'yd' }, null, null);
		const plain = calculateShotPoint(P308_G1, { distance: 1, unit: 'yd' }, null, null);
		expect(point.velocity.In(Unit.FPS)).toBeGreaterThan(plain.velocity.In(Unit.FPS));
	});
});

describe('imperial and metric entry of the same load', () => {
	const rows = (profile) =>
		calculateFullTrajectory(profile, YD_1000, null, WIND_10MPH).trajectory;

	it('agrees when the metric inputs are exact conversions', () => {
		const imperial = rows(P308_G1);
		const metric = rows(P308_G1_METRIC_EXACT);
		expect(metric).toHaveLength(imperial.length);
		imperial.forEach((p, i) => {
			const q = metric[i];
			near(q.velocity.In(Unit.FPS), p.velocity.In(Unit.FPS), 0.001, 'velocity');
			near(q.targetDrop.In(Unit.Inch), p.targetDrop.In(Unit.Inch), 0.001, 'drop');
			near(q.windage.In(Unit.Inch), p.windage.In(Unit.Inch), 0.001, 'windage');
			near(q.time, p.time, 0.00001, 'time');
		});
	});

	it('agrees within input rounding when typed as rounded metric values', () => {
		// 808 m/s is 2650.9 fps, so 1 fps and 0.4 in at 1000 yd is the rounding, not a tolerance
		// on the calculation.
		const imperial = rows(P308_G1);
		const metric = rows(P308_G1_METRIC_ROUNDED);
		imperial.forEach((p, i) => {
			const q = metric[i];
			near(q.velocity.In(Unit.FPS), p.velocity.In(Unit.FPS), 1, 'velocity');
			near(q.targetDrop.In(Unit.Inch), p.targetDrop.In(Unit.Inch), 0.4, 'drop');
			near(q.windage.In(Unit.Inch), p.windage.In(Unit.Inch), 0.1, 'windage');
		});
	});

	it('gives the same MPBR for both entries', () => {
		const { trajectory: a, ...imperial } = calculateMPBR(P308_G1, '8', 'in');
		const { trajectory: b, ...metric } = calculateMPBR(P308_G1_METRIC_EXACT, '8', 'in');
		expect(metric).toEqual(imperial);
		expect(b).toHaveLength(a.length);
	});
});

describe('invalid input', () => {
	const silenced = (fn) => {
		const spy = vi.spyOn(console, 'error').mockImplementation(() => {});
		const result = fn();
		spy.mockRestore();
		return result;
	};
	const shot = (profile, distance = 500, atmosphere = null) =>
		silenced(() => calculateShotPoint(profile, { distance, unit: 'yd' }, atmosphere, null));

	it('returns null for no distance or no BC', () => {
		expect(shot(P308_G1, 0)).toBeNull();
		expect(shot(P308_G1, 'abc')).toBeNull();
		expect(shot({ ...P308_G1, bc: '0' })).toBeNull();
		expect(shot({ ...P308_G1, bc: '' })).toBeNull();
	});

	it('returns null for an impossible atmosphere', () => {
		expect(shot(P308_G1, 500, { ...ATMO_HOT_ALTITUDE, pressure: '0' })).toBeNull();
		expect(shot(P308_G1, 500, { ...ATMO_HOT_ALTITUDE, humidity: '101' })).toBeNull();
		expect(shot(P308_G1, 500, { ...ATMO_HOT_ALTITUDE, temperature: 'x' })).toBeNull();
	});

	it('limits the full trajectory to 3000 units', () => {
		const range = { distance: 3001, unit: 'yd', step: 100 };
		expect(calculateFullTrajectory(P308_G1, range, null, null)).toBeNull();
	});

	it('returns null from the display helpers for no point or an unknown unit', () => {
		const point = calculateShotPoint(P308_G1, { distance: 500, unit: 'yd' }, null, null);
		expect(getElevationValue(null, 'MOA')).toBeNull();
		expect(getWindageValue(null, 'MOA')).toBeNull();
		expect(getElevationValue(point, 'NOPE')).toBeNull();
		expect(getWindageValue(point, 'NOPE')).toBeNull();
	});

	it('returns null from MPBR for no target or no profile', () => {
		expect(calculateMPBR(P308_G1, '0', 'in')).toBeNull();
		expect(calculateMPBR(P308_G1, '', 'in')).toBeNull();
		expect(calculateMPBR(null, '8', 'in')).toBeNull();
	});
});

describe.each(PROFILES)('MPBR baseline: %s', (_, ref) => {
	const expectMpbr = (result, expected) => {
		const { trajectory, ...values } = result;
		expect(values).toEqual(expected);
		expect(trajectory.length).toBeGreaterThan(0);
	};

	it('records an 8 in target', { timeout: 30000 }, () => {
		expectMpbr(calculateMPBR(ref.profile, '8', 'in'), ref.mpbr8in);
	});

	it('records a 20 cm target', { timeout: 30000 }, () => {
		expectMpbr(calculateMPBR(ref.profile, '20', 'cm'), ref.mpbr20cm);
	});
});

describe('MPBR behaviour', () => {
	it('keeps the chart trajectory inside the target between near zero and MPBR', { timeout: 30000 }, () => {
		const result = calculateMPBR(P308_G1, '8', 'in');
		const inside = result.trajectory.filter((p) => {
			const d = p.distance.In(Unit.Yard);
			return d >= result.mpbrMin && d <= result.mpbrMax;
		});
		expect(inside.length).toBeGreaterThan(10);
		for (const p of inside) {
			expect(Math.abs(p.targetDrop.In(Unit.Inch))).toBeLessThanOrEqual(result.halfTarget + 0.01);
		}
	});

	it('is not affected by the spin drift setting', { timeout: 30000 }, () => {
		const { trajectory: a, ...plain } = calculateMPBR(P308_G1, '8', 'in');
		const { trajectory: b, ...spin } = calculateMPBR({ ...P308_G1, spinDrift: true }, '8', 'in');
		expect(spin).toEqual(plain);
		expect(b).toHaveLength(a.length);
	});
});

describe('trajectory validation baseline', () => {
	/**
	 * Solved values are exact: the search runs on a fixed ladder of steps and rounds its
	 * output. Observed drop and adjustment are those of the shot at the rounded value, in the
	 * unit asked for, so they sit within about one step of the goal, not on it.
	 */
	it.each([
		['velocity from inches, yd', P308_G1, { distance: 600, unit: 'yd' }, 'distance', '110', 'in', 'velocity', null, 2567, 0.462, -110.091],
		['velocity from angle in mrad, yd', P65_G7, { distance: 800, unit: 'yd' }, 'angle', '6.5', 'mrad', 'velocity', null, 2660, 0.305, -6.55],
		['BC from inches, yd', P223_G1, { distance: 500, unit: 'yd' }, 'distance', '75', 'in', 'bc', null, 3240, 0.172, -75.425],
		['BC from angle in MOA, yd', P308_G1, { distance: 600, unit: 'yd' }, 'angle', '17.5', 'moa', 'bc', null, 2650, 0.399, -17.542],
		['velocity from cm, metric profile', P338_G7_METRIC, { distance: 1000, unit: 'm' }, 'distance', '750', 'cm', 'velocity', null, 943, 0.322, -747.988],
		['BC from angle in mrad, metric profile', P338_G7_METRIC, { distance: 1000, unit: 'm' }, 'angle', '7.9', 'mrad', 'bc', null, 905, 0.347, -7.911],
		['velocity in a custom atmosphere', P308_G1, { distance: 600, unit: 'yd' }, 'distance', '110', 'in', 'velocity', ATMO_HOT_ALTITUDE, 2464, 0.462, -109.965],
		['BC in a custom metric atmosphere', P338_G7_METRIC, { distance: 800, unit: 'm' }, 'angle', '5', 'mrad', 'bc', ATMO_COLD_METRIC, 905, 0.397, -4.994]
	])('records %s', (_, profile, range, measureType, value, unit, solveFor, atmosphere, velocity, bc, measured) => {
		const result = calculateTrajectoryValidation(profile, range, measureType, value, unit, solveFor, atmosphere);
		expect(result.validatedVelocity).toBe(velocity);
		expect(result.validatedBc).toBe(bc);
		const point = result.validatedPoint;
		const actual =
			measureType === 'distance'
				? point.targetDrop.In(unit === 'cm' ? Unit.Centimeter : Unit.Inch)
				: point.dropAdjustment.In(unit === 'mrad' ? Unit.MRad : Unit.MOA);
		near(actual, measured, 0.01, 'validated point');
	});

	it('recovers a known velocity from the drop it produces', () => {
		const range = { distance: 800, unit: 'yd' };
		const drop = calculateShotPoint(P308_G1, range, null, null).targetDrop.In(Unit.Inch);
		const wrong = { ...P308_G1, velocity: '2750' };
		const result = calculateTrajectoryValidation(wrong, range, 'distance', Math.abs(drop), 'in', 'velocity');
		near(result.validatedVelocity, 2650, 2, 'validated velocity');
	});

	it('recovers a known BC from the drop it produces', () => {
		const range = { distance: 800, unit: 'yd' };
		const drop = calculateShotPoint(P308_G1, range, null, null).targetDrop.In(Unit.Inch);
		const wrong = { ...P308_G1, bc: '0.52' };
		const result = calculateTrajectoryValidation(wrong, range, 'distance', Math.abs(drop), 'in', 'bc');
		near(result.validatedBc, 0.462, 0.002, 'validated BC');
	});

	it('takes a positive or a negative observed value alike', () => {
		const range = { distance: 600, unit: 'yd' };
		const a = calculateTrajectoryValidation(P308_G1, range, 'distance', '110', 'in', 'velocity');
		const b = calculateTrajectoryValidation(P308_G1, range, 'distance', '-110', 'in', 'velocity');
		expect(b.validatedVelocity).toBe(a.validatedVelocity);
	});

	it('leaves the input unchanged when the first shot already matches', () => {
		const range = { distance: 600, unit: 'yd' };
		const result = calculateTrajectoryValidation(P308_G1, range, 'distance', '102.2', 'in', 'velocity');
		expect(result.validatedVelocity).toBe(2650);
	});

	it('rejects ranges under 100, an empty measure and a bad profile', () => {
		const range = { distance: 600, unit: 'yd' };
		const run = (r, value, profile = P308_G1) =>
			calculateTrajectoryValidation(profile, r, 'distance', value, 'in', 'velocity');
		expect(run({ distance: 99, unit: 'yd' }, '10')).toBeNull();
		expect(run(range, '0')).toBeNull();
		expect(run(range, 'x')).toBeNull();
		expect(run(range, '10', { ...P308_G1, velocity: '0' })).toBeNull();
		expect(run(range, '10', { ...P308_G1, bc: '0' })).toBeNull();
		expect(run(range, '10', { ...P308_G1, zeroDist: 0 })).toBeNull();
	});

	it('rejects a range that does not exceed the zero, across units', () => {
		const run = (profile, range) =>
			calculateTrajectoryValidation(profile, range, 'distance', '10', 'in', 'velocity');
		const zero200 = { ...P308_G1, zeroDist: 200 };
		expect(run(zero200, { distance: 200, unit: 'yd' })).toEqual({ error: 'range' });
		expect(run(zero200, { distance: 180, unit: 'm' })).toEqual({ error: 'range' });
		expect(run(zero200, { distance: 190, unit: 'm' }).error).toBeUndefined();
	});

	it('reports no solution when no BC in range can reach the goal', () => {
		const range = { distance: 600, unit: 'yd' };
		const run = (value) => calculateTrajectoryValidation(P308_G1, range, 'distance', value, 'in', 'bc');
		expect(run('1')).toEqual({ error: 'no_solution' });
		expect(run('99999')).toEqual({ error: 'no_solution' });
	});
});

/** Height of a shot relative to the line of sight, in the unit of the measure. */
function measured(point, measureType, unit) {
	const units = { in: Unit.Inch, cm: Unit.Centimeter, moa: Unit.MOA, mrad: Unit.MRad };
	const value = measureType === 'distance' ? point.targetDrop : point.dropAdjustment;
	return value.In(units[unit]);
}

/**
 * Failed shots are part of these searches and calculateShotPoint logs each one. Every search
 * here stays inside the velocity and BC bounds, where the library always returns: see the
 * guard tests under powder sensitivity for what happens outside them.
 */
function silenceShotErrors() {
	beforeEach(() => {
		vi.spyOn(console, 'error').mockImplementation(() => {});
	});
	afterEach(() => {
		vi.restoreAllMocks();
	});
}

describe('trajectory validation above the line of sight (#82)', () => {
	silenceShotErrors();
	const yd100 = { distance: 100, unit: 'yd' };
	const solve = (profile, range, measureType, value, unit, solveFor, direction) =>
		calculateTrajectoryValidation(profile, range, measureType, value, unit, solveFor, null, direction);

	it('solves 3 in above on the default profile', () => {
		const result = solve(P223_SHORT_ZERO, yd100, 'distance', '3', 'in', 'velocity', 'above');
		expect(result.error).toBeUndefined();
		expect(result.validatedVelocity).toBeGreaterThan(1200);
		expect(result.validatedVelocity).toBeLessThan(1500);
		near(result.validatedPoint.targetDrop.In(Unit.Inch), 3, 0.05, 'height at the solved velocity');
	});

	it('still reads 3 in below as below, and says the bullet is above there', () => {
		const result = solve(P223_SHORT_ZERO, yd100, 'distance', '3', 'in', 'velocity', 'below');
		near(result.validatedVelocity, 1016, 2, 'velocity');
		near(result.validatedPoint.targetDrop.In(Unit.Inch), -3, 0.05, 'drop at the solved velocity');
		expect(result.suggestAbove).toBe(true);
	});

	/** Solve a goal taken from a real shot, from a profile that is deliberately off. */
	it.each([
		['velocity', 'distance', 'in', '1800', 8],
		['velocity', 'distance', 'cm', '1800', 20],
		['velocity', 'angle', 'moa', '1800', 8],
		['velocity', 'angle', 'mrad', '1800', 8],
		['bc', 'distance', 'in', '0.05', 0.01],
		['bc', 'distance', 'cm', '0.05', 0.01],
		['bc', 'angle', 'moa', '0.05', 0.01],
		['bc', 'angle', 'mrad', '0.05', 0.01]
	])('recovers a known %s from a %s above in %s', (solveFor, measureType, unit, truth, tolerance) => {
		const key = solveFor === 'velocity' ? 'velocity' : 'bc';
		const shot = calculateShotPoint({ ...P223_SHORT_ZERO, [key]: truth }, yd100, null, null);
		const value = measured(shot, measureType, unit);
		expect(value, 'the shot is above the line of sight').toBeGreaterThan(0);

		const result = solve(P223_SHORT_ZERO, yd100, measureType, value, unit, solveFor, 'above');
		const solved = solveFor === 'velocity' ? result.validatedVelocity : result.validatedBc;
		// The measure is rounded to 0.1, and the curve flattens as velocity and BC rise.
		near(solved, parseFloat(truth), solveFor === 'velocity' ? 30 : tolerance, 'solved value');
		near(measured(result.validatedPoint, measureType, unit), value, 0.15, 'height at the solved value');
		expect(measured(result.validatedPoint, measureType, unit)).toBeGreaterThan(0);
	});

	it('gives dropAdjustment the sign of targetDrop on both sides of the line of sight', () => {
		const high = calculateShotPoint(P223_SHORT_ZERO, yd100, null, null);
		const low = calculateShotPoint({ ...P223_SHORT_ZERO, velocity: '1000' }, yd100, null, null);
		expect(high.targetDrop.In(Unit.Inch)).toBeGreaterThan(0);
		expect(high.dropAdjustment.In(Unit.MOA)).toBeGreaterThan(0);
		expect(low.targetDrop.In(Unit.Inch)).toBeLessThan(0);
		expect(low.dropAdjustment.In(Unit.MOA)).toBeLessThan(0);
	});

	/** The search relies on this order, and on a short zero the zero angle moves with it. */
	it.each([
		['velocity', 'velocity', [70, 100, 200, 400, 700, 1000, 1200, 1500, 2000, 3000, 5000, 9900]],
		['BC', 'bc', [0.011, 0.02, 0.05, 0.1, 0.2, 0.285, 0.5, 1, 1.9]]
	])('height at range rises with %s inside a short zero', (_, key, values) => {
		const heights = values.map((value) =>
			calculateShotPoint({ ...P223_SHORT_ZERO, [key]: String(value) }, yd100, null, null).targetDrop.In(Unit.Inch)
		);
		expect(heights).toEqual([...heights].sort((a, b) => a - b));
	});

	it('reports no solution above the highest the bullet can be', () => {
		// As velocity and BC grow the height tends to about 10.5 in and 8.9 in here.
		expect(solve(P223_SHORT_ZERO, yd100, 'distance', '12', 'in', 'velocity', 'above').error).toBe('no_solution');
		expect(solve(P223_SHORT_ZERO, yd100, 'distance', '9.5', 'in', 'bc', 'above').error).toBe('no_solution');
	});

	it('takes a positive or a negative observed value alike when above', () => {
		const a = solve(P223_SHORT_ZERO, yd100, 'distance', '3', 'in', 'velocity', 'above');
		const b = solve(P223_SHORT_ZERO, yd100, 'distance', '-3', 'in', 'velocity', 'above');
		expect(b.validatedVelocity).toBe(a.validatedVelocity);
	});

	it('does not change anything for a range beyond the far zero crossing', () => {
		const range = { distance: 600, unit: 'yd' };
		const plain = calculateTrajectoryValidation(P223_SHORT_ZERO, range, 'distance', '40', 'in', 'velocity');
		const below = solve(P223_SHORT_ZERO, range, 'distance', '40', 'in', 'velocity', 'below');
		expect(below.validatedVelocity).toBe(plain.validatedVelocity);
		expect(below.validatedVelocity).toBe(3002);
		expect(below.suggestAbove).toBe(false);
	});

	it('suggests above only for a below goal on a bullet that is above', () => {
		const suggest = (range, value, direction) =>
			solve(P223_SHORT_ZERO, range, 'distance', value, 'in', 'velocity', direction).suggestAbove;
		expect(suggest(yd100, '3', 'above')).toBe(false);
		expect(suggest({ distance: 600, unit: 'yd' }, '30', 'below')).toBe(false);
		expect(suggest(yd100, '3', 'below')).toBe(true);
	});

	it('still suggests above when the below goal has no solution', () => {
		const result = solve(P223_SHORT_ZERO, yd100, 'distance', '99999', 'in', 'velocity', 'below');
		expect(result).toEqual({ error: 'no_solution', suggestAbove: true });
	});
});

describe('trajectory validation failures (#83)', () => {
	silenceShotErrors();
	const yd600 = { distance: 600, unit: 'yd' };
	const solve = (profile, value, solveFor, direction = 'below', range = yd600) =>
		calculateTrajectoryValidation(profile, range, 'distance', value, 'in', solveFor, null, direction);

	it('reports an unreachable goal instead of the last good shot', () => {
		expect(solve(P223_SHORT_ZERO, '100000', 'velocity')).toEqual({ error: 'no_solution' });
		expect(solve(P223_SHORT_ZERO, '100000', 'bc')).toEqual({ error: 'no_solution' });
		expect(solve(P308_G1, '100000', 'velocity')).toEqual({ error: 'no_solution' });
	});

	it('reports a goal past the fastest velocity', () => {
		expect(solve(P223_SHORT_ZERO, '500', 'velocity', 'above')).toEqual({ error: 'no_solution' });
	});

	it('reports a profile whose own shot fails', () => {
		const slow = { ...P308_G1, velocity: '60' };
		expect(calculateShotPoint(slow, yd600, null, null)).toBeNull();
		expect(solve(slow, '100', 'velocity')).toEqual({ error: 'no_solution' });
	});

	it('reports a search that runs into the powder sensitivity guard', () => {
		// 39 °F profile in 59 °F air takes 2000 fps off, so the guard fails shots under about 2050.
		const profile = { ...P308_G1, tempSensitivity: true, tempModifier: '-100', temperature: '39' };
		const firing = vi.spyOn(Calculator.prototype, 'fire');
		expect(solve(profile, '100000', 'velocity')).toEqual({ error: 'no_solution' });
		expect(firing.mock.calls.length).toBeGreaterThan(0);
	});

	it('finds a goal that lies between the last good shot and a failed one', () => {
		// The ladder goes 3000, 2900, ... 300, then fails at 200, and the answer is past 300.
		const shot = calculateShotPoint({ ...P223_SHORT_ZERO, velocity: '250' }, yd600, null, null);
		const drop = Math.abs(shot.targetDrop.In(Unit.Inch));
		const result = solve(P223_SHORT_ZERO, drop, 'velocity');
		expect(calculateShotPoint({ ...P223_SHORT_ZERO, velocity: '200' }, yd600, null, null)).toBeNull();
		near(result.validatedVelocity, 250, 1, 'velocity');
	});

	it('finds a goal that lies between the last good shot and the lower bound', () => {
		// The ladder goes 0.285, 0.185, 0.085, then -0.015 is out of bounds.
		const shot = calculateShotPoint({ ...P223_SHORT_ZERO, bc: '0.05' }, yd600, null, null);
		const result = solve(P223_SHORT_ZERO, Math.abs(shot.targetDrop.In(Unit.Inch)), 'bc');
		near(result.validatedBc, 0.05, 0.001, 'BC');
	});

	it('accepts a goal the search can only reach to within its last step', () => {
		// 1 fps moves the drop by over 0.1 in here, so no shot measures exactly 110.0.
		const result = solve(P308_G1, '110', 'velocity');
		expect(result.error).toBeUndefined();
		near(result.validatedPoint.targetDrop.In(Unit.Inch), -110, 0.5, 'drop');
	});

	it.each([
		['velocity', P308_G1, yd600, 'distance', '110', 'in', 'below'],
		['velocity', P338_G7_METRIC, { distance: 1000, unit: 'm' }, 'distance', '750', 'cm', 'below'],
		['velocity', P223_SHORT_ZERO, { distance: 100, unit: 'yd' }, 'distance', '3', 'in', 'above'],
		['velocity', { ...P308_G1, velocity: '2650.4' }, yd600, 'distance', '102.2', 'in', 'below'],
		['bc', P223_G1, { distance: 500, unit: 'yd' }, 'distance', '75', 'in', 'below'],
		['bc', P308_G1, yd600, 'angle', '17.5', 'moa', 'below'],
		['bc', P223_SHORT_ZERO, { distance: 100, unit: 'yd' }, 'angle', '7', 'moa', 'above']
	])('returns the point of the returned %s', (solveFor, profile, range, measureType, value, unit, direction) => {
		const result = calculateTrajectoryValidation(profile, range, measureType, value, unit, solveFor, null, direction);
		const solved =
			solveFor === 'velocity'
				? { ...profile, velocity: String(result.validatedVelocity) }
				: { ...profile, bc: String(result.validatedBc) };
		const shot = calculateShotPoint(solved, range, null, null);
		expect(result.validatedPoint.targetDrop.In(Unit.Inch)).toBe(shot.targetDrop.In(Unit.Inch));
		expect(result.validatedPoint.velocity.In(Unit.FPS)).toBe(shot.velocity.In(Unit.FPS));
	});

	it('stops within a bounded number of shots on the longest walk', () => {
		const firing = vi.spyOn(Calculator.prototype, 'fire');
		solve({ ...P223_SHORT_ZERO, velocity: '60' }, '10', 'velocity', 'above', { distance: 100, unit: 'yd' });
		expect(firing.mock.calls.length).toBeLessThanOrEqual(200 + 1);
		expect(firing.mock.calls.length).toBeGreaterThan(50);
	});
});

/**
 * The profile setting is fps per degree of the profile's temperature unit (#81), measured from
 * the profile temperature to the air temperature. The ICAO atmosphere used here is 59 °F, 15 °C.
 * The first table row is the muzzle, so these read the velocity change itself, before any drag.
 */
describe('powder sensitivity', () => {
	const muzzleFps = (profile, atmosphere = null) =>
		calculateFullTrajectory(profile, { distance: 100, unit: 'yd', step: 100 }, atmosphere, null)
			.trajectory[0].velocity.In(Unit.FPS);
	const sensitive = (profile, tempModifier, temperature, temperatureUnit = 'f') => ({
		...profile,
		tempSensitivity: true,
		tempModifier,
		temperature,
		temperatureUnit
	});

	it.each([1000, 2650, 3200])('gives +20 fps for 1 fps/°F over 20 °F at %i fps', (fps) => {
		const plain = { ...P308_G1, velocity: String(fps) };
		near(muzzleFps(sensitive(plain, '1', '39')) - fps, 20, 0.001, 'velocity change');
	});

	it.each([1000, 2650, 3200])('gives +11.1 fps for 1 fps/°C over 11.1 °C at %i fps', (fps) => {
		const plain = { ...P308_G1, velocity: String(fps) };
		near(muzzleFps(sensitive(plain, '1', '3.9', 'c')) - fps, 11.1, 0.001, 'velocity change');
	});

	it('scales with the entered value and lowers velocity in colder air', () => {
		near(muzzleFps(sensitive(P308_G1, '1.5', '39')) - 2650, 30, 0.001, 'warmer air');
		near(muzzleFps(sensitive(P308_G1, '1', '79')) - 2650, -20, 0.001, 'colder air');
	});

	it('accepts a negative value, for a load that slows down when warm', () => {
		near(muzzleFps(sensitive(P308_G1, '-1', '39')) - 2650, -20, 0.001, 'velocity change');
	});

	it('keeps the value in fps per degree when the velocity is entered in m/s', () => {
		const expected = (change) => 807.72 * 3.2808399 + change;
		near(muzzleFps(sensitive(P308_G1_METRIC_EXACT, '1', '39')), expected(20), 0.001, '°F profile');
		near(muzzleFps(sensitive(P308_G1_METRIC_EXACT, '1', '3.9', 'c')), expected(11.1), 0.001, '°C profile');
	});

	it('measures to the air temperature, whatever unit the atmosphere uses', () => {
		const celsiusAir = { ...ATMO_HOT_ALTITUDE, temperature: '25', temperatureUnit: 'c' };
		near(muzzleFps(sensitive(P308_G1, '1', '59'), celsiusAir) - 2650, 18, 0.001, '°F profile, °C air');
		near(muzzleFps(sensitive(P308_G1, '1', '15', 'c'), ATMO_HOT_ALTITUDE) - 2650, 14.4444, 0.001, '°C profile, °F air');
	});

	it('flies like the same load entered 20 fps faster, in both calculator paths', () => {
		const faster = { ...P308_G1, velocity: '2670' };
		const hot = sensitive(P308_G1, '1', '39');
		const range = { distance: 1000, unit: 'yd' };
		const shot = calculateShotPoint(hot, range, null, null);
		const reference = calculateShotPoint(faster, range, null, null);
		near(shot.velocity.In(Unit.FPS), reference.velocity.In(Unit.FPS), 0.001, 'shot velocity');
		near(shot.targetDrop.In(Unit.Inch), reference.targetDrop.In(Unit.Inch), 0.001, 'shot drop');

		const rows = calculateFullTrajectory(hot, YD_1000, null, null).trajectory;
		const fasterRows = calculateFullTrajectory(faster, YD_1000, null, null).trajectory;
		expect(rows).toHaveLength(fasterRows.length);
		rows.forEach((p, i) => {
			near(p.velocity.In(Unit.FPS), fasterRows[i].velocity.In(Unit.FPS), 0.001, 'row velocity');
			near(p.targetDrop.In(Unit.Inch), fasterRows[i].targetDrop.In(Unit.Inch), 0.001, 'row drop');
		});
	});

	/**
	 * At these velocities the library's loop can run forever, and a test timeout cannot stop
	 * synchronous code. So the solver entry point is stubbed: without the guard these tests
	 * fail on the spy instead of stalling the run.
	 */
	describe('when the velocity at the air temperature is unusable', () => {
		const range = { distance: 100, unit: 'yd', step: 100 };
		const paths = [
			['calculateShotPoint', calculateShotPoint],
			['calculateFullTrajectory', calculateFullTrajectory]
		];
		/** Run a path with the solver stubbed; returns its result and whether it got there. */
		function guarded(calculate, profile) {
			const solver = vi.spyOn(Calculator.prototype, 'setWeaponZero').mockImplementation(() => {
				throw new Error('reached the solver');
			});
			const log = vi.spyOn(console, 'error').mockImplementation(() => {});
			const result = calculate(profile, range, null, null);
			const reachedSolver = solver.mock.calls.length > 0;
			solver.mockRestore();
			log.mockRestore();
			return { result, reachedSolver };
		}

		describe.each(paths)('%s', (_, calculate) => {
			it.each([
				['1000', '-50', 'exactly 0'],
				['3000', '-150', 'exactly 0'],
				['2650', '-132.5', 'exactly 0'],
				['1e-300', '1e10', 'NaN'],
				['2650', '1e308', 'infinite'],
				['2650', '-200', 'negative'],
				['2650', '-130.005', 'just under the 50 fps minimum']
			])('returns null for %s fps with %s fps/°F (%s)', (velocity, tempModifier) => {
				const profile = sensitive({ ...P308_G1, velocity }, tempModifier, '39');
				expect(guarded(calculate, profile)).toEqual({ result: null, reachedSolver: false });
			});

			it('lets a velocity just over the minimum through to the solver', () => {
				const profile = sensitive(P308_G1, '-129.995', '39');
				expect(guarded(calculate, profile).reachedSolver).toBe(true);
			});
		});

		it('keeps a slow load that the solver can zero', () => {
			const slow = sensitive(P308_G1, '-125', '39');
			near(muzzleFps(slow), 150, 0.001, 'velocity');
			expect(calculateShotPoint(slow, range, null, null)).not.toBeNull();
		});
	});

	it('is off when the toggle is off or the value is empty', () => {
		near(muzzleFps({ ...sensitive(P308_G1, '1', '39'), tempSensitivity: false }), 2650, 0.001, 'toggle off');
		near(muzzleFps(sensitive(P308_G1, '', '39')), 2650, 0.001, 'empty value');
	});
});

/**
 * Atmo divides humidity above 1 by 100 and reads the rest as a fraction, so a percentage of
 * 1 or less used to be taken for a fraction: 1 % gave the same result as 100 % (#84).
 *
 * Every case here is the P308_G1 hotAltitude shot of the baseline with only the humidity
 * changed, which moves air density by under 2 %, so none of them can stall the run.
 */
describe('humidity', () => {
	const atmosphere = (humidity) => ({ ...ATMO_HOT_ALTITUDE, humidity });
	const shotPoint = (humidity) =>
		calculateShotPoint(P308_G1, { distance: 1000, unit: 'yd' }, atmosphere(humidity), null);
	const lastRow = (humidity) =>
		calculateFullTrajectory(P308_G1, YD_1000, atmosphere(humidity), null).trajectory.at(-1);
	const fps = (point) => point.velocity.In(Unit.FPS);

	/** [humidity, velocity fps, drop in] at 1000 yd. 0 %, 2 % and 100 % predate the fix (#84). */
	const RECORDED = [
		['0', 1355.823, -359.676],
		['0.5', 1355.908, -359.656],
		['1', 1355.993, -359.635],
		['2', 1356.163, -359.593],
		['100', 1373.025, -355.559]
	];

	it.each(RECORDED)('gives the recorded result on both paths at humidity %s', (humidity, velocity, drop) => {
		for (const point of [shotPoint(humidity), lastRow(humidity)]) {
			near(fps(point), velocity, TOL.fps, `${humidity} % velocity`);
			near(point.height.In(Unit.Inch), drop, TOL.inch, `${humidity} % drop`);
		}
	});

	it.each([
		['shot point', shotPoint],
		['full trajectory', lastRow]
	])('has no jump at 1 % in the %s', (_, point) => {
		const at = (humidity) => fps(point(humidity));
		expect(at('0')).toBeLessThan(at('0.5'));
		expect(at('0.5')).toBeLessThan(at('1'));
		expect(at('1')).toBeLessThan(at('2'));
		expect(at('2')).toBeLessThan(at('100'));
		// 1 % sits next to the values on either side of the library's branch, far from 100 %.
		near(at('1'), at('1.0001'), 0.001, '1 % against just above 1 %');
		near(at('0.5'), at('2'), 0.5, '0.5 % against 2 %');
		expect(at('100') - at('1')).toBeGreaterThan(10);
	});
});

/**
 * The apex comes from a fine fire of its own, not from the table rows (#85).
 *
 * Tolerance against a step 1 calculation, as in calculateFullTrajectory: 1 distance unit and
 * 0.05 in or cm. The recorded values below were read from step 1 rows.
 *
 * Every case is an ordinary load at an ordinary range, with a velocity the solver can work with
 * and a step of at least 1, like the baseline above, so none can stall the run.
 */
describe('max apex (#85)', () => {
	const ZERO_200 = { ...P308_G1, zeroDist: 200 };
	const STEPS = [1, 5, 7, 25, 100, 250, 300, 1000];

	/** [name, profile, apex in yd and in, apex in m and cm] */
	const LOADS = [
		['the load of the issue', ZERO_200, { distance: 115, elevation: 2.2 }, { distance: 106, elevation: 5.6 }],
		['a short zero', P223_SHORT_ZERO, { distance: 266, elevation: 17.7 }, { distance: 243, elevation: 45.1 }],
		['a tiny arc past the zero', P223_G1, { distance: 112, elevation: 0 }, { distance: 103, elevation: 0.1 }],
		['metric inputs', P338_G7_METRIC, { distance: 97, elevation: 0 }, { distance: 89, elevation: 0.1 }]
	];
	const BY_UNIT = LOADS.flatMap(([name, profile, yd, m]) => [
		[name, 'yd', profile, yd],
		[name, 'm', profile, m]
	]);

	const apex = (profile, unit, step, distance = 1000, atmosphere = null, wind = null) =>
		calculateFullTrajectory(profile, { distance, unit, step }, atmosphere, wind).maxApex;

	/** The highest row of a step 1 table inside the range, unrounded. */
	function step1Top(profile, unit, distance = 1000, atmosphere = null, wind = null) {
		const distanceUnit = unit === 'm' ? Unit.Meter : Unit.Yard;
		const heightUnit = unit === 'm' ? Unit.Centimeter : Unit.Inch;
		const rows = calculateFullTrajectory(profile, { distance, unit, step: 1 }, atmosphere, wind)
			.chartPoints.map((p) => ({ distance: p.distance.In(distanceUnit), elevation: p.targetDrop.In(heightUnit) }))
			.filter((p) => p.distance <= distance);
		return rows.reduce((top, p) => (p.elevation > top.elevation ? p : top));
	}

	function expectStep1Match(actual, top) {
		near(actual.distance, top.distance, 1, 'apex distance');
		near(actual.elevation, top.elevation, 0.05, 'apex elevation');
	}

	it.each(BY_UNIT)('gives the same apex at every step for %s in %s', (_, unit, profile, recorded) => {
		const first = apex(profile, unit, STEPS[0]);
		near(first.distance, recorded.distance, 1, 'recorded distance');
		near(first.elevation, recorded.elevation, 0.1, 'recorded elevation');
		for (const step of STEPS) expect(apex(profile, unit, step), `step ${step}`).toEqual(first);
	});

	it.each(BY_UNIT)('matches a step 1 calculation for %s in %s', (_, unit, profile) => {
		const top = step1Top(profile, unit);
		for (const step of STEPS) expectStep1Match(apex(profile, unit, step), top);
	});

	it('fixes the values of the issue', () => {
		// Before: 2.2 in at 125 yd, 2.1 in at 100 yd and 0 in at 27 yd.
		const expected = { distance: 115, elevation: 2.2 };
		for (const step of [25, 100, 250]) expect(apex(ZERO_200, 'yd', step)).toEqual(expected);
	});

	it('flies the same shot as the table, with its air and wind', () => {
		const wind = { speed: '10', speedUnit: 'mph', direction: '45' };
		const top = step1Top(ZERO_200, 'yd', 1000, ATMO_HOT_ALTITUDE, wind);
		// Thin air needs less elevation to reach the zero, by more than the tolerance.
		expect(top.elevation).toBeLessThan(step1Top(ZERO_200, 'yd').elevation - 0.05);
		for (const step of [25, 250]) {
			expectStep1Match(apex(ZERO_200, 'yd', step, 1000, ATMO_HOT_ALTITUDE, wind), top);
		}
	});

	it.each([
		['yd', 20],
		['m', 18]
	])('is null at every step for a shot that stays below the line of sight, in %s', (unit, distance) => {
		// Near zero is 27 yd. Flagged rows past the range used to give 0 at the near zero.
		for (const step of STEPS) expect(apex(ZERO_200, unit, step, distance), `step ${step}`).toBeNull();
	});

	it('stays inside the range when the bullet is still rising there', () => {
		// The top is at 115 yd. Rows past the range used to give 2.1 in at 100 yd.
		const expected = { distance: 50, elevation: 1 };
		for (const step of STEPS) expect(apex(ZERO_200, 'yd', step, 50), `step ${step}`).toEqual(expected);
	});

	it.each([[50.5], [1000.5], [333.3]])('does not depend on the step for a range of %s', (distance) => {
		const first = apex(ZERO_200, 'yd', 1, distance);
		for (const step of STEPS) expect(apex(ZERO_200, 'yd', step, distance), `step ${step}`).toEqual(first);
		expectStep1Match(first, step1Top(ZERO_200, 'yd', distance));
	});

	it('ends the fine fire on a fractional range, not past it', () => {
		// Going further could fail on a bullet that stops just past the range.
		const firing = vi.spyOn(Calculator.prototype, 'fire');
		apex(ZERO_200, 'yd', 25, 50.5);
		const lastRow = firing.mock.results[1].value.trajectory.at(-1);
		firing.mockRestore();
		near(lastRow.distance.In(Unit.Yard), 50.5, 0.01, 'last fine row');
	});

	it('keeps an arc narrower than one unit', () => {
		// Zeroed near the tangent point: near zero 111.2 yd, far zero 111.9 yd.
		const profile = { ...P223_G1, zeroDist: 111 };
		const result = calculateFullTrajectory(profile, { distance: 400, unit: 'yd', step: 25 }, null, null);
		expect(result.farZero - result.nearZero).toBeLessThan(1);
		near(result.maxApex.distance, 111.5, 1, 'apex distance');
		expect(result.maxApex.elevation).toBe(0);
	});

	it('fires once more, and only as far as the far zero', () => {
		const firing = vi.spyOn(Calculator.prototype, 'fire');
		apex(ZERO_200, 'yd', 25);
		const ranges = firing.mock.calls.map(([options]) => options.trajectoryRange.In(Unit.Yard));
		firing.mockRestore();
		expect(ranges).toHaveLength(2);
		expect(ranges[0]).toBe(1000);
		near(ranges[1], 200.2, 0.2, 'fine fire range');
	});
});

/**
 * The search solves for the arc whose apex touches the top of the zone (#86). The tests here
 * check it from the outside, against a walk over zero distances that shares no code with it.
 *
 * Tolerance, as in calculateMPBR: mpbrMax is at most 1 distance unit under the best any zero can
 * give, the cost of a whole unit zero, and at most 0.1 over it, the rounding of the output.
 * Measured gap on 19 cases of 3 loads: 0.69 yd at most.
 *
 * Every case has a velocity and BC the solver can work with, or stubs the solver, so none can
 * stall the run.
 */
describe('MPBR search (#86)', () => {
	/**
	 * The longest range of any zero on a walk over zero distances, near and far crossings alike,
	 * in yd. Rows are step 1, the exit is read between two rows, and a zero is skipped when any
	 * row rises over the top of the zone.
	 */
	function bruteForceMpbr(profile, targetInches, zeros, range) {
		const half = targetInches / 2;
		const weapon = new Weapon({ sightHeight: UNew.Inch(parseFloat(profile.opticHeight)) });
		const dm = new DragModel({
			bc: parseFloat(profile.bc),
			dragTable: Table.G1,
			weight: UNew.Grain(parseFloat(profile.bulletWeight)),
			diameter: UNew.Inch(parseFloat(profile.bulletDiameter)),
			length: UNew.Inch(2)
		});
		const ammo = new Ammo({ dm, mv: UNew.FPS(parseFloat(profile.velocity)) });
		let best = 0;
		for (const zero of zeros) {
			const shot = new Shot({ weapon, ammo, atmo: new Atmo(), winds: [] });
			const calc = new Calculator();
			weapon.zeroElevation = UNew.Radian(0);
			calc.setWeaponZero(shot, UNew.Yard(zero));
			const rows = calc
				.fire({ shot, trajectoryRange: UNew.Yard(range), trajectoryStep: UNew.Yard(1) })
				.trajectory.map((p) => [p.distance.In(Unit.Yard), p.targetDrop.In(Unit.Inch)]);
			if (rows.some(([, height]) => height > half)) continue;
			const exit = rows.findLastIndex(([, height]) => height >= -half);
			if (exit === rows.length - 1) continue;
			const [[x0, y0], [x1, y1]] = [rows[exit], rows[exit + 1]];
			best = Math.max(best, x0 + ((y0 + half) / (y0 - y1)) * (x1 - x0));
		}
		return best;
	}

	const wholeUnits = (first, last) => Array.from({ length: last - first + 1 }, (_, i) => first + i);

	function expectWithinTolerance(actual, reference) {
		expect(actual, `${actual} against ${reference}`).toBeGreaterThanOrEqual(reference - 1);
		expect(actual, `${actual} against ${reference}`).toBeLessThanOrEqual(reference + 0.1);
	}

	/** Longest range on a walk in 0.05 yd steps, measured once: too slow for every run. */
	it.each([
		['8', 294.0],
		['20', 424.39],
		['30', 499.13],
		['300', 1144.89]
	])('matches the 0.05 yd search on a %s in target', (target, fine) => {
		expectWithinTolerance(calculateMPBR(P308_G1, target, 'in').mpbrMax, fine);
	});

	it.each([
		['8', 300, 340],
		['30', 440, 520]
	])('matches a walk over every whole zero on a %s in target', (target, lastZero, range) => {
		const reference = bruteForceMpbr(P308_G1, parseFloat(target), wholeUnits(1, lastZero), range);
		expectWithinTolerance(calculateMPBR(P308_G1, target, 'in').mpbrMax, reference);
	});

	it('fixes the values of the issue', () => {
		// Before: 475 yd, 415 yd and 290 yd, with zeros of 12, 14 and 21.
		const max = (target) => calculateMPBR(P308_G1, target, 'in').mpbrMax;
		expect(max('30')).toBe(498.9);
		expect(max('20')).toBe(424.3);
		expect(max('8')).toBe(293.4);
	});

	it('is not limited by the old 200 unit zero or 900 unit range', () => {
		// Before: zero 4, near crossing, and 900 yd exactly.
		const result = calculateMPBR(P308_G1, '300', 'in');
		expect(result.optimalZero).toBe(995);
		expect(result.mpbrMax).toBe(1144.2);
		const reference = bruteForceMpbr(P308_G1, 300, wholeUnits(990, 1000), 1200);
		expectWithinTolerance(result.mpbrMax, reference);
	});

	it('reports the far crossing for every target size', () => {
		// Before: 193 for 4 in, the far crossing, and 24 for 6 in, the near one.
		const sizes = ['0.5', '1', '2', '3', '4', '5', '6', '8', '12', '20', '30', '100', '1000'];
		const results = sizes.map((size) => calculateMPBR(P308_G1, size, 'in'));
		for (const result of results) {
			expect(result.optimalZero).toBe(result.farZero);
			expect(Number.isInteger(result.optimalZero)).toBe(true);
			expect(result.nearZero).toBeLessThan(result.farZero);
		}
		const zeros = results.map((result) => result.optimalZero);
		expect(zeros).toEqual([...zeros].sort((a, b) => a - b));
		expect(zeros[4]).toBe(193);
		expect(zeros[6]).toBe(223);
	});

	it('keeps the apex inside the zone, also when the far crossing is just over a whole unit', () => {
		// The solver zeroes about 0.1 yd past the distance asked for. On 2 and 3 in that puts the
		// unit under the far crossing over the top of the zone, so the zero is one lower.
		for (const [size, zero] of [['2', 153], ['3', 174]]) {
			const result = calculateMPBR(P308_G1, size, 'in');
			expect(result.optimalZero).toBe(zero);
			expect(result.maxOrdinate.elevation).toBeLessThanOrEqual(result.halfTarget);
		}
	});

	it.each([
		['8', 'yd', P308_G1],
		['30', 'yd', P308_G1],
		['8', 'yd', P65_G7]
	])('describes the shot a saved zero gives on a %s in target', (target, unit, profile) => {
		const result = calculateMPBR(profile, target, 'in');
		const saved = { ...profile, zeroDist: result.optimalZero, zeroUnit: unit };
		const range = { distance: Math.ceil(result.mpbrMax), unit, step: 1 };
		const full = calculateFullTrajectory(saved, range, null, null);
		near(full.nearZero, result.nearZero, 0.5, 'near zero');
		near(full.farZero, result.farZero, 0.5, 'far zero');
		near(full.maxApex.elevation, result.maxOrdinate.elevation, 0.05, 'apex elevation');
		near(full.maxApex.distance, result.maxOrdinate.distance, 1, 'apex distance');
		const exit = calculateShotPoint(saved, { distance: result.mpbrMax, unit }, null, null);
		near(exit.targetDrop.In(Unit.Inch), -result.halfTarget, 0.05, 'height at MPBR');
	});

	describe('imperial and metric', () => {
		it.each([
			['8', '20.32'],
			['20', '50.8'],
			['30', '76.2'],
			['100', '254']
		])('gives the same range for %s in and %s cm', (inches, centimeters) => {
			const yd = calculateMPBR(P308_G1, inches, 'in');
			const m = calculateMPBR(P308_G1, centimeters, 'cm');
			// Each side has its own whole unit zero, which is the 1 unit of the tolerance.
			near(m.mpbrMax / 0.9144, yd.mpbrMax, 1, 'mpbrMax');
			near(m.optimalZero / 0.9144, yd.optimalZero, 2, 'optimal zero');
			near(m.maxOrdinate.elevation / 2.54, yd.maxOrdinate.elevation, 0.1, 'apex');
		});
	});

	describe('where the bullet enters the zone', () => {
		const heightAt = (result, distance) => {
			const saved = { ...P308_G1, zeroDist: result.optimalZero, zeroUnit: 'yd' };
			return calculateShotPoint(saved, { distance, unit: 'yd' }, null, null).targetDrop.In(Unit.Inch);
		};

		it('is 0 when the muzzle is already inside', () => {
			// The sight is 1.5 in over the bore, so a 3 in zone starts right at the muzzle.
			expect(calculateMPBR(P308_G1, '3', 'in').mpbrMin).toBe(0);
			expect(calculateMPBR(P308_G1, '3.1', 'in').mpbrMin).toBe(0);
		});

		it.each([['1'], ['2'], ['2.9']])('reads the crossing on a %s in target', (target) => {
			const result = calculateMPBR(P308_G1, target, 'in');
			expect(result.mpbrMin).toBeGreaterThan(0);
			near(heightAt(result, result.mpbrMin), -parseFloat(target) / 2, 0.05, 'height at mpbrMin');
		});

		it('is not on the 5 unit grid', () => {
			// Before: 25 and 10, the last row below the zone.
			expect(calculateMPBR(P308_G1, '1', 'in').mpbrMin).toBe(25.7);
			expect(calculateMPBR(P308_G1, '2', 'in').mpbrMin).toBe(10.4);
		});

		it('handles a sight height of 0', () => {
			const result = calculateMPBR({ ...P308_G1, opticHeight: '0' }, '8', 'in');
			expect(result.mpbrMin).toBe(0);
			expect(result.nearZero).toBeNull();
			expect(result.optimalZero).toBe(result.farZero);
		});
	});

	describe('returned trajectory', () => {
		it('covers the whole range for the chart, with its zero crossings', () => {
			const { trajectory, mpbrMax } = calculateMPBR(P308_G1, '30', 'in');
			const distances = trajectory.map((p) => p.distance.In(Unit.Yard));
			expect(distances).toEqual([...distances].sort((a, b) => a - b));
			expect(distances.at(-1)).toBeGreaterThanOrEqual(mpbrMax * 1.2);
			expect(distances.at(-1)).toBeLessThanOrEqual(mpbrMax * 1.2 + 55);
			expect(trajectory[0].distance.In(Unit.Yard)).toBe(0);
		});

		it('returns the rows the flight has when the bullet stops before the end of the chart', () => {
			// Below 50 fps the engine stops, here a few yards short of 1.2 times the range.
			const result = calculateMPBR({ ...P308_G1, velocity: '60' }, '8', 'in');
			expect(result.mpbrMax).toBeGreaterThan(result.optimalZero);
			expect(result.trajectory.length).toBeGreaterThan(1);
		});
	});

	describe('targets and loads at the limits', () => {
		silenceShotErrors();

		it('takes a thin zone', () => {
			const result = calculateMPBR(P308_G1, '0.001', 'in');
			expect(result.optimalZero).toBe(result.farZero);
			expect(result.mpbrMax - result.mpbrMin).toBeLessThan(5);
		});

		it.each([['0.0001'], ['1e-12']])('returns null when no whole zero fits a %s in zone', (target) => {
			expect(calculateMPBR(P308_G1, target, 'in')).toBeNull();
		});

		it('follows a target far past any useful size', () => {
			// 2750 ft across, just inside the depth the engine follows a bullet to.
			const result = calculateMPBR(P308_G1, '33000', 'in');
			expect(result.mpbrMax).toBeGreaterThan(4000);
			expect(result.optimalZero).toBe(result.farZero);
		});

		it.each([['34000'], ['100000'], ['1e308'], ['Infinity']])(
			'returns null for a %s in target, which the whole flight stays inside',
			(target) => {
				expect(calculateMPBR(P308_G1, target, 'in')).toBeNull();
			}
		);

		it('returns null when the arc cannot reach the top of the zone', () => {
			// 300 fps cannot lift the apex 1000 ft within the elevation limit.
			expect(calculateMPBR({ ...P308_G1, velocity: '300' }, '24000', 'in')).toBeNull();
		});

		it('gives a result for a slow load, which used to return null', () => {
			const result = calculateMPBR({ ...P308_G1, velocity: '300' }, '8', 'in');
			expect(result.optimalZero).toBe(30);
			expect(result.mpbrMax).toBe(36.2);
		});

		it.each([
			['8'],
			['1000'],
			['100000']
		])('stops within the bound on integrations on a %s in target', (target) => {
			const integrating = vi.spyOn(EulerIntegrationEngine.prototype, '_integrate');
			const zeroing = vi.spyOn(Calculator.prototype, 'setWeaponZero');
			calculateMPBR(P308_G1, target, 'in');
			// 54 fires and two zero solves of up to 60 integrations each.
			expect(integrating.mock.calls.length).toBeLessThanOrEqual(54 + 2 * 60);
			expect(zeroing.mock.calls.length).toBeLessThanOrEqual(2);
		});

		/**
		 * The engine can stay in its loop forever on these, and a test timeout cannot stop
		 * synchronous code. So the solver is stubbed: without the guards these tests fail on the
		 * spy instead of stalling the run.
		 */
		it.each([
			['no velocity', { velocity: '0' }],
			['an empty velocity', { velocity: '' }],
			['a velocity that is not a number', { velocity: 'abc' }],
			['a negative velocity', { velocity: '-2650' }],
			['a velocity under the 50 fps minimum', { velocity: '49' }],
			['a velocity past the limit', { velocity: '1e15' }],
			['an empty sight height', { opticHeight: '' }],
			['an infinite sight height', { opticHeight: 'Infinity' }],
			['a BC under the limit', { bc: '0.00001' }],
			['an empty BC', { bc: '' }]
		])('returns null for %s without reaching the solver', (_, change) => {
			const firing = vi.spyOn(Calculator.prototype, 'fire').mockImplementation(() => {
				throw new Error('reached the solver');
			});
			const zeroing = vi.spyOn(Calculator.prototype, 'setWeaponZero').mockImplementation(() => {
				throw new Error('reached the solver');
			});
			expect(calculateMPBR({ ...P308_G1, ...change }, '8', 'in')).toBeNull();
			expect(firing).not.toHaveBeenCalled();
			expect(zeroing).not.toHaveBeenCalled();
		});
	});
});
