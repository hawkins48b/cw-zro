/**
 * Layout shared by the imperial and metric dope cards (#136, #137, #139).
 *
 * The axis numbers, target grids and header boxes are printed in the PDF templates
 * (`static/pdf/rifle-dataset-*.pdf`), so the cards cannot change their scales. The functions here
 * keep everything the generators draw inside those printed areas:
 *
 * - Header text is shrunk, then cut with an ellipsis, to fit its box (#137).
 * - The drop line is clipped at the graph edges. A point past an edge is drawn as an arrow on
 *   that edge with its true value (#136).
 * - A points-of-aim mark past its target box is drawn the same way on the box edge (#136).
 * - Labels stay inside their graph or box, and points-of-aim labels do not cover each other or
 *   the other marks (#139).
 *
 * Geometry is given in inches from the top left of the page, as measured on the templates, and
 * converted here to PDF points (origin bottom left).
 */
import { rgb } from 'pdf-lib';

export const PDF_PRIMARY_COLOR = rgb(0.03529411764705882, 0.47843137254901963, 0.20392156862745098);
const WHITE = rgb(1, 1, 1);
const PT = 72;

/** Smallest header text size before the text is cut. The printed text is 11 pt. */
export const MIN_HEADER_SIZE = 7;
const ELLIPSIS = '…';

/**
 * Header fields of both templates (the two share the same boxes). `x` and `y` are where the value
 * starts (y is the baseline), `right` is the last inch it may use, before the box edge or the
 * printed unit.
 */
export const HEADER_FIELDS = {
	name: { x: 1.88, y: 0.59, right: 3.42 },
	ammo: { x: 4, y: 0.59, right: 5.64 },
	nearZero: { x: 7.34, y: 0.59, right: 7.65 },
	impact25: { x: 9.32, y: 0.59, right: 9.78 },
	optic: { x: 1.88, y: 0.97, right: 3.42 },
	bc: { x: 4.41, y: 0.97, right: 5.64 },
	farZero: { x: 7.34, y: 0.97, right: 7.65 },
	impact100: { x: 9.32, y: 0.97, right: 9.78 },
	sightHeight: { x: 2.81, y: 1.36, right: 3.13 },
	velocity: { x: 4.6, y: 1.36, right: 5.2 }
};

/**
 * Printed scales of each template, in inches from the top left (#136). `graph`: x of distance 0 and
 * of `range`, y of drop 0, inches per drop unit (in or cm) and the printed top and bottom values.
 * `targets`: centre and box edges of each points-of-aim target, and inches per MOA or mrad. The box
 * edges and centres were measured on the template drawings.
 */
export const CARD_LAYOUTS = {
	imperial: {
		graph: { left: 1.25, right: 10.13, zeroY: 2.22, perUnit: 3.73 / 100, max: 20, min: -80, range: 500 },
		targets: [
			{ distance: 200, cx: 2.006, left: 1.035, right: 2.976 },
			{ distance: 300, cx: 4.506, left: 3.535, right: 5.476 },
			{ distance: 400, cx: 7.006, left: 6.035, right: 7.976 },
			{ distance: 500, cx: 9.506, left: 8.535, right: 10.476 }
		].map((t) => ({ ...t, cy: 7.087, top: 6.16, bottom: 7.546, perUnit: 1.93 / 40 }))
	},
	metric: {
		graph: { left: 1.25, right: 10.13, zeroY: 2.04, perUnit: 3.72 / 350, max: 50, min: -300, range: 500 },
		targets: [
			{ distance: 200, cx: 1.948, left: 0.96, right: 2.936 },
			{ distance: 300, cx: 4.532, left: 3.543, right: 5.519 },
			{ distance: 400, cx: 7.115, left: 6.127, right: 8.102 },
			{ distance: 500, cx: 9.698, left: 8.71, right: 10.686 }
		].map((t) => ({ ...t, cy: 7.155, top: 6.156, bottom: 7.54, perUnit: 1.98 / 10 }))
	}
};

