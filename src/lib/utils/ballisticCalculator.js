import {
	Calculator,
	Weapon,
	DragModel,
	Ammo,
	Atmo,
	Wind,
	Shot,
	UNew,
	Table,
	Unit,
	TrajFlag,
	TrajectoryRangeError,
	defaultEngineConfig
} from 'js-ballistics';
import { hasFiniteElevation, isUsableZeroDistance } from './zeroDistance.js';

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
	const fpsPerCelsius = parseFloat(profile.tempModifier) * (isCelsius ? 1 : 1.8);
	const temperature = parseFloat(profile.temperature);
	return {
		tempModifier: (fpsPerCelsius * 15) / mv.In(Unit.FPS),
		powderTemp: isCelsius ? UNew.Celsius(temperature) : UNew.Fahrenheit(temperature),
		usePowderSensitivity: true
	};
}

/**
 * Whether the muzzle velocity at the current temperature is one the solver can work with.
 *
 * A sensitivity setting can take it to 0 or NaN, and js-ballistics then never leaves its
 * integration loop (the zero search returns NaN instead of throwing), which try/catch cannot
 * stop. Below cMinimumVelocity (fps) the engine stops on its first step anyway.
 *
 * @param {Ammo} ammo
 * @param {Atmo} atmo
 * @returns {boolean}
 */
function hasFlyableVelocity(ammo, atmo) {
	const fps = ammo.getVelocityForTemp(atmo.powderTemp).In(Unit.FPS);
	return Number.isFinite(fps) && fps >= defaultEngineConfig.cMinimumVelocity;
}

/**
 * Compute a single trajectory point for scope view.
 *
 * @param {object} profile - flat v2 profile from the profiles store
 * @param {object} range   - { distance: string|number, unit: 'yd'|'m' }
 * @param {object|null} atmosphere - custom atmo or null for ISA
 * @param {object} wind    - { speed, speedUnit: 'mph'|'mps', direction, directionUnit: 'clock'|'deg' }
 * @param {object} [options] - optional settings
 * @param {number} [options.cantAngle=0] - rifle cant angle in degrees
 * @returns {TrajectoryData|null} last trajectory point or null on error
 */
