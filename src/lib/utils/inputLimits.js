import { UNew, Unit, defaultEngineConfig } from 'js-ballistics';
import { readDecimal } from './decimal.js';

/**
 * Limits of the values the engine is given, shared by the profile form and every calculation path
 * (#89, #90, #92, #93, #119, #125; owner decisions of 2026-11-10).
 *
 * js-ballistics runs synchronously and can stay in its loop for good far outside normal values,
 * which neither try/catch nor a timeout can stop, so the calculators check these before they call
 * it. They cover every real shooting condition and stop before the values that were measured to
 * hang. Within them, 3888 worst-case combinations on f40933f (G1 and G7, BC 0.01 to 2, 60 to 9999
 * fps, sight height -10 to 10 in, zero 1 to 3000, both ends of temperature and pressure, no wind and
 * 223 mph at 0° and 90°) all returned, the slowest in 2.2 s on a 3000 zero. Values out of them give
 * no result, or a form error, and never change a result inside them.
 */

/** Lowest BC, G1 or G7. A BC of 0.00001 ran until killed. */
export const MIN_BC = 0.01;

/** Muzzle velocity must be under this, in fps, in whichever unit it was entered. */
export const MAX_VELOCITY_FPS = 10000;

/** Slowest muzzle velocity, in fps: the engine stops a flight below it on its first step. */
export const MIN_VELOCITY_FPS = defaultEngineConfig.cMinimumVelocity;

/** Highest sight height either way, in the unit entered: 10 in, or 25.4 cm. */
export const MAX_SIGHT_HEIGHT = { in: 10, cm: 25.4 };

/** Longest range and zero distance, in the unit entered (yd or m). */
export const MAX_DISTANCE = 3000;

/** Custom air temperature, in the unit entered: -90 to 70 °C, or -130 to 158 °F. */
export const TEMPERATURE_LIMITS = { c: { min: -90, max: 70 }, f: { min: -130, max: 158 } };

/** Custom sea-level air pressure, in the unit entered: 300 to 1200 hPa, or 8.86 to 35.4 inHg. */
export const PRESSURE_LIMITS = { hpa: { min: 300, max: 1200 }, inhg: { min: 8.86, max: 35.4 } };

/** Relative humidity, in percent. */
export const HUMIDITY_LIMITS = { min: 0, max: 100 };

/*
 * Bullet, barrel and altitude limits (#125; owner decision of 2026-11-10), both ends included, in
 * the unit entered. They cover every real bullet, barrel and shooting site. None of these fields
 * hung in the probes of the #89 security review (1e±300, empty and text in each, altitude ±1e300),
 * so they stop nonsense in a profile from giving a normal looking result, not a hang. Inch and mm
 * ends are exact conversions. The gram and foot ends are the owner's rounded values, so they are
 * not exactly the grain and metre ones: 0.065 g is 1.003 gr and 130 g is 2006 gr; -3281 ft is
 * -1000.05 m and 32808 ft is 9999.9 m.
 */

/** Bullet weight: 1 to 2000 gr, or 0.065 to 130 g. */
export const BULLET_WEIGHT_LIMITS = { gr: { min: 1, max: 2000 }, g: { min: 0.065, max: 130 } };

/** Bullet diameter: 0.1 to 1 in, or 2.54 to 25.4 mm. */
export const BULLET_DIAMETER_LIMITS = { in: { min: 0.1, max: 1 }, mm: { min: 2.54, max: 25.4 } };

/** Bullet length, used with spin drift only: 0.1 to 4 in, or 2.54 to 101.6 mm. */
export const BULLET_LENGTH_LIMITS = { in: { min: 0.1, max: 4 }, mm: { min: 2.54, max: 101.6 } };

/**
 * Barrel twist, one turn in this length, used with spin drift only: 1 to 100 in, or 25.4 to
 * 2540 mm. The calculators take it either way, since a negative twist is a left-hand barrel; the
 * profile form only takes a positive one.
 */
export const BARREL_TWIST_LIMITS = { in: { min: 1, max: 100 }, mm: { min: 25.4, max: 2540 } };

/** Altitude of a custom atmosphere: -1000 to 10000 m, or -3281 to 32808 ft. */
export const ALTITUDE_LIMITS = { m: { min: -1000, max: 10000 }, ft: { min: -3281, max: 32808 } };

