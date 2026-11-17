/**
 * The precision dope card ("Abaque de précision", #157): one A6 page per 100 m or yd, with every
 * correction in turret clicks or in the reticle's unit. This file computes the numbers; the PDF is
 * drawn by precisionCardPdf.js.
 *
 * The model (owner decisions of 2026-11-17 on #157; see docs/ballistics-model.md):
 *
 * - The rifle is zeroed once, at 100 in the zero's unit, in the reference atmosphere: ICAO standard,
 *   altitude 0, 1013.25 hPa, 15 °C, humidity 0 (`new Atmo()`). Every other column fires with that
 *   same zero elevation; only the atmosphere changes. So the pressure and temperature columns show
 *   what a rifle zeroed in standard air does in other air, unlike the other calculators, which
 *   solve the zero again in each atmosphere.
 * - Pressure columns are at the reference temperature, temperature columns at the reference
 *   pressure. Powder sensitivity is applied as calculateShotPoint applies it, so the temperature
 *   columns include the change of muzzle velocity.
 * - Spin drift comes from the profile's twist (a negative twist is a left-hand barrel) and bullet
 *   length, whatever the profile's spin drift switch says, when both are within their limits.
 *   Otherwise the engine gets no twist and the card prints no spin drift.
 * - Wind: a full crosswind (engine angle 90°) at each ring speed, minus the windage of the shot
 *   without wind (the spin drift), at the page distance.
 * - The flight stops at the engine's limits: rows past the end of the reference flight give no
 *   page, and a cell whose own flight ended before its distance stays empty (null).
 *
 * Signs: elevation is positive to dial up (a bullet below the line of sight). Pressure and
 * temperature deltas are signed the same way. Spin drift and wind are magnitudes; spin drift
 * carries the direction to dial ('left' or 'right'), opposite to the drift.
 *
 * Rounding: in 'clicks' mode, the elevation at a distance and the spin drift are counted as the
 * Scope View counts them (clicks.js: the angle rounded to 0.1 in the click unit, then divided by
 * the click value, rounded to a whole click); the extra distances are the difference of those
 * counts, so ① + ② equals the count at the extra distance. Pressure, temperature and wind values
 * round the angle difference itself to a whole click, never a difference of rounded values. In
 * 'angle' mode every value is in the reticle's unit, rounded to 0.1, by the same rules. A half
 * rounds away from zero.
 */
import { Ammo, Atmo, DragModel, DragTables, Shot, TrajFlag, UNew, Unit, Weapon, Wind, RangeError as TrajectoryRangeError } from 'js-ballistics';
import { Calculator } from './ballisticEngine.js';
import { powderSensitivity } from './ballisticCalculator.js';
import { readDecimal } from './decimal.js';
import { PRECISION_UNITS } from './precisionCardFormat.js';
import { hasFiniteElevation, isUsableZeroDistance, zeroDistanceValue } from './zeroDistance.js';
import {
	MAX_DISTANCE,
	barrelTwistLimits,
	bulletLengthLimits,
	hasFlyableVelocity,
	hasUsableBullet,
	isUsableBc,
	isUsableSightHeight
} from './inputLimits.js';

/** Shortest maximum distance of the card: the 100 page alone. */
export const PRECISION_MIN_DISTANCE = 100;

/** Longest maximum distance of the card, the range limit of every calculator (MAX_DISTANCE). */
export const PRECISION_MAX_DISTANCE = MAX_DISTANCE;

/** One page every this many units of the zero (m or yd). */
export const PRECISION_PAGE_STEP = 100;

/** The extra distances of ②, added to the page distance. */
export const PRECISION_EXTRA_STEPS = Object.freeze([25, 50, 75]);

/** The only zero distance the card takes, in m or yd. */
export const PRECISION_ZERO = 100;

/** Wind dial factors: I (30° off the line of fire), II (60°) and III (full crosswind). */
export const WIND_FACTORS = Object.freeze({ I: 0.5, II: 0.866, III: 1 });

/** The columns of each unit system, from precisionCardFormat.js. */
export { PRECISION_UNITS };

const CORRECTIONS = new Set(['clicks', 'angle']);
const ANGLE_UNITS = { MRAD: Unit.MRad, MOA: Unit.MOA };
const RETICLE_UNITS = { mrad: 'MRAD', 'mil-dot': 'MRAD', moa: 'MOA' };

