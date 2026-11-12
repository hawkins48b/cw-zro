import {
	Weapon,
	DragModel,
	Ammo,
	Atmo,
	Shot,
	UNew,
	DragTables,
	Unit,
	TrajFlag,
	RangeError as TrajectoryRangeError
} from 'js-ballistics';
import { Calculator, ENGINE_CONFIG, EVENT_ROWS } from './ballisticEngine.js';
import { shotWinds } from './shotWind.js';
import {
	hasFiniteElevation,
	isUsableZeroDistance,
	zeroDistanceValue,
	MIN_ZERO_DISTANCE
} from './zeroDistance.js';
import { readDecimal } from './decimal.js';
import { createFlightCalculator, endedAtMinimumAltitude } from './flightStop.js';
import { stationPressure } from './stationPressure.js';
import {
	hasFlyableVelocity,
	hasUsableBullet,
	hasPositiveDensity,
	isUsableAtmosphere,
	isUsableBc,
	isUsableRange,
	isUsableSightHeight,
	tableStep
} from './inputLimits.js';

/**
 * Relative humidity for Atmo, as a fraction: 0 is 0 %, 1 is 100 %.
 *
 * Atmo divides values above 1 by 100 and keeps the rest as they are, so a percentage of 1 or
 * less would be read as a fraction: 1 % would give 100 %. Always passing the fraction avoids
 * that branch, and percentages above 1 give the same value as before.
 */
function humidityFraction(percent) {
	return percent / 100;
}

/**
 * Build the powder sensitivity options of Ammo from a profile.
 *
 * profile.tempModifier is fps per degree of profile.temperatureUnit, also when the muzzle
 * velocity is entered in m/s, and profile.temperature is the temperature that velocity was
 * measured at. js-ballistics (Ammo.getVelocityForTemp) computes, in m/s and °C:
 *
 *   v = tempModifier / (15 / v0) * (current - powderTemp) + v0
 *
 * so its modifier scales with v0. The same line in fps is
 * change = tempModifier * mvFps / 15 * degreesC, so the value below gives a change that does
 * not depend on velocity. One °C is 1.8 °F, so a fps/°F value counts 1.8 times per °C.
 *
 * @param {object} profile - flat v2 profile
 * @param {Velocity} mv    - muzzle velocity at profile.temperature
 * @returns {{ tempModifier: number, powderTemp: Temperature|null, usePowderSensitivity: boolean }}
 */
function powderSensitivity(profile, mv) {
	if (!profile.tempSensitivity || !profile.tempModifier) {
		return { tempModifier: 0, powderTemp: null, usePowderSensitivity: false };
	}
	const isCelsius = profile.temperatureUnit === 'c';
	const fpsPerCelsius = readDecimal(profile.tempModifier) * (isCelsius ? 1 : 1.8);
	const temperature = readDecimal(profile.temperature);
	return {
		tempModifier: (fpsPerCelsius * 15) / mv.In(Unit.FPS),
		powderTemp: isCelsius ? UNew.Celsius(temperature) : UNew.Fahrenheit(temperature),
		usePowderSensitivity: true
	};
}

/**
 * The Atmo of a calculation: the standard atmosphere without custom values, or null when a custom
 * value is out of its limits (isUsableAtmosphere) or the air density is not above 0
 * (hasPositiveDensity). An extreme temperature or pressure can hang the
 * engine for good, which try/catch cannot stop.
 *
 * The pressure is entered as sea-level pressure (QNH) and passed to Atmo as the pressure at the
 * site altitude (stationPressure, #107). The limits apply to the value entered.
 *
 * @param {object|null} atmosphere - { altitude, altitudeUnit, pressure, pressureUnit, temperature, temperatureUnit, humidity }
 * @returns {Atmo|null}
 */
function shotAtmosphere(atmosphere) {
	if (!atmosphere) return new Atmo(); // ICAO standard atmosphere
	const atmo = customAtmo(atmosphere);
	return atmo && hasPositiveDensity(atmo) ? atmo : null;
}

/**
 * Whether a custom atmosphere within its limits is rejected because its air density is not above 0
 * (hasPositiveDensity, #107), so that the atmosphere box can say why there is no result.
 *
 * @param {object|null} atmosphere - as for calculateShotPoint
 * @returns {boolean} false for null, for values out of their limits, and for any usable air
 */
export function hasNoAirDensity(atmosphere) {
	const atmo = atmosphere ? customAtmo(atmosphere) : null;
	return atmo !== null && !hasPositiveDensity(atmo);
}

/**
 * The Atmo of custom values, or null when a value is out of its limits. Its density is not checked.
 * @param {object} atmosphere
 * @returns {Atmo|null}
 */