export function calculateShotPoint(profile, range, atmosphere, wind, options = {}) {
	try {
		const dist = Math.abs(parseFloat(range.distance));
		if (!dist || dist <= 0) return null;
		if (!isUsableZeroDistance(profile.zeroDist)) return null;

		// --- Optic height ---
		const sightHeight =
			profile.opticHeightUnit === 'cm'
				? UNew.Centimeter(parseFloat(profile.opticHeight))
				: UNew.Inch(parseFloat(profile.opticHeight));
		// An empty height is NaN, which the engine never leaves its loop on.
		if (!Number.isFinite(sightHeight.In(Unit.Inch))) return null;

		// --- Barrel twist (spin drift only) ---
		let twist = UNew.Inch(0);
		if (profile.spinDrift && profile.barrelTwist) {
			twist =
				profile.barrelTwistUnit === 'mm'
					? UNew.Millimeter(parseFloat(profile.barrelTwist))
					: UNew.Inch(parseFloat(profile.barrelTwist));
		}

		const weapon = new Weapon({ sightHeight, twist });

		// --- Bullet weight ---
		const weight =
			profile.bulletWeightUnit === 'g'
				? UNew.Gram(parseFloat(profile.bulletWeight))
				: UNew.Grain(parseFloat(profile.bulletWeight));

		// --- Bullet diameter ---
		const diameter =
			profile.bulletDiameterUnit === 'mm'
				? UNew.Millimeter(parseFloat(profile.bulletDiameter))
				: UNew.Inch(parseFloat(profile.bulletDiameter));

		// --- Bullet length (spin drift only) ---
		let length = UNew.Inch(2);
		if (profile.spinDrift && profile.bulletLength) {
			length =
				profile.bulletLengthUnit === 'mm'
					? UNew.Millimeter(parseFloat(profile.bulletLength))
					: UNew.Inch(parseFloat(profile.bulletLength));
		}

		// --- Drag model ---
		const bc = parseFloat(profile.bc);
		if (!bc || bc <= 0) return null;
		const dragTable = profile.bcType === 'G7' ? Table.G7 : Table.G1;
		const dm = new DragModel({ bc, dragTable, weight, diameter, length });

		// --- Muzzle velocity ---
		const mv =
			profile.velocityUnit === 'mps'
				? UNew.MPS(parseFloat(profile.velocity))
				: UNew.FPS(parseFloat(profile.velocity));

		const ammo = new Ammo({ dm, mv, ...powderSensitivity(profile, mv) });

		// --- Atmosphere ---
		let atmo;
		if (atmosphere) {
			const altVal = parseFloat(atmosphere.altitude);
			const pressVal = parseFloat(atmosphere.pressure);
			const tempVal = parseFloat(atmosphere.temperature);
			const humVal = parseFloat(atmosphere.humidity);

			// All values must be finite; pressure must be positive; humidity 0–100
			if (
				!isFinite(altVal) ||
				!isFinite(pressVal) || pressVal <= 0 ||
				!isFinite(tempVal) ||
				!isFinite(humVal) || humVal < 0 || humVal > 100
			) return null;

			const altitude =
				atmosphere.altitudeUnit === 'm' ? UNew.Meter(altVal) : UNew.Foot(altVal);
			const pressure =
				atmosphere.pressureUnit === 'hpa' ? UNew.hPa(pressVal) : UNew.InHg(pressVal);
			const temperature =
				atmosphere.temperatureUnit === 'c' ? UNew.Celsius(tempVal) : UNew.Fahrenheit(tempVal);
			atmo = new Atmo({ altitude, pressure, temperature, humidity: humidityFraction(humVal) });
		} else {
			atmo = new Atmo(); // ICAO standard atmosphere
		}

		// --- Wind ---
		const winds = [];
		if (wind && parseFloat(wind.speed) > 0) {
			const velocity =
				wind.speedUnit === 'mps'
					? UNew.MPS(parseFloat(wind.speed))
					: UNew.MPH(parseFloat(wind.speed));
			const directionFrom = UNew.Degree(parseFloat(wind.direction));
			winds.push(new Wind({ velocity, directionFrom }));
		}

		// --- Zero distance ---
		const zeroDistance =
			profile.zeroUnit === 'm'
				? UNew.Meter(Math.abs(parseFloat(profile.zeroDist)))
				: UNew.Yard(Math.abs(parseFloat(profile.zeroDist)));

		// --- Target range ---
		const trajectoryRange =
			range.unit === 'm' ? UNew.Meter(dist) : UNew.Yard(dist);

		// --- Compute ---
		if (!hasFlyableVelocity(ammo, atmo)) return null;
		const cantDeg = options.cantAngle ?? 0;
		const shot = new Shot({ weapon, ammo, atmo, winds, cantAngle: cantDeg !== 0 ? UNew.Degree(cantDeg) : undefined });
		const calc = new Calculator();
		calc.setWeaponZero(shot, zeroDistance);
		if (!hasFiniteElevation(shot)) return null;
		const result = calc.fire({ shot, trajectoryRange, trajectoryStep: trajectoryRange });

		if (!result || result.length === 0) return null;
		return result.at(result.length - 1);
	} catch (e) {
		console.error('Ballistic calculation error:', e);
		return null;
	}
}

/**
 * Extract elevation adjustment from a trajectory point.
 * Returns the signed value in the requested unit.
 */