/**
 * Whether a maximum distance can be given to the card: a finite number from
 * PRECISION_MIN_DISTANCE to PRECISION_MAX_DISTANCE, both included.
 * @param {unknown} value
 * @returns {boolean}
 */
export function isUsableMaxDistance(value) {
	return typeof value === 'number' && Number.isFinite(value) && value >= PRECISION_MIN_DISTANCE && value <= PRECISION_MAX_DISTANCE;
}

/**
 * The page distances for a maximum distance: 100, 200, … up to the last whole 100 within it.
 * Empty for a maximum that is not usable.
 * @param {unknown} maxDistance
 * @returns {number[]}
 */
export function precisionPageDistances(maxDistance) {
	if (!isUsableMaxDistance(maxDistance)) return [];
	const last = Math.floor(/** @type {number} */ (maxDistance) / PRECISION_PAGE_STEP) * PRECISION_PAGE_STEP;
	const pages = [];
	for (let d = PRECISION_PAGE_STEP; d <= last; d += PRECISION_PAGE_STEP) pages.push(d);
	return pages;
}

/** A click value read as a number, or null when it is not a finite number above 0. */
function clickNumber(value) {
	const number = readDecimal(value);
	return Number.isFinite(number) && number > 0 ? number : null;
}

/** Whether a number lies from min to max, both included. False for NaN. */
const within = (value, { min, max }) => value >= min && value <= max;

/**
 * Whether the profile's twist and bullet length can give spin drift: both set and within their
 * limits (inputLimits), the twist taken either way.
 * @param {object} profile
 * @returns {boolean}
 */
function hasSpinDriftInputs(profile) {
	if (!profile.barrelTwist || !profile.bulletLength) return false;
	const twist = Math.abs(readDecimal(profile.barrelTwist));
	const length = readDecimal(profile.bulletLength);
	return within(twist, barrelTwistLimits(profile.barrelTwistUnit)) && within(length, bulletLengthLimits(profile.bulletLengthUnit));
}

/**
 * What the card needs from a profile, for the generator's checklist.
 *
 * - zero: exactly 100 m or 100 yd, read as the calculators read it (zeroDistanceValue; anything
 *   but 'm' is yards).
 * - reticle: 'mrad' or 'mil-dot' (MRAD), or 'moa' (MOA).
 * - clicks: both turrets in MOA or MRAD, with a click value above 0.
 * - spinDrift: twist and bullet length usable. Not required: without them the card prints no spin
 *   drift.
 *
 * @param {object|null|undefined} profile
 * @returns {{ zero: { ok: boolean, value: number|null, unit: 'm'|'yd'|null },
 *   reticle: { ok: boolean, type: string, unit: 'MRAD'|'MOA'|null },
 *   clicks: { ok: boolean, elevation: { value: number|null, unit: string|null }, windage: { value: number|null, unit: string|null } },
 *   spinDrift: { ok: boolean }, usable: boolean }}
 */
export function precisionCardRequirements(profile) {
	const p = profile && typeof profile === 'object' ? profile : {};
	const zeroValue = zeroDistanceValue(p.zeroDist);
	const zeroFinite = Number.isFinite(zeroValue);
	const zero = {
		ok: zeroValue === PRECISION_ZERO,
		value: zeroFinite ? zeroValue : null,
		unit: zeroFinite ? (p.zeroUnit === 'm' ? 'm' : 'yd') : null
	};

	const type = typeof p.reticleType === 'string' ? p.reticleType : '';
	const reticleUnit = Object.hasOwn(RETICLE_UNITS, type) ? RETICLE_UNITS[type] : null;
	const reticle = { ok: reticleUnit !== null, type, unit: reticleUnit };

	const turret = (value, unit) => ({
		value: clickNumber(value),
		unit: typeof unit === 'string' ? unit : null
	});
	const elevation = turret(p.elevationClickValue, p.elevationClickUnit);
	const windage = turret(p.windageClickValue, p.windageClickUnit);
	const turretOk = (t) => t.value !== null && Object.hasOwn(ANGLE_UNITS, t.unit ?? '');
	const clicks = { ok: turretOk(elevation) && turretOk(windage), elevation, windage };

	const spinDrift = { ok: hasSpinDriftInputs(p) };

	return { zero, reticle, clicks, spinDrift, usable: zero.ok && reticle.ok && clicks.ok };
}

