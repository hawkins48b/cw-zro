import { PDFDocument, rgb, StandardFonts } from 'pdf-lib';
import { Calculator, Weapon, DragModel, Ammo, Atmo, Wind, Shot, UNew, Unit, Table } from 'js-ballistics';

const PDF_UNIT = 1 / 72;
const PDF_PRIMARY_COLOR = rgb(0.03529411764705882, 0.47843137254901963, 0.20392156862745098);

/**
 * Generate the Metric mid-range dope card PDF for a v2 profile.
 * @param {object} profile - flat v2 profile from profiles store
 * @returns {Promise<PDFDocument>}
 */
export async function generateMetricDopeCard(profile) {
	const existingPdfBytes = await fetch('/pdf/rifle-dataset-metric.pdf').then((r) =>
		r.arrayBuffer()
	);
	const pdfDoc = await PDFDocument.load(existingPdfBytes);
	const helveticaFont = await pdfDoc.embedFont(StandardFonts.HelveticaBold);

	const pages = pdfDoc.getPages();
	const firstPage = pages[0];
	const { height } = firstPage.getSize();

	// ── Build trajectory data ────────────────────────────────────────
	const shot1 = computeTrajectory(profile, { distance: 500, unit: 'm', step: 1 }, 0);
	const shot25 = computeTrajectory(profile, { distance: 500, unit: 'm', step: 25 }, 0);
	const shot25Wind3 = computeTrajectory(profile, { distance: 500, unit: 'm', step: 25 }, 3.5);
	const shot25Wind9 = computeTrajectory(profile, { distance: 500, unit: 'm', step: 25 }, 9);

	if (!shot1 || !shot25 || !shot25Wind3 || !shot25Wind9) return pdfDoc;

	fillHeader();
	fillGraph();
	fillPointsOfAim();

	return pdfDoc;

	function fillHeader() {
		// Weapon name
		drawText(profile.name ?? '', 1.88, 0.59, 11);
		// Ammo brand
		drawText(profile.bulletBrand ?? '', 4, 0.59, 11);
		// Near zero (in meters)
		let nearZero = parseFloat(profile.zeroDist);
		if (profile.zeroUnit === 'yd') nearZero = Math.round(UNew.Yard(nearZero).In(Unit.Meter) * 10) / 10;
		drawText(String(nearZero), 7.34, 0.59, 11);
		// 25 m impact
		const p25 = findPoint(shot1, Unit.Meter, 25);
		if (p25) {
			const drop25 = fmtSigned(Math.round(p25.targetDrop.In(Unit.Centimeter) * 10) / 10);
			drawText(drop25, 9.32, 0.59, 11);
		}
		// Optic name
		drawText(profile.opticName ?? '', 1.88, 0.97, 11);
		// BC
		drawText(`${profile.bc ?? ''} ${profile.bcType ?? ''}`, 4.41, 0.97, 11);
		// Far zero from trajectory
		const farZeroDist = findFarZero(shot1, Unit.Meter);
		if (farZeroDist !== null) drawText(String(Math.round(farZeroDist * 10) / 10), 7.34, 0.97, 11);
		// 100 m impact
		const p100 = findPoint(shot1, Unit.Meter, 100);
		if (p100) {
			const drop100 = fmtSigned(Math.round(p100.targetDrop.In(Unit.Centimeter) * 10) / 10);
			drawText(drop100, 9.32, 0.97, 11);
		}
		// Height over bore (cm)
		let hob = parseFloat(profile.opticHeight);
		if (profile.opticHeightUnit === 'in') hob = Math.round(UNew.Inch(hob).In(Unit.Centimeter) * 10) / 10;
		drawText(String(hob), 2.81, 1.36, 11);
		// Muzzle velocity (m/s)
		let mv = parseFloat(profile.velocity);
		if (profile.velocityUnit === 'fps') mv = Math.round(UNew.FPS(mv).In(Unit.MPS) * 10) / 10;
		drawText(String(mv), 4.6, 1.36, 11);
	}

	function fillGraph() {
		const GRAPH_START_X = 1.25;
		const GRAPH_START_Y = 2.04;
		const GRAPH_X_INC = 8.88 / 500;
		const GRAPH_Y_INC = 3.72 / 350;

		let prevX, prevY;
		for (const p of shot25) {
			const x = (p.distance.In(Unit.Meter) * GRAPH_X_INC + GRAPH_START_X) / PDF_UNIT;
			const y = height - (GRAPH_START_Y + p.targetDrop.In(Unit.Centimeter) * -1 * GRAPH_Y_INC) / PDF_UNIT;

			if (prevX !== undefined && prevY !== undefined) {
				firstPage.drawLine({
					start: { x: prevX, y: prevY },
					end: { x, y },
					thickness: 2,
					color: PDF_PRIMARY_COLOR,
					opacity: 0.75
				});
			}
			firstPage.drawCircle({ x, y, size: 5, borderWidth: 0, color: PDF_PRIMARY_COLOR });

			const label = fmtSigned(Math.round(p.targetDrop.In(Unit.Centimeter) * 10) / 10);
			firstPage.drawRectangle({
				x: x - 2,
				y: y - 25,
				width: 3 + label.length * 5,
				height: 15,
				borderColor: PDF_PRIMARY_COLOR,
				borderWidth: 1,
				color: rgb(1, 1, 1)
			});
			firstPage.drawText(label, { x, y: y - 20, size: 9, font: helveticaFont, color: PDF_PRIMARY_COLOR });

			prevX = x;
			prevY = y;
		}
	}

	function fillPointsOfAim() {
		const GRAPH_INITIAL_Y = 7.15;
		const GRAPH_XY_INC = 1.98 / 10;

		for (const [distance, initialX] of [[200, 1.95], [300, 4.53], [400, 7.12], [500, 9.7]]) {
			// No wind — elevation
			const pNW = findPoint(shot25, Unit.Meter, distance);
			if (pNW) {
				const x = initialX / PDF_UNIT;
				const adj = pNW.dropAdjustment.In(Unit.MRad);
				const y = height - (GRAPH_INITIAL_Y + adj * GRAPH_XY_INC) / PDF_UNIT;
				firstPage.drawCircle({ x, y, size: 3, borderWidth: 0, color: PDF_PRIMARY_COLOR });
				const label = fmtDopeAdj(adj);
				const labelX = distance === 200 ? x - 6 : x + 10;
				const labelY = distance === 200 ? y + 11 : y - 4;
				const rectX = distance === 200 ? x - 8 : x + 8;
				const rectY = distance === 200 ? y + 8 : y - 8;
				firstPage.drawRectangle({ x: rectX, y: rectY, width: 3 + label.length * 6, height: 15, borderColor: PDF_PRIMARY_COLOR, borderWidth: 1, color: rgb(1, 1, 1), opacity: 0.75 });
				firstPage.drawText(label, { x: labelX, y: labelY, size: 11, font: helveticaFont, color: PDF_PRIMARY_COLOR });
			}

			// Light wind — windage (3.5 m/s)
			const pLW = findPoint(shot25Wind3, Unit.Meter, distance);
			if (pLW) {
				const windAdj = Math.abs(pLW.windageAdjustment.In(Unit.MRad));
				const x = (initialX - windAdj * GRAPH_XY_INC) / PDF_UNIT;
				const y = height - GRAPH_INITIAL_Y / PDF_UNIT;
				firstPage.drawCircle({ x, y, size: 3, borderWidth: 0, color: PDF_PRIMARY_COLOR });
				const label = String(Math.round(windAdj * 10) / 10);
				firstPage.drawRectangle({ x: x - 30, y: y - 8, width: 3 + label.length * 6, height: 15, borderColor: PDF_PRIMARY_COLOR, borderWidth: 1, color: rgb(1, 1, 1), opacity: 0.75 });
				firstPage.drawText(label, { x: x - 28, y: y - 4, size: 11, font: helveticaFont, color: PDF_PRIMARY_COLOR });
			}

			// Strong wind — windage (9 m/s)
			const pSW = findPoint(shot25Wind9, Unit.Meter, distance);
			if (pSW) {
				const windAdj = Math.abs(pSW.windageAdjustment.In(Unit.MRad));
				const x = (initialX + windAdj * GRAPH_XY_INC) / PDF_UNIT;
				const y = height - GRAPH_INITIAL_Y / PDF_UNIT;
				firstPage.drawCircle({ x, y, size: 3, borderWidth: 0, color: PDF_PRIMARY_COLOR });
				const label = String(Math.round(windAdj * 10) / 10);
				firstPage.drawRectangle({ x: x + 8, y: y - 8, width: 3 + label.length * 6, height: 15, borderColor: PDF_PRIMARY_COLOR, borderWidth: 1, color: rgb(1, 1, 1), opacity: 0.75 });
				firstPage.drawText(label, { x: x + 10, y: y - 4, size: 11, font: helveticaFont, color: PDF_PRIMARY_COLOR });
			}
		}
	}

	function drawText(text, xIn, yIn, size) {
		firstPage.drawText(text, {
			x: xIn / PDF_UNIT,
			y: height - yIn / PDF_UNIT,
			size,
			font: helveticaFont,
			color: PDF_PRIMARY_COLOR
		});
	}
}

