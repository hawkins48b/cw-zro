/**
 * The precision dope card PDF (#157): the cover, one A6 page per distance and the worksheet, filled
 * into the static template of its language, `static/pdf/precision-<locale>.pdf`
 * (scripts/precision-card-templates.js). The numbers come from computePrecisionCard; their
 * positions and the words drawn here come from the same layout and word modules as the templates.
 *
 * The units of wind, pressure and temperature are chosen apart (#160), so everything that depends
 * on them is drawn here, not in the template: the unit symbols, the column values and the lines
 * between the columns of ③ and ④, the ring speeds of ⑥, the worksheet units and the cover's
 * reference pressure, reference temperature and wind unit.
 *
 * Words that depend on the data are drawn here, from precisionCardWords.js: click or clicks, MRAD
 * or MOA, the spin drift direction, the distance unit (chosen apart, #197: the zero's by default;
 * the cover's zero keeps its own unit), and "page". Profile text goes through encodableText (#140) and is
 * shrunk, then cut with an ellipsis, to fit its place (#137).
 */
import { PDFDocument, StandardFonts } from 'pdf-lib';
import { computePrecisionCard, precisionCardRequirements } from './precisionCard.js';
import { readDecimal } from './decimal.js';
import { bcHeaderText, encodableText, fitText } from './dopeCardLayout.js';
import {
	COLORS,
	COVER,
	FOOTER,
	LEFT,
	PX,
	RANGE,
	RIGHT,
	TEMPLATE_PAGES,
	WIDTH,
	WORKSHEET,
	coverCell,
	dialValuePoint,
	extraCell,
	painter,
	precisionTemplatePath,
	tableCell,
	worksheetRowTop
} from './precisionCardLayout.js';
import { precisionLocale, precisionWords } from './precisionCardWords.js';
import { NO_VALUE, formatColumn, formatCorrection, formatDate, unitSymbol } from './precisionCardFormat.js';

/**
 * Generate the precision dope card.
 *
 * @param {object} profile - flat v2 profile
 * @param {{ maxDistance: number, correction: 'clicks'|'angle',
 *   units: 'metric'|'imperial'|import('./precisionCardFormat.js').PrecisionUnits,
 *   distanceUnit?: 'm'|'yd', date?: Date }} options
 *   units and distanceUnit: as computePrecisionCard reads them; date: printed on the cover, today
 *   by default
 * @param {unknown} locale - 'en', 'fr' or 'de'; anything else is 'en'
 * @returns {Promise<PDFDocument|null>} null when the card has no data (see dopeCardDownload.js)
 */
export async function generatePrecisionDopeCard(profile, options, locale) {
	const data = computePrecisionCard(profile, options);
	if (!data) return null;
	const lang = precisionLocale(locale);
	const words = precisionWords(lang);

	const templateBytes = await fetch(precisionTemplatePath(lang)).then((r) => r.arrayBuffer());
	const template = await PDFDocument.load(templateBytes);
	const pdfDoc = await PDFDocument.create();
	const indices = [TEMPLATE_PAGES.cover, ...data.pages.map(() => TEMPLATE_PAGES.range), TEMPLATE_PAGES.worksheet];
	// One copyPages call per page (#158): within a call pdf-lib copies an object once, so the range
	// pages copied together would share one /Contents and every page would print every distance.
	const pages = [];
	for (const index of indices) {
		const [page] = await pdfDoc.copyPages(template, [index]);
		pages.push(pdfDoc.addPage(page));
	}
	const fonts = {
		regular: await pdfDoc.embedFont(StandardFonts.Helvetica),
		bold: await pdfDoc.embedFont(StandardFonts.HelveticaBold)
	};

	const total = pages.length;
	const ctx = { profile, data, words, fonts, total, name: profileText(fonts.bold, profile.name) };
	const date = options.date instanceof Date && !Number.isNaN(options.date.getTime()) ? options.date : new Date();
	fillCover(painter(pages[0], fonts), ctx, date);
	data.pages.forEach((page, i) => fillRange(painter(pages[i + 1], fonts), ctx, page, i + 2));
	fillWorksheet(painter(pages[total - 1], fonts), ctx);
	return pdfDoc;
}