function customAtmo(atmosphere) {
	const values = {
		altitude: readDecimal(atmosphere.altitude),
		pressure: readDecimal(atmosphere.pressure),
		temperature: readDecimal(atmosphere.temperature),
		humidity: readDecimal(atmosphere.humidity)
	};
	if (!isUsableAtmosphere(values, atmosphere)) return null;
	const altitude =
		atmosphere.altitudeUnit === 'm' ? UNew.Meter(values.altitude) : UNew.Foot(values.altitude);
	// The entered pressure is sea-level pressure (QNH); Atmo needs the pressure at the site (#107).
	const pressure = stationPressure(
		atmosphere.pressureUnit === 'hpa' ? UNew.hPa(values.pressure) : UNew.InHg(values.pressure),
		altitude
	);
	const temperature =
		atmosphere.temperatureUnit === 'c'
			? UNew.Celsius(values.temperature)
			: UNew.Fahrenheit(values.temperature);
	return new Atmo({ altitude, pressure, temperature, humidity: humidityFraction(values.humidity) });
}

/**
 * Compute a single trajectory point for scope view.
 *
 * @param {object} profile - flat v2 profile from the profiles store
 * @param {object} range   - { distance: string|number, unit: 'yd'|'m' }
 * @param {object|null} atmosphere - custom atmo or null for ISA
 * @param {object} wind    - { speed, speedUnit: 'mph'|'mps', direction }, direction in degrees where the
 *   wind comes from (#106), read by shotWinds
 * @param {object} [options] - optional settings
 * @param {number} [options.cantAngle=0] - rifle cant angle in degrees
 * @param {{ minimumAltitude?: boolean }} [options.report] - when given, minimumAltitude is set to
 *   whether a null result came from the engine's minimum altitude (flightStop.js, #125)
 * @returns {TrajectoryData|null} last trajectory point or null on error
 */
export function calculateShotPoint(profile, range, atmosphere, wind, options = {}) {
	const { calc, stops } = createFlightCalculator();
	if (options.report) options.report.minimumAltitude = false;
	try {
		const dist = Math.abs(readDecimal(range.distance));
		if (!isUsableRange(dist)) return null;
		if (!isUsableZeroDistance(profile.zeroDist)) return null;

		// --- Optic height ---
		const opticHeight = readDecimal(profile.opticHeight);
		if (!isUsableSightHeight(opticHeight, profile.opticHeightUnit)) return null;
		if (!hasUsableBullet(profile)) return null;
		const sightHeight =
			profile.opticHeightUnit === 'cm' ? UNew.Centimeter(opticHeight) : UNew.Inch(opticHeight);

		// --- Barrel twist (spin drift only) ---
		let twist = UNew.Inch(0);
		if (profile.spinDrift && profile.barrelTwist) {
			twist =
				profile.barrelTwistUnit === 'mm'
					? UNew.Millimeter(readDecimal(profile.barrelTwist))
					: UNew.Inch(readDecimal(profile.barrelTwist));
		}

		const weapon = new Weapon({ sightHeight, twist });

		// --- Bullet weight ---
		const weight =
			profile.bulletWeightUnit === 'g'
				? UNew.Gram(readDecimal(profile.bulletWeight))
				: UNew.Grain(readDecimal(profile.bulletWeight));

		// --- Bullet diameter ---
		const diameter =
			profile.bulletDiameterUnit === 'mm'
				? UNew.Millimeter(readDecimal(profile.bulletDiameter))
				: UNew.Inch(readDecimal(profile.bulletDiameter));

		// --- Bullet length (spin drift only) ---
		let length = UNew.Inch(2);
		if (profile.spinDrift && profile.bulletLength) {
			length =
				profile.bulletLengthUnit === 'mm'
					? UNew.Millimeter(readDecimal(profile.bulletLength))
					: UNew.Inch(readDecimal(profile.bulletLength));
		}

		// --- Drag model ---
		const bc = readDecimal(profile.bc);
		if (!isUsableBc(bc)) return null;
		const dragTable = profile.bcType === 'G7' ? DragTables.G7 : DragTables.G1;
		const dm = new DragModel({ bc, dragTable, weight, diameter, length });

		// --- Muzzle velocity ---
		const mv =
			profile.velocityUnit === 'mps'
				? UNew.MPS(readDecimal(profile.velocity))
				: UNew.FPS(readDecimal(profile.velocity));

		const ammo = new Ammo({ dm, mv, ...powderSensitivity(profile, mv) });

		// --- Atmosphere ---
		const atmo = shotAtmosphere(atmosphere);
		if (!atmo) return null;

		// --- Wind ---
		const winds = shotWinds(wind);
		if (!winds) return null;

		// --- Zero distance ---
		const zeroValue = zeroDistanceValue(profile.zeroDist);
		const zeroDistance = profile.zeroUnit === 'm' ? UNew.Meter(zeroValue) : UNew.Yard(zeroValue);

		// --- Target range ---
		const trajectoryRange =
			range.unit === 'm' ? UNew.Meter(dist) : UNew.Yard(dist);

		// --- Compute ---
		if (!hasFlyableVelocity(ammo, atmo)) return null;
		const cantDeg = options.cantAngle ?? 0;
		// A cant that is not a finite number hangs the zero solve of js-ballistics 3 for good (#77);
		// 2.2 returned a NaN elevation, which hasFiniteElevation caught. The Scope View only passes
		// a finite stored rotation (storedRotation), so this changes no result there.
		if (!Number.isFinite(Number(cantDeg))) return null;
		const shot = new Shot({ weapon, ammo, atmo, winds, cantAngle: cantDeg !== 0 ? UNew.Degree(cantDeg) : undefined });
		calc.setWeaponZero(shot, zeroDistance);
		if (!hasFiniteElevation(shot)) {
			reportStop(options.report, null, stops);
			return null;
		}
		const result = calc.fire({ shot, trajectoryRange, trajectoryStep: trajectoryRange });

		if (!result || result.length === 0) return null;
		return result.at(result.length - 1);
	} catch (e) {
		reportStop(options.report, e, stops);
		console.error('Ballistic calculation error:', e);
		return null;
	}
}

