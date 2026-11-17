import { Atmo, UNew, Unit } from 'js-ballistics';

/** ICAO standard sea-level pressure, in hPa, the reference of Atmo.standardPressure. */
export const STANDARD_SEA_LEVEL_HPA = 1013.25;

/**
 * Ratio of the standard pressure at an altitude to the standard sea-level pressure (ISA
 * troposphere, as Atmo.standardPressure computes it): 1 at 0, about 0.887 at 1000 m.
 *
 * @param {Distance} altitude - site altitude, any distance unit
 * @returns {number}
 */
export function stationPressureRatio(altitude) {
	return Atmo.standardPressure(altitude).In(Unit.hPa) / STANDARD_SEA_LEVEL_HPA;
}

/**
 * The pressure at the shooting site from a sea-level (QNH) pressure, as weather reports give it
 * (#107; owner decision of 2026-11-10). The entered value is scaled by the standard ratio for the
 * site altitude, so a day that is 10 hPa above standard at sea level stays about 1 % above standard
 * at the site. Air temperature does not enter the correction.
 *
 * @param {Pressure} seaLevel - entered sea-level pressure, any pressure unit
 * @param {Distance} altitude - site altitude, any distance unit
 * @returns {Pressure} station pressure, in hPa
 */
export function stationPressure(seaLevel, altitude) {
	return UNew.hPa(seaLevel.In(Unit.hPa) * stationPressureRatio(altitude));
}
