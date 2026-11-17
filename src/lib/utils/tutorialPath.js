/**
 * Geometry and trajectory of the 3D ballistic tutorial (#182), with no three.js: plain numbers the
 * scene turns into meshes.
 *
 * The trajectory is the Ballistic page's: calculateFullTrajectory with the uphill or downhill angle
 * of #173 (rifleman's rule), so the drop at the target is the value of the Ballistic table for the
 * same profile, distance, angle, atmosphere and wind. Nothing here changes a calculated value.
 *
 * Inputs the engine sees go through calculateFullTrajectory's own guards (input limits, wind, angle,
 * atmosphere: docs/ballistics-model.md#input-guards). The tutorial adds its own checks before it:
 * a distance within the calculators' range, a target elevation within its limits and under the
 * distance (a steeper target has no angle), so no value reaches the engine that the Ballistic page
 * would not send.
 */
import { Unit } from 'js-ballistics';
import { calculateFullTrajectory } from './ballisticCalculator.js';
import { readDecimal } from './decimal.js';
import { altitudeLimits, isUsableRange, targetElevationLimits } from './inputLimits.js';
import { MIN_TABLE_COSINE } from './scopeRange.js';

/** Metres in a yard and in a foot, exactly. */
export const METRES_PER_YARD = 0.9144;
export const METRES_PER_FOOT = 0.3048;

/** Most rows of the path: enough for a smooth curve, few enough for a quick calculation. */
export const MAX_PATH_ROWS = 200;

/** A distance in the range unit (`m` or else yd), in metres. */
export const distanceInMetres = (value, unit) => (unit === 'm' ? value : value * METRES_PER_YARD);

/** A height in the height unit (`m` or else ft), in metres. */
export const heightInMetres = (value, unit) => (unit === 'm' ? value : value * METRES_PER_FOOT);

/** Whether a box holds nothing. */
const isEmpty = (value) => value === '' || value === null || value === undefined || (typeof value === 'string' && value.trim() === '');

/**
 * A height box: empty reads as 0; NaN for text that is not a number, or not finite.
 * @param {unknown} value
 * @returns {number}
 */
function readHeight(value) {
	if (isEmpty(value)) return 0;
	const number = readDecimal(value);
	return Number.isFinite(number) ? number : NaN;
}

/**
 * @typedef {object} TutorialGeometry
 * @property {null|'distance'|'elevation'|'steep'} error - why there is no shot: the distance is out
 *   of the calculators' range (empty, 0, text, above MAX_DISTANCE), the target elevation is out of its
 *   limits or not a number, or the target is as high or as low as it is far (no angle has a sine of
 *   1 or more). null when the shot can be calculated.
 * @property {boolean} altitudeError - the shooter altitude is out of the Atmosphere card's limits or
 *   not a number. It only shapes the terrain, so it never stops the shot; the terrain then uses 0.
 * @property {number} distance - the distance as typed, in its unit (NaN when not a number)
 * @property {number} distanceM - the distance along the line of sight, in metres
 * @property {number} elevationM - the target elevation, in metres (0 for an empty box)
 * @property {number} altitudeM - the shooter altitude, in metres (0 for an empty box or an error)
 * @property {number} slopeDeg - the uphill (positive) or downhill (negative) angle of the line of
 *   sight, in degrees: asin(elevation / distance)
 * @property {number} horizontalM - the horizontal distance to the target, in metres
 */

/**
 * The tutorial's range: the distance along the line of sight (as a rangefinder gives it, and as the
 * Ballistic page takes it with an angle, #173), the target elevation relative to the shooter, and the
 * angle between them. Both are in their own units; the angle needs them in metres.
 *
 * @param {{ distance: unknown, unit: string }} range
 * @param {{ altitude: unknown, elevation: unknown, unit: string }} terrain
 * @returns {TutorialGeometry}
 */