/** Records in a caller's report whether a null result came from the minimum altitude. */
function reportStop(report, error, stops) {
	if (report) report.minimumAltitude = endedAtMinimumAltitude(error, stops);
}

/**
 * Extract elevation adjustment from a trajectory point.
 * Returns the signed value in the requested unit.
 */
export function getElevationValue(point, unit) {
	if (!point) return null;
	switch (unit) {
		case 'MOA':
			return round1(point.dropAngle.In(getUnit('MOA')));
		case 'MRAD':
			return round1(point.dropAngle.In(getUnit('MRAD')));
		case 'IN':
			return round1(point.slantHeight.In(getUnit('IN')));
		case 'FT':
			return round2(point.slantHeight.In(getUnit('FT')));
		case 'CM':
			return round1(point.slantHeight.In(getUnit('CM')));
		case 'M':
			return round2(point.slantHeight.In(getUnit('M')));
		default:
			return null;
	}
}

/**
 * Extract windage adjustment from a trajectory point.
 * Returns the signed value in the requested unit.
 */
export function getWindageValue(point, unit) {
	if (!point) return null;
	switch (unit) {
		case 'MOA':
			return round1(point.windageAngle.In(getUnit('MOA')));
		case 'MRAD':
			return round1(point.windageAngle.In(getUnit('MRAD')));
		case 'IN':
			return round1(point.windage.In(getUnit('IN')));
		case 'FT':
			return round2(point.windage.In(getUnit('FT')));
		case 'CM':
			return round1(point.windage.In(getUnit('CM')));
		case 'M':
			return round2(point.windage.In(getUnit('M')));
		default:
			return null;
	}
}

function getUnit(key) {
	switch (key) {
		case 'MOA':
			return Unit.MOA;
		case 'MRAD':
			return Unit.MRad;
		case 'IN':
			return Unit.Inch;
		case 'FT':
			return Unit.Foot;
		case 'CM':
			return Unit.Centimeter;
		case 'M':
			return Unit.Meter;
		default:
			return null;
	}
}

const round1 = (v) => Math.round(v * 10) / 10;
const round2 = (v) => Math.round(v * 100) / 100;

/** Float noise allowed on the last grid row of calculateFullTrajectory, in yd or m. */
const RANGE_EPSILON = 1e-6;

/**
 * Compute full trajectory for the ballistic calculator page.
 *
 * @param {object} profile    - flat v2 profile
 * @param {object} range      - { distance, unit: 'yd'|'m', step }
 * @param {object|null} atmosphere - custom atmo or null for ISA
 * @param {object} wind       - { speed, speedUnit: 'mph'|'mps', direction }, direction where the wind
 *   comes from (#106), read by shotWinds
 * @param {object} [options]
 * @param {{ minimumAltitude?: boolean }} [options.report] - when given, minimumAltitude is set to
 *   whether a null result came from the engine's minimum altitude (flightStop.js, #125)
 * @returns {{ trajectory, chartPoints, nearZero, farZero, maxApex, maxDrop, soundSpeedFPS, subsonicDist } | null}
 *   maxApex, maxDrop and subsonicDist do not depend on range.step and stay within the range.
 */