/**
 * Fit a text into a width: the given size if it fits, else a smaller one down to `minSize`, else
 * `minSize` with the end cut and an ellipsis.
 * @param {{ widthOfTextAtSize: (text: string, size: number) => number }} font
 * @param {string} text
 * @param {number} maxWidth - PDF points
 * @param {number} size - wanted size
 * @param {number} [minSize]
 * @returns {{ text: string, size: number }}
 */
export function fitText(font, text, maxWidth, size, minSize = MIN_HEADER_SIZE) {
	const str = String(text ?? '');
	const width = font.widthOfTextAtSize(str, size);
	if (width <= maxWidth) return { text: str, size };
	// Text width is proportional to the size; round down to a tenth so that it still fits.
	const shrunk = Math.floor(((size * maxWidth) / width) * 10) / 10;
	if (shrunk >= minSize) return { text: str, size: shrunk };
	// Even at the smallest size no field holds 100 characters, so the cut starts from at most 200:
	// measuring a pasted text of thousands of characters once per removed character froze the page.
	const chars = [...str].slice(0, 200);
	const cut = () => chars.join('').trimEnd() + ELLIPSIS;
	while (chars.length > 0 && font.widthOfTextAtSize(cut(), minSize) > maxWidth) chars.pop();
	return { text: chars.length > 0 ? cut() : '', size: minSize };
}

/**
 * Draw a header value fitted to its field.
 * @param {object} page - pdf-lib page
 * @param {object} font
 * @param {keyof typeof HEADER_FIELDS} field
 * @param {string} text
 */
export function drawHeaderText(page, font, field, text) {
	const { x, y, right } = HEADER_FIELDS[field];
	// pdf-lib's drawText turned line breaks and tabs into lines or spaces, but measuring them throws,
	// so control characters print as spaces, as they did.
	const clean = String(text ?? '').replace(/[\u0000-\u001f\u007f\u2028\u2029]/g, ' ');
	const fitted = fitText(font, clean, (right - x) * PT, 11);
	page.drawText(fitted.text, {
		x: x * PT,
		y: page.getSize().height - y * PT,
		size: fitted.size,
		font,
		color: PDF_PRIMARY_COLOR
	});
}

/** Signed label: '+1.2', '0', '-3.4'. */
export function fmtSigned(v) {
	return (v > 0 ? '+' : '') + v;
}

/** A value rounded to a tenth, as printed. */
export const tenth = (v) => Math.round(v * 10) / 10;

/**
 * Part of the segment a-b with y between lo and hi (PDF points), or null when none is.
 * @param {{x: number, y: number}} a
 * @param {{x: number, y: number}} b
 * @param {number} lo
 * @param {number} hi
 * @returns {[{x: number, y: number}, {x: number, y: number}]|null}
 */
export function clipSegmentY(a, b, lo, hi) {
	const dy = b.y - a.y;
	let t0 = 0;
	let t1 = 1;
	if (dy === 0) {
		if (a.y < lo || a.y > hi) return null;
	} else {
		const ta = (lo - a.y) / dy;
		const tb = (hi - a.y) / dy;
		t0 = Math.max(t0, Math.min(ta, tb));
		t1 = Math.min(t1, Math.max(ta, tb));
		if (t0 > t1) return null;
	}
	const at = (t) => ({ x: a.x + (b.x - a.x) * t, y: a.y + dy * t });
	return [at(t0), at(t1)];
}

/** Arrow pointing out of an edge, tip on the edge. SVG y runs down in pdf-lib. */
const ARROW = {
	up: 'M -5 8 L 5 8 L 0 0 Z',
	down: 'M -5 -8 L 5 -8 L 0 0 Z',
	left: 'M 8 -5 L 8 5 L 0 0 Z',
	right: 'M -8 -5 L -8 5 L 0 0 Z'
};

function drawArrow(page, x, y, direction) {
	page.drawSvgPath(ARROW[direction], { x, y, color: PDF_PRIMARY_COLOR, borderWidth: 0 });
}

