/**
 * Trajectory path of the 3D ballistic tutorial (#182). The AC: the drop at the target equals what
 * the Ballistic calculator gives for the same inputs. The Ballistic page calls
 * ballisticPageTrajectory with its own step (25 by default) and the angle of its angle card, and
 * shows each row's slantHeight rounded to 0.1 cm or in; the tutorial asks for another step so its
 * curve is smooth, and must land on the same value at the target.
 */
import { describe, it, expect, vi, afterEach } from 'vitest';
import { Unit } from 'js-ballistics';
import { Calculator } from '#lib/utils/ballisticEngine.js';
import { ballisticPageTrajectory } from '#lib/utils/ballisticPage.js';
import { calculateShotPoint } from '#lib/utils/ballisticCalculator.js';
import { scopeEffectiveRange } from '#lib/utils/scopeRange.js';
import {
	MAX_PATH_ROWS,
	animationDuration,
	pathStep,
	pointAtTime,
	tutorialGeometry,
	tutorialTrajectory
} from '#lib/utils/tutorialPath.js';
import { ATMO_COLD_METRIC, ATMO_HOT_ALTITUDE, P308_G1, P338_G7_METRIC, WIND_10MPH, WIND_4MPS } from './fixtures/ballisticProfiles.js';

afterEach(() => {
	vi.restoreAllMocks();
});

const FLAT_M = { altitude: '0', elevation: '0', unit: 'm' };

/** The Ballistic page's row at a distance, from the same function the page calls. */
function ballisticRow(profile, distance, unit, atmosphere, wind, angleDeg, step = '25') {
	const elevation = { angle: angleDeg, unit: 'deg' };
	const { result } = ballisticPageTrajectory(profile, { distance, unit, step }, atmosphere, wind, elevation);
	const unitOf = unit === 'm' ? Unit.Meter : Unit.Yard;
	return result.trajectory.find((row) => Math.abs(row.distance.In(unitOf) - Number(distance)) < 1e-6);
}

describe('tutorialGeometry', () => {
	it('reads a flat 300 m range', () => {
		const g = tutorialGeometry({ distance: '300', unit: 'm' }, FLAT_M);
		expect(g).toMatchObject({ error: null, distanceM: 300, elevationM: 0, slopeDeg: 0, horizontalM: 300, altitudeM: 0 });
	});

	it('gives the angle whose sine is the elevation over the distance, in metres', () => {
		const g = tutorialGeometry({ distance: '400', unit: 'yd' }, { altitude: '1000', elevation: '200', unit: 'ft' });
		const sine = (200 * 0.3048) / (400 * 0.9144);
		expect(g.error).toBeNull();
		expect(g.slopeDeg).toBeCloseTo((Math.asin(sine) * 180) / Math.PI, 12);
		expect(g.horizontalM).toBeCloseTo(400 * 0.9144 * Math.sqrt(1 - sine * sine), 9);
		expect(g.altitudeM).toBeCloseTo(304.8, 9);
	});

	it('reads empty height boxes as 0 and a comma as a point', () => {
		const g = tutorialGeometry({ distance: '300,5', unit: 'm' }, { altitude: '', elevation: ' ', unit: 'm' });
		expect(g).toMatchObject({ error: null, distanceM: 300.5, elevationM: 0, altitudeM: 0, altitudeError: false });
	});

	it.each([[''], ['0'], ['-300'], ['abc'], ['3001'], ['Infinity'], [null], [{}]])('refuses the distance %j', (distance) => {
		expect(tutorialGeometry({ distance, unit: 'm' }, FLAT_M).error).toBe('distance');
	});

	it.each([['501', 'm'], ['-501', 'm'], ['1645', 'ft'], ['abc', 'm'], ['Infinity', 'm'], [{}, 'm']])(
		'refuses the elevation %j %s',
		(elevation, unit) => {
			expect(tutorialGeometry({ distance: '3000', unit: 'm' }, { altitude: '0', elevation, unit }).error).toBe('elevation');
		}
	);

	it('takes the elevation limits themselves', () => {
		expect(tutorialGeometry({ distance: '3000', unit: 'm' }, { altitude: '0', elevation: '500', unit: 'm' }).error).toBeNull();
		expect(tutorialGeometry({ distance: '3000', unit: 'm' }, { altitude: '0', elevation: '-1640', unit: 'ft' }).error).toBeNull();
	});

	it.each([['100', '100'], ['100', '-100'], ['100', '150']])('refuses a target as high or low as it is far: %s m at %s m', (distance, elevation) => {
		expect(tutorialGeometry({ distance, unit: 'm' }, { altitude: '0', elevation, unit: 'm' }).error).toBe('steep');
	});

	it('flags an altitude out of the Atmosphere card limits, without stopping the shot', () => {
		const g = tutorialGeometry({ distance: '300', unit: 'm' }, { altitude: '20000', elevation: '0', unit: 'm' });
		expect(g).toMatchObject({ error: null, altitudeError: true, altitudeM: 0 });
		expect(tutorialGeometry({ distance: '300', unit: 'm' }, { altitude: 'x', elevation: '0', unit: 'm' }).altitudeError).toBe(true);
	});
});