/** Math.round with a half away from zero, and never -0. */
function roundHalfAway(value) {
	const rounded = Math.sign(value) * Math.round(Math.abs(value));
	return rounded === 0 ? 0 : rounded;
}

/** A value rounded to 0.1, a half away from zero, never -0. */
const tenthOf = (value) => roundHalfAway(value * 10) / 10;

/**
 * The card for a profile, or null when the profile does not meet the requirements, an option or
 * value is out of its limits, or not even the 100 page can be computed.
 *
 * @param {object} profile - flat v2 profile
 * @param {{ maxDistance: number, correction: 'clicks'|'angle', units: 'metric'|'imperial' }} options
 * @returns {PrecisionCard|null}
 *
 * @typedef {object} PrecisionCard
 * @property {'clicks'|'angle'} correction
 * @property {'metric'|'imperial'} units
 * @property {'m'|'yd'} distanceUnit - the zero's unit: the unit of every distance on the card
 * @property {'cm'|'in'} sizeUnit - of the click size in the footer
 * @property {'MRAD'|'MOA'} reticleUnit - the unit of the values in 'angle' mode
 * @property {{ elevation: { value: number, unit: 'MRAD'|'MOA' }, windage: { value: number, unit: 'MRAD'|'MOA' } }} click
 * @property {boolean} spinDrift - whether the card has spin drift (twist and length usable)
 * @property {number} maxDistance - as asked
 * @property {number} lastDistance - the last page
 * @property {object} columns - PRECISION_UNITS[units]
 * @property {PrecisionPage[]} pages
 *
 * @typedef {object} PrecisionPage
 * @property {number} distance
 * @property {number} elevation - ①, positive to dial up
 * @property {{ distance: number, value: number|null }[]} extras - ②, added to ①; null past the flight
 * @property {(number|null)[]} pressure - ③, one per pressure column
 * @property {(number|null)[]} temperature - ④, one per temperature column
 * @property {{ value: number, direction: 'left'|'right'|null }|null} spinDrift - ⑤, the direction
 *   to dial; null without spin drift; direction null for 0
 * @property {number} time - time of flight, s
 * @property {{ speed: number, I: number|null, II: number|null, III: number|null }[]} wind - ⑥
 * @property {number} clickSize - one elevation click at this distance, in sizeUnit
 */