/** Whether a number lies from min to max, both included. False for NaN. */
const within = (value, { min, max }) => value >= min && value <= max;

/**
 * Whether a BC can be given to the engine.
 * @param {number} bc
 * @returns {boolean}
 */
export function isUsableBc(bc) {
	return Number.isFinite(bc) && bc >= MIN_BC;
}

/**
 * A muzzle velocity in fps, converted as the calculators convert it. Anything but 'mps' is fps.
 * @param {number} value
 * @param {string} unit - 'fps' or 'mps'
 * @returns {number}
 */
export function velocityInFps(value, unit) {
	return (unit === 'mps' ? UNew.MPS(value) : UNew.FPS(value)).In(Unit.FPS);
}

/**
 * Whether a velocity in fps is one the engine can fly: finite, at least MIN_VELOCITY_FPS and
 * under MAX_VELOCITY_FPS.
 * @param {number} fps
 * @returns {boolean}
 */
export function isUsableVelocityFps(fps) {
	return Number.isFinite(fps) && fps >= MIN_VELOCITY_FPS && fps < MAX_VELOCITY_FPS;
}

/**
 * Whether the muzzle velocity can be flown, as entered and at the current temperature.
 *
 * The entered velocity has the form's upper limit. A sensitivity setting can then take the velocity
 * at the current temperature to 0 or NaN, and js-ballistics never leaves its integration loop (the
 * zero search returns NaN instead of throwing), or past the upper limit. So both are checked.
 *
 * @param {Ammo} ammo
 * @param {Atmo} atmo
 * @returns {boolean}
 */
export function hasFlyableVelocity(ammo, atmo) {
	const entered = ammo.mv.In(Unit.FPS);
	if (!(Number.isFinite(entered) && entered < MAX_VELOCITY_FPS)) return false;
	return isUsableVelocityFps(ammo.getVelocityForTemp(atmo.powderTemp).In(Unit.FPS));
}

/**
 * Highest sight height either way, in a unit: 'cm', or inches for anything else, as the
 * calculators read the unit.
 * @param {string} unit
 * @returns {number}
 */
export function maxSightHeight(unit) {
	return unit === 'cm' ? MAX_SIGHT_HEIGHT.cm : MAX_SIGHT_HEIGHT.in;
}

/**
 * Whether a sight height can be given to the engine. A negative height is accepted, as before.
 * An empty height is NaN, which the engine never leaves its loop on.
 * @param {number} value - in the unit entered
 * @param {string} unit  - 'in' or 'cm'
 * @returns {boolean}
 */
export function isUsableSightHeight(value, unit) {
	return Number.isFinite(value) && Math.abs(value) <= maxSightHeight(unit);
}

/**
 * Whether a range is one the calculators take: above 0 and at most MAX_DISTANCE.
 * @param {number} distance - in the unit entered
 * @returns {boolean}
 */
export function isUsableRange(distance) {
	return distance > 0 && distance <= MAX_DISTANCE;
}

/**
 * Air temperature limits in a unit: 'c', or °F for anything else, as the calculators read it.
 * @param {string} unit
 */
export function temperatureLimits(unit) {
	return unit === 'c' ? TEMPERATURE_LIMITS.c : TEMPERATURE_LIMITS.f;
}

/**
 * Air pressure limits in a unit: 'hpa', or inHg for anything else, as the calculators read it.
 * @param {string} unit
 */
export function pressureLimits(unit) {
	return unit === 'hpa' ? PRESSURE_LIMITS.hpa : PRESSURE_LIMITS.inhg;
}

/**
 * Bullet weight limits in a unit: 'g', or grains for anything else, as the calculators read it.
 * @param {string} unit
 */
export function bulletWeightLimits(unit) {
	return unit === 'g' ? BULLET_WEIGHT_LIMITS.g : BULLET_WEIGHT_LIMITS.gr;
}

/**
 * Bullet diameter limits in a unit: 'mm', or inches for anything else, as the calculators read it.
 * @param {string} unit
 */
export function bulletDiameterLimits(unit) {
	return unit === 'mm' ? BULLET_DIAMETER_LIMITS.mm : BULLET_DIAMETER_LIMITS.in;
}

