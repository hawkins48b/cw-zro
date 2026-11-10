import { UNew, Unit, defaultEngineConfig } from 'js-ballistics';

/**
 * Limits of the values the engine is given, shared by the profile form and every calculation path
 * (#89, #90, #92, #93, #119; owner decisions of 2026-11-10).
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

/** Custom air pressure, in the unit entered: 300 to 1200 hPa, or 8.86 to 35.4 inHg. */
export const PRESSURE_LIMITS = { hpa: { min: 300, max: 1200 }, inhg: { min: 8.86, max: 35.4 } };

/** Relative humidity, in percent. */
export const HUMIDITY_LIMITS = { min: 0, max: 100 };

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
 * Whether the values of a custom atmosphere can be given to the engine. Altitude only has to be
 * finite: density comes from pressure, temperature and humidity.
 *
 * @param {{ altitude: number, pressure: number, temperature: number, humidity: number }} values
 * @param {{ pressureUnit?: string, temperatureUnit?: string }} units
 * @returns {boolean}
 */
export function isUsableAtmosphere(values, units) {
	return (
		Number.isFinite(values.altitude) &&
		within(values.pressure, pressureLimits(units.pressureUnit)) &&
		within(values.temperature, temperatureLimits(units.temperatureUnit)) &&
		within(values.humidity, HUMIDITY_LIMITS)
	);
}
