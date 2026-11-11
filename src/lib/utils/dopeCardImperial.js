import { PDFDocument, StandardFonts } from 'pdf-lib';
import { Calculator, Weapon, DragModel, Ammo, Atmo, Wind, Shot, UNew, Unit, Table, TrajectoryRangeError } from 'js-ballistics';
import { findZeroCrossings, ZERO_SEARCH_RANGE, isFlyableZeroElevation } from './dopeCardZeros.js';
import { hasFiniteElevation, isUsableZeroDistance, zeroDistanceValue } from './zeroDistance.js';
import { readDecimal } from './decimal.js';
import { CARD_LAYOUTS, bcHeaderText, drawDropGraph, drawHeaderText, drawPointsOfAim, fmtSigned, tenth } from './dopeCardLayout.js';
import { hasFlyableVelocity, hasUsableBullet, isUsableBc, isUsableSightHeight } from './inputLimits.js';

/**
 * Generate the Imperial mid-range dope card PDF for a v2 profile.
 * @param {object} profile - flat v2 profile from profiles store
 * @returns {Promise<PDFDocument|null>} null when the profile gives no trajectory, so that the page
 *   can say so instead of saving a blank card (#91)
 */
export async function generateImperialDopeCard(profile) {
	const existingPdfBytes = await fetch('/pdf/rifle-dataset-imperial.pdf').then((r) =>
		r.arrayBuffer()
	);
	const pdfDoc = await PDFDocument.load(existingPdfBytes);
	const helveticaFont = await pdfDoc.embedFont(StandardFonts.HelveticaBold);

	const pages = pdfDoc.getPages();
	const firstPage = pages[0];

	// ── Build trajectory data ────────────────────────────────────────
	const shot1 = computeTrajectory(profile, { distance: 500, unit: 'yd', step: 1 }, 0);
	const shot25 = computeTrajectory(profile, { distance: 500, unit: 'yd', step: 25 }, 0);
	const shot25Wind8 = computeTrajectory(profile, { distance: 500, unit: 'yd', step: 25 }, 8);
	const shot25Wind20 = computeTrajectory(profile, { distance: 500, unit: 'yd', step: 25 }, 20);

	if (!shot1 || !shot25 || !shot25Wind8 || !shot25Wind20) return null;

	// The crossings can lie past the 500 units of the card, so this one goes further.
	const shotZeros = computeTrajectory(profile, { distance: ZERO_SEARCH_RANGE, unit: 'yd', step: 1 }, 0, true);

	fillHeader();
	fillGraph();
	fillPointsOfAim();

	return pdfDoc;

	function fillHeader() {
		// Weapon name
		drawHeaderText(firstPage, helveticaFont, 'name', String(profile.name ?? ''));
		// Ammo brand
		drawHeaderText(firstPage, helveticaFont, 'ammo', String(profile.bulletBrand ?? ''));
		// Near zero, from the trajectory: the saved zero can be either crossing
		const zeros = findZeroCrossings(shotZeros, Unit.Yard);
		if (zeros.near !== null) drawHeaderText(firstPage, helveticaFont, 'nearZero', String(Math.round(zeros.near)));
		// 25 yd impact
		const p25 = findPoint(shot1, Unit.Yard, 25);
		if (p25) {
			const drop25 = fmtSigned(Math.round(p25.targetDrop.In(Unit.Inch) * 10) / 10);
			drawHeaderText(firstPage, helveticaFont, 'impact25', drop25);
		}
		// Optic name
		drawHeaderText(firstPage, helveticaFont, 'optic', String(profile.opticName ?? ''));
		// BC
		drawHeaderText(firstPage, helveticaFont, 'bc', bcHeaderText(profile));
		// Far zero from trajectory
		if (zeros.far !== null) drawHeaderText(firstPage, helveticaFont, 'farZero', String(Math.round(zeros.far)));
		// 100 yd impact
		const p100 = findPoint(shot1, Unit.Yard, 100);
		if (p100) {
			const drop100 = fmtSigned(Math.round(p100.targetDrop.In(Unit.Inch) * 10) / 10);
			drawHeaderText(firstPage, helveticaFont, 'impact100', drop100);
		}
		// Height over bore (in)
		let hob = readDecimal(profile.opticHeight);
		if (profile.opticHeightUnit === 'cm') hob = Math.round(UNew.Centimeter(hob).In(Unit.Inch) * 10) / 10;
		drawHeaderText(firstPage, helveticaFont, 'sightHeight', String(hob));
		// Muzzle velocity (fps)
		let mv = readDecimal(profile.velocity);
		if (profile.velocityUnit === 'mps') mv = Math.round(UNew.MPS(mv).In(Unit.FPS) * 10) / 10;
		drawHeaderText(firstPage, helveticaFont, 'velocity', String(mv));
	}

	function fillGraph() {
		const points = shot25.map((p) => ({ distance: p.distance.In(Unit.Yard), drop: p.targetDrop.In(Unit.Inch) }));
		drawDropGraph(firstPage, helveticaFont, CARD_LAYOUTS.imperial.graph, points);
	}

	function fillPointsOfAim() {
		for (const target of CARD_LAYOUTS.imperial.targets) {
			const { distance } = target;
			// No wind: elevation. A negative drop adjustment (below the line of sight) is dialled up.
			const pNW = findPoint(shot25, Unit.Yard, distance);
			const adj = pNW ? pNW.dropAdjustment.In(Unit.MOA) : NaN;
			// Light (8 mph) and strong (20 mph) wind: windage
			const pLW = findPoint(shot25Wind8, Unit.Yard, distance);
			const pSW = findPoint(shot25Wind20, Unit.Yard, distance);
			drawPointsOfAim(firstPage, helveticaFont, target, {
				elevation: pNW ? { value: -adj, label: fmtDopeAdj(adj) } : null,
				light: pLW ? windMark(pLW.windageAdjustment.In(Unit.MOA)) : null,
				strong: pSW ? windMark(pSW.windageAdjustment.In(Unit.MOA)) : null
			});
		}
	}
}

