/**
 * Layout of the precision dope card (#157), shared by the template script
 * (`scripts/precision-card-templates.js`, the static parts) and the fill code
 * (`precisionCardPdf.js`, the numbers), so that the cells always line up.
 *
 * Every page is A6 portrait, 297.64 × 419.53 pt. Geometry is given in the pixels of the owner's
 * design pages (397 px wide, top left origin, y down) and converted here to PDF points (origin
 * bottom left): 1 px = 297.64 / 397 pt. Text positions are baselines; sizes are in px too.
 *
 * Template pages, in this order in each template file: COVER, RANGE (copied once per distance),
 * WORKSHEET.
 */
import { rgb } from 'pdf-lib';

export const PAGE_SIZE = Object.freeze({ width: 297.64, height: 419.53 });

/** PDF points per design pixel. */
export const PX = PAGE_SIZE.width / 397;

export const TEMPLATE_PAGES = Object.freeze({ cover: 0, range: 1, worksheet: 2 });

export const COLORS = Object.freeze({
	ink: rgb(0x11 / 255, 0x13 / 255, 0x12 / 255),
	muted: rgb(0x3d / 255, 0x41 / 255, 0x3e / 255),
	band: rgb(0xd8 / 255, 0xdc / 255, 0xd9 / 255),
	grid: rgb(0x9a / 255, 0xa0 / 255, 0x9c / 255),
	value: rgb(0x1d / 255, 0x5a / 255, 0xa6 / 255),
	ring: rgb(0x7d / 255, 0x82 / 255, 0x7e / 255),
	ray: rgb(0xb9 / 255, 0xbd / 255, 0xba / 255),
	dash: rgb(0x6b / 255, 0x70 / 255, 0x6c / 255),
	soft: rgb(0xec / 255, 0xee / 255, 0xed / 255),
	softer: rgb(0xf3 / 255, 0xf4 / 255, 0xf3 / 255),
	white: rgb(1, 1, 1)
});

/** Left and right edge of the content of every page. */
export const LEFT = 18;
export const RIGHT = 379;
export const WIDTH = RIGHT - LEFT;

/** Footer of every page: the rule and the baseline. */
export const FOOTER = Object.freeze({ rule: 523, baseline: 539, size: 12 });

/** Numbered badges (①…⑥): radius and text size. */
export const BADGE = Object.freeze({ r: 7.5, size: 10 });

// ── Cover ──────────────────────────────────────────────────────────────────────

const coverGroup = (top) => Object.freeze({ top, height: 79, band: 19, row: 20 });

export const COVER = Object.freeze({
	header: Object.freeze({
		top: 16,
		height: 75,
		textX: 28,
		title: Object.freeze({ baseline: 33, size: 12 }),
		name: Object.freeze({ baseline: 58, size: 22, minSize: 12 }),
		ammo: Object.freeze({ baseline: 79, size: 13, minSize: 9 })
	}),
	/** Three groups of three rows of two cells. */
	groups: Object.freeze([coverGroup(100), coverGroup(188), coverGroup(276)]),
	/** The word keys of each group title and each cell, row by row, left cell first. */
	fields: Object.freeze([
		Object.freeze({ title: 'groupRifle', rows: [['zero', 'sightHeight'], ['reticle', 'click'], ['twist', 'optic']] }),
		Object.freeze({ title: 'groupAmmo', rows: [['velocity', 'bc'], ['weight', 'diameter'], ['length', 'powder']] }),
		Object.freeze({ title: 'groupCard', rows: [['distances', 'corrections'], ['refPressure', 'refTemperature'], ['wind', 'worksheet']] })
	]),
	cell: Object.freeze({ padding: 8, gap: 6, baseline: 14, size: 12, minSize: 7 }),
	titleBaseline: 14,
	titleSize: 12,
	disclaimer: Object.freeze({ lastBaseline: 513, lineHeight: 16, size: 11 })
});

/** The cover cell of a field: its group, row and column, or null. */
export function coverCell(key) {
	for (let g = 0; g < COVER.fields.length; g++) {
		const rows = COVER.fields[g].rows;
		for (let r = 0; r < rows.length; r++) {
			const c = rows[r].indexOf(key);
			if (c >= 0) {
				const group = COVER.groups[g];
				const top = group.top + group.band + r * group.row;
				const left = LEFT + (c * WIDTH) / 2;
				return { group: g, row: r, column: c, top, left, right: left + WIDTH / 2, baseline: top + COVER.cell.baseline };
			}
		}
	}
	return null;
}

// ── Range page ─────────────────────────────────────────────────────────────────