// ── Shared helpers ───────────────────────────────────────────────────────────

function computeTrajectory(profile, range, windSpeedMps) {
	try {
		const sightHeight = profile.opticHeightUnit === 'cm'
			? UNew.Centimeter(parseFloat(profile.opticHeight))
			: UNew.Inch(parseFloat(profile.opticHeight));
		const weapon = new Weapon({ sightHeight });

		const weight = profile.bulletWeightUnit === 'g'
			? UNew.Gram(parseFloat(profile.bulletWeight))
			: UNew.Grain(parseFloat(profile.bulletWeight));
		const diameter = profile.bulletDiameterUnit === 'mm'
			? UNew.Millimeter(parseFloat(profile.bulletDiameter))
			: UNew.Inch(parseFloat(profile.bulletDiameter));
		const bc = parseFloat(profile.bc);
		if (!bc || bc <= 0) return null;
		const dragTable = profile.bcType === 'G7' ? Table.G7 : Table.G1;
		const dm = new DragModel({ bc, dragTable, weight, diameter });

		const mv = profile.velocityUnit === 'mps'
			? UNew.MPS(parseFloat(profile.velocity))
			: UNew.FPS(parseFloat(profile.velocity));
		const ammo = new Ammo({ dm, mv });

		const atmo = new Atmo();

		const winds = [];
		if (windSpeedMps > 0) {
			winds.push(new Wind({ velocity: UNew.MPS(windSpeedMps), directionFrom: UNew.Degree(90) }));
		}

		const isMetric = range.unit === 'm';
		const zeroDist = profile.zeroUnit === 'm'
			? UNew.Meter(Math.abs(parseFloat(profile.zeroDist)))
			: UNew.Yard(Math.abs(parseFloat(profile.zeroDist)));
		const trajRange = isMetric ? UNew.Meter(range.distance) : UNew.Yard(range.distance);
		const trajStep = isMetric ? UNew.Meter(range.step) : UNew.Yard(range.step);

		const shot = new Shot({ weapon, ammo, atmo, winds });
		const calc = new Calculator();
		calc.setWeaponZero(shot, zeroDist);
		const result = calc.fire({ shot, trajectoryRange: trajRange, trajectoryStep: trajStep });
		if (!result || result.length === 0) return null;
		return Array.isArray(result) ? result : (result.trajectory ?? []);
	} catch {
		return null;
	}
}

function findPoint(trajectory, unitEnum, targetDist) {
	if (!trajectory) return null;
	return trajectory.find((p) => Math.round(p.distance.In(unitEnum)) === targetDist) ?? null;
}

function findFarZero(trajectory, unitEnum) {
	if (!trajectory) return null;
	let crossed = false;
	for (let i = 1; i < trajectory.length; i++) {
		const prev = trajectory[i - 1].targetDrop.In(Unit.Millimeter);
		const curr = trajectory[i].targetDrop.In(Unit.Millimeter);
		if (!crossed && prev < 0 && curr >= 0) { crossed = true; continue; }
		if (crossed && prev >= 0 && curr < 0) return trajectory[i].distance.In(unitEnum);
	}
	return null;
}

function fmtSigned(v) {
	return (v > 0 ? '+' : '') + v;
}

/** Drop adjustment sign: negative means bullet below LoS → dial UP → display as positive */
function fmtDopeAdj(adj) {
	return (adj < 0 ? '+' : '') + String(Math.round(adj * -1 * 10) / 10);
}