/** Profile text as it can be printed: control characters as spaces, only WinAnsi characters. */
function profileText(font, text) {
	const str = typeof text === 'string' || typeof text === 'number' ? String(text) : '';
	return encodableText(font, str.replace(/[\u0000-\u001f\u007f\u2028\u2029]/g, ' ')).trim();
}

/**
 * Draws a text fitted to a width in px: shrunk down to minSize, then cut with an ellipsis.
 * @returns {number} the width drawn, in px
 */
function drawFitted(p, fonts, text, x, y, maxWidth, { size, minSize = 7, bold = false, color = COLORS.ink, align = 'left' }) {
	if (maxWidth <= 0) return 0;
	const font = bold ? fonts.bold : fonts.regular;
	const fitted = fitText(font, text, maxWidth * PX, size * PX, minSize * PX);
	const sizePx = fitted.size / PX;
	p.text(fitted.text, x, y, { size: sizePx, bold, color, align });
	return p.width(fitted.text, sizePx, bold);
}

/** The word after a correction value: click or clicks, or the reticle unit. */
function unitWord(ctx, value) {
	if (ctx.data.correction === 'angle') return ctx.data.reticleUnit;
	return Math.abs(value ?? 0) === 1 ? ctx.words.clickOne : ctx.words.clickMany;
}

/** The heading of a correction column: Clicks, or the reticle unit. */
function columnWord(ctx, capital) {
	if (ctx.data.correction === 'angle') return ctx.data.reticleUnit;
	return capital ? ctx.words.clicksHeader : ctx.words.clickMany;
}

/** A number as read by the calculators, with its unit, or NO_VALUE. */
function measure(value, unit) {
	const n = readDecimal(value);
	return Number.isFinite(n) && n > 0 ? `${n} ${unit}` : NO_VALUE;
}

const RETICLE_NAMES = { mrad: 'MRAD', 'mil-dot': 'Mil-dot', moa: 'MOA' };

/** The cover values, by field. */
function coverValues(ctx) {
	const { profile, data, words, total } = ctx;
	const req = precisionCardRequirements(profile);
	const e = data.click.elevation;
	const w = data.click.windage;
	const click = e.value === w.value && e.unit === w.unit ? `${e.value} ${e.unit}` : `${e.value} ${e.unit} / ${w.value} ${w.unit}`;
	let twist = NO_VALUE;
	if (req.spinDrift.ok) {
		const t = readDecimal(profile.barrelTwist);
		const length = profile.barrelTwistUnit === 'mm' ? `${Math.abs(t)} mm` : `${Math.abs(t)}"`;
		twist = `1:${length} ${t < 0 ? words.twistLeft : words.twistRight}`;
	}
	let powder = NO_VALUE;
	const modifier = readDecimal(profile.tempModifier);
	if (profile.tempSensitivity && Number.isFinite(modifier) && modifier !== 0) {
		powder = `${modifier} fps/${profile.temperatureUnit === 'c' ? '°C' : '°F'}`;
	}
	const last = data.lastDistance;
	const { pressure, temperature, wind } = data.columns;
	return {
		zero: `100 ${data.zeroUnit}`,
		sightHeight: `${readDecimal(profile.opticHeight)} ${profile.opticHeightUnit === 'cm' ? 'cm' : 'in'}`,
		reticle: RETICLE_NAMES[profile.reticleType] ?? NO_VALUE,
		click,
		twist,
		optic: profileText(ctx.fonts.bold, profile.opticName) || NO_VALUE,
		velocity: `${readDecimal(profile.velocity)} ${profile.velocityUnit === 'mps' ? 'm/s' : 'fps'}`,
		bc: bcHeaderText(profile),
		weight: measure(profile.bulletWeight, profile.bulletWeightUnit === 'g' ? 'g' : 'gr'),
		diameter: measure(profile.bulletDiameter, profile.bulletDiameterUnit === 'mm' ? 'mm' : 'in'),
		length: req.spinDrift.ok ? measure(profile.bulletLength, profile.bulletLengthUnit === 'mm' ? 'mm' : 'in') : NO_VALUE,
		powder,
		distances: last > 100 ? `100–${last} ${data.distanceUnit}` : `100 ${data.distanceUnit}`,
		corrections: columnWord(ctx, false),
		refPressure: `${formatColumn(pressure.reference, pressure.unit)} ${unitSymbol(pressure.unit)}`,
		refTemperature: `${temperature.reference} ${unitSymbol(temperature.unit)}`,
		wind: unitSymbol(wind.unit),
		worksheet: `${words.page} ${total}`
	};
}

