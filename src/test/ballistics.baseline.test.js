/**
 * Layer 1 of the ballistics reference tests (#70): regression baseline.
 *
 * Purpose: these numbers are what the app computes today with explicit inputs, so any change in
 * results fails here. They are written out by hand on purpose, not toMatchSnapshot, so a change
 * cannot be accepted by rerunning with -u. They are what the app does, NOT proof that it is right.
 * The check against outside data is layer 2, ballistics.published.test.js.
 *
 * If a test here fails after an upgrade, do not just copy the new number in. Check layer 2
 * first, then decide whether the shift is acceptable. Solver changes alone do show up: at
 * 1000 yd on P308_G1 with a 10 mph crosswind, the RK4 engine of js-ballistics 2.2 differed from
 * its Euler engine, which the app used then, by 0.32 in drop, 0.26 fps, 0.08 in wind drift and
 * 0.007 MOA zero angle. All of that is outside the tolerances below. The app runs RK4 since #77.
 *
 * Recorded on js-ballistics 2.2.0-beta.2 (Euler), then re-recorded on 3.1.0 with RK4 for #77 (owner
 * decisions of 2026-11-11 and 2026-11-12): only the values outside their tolerance against the 2.2
 * value, with no tolerance changed. The old and new
 * values are in the delivery document of #77.
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
 * step (#85), and the max apex block below holds it to 1 unit. Max drop and subsonic distance no
 * longer depend on the step either (#94). One value changed for that, on purpose: P308_G1
 * subsonicDist in m was recorded as 960 from step 5 rows, and is 957, the value step 1 rows gave
 * before #94 too. See the max drop and subsonic distance block.
 *
 * Known problems in the code are deliberately NOT pinned here.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
	Ammo,
	Atmo,
	DragModel,
	Shot,
	DragTables,
	UNew,
	Unit,
	Weapon
} from 'js-ballistics';
import { Calculator, ENGINE_CONFIG } from '#lib/utils/ballisticEngine.js';
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
 * - hotAltitude: ATMO_HOT_ALTITUDE, 10 mph from 225 degrees (45 in the engine's angle, #106).
 * - coldMetric: ATMO_COLD_METRIC, 4 m/s from 120 degrees (300 in the engine's angle, #106).
 * - scope600yd: [elevation, windage] by display unit, 600 yd, WIND_10MPH.
 * - spinDriftIn: windage at 500 and 1000 yd, spin drift on, no wind.
 * - mpbr8in, mpbr20cm: changed on purpose besides #77. Re-recorded for #86: the search
 *   used to walk zeros up to 200 on 5 unit rows, so mpbrMin, mpbrMax and the apex distance sat on
 *   the 5 unit grid; it now bisects to the best arc and reads between step 1 rows. Re-recorded for
 *   #109 (owner decision of 2026-11-11): optimalZero went from the far crossing to the near
 *   crossing, as a whole unit, so it equals nearZero. A whole unit of near zero moves the arc more
 *   than one of far zero, so mpbrMax lost up to 5.1 units (1.9 %, the .308 on 20 cm), and the apex
 *   can sit under the top of the zone. See the MPBR search block for the brute force checks.
 */