export function calculateFullTrajectory(profile, range, atmosphere, wind, options = {}) {
	const { calc, stops } = createFlightCalculator();
	if (options.report) options.report.minimumAltitude = false;
	try {
		const maxDist = Math.abs(readDecimal(range.distance));
		const stepVal = tableStep(range.step, maxDist);
		if (!isUsableRange(maxDist)) return null;
		if (!isUsableZeroDistance(profile.zeroDist)) return null;

		// --- Optic height ---
		const opticHeight = readDecimal(profile.opticHeight);
		if (!isUsableSightHeight(opticHeight, profile.opticHeightUnit)) return null;
		if (!hasUsableBullet(profile)) return null;
		const sightHeight =
			profile.opticHeightUnit === 'cm' ? UNew.Centimeter(opticHeight) : UNew.Inch(opticHeight);

		// --- Barrel twist ---
		let twist = UNew.Inch(0);
		if (profile.spinDrift && profile.barrelTwist) {
			twist =
				profile.barrelTwistUnit === 'mm'
					? UNew.Millimeter(readDecimal(profile.barrelTwist))
					: UNew.Inch(readDecimal(profile.barrelTwist));
		}
		const weapon = new Weapon({ sightHeight, twist });

		// --- Bullet ---
		const weight =
			profile.bulletWeightUnit === 'g'
				? UNew.Gram(readDecimal(profile.bulletWeight))
				: UNew.Grain(readDecimal(profile.bulletWeight));
		const diameter =
			profile.bulletDiameterUnit === 'mm'
				? UNew.Millimeter(readDecimal(profile.bulletDiameter))
				: UNew.Inch(readDecimal(profile.bulletDiameter));
		let length = UNew.Inch(2);
		if (profile.spinDrift && profile.bulletLength) {
			length =
				profile.bulletLengthUnit === 'mm'
					? UNew.Millimeter(readDecimal(profile.bulletLength))
					: UNew.Inch(readDecimal(profile.bulletLength));
		}
		const bc = readDecimal(profile.bc);
		if (!isUsableBc(bc)) return null;
		const dragTable = profile.bcType === 'G7' ? DragTables.G7 : DragTables.G1;
		const dm = new DragModel({ bc, dragTable, weight, diameter, length });

		// --- Muzzle velocity ---
		const mv =
			profile.velocityUnit === 'mps'
				? UNew.MPS(readDecimal(profile.velocity))
				: UNew.FPS(readDecimal(profile.velocity));

		const ammo = new Ammo({ dm, mv, ...powderSensitivity(profile, mv) });

		// --- Atmosphere ---
		const atmo = shotAtmosphere(atmosphere);
		if (!atmo) return null;

		// --- Wind ---
		const winds = shotWinds(wind);
		if (!winds) return null;

		// --- Zero distance ---
		const zeroValue = zeroDistanceValue(profile.zeroDist);
		const zeroDistance = profile.zeroUnit === 'm' ? UNew.Meter(zeroValue) : UNew.Yard(zeroValue);

		// --- Range ---
		const isMetric = range.unit === 'm';
		const trajectoryRange = isMetric ? UNew.Meter(maxDist) : UNew.Yard(maxDist);
		const trajectoryStep = isMetric ? UNew.Meter(stepVal) : UNew.Yard(stepVal);

		// --- Compute ---
		if (!hasFlyableVelocity(ammo, atmo)) return null;
		const shot = new Shot({ weapon, ammo, atmo, winds });
		calc.setWeaponZero(shot, zeroDistance);
		if (!hasFiniteElevation(shot)) {
			reportStop(options.report, null, stops);
			return null;
		}
		const hitResult = calc.fire({ shot, trajectoryRange, trajectoryStep, filterFlags: EVENT_ROWS });

		if (!hitResult || hitResult.length === 0) return null;

		const allPoints = hitResult.records;
		const tablePoints = allPoints.filter((p) => p.flag & TrajFlag.RANGE);

		// --- Key trajectory points via flags ---
		const distUnit = isMetric ? Unit.Meter : Unit.Yard;
		const elevUnit = isMetric ? Unit.Centimeter : Unit.Inch;

		const nearZeroPoint = allPoints.find((p) => p.flag & TrajFlag.ZERO_UP);
		const farZeroPoint = allPoints.find((p) => p.flag & TrajFlag.ZERO_DOWN);

		const nearZero = nearZeroPoint ? round1(nearZeroPoint.distance.In(distUnit)) : null;
		const farZero = farZeroPoint ? round1(farZeroPoint.distance.In(distUnit)) : null;

		// Max ordinate, max drop and subsonic distance come from a second fire of the same shot on
		// a grid of about one unit that depends only on the range (#85, #94).
		//
		// The table rows cannot give them: they depend on the step, and flagged rows run past the
		// range. js-ballistics 3 can give an exact apex row (TrajFlag.APEX), but it is not asked for
		// (EVENT_ROWS), so that the charts keep the rows they had on 2.2. The grid fire costs about
		// as much per unit as a step 1 table.
		//
		// The grid is the whole range: a fractional range gives a step just under 1, so that the
		// grid ends on the range and this fire never goes further than the main one, which could
		// otherwise fail on a bullet that stops just past it. EVENT_ROWS keeps the zero crossing rows
		// (an arc under a unit wide can fall between grid rows) and the Mach crossing row.
		const toDistance = isMetric ? UNew.Meter : UNew.Yard;
		const gridRows = calc.fire({
			shot,
			trajectoryRange,
			trajectoryStep: toDistance(maxDist / Math.ceil(maxDist)),
			filterFlags: EVENT_ROWS
		}).records;
		// The engine can record a flagged row just past the range: those do not count for max drop
		// and subsonic distance. The tolerance only absorbs float noise on the last grid row.
		const inRange = gridRows.filter((p) => p.distance.In(distUnit) <= maxDist + RANGE_EPSILON);

		// Max ordinate: highest positive slantHeight (bullet above line of sight), or null if the
		// bullet stays below it within the range. Tolerance against a step 1 calculation: 1
		// distance unit and 0.05 in or cm, the rounding of the elevation. Against a 0.05 unit grid,
		// step 1 is within 0.5 unit and 0.0002 in or cm of the top. Rows past the far zero are
		// below the line of sight, so firing to the range gives the same apex as the fire that
		// stopped at the far zero before #94.
		let maxOrdPoint = null;
		for (const p of gridRows) {
			const elev = p.slantHeight.In(elevUnit);
			if (elev > 0 && (maxOrdPoint === null || elev > maxOrdPoint.slantHeight.In(elevUnit))) {
				maxOrdPoint = p;
			}
		}
		const maxApex = maxOrdPoint
			? {
					distance: round1(maxOrdPoint.distance.In(distUnit)),
					elevation: round1(maxOrdPoint.slantHeight.In(elevUnit))
				}
			: null;

		// --- Max drop: lowest slantHeight within the range, the muzzle included ---
		let maxDropPoint = inRange[0] ?? null;
		for (const p of inRange) {
			if (p.slantHeight.In(elevUnit) < maxDropPoint.slantHeight.In(elevUnit)) {
				maxDropPoint = p;
			}
		}
		const maxDrop = maxDropPoint
			? {
					distance: round1(maxDropPoint.distance.In(distUnit)),
					drop: round1(maxDropPoint.slantHeight.In(elevUnit))
				}
			: null;

		// --- Speed of sound at the shooter (from atmo) ---
		const soundSpeedFPS = atmo.mach.In(Unit.FPS);

		// --- Subsonic distance: first row within the range below the speed of sound, or null ---
		// The Mach crossing row is kept by EVENT_ROWS, so this is within one grid unit of the
		// crossing, and usually on it.
		const subsonicPoint = inRange.find((p) => p.velocity.In(Unit.FPS) < soundSpeedFPS);
		const subsonicDist = subsonicPoint ? round1(subsonicPoint.distance.In(distUnit)) : null;

		return { trajectory: tablePoints, chartPoints: allPoints, nearZero, farZero, maxApex, maxDrop, soundSpeedFPS, subsonicDist };
	} catch (e) {
		reportStop(options.report, e, stops);
		console.error('Ballistic trajectory error:', e);
		return null;
	}
}

