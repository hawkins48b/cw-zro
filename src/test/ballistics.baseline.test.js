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
 * Exact values, no tolerance: the quantized results. MPBR distances sit on the 5 unit search
 * grid and zero on the 1 unit grid, the validation solver returns whole fps and 0.001 BC, and
 * getElevationValue/getWindageValue return display-rounded values. A small real change can
 * move one of these by a full grid step, which is a change users see, so it should fail.
 *
 * Key points are rounded to 0.1 by the app, so: 0.2 on near/far zero, max drop distance and
 * subsonic distance, 0.1 on apex and max drop elevation, and one 5 unit step on the apex
 * distance, because the apex is picked from recorded rows.
 *
 * Known problems in the code are deliberately NOT pinned here. See the todos at the end.
 */
import { describe, it, expect, vi } from 'vitest';
import { Unit } from 'js-ballistics';
import {
	calculateShotPoint,
	getElevationValue,
	getWindageValue,
	calculateFullTrajectory,
	calculateMPBR
} from '$lib/utils/ballisticCalculator.js';
import { calculateTrajectoryValidation } from '$lib/utils/trajectoryValidation.js';
import {
	P223_G1,
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
		mpbr8in: { optimalZero: 39, nearZero: 39, farZero: 286, mpbrMin: 0, mpbrMax: 330, maxOrdinate: { elevation: 3.9, distance: 170 }, halfTarget: 4, useMetric: false },
		mpbr20cm: { optimalZero: 36, nearZero: 36, farZero: 260, mpbrMin: 0, mpbrMax: 300, maxOrdinate: { elevation: 9.8, distance: 155 }, halfTarget: 10, useMetric: true }
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
		mpbr8in: { optimalZero: 21, nearZero: 21, farZero: 249, mpbrMin: 0, mpbrMax: 290, maxOrdinate: { elevation: 4, distance: 140 }, halfTarget: 4, useMetric: false },
		mpbr20cm: { optimalZero: 20, nearZero: 20, farZero: 220, mpbrMin: 0, mpbrMax: 260, maxOrdinate: { elevation: 9.2, distance: 125 }, halfTarget: 10, useMetric: true }
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
		mpbr8in: { optimalZero: 27, nearZero: 27, farZero: 264, mpbrMin: 0, mpbrMax: 310, maxOrdinate: { elevation: 3.9, distance: 150 }, halfTarget: 4, useMetric: false },
		mpbr20cm: { optimalZero: 25, nearZero: 25, farZero: 239, mpbrMin: 0, mpbrMax: 280, maxOrdinate: { elevation: 9.7, distance: 135 }, halfTarget: 10, useMetric: true }
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
		mpbr8in: { optimalZero: 31, nearZero: 31, farZero: 287, mpbrMin: 0, mpbrMax: 335, maxOrdinate: { elevation: 3.8, distance: 160 }, halfTarget: 4, useMetric: false },
		mpbr20cm: { optimalZero: 28, nearZero: 28, farZero: 265, mpbrMin: 0, mpbrMax: 310, maxOrdinate: { elevation: 10, distance: 150 }, halfTarget: 10, useMetric: true }
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
		// Step 5 keeps the sampled apex meaningful; see the todo on large steps.
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
		// Direction only. The size is not recorded: see the powder todo at the end of this file.
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
	 * output. Observed drop and adjustment are the measure the search stopped on, in the
	 * unit asked for, so they sit within about one step of the goal, not on it.
	 */
	it.each([
		['velocity from inches, yd', P308_G1, { distance: 600, unit: 'yd' }, 'distance', '110', 'in', 'velocity', null, 2567, 0.462, -110.072],
		['velocity from angle in mrad, yd', P65_G7, { distance: 800, unit: 'yd' }, 'angle', '6.5', 'mrad', 'velocity', null, 2660, 0.305, -6.55],
		['BC from inches, yd', P223_G1, { distance: 500, unit: 'yd' }, 'distance', '75', 'in', 'bc', null, 3240, 0.172, -75.317],
		['BC from angle in MOA, yd', P308_G1, { distance: 600, unit: 'yd' }, 'angle', '17.5', 'moa', 'bc', null, 2650, 0.399, -17.529],
		['velocity from cm, metric profile', P338_G7_METRIC, { distance: 1000, unit: 'm' }, 'distance', '750', 'cm', 'velocity', null, 943, 0.322, -748.944],
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

/**
 * Found while writing these tests and left out of the baseline on purpose, so that recording
 * today's number does not make a bug look correct. Each one needs a decision, then a test.
 */
describe('known problems, not pinned', () => {
	it.todo('powder sensitivity: the form asks for fps per degree, the code uses % per 15 C');
	it.todo('humidity of 1 % or less is read as a fraction: 1 % gives 100 %');
	it.todo('validation forces the goal below line of sight, wrong inside a short zero');
	it.todo('validation returns a velocity when the solver stops on a failed shot');
	it.todo('max apex comes from recorded rows only, so it depends on the table step');
	it.todo('MPBR under-reports large targets: the zero search stops at 200');
});
