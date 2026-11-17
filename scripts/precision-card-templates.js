/**
 * Draws the static templates of the precision dope card (#157) with pdf-lib and writes them to
 * `static/pdf/precision-<locale>-<metric|imperial>.pdf`, one per card language and unit system.
 *
 * Run: npm run templates:precision
 *
 * Each file holds three A6 pages: the cover, the range page (copied once per distance by
 * precisionCardPdf.js) and the worksheet. The geometry comes from
 * src/lib/utils/precisionCardLayout.js and the words from src/lib/utils/precisionCardWords.js, the
 * modules the fill code reads, so the numbers land in the printed cells. The output is
 * deterministic (no dates or ids in the file), and src/test/precisionCardTemplates.test.js checks
 * that the committed files are what this script writes: run it after any change to the layout,
 * the words or the columns, and commit the PDFs.
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { PDFDocument, StandardFonts } from 'pdf-lib';
import {
	BADGE,
	COLORS,
	COVER,
	FOOTER,
	LEFT,
	PAGE_SIZE,
	RANGE,
	RIGHT,
	WIDTH,
	WORKSHEET,
	coverCell,
	dialPoint,
	painter,
	precisionTemplatePath,
	tableCell,
	worksheetRowTop,
	worksheetSectionHeight
} from '../src/lib/utils/precisionCardLayout.js';
import { PRECISION_LOCALES, precisionWords } from '../src/lib/utils/precisionCardWords.js';
import { PRECISION_UNITS, formatColumn, unitSymbol } from '../src/lib/utils/precisionCardFormat.js';

export const TEMPLATE_UNITS = Object.freeze(['metric', 'imperial']);

/** The path of a template, relative to `static/`. */
export const templatePath = precisionTemplatePath;

/**
 * The template of a language and unit system.
 * @param {'en'|'fr'|'de'} locale
 * @param {'metric'|'imperial'} units
 * @returns {Promise<Uint8Array>}
 */
export async function buildPrecisionTemplate(locale, units) {
	const words = precisionWords(locale);
	const columns = PRECISION_UNITS[units];
	const doc = await PDFDocument.create({ updateMetadata: false });
	const fonts = {
		regular: await doc.embedFont(StandardFonts.Helvetica),
		bold: await doc.embedFont(StandardFonts.HelveticaBold)
	};
	const size = [PAGE_SIZE.width, PAGE_SIZE.height];
	drawCover(painter(doc.addPage(size), fonts), words, columns);
	drawRange(painter(doc.addPage(size), fonts), words, columns);
	drawWorksheet(painter(doc.addPage(size), fonts), words, columns);
	return doc.save({ useObjectStreams: false });
}

function drawCover(p, words, columns) {
	const h = COVER.header;
	p.rect(LEFT, h.top, WIDTH, h.height, { fill: COLORS.ink });
	p.text(words.title.toUpperCase(), h.textX, h.title.baseline, { size: h.title.size, bold: true, color: COLORS.white });

	COVER.groups.forEach((group, g) => {
		const fields = COVER.fields[g];
		p.rect(LEFT, group.top, WIDTH, group.band, { fill: COLORS.band });
		p.line(LEFT, group.top + group.band, RIGHT, group.top + group.band);
		p.text(words[fields.title], LEFT + 8, group.top + COVER.titleBaseline, { size: COVER.titleSize, bold: true });
		for (let r = 1; r < fields.rows.length; r++) {
			const y = group.top + group.band + r * group.row;
			p.line(LEFT, y, RIGHT, y, { color: COLORS.grid });
		}
		p.line(LEFT + WIDTH / 2, group.top + group.band, LEFT + WIDTH / 2, group.top + group.height, { color: COLORS.grid });
		p.rect(LEFT, group.top, WIDTH, group.height, { border: COLORS.ink });
		for (const row of fields.rows) {
			for (const key of row) {
				const cell = /** @type {NonNullable<ReturnType<typeof coverCell>>} */ (coverCell(key));
				p.text(words[key], cell.left + COVER.cell.padding, cell.baseline, { size: COVER.cell.size, color: COLORS.muted });
			}
		}
	});

	// The card values that depend only on the unit system.
	const fixed = {
		refPressure: `${formatColumn(columns.pressure.reference, columns.pressure.unit)} ${unitSymbol(columns.pressure.unit)}`,
		refTemperature: `${columns.temperature.reference} ${unitSymbol(columns.temperature.unit)}`,
		wind: unitSymbol(columns.wind.unit)
	};
	for (const [key, value] of Object.entries(fixed)) {
		const cell = /** @type {NonNullable<ReturnType<typeof coverCell>>} */ (coverCell(key));
		p.text(value, cell.right - COVER.cell.padding, cell.baseline, { size: COVER.cell.size, bold: true, align: 'right' });
	}

	const d = COVER.disclaimer;
	const lines = wrap(p, words.disclaimer, WIDTH, d.size);
	lines.forEach((line, i) => {
		p.text(line, LEFT, d.lastBaseline - (lines.length - 1 - i) * d.lineHeight, { size: d.size, color: COLORS.muted });
	});
	p.line(LEFT, FOOTER.rule, RIGHT, FOOTER.rule);
}