function fillCover(p, ctx, date) {
	const { fonts, words } = ctx;
	const h = COVER.header;
	drawFitted(p, fonts, ctx.name, h.textX, h.name.baseline, WIDTH - 20, { size: h.name.size, minSize: h.name.minSize, bold: true, color: COLORS.white });
	const ammo = profileText(fonts.regular, ctx.profile.ammo) || profileText(fonts.regular, ctx.profile.bulletBrand);
	drawFitted(p, fonts, ammo, h.textX, h.ammo.baseline, WIDTH - 20, { size: h.ammo.size, minSize: h.ammo.minSize, color: COLORS.white });

	const c = COVER.cell;
	for (const [key, value] of Object.entries(coverValues(ctx))) {
		const cell = coverCell(key);
		if (!cell) continue;
		const labelEnd = cell.left + c.padding + p.width(words[key], c.size);
		const right = cell.right - c.padding;
		drawFitted(p, fonts, value, right, cell.baseline, right - labelEnd - c.gap, { size: c.size, minSize: c.minSize, bold: true, align: 'right' });
	}

	p.text(`ZRO · ${formatDate(date)}`, LEFT, FOOTER.baseline, { size: FOOTER.size, color: COLORS.muted });
	p.text(`1 / ${ctx.total}`, RIGHT, FOOTER.baseline, { size: FOOTER.size, color: COLORS.muted, align: 'right' });
}