function drawLabel(page, font, label, rect, size, opacity) {
	page.drawRectangle({
		x: rect.x,
		y: rect.y,
		width: rect.w,
		height: rect.h,
		borderColor: PDF_PRIMARY_COLOR,
		borderWidth: 1,
		color: WHITE,
		...(opacity === undefined ? {} : { opacity })
	});
	page.drawText(label, {
		x: rect.x + 2.5,
		y: rect.y + (rect.h - size * 0.72) / 2,
		size,
		font,
		color: PDF_PRIMARY_COLOR
	});
}

const clamp = (v, lo, hi) => Math.min(Math.max(v, lo), hi);

/**
 * Draw the drop graph: line, points and labels, clipped to the printed scale (#136, #139).
 *
 * @param {object} page - pdf-lib page
 * @param {object} font
 * @param {{ left: number, right: number, zeroY: number, perUnit: number, max: number, min: number,
 *   range: number }} scale - inches from the top left: x of distance 0 and of `range`, y of drop 0,
 *   inches per drop unit, and the printed top and bottom values
 * @param {{ distance: number, drop: number }[]} points - in card units, in distance order
 */
export function drawDropGraph(page, font, scale, points) {
	const height = page.getSize().height;
	const left = scale.left * PT;
	const right = scale.right * PT;
	const top = height - (scale.zeroY - scale.max * scale.perUnit) * PT;
	const bottom = height - (scale.zeroY - scale.min * scale.perUnit) * PT;
	const toX = (d) => (scale.left + (d * (scale.right - scale.left)) / scale.range) * PT;
	const toY = (v) => height - (scale.zeroY - v * scale.perUnit) * PT;
	const SIZE = 9;
	const LABEL_H = 15;

	const drawn = points
		.filter((p) => Number.isFinite(p.distance) && Number.isFinite(p.drop))
		.map((p) => ({ ...p, x: toX(p.distance), y: toY(p.drop) }));

	for (let i = 1; i < drawn.length; i++) {
		const seg = clipSegmentY(drawn[i - 1], drawn[i], bottom, top);
		if (seg) {
			page.drawLine({ start: seg[0], end: seg[1], thickness: 2, color: PDF_PRIMARY_COLOR, opacity: 0.75 });
		}
	}

	// Labels of points past an edge alternate between two rows, so that neighbours do not overlap.
	let pinnedRow = 0;
	for (const p of drawn) {
		const label = fmtSigned(tenth(p.drop));
		const w = font.widthOfTextAtSize(label, SIZE) + 5;
		const rectX = clamp(p.x - 2, left, right - w);
		let rectY;
		if (p.y < bottom || p.y > top) {
			const below = p.y < bottom;
			const edge = below ? bottom : top;
			drawArrow(page, p.x, edge, below ? 'down' : 'up');
			const offset = 10 + pinnedRow * (LABEL_H + 2);
			rectY = below ? edge + offset : edge - offset - LABEL_H;
			pinnedRow = 1 - pinnedRow;
		} else {
			page.drawCircle({ x: p.x, y: p.y, size: 5, borderWidth: 0, color: PDF_PRIMARY_COLOR });
			// Below the point as before, above it when that would leave the graph.
			rectY = p.y - 25 >= bottom ? p.y - 25 : p.y + 10;
			pinnedRow = 0;
		}
		drawLabel(page, font, label, { x: rectX, y: rectY, w, h: LABEL_H }, SIZE);
	}
}

const overlaps = (a, b) => a.x < b.x + b.w && b.x < a.x + a.w && a.y < b.y + b.h && b.y < a.y + a.h;
const inside = (r, box) => r.x >= box.x && r.y >= box.y && r.x + r.w <= box.x + box.w && r.y + r.h <= box.y + box.h;

