import { Calculator, Weapon, DragModel, Ammo, Atmo, Wind, Shot, UNew, Table, Unit, TrajFlag } from 'js-ballistics';

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
			atmo = new Atmo({ altitude, pressure, temperature, humidity: humVal });
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

		// --- Optic height ---
		const sightHeight =
			profile.opticHeightUnit === 'cm'
				? UNew.Centimeter(parseFloat(profile.opticHeight))
				: UNew.Inch(parseFloat(profile.opticHeight));

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
			atmo = new Atmo({ altitude, pressure, temperature, humidity: humVal });
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
		const shot = new Shot({ weapon, ammo, atmo, winds });
		const calc = new Calculator();
		calc.setWeaponZero(shot, zeroDistance);
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

		// Max ordinate: highest positive targetDrop (bullet above line of sight)
		let maxOrdPoint = null;
		for (const p of allPoints) {
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
 * Compute Maximum Point Blank Range for a given target size.
 *
 * Tries zero distances from 1 to 200 yd/m and finds the one that maximises the
 * point-blank range (farthest distance where the bullet stays within ±targetSize/2
 * of the line of sight).
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
		const elevUnitEnum = useMetric ? Unit.Centimeter : Unit.Inch;

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
		if (!bc || bc <= 0) return null;
		const dragTable = profile.bcType === 'G7' ? Table.G7 : Table.G1;
		const dm = new DragModel({ bc, dragTable, weight, diameter, length });

		const mv =
			profile.velocityUnit === 'mps'
				? UNew.MPS(parseFloat(profile.velocity))
				: UNew.FPS(parseFloat(profile.velocity));
		const ammo = new Ammo({ dm, mv });

		// ── Standard atmosphere (ISA) ────────────────────────────────────
		const atmo = new Atmo();

		// ── Search: try zeros from 1 to 200 yd/m with 5-unit step ────────
		const searchRange = useMetric ? UNew.Meter(900) : UNew.Yard(900);
		const searchStep = useMetric ? UNew.Meter(5) : UNew.Yard(5);

		let bestResult = null;
		let bestMaxDistMM = 0;

		for (let zeroI = 1; zeroI <= 200; zeroI++) {
			const zeroDistance = useMetric ? UNew.Meter(zeroI) : UNew.Yard(zeroI);
			let points;
			try {
				const shot = new Shot({ weapon, ammo, atmo, winds: [] });
				const calc = new Calculator();
				calc.setWeaponZero(shot, zeroDistance);
				const result = calc.fire({ shot, trajectoryRange: searchRange, trajectoryStep: searchStep });
				if (!result || result.length === 0) continue;
				points = Array.isArray(result) ? result : (result.trajectory ?? result);
			} catch {
				continue;
			}
			if (!points || points.length === 0) continue;

			// Find max ordinate (highest targetDrop = bullet farthest above LoS)
			let maxOrdMM = -Infinity;
			let maxOrdDistMM = 0;
			for (const p of points) {
				const dropMM = p.targetDrop.In(Unit.Millimeter);
				if (dropMM > maxOrdMM) {
					maxOrdMM = dropMM;
					maxOrdDistMM = p.distance.In(Unit.Millimeter);
				}
			}

			// Bullet must not rise above the top edge of the target zone
			if (maxOrdMM > halfTargetMM) continue;

			// Find MPBR bounds
			let mpbrMinDistMM = 0;
			let mpbrMaxDistMM = 0;
			for (const p of points) {
				const dropMM = p.targetDrop.In(Unit.Millimeter);
				const distMM = p.distance.In(Unit.Millimeter);
				// Before apex: track where bullet is still below the target zone
				if (distMM < maxOrdDistMM && dropMM < -halfTargetMM) {
					mpbrMinDistMM = distMM;
				}
				// After apex: track the farthest distance still inside the target zone
				if (distMM > maxOrdDistMM && dropMM > -halfTargetMM) {
					mpbrMaxDistMM = distMM;
				}
			}

			if (mpbrMaxDistMM > bestMaxDistMM) {
				bestMaxDistMM = mpbrMaxDistMM;
				bestResult = { optimalZero: zeroI, maxOrdMM, maxOrdDistMM, mpbrMinDistMM, mpbrMaxDistMM };
			}
		}

		if (!bestResult) return null;

		// ── Final detailed trajectory for chart ──────────────────────────
		const chartMaxDist =
			Math.ceil((bestResult.mpbrMaxDistMM / mmPerDist) * 1.2 / 50) * 50;
		const chartRange = useMetric ? UNew.Meter(chartMaxDist) : UNew.Yard(chartMaxDist);
		const chartStep = useMetric ? UNew.Meter(5) : UNew.Yard(5);
		const zeroFinal = useMetric
			? UNew.Meter(bestResult.optimalZero)
			: UNew.Yard(bestResult.optimalZero);

		const finalShot = new Shot({ weapon, ammo, atmo, winds: [] });
		const finalCalc = new Calculator();
		finalCalc.setWeaponZero(finalShot, zeroFinal);
		const finalResult = finalCalc.fire({
			shot: finalShot,
			trajectoryRange: chartRange,
			trajectoryStep: chartStep,
			extraData: true
		});
		if (!finalResult || finalResult.length === 0) return null;

		const chartPoints = finalResult.trajectory ?? (Array.isArray(finalResult) ? finalResult : []);
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

		const r1 = (v) => Math.round(v * 10) / 10;
		return {
			optimalZero: bestResult.optimalZero,
			nearZero,
			farZero,
			mpbrMin: r1(bestResult.mpbrMinDistMM / mmPerDist),
			mpbrMax: r1(bestResult.mpbrMaxDistMM / mmPerDist),
			maxOrdinate: {
				elevation: r1(bestResult.maxOrdMM / mmPerElev),
				distance: r1(bestResult.maxOrdDistMM / mmPerDist)
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