const REFERENCE = {
	P223_G1: {
		profile: P223_G1,
		imperial: [
			[100, 2848, 0.0988, 0, 1.09, 990.5],
			[300, 2156.59, 0.341, -9.29, 11.13, 567.9],
			[500, 1577.06, 0.6669, -49.53, 35.89, 303.7],
			[800, 1038.57, 1.3889, -232.14, 114.08, 131.8],
			[1000, 895.31, 2.0152, -503.55, 191.73, 97.9]
		],
		metric: [
			[100, 857.43, 0.1087, 0.08, 2.98, 1310.2],
			[300, 630.34, 0.3809, -32.11, 30.86, 708.1],
			[500, 445.5, 0.7594, -167.38, 101.25, 353.7],
			[800, 297.25, 1.6125, -803.16, 320.98, 157.5],
			[1000, 258.12, 2.3384, -1746.59, 530.35, 118.8]
		],
		zeroMoa: 4.1124,
		zeroMrad: 1.19625,
		keyPointsYd: { nearZero: 100, farZero: 124.2, maxApex: { distance: 110, elevation: 0 }, maxDrop: { distance: 1000, drop: -503.5 }, subsonicDist: 732 },
		keyPointsM: { nearZero: 91.4, farZero: 113.7, maxApex: { distance: 105, elevation: 0.1 }, maxDrop: { distance: 1000, drop: -1746.6 }, subsonicDist: 669 },
		hotAltitude: [
			[300, 2363.27, 0.3256, -8.16, 5.97, 682],
			[1000, 1070.5, 1.712, -363.61, 98.13, 140]
		],
		coldMetric: [
			[300, 668.3, 0.37, -29.82, -22.97, 796.1],
			[1000, 274.28, 2.1632, -1469.72, -399.37, 134.1]
		],
		scope600yd: { MOA: [-14.1, 8.9], MRAD: [-4.1, 2.6], IN: [-88.9, 55.9], FT: [-7.41, 4.66], CM: [-225.7, 142.1], M: [-2.26, 1.42] },
		spinDriftIn: [2.105, 15.93],
		mpbr8in: { optimalZero: 39, nearZero: 39, farZero: 287, mpbrMin: 0, mpbrMax: 332.5, maxOrdinate: { elevation: 4, distance: 170 }, halfTarget: 4, useMetric: false },
		mpbr20cm: { optimalZero: 36, nearZero: 36, farZero: 261, mpbrMin: 0, mpbrMax: 301.9, maxOrdinate: { elevation: 9.8, distance: 155 }, halfTarget: 10, useMetric: true }
	},
	P308_G1: {
		profile: P308_G1,
		imperial: [
			[100, 2456.69, 0.1176, 0, 0.77, 2251.2],
			[300, 2094.3, 0.3821, -15.29, 7.48, 1636.2],
			[500, 1765.29, 0.6943, -62.63, 22.57, 1162.5],
			[800, 1351.74, 1.2788, -223.98, 65.67, 681.7],
			[1000, 1151.6, 1.7616, -422.43, 110.82, 494.9]
		],
		metric: [
			[100, 743.41, 0.1291, -0.35, 2.1, 3008.5],
			[300, 623.63, 0.4228, -50.18, 20.57, 2117.2],
			[500, 516.25, 0.7755, -202.25, 62.59, 1451],
			[800, 386.58, 1.4505, -731.17, 184.01, 813.8],
			[1000, 330.34, 2.0134, -1395.88, 310.21, 594.3]
		],
		zeroMoa: 3.918,
		zeroMrad: 1.13967,
		keyPointsYd: { nearZero: 56, farZero: 100, maxApex: { distance: 80, elevation: 0.1 }, maxDrop: { distance: 1000, drop: -422.4 }, subsonicDist: null },
		keyPointsM: { nearZero: 51.2, farZero: 91.6, maxApex: { distance: 70, elevation: 0.3 }, maxDrop: { distance: 1000, drop: -1395.9 }, subsonicDist: 957 },
		hotAltitude: [
			[300, 2204.8, 0.3724, -14.47, 4.1, 1813.2],
			[1000, 1371.06, 1.589, -356.15, 57.08, 701.3]
		],
		coldMetric: [
			[300, 644.76, 0.4158, -48.5, -15.42, 2263.3],
			[1000, 358.71, 1.8928, -1252.6, -227.36, 700.9]
		],
		scope600yd: { MOA: [-16.3, 5.4], MRAD: [-4.7, 1.6], IN: [-102.2, 33.9], FT: [-8.52, 2.83], CM: [-259.5, 86.2], M: [-2.6, 0.86] },
		spinDriftIn: [2.346, 12.892],
		mpbr8in: { optimalZero: 22, nearZero: 22, farZero: 240, mpbrMin: 0, mpbrMax: 286.4, maxOrdinate: { elevation: 3.6, distance: 134 }, halfTarget: 4, useMetric: false },
		mpbr20cm: { optimalZero: 20, nearZero: 20, farZero: 221, mpbrMin: 0, mpbrMax: 262.2, maxOrdinate: { elevation: 9.3, distance: 123 }, halfTarget: 10, useMetric: true }
	},
	P65_G7: {
		profile: P65_G7,
		imperial: [
			[100, 2560.09, 0.1139, 0, 0.63, 2037.2],
			[300, 2274.23, 0.3626, -12.78, 5.94, 1607.8],
			[500, 2008.01, 0.6434, -52.6, 17.47, 1253.5],
			[800, 1640.26, 1.1392, -180.56, 49.35, 836.5],
			[1000, 1413.32, 1.5333, -328.31, 83.16, 621.1]
		],
		metric: [
			[100, 776.11, 0.1249, -0.21, 1.74, 2732.4],
			[300, 681.43, 0.3999, -42.14, 16.46, 2106.6],
			[500, 593.86, 0.7144, -169.16, 48.72, 1600.1],
			[800, 473.53, 1.28, -581.53, 139.4, 1017.4],
			[1000, 400.07, 1.7395, -1067.42, 237.59, 726.3]
		],
		zeroMoa: 4.1611,
		zeroMrad: 1.2104,
		keyPointsYd: { nearZero: 75.2, farZero: 100, maxApex: { distance: 90, elevation: 0 }, maxDrop: { distance: 1000, drop: -328.3 }, subsonicDist: null },
		keyPointsM: { nearZero: 68.7, farZero: 91.6, maxApex: { distance: 80, elevation: 0.1 }, maxDrop: { distance: 1000, drop: -1067.4 }, subsonicDist: null },
		hotAltitude: [
			[300, 2361.87, 0.3558, -12.24, 3.61, 1734],
			[1000, 1651.46, 1.4192, -290.38, 47.15, 847.8]
		],
		coldMetric: [
			[300, 698.34, 0.395, -41.01, -9.22, 2212.5],
			[1000, 445.22, 1.6505, -983.02, -127.52, 899.2]
		],
		scope600yd: { MOA: [-13.5, 4.1], MRAD: [-3.9, 1.2], IN: [-85, 26], FT: [-7.08, 2.16], CM: [-215.8, 65.9], M: [-2.16, 0.66] },
		spinDriftIn: [1.657, 8.119],
		mpbr8in: { optimalZero: 27, nearZero: 27, farZero: 265, mpbrMin: 0, mpbrMax: 312.3, maxOrdinate: { elevation: 4, distance: 149 }, halfTarget: 4, useMetric: false },
		mpbr20cm: { optimalZero: 25, nearZero: 25, farZero: 240, mpbrMin: 0, mpbrMax: 282.7, maxOrdinate: { elevation: 9.8, distance: 135 }, halfTarget: 10, useMetric: true }
	},
	P338_G7_METRIC: {
		profile: P338_G7_METRIC,
		imperial: [
			[100, 2820.31, 0.1037, 0.03, 0.53, 4415.1],
			[300, 2533.99, 0.3281, -9.58, 4.95, 3564.4],
			[500, 2264.39, 0.5786, -40.95, 14.49, 2846.5],
			[800, 1892.51, 1.0134, -141.28, 40.46, 1988.5],
			[1000, 1662.95, 1.3516, -255.19, 67.45, 1535.4]
		],
		metric: [
			[100, 855.44, 0.1137, 0, 1.46, 5927.9],
			[300, 760.51, 0.3616, -31.91, 13.73, 4685.5],
			[500, 671.73, 0.6415, -132.05, 40.39, 3655.7],
			[800, 550.16, 1.135, -454.19, 114.03, 2451.9],
			[1000, 475.46, 1.526, -825.63, 191.88, 1831.3]
		],
		zeroMoa: 3.8559,
		zeroMrad: 1.12163,
		keyPointsYd: { nearZero: 85.3, farZero: 109.5, maxApex: { distance: 95, elevation: 0 }, maxDrop: { distance: 1000, drop: -255.2 }, subsonicDist: null },
		keyPointsM: { nearZero: 78, farZero: 100.1, maxApex: { distance: 90, elevation: 0.1 }, maxDrop: { distance: 1000, drop: -825.6 }, subsonicDist: null },
		hotAltitude: [
			[300, 2621.43, 0.3226, -9.19, 3.06, 3814.4],
			[1000, 1903.47, 1.2633, -228.81, 39.23, 2011.3]
		],
		coldMetric: [
			[300, 777.73, 0.3576, -31.08, -7.28, 4899.8],
			[1000, 521.21, 1.4578, -767.56, -99.39, 2200.7]
		],
		scope600yd: { MOA: [-10.6, 3.4], MRAD: [-3.1, 1], IN: [-66.4, 21.5], FT: [-5.54, 1.79], CM: [-168.8, 54.5], M: [-1.69, 0.54] },
		spinDriftIn: [1.564, 7.386],
		mpbr8in: { optimalZero: 31, nearZero: 31, farZero: 288, mpbrMin: 0, mpbrMax: 340, maxOrdinate: { elevation: 3.8, distance: 162 }, halfTarget: 4, useMetric: false },
		mpbr20cm: { optimalZero: 29, nearZero: 29, farZero: 258, mpbrMin: 0, mpbrMax: 305.9, maxOrdinate: { elevation: 9.2, distance: 146 }, halfTarget: 10, useMetric: true }
	}
};