/**
 * Steepest barrel elevation the MPBR search tries, in radians (about 29 degrees). A higher arc
 * carries further only up to about 0.6 rad (measured on a 300 fps load). Past that, an apex on
 * the top of the zone would no longer give the longest range, so the search stops short of it.
 */
const MPBR_MAX_ELEVATION = 0.5;

/**
 * Longest flight the MPBR search follows, in yd or m. The engine ends every flight 1410 ft below
 * the muzzle, long before this on any rifle load, so this only bounds the work on absurd inputs.
 * A shot that gets here is reported as no result, never as a capped distance.
 */
const MPBR_MAX_RANGE = 20000;

/** Fire a shot and return its rows, up to where the engine stopped it if it stopped early. */
function flightRows(calc, shot, trajectoryRange, trajectoryStep, filterFlags = TrajFlag.RANGE) {
	try {
		return calc.fire({ shot, trajectoryRange, trajectoryStep, filterFlags }).records;
	} catch (e) {
		if (e instanceof TrajectoryRangeError) return e.incompleteTrajectory;
		throw e;
	}
}

/** Rows as plain numbers in mm, for the searches below: { x: distance, y: height over LoS }. */
function heightRows(rows) {
	return rows.map((p) => ({ x: p.distance.In(Unit.Millimeter), y: p.slantHeight.In(Unit.Millimeter) }));
}