export function getElevationValue(point, unit) {
	if (!point) return null;
	switch (unit) {
		case 'MOA':
			return round1(point.dropAdjustment.In(getUnit('MOA')));
		case 'MRAD':
			return round1(point.dropAdjustment.In(getUnit('MRAD')));
		case 'IN':
			return round1(point.targetDrop.In(getUnit('IN')));
		case 'FT':
			return round2(point.targetDrop.In(getUnit('FT')));
		case 'CM':
			return round1(point.targetDrop.In(getUnit('CM')));
		case 'M':
			return round2(point.targetDrop.In(getUnit('M')));
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
			return round1(point.windageAdjustment.In(getUnit('MOA')));
		case 'MRAD':
			return round1(point.windageAdjustment.In(getUnit('MRAD')));
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

/**
 * Compute full trajectory for the ballistic calculator page.
 *
 * @param {object} profile    - flat v2 profile
 * @param {object} range      - { distance, unit: 'yd'|'m', step }
 * @param {object|null} atmosphere - custom atmo or null for ISA
 * @param {object} wind       - { speed, speedUnit: 'mph'|'mps', direction }
 * @returns {{ trajectory, chartPoints, nearZero, farZero, maxApex, soundSpeedFPS } | null}
 */
export function calculateFullTrajectory(profile, range, atmosphere, wind) {
	try {
		const maxDist = Math.abs(parseFloat(range.distance));
		const stepVal = Math.max(1, Math.abs(parseFloat(range.step)) || 25);
		if (!maxDist || maxDist <= 0 || maxDist > 3000) return null;
		if (!isUsableZeroDistance(profile.zeroDist)) return null;

		// --- Optic height ---
		const sightHeight =
			profile.opticHeightUnit === 'cm'
				? UNew.Centimeter(parseFloat(profile.opticHeight))
				: UNew.Inch(parseFloat(profile.opticHeight));
		// An empty height is NaN, which the engine never leaves its loop on.
		if (!Number.isFinite(sightHeight.In(Unit.Inch))) return null;

		// --- Barrel twist ---
		let twist = UNew.Inch(0);
		if (profile.spinDrift && profile.barrelTwist) {
			twist =
				profile.barrelTwistUnit === 'mm'
					? UNew.Millimeter(parseFloat(profile.barrelTwist))
					: UNew.Inch(parseFloat(profile.barrelTwist));
		}
		const weapon = new Weapon({ sightHeight, twist });

		// --- Bullet ---
		const weight =
			profile.bulletWeightUnit === 'g'
				? UNew.Gram(parseFloat(profile.bulletWeight))
				: UNew.Grain(parseFloat(profile.bulletWeight));
		const diameter =
			profile.bulletDiameterUnit === 'mm'
				? UNew.Millimeter(parseFloat(profile.bulletDiameter))
				: UNew.Inch(parseFloat(profile.bulletDiameter));
		let length = UNew.Inch(2);
		if (profile.spinDrift && profile.bulletLength) {
			length =
				profile.bulletLengthUnit === 'mm'
					? UNew.Millimeter(parseFloat(profile.bulletLength))
					: UNew.Inch(parseFloat(profile.bulletLength));
		}
		const bc = parseFloat(profile.bc);
		if (!bc || bc <= 0) return null;
		const dragTable = profile.bcType === 'G7' ? Table.G7 : Table.G1;
		const dm = new DragModel({ bc, dragTable, weight, diameter, length });

		// --- Muzzle velocity ---
		const mv =
			profile.velocityUnit === 'mps'
				? UNew.MPS(parseFloat(profile.velocity))
				: UNew.FPS(parseFloat(profile.velocity));

		const ammo = new Ammo({ dm, mv, ...powderSensitivity(profile, mv) });

		// --- Atmosphere ---
		let atmo;
		if (atmosphere) {
			const altVal = parseFloat(atmosphere.altitude);
			const pressVal = parseFloat(atmosphere.pressure);
			const tempVal = parseFloat(atmosphere.temperature);
			const humVal = parseFloat(atmosphere.humidity);
			if (
				!isFinite(altVal) ||
				!isFinite(pressVal) || pressVal <= 0 ||
				!isFinite(tempVal) ||
				!isFinite(humVal) || humVal < 0 || humVal > 100
			)
				return null;
			const altitude =
				atmosphere.altitudeUnit === 'm' ? UNew.Meter(altVal) : UNew.Foot(altVal);
			const pressure =
				atmosphere.pressureUnit === 'hpa' ? UNew.hPa(pressVal) : UNew.InHg(pressVal);
			const temperature =
				atmosphere.temperatureUnit === 'c' ? UNew.Celsius(tempVal) : UNew.Fahrenheit(tempVal);
			atmo = new Atmo({ altitude, pressure, temperature, humidity: humidityFraction(humVal) });
		} else {
			atmo = new Atmo();
		}

		// --- Wind ---
		const winds = [];
		if (wind && parseFloat(wind.speed) > 0) {
			const velocity =
				wind.speedUnit === 'mps'
					? UNew.MPS(parseFloat(wind.speed))
					: UNew.MPH(parseFloat(wind.speed));
			const directionFrom = UNew.Degree(parseFloat(wind.direction));
			winds.push(new Wind({ velocity, directionFrom }));
		}

		// --- Zero distance ---
		const zeroDistance =
			profile.zeroUnit === 'm'
				? UNew.Meter(Math.abs(parseFloat(profile.zeroDist)))
				: UNew.Yard(Math.abs(parseFloat(profile.zeroDist)));

		// --- Range ---
		const isMetric = range.unit === 'm';
		const trajectoryRange = isMetric ? UNew.Meter(maxDist) : UNew.Yard(maxDist);
		const trajectoryStep = isMetric ? UNew.Meter(stepVal) : UNew.Yard(stepVal);

		// --- Compute ---
		if (!hasFlyableVelocity(ammo, atmo)) return null;
		const shot = new Shot({ weapon, ammo, atmo, winds });
		const calc = new Calculator();
		calc.setWeaponZero(shot, zeroDistance);
		if (!hasFiniteElevation(shot)) return null;
		const hitResult = calc.fire({ shot, trajectoryRange, trajectoryStep, extraData: true });

		if (!hitResult || hitResult.length === 0) return null;

		const allPoints = hitResult.trajectory;
		const tablePoints = allPoints.filter((p) => p.flag & TrajFlag.RANGE);

		// --- Key trajectory points via flags ---
		const distUnit = isMetric ? Unit.Meter : Unit.Yard;
		const elevUnit = isMetric ? Unit.Centimeter : Unit.Inch;

		const nearZeroPoint = allPoints.find((p) => p.flag & TrajFlag.ZERO_UP);
		const farZeroPoint = allPoints.find((p) => p.flag & TrajFlag.ZERO_DOWN);

		const nearZero = nearZeroPoint ? round1(nearZeroPoint.distance.In(distUnit)) : null;
		const farZero = farZeroPoint ? round1(farZeroPoint.distance.In(distUnit)) : null;

		// Max ordinate: highest positive targetDrop (bullet above line of sight), or null if the
		// bullet stays below it within the range.
		//
		// The table rows cannot give this: they depend on the step, and flagged rows run past the
		// range. js-ballistics has no apex point either: TrajFlag.APEX exists but the engine never
		// sets it. So the same shot is fired again on a grid of one unit that depends only on the
		// range. It costs about as much as the main fire per yard, and stopping at the far zero
		// (the apex always comes before it) makes that about 0.3 ms for a 100 yd zero.
		//
		// Tolerance against a step 1 calculation: 1 distance unit and 0.05 in or cm, the rounding
		// of the elevation. A whole range gives the very rows of step 1. A fractional one gives a
		// step just under 1, so that the grid ends on the range and this fire never goes further
		// than the main one, which could otherwise fail on a bullet that stops just past it.
		// Against a 0.05 unit grid, step 1 is within 0.5 unit and 0.0002 in or cm of the top.
		const toDistance = isMetric ? UNew.Meter : UNew.Yard;
		const apexRange = farZeroPoint
			? Math.min(maxDist, farZeroPoint.distance.In(distUnit))
			: maxDist;
		const apexRows = calc.fire({
			shot,
			trajectoryRange: toDistance(apexRange),
			trajectoryStep: toDistance(maxDist / Math.ceil(maxDist)),
			// Keeps the zero crossing rows: an arc under a unit wide can fall between grid rows.
			extraData: true
		}).trajectory;

		let maxOrdPoint = null;
		for (const p of apexRows) {
			const elev = p.targetDrop.In(elevUnit);
			if (elev > 0 && (maxOrdPoint === null || elev > maxOrdPoint.targetDrop.In(elevUnit))) {
				maxOrdPoint = p;
			}
		}
		const maxApex = maxOrdPoint
			? {
					distance: round1(maxOrdPoint.distance.In(distUnit)),
					elevation: round1(maxOrdPoint.targetDrop.In(elevUnit))
				}
			: null;

		// --- Max drop: point with the lowest elevation (highest drop below zero) ---
		let maxDropPoint = allPoints[0];
		for (const p of allPoints) {
			if (p.targetDrop.In(elevUnit) < maxDropPoint.targetDrop.In(elevUnit)) {
				maxDropPoint = p;
			}
		}
		const maxDrop = maxDropPoint
			? {
					distance: round1(maxDropPoint.distance.In(distUnit)),
					drop: round1(maxDropPoint.targetDrop.In(elevUnit))
				}
			: null;

		// --- Speed of sound (from atmo) ---
		const soundSpeedFPS = atmo.mach.In(Unit.FPS);

		// --- Subsonic distance: first point where bullet velocity drops below speed of sound ---
		const subsonicPoint = allPoints.find((p) => p.velocity.In(Unit.FPS) < soundSpeedFPS);
		const subsonicDist = subsonicPoint ? round1(subsonicPoint.distance.In(distUnit)) : null;

		return { trajectory: tablePoints, chartPoints: allPoints, nearZero, farZero, maxApex, maxDrop, soundSpeedFPS, subsonicDist };
	} catch (e) {
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

/**
 * Limits of the inputs the MPBR search fires, the same as the validation solver's. Far outside
 * them an engine step overshoots and js-ballistics can stay in its loop for good: it does at a
 * BC of 0.00001 or 1e15 fps, while values on either side return. A hang cannot be caught.
 */
const MPBR_MIN_BC = 0.01;
const MPBR_MAX_VELOCITY_FPS = 10000;

/** Fire a shot and return its rows, up to where the engine stopped it if it stopped early. */
function flightRows(calc, shot, trajectoryRange, trajectoryStep, extraData = false) {
	try {
		return calc.fire({ shot, trajectoryRange, trajectoryStep, extraData }).trajectory;
	} catch (e) {
		if (e instanceof TrajectoryRangeError) return e.incompleteTrajectory;
		throw e;
	}
}

/** Rows as plain numbers in mm, for the searches below: { x: distance, y: height over LoS }. */
function heightRows(rows) {
	return rows.map((p) => ({ x: p.distance.In(Unit.Millimeter), y: p.targetDrop.In(Unit.Millimeter) }));
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
 * The zero is always the far crossing, in whole units, rounded down so the apex stays inside the
 * zone. It also moves the shot far less per unit than a near crossing does: on a 30 in target,
 * 1 yd of near zero moves the arc by inches. Every value returned describes the shot zeroed at
 * optimalZero, the one the user saves to the profile, so optimalZero equals farZero.
 *
 * Tolerance: mpbrMax is at most 1 distance unit under the best any zero can give, and that is
 * the cost of a whole unit zero. Distances come from step 1 rows, read between rows, which adds
 * under 0.01 unit, and the output is rounded to 0.1.
 *
 * Returns null when no shot fits: the arc cannot reach the top of the zone within
 * MPBR_MAX_ELEVATION, the flight ends inside the zone, or the zone is so thin that no whole
 * unit zero stays inside it.
 *
 * Cost, as a hard bound: at most 54 fires (10 doublings, 40 halvings, the arc, two zeroed shots,
 * the chart) and two zero solves of up to 60 integrations each, so 174 integrations. Each one
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
		const targetSize = parseFloat(targetSizeStr);
		if (!targetSize || targetSize <= 0 || !profile) return null;

		const useMetric = targetUnit === 'cm';
		// Conversions: 1 inch = 25.4 mm, 1 cm = 10 mm, 1 yard = 914.4 mm, 1 metre = 1000 mm
		const mmPerElev = useMetric ? 10 : 25.4;
		const mmPerDist = useMetric ? 1000 : 914.4;
		const halfTargetMM = (targetSize / 2) * mmPerElev;

		const distUnitEnum = useMetric ? Unit.Meter : Unit.Yard;

		// ── Build weapon (shared across all iterations) ──────────────────
		const sightHeight =
			profile.opticHeightUnit === 'cm'
				? UNew.Centimeter(parseFloat(profile.opticHeight))
				: UNew.Inch(parseFloat(profile.opticHeight));
		let twist = UNew.Inch(0);
		if (profile.spinDrift && profile.barrelTwist) {
			twist =
				profile.barrelTwistUnit === 'mm'
					? UNew.Millimeter(parseFloat(profile.barrelTwist))
					: UNew.Inch(parseFloat(profile.barrelTwist));
		}
		// An empty height is NaN, which the engine never leaves its loop on.
		if (!Number.isFinite(sightHeight.In(Unit.Inch))) return null;
		const weapon = new Weapon({ sightHeight, twist });

		// ── Build ammo ───────────────────────────────────────────────────
		const weight =
			profile.bulletWeightUnit === 'g'
				? UNew.Gram(parseFloat(profile.bulletWeight))
				: UNew.Grain(parseFloat(profile.bulletWeight));
		const diameter =
			profile.bulletDiameterUnit === 'mm'
				? UNew.Millimeter(parseFloat(profile.bulletDiameter))
				: UNew.Inch(parseFloat(profile.bulletDiameter));
		let length = UNew.Inch(2);
		if (profile.spinDrift && profile.bulletLength) {
			length =
				profile.bulletLengthUnit === 'mm'
					? UNew.Millimeter(parseFloat(profile.bulletLength))
					: UNew.Inch(parseFloat(profile.bulletLength));
		}
		const bc = parseFloat(profile.bc);
		if (!(bc >= MPBR_MIN_BC)) return null;
		const dragTable = profile.bcType === 'G7' ? Table.G7 : Table.G1;
		const dm = new DragModel({ bc, dragTable, weight, diameter, length });

		const mv =
			profile.velocityUnit === 'mps'
				? UNew.MPS(parseFloat(profile.velocity))
				: UNew.FPS(parseFloat(profile.velocity));
		const ammo = new Ammo({ dm, mv });

		// ── Standard atmosphere (ISA) ────────────────────────────────────
		const atmo = new Atmo();

		if (!hasFlyableVelocity(ammo, atmo)) return null;
		const muzzleFps = ammo.getVelocityForTemp(atmo.powderTemp).In(Unit.FPS);
		if (muzzleFps >= MPBR_MAX_VELOCITY_FPS) return null;

		const toDistance = useMetric ? UNew.Meter : UNew.Yard;
		const oneUnit = toDistance(1);
		const longestFlight = toDistance(MPBR_MAX_RANGE);
		const shot = new Shot({ weapon, ammo, atmo, winds: [] });
		const calc = new Calculator();

		// ── Search: the elevation that puts the apex on the top of the zone ──
		// The apex of the same shot in a vacuum is further out than with drag, so firing that far
		// is enough, and it saves following the bullet down on every try.
		const gravity = Math.abs(defaultEngineConfig.cGravityConstant);
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

		// ── Zero: the far crossing of that arc, down to a whole unit ─────
		weapon.zeroElevation = UNew.Radian(low);
		const arc = heightRows(flightRows(calc, shot, longestFlight, oneUnit));
		const farCrossingMM = descentCrossing(arc, apexIndex(arc), 0);
		if (farCrossingMM === null) return null;
		let optimalZero = Math.floor(farCrossingMM / mmPerDist);

		// ── The shot the user gets at that zero ──────────────────────────
		// Starting from no elevation, as every other calculation does on a saved zero.
		const zeroedRows = (zero) => {
			weapon.zeroElevation = UNew.Radian(0);
			calc.setWeaponZero(shot, toDistance(zero));
			if (!hasFiniteElevation(shot)) return null;
			return heightRows(flightRows(calc, shot, longestFlight, oneUnit));
		};
		// A zero of 0 would hang the solver.
		if (optimalZero < 1) return null;
		let rows = zeroedRows(optimalZero);
		if (!rows) return null;
		// The solver zeroes on its first step past the distance, about 0.1 yd further out, so a far
		// crossing just over a whole unit can put the apex over the top: take the unit below.
		if (rows[apexIndex(rows)].y > halfTargetMM) {
			optimalZero -= 1;
			if (optimalZero < 1) return null;
			rows = zeroedRows(optimalZero);
			if (!rows) return null;
		}
		const top = apexIndex(rows);
		const maxOrdMM = rows[top].y;
		const maxOrdDistMM = rows[top].x;
		// No whole unit lies inside a zone this thin.
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
		const chartPoints = flightRows(calc, shot, toDistance(chartMaxDist), toDistance(5), true);
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
				const prev = chartPoints[i - 1].targetDrop.In(Unit.Millimeter);
				const curr = chartPoints[i].targetDrop.In(Unit.Millimeter);
				if (prev < 0 && curr >= 0 && nearZero === null) {
					nearZero = Math.round(chartPoints[i].distance.In(distUnitEnum));
				} else if (prev >= 0 && curr < 0 && nearZero !== null && farZero === null) {
					farZero = Math.round(chartPoints[i].distance.In(distUnitEnum));
				}
			}
		}

		// On a zone a few thousandths of an inch thin, the whole unit can land on the rising side.
		if (farZero !== optimalZero) return null;

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