function fillRange(p, ctx, page, number) {
	const { data, fonts, words } = ctx;
	const correction = data.correction;
	const t = RANGE.top;

	// Distance
	const d = t.distance;
	const dw = p.width(String(page.distance), d.size, true);
	p.text(String(page.distance), d.x, d.baseline, { size: d.size, bold: true });
	p.text(data.distanceUnit, d.x + dw + d.gap, d.baseline, { size: d.unitSize, bold: true });

	// ① Elevation, shrunk together with its unit when it does not fit.
	const el = t.elevation;
	const value = formatCorrection(page.elevation, correction);
	const unit = unitWord(ctx, page.elevation);
	const room = el.right - el.x;
	const natural = p.width(value, el.size, true) + el.gap + p.width(unit, el.unitSize, true);
	const scale = Math.min(1, room / natural);
	const vSize = Math.max(el.minSize, el.size * scale);
	const uSize = el.unitSize * (vSize / el.size);
	const vw = p.width(value, vSize, true);
	p.text(value, el.x, el.baseline, { size: vSize, bold: true, color: COLORS.white });
	drawFitted(p, fonts, unit, el.x + vw + el.gap, el.baseline, el.right - (el.x + vw + el.gap), { size: uSize, minSize: 6, bold: true, color: COLORS.white });

	// ② Extras
	const e = RANGE.extras;
	page.extras.forEach((extra, i) => {
		const cell = extraCell(i);
		const left = `${extra.distance} =`;
		const right = formatCorrection(extra.value, correction);
		const lw = p.width(left, e.size);
		const rw = p.width(right, e.size, true);
		const space = p.width(' ', e.size);
		const start = cell.centre - (lw + space + rw) / 2;
		p.text(left, start, e.baseline, { size: e.size, color: COLORS.muted });
		p.text(right, start + lw + space, e.baseline, { size: e.size, bold: true });
	});

	// ③ and ④: the unit, the column values and the lines between the columns (#160), then the
	// corrections.
	const tb = RANGE.table;
	for (const table of RANGE.tables) {
		const spec = data.columns[table.key];
		p.text(unitSymbol(spec.unit), tb.unitX, table.top + tb.headerBaseline, { size: tb.headerSize, bold: true });
		spec.columns.forEach((column, i) => {
			const cell = tableCell(i, spec.columns.length);
			// Inside the table's 1 px border, which the template drew.
			if (i > 0) p.line(cell.left, table.top + 0.5, cell.left, table.top + tb.height - 0.5, { color: COLORS.grid });
			p.text(formatColumn(column, spec.unit), cell.centre, table.top + tb.headerBaseline, { size: tb.headerSize, color: COLORS.muted, align: 'center' });
		});
		const values = page[table.key];
		drawFitted(p, fonts, columnWord(ctx, false), LEFT + tb.clicksX, table.top + tb.valueBaseline - 1, tb.labelRight - LEFT - tb.clicksX - 2, {
			size: 12,
			minSize: 7,
			bold: true
		});
		values.forEach((v, i) => {
			const cell = tableCell(i, values.length);
			drawFitted(p, fonts, formatCorrection(v, correction), cell.centre, table.top + tb.valueBaseline, cell.right - cell.left - 2, {
				size: tb.valueSize,
				minSize: 7,
				bold: true,
				align: 'center'
			});
		});
	}

	// ⑤ Spin drift and time of flight
	const s = RANGE.spin;
	let spin = NO_VALUE;
	if (page.spinDrift) {
		const sd = page.spinDrift;
		const amount = formatCorrection(sd.value, correction, { magnitude: true });
		spin = sd.direction === null
			? `${amount} ${unitWord(ctx, sd.value)}`
			: `${sd.direction === 'left' ? words.left : words.right} +${amount} ${unitWord(ctx, sd.value)}`;
	}
	const spinX = s.labelX + p.width(words.spinDrift, s.size) + s.gap;
	const timeText = `${page.time.toFixed(2)} s`;
	const timeLabelStart = s.timeLabelRight - p.width(words.timeOfFlight, s.size);
	drawFitted(p, fonts, spin, spinX, s.baseline, timeLabelStart - 6 - spinX, { size: s.size, minSize: 7, bold: true, color: COLORS.value });
	p.text(timeText, RIGHT, s.baseline, { size: s.size, bold: true, align: 'right' });

	// ⑥ Wind dial
	// The ring speeds, underlined on a white patch over the XII axis, and the wind unit (#160).
	const dl = RANGE.dial;
	const axisX = dl.origin.x + dl.centre.x;
	data.columns.wind.speeds.forEach((speed, i) => {
		const y = dl.origin.y + dl.centre.y - dl.radii[i] + dl.ringLabelSize * dl.baselineDrop;
		const text = String(speed);
		const w = p.width(text, dl.ringLabelSize, true);
		p.rect(axisX - w / 2 - 2, y - dl.ringLabelSize * 0.8, w + 4, dl.ringLabelSize, { fill: COLORS.white });
		p.text(text, axisX, y, { size: dl.ringLabelSize, bold: true, align: 'center' });
		p.line(axisX - w / 2, y + 1.5, axisX + w / 2, y + 1.5, { width: 1 });
	});
	p.text(unitSymbol(data.columns.wind.unit), dl.origin.x + dl.unit.x, dl.origin.y + dl.unit.y, { size: dl.unit.size, bold: true, color: COLORS.muted });

	// One value per ray and ring (#159), on a white halo; staggered on the inner ring (#174)
	// (dialValuePoint).
	const size = dl.valueSize;
	const halo = dl.halo;
	page.wind.forEach((ring, i) => {
		ring.values.forEach((value, ray) => {
			const text = formatCorrection(value, correction, { magnitude: true });
			const at = dialValuePoint(i, ray);
			const w = p.width(text, size, true);
			const y = at.y + size * dl.baselineDrop;
			p.rect(at.x - w / 2 - halo.padding, y - size * halo.top, w + 2 * halo.padding, size, { fill: COLORS.white });
			p.text(text, at.x, y, { size, bold: true, color: COLORS.value, align: 'center' });
		});
	});

	// Footer: the click line and the page.
	const f = RANGE.footer;
	const ec = data.click.elevation;
	const clickLine = `1 ${words.clickOne} = ${ec.value} ${ec.unit} = ${page.clickSize.toFixed(1)} ${data.sizeUnit}`;
	const boxWidth = Math.min(p.width(clickLine, f.size, true) + 2 * f.padding, WIDTH * 0.6);
	p.rect(f.boxX, f.boxTop, boxWidth, f.boxHeight, { border: COLORS.ink, borderWidth: 1.5 });
	drawFitted(p, fonts, clickLine, f.boxX + f.padding, f.baseline, boxWidth - 2 * f.padding, { size: f.size, minSize: 7, bold: true });
	pageFooter(p, ctx, number, f.boxX + boxWidth + f.gap, f.baseline, f.size);
}