function windMark(adj) {
	const value = Math.abs(adj);
	return { value, label: String(tenth(value)) };
}

// ── Shared helpers ───────────────────────────────────────────────────────────

function computeTrajectory(profile, range, windSpeedMph, forZeros = false) {
	try {
		if (!isUsableZeroDistance(profile.zeroDist)) return null;

		// The same limits as the other calculators: out of them the engine can loop for good.
		const opticHeight = readDecimal(profile.opticHeight);
		if (!isUsableSightHeight(opticHeight, profile.opticHeightUnit)) return null;
		// The cards never use spin drift, so twist and length do not reach the engine here.
		if (!hasUsableBullet(profile, { spinDrift: false })) return null;
		const sightHeight = profile.opticHeightUnit === 'cm'
			? UNew.Centimeter(opticHeight)
			: UNew.Inch(opticHeight);
		const weapon = new Weapon({ sightHeight });

		const weight = profile.bulletWeightUnit === 'g'
			? UNew.Gram(readDecimal(profile.bulletWeight))
			: UNew.Grain(readDecimal(profile.bulletWeight));
		const diameter = profile.bulletDiameterUnit === 'mm'
			? UNew.Millimeter(readDecimal(profile.bulletDiameter))
			: UNew.Inch(readDecimal(profile.bulletDiameter));
		const bc = readDecimal(profile.bc);
		if (!isUsableBc(bc)) return null;
		const dragTable = profile.bcType === 'G7' ? Table.G7 : Table.G1;
		const dm = new DragModel({ bc, dragTable, weight, diameter });

		const mv = profile.velocityUnit === 'mps'
			? UNew.MPS(readDecimal(profile.velocity))
			: UNew.FPS(readDecimal(profile.velocity));
		const ammo = new Ammo({ dm, mv });

		const atmo = new Atmo();
		if (!hasFlyableVelocity(ammo, atmo)) return null;

		const winds = [];
		if (windSpeedMph > 0) {
			winds.push(new Wind({ velocity: UNew.MPH(windSpeedMph), directionFrom: UNew.Degree(90) }));
		}

		const isMetric = range.unit === 'm';
		const zeroValue = zeroDistanceValue(profile.zeroDist);
		const zeroDist = profile.zeroUnit === 'm' ? UNew.Meter(zeroValue) : UNew.Yard(zeroValue);
		const trajRange = isMetric ? UNew.Meter(range.distance) : UNew.Yard(range.distance);
		const trajStep = isMetric ? UNew.Meter(range.step) : UNew.Yard(range.step);

		const shot = new Shot({ weapon, ammo, atmo, winds });
		const calc = new Calculator();
		calc.setWeaponZero(shot, zeroDist);
		if (!hasFiniteElevation(shot)) return null;
		if (forZeros && !isFlyableZeroElevation(weapon.zeroElevation)) return null;
		const result = calc.fire({ shot, trajectoryRange: trajRange, trajectoryStep: trajStep, extraData: forZeros });
		if (!result || result.length === 0) return null;
		return Array.isArray(result) ? result : (result.trajectory ?? []);
	} catch (e) {
		// A search for crossings can use the flight up to where the engine stopped it.
		if (forZeros && e instanceof TrajectoryRangeError) return e.incompleteTrajectory;
		return null;
	}
}

function findPoint(trajectory, unitEnum, targetDist) {
	if (!trajectory) return null;
	return trajectory.find((p) => Math.round(p.distance.In(unitEnum)) === targetDist) ?? null;
}


/** Drop adjustment sign: negative means bullet below LoS → dial UP → display as positive */
function fmtDopeAdj(adj) {
	return (adj < 0 ? '+' : '') + String(Math.round(adj * -1 * 10) / 10);
}