export function tutorialGeometry(range, terrain) {
	const distance = readDecimal(range.distance);
	const elevation = readHeight(terrain.elevation);
	const altitude = readHeight(terrain.altitude);
	const elevationLimits = targetElevationLimits(terrain.unit);
	const altLimits = altitudeLimits(terrain.unit);
	const altitudeError = !(altitude >= altLimits.min && altitude <= altLimits.max);
	const base = {
		distance,
		altitudeError,
		altitudeM: altitudeError ? 0 : heightInMetres(altitude, terrain.unit)
	};

	if (!isUsableRange(distance)) {
		return { ...base, error: 'distance', distanceM: NaN, elevationM: 0, slopeDeg: 0, horizontalM: NaN };
	}
	const distanceM = distanceInMetres(distance, range.unit);
	if (!(elevation >= elevationLimits.min && elevation <= elevationLimits.max)) {
		return { ...base, error: 'elevation', distanceM, elevationM: 0, slopeDeg: 0, horizontalM: distanceM };
	}
	const elevationM = heightInMetres(elevation, terrain.unit);
	const sine = elevationM / distanceM;
	// The Ballistic page refuses a cosine under MIN_TABLE_COSINE; a target as high as it is far has
	// no angle at all.
	const cosine = Math.sqrt(Math.max(0, 1 - sine * sine));
	if (!(Math.abs(sine) < 1) || cosine < MIN_TABLE_COSINE) {
		return { ...base, error: 'steep', distanceM, elevationM, slopeDeg: 0, horizontalM: distanceM };
	}
	return {
		...base,
		error: null,
		distanceM,
		elevationM,
		slopeDeg: (Math.asin(sine) * 180) / Math.PI,
		horizontalM: distanceM * cosine
	};
}

/**
 * The Ballistic table step the path asks for: the distance cut into at most MAX_PATH_ROWS equal
 * parts of at least 1 unit (the table's smallest step), so the last row is on the target.
 *
 * @param {number} distance - in the range unit, above 0
 * @returns {number}
 */
export function pathStep(distance) {
	const parts = Math.max(1, Math.min(MAX_PATH_ROWS, Math.floor(distance)));
	return distance / parts;
}

/**
 * @typedef {object} PathPoint
 * @property {number} x - metres, right of the line of sight (+X)
 * @property {number} y - metres, up (+Y)
 * @property {number} z - metres, along the range (-Z towards the target)
 * @property {number} t - time of flight, seconds
 */

/**
 * @typedef {object} TutorialPath
 * @property {PathPoint[]} points - from the muzzle row (distance 0) to the target, in order
 * @property {PathPoint} impact - the last point: where the bullet crosses the target's distance
 * @property {number} dropM - height of the bullet above (positive) or below (negative) the line of
 *   sight at the target, in metres: the Ballistic table's elevation (slantHeight)
 * @property {number} windageM - drift at the target, metres, positive to the right
 * @property {number} time - time of flight to the target, seconds
 * @property {{ value: number, unit: 'cm'|'in' }} drop - dropM as the Ballistic table shows it:
 *   centimetres for a range in metres, inches for yards, rounded to 0.1
 * @property {{ value: number, unit: 'cm'|'in' }} windage - the same for the drift
 * @property {object} row - the engine's row at the target (TrajectoryData)
 */

/**
 * The bullet's path in scene metres, from the Ballistic page's calculation.
 *
 * Axes (docs/development.md#tutorial-models): +Y up, the range along -Z, +X to the right of a
 * shooter looking down -Z. The origin is the optic's line of sight at the shooter. The line of
 * sight goes up or down by the slope: its direction is d = (0, sin a, -cos a), and "up" across it
 * is u = (0, cos a, sin a). Each engine row at a distance s along the line of sight (rifleman's
 * rule, #173: the flat shot over s·cos a) becomes
 *
 *     s·d + slantHeight·u + windage·(1, 0, 0)
 *
 * so the muzzle row sits one sight height below the origin, and a bullet under the line of sight
 * (negative slantHeight, the Ballistic table's sign) is below it in the scene. Windage is the
 * engine's: positive is a drift to the right (ScopeReticle, getWindageValue).
 *
 * @param {object} profile - flat v2 profile
 * @param {{ distance: unknown, unit: string }} range
 * @param {{ altitude: unknown, elevation: unknown, unit: string }} terrain
 * @param {object|null} atmosphere - scopeAtmosphereParams of the tutorial's atmosphere, or null (ISA)
 * @param {unknown} wind - the stored wind (shotWinds reads it)
 * @param {{ report?: { minimumAltitude?: boolean } }} [options] - report: as for calculateFullTrajectory
 * @returns {{ geometry: TutorialGeometry, path: TutorialPath|null }}
 */