/**
 * Bullet length limits in a unit: 'mm', or inches for anything else, as the calculators read it.
 * @param {string} unit
 */
export function bulletLengthLimits(unit) {
	return unit === 'mm' ? BULLET_LENGTH_LIMITS.mm : BULLET_LENGTH_LIMITS.in;
}

/**
 * Barrel twist limits in a unit: 'mm', or inches for anything else, as the calculators read it.
 * @param {string} unit
 */
export function barrelTwistLimits(unit) {
	return unit === 'mm' ? BARREL_TWIST_LIMITS.mm : BARREL_TWIST_LIMITS.in;
}

/**
 * Altitude limits in a unit: 'm', or feet for anything else, as the calculators read it.
 * @param {string} unit
 */
export function altitudeLimits(unit) {
	return unit === 'm' ? ALTITUDE_LIMITS.m : ALTITUDE_LIMITS.ft;
}

/**
 * Whether the bullet and barrel of a profile can be given to the engine (#125): weight and
 * diameter always, since they always go into the drag model, and twist and length when spin drift
 * is on and they are set, the only case in which the calculators pass them on (otherwise they use
 * no twist and a 2 in length). A twist is checked either way: a negative one is a left-hand barrel.
 * Values are read as the calculators read them, with a comma as a decimal point.
 *
 * @param {object} profile - flat v2 profile
 * @param {{ spinDrift?: boolean }} [options] - spinDrift false for a path that never uses spin
 *   drift (the dope cards), so that twist and length are not checked there
 * @returns {boolean}
 */
export function hasUsableBullet(profile, { spinDrift = true } = {}) {
	if (!within(readDecimal(profile.bulletWeight), bulletWeightLimits(profile.bulletWeightUnit))) {
		return false;
	}
	if (!within(readDecimal(profile.bulletDiameter), bulletDiameterLimits(profile.bulletDiameterUnit))) {
		return false;
	}
	if (!(spinDrift && profile.spinDrift)) return true;
	if (
		profile.barrelTwist &&
		!within(Math.abs(readDecimal(profile.barrelTwist)), barrelTwistLimits(profile.barrelTwistUnit))
	) {
		return false;
	}
	if (
		profile.bulletLength &&
		!within(readDecimal(profile.bulletLength), bulletLengthLimits(profile.bulletLengthUnit))
	) {
		return false;
	}
	return true;
}

/**
 * Whether the values of a custom atmosphere can be given to the engine. Altitude has its own
 * limits (#125). The pressure checked is the sea-level pressure entered; the calculators then
 * correct it for altitude (stationPressure, #107), which gives about 78 to 1349 hPa at the ends.
 *
 * @param {{ altitude: number, pressure: number, temperature: number, humidity: number }} values
 * @param {{ altitudeUnit?: string, pressureUnit?: string, temperatureUnit?: string }} units
 * @returns {boolean}
 */
export function isUsableAtmosphere(values, units) {
	return (
		within(values.altitude, altitudeLimits(units.altitudeUnit)) &&
		within(values.pressure, pressureLimits(units.pressureUnit)) &&
		within(values.temperature, temperatureLimits(units.temperatureUnit)) &&
		within(values.humidity, HUMIDITY_LIMITS)
	);
}

/**
 * Whether the air density of an atmosphere is above 0 (#107; approved by the owner on 2026-11-10).
 *
 * The library's density formula goes below 0 when the water vapour pressure is far above the air
 * pressure, which no real air does. Inside the limits this needs the pressure after the altitude
 * correction: at 10000 m, 70 °C and 100 % humidity, a sea-level pressure of 300 to about 453 hPa
 * gives 78 to 118 hPa at the site and a density ratio of about -0.03 to 0. The engine then
 * never slowed the bullet: 300 and 350 hPa ran for more than 60 s (300 hPa for more than 5 min)
 * on a G7 BC 0.01, 9999 fps, 3000 yd zero. No positive density in the probes hung.
 *
 * @param {Atmo} atmo
 * @returns {boolean}
 */
export function hasPositiveDensity(atmo) {
	return Number.isFinite(atmo.densityRatio) && atmo.densityRatio > 0;
}