/** Lines of a text that fit a width, split at spaces. */
function wrap(p, text, width, size) {
	const lines = [];
	let line = '';
	for (const word of text.split(' ')) {
		const next = line ? `${line} ${word}` : word;
		if (line && p.width(next, size) > width) {
			lines.push(line);
			line = word;
		} else line = next;
	}
	if (line) lines.push(line);
	return lines;
}

function drawRange(p, words, columns) {
	// Distance and ① box
	const t = RANGE.top;
	p.rect(t.split, t.top, RIGHT - t.split, t.height, { fill: COLORS.ink });
	p.rect(LEFT, t.top, WIDTH, t.height, { border: COLORS.ink, borderWidth: 1.5 });
	p.text(words.distance, t.distance.x, t.label.baseline, { size: t.label.size, bold: true, color: COLORS.muted });
	p.badge('1', t.badge.cx, t.badge.cy, { inverted: true });
	p.text(words.elevation, t.elevationLabelX, t.label.baseline, { size: t.label.size, bold: true, color: COLORS.white });

	// ② row
	const e = RANGE.extras;
	p.badge('2', e.badge.cx, e.badge.cy);
	for (let i = 1; i < 3; i++) {
		const x = e.left + (i * (RIGHT - e.left)) / 3;
		p.line(x, e.top, x, e.bottom);
	}
	p.line(LEFT, e.rule, RIGHT, e.rule);

	// ③ and ④ tables
	const tb = RANGE.table;
	for (const table of RANGE.tables) {
		const spec = columns[table.key];
		const top = table.top;
		p.rect(LEFT, top, tb.labelRight - LEFT, tb.height, { fill: COLORS.band });
		p.line(LEFT, top + tb.divider, RIGHT, top + tb.divider, { color: COLORS.grid });
		p.line(tb.labelRight, top, tb.labelRight, top + tb.height);
		p.badge(table.badge, tb.badgeCx, top + tb.divider / 2);
		p.text(unitSymbol(spec.unit), tb.unitX, top + tb.headerBaseline, { size: tb.headerSize, bold: true });
		spec.columns.forEach((value, i) => {
			const cell = tableCell(i, spec.columns.length);
			if (i > 0) p.line(cell.left, top, cell.left, top + tb.height, { color: COLORS.grid });
			p.text(formatColumn(value, spec.unit), cell.centre, top + tb.headerBaseline, { size: tb.headerSize, color: COLORS.muted, align: 'center' });
		});
		p.rect(LEFT, top, WIDTH, tb.height, { border: COLORS.ink });
	}

	// ⑤ line
	const s = RANGE.spin;
	p.badge('5', s.badge.cx, s.badge.cy);
	p.text(words.spinDrift, s.labelX, s.baseline, { size: s.size });
	p.text(words.timeOfFlight, s.timeLabelRight, s.baseline, { size: s.size, color: COLORS.muted, align: 'right' });
	p.line(LEFT, s.rule, RIGHT, s.rule, { color: COLORS.dash, dash: [3, 2] });

	// ⑥ quarter dial
	const dl = RANGE.dial;
	p.badge('6', dl.badge.cx, dl.badge.cy);
	const ox = dl.origin.x;
	const oy = dl.origin.y;
	const cx = dl.centre.x;
	const cy = dl.centre.y;
	for (const r of dl.radii) {
		p.path(`M ${cx} ${cy - r} A ${r} ${r} 0 0 1 ${cx + r} ${cy}`, ox, oy, { border: COLORS.ring, dash: [4, 3] });
	}
	// Thin rays every 15° (#159); 90° is the III axis.
	for (const angle of dl.rays.filter((a) => a < 90)) {
		const end = dialPoint(angle, dl.radii[dl.radii.length - 1] + dl.rayOverhang);
		p.line(ox + cx, oy + cy, end.x, end.y, { color: COLORS.ray });
	}
	p.line(ox + cx, oy + cy, ox + cx, oy + dl.axisTop, { width: 1.25 });
	p.line(ox + cx, oy + cy, ox + dl.axisRight, oy + cy, { width: 1.25 });
	p.circle(ox + cx, oy + cy, 3.5);
	for (const label of dl.clockLabels) {
		p.text(label.text, ox + label.x, oy + label.y, { size: dl.clockSize, bold: true, align: 'center' });
	}
	for (const label of dl.clockAngles) {
		p.text(label.text, ox + label.x, oy + label.y, { size: dl.clockAngleSize, color: COLORS.muted, align: label.align });
	}
	for (const angle of dl.halfRays) {
		const at = dialPoint(angle, dl.halfRayRadius);
		p.text(`${angle}°`, at.x, at.y + dl.halfRaySize * dl.baselineDrop, { size: dl.halfRaySize, bold: true, align: 'center' });
	}
	columns.wind.speeds.forEach((speed, i) => {
		const r = dl.radii[i];
		const x = ox + cx;
		const y = oy + cy - r + dl.ringLabelSize * dl.baselineDrop;
		const text = String(speed);
		const w = p.width(text, dl.ringLabelSize, true);
		p.rect(x - w / 2 - 2, y - dl.ringLabelSize * 0.8, w + 4, dl.ringLabelSize, { fill: COLORS.white });
		p.text(text, x, y, { size: dl.ringLabelSize, bold: true, align: 'center' });
		p.line(x - w / 2, y + 1.5, x + w / 2, y + 1.5, { width: 1 });
	});
	p.text(unitSymbol(columns.wind.unit), ox + dl.unit.x, oy + dl.unit.y, { size: dl.unit.size, bold: true, color: COLORS.muted });
}