/**
 * Draw one points-of-aim target: elevation, light and strong windage (#136, #139).
 *
 * @param {object} page - pdf-lib page
 * @param {object} font
 * @param {{ cx: number, cy: number, left: number, right: number, top: number, bottom: number,
 *   perUnit: number }} target - inches from the top left: centre, box edges, inches per MOA or mrad
 * @param {{ elevation: {value: number, label: string}|null, light: {value: number, label: string}|null,
 *   strong: {value: number, label: string}|null }} marks - elevation is the value to dial up (positive
 *   above the centre), light windage is drawn left of the centre and strong windage right of it
 */
export function drawPointsOfAim(page, font, target, marks) {
	const height = page.getSize().height;
	const SIZE = 11;
	const LABEL_H = 15;
	const GAP = 8;
	const box = {
		x: target.left * PT,
		y: height - target.bottom * PT,
		w: (target.right - target.left) * PT,
		h: (target.bottom - target.top) * PT
	};
	const cx = target.cx * PT;
	const cy = height - target.cy * PT;
	const step = target.perUnit * PT;

	const placed = [];
	for (const [key, dx, dy] of [
		['elevation', 0, 1],
		['light', -1, 0],
		['strong', 1, 0]
	]) {
		const mark = marks[key];
		if (!mark || !Number.isFinite(mark.value)) continue;
		const rawX = cx + dx * mark.value * step;
		const rawY = cy + dy * mark.value * step;
		const x = clamp(rawX, box.x, box.x + box.w);
		const y = clamp(rawY, box.y, box.y + box.h);
		let arrow = null;
		if (rawX < box.x) arrow = 'left';
		else if (rawX > box.x + box.w) arrow = 'right';
		else if (rawY < box.y) arrow = 'down';
		else if (rawY > box.y + box.h) arrow = 'up';
		placed.push({ key, label: mark.label, x, y, arrow, w: font.widthOfTextAtSize(mark.label, SIZE) + 6 });
	}

	// Marks the labels must not cover: the dots or arrows themselves.
	const markRects = placed.map((m) => ({ x: m.x - 4, y: m.y - 4, w: 8, h: 8 }));
	const candidates = (m) => {
		const right = { x: m.x + GAP, y: m.y - LABEL_H / 2, w: m.w, h: LABEL_H };
		const left = { x: m.x - GAP - m.w, y: m.y - LABEL_H / 2, w: m.w, h: LABEL_H };
		const above = { x: m.x - m.w / 2, y: m.y + GAP, w: m.w, h: LABEL_H };
		const below = { x: m.x - m.w / 2, y: m.y - GAP - LABEL_H, w: m.w, h: LABEL_H };
		// The order is the old layout first: light windage left, strong windage and elevation right.
		if (m.key === 'light') return [left, below, above, right];
		if (m.key === 'strong') return [right, below, above, left];
		return [right, left, above, below];
	};

	// Windage first: its labels have fewer places that keep clear of the centre line.
	const order = ['light', 'strong', 'elevation'];
	const taken = [];
	for (const key of order) {
		const m = placed.find((p) => p.key === key);
		if (!m) continue;
		const others = markRects.filter((_, i) => placed[i] !== m);
		const options = candidates(m);
		const free = options.find((r) => inside(r, box) && ![...taken, ...others].some((o) => overlaps(r, o)));
		const fallback = options.find((r) => inside(r, box) && !taken.some((o) => overlaps(r, o)));
		const r = free ?? fallback ?? options[0];
		m.rect = {
			...r,
			x: clamp(r.x, box.x, box.x + box.w - r.w),
			y: clamp(r.y, box.y, box.y + box.h - r.h)
		};
		taken.push(m.rect);
	}

	// Drawn in the old order (elevation, light, strong), which the baseline tests read.
	for (const m of placed) {
		if (m.arrow) drawArrow(page, m.x, m.y, m.arrow);
		else page.drawCircle({ x: m.x, y: m.y, size: 3, borderWidth: 0, color: PDF_PRIMARY_COLOR });
	}
	for (const m of placed) drawLabel(page, font, m.label, m.rect, SIZE, 0.75);
}