/** Index of the highest row. */
function apexIndex(rows) {
	let top = 0;
	rows.forEach((row, i) => {
		if (row.y > rows[top].y) top = i;
	});
	return top;
}

/** Distance at which the line between two rows reaches a height. */
function crossingDistance(a, b, height) {
	return a.x + ((height - a.y) / (b.y - a.y)) * (b.x - a.x);
}

/** Distance where the bullet comes up through a height before the apex, or null. */
function ascentCrossing(rows, top, height) {
	if (rows[0].y >= height) return null;
	for (let i = 1; i <= top; i++) {
		if (rows[i].y >= height) return crossingDistance(rows[i - 1], rows[i], height);
	}
	return null;
}

/** Distance where the bullet comes down through a height after the apex, or null. */
function descentCrossing(rows, top, height) {
	for (let i = top + 1; i < rows.length; i++) {
		if (rows[i].y < height) return crossingDistance(rows[i - 1], rows[i], height);
	}
	return null;
}

/**
 * Compute Maximum Point Blank Range for a given target size.
 *
 * Raising the barrel lifts the whole flight, so the bullet stays in the zone longest on the
 * highest arc that does not leave the top of the zone: the one whose apex touches halfTarget.
 * That elevation is found by bisection, as apex height rises steadily with it. Measured, this is
 * about 10 times faster than the old walk over 200 zeros, and it has no limit on the zero.
 *
 * The zero is the near crossing of that arc, where the bullet comes up through the line of sight
 * (#109), as the closest whole unit that keeps the apex inside the zone: the unit under the
 * crossing if it does, else the unit above. A further near zero gives a lower arc, so on
 * js-ballistics 3, which zeroes on the distance (#77), the unit under fits only when the crossing
 * is on a whole unit, and the unit above is the usual answer. A near crossing under 1 unit becomes
 * MIN_ZERO_DISTANCE.
 * Every value returned describes the shot zeroed at optimalZero, the one the user saves to the
 * profile, so optimalZero equals nearZero.
 *
 * Tolerance: 1 unit of near zero moves the arc far more than 1 unit of far zero does, so
 * mpbrMax can be several units under the best any zero can give. Measured against the arc whose
 * apex touches the top on js-ballistics 2.2 (#109): at most 2.2% on the baseline targets (5.9 m on
 * the .308 with 20 cm), 4% up to 30 in or 100 cm, and more on huge targets or slow loads, up to
 * about 27% where the near crossing is under 1 unit. On 3.1 (#77), against near zeros walked in
 * 0.02 unit steps on the four test loads: at most 2.6% on 8 in and 20 cm (7.6 yd on the .308 with
 * 8 in) and 3.3% on 30 in. A walk over whole near zeros gives the same mpbrMax. Distances come
 * from step 1 rows, read between rows, which adds under 0.01 unit, and the output is rounded to
 * 0.1.
 *
 * Returns null when no shot fits: the arc cannot reach the top of the zone within
 * MPBR_MAX_ELEVATION, the bullet never comes up through the line of sight (a sight height of 0
 * or below), the flight ends inside the zone, or the zone is so thin that the whole unit lands
 * past the apex, where it would be a far zero.
 *
 * Cost, as a hard bound: at most 54 fires (10 doublings, 40 halvings, the arc, two zeroed shots,
 * the chart) and two zero solves of up to 60 integrations each, run a second time from another
 * start when the first fails (ballisticEngine.js), so 294 integrations. Each one
 * ends with the flight or at MPBR_MAX_RANGE, so a call takes about 40 ms on an ordinary target
 * and seconds on an absurd input. There is no time limit: this only runs from a button.
 *
 * @param {object} profile      - flat v2 profile
 * @param {string} targetSizeStr - target vital-zone diameter (string)
 * @param {'in'|'cm'} targetUnit - unit of the target size
 * @returns {{ optimalZero, nearZero, farZero, mpbrMin, mpbrMax, maxOrdinate, halfTarget, trajectory, useMetric } | null}
 */