export function tutorialTrajectory(profile, range, terrain, atmosphere, wind, options = {}) {
	const geometry = tutorialGeometry(range, terrain);
	if (options.report) options.report.minimumAltitude = false;
	if (!profile || geometry.error) return { geometry, path: null };

	const unit = range.unit === 'm' ? 'm' : 'yd';
	const result = calculateFullTrajectory(
		profile,
		{ distance: geometry.distance, unit, step: pathStep(geometry.distance) },
		atmosphere,
		wind,
		{ report: options.report, elevation: { angle: geometry.slopeDeg, unit: 'deg' } }
	);
	return { geometry, path: result ? pathFromRows(result.trajectory, geometry, unit) : null };
}

/**
 * The scene points of the Ballistic table's rows (tutorialTrajectory).
 *
 * @param {Array<object>} rows - the RANGE rows of calculateFullTrajectory, distances along the line of sight
 * @param {TutorialGeometry} geometry
 * @param {'m'|'yd'} unit - the range unit
 * @returns {TutorialPath|null} null without a row at the target
 */
export function pathFromRows(rows, geometry, unit) {
	if (!rows || rows.length === 0) return null;
	const a = (geometry.slopeDeg * Math.PI) / 180;
	const sin = Math.sin(a);
	const cos = Math.cos(a);
	const toPoint = (row) => {
		const s = row.distance.In(Unit.Meter);
		const h = row.slantHeight.In(Unit.Meter);
		return {
			x: row.windage.In(Unit.Meter),
			y: s * sin + h * cos,
			z: -s * cos + h * sin,
			t: row.time
		};
	};
	const last = rows[rows.length - 1];
	// The last row must be the target's (pathStep cuts the distance in equal parts); half a unit of
	// float noise is allowed, never a row short of it.
	const lastDistance = last.distance.In(unit === 'm' ? Unit.Meter : Unit.Yard);
	if (Math.abs(lastDistance - geometry.distance) > 0.5) return null;
	const points = rows.map(toPoint);
	const shownUnit = unit === 'm' ? Unit.Centimeter : Unit.Inch;
	const round1 = (v) => Math.round(v * 10) / 10;
	return {
		points,
		impact: points[points.length - 1],
		dropM: last.slantHeight.In(Unit.Meter),
		windageM: last.windage.In(Unit.Meter),
		time: last.time,
		drop: { value: round1(last.slantHeight.In(shownUnit)), unit: unit === 'm' ? 'cm' : 'in' },
		windage: { value: round1(last.windage.In(shownUnit)), unit: unit === 'm' ? 'cm' : 'in' },
		row: last
	};
}

/**
 * The point of a path at a time of flight, between its rows (linear), for the bullet's animation.
 * Before the first row: the first point; after the last: the last.
 *
 * @param {PathPoint[]} points - in time order
 * @param {number} t - seconds
 * @returns {{ x: number, y: number, z: number, index: number }} index: the row before t
 */
export function pointAtTime(points, t) {
	if (points.length === 0) return { x: 0, y: 0, z: 0, index: 0 };
	if (!(t > points[0].t)) return { ...points[0], index: 0 };
	const lastIndex = points.length - 1;
	if (t >= points[lastIndex].t) return { ...points[lastIndex], index: lastIndex };
	let lo = 0;
	let hi = lastIndex;
	while (hi - lo > 1) {
		const mid = (lo + hi) >> 1;
		if (points[mid].t <= t) lo = mid;
		else hi = mid;
	}
	const a = points[lo];
	const b = points[hi];
	const f = b.t > a.t ? (t - a.t) / (b.t - a.t) : 0;
	return { x: a.x + (b.x - a.x) * f, y: a.y + (b.y - a.y) * f, z: a.z + (b.z - a.z) * f, index: lo };
}

/** Slowest replay of a flight, in seconds of animation per second of flight. */
const MAX_SLOW_MOTION = 40;

/**
 * How long the bullet's animation lasts, in seconds: the flight slowed down so that it is readable,
 * between 1.5 and 4 s, and never slower than MAX_SLOW_MOTION times the real flight.
 *
 * @param {number} flightTime - seconds
 * @returns {number}
 */
export function animationDuration(flightTime) {
	if (!(flightTime > 0)) return 1.5;
	return Math.min(4, Math.max(1.5, Math.min(flightTime * MAX_SLOW_MOTION, 1.5 + flightTime * 1.5)));
}