export const RANGE = Object.freeze({
	top: Object.freeze({
		top: 16,
		height: 60,
		split: LEFT + WIDTH / 2,
		label: Object.freeze({ baseline: 32, size: 12 }),
		distance: Object.freeze({ x: 28, baseline: 69, size: 38, unitSize: 18, gap: 3 }),
		badge: Object.freeze({ cx: 215.5, cy: 27.5 }),
		elevationLabelX: 226,
		elevation: Object.freeze({ x: 208.5, baseline: 69, size: 38, unitSize: 13, gap: 4, right: RIGHT - 6, minSize: 18 })
	}),
	extras: Object.freeze({
		badge: Object.freeze({ cx: 25.5, cy: 94 }),
		left: 33,
		top: 85,
		bottom: 103,
		rule: 106,
		baseline: 99,
		size: 14
	}),
	tables: Object.freeze([
		Object.freeze({ key: 'pressure', badge: '3', top: 113 }),
		Object.freeze({ key: 'temperature', badge: '4', top: 162 })
	]),
	table: Object.freeze({
		height: 42,
		labelRight: 88,
		divider: 20,
		badgeCx: 31.5,
		unitX: 43,
		headerBaseline: 14.5,
		headerSize: 12,
		valueBaseline: 35.5,
		valueSize: 13,
		clicksX: 30
	}),
	spin: Object.freeze({
		badge: Object.freeze({ cx: 25.5, cy: 221 }),
		labelX: 37,
		baseline: 226,
		size: 13,
		gap: 5,
		timeLabelRight: 333,
		rule: 233
	}),
	/** The quarter wind dial, in the coordinates of the design's 262 × 254 svg placed at `origin`. */
	dial: Object.freeze({
		badge: Object.freeze({ cx: 25.5, cy: 247.5 }),
		origin: Object.freeze({ x: 67.5, y: 240 }),
		centre: Object.freeze({ x: 24, y: 240 }),
		radii: Object.freeze([50, 100, 150, 200]),
		axisTop: 24,
		axisRight: 236,
		/** Clock positions, degrees clockwise from XII, and the label of each. */
		rays: Object.freeze({ I: 30, II: 60, III: 90 }),
		clockLabels: Object.freeze([
			Object.freeze({ text: 'XII', x: 24, y: 17 }),
			Object.freeze({ text: 'I', x: 140, y: 44 }),
			Object.freeze({ text: 'II', x: 226, y: 128 }),
			Object.freeze({ text: 'III', x: 250, y: 246 })
		]),
		clockSize: 18,
		ringLabelSize: 15,
		valueSize: 15,
		/** From the centre of a value to its baseline. */
		baselineDrop: 5.3,
		unit: Object.freeze({ x: 36, y: 45, size: 12 })
	}),
	footer: Object.freeze({ boxX: 18, boxTop: 526, boxHeight: 19, padding: 6, baseline: 539, size: 12, gap: 10 })
});

/** Left and right edge of the n-th of `count` cells of a range page table. */
export function tableCell(index, count) {
	const width = (RIGHT - RANGE.table.labelRight) / count;
	const left = RANGE.table.labelRight + index * width;
	return { left, right: left + width, centre: left + width / 2 };
}

/** Left and right edge of the n-th cell of the ② row. */
export function extraCell(index) {
	const width = (RIGHT - RANGE.extras.left) / 3;
	const left = RANGE.extras.left + index * width;
	return { left, right: left + width, centre: left + width / 2 };
}

/**
 * Where a ring meets a ray, in page px: `angle` degrees clockwise from XII, `radius` in svg px.
 * @param {number} angle
 * @param {number} radius
 */
export function dialPoint(angle, radius) {
	const { origin, centre } = RANGE.dial;
	const rad = (angle * Math.PI) / 180;
	return {
		x: origin.x + centre.x + radius * Math.sin(rad),
		y: origin.y + centre.y - radius * Math.cos(rad)
	};
}

// ── Worksheet ──────────────────────────────────────────────────────────────────

const wsColumns = (() => {
	const free = WIDTH - 40;
	const fr = free / 3.7;
	const c1 = LEFT + 1.7 * fr;
	const c2 = c1 + fr;
	const c3 = c2 + 40;
	return Object.freeze([LEFT, c1, c2, c3, RIGHT]);
})();