/** "<name> · k / N", right-aligned, the name cut to fit from `left`. */
function pageFooter(p, ctx, number, left, baseline, size) {
	const tail = `${number} / ${ctx.total}`;
	const tailWidth = p.width(tail, size);
	p.text(tail, RIGHT, baseline, { size, color: COLORS.muted, align: 'right' });
	if (!ctx.name) return;
	const sep = ' · ';
	const room = RIGHT - tailWidth - p.width(sep, size) - left;
	const fitted = fitText(ctx.fonts.regular, ctx.name, Math.max(0, room) * PX, size * PX, size * PX);
	if (!fitted.text) return;
	p.text(`${fitted.text}${sep}`, RIGHT - tailWidth, baseline, { size, color: COLORS.muted, align: 'right' });
}

function fillWorksheet(p, ctx) {
	const { data, words, total } = ctx;
	const h = WORKSHEET.header;
	p.text(data.distanceUnit, (h.unitLeft + RIGHT) / 2, h.baseline, { size: 13, bold: true, align: 'center' });
	const [, , c2, c3, c4] = WORKSHEET.columns;
	const heading = columnWord(ctx, true);
	const twist = readDecimal(ctx.profile.barrelTwist);
	const { pressure, temperature, wind } = data.columns;
	const units = { distance: data.distanceUnit, pressure: unitSymbol(pressure.unit), temperature: unitSymbol(temperature.unit), wind: unitSymbol(wind.unit) };
	for (const section of WORKSHEET.sections) {
		const sub = section.top + WORKSHEET.band;
		p.text(heading, (c3 + c4) / 2, sub + 12.5, { size: WORKSHEET.unitSize, color: COLORS.muted, align: 'center' });
		section.rows.forEach((row, i) => {
			const mid = worksheetRowTop(section, i) + WORKSHEET.row / 2;
			if (Object.hasOwn(units, row.unit)) p.text(units[row.unit], (c2 + c3) / 2, mid + 4, { size: WORKSHEET.unitSize, bold: true, align: 'center' });
			if (row.sign === 'spin') {
				const sign = data.spinDrift ? (twist < 0 ? words.rightShort : words.leftShort) : NO_VALUE;
				p.text(sign, c3 + WORKSHEET.signX, mid + 5.5, { size: WORKSHEET.signSize, bold: true });
			}
		});
		const tt = worksheetRowTop(section, section.rows.length);
		p.text(heading, c3 - 8, tt + 24.5, { size: WORKSHEET.unitSize, bold: true, align: 'right' });
	}
	p.text(`${total} / ${total}`, RIGHT, FOOTER.baseline, { size: FOOTER.size, color: COLORS.muted, align: 'right' });
	const room = WIDTH - p.width(`${total} / ${total}`, FOOTER.size) - 10;
	drawFitted(p, ctx.fonts, ctx.name, LEFT, FOOTER.baseline, room, { size: FOOTER.size, minSize: FOOTER.size, color: COLORS.muted });
}