describe('pathStep', () => {
	it('cuts the distance in equal parts of at least 1 unit, at most MAX_PATH_ROWS of them', () => {
		expect(pathStep(300)).toBe(1.5);
		expect(pathStep(3000)).toBe(15);
		expect(pathStep(50)).toBe(1);
		expect(pathStep(1)).toBe(1);
		expect(pathStep(0.5)).toBe(0.5);
		expect(pathStep(123.4)).toBeCloseTo(123.4 / 123, 12);
		expect(3000 / pathStep(3000)).toBe(MAX_PATH_ROWS);
	});
});

describe('tutorialTrajectory', () => {
	it.each([
		['.308, 300 m flat, ISA, no wind', P308_G1, '300', 'm', FLAT_M, null, null],
		['.308, 600 yd, hot air, 10 mph from the left', P308_G1, '600', 'yd', { altitude: '0', elevation: '0', unit: 'ft' }, ATMO_HOT_ALTITUDE, WIND_10MPH],
		['.338, 1000 m, 80 m uphill, cold air, 4 m/s', P338_G7_METRIC, '1000', 'm', { altitude: '1500', elevation: '80', unit: 'm' }, ATMO_COLD_METRIC, WIND_4MPS],
		['.338, 777 m, 150 m downhill', P338_G7_METRIC, '777', 'm', { altitude: '0', elevation: '-150', unit: 'm' }, null, WIND_4MPS],
		['.308, 437 yd, 300 ft downhill', P308_G1, '437', 'yd', { altitude: '0', elevation: '-300', unit: 'ft' }, null, WIND_10MPH]
	])('gives the Ballistic table drop and windage at the target: %s', (_, profile, distance, unit, terrain, atmosphere, wind) => {
		const { geometry, path } = tutorialTrajectory(profile, { distance, unit }, terrain, atmosphere, wind);
		expect(path).not.toBeNull();
		// Same inputs on the Ballistic page: the distance, its default step of 25 (a row lands on the
		// target only when the distance is a multiple of the step; else a step of the distance), the
		// angle the tutorial computed, the atmosphere and the wind.
		const step = Number(distance) % 25 === 0 ? '25' : distance;
		const row = ballisticRow(profile, distance, unit, atmosphere, wind, geometry.slopeDeg, step);
		expect(row).toBeDefined();
		const shown = unit === 'm' ? Unit.Centimeter : Unit.Inch;
		expect(path.drop.value).toBe(Math.round(row.slantHeight.In(shown) * 10) / 10);
		expect(path.windage.value).toBe(Math.round(row.windage.In(shown) * 10) / 10);
		// Not only the shown value: the row itself, to well under a millimetre.
		expect(path.dropM).toBeCloseTo(row.slantHeight.In(Unit.Meter), 4);
		expect(path.windageM).toBeCloseTo(row.windage.In(Unit.Meter), 4);
		expect(path.time).toBeCloseTo(row.time, 4);
	});

	it('gives the Scope View point at the effective range too (rifleman\'s rule, #173)', () => {
		const terrain = { altitude: '0', elevation: '60', unit: 'm' };
		const { geometry, path } = tutorialTrajectory(P338_G7_METRIC, { distance: '800', unit: 'm' }, terrain, null, WIND_4MPS);
		const effective = scopeEffectiveRange({ distance: '800', unit: 'm' }, { angle: geometry.slopeDeg, unit: 'deg' });
		const point = calculateShotPoint(P338_G7_METRIC, effective, null, WIND_4MPS);
		expect(path.dropM).toBeCloseTo(point.slantHeight.In(Unit.Meter), 4);
		expect(path.windageM).toBeCloseTo(point.windage.In(Unit.Meter), 4);
	});

	it('puts the path in scene metres: muzzle a sight height below the origin, target down -Z', () => {
		const { path } = tutorialTrajectory(P308_G1, { distance: '300', unit: 'm' }, FLAT_M, null, null);
		const first = path.points[0];
		// P308_G1: 1.5 in sight height.
		expect(first.x).toBeCloseTo(0, 9);
		expect(first.y).toBeCloseTo(-1.5 * 0.0254, 6);
		expect(first.z).toBeCloseTo(0, 9);
		expect(first.t).toBe(0);
		expect(path.impact.z).toBeCloseTo(-300, 6);
		expect(path.impact.y).toBeCloseTo(path.dropM, 9);
		expect(path.points.length).toBe(MAX_PATH_ROWS + 1);
		for (let i = 1; i < path.points.length; i++) {
			expect(path.points[i].z).toBeLessThan(path.points[i - 1].z);
			expect(path.points[i].t).toBeGreaterThan(path.points[i - 1].t);
		}
	});

	it('tilts the path with the slope: the target is at the elevation, the drop across the line of sight', () => {
		const terrain = { altitude: '0', elevation: '100', unit: 'm' };
		const { geometry, path } = tutorialTrajectory(P308_G1, { distance: '500', unit: 'm' }, terrain, null, null);
		const a = (geometry.slopeDeg * Math.PI) / 180;
		// Aim point (s = 500 along the line of sight) is at 100 m up, horizontalM away.
		expect(path.impact.y).toBeCloseTo(100 + path.dropM * Math.cos(a), 6);
		expect(path.impact.z).toBeCloseTo(-geometry.horizontalM + path.dropM * Math.sin(a), 6);
	});

	it('puts a drift to the right on +X', () => {
		const fromLeft = tutorialTrajectory(P308_G1, { distance: '600', unit: 'yd' }, FLAT_M, null, WIND_10MPH).path;
		expect(fromLeft.windageM).toBeGreaterThan(0);
		expect(fromLeft.impact.x).toBeCloseTo(fromLeft.windageM, 9);
		const fromRight = tutorialTrajectory(P308_G1, { distance: '600', unit: 'yd' }, FLAT_M, null, { ...WIND_10MPH, direction: '90' }).path;
		expect(fromRight.impact.x).toBeLessThan(0);
	});

	it('gives no path, and calls no engine, without a profile or for a range it refuses', () => {
		const zero = vi.spyOn(Calculator.prototype, 'setWeaponZero').mockImplementation(() => {
			throw new Error('engine reached');
		});
		expect(tutorialTrajectory(null, { distance: '300', unit: 'm' }, FLAT_M, null, null).path).toBeNull();
		for (const [range, terrain] of [
			[{ distance: '', unit: 'm' }, FLAT_M],
			[{ distance: '9999', unit: 'm' }, FLAT_M],
			[{ distance: '100', unit: 'm' }, { altitude: '0', elevation: '100', unit: 'm' }],
			[{ distance: '300', unit: 'm' }, { altitude: '0', elevation: '9999', unit: 'm' }]
		]) {
			expect(tutorialTrajectory(P308_G1, range, terrain, null, null).path).toBeNull();
		}
		expect(zero).not.toHaveBeenCalled();
	});

	it('reaches the engine at the limits it takes', () => {
		const zero = vi.spyOn(Calculator.prototype, 'setWeaponZero').mockImplementation(() => {
			throw new Error('engine reached');
		});
		vi.spyOn(console, 'error').mockImplementation(() => {});
		tutorialTrajectory(P308_G1, { distance: '3000', unit: 'm' }, { altitude: '0', elevation: '500', unit: 'm' }, null, null);
		tutorialTrajectory(P308_G1, { distance: '1', unit: 'yd' }, { altitude: '0', elevation: '0', unit: 'ft' }, null, null);
		expect(zero).toHaveBeenCalledTimes(2);
	});

	it('reports a custom altitude too low for the shot, as the Ballistic page does (#125)', () => {
		vi.spyOn(console, 'error').mockImplementation(() => {});
		const low = { altitude: '-1000', altitudeUnit: 'm', pressure: '29.92', pressureUnit: 'inhg', temperature: '59', temperatureUnit: 'f', humidity: '50' };
		const page = ballisticPageTrajectory(P308_G1, { distance: '600', unit: 'yd', step: '25' }, low, null);
		expect(page).toMatchObject({ result: null, altitudeTooLow: true });
		const report = {};
		const { path } = tutorialTrajectory(P308_G1, { distance: '600', unit: 'yd' }, { altitude: '0', elevation: '0', unit: 'ft' }, low, null, { report });
		expect(path).toBeNull();
		expect(report.minimumAltitude).toBe(true);
	});
});