export const WORKSHEET = Object.freeze({
	header: Object.freeze({
		top: 16,
		height: 40,
		split: LEFT + ((WIDTH - 40) * 1.7) / 3.2,
		unitLeft: RIGHT - 40,
		titleX: 26,
		titleSize: 14,
		labelSize: 12,
		baseline: 41
	}),
	/** Column edges: label | data | unit | clicks. */
	columns: wsColumns,
	sections: Object.freeze([
		Object.freeze({
			top: 66,
			title: 'elevationSection',
			total: 'elevationTurret',
			rows: Object.freeze([
				Object.freeze({ n: '1', label: 'pageDistance', unit: 'distance', sign: '+' }),
				Object.freeze({ n: '2', label: 'extraDistance', unit: 'distance', sign: '±' }),
				Object.freeze({ n: '3', label: 'pressure', unit: 'pressure', sign: '±' }),
				Object.freeze({ n: '4', label: 'temperature', unit: 'temperature', sign: '±' })
			])
		}),
		Object.freeze({
			top: 308,
			title: 'windageSection',
			total: 'windageTurret',
			rows: Object.freeze([
				Object.freeze({ n: '5', label: 'spinDrift', unit: 'none', sign: 'spin' }),
				Object.freeze({ n: '6', label: 'wind', unit: 'wind', sign: 'leftOrRight', clock: true })
			])
		})
	]),
	band: 19,
	subheader: 17,
	row: 39,
	total: 40,
	titleSize: 13,
	labelSize: 13,
	unitSize: 12,
	signSize: 16,
	signX: 6
});

/** Top of row `index` of a worksheet section, and the top of its total row for index = rows. */
export function worksheetRowTop(section, index) {
	return section.top + WORKSHEET.band + WORKSHEET.subheader + index * WORKSHEET.row;
}

/** Height of a worksheet section. */
export function worksheetSectionHeight(section) {
	return WORKSHEET.band + WORKSHEET.subheader + section.rows.length * WORKSHEET.row + WORKSHEET.total;
}

// ── Painter ────────────────────────────────────────────────────────────────────

/**
 * Draws on a pdf-lib page in design pixels.
 * @param {import('pdf-lib').PDFPage} page
 * @param {{ regular: import('pdf-lib').PDFFont, bold: import('pdf-lib').PDFFont }} fonts
 */
export function painter(page, fonts) {
	const H = page.getSize().height;
	const X = (x) => x * PX;
	const Y = (y) => H - y * PX;
	const font = (bold) => (bold ? fonts.bold : fonts.regular);
	return {
		/** Width of a text in px. */
		width(text, size, bold = false) {
			return font(bold).widthOfTextAtSize(String(text), size * PX) / PX;
		},
		/** A text at a baseline; align 'left' (x is the start), 'center' or 'right' (x is the end). */
		text(text, x, y, { size = 12, bold = false, color = COLORS.ink, align = 'left' } = {}) {
			const str = String(text);
			if (str === '') return;
			const w = this.width(str, size, bold);
			const start = align === 'center' ? x - w / 2 : align === 'right' ? x - w : x;
			page.drawText(str, { x: X(start), y: Y(y), size: size * PX, font: font(bold), color });
		},
		rect(x, y, w, h, { fill, border, borderWidth = 1 } = {}) {
			page.drawRectangle({
				x: X(x),
				y: Y(y + h),
				width: w * PX,
				height: h * PX,
				...(fill ? { color: fill } : {}),
				...(border ? { borderColor: border, borderWidth: borderWidth * PX } : { borderWidth: 0 })
			});
		},
		line(x1, y1, x2, y2, { color = COLORS.ink, width = 1, dash } = {}) {
			page.drawLine({
				start: { x: X(x1), y: Y(y1) },
				end: { x: X(x2), y: Y(y2) },
				thickness: width * PX,
				color,
				...(dash ? { dashArray: dash.map((d) => d * PX) } : {})
			});
		},
		circle(cx, cy, r, { fill = COLORS.ink, border, borderWidth = 1 } = {}) {
			page.drawCircle({
				x: X(cx),
				y: Y(cy),
				size: r * PX,
				color: fill,
				...(border ? { borderColor: border, borderWidth: borderWidth * PX } : { borderWidth: 0 })
			});
		},
		/** An svg path in px, relative to the origin (ox, oy). */
		path(d, ox, oy, { color, border, borderWidth = 1, dash } = {}) {
			page.drawSvgPath(d, {
				x: X(ox),
				y: Y(oy),
				scale: PX,
				...(color ? { color } : {}),
				...(border ? { borderColor: border, borderWidth: borderWidth * PX } : { borderWidth: 0 }),
				...(dash ? { borderDashArray: dash.map((d2) => d2 * PX) } : {})
			});
		},
		/** A numbered badge: a filled circle with its number. */
		badge(n, cx, cy, { inverted = false } = {}) {
			this.circle(cx, cy, BADGE.r, { fill: inverted ? COLORS.white : COLORS.ink });
			this.text(n, cx, cy + BADGE.size * 0.36, { size: BADGE.size, bold: true, color: inverted ? COLORS.ink : COLORS.white, align: 'center' });
		}
	};
}

/**
 * The template of a card language and unit system, as fetched by the app (under `static/`).
 * @param {'en'|'fr'|'de'} locale
 * @param {'metric'|'imperial'} units
 */
export const precisionTemplatePath = (locale, units) => `/pdf/precision-${locale}-${units}.pdf`;
