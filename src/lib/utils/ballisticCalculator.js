import { Calculator, Weapon, DragModel, Ammo, Atmo, Wind, Shot, UNew, Table, Unit } from 'js-ballistics';

/**
 * Compute a single trajectory point for scope view.
 *
 * @param {object} profile - flat v2 profile from the profiles store
 * @param {object} range   - { distance: string|number, unit: 'yd'|'m' }
 * @param {object|null} atmosphere - custom atmo or null for ISA
 * @param {object} wind    - { speed, speedUnit: 'mph'|'mps', direction, directionUnit: 'clock'|'deg' }
 * @returns {TrajectoryData|null} last trajectory point or null on error
 */
export function calculateShotPoint(profile, range, atmosphere, wind) {
	try {
		const dist = Math.abs(parseFloat(range.distance));
		if (!dist || dist <= 0) return null;

		// --- Optic height ---
		const sightHeight =
			profile.opticHeightUnit === 'cm'
				? UNew.Centimeter(parseFloat(profile.opticHeight))
				: UNew.Inch(parseFloat(profile.opticHeight));

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

		// --- Powder temperature sensitivity ---
		let tempModifier = 0;
		let powderTemp = null;
		let usePowderSensitivity = false;
		if (profile.tempSensitivity && profile.tempModifier) {
			tempModifier = parseFloat(profile.tempModifier) / 100;
			usePowderSensitivity = true;
			powderTemp =
				profile.temperatureUnit === 'c'
					? UNew.Celsius(parseFloat(profile.temperature))
					: UNew.Fahrenheit(parseFloat(profile.temperature));
		}

		const ammo = new Ammo({ dm, mv, tempModifier, powderTemp, usePowderSensitivity });

		// --- Atmosphere ---
		let atmo;
		if (atmosphere) {
			const altitude =
				atmosphere.altitudeUnit === 'm'
					? UNew.Meter(parseFloat(atmosphere.altitude))
					: UNew.Foot(parseFloat(atmosphere.altitude));
			const pressure =
				atmosphere.pressureUnit === 'hpa'
					? UNew.hPa(parseFloat(atmosphere.pressure))
					: UNew.InHg(parseFloat(atmosphere.pressure));
			const temperature =
				atmosphere.temperatureUnit === 'c'
					? UNew.Celsius(parseFloat(atmosphere.temperature))
					: UNew.Fahrenheit(parseFloat(atmosphere.temperature));
			const humidity = parseFloat(atmosphere.humidity);
			atmo = new Atmo({ altitude, pressure, temperature, humidity });
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
		const shot = new Shot({ weapon, ammo, atmo, winds });
		const calc = new Calculator();
		calc.setWeaponZero(shot, zeroDistance);
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