function drawWorksheet(p, words, columns) {
	const h = WORKSHEET.header;
	p.rect(LEFT, h.top, h.split - LEFT, h.height, { fill: COLORS.ink });
	p.text(words.firingData, h.titleX, h.baseline, { size: h.titleSize, bold: true, color: COLORS.white });
	p.text(words.distance, h.split + 8, h.baseline, { size: h.labelSize, bold: true, color: COLORS.muted });
	p.line(h.unitLeft, h.top, h.unitLeft, h.top + h.height);
	p.rect(LEFT, h.top, WIDTH, h.height, { border: COLORS.ink, borderWidth: 1.5 });

	const [c0, c1, c2, c3, c4] = WORKSHEET.columns;
	const units = {
		pressure: unitSymbol(columns.pressure.unit),
		temperature: unitSymbol(columns.temperature.unit),
		wind: unitSymbol(columns.wind.unit)
	};
	for (const section of WORKSHEET.sections) {
		const top = section.top;
		const height = worksheetSectionHeight(section);
		p.rect(LEFT, top, WIDTH, WORKSHEET.band, { fill: COLORS.ink });
		p.text(words[section.title], LEFT + WIDTH / 2, top + 14, { size: WORKSHEET.titleSize, bold: true, color: COLORS.white, align: 'center' });
		const sub = top + WORKSHEET.band;
		p.rect(LEFT, sub, WIDTH, WORKSHEET.subheader, { fill: COLORS.soft });
		p.text(words.data, (c1 + c3) / 2, sub + 12.5, { size: WORKSHEET.unitSize, color: COLORS.muted, align: 'center' });
		p.line(c1, sub, c1, sub + WORKSHEET.subheader);
		p.line(c3, sub, c3, sub + WORKSHEET.subheader);
		p.line(LEFT, sub + WORKSHEET.subheader, RIGHT, sub + WORKSHEET.subheader);

		section.rows.forEach((row, i) => {
			const rt = worksheetRowTop(section, i);
			const mid = rt + WORKSHEET.row / 2;
			p.rect(c0, rt, c1 - c0, WORKSHEET.row, { fill: COLORS.softer });
			if (row.unit === 'none') p.rect(c1, rt, c3 - c1, WORKSHEET.row, { fill: COLORS.ink });
			p.badge(row.n, c0 + 8 + BADGE.r, mid);
			p.text(words[row.label], c0 + 8 + 2 * BADGE.r + 6, mid + 4.5, { size: WORKSHEET.labelSize, bold: true });
			if (row.clock) drawClockIcon(p, c1 - 8 - 12, mid);
			if (units[row.unit]) p.text(units[row.unit], (c2 + c3) / 2, mid + 4, { size: WORKSHEET.unitSize, bold: true, align: 'center' });
			const sign = row.sign === 'leftOrRight' ? words.leftOrRight : row.sign === 'spin' ? '' : row.sign;
			p.text(sign, c3 + WORKSHEET.signX, mid + 5.5, { size: WORKSHEET.signSize, bold: true });
			p.line(c1, rt, c1, rt + WORKSHEET.row);
			p.line(c2, rt, c2, rt + WORKSHEET.row, { color: COLORS.grid });
			p.line(c3, rt, c3, rt + WORKSHEET.row);
			p.line(LEFT, rt + WORKSHEET.row, RIGHT, rt + WORKSHEET.row, { color: COLORS.grid });
		});

		const tt = worksheetRowTop(section, section.rows.length);
		p.rect(LEFT, tt, WIDTH, WORKSHEET.total, { fill: COLORS.soft });
		p.text(words[section.total], LEFT + 8, tt + 24.5, { size: WORKSHEET.labelSize, bold: true });
		p.line(c1, tt, c1, tt + WORKSHEET.total);
		p.line(c3, tt, c3, tt + WORKSHEET.total);
		p.rect(c3 + 3, tt + 3, c4 - c3 - 6, WORKSHEET.total - 6, { fill: COLORS.white, border: COLORS.ink, borderWidth: 2 });
		p.rect(LEFT, top, WIDTH, height, { border: COLORS.ink, borderWidth: 1.5 });
	}
	p.line(LEFT, FOOTER.rule, RIGHT, FOOTER.rule);
}

/** The small clock face of the wind row. */
function drawClockIcon(p, cx, cy) {
	p.circle(cx, cy, 10.5, { fill: COLORS.white, border: COLORS.ink, borderWidth: 1.5 });
	p.circle(cx, cy, 1.6);
	p.line(cx, cy - 9.5, cx, cy - 7, { width: 1.5 });
	p.line(cx + 9.5, cy, cx + 7, cy, { width: 1.5 });
	p.line(cx, cy + 9.5, cx, cy + 7, { width: 1.5 });
	p.line(cx - 9.5, cy, cx - 7, cy, { width: 1.5 });
}

/** Writes every template into `static/pdf/`. */
export async function writePrecisionTemplates(root = process.cwd()) {
	const written = [];
	for (const locale of PRECISION_LOCALES) {
		for (const units of TEMPLATE_UNITS) {
			const file = path.join(root, 'static', templatePath(locale, units));
			fs.writeFileSync(file, await buildPrecisionTemplate(/** @type {'en'|'fr'|'de'} */ (locale), units));
			written.push(path.relative(root, file));
		}
	}
	return written;
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
	const written = await writePrecisionTemplates();
	for (const file of written) console.log(`wrote ${file}`);
}