export function computePrecisionCard(profile, options) {
	try {
		if (!profile || typeof profile !== 'object' || !options || typeof options !== 'object') return null;
		const { maxDistance, correction, units } = options;
		if (!isUsableMaxDistance(maxDistance)) return null;
		if (!CORRECTIONS.has(correction)) return null;
		if (units !== 'metric' && units !== 'imperial') return null;

		const req = precisionCardRequirements(profile);
		if (!req.usable) return null;
		// The zero is exactly 100 here, so isUsableZeroDistance holds; checked anyway, as every path does.
		if (!isUsableZeroDistance(profile.zeroDist)) return null;

		// --- The same guards as the other paths (docs/ballistics-model.md#input-guards) ---
		const opticHeight = readDecimal(profile.opticHeight);
		if (!isUsableSightHeight(opticHeight, profile.opticHeightUnit)) return null;
		// Twist and length are checked below on their own: out of their limits they give no spin
		// drift, not no card, and they never reach the engine.
		if (!hasUsableBullet(profile, { spinDrift: false })) return null;
		const bc = readDecimal(profile.bc);
		if (!isUsableBc(bc)) return null;

		const spinDrift = req.spinDrift.ok;
		const sightHeight = profile.opticHeightUnit === 'cm' ? UNew.Centimeter(opticHeight) : UNew.Inch(opticHeight);
		const twistValue = readDecimal(profile.barrelTwist);
		const twist = spinDrift
			? profile.barrelTwistUnit === 'mm'
				? UNew.Millimeter(twistValue)
				: UNew.Inch(twistValue)
			: UNew.Inch(0);
		const weapon = new Weapon({ sightHeight, twist });

		const weight = profile.bulletWeightUnit === 'g'
			? UNew.Gram(readDecimal(profile.bulletWeight))
			: UNew.Grain(readDecimal(profile.bulletWeight));
		const diameter = profile.bulletDiameterUnit === 'mm'
			? UNew.Millimeter(readDecimal(profile.bulletDiameter))
			: UNew.Inch(readDecimal(profile.bulletDiameter));
		const length = spinDrift
			? profile.bulletLengthUnit === 'mm'
				? UNew.Millimeter(readDecimal(profile.bulletLength))
				: UNew.Inch(readDecimal(profile.bulletLength))
			: UNew.Inch(2);
		const dragTable = profile.bcType === 'G7' ? DragTables.G7 : DragTables.G1;
		const dm = new DragModel({ bc, dragTable, weight, diameter, length });

		const mv = profile.velocityUnit === 'mps'
			? UNew.MPS(readDecimal(profile.velocity))
			: UNew.FPS(readDecimal(profile.velocity));
		const ammo = new Ammo({ dm, mv, ...powderSensitivity(profile, mv) });

		// --- Reference: ICAO standard atmosphere, altitude 0, humidity 0 ---
		const reference = new Atmo();
		if (!hasFlyableVelocity(ammo, reference)) return null;

		const isMetricDistance = req.zero.unit === 'm';
		const distance = (value) => (isMetricDistance ? UNew.Meter(value) : UNew.Yard(value));
		const distanceUnit = isMetricDistance ? Unit.Meter : Unit.Yard;

		const calc = new Calculator();
		const refShot = new Shot({ weapon, ammo, atmo: reference, winds: [] });
		calc.setWeaponZero(refShot, distance(PRECISION_ZERO));
		if (!hasFiniteElevation(refShot)) return null;

		const pageDistances = precisionPageDistances(maxDistance);
		const lastPage = pageDistances[pageDistances.length - 1];
		// The extras of the last page, but never past the range limit of every calculator.
		const reach = Math.min(lastPage + PRECISION_EXTRA_STEPS[PRECISION_EXTRA_STEPS.length - 1], MAX_DISTANCE);

		/** Rows of a shot at every `step` up to `range`, as far as the flight went. */
		const fly = (shot, range, step) => {
			try {
				const result = calc.fire({ shot, trajectoryRange: distance(range), trajectoryStep: distance(step), filterFlags: TrajFlag.RANGE });
				return result?.records ?? [];
			} catch (e) {
				// The engine ended the flight (minimum velocity, maximum drop, minimum altitude): the rows
				// up to there are good, and nothing past them is printed.
				if (e instanceof TrajectoryRangeError) return e.incompleteTrajectory ?? [];
				throw e;
			}
		};
		const rowsByDistance = (records) => {
			const map = new Map();
			for (const row of records ?? []) {
				const d = Math.round(row.distance.In(distanceUnit));
				if (!map.has(d)) map.set(d, row);
			}
			return map;
		};
		/** A shot with the zeroed weapon in another atmosphere or wind, without a new zero. */
		const variant = (atmo, winds = []) => new Shot({ weapon, ammo, atmo, winds });

		const refRows = rowsByDistance(fly(refShot, reach, 25));
		const pages = pageDistances.filter((d) => refRows.has(d));
		if (pages.length === 0 || pages[0] !== PRECISION_PAGE_STEP) return null;
		const lastReached = pages[pages.length - 1];

		const columns = PRECISION_UNITS[units];
		const pressureAtmo = (p) => new Atmo({
			altitude: UNew.Meter(0),
			pressure: units === 'metric' ? UNew.hPa(p) : UNew.InHg(p),
			temperature: UNew.Celsius(15),
			humidity: 0
		});
		const temperatureAtmo = (t) => new Atmo({
			altitude: UNew.Meter(0),
			pressure: UNew.hPa(1013.25),
			temperature: units === 'metric' ? UNew.Celsius(t) : UNew.Fahrenheit(t),
			humidity: 0
		});
		/** Rows of a variant at the page distances, or none when its velocity cannot be flown. */
		const variantRows = (atmo, winds) => {
			if (!hasFlyableVelocity(ammo, atmo)) return new Map();
			return rowsByDistance(fly(variant(atmo, winds), lastReached, PRECISION_PAGE_STEP));
		};
		const pressureRows = columns.pressure.columns.map((p) => variantRows(pressureAtmo(p)));
		const temperatureRows = columns.temperature.columns.map((t) => variantRows(temperatureAtmo(t)));
		const windVelocity = (v) => (units === 'metric' ? UNew.MPS(v) : UNew.MPH(v));
		const windRows = columns.wind.speeds.map((v) =>
			variantRows(reference, [new Wind({ velocity: windVelocity(v), directionFrom: UNew.Degree(90) })])
		);

		// --- Units of the printed values ---
		const angleMode = correction === 'angle';
		const reticleUnit = /** @type {'MRAD'|'MOA'} */ (req.reticle.unit);
		const elevation = /** @type {{ value: number, unit: 'MRAD'|'MOA' }} */ (req.clicks.elevation);
		const windage = /** @type {{ value: number, unit: 'MRAD'|'MOA' }} */ (req.clicks.windage);
		const elevationUnit = ANGLE_UNITS[angleMode ? reticleUnit : elevation.unit];
		const windageUnit = ANGLE_UNITS[angleMode ? reticleUnit : windage.unit];

		/** The elevation to dial up at a row: Scope View clicks, or the angle to 0.1. */
		const elevationAt = (row) => {
			const value = tenthOf(row.dropAngle.In(elevationUnit));
			return angleMode ? tenthOf(-value) : -roundHalfAway(value / elevation.value) || 0;
		};
		/** A signed angle difference (to dial up) in the printed unit. */
		const elevationDelta = (row, refRow) => {
			const delta = -(row.dropAngle.In(elevationUnit) - refRow.dropAngle.In(elevationUnit));
			return angleMode ? tenthOf(delta) : roundHalfAway(delta / elevation.value);
		};
		const windageMagnitude = (angle) => (angleMode ? tenthOf(Math.abs(angle)) : Math.round(Math.abs(angle) / windage.value));

		const radiansPerClick = UNew[elevation.unit === 'MRAD' ? 'MRad' : 'MOA'](elevation.value).In(Unit.Radian);
		const sizeAt = (d) => (isMetricDistance ? d * radiansPerClick * 100 : d * 36 * radiansPerClick);

		const cards = pages.map((d) => {
			const row = refRows.get(d);
			const first = elevationAt(row);
			const extras = PRECISION_EXTRA_STEPS.map((x) => {
				const extraRow = refRows.get(d + x);
				if (!extraRow) return { distance: d + x, value: null };
				const value = angleMode ? tenthOf(elevationAt(extraRow) - first) : elevationAt(extraRow) - first;
				return { distance: d + x, value: value === 0 ? 0 : value };
			});
			const delta = (rows) => {
				const r = rows.get(d);
				return r ? elevationDelta(r, row) : null;
			};

			let spin = null;
			if (spinDrift) {
				// Scope View count: the angle to 0.1 in the windage unit, then whole clicks.
				const angle = tenthOf(row.windageAngle.In(windageUnit));
				const value = windageMagnitude(angle);
				const direction = value === 0 ? null : angle > 0 ? 'left' : 'right';
				spin = { value, direction };
			}

			const noWind = row.windageAngle.In(windageUnit);
			const wind = columns.wind.speeds.map((speed, i) => {
				const r = windRows[i].get(d);
				if (!r) return { speed, I: null, II: null, III: null };
				const full = Math.abs(r.windageAngle.In(windageUnit) - noWind);
				return {
					speed,
					I: windageMagnitude(full * WIND_FACTORS.I),
					II: windageMagnitude(full * WIND_FACTORS.II),
					III: windageMagnitude(full * WIND_FACTORS.III)
				};
			});

			return {
				distance: d,
				elevation: first,
				extras,
				pressure: pressureRows.map(delta),
				temperature: temperatureRows.map(delta),
				spinDrift: spin,
				time: Math.round(row.time * 100) / 100,
				wind,
				clickSize: Math.round(sizeAt(d) * 10) / 10
			};
		});

		return {
			correction,
			units,
			distanceUnit: isMetricDistance ? 'm' : 'yd',
			sizeUnit: isMetricDistance ? 'cm' : 'in',
			reticleUnit,
			click: { elevation: { ...elevation }, windage: { ...windage } },
			spinDrift,
			maxDistance,
			lastDistance: lastReached,
			columns,
			pages: cards
		};
	} catch (e) {
		console.error('Precision card calculation error:', e);
		return null;
	}
}