export function calculateMPBR(profile, targetSizeStr, targetUnit) {
	try {
		const targetSize = readDecimal(targetSizeStr);
		if (!targetSize || targetSize <= 0 || !profile) return null;

		const useMetric = targetUnit === 'cm';
		// Conversions: 1 inch = 25.4 mm, 1 cm = 10 mm, 1 yard = 914.4 mm, 1 metre = 1000 mm
		const mmPerElev = useMetric ? 10 : 25.4;
		const mmPerDist = useMetric ? 1000 : 914.4;
		const halfTargetMM = (targetSize / 2) * mmPerElev;

		const distUnitEnum = useMetric ? Unit.Meter : Unit.Yard;

		// ── Build weapon (shared across all iterations) ──────────────────
		const opticHeight = readDecimal(profile.opticHeight);
		if (!isUsableSightHeight(opticHeight, profile.opticHeightUnit)) return null;
		if (!hasUsableBullet(profile)) return null;
		const sightHeight =
			profile.opticHeightUnit === 'cm' ? UNew.Centimeter(opticHeight) : UNew.Inch(opticHeight);
		let twist = UNew.Inch(0);
		if (profile.spinDrift && profile.barrelTwist) {
			twist =
				profile.barrelTwistUnit === 'mm'
					? UNew.Millimeter(readDecimal(profile.barrelTwist))
					: UNew.Inch(readDecimal(profile.barrelTwist));
		}
		const weapon = new Weapon({ sightHeight, twist });

		// ── Build ammo ───────────────────────────────────────────────────
		const weight =
			profile.bulletWeightUnit === 'g'
				? UNew.Gram(readDecimal(profile.bulletWeight))
				: UNew.Grain(readDecimal(profile.bulletWeight));
		const diameter =
			profile.bulletDiameterUnit === 'mm'
				? UNew.Millimeter(readDecimal(profile.bulletDiameter))
				: UNew.Inch(readDecimal(profile.bulletDiameter));
		let length = UNew.Inch(2);
		if (profile.spinDrift && profile.bulletLength) {
			length =
				profile.bulletLengthUnit === 'mm'
					? UNew.Millimeter(readDecimal(profile.bulletLength))
					: UNew.Inch(readDecimal(profile.bulletLength));
		}
		const bc = readDecimal(profile.bc);
		if (!isUsableBc(bc)) return null;
		const dragTable = profile.bcType === 'G7' ? DragTables.G7 : DragTables.G1;
		const dm = new DragModel({ bc, dragTable, weight, diameter, length });

		const mv =
			profile.velocityUnit === 'mps'
				? UNew.MPS(readDecimal(profile.velocity))
				: UNew.FPS(readDecimal(profile.velocity));
		const ammo = new Ammo({ dm, mv });

		// ── Standard atmosphere (ISA) ────────────────────────────────────
		const atmo = new Atmo();

		if (!hasFlyableVelocity(ammo, atmo)) return null;
		const muzzleFps = ammo.getVelocityForTemp(atmo.powderTemp).In(Unit.FPS);

		const toDistance = useMetric ? UNew.Meter : UNew.Yard;
		const oneUnit = toDistance(1);
		const longestFlight = toDistance(MPBR_MAX_RANGE);
		const shot = new Shot({ weapon, ammo, atmo, winds: [] });
		const calc = new Calculator();

		// ── Search: the elevation that puts the apex on the top of the zone ──
		// The apex of the same shot in a vacuum is further out than with drag, so firing that far
		// is enough, and it saves following the bullet down on every try.
		const gravity = Math.abs(ENGINE_CONFIG.gravityConstant);
		const apexHeight = (elevation) => {
			weapon.zeroElevation = UNew.Radian(elevation);
			const vacuumApexFeet = (muzzleFps ** 2 * Math.sin(2 * elevation)) / (2 * gravity);
			const reach = Math.min(UNew.Foot(vacuumApexFeet).In(distUnitEnum) + 1, MPBR_MAX_RANGE);
			const rows = heightRows(flightRows(calc, shot, toDistance(reach), oneUnit));
			return rows[apexIndex(rows)].y;
		};

		// Both loops have a hard bound, part of the cost above: the elevation limit stops the first.
		let low = 0;
		let high = 0.001;
		while (apexHeight(high) < halfTargetMM) {
			if (high >= MPBR_MAX_ELEVATION) return null;
			low = high;
			high = Math.min(high * 2, MPBR_MAX_ELEVATION);
		}
		// 1e-8 rad moves the far crossing of a 30 in target by under 0.01 yd.
		for (let i = 0; i < 40 && high - low > 1e-8; i++) {
			const middle = (low + high) / 2;
			if (apexHeight(middle) > halfTargetMM) high = middle;
			else low = middle;
		}

		// ── Zero: the near crossing of that arc, as a whole unit ─────────
		// A further near zero gives a lower arc, so the unit above the crossing keeps the apex
		// inside the zone. The one below can too, see below.
		weapon.zeroElevation = UNew.Radian(low);
		const arc = heightRows(flightRows(calc, shot, longestFlight, oneUnit));
		const nearCrossingMM = ascentCrossing(arc, apexIndex(arc), 0);
		// With no sight height over the bore, the bullet never comes up through the line of sight.
		if (nearCrossingMM === null) return null;
		const nearCrossing = nearCrossingMM / mmPerDist;

		// ── The shot the user gets at that zero ──────────────────────────
		// Starting from no elevation, as every other calculation does on a saved zero.
		const zeroedRows = (zero) => {
			weapon.zeroElevation = UNew.Radian(0);
			calc.setWeaponZero(shot, toDistance(zero));
			if (!hasFiniteElevation(shot)) return null;
			return heightRows(flightRows(calc, shot, longestFlight, oneUnit));
		};
		// Try the unit under the crossing first, then the unit above. js-ballistics 2.2 zeroed on its
		// first step past the distance, about 0.1 yd further out, which lowered the arc, so the unit
		// under often fitted (21 yd for a crossing at 21.06 yd). 3.1 zeroes on the distance (#77), so
		// the unit under gives a higher arc than the best one and fits only on a whole unit crossing:
		// that crossing now gives 22 yd. A crossing under 1 unit comes up to MIN_ZERO_DISTANCE, a lower
		// arc, and never to a zero of 0, which hung the 2.2 solver.
		let optimalZero = Math.max(Math.floor(nearCrossing), MIN_ZERO_DISTANCE);
		let rows = zeroedRows(optimalZero);
		if (!rows) return null;
		if (rows[apexIndex(rows)].y > halfTargetMM && optimalZero < Math.ceil(nearCrossing)) {
			optimalZero = Math.ceil(nearCrossing);
			rows = zeroedRows(optimalZero);
			if (!rows) return null;
		}
		const top = apexIndex(rows);
		const maxOrdMM = rows[top].y;
		const maxOrdDistMM = rows[top].x;
		// No whole unit zero keeps the apex inside a zone this thin.
		if (maxOrdMM > halfTargetMM) return null;

		// The flight can end inside the zone, on a slow load or a huge target.
		const mpbrMaxDistMM = descentCrossing(rows, top, -halfTargetMM);
		if (mpbrMaxDistMM === null) return null;

		// The bullet enters the zone on the way up, unless the muzzle is already inside it.
		const firstInside = rows.findIndex((row) => row.y >= -halfTargetMM);
		const mpbrMinDistMM =
			firstInside > 0
				? crossingDistance(rows[firstInside - 1], rows[firstInside], -halfTargetMM)
				: 0;

		// ── Final detailed trajectory for chart ──────────────────────────
		const chartMaxDist = Math.ceil((mpbrMaxDistMM / mmPerDist) * 1.2 / 50) * 50;
		const chartPoints = flightRows(calc, shot, toDistance(chartMaxDist), toDistance(5), EVENT_ROWS);
		if (!chartPoints || chartPoints.length === 0) return null;

		// Near/far zero via flags, with manual fallback
		let nearZero = null;
		let farZero = null;
		const nzPt = chartPoints.find((p) => (p.flag & TrajFlag.ZERO_UP) !== 0);
		const fzPt = chartPoints.find((p) => (p.flag & TrajFlag.ZERO_DOWN) !== 0);
		if (nzPt) nearZero = Math.round(nzPt.distance.In(distUnitEnum));
		if (fzPt) farZero = Math.round(fzPt.distance.In(distUnitEnum));
		if (nearZero === null || farZero === null) {
			for (let i = 1; i < chartPoints.length; i++) {
				const prev = chartPoints[i - 1].slantHeight.In(Unit.Millimeter);
				const curr = chartPoints[i].slantHeight.In(Unit.Millimeter);
				if (prev < 0 && curr >= 0 && nearZero === null) {
					nearZero = Math.round(chartPoints[i].distance.In(distUnitEnum));
				} else if (prev >= 0 && curr < 0 && nearZero !== null && farZero === null) {
					farZero = Math.round(chartPoints[i].distance.In(distUnitEnum));
				}
			}
		}

		// On a thin zone the whole unit can land past the apex, where it becomes a far zero.
		if (nearZero !== optimalZero) return null;

		const r1 = (v) => Math.round(v * 10) / 10;
		return {
			optimalZero,
			nearZero,
			farZero,
			mpbrMin: r1(mpbrMinDistMM / mmPerDist),
			mpbrMax: r1(mpbrMaxDistMM / mmPerDist),
			maxOrdinate: {
				elevation: r1(maxOrdMM / mmPerElev),
				distance: r1(maxOrdDistMM / mmPerDist)
			},
			halfTarget: r1(halfTargetMM / mmPerElev),
			trajectory: chartPoints,
			useMetric
		};
	} catch (e) {
		console.error('MPBR calculation error:', e);
		return null;
	}
}