const PROFILES = Object.entries(REFERENCE);

function expectImperialRows(trajectory, rows) {
	for (const [distance, velocity, time, drop, windage, energy] of rows) {
		const p = trajectory.find((row) => Math.round(row.distance.In(Unit.Yard)) === distance);
		const at = `${distance} yd`;
		near(p.velocity.In(Unit.FPS), velocity, TOL.fps, `velocity ${at}`);
		near(p.time, time, TOL.time, `time ${at}`);
		near(p.slantHeight.In(Unit.Inch), drop, TOL.inch, `drop ${at}`);
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
		near(p.slantHeight.In(Unit.Centimeter), drop, TOL.cm, `drop ${at}`);
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
		// 225 since #106: the direction where the wind comes from, the engine's 45 before.
		const wind = { speed: '10', speedUnit: 'mph', direction: '225' };
		const result = calculateFullTrajectory(ref.profile, YD_1000, ATMO_HOT_ALTITUDE, wind);
		expectImperialRows(result.trajectory, ref.hotAltitude);
	});

	it('records a cold, high atmosphere with a quartering wind, metric inputs', () => {
		// 120 since #106: the direction where the wind comes from, the engine's 300 before.
		const wind = { speed: '4', speedUnit: 'mps', direction: '120' };
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
		near(point.slantHeight.In(Unit.Inch), row.slantHeight.In(Unit.Inch), TOL.inch, 'drop');
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
		// Where the wind comes from since #106: 270 is from the left, 90 from the right.
		const left = at600(P308_G1, { speed: '10', speedUnit: 'mph', direction: '270' });
		const right = at600(P308_G1, { speed: '10', speedUnit: 'mph', direction: '90' });
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
		expect(point.slantHeight.In(Unit.Inch)).toBeLessThan(0);
		expect(getElevationValue(point, 'MOA')).toBeLessThan(0);
	});

	it('records a 5 degree cant', () => {
		const point = at600(P308_G1, null, { cantAngle: 5 });
		near(point.slantHeight.In(Unit.Inch), -102.3, TOL.inch, 'drop');
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
			near(q.slantHeight.In(Unit.Inch), p.slantHeight.In(Unit.Inch), 0.001, 'drop');
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
			near(q.slantHeight.In(Unit.Inch), p.slantHeight.In(Unit.Inch), 0.4, 'drop');
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
			expect(Math.abs(p.slantHeight.In(Unit.Inch))).toBeLessThanOrEqual(result.halfTarget + 0.01);
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
		['velocity from angle in mrad, yd', P65_G7, { distance: 800, unit: 'yd' }, 'angle', '6.5', 'mrad', 'velocity', null, 2673, 0.305, -6.476],
		['BC from inches, yd', P223_G1, { distance: 500, unit: 'yd' }, 'distance', '75', 'in', 'bc', null, 3240, 0.172, -75.374],
		['BC from angle in MOA, yd', P308_G1, { distance: 600, unit: 'yd' }, 'angle', '17.5', 'moa', 'bc', null, 2650, 0.399, -17.542],
		['velocity from cm, metric profile', P338_G7_METRIC, { distance: 1000, unit: 'm' }, 'distance', '750', 'cm', 'velocity', null, 943, 0.322, -748.014],
		['BC from angle in mrad, metric profile', P338_G7_METRIC, { distance: 1000, unit: 'm' }, 'angle', '7.9', 'mrad', 'bc', null, 905, 0.347, -7.911],
		['velocity in a custom atmosphere', P308_G1, { distance: 600, unit: 'yd' }, 'distance', '110', 'in', 'velocity', ATMO_HOT_ALTITUDE, 2464, 0.462, -109.975],
		['BC in a custom metric atmosphere', P338_G7_METRIC, { distance: 800, unit: 'm' }, 'angle', '5', 'mrad', 'bc', ATMO_COLD_METRIC, 905, 0.397, -4.994]
	])('records %s', (_, profile, range, measureType, value, unit, solveFor, atmosphere, velocity, bc, measured) => {
		const result = calculateTrajectoryValidation(profile, range, measureType, value, unit, solveFor, atmosphere);
		expect(result.validatedVelocity).toBe(velocity);
		expect(result.validatedBc).toBe(bc);
		const point = result.validatedPoint;
		const actual =
			measureType === 'distance'
				? point.slantHeight.In(unit === 'cm' ? Unit.Centimeter : Unit.Inch)
				: point.dropAngle.In(unit === 'mrad' ? Unit.MRad : Unit.MOA);
		near(actual, measured, 0.01, 'validated point');
	});

	it('recovers a known velocity from the drop it produces', () => {
		const range = { distance: 800, unit: 'yd' };
		const drop = calculateShotPoint(P308_G1, range, null, null).slantHeight.In(Unit.Inch);
		const wrong = { ...P308_G1, velocity: '2750' };
		const result = calculateTrajectoryValidation(wrong, range, 'distance', Math.abs(drop), 'in', 'velocity');
		near(result.validatedVelocity, 2650, 2, 'validated velocity');
	});

	it('recovers a known BC from the drop it produces', () => {
		const range = { distance: 800, unit: 'yd' };
		const drop = calculateShotPoint(P308_G1, range, null, null).slantHeight.In(Unit.Inch);
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
	const value = measureType === 'distance' ? point.slantHeight : point.dropAngle;
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
		near(result.validatedPoint.slantHeight.In(Unit.Inch), 3, 0.05, 'height at the solved velocity');
	});

	it('still reads 3 in below as below, and says the bullet is above there', () => {
		const result = solve(P223_SHORT_ZERO, yd100, 'distance', '3', 'in', 'velocity', 'below');
		near(result.validatedVelocity, 1013, 2, 'velocity');
		near(result.validatedPoint.slantHeight.In(Unit.Inch), -3, 0.05, 'drop at the solved velocity');
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

	it('gives dropAngle the sign of slantHeight on both sides of the line of sight', () => {
		const high = calculateShotPoint(P223_SHORT_ZERO, yd100, null, null);
		const low = calculateShotPoint({ ...P223_SHORT_ZERO, velocity: '1000' }, yd100, null, null);
		expect(high.slantHeight.In(Unit.Inch)).toBeGreaterThan(0);
		expect(high.dropAngle.In(Unit.MOA)).toBeGreaterThan(0);
		expect(low.slantHeight.In(Unit.Inch)).toBeLessThan(0);
		expect(low.dropAngle.In(Unit.MOA)).toBeLessThan(0);
	});

	/** The search relies on this order, and on a short zero the zero angle moves with it. */
	it.each([
		['velocity', 'velocity', [70, 100, 200, 400, 700, 1000, 1200, 1500, 2000, 3000, 5000, 9900]],
		['BC', 'bc', [0.011, 0.02, 0.05, 0.1, 0.2, 0.285, 0.5, 1, 1.9]]
	])('height at range rises with %s inside a short zero', (_, key, values) => {
		const heights = values.map((value) =>
			calculateShotPoint({ ...P223_SHORT_ZERO, [key]: String(value) }, yd100, null, null).slantHeight.In(Unit.Inch)
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
		expect(below.validatedVelocity).toBe(2995);
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
		const drop = Math.abs(shot.slantHeight.In(Unit.Inch));
		const result = solve(P223_SHORT_ZERO, drop, 'velocity');
		expect(calculateShotPoint({ ...P223_SHORT_ZERO, velocity: '200' }, yd600, null, null)).toBeNull();
		near(result.validatedVelocity, 250, 1, 'velocity');
	});

	it('finds a goal that lies between the last good shot and the lower bound', () => {
		// The ladder goes 0.285, 0.185, 0.085, then -0.015 is out of bounds.
		const shot = calculateShotPoint({ ...P223_SHORT_ZERO, bc: '0.05' }, yd600, null, null);
		const result = solve(P223_SHORT_ZERO, Math.abs(shot.slantHeight.In(Unit.Inch)), 'bc');
		near(result.validatedBc, 0.05, 0.001, 'BC');
	});

	it('accepts a goal the search can only reach to within its last step', () => {
		// 1 fps moves the drop by over 0.1 in here, so no shot measures exactly 110.0.
		const result = solve(P308_G1, '110', 'velocity');
		expect(result.error).toBeUndefined();
		near(result.validatedPoint.slantHeight.In(Unit.Inch), -110, 0.5, 'drop');
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
		expect(result.validatedPoint.slantHeight.In(Unit.Inch)).toBe(shot.slantHeight.In(Unit.Inch));
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
		near(shot.slantHeight.In(Unit.Inch), reference.slantHeight.In(Unit.Inch), 0.001, 'shot drop');

		const rows = calculateFullTrajectory(hot, YD_1000, null, null).trajectory;
		const fasterRows = calculateFullTrajectory(faster, YD_1000, null, null).trajectory;
		expect(rows).toHaveLength(fasterRows.length);
		rows.forEach((p, i) => {
			near(p.velocity.In(Unit.FPS), fasterRows[i].velocity.In(Unit.FPS), 0.001, 'row velocity');
			near(p.slantHeight.In(Unit.Inch), fasterRows[i].slantHeight.In(Unit.Inch), 0.001, 'row drop');
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
		['0', 1355.754, -359.661],
		['0.5', 1355.84, -359.641],
		['1', 1355.925, -359.62],
		['2', 1356.095, -359.579],
		['100', 1372.86, -355.569]
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
		['a short zero', P223_SHORT_ZERO, { distance: 266, elevation: 18 }, { distance: 243, elevation: 45.7 }],
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
			.chartPoints.map((p) => ({ distance: p.distance.In(distanceUnit), elevation: p.slantHeight.In(heightUnit) }))
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
		// 225 since #106: the direction where the wind comes from, the engine's 45 before.
		const wind = { speed: '10', speedUnit: 'mph', direction: '225' };
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
		// Zeroed near the tangent point: near zero 111.1 yd, far zero 112.0 yd, with the 112 yd row
		// above the line of sight. A zero of 111 gave a narrow arc on js-ballistics 2.2, which zeroed
		// about 0.1 yd past the distance; 3.1 zeroes on it (#77), and 111 gives 111 to 112.1 yd.
		const profile = { ...P223_G1, zeroDist: 112.05 };
		const result = calculateFullTrajectory(profile, { distance: 400, unit: 'yd', step: 25 }, null, null);
		expect(result.farZero - result.nearZero).toBeLessThan(1);
		near(result.maxApex.distance, 111.5, 1, 'apex distance');
		expect(result.maxApex.elevation).toBe(0);
	});

	it('fires once more, as far as the range', () => {
		// Max drop and subsonic distance need the whole range (#94). Before, this fire stopped at
		// the far zero; the rows past it are below the line of sight, so the apex is the same.
		const firing = vi.spyOn(Calculator.prototype, 'fire');
		apex(ZERO_200, 'yd', 25);
		const ranges = firing.mock.calls.map(([options]) => options.trajectoryRange.In(Unit.Yard));
		firing.mockRestore();
		expect(ranges).toEqual([1000, 1000]);
	});
});

/**
 * Max drop and subsonic distance come from the same fine fire as the apex, over the whole range
 * (#94), not from the table rows.
 *
 * Definitions: max drop is the lowest height over the line of sight within [0, range], the muzzle
 * included. Subsonic distance is the first distance within the range where the velocity is under
 * the speed of sound at the shooter, or null. Tolerance against step 1 rows: 1 distance unit, and
 * 0.05 in or cm on the drop.
 *
 * Every case is an ordinary load at an ordinary range, so none can stall the run.
 */
describe('max drop and subsonic distance (#94)', () => {
	const STEPS = [1, 5, 7, 25, 100, 250, 300, 1000];
	const LOADS = [
		['P223_G1', P223_G1],
		['P223_SHORT_ZERO', P223_SHORT_ZERO],
		['P308_G1', P308_G1],
		['P338_G7_METRIC', P338_G7_METRIC]
	];
	const CASES = LOADS.flatMap(([name, profile]) =>
		[1000, 333.3, 1500].flatMap((distance) => ['yd', 'm'].map((unit) => [name, unit, distance, profile]))
	);

	const keyPoints = (profile, unit, step, distance, atmosphere = null) => {
		const { maxDrop, subsonicDist } = calculateFullTrajectory(profile, { distance, unit, step }, atmosphere, null);
		return { maxDrop, subsonicDist };
	};

	/**
	 * Lowest row and first subsonic row inside the range, unrounded: the rows of a step 1 table,
	 * plus the row at the range itself from a table whose step is the range, for a fractional range.
	 * 1e-6 absorbs float noise on a row that falls on the range.
	 */
	function step1Points(profile, unit, distance, atmosphere = null) {
		const distanceUnit = unit === 'm' ? Unit.Meter : Unit.Yard;
		const heightUnit = unit === 'm' ? Unit.Centimeter : Unit.Inch;
		const table = (step) => calculateFullTrajectory(profile, { distance, unit, step }, atmosphere, null);
		const result = table(1);
		const rangeRow = table(distance).trajectory.at(-1);
		near(rangeRow.distance.In(distanceUnit), distance, 1e-6, 'row at the range');
		const rows = [...result.chartPoints, rangeRow]
			.map((p) => ({ distance: p.distance.In(distanceUnit), drop: p.slantHeight.In(heightUnit), fps: p.velocity.In(Unit.FPS) }))
			.filter((p) => p.distance <= distance + 1e-6)
			.sort((a, b) => a.distance - b.distance);
		const lowest = rows.reduce((low, p) => (p.drop < low.drop ? p : low));
		const subsonic = rows.find((p) => p.fps < result.soundSpeedFPS);
		return { lowest, subsonic: subsonic ? subsonic.distance : null };
	}

	it.each(CASES)('gives the same values at every step for %s in %s over %s', (_, unit, distance, profile) => {
		const first = keyPoints(profile, unit, STEPS[0], distance);
		for (const step of STEPS) expect(keyPoints(profile, unit, step, distance), `step ${step}`).toEqual(first);
	});

	it.each(CASES)('matches step 1 rows for %s in %s over %s', (_, unit, distance, profile) => {
		const { lowest, subsonic } = step1Points(profile, unit, distance);
		for (const step of STEPS) {
			const actual = keyPoints(profile, unit, step, distance);
			near(actual.maxDrop.distance, lowest.distance, 1, `max drop distance, step ${step}`);
			near(actual.maxDrop.drop, lowest.drop, 0.05, `max drop, step ${step}`);
			if (subsonic === null) expect(actual.subsonicDist, `step ${step}`).toBeNull();
			else near(actual.subsonicDist, subsonic, 1, `subsonic distance, step ${step}`);
		}
	});

	it.each(CASES)('stays within the range for %s in %s over %s', (_, unit, distance, profile) => {
		for (const step of STEPS) {
			const actual = keyPoints(profile, unit, step, distance);
			expect(actual.maxDrop.distance, `step ${step}`).toBeLessThanOrEqual(distance);
			if (actual.subsonicDist !== null) expect(actual.subsonicDist, `step ${step}`).toBeLessThanOrEqual(distance);
		}
	});

	it('fixes a max drop read past the range', () => {
		// 333.3 yd at step 100 used to give -34.3 in at 400 yd, a row past the range.
		for (const step of [1, 100, 250]) {
			expect(keyPoints(P308_G1, 'yd', step, 333.3).maxDrop, `step ${step}`).toEqual({ distance: 333.3, drop: -20.7 });
		}
	});

	it('fixes a subsonic distance that depended on the step', () => {
		// P308_G1 in m used to give 960 at step 5, 975 at step 25 and 1000 at step 100.
		for (const step of [1, 5, 25, 100]) expect(keyPoints(P308_G1, 'm', step, 1000).subsonicDist, `step ${step}`).toBe(957);
	});

	it.each([
		[1045, null],
		[1046, 1046],
		[1100, 1046]
	])('gives the subsonic distance only when it is within the range: %s yd', (distance, expected) => {
		// P308_G1 goes under the speed of sound between 1045 and 1046 yd on step 1 rows (between
		// 1046 and 1047 on js-ballistics 2.2, #77).
		for (const step of [1, 25, 250, 1000]) {
			expect(keyPoints(P308_G1, 'yd', step, distance).subsonicDist, `step ${step}`).toBe(expected);
		}
	});

	it('reads the speed of sound of the air the shot flies in', () => {
		const icao = keyPoints(P308_G1, 'yd', 25, 1500).subsonicDist;
		const hot = keyPoints(P308_G1, 'yd', 25, 1500, ATMO_HOT_ALTITUDE).subsonicDist;
		expect(hot).not.toBe(icao);
		near(hot, step1Points(P308_G1, 'yd', 1500, ATMO_HOT_ALTITUDE).subsonic, 1, 'subsonic distance');
	});

	it('gives the muzzle as max drop when the bullet only rises within the range', () => {
		// Zeroed at 100 yd, the bullet climbs from 1.5 in under the line of sight.
		for (const step of [1, 5, 25]) {
			expect(keyPoints(P308_G1, 'yd', step, 10).maxDrop, `step ${step}`).toEqual({ distance: 0, drop: -1.5 });
		}
	});
});

/**
 * The search solves for the arc whose apex touches the top of the zone (#86), and saves its near
 * crossing, rounded up to a whole unit (#109). The tests here check it from the outside, against
 * walks over zero distances that share no code with it.
 *
 * Against a walk over whole near zeros, mpbrMax is the same, within the 0.1 rounding of the
 * output. Against the best any zero can give, it is never over it by more than 0.1, and it loses
 * what one whole unit of near zero costs: at most 4 % up to 30 in, more on huge targets.
 *
 * Every case has a velocity and BC the solver can work with, or stubs the solver, so none can
 * stall the run.
 */
describe('MPBR search (#86)', () => {
	/** Rows [yd, inches over the line of sight] of the shot zeroed at a distance, step 1 yd. */
	function zeroedHeights(profile, zero, range) {
		const weapon = new Weapon({ sightHeight: UNew.Inch(parseFloat(profile.opticHeight)) });
		const dm = new DragModel({
			bc: parseFloat(profile.bc),
			dragTable: DragTables.G1,
			weight: UNew.Grain(parseFloat(profile.bulletWeight)),
			diameter: UNew.Inch(parseFloat(profile.bulletDiameter)),
			length: UNew.Inch(2)
		});
		const ammo = new Ammo({ dm, mv: UNew.FPS(parseFloat(profile.velocity)) });
		const shot = new Shot({ weapon, ammo, atmo: new Atmo(), winds: [] });
		const calc = new Calculator();
		calc.setWeaponZero(shot, UNew.Yard(zero));
		return calc
			.fire({ shot, trajectoryRange: UNew.Yard(range), trajectoryStep: UNew.Yard(1) })
			.records.map((p) => [p.distance.In(Unit.Yard), p.slantHeight.In(Unit.Inch)]);
	}

	/** Highest point of the shot zeroed at a distance, in inches over the line of sight. */
	const apexInches = (profile, zero, range) =>
		Math.max(...zeroedHeights(profile, zero, range).map(([, height]) => height));

	/**
	 * The longest range of the zeros given, in yd. The exit is read between two rows, and a zero
	 * is skipped when any row rises over the top of the zone. Zeros under the distance of the apex
	 * of the lowest arc that reaches the line of sight, about 100 yd on the .308, are near zeros.
	 */
	function bruteForceMpbr(profile, targetInches, zeros, range) {
		const half = targetInches / 2;
		let best = 0;
		for (const zero of zeros) {
			const rows = zeroedHeights(profile, zero, range);
			if (rows.some(([, height]) => height > half)) continue;
			const exit = rows.findLastIndex(([, height]) => height >= -half);
			if (exit === rows.length - 1) continue;
			const [[x0, y0], [x1, y1]] = [rows[exit], rows[exit + 1]];
			best = Math.max(best, x0 + ((y0 + half) / (y0 - y1)) * (x1 - x0));
		}
		return best;
	}

	const wholeUnits = (first, last) => Array.from({ length: last - first + 1 }, (_, i) => first + i);

	/**
	 * Longest range of any zero, near or far, on a walk in 0.05 yd steps, measured once for #86:
	 * too slow for every run. The near zero gives up the share of it in the last column (#109).
	 */
	it.each([
		['8', 294.0, 0.031],
		['20', 424.39, 0.016],
		['30', 499.13, 0.04],
		['300', 1144.89, 0.084]
	])('stays under the 0.05 yd search on a %s in target, by the cost of a whole near zero', (target, fine, loss) => {
		const { mpbrMax } = calculateMPBR(P308_G1, target, 'in');
		expect(mpbrMax).toBeLessThanOrEqual(fine + 0.1);
		expect(mpbrMax).toBeGreaterThanOrEqual(fine * (1 - loss));
	});

	it.each([
		['8', 60, 340],
		['30', 60, 520]
	])('matches a walk over every whole near zero on a %s in target', (target, lastZero, range) => {
		const reference = bruteForceMpbr(P308_G1, parseFloat(target), wholeUnits(1, lastZero), range);
		near(calculateMPBR(P308_G1, target, 'in').mpbrMax, reference, 0.1, 'mpbrMax');
	});

	it('gives these values on the targets of #86', () => {
		// Before #86, near zeros on 5 unit rows: 475 yd, 415 yd and 290 yd, with zeros of 12, 14
		// and 21. With #86, far zeros: 498.9, 424.3 and 293.4.
		const max = (target) => calculateMPBR(P308_G1, target, 'in').mpbrMax;
		expect(max('30')).toBe(482.7);
		expect(max('20')).toBe(420.5);
		expect(max('8')).toBe(286.4);
	});

	it('is not limited by the old 900 unit range', () => {
		// Before #86: zero 4 and 900 yd exactly.
		const result = calculateMPBR(P308_G1, '300', 'in');
		expect(result.optimalZero).toBe(4);
		expect(result.mpbrMax).toBe(1063.7);
		const reference = bruteForceMpbr(P308_G1, 300, wholeUnits(1, 10), 1200);
		near(result.mpbrMax, reference, 0.1, 'mpbrMax');
	});

	it('reports the near crossing for every target size', () => {
		// Before #109: the far crossing, 193 for 4 in and 223 for 6 in.
		const sizes = ['0.5', '1', '2', '3', '4', '5', '6', '8', '12', '20', '30', '100', '1000'];
		const results = sizes.map((size) => calculateMPBR(P308_G1, size, 'in'));
		for (const result of results) {
			expect(result.optimalZero).toBe(result.nearZero);
			expect(Number.isInteger(result.optimalZero)).toBe(true);
			expect(result.nearZero).toBeLessThan(result.farZero);
		}
		// A bigger zone takes a higher arc, which comes up through the line of sight sooner.
		const zeros = results.map((result) => result.optimalZero);
		expect(zeros).toEqual([...zeros].sort((a, b) => b - a));
		expect(zeros[4]).toBe(29);
		expect(zeros[6]).toBe(24);
	});

	it('takes the closest whole near zero that keeps the apex inside the zone', () => {
		// The best arc comes up through the line of sight between 35 and 36 yd on 2 in, 31 and 32 yd
		// on 3 in, and 21 and 22 yd on 8 in. js-ballistics 3 zeroes on the distance (#77), so the
		// unit under the crossing gives a higher arc, over the top, and the search takes the unit
		// above. On 2.2, which zeroed about 0.1 yd past the distance, 31 and 21 still fitted.
		for (const [size, zero] of [['2', 36], ['3', 32], ['8', 22]]) {
			const result = calculateMPBR(P308_G1, size, 'in');
			expect(result.optimalZero).toBe(zero);
			expect(result.maxOrdinate.elevation).toBeLessThanOrEqual(result.halfTarget);
			expect(apexInches(P308_G1, zero, 250)).toBeLessThanOrEqual(parseFloat(size) / 2);
			expect(apexInches(P308_G1, zero - 1, 250)).toBeGreaterThan(parseFloat(size) / 2);
		}
	});

	it('takes a zero of 1 when the near crossing is under 1 unit', () => {
		// The best arc for a 3000 in zone comes up through the line of sight at 0.8 yd.
		const result = calculateMPBR(P308_G1, '3000', 'in');
		expect(result.optimalZero).toBe(1);
		expect(result.nearZero).toBe(1);
		expect(result.maxOrdinate.elevation).toBeLessThanOrEqual(result.halfTarget);
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
		near(exit.slantHeight.In(Unit.Inch), -result.halfTarget, 0.05, 'height at MPBR');
	});

	describe('imperial and metric', () => {
		it.each([
			['8', '20.32', 0.03],
			['20', '50.8', 0.01],
			['30', '76.2', 0.04],
			['100', '254', 0.04]
		])('gives the same range for %s in and %s cm, within %s', (inches, centimeters, share) => {
			const yd = calculateMPBR(P308_G1, inches, 'in');
			const m = calculateMPBR(P308_G1, centimeters, 'cm');
			// Each side has its own whole unit near zero, and gives up its own share of the best
			// range for it (#109): the share in the title, measured 2.3 %, 0.6 % and 3.4 % on 8, 20
			// and 100 in.
			near(m.mpbrMax / 0.9144, yd.mpbrMax, yd.mpbrMax * share, 'mpbrMax');
			near(m.optimalZero / 0.9144, yd.optimalZero, 2, 'optimal zero');
			expect(yd.maxOrdinate.elevation).toBeLessThanOrEqual(yd.halfTarget);
			expect(m.maxOrdinate.elevation).toBeLessThanOrEqual(m.halfTarget);
		});
	});

	describe('where the bullet enters the zone', () => {
		const heightAt = (result, distance) => {
			const saved = { ...P308_G1, zeroDist: result.optimalZero, zeroUnit: 'yd' };
			return calculateShotPoint(saved, { distance, unit: 'yd' }, null, null).slantHeight.In(Unit.Inch);
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
			expect(calculateMPBR(P308_G1, '1', 'in').mpbrMin).toBe(25.8);
			expect(calculateMPBR(P308_G1, '2', 'in').mpbrMin).toBe(10.4);
		});

		it('returns null for a sight height of 0 or under, which has no near crossing (#109)', () => {
			// The bullet starts on or over the line of sight, so it never comes up through it.
			expect(calculateMPBR({ ...P308_G1, opticHeight: '0' }, '8', 'in')).toBeNull();
			expect(calculateMPBR({ ...P308_G1, opticHeight: '-1' }, '8', 'in')).toBeNull();
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
			expect(result.optimalZero).toBe(result.nearZero);
			expect(result.mpbrMax - result.mpbrMin).toBeLessThan(5);
		});

		it.each([['0.0001'], ['1e-12']])('returns null when no whole zero fits a %s in zone', (target) => {
			expect(calculateMPBR(P308_G1, target, 'in')).toBeNull();
		});

		it('follows a target far past any useful size', () => {
			// 2750 ft across, just inside the depth the engine follows a bullet to.
			const result = calculateMPBR(P308_G1, '33000', 'in');
			expect(result.mpbrMax).toBeGreaterThan(3000);
			expect(result.optimalZero).toBe(result.nearZero);
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
			// Before #109: the far zero, 30 yd and 36.2 yd. The near crossing is at 2.5 yd, and 2 yd
			// puts the apex over the top, so 3 yd costs 15 % of the best range on this load (31.6 yd
			// on js-ballistics 2.2, 32.6 yd on 3.1, #77).
			const result = calculateMPBR({ ...P308_G1, velocity: '300' }, '8', 'in');
			expect(result.optimalZero).toBe(3);
			expect(result.mpbrMax).toBe(32.6);
		});

		it.each([
			['8'],
			['1000'],
			['100000']
		])('stops within the bound on fires and zero solves on a %s in target', (target) => {
			// The integrations of a zero solve run inside the WebAssembly engine on js-ballistics 3
			// (#77), out of reach of a spy, so they are bounded by its iteration limit instead.
			const firing = vi.spyOn(Calculator.prototype, 'fire');
			const zeroing = vi.spyOn(Calculator.prototype, 'setWeaponZero');
			calculateMPBR(P308_G1, target, 'in');
			expect(firing.mock.calls.length).toBeLessThanOrEqual(54);
			expect(zeroing.mock.calls.length).toBeLessThanOrEqual(2);
			expect(ENGINE_CONFIG.maxIterations).toBe(60);
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