describe('pointAtTime', () => {
	const points = [
		{ x: 0, y: 0, z: 0, t: 0 },
		{ x: 1, y: 2, z: -10, t: 1 },
		{ x: 3, y: 2, z: -20, t: 2 }
	];

	it('interpolates between rows and stops at both ends', () => {
		expect(pointAtTime(points, -1)).toMatchObject({ x: 0, z: 0, index: 0 });
		expect(pointAtTime(points, 0.5)).toMatchObject({ x: 0.5, y: 1, z: -5, index: 0 });
		expect(pointAtTime(points, 1.5)).toMatchObject({ x: 2, y: 2, z: -15, index: 1 });
		expect(pointAtTime(points, 9)).toMatchObject({ x: 3, z: -20, index: 2 });
		expect(pointAtTime(points, NaN)).toMatchObject({ x: 0, index: 0 });
		expect(pointAtTime([], 1)).toMatchObject({ x: 0, y: 0, z: 0 });
	});
});

describe('animationDuration', () => {
	it('slows the flight down to between 1.5 and 4 s', () => {
		expect(animationDuration(0.01)).toBe(1.5);
		expect(animationDuration(0.4)).toBeCloseTo(2.1, 9);
		expect(animationDuration(5)).toBe(4);
		expect(animationDuration(NaN)).toBe(1.5);
		expect(animationDuration(-1)).toBe(1.5);
	});
});
