/**
 * The pure part of the 3D tutorial scene (#182, neon-grid look #195): layout, terrain heights,
 * backstop, quality presets, wind sway, weather looks, tree and grass placement, camera poses, the HUD
 * bracket around the target. Plain numbers, no three.js, so it is tested
 * (tutorialScene.test.js); src/lib/tutorial/scene.js turns it into meshes.
 *
 * Axes as the models (docs/development.md#tutorial-models): metres, +Y up, the range along -Z, +X to
 * the shooter's right. The scene origin is the ground under the sandbag.
 */
import { readDecimal } from './decimal.js';

/**
 * The URL of a model of static/models (#181), on the app's own origin, as the precision card fetches
 * its templates from `/pdf/`: web, Electron (app://) and Capacitor serve static files from the root.
 * @param {string} name - file name without `.glb`
 */
export const modelPath = (name) => `/models/${name}.glb`;

/** Height of the sandbag's `rest` (bottom of its groove) above the ground, metres (#181). */
export const SANDBAG_REST_HEIGHT = 0.12;
/** The rifle's fore-end underside on the rest is this far below the bore axis, metres (#181). */
export const FORE_END_BELOW_BORE = 0.052;
/** The rest is this far in front of the bolt face (the rifle's origin), metres (#181). */
export const REST_AHEAD_OF_BOLT = 0.3;
/** The scope's origin is this far above the rifle's `optic-rail` origin, metres (#181). */
export const SCOPE_ABOVE_RAIL = 0.038;
/** The IPSC target's face: bottom edge 0.8 m above the ground, 0.76 m tall (#181). */
export const TARGET_FACE_BOTTOM = 0.8;
export const TARGET_FACE_HEIGHT = 0.76;
/** Centre of the target face above the ground under it, metres. */
export const TARGET_CENTRE_HEIGHT = TARGET_FACE_BOTTOM + TARGET_FACE_HEIGHT / 2;

/**
 * Quality presets (#182, #195). pixelRatio is the most device pixels per CSS pixel drawn; grass the
 * tufts of instanced grass; particles the rain streaks or snow flakes; trees per side of the range;
 * bloom the glow post-processing (off on Low), bloomScale the share of the drawing size it works at.
 * The neon-grid look has no lights, so no shadows.
 */
export const QUALITY_PRESETS = Object.freeze({
	low: Object.freeze({ pixelRatio: 1, antialias: false, bloom: false, bloomScale: 0, grass: 1500, particles: 800, trees: 14 }),
	medium: Object.freeze({ pixelRatio: 1.5, antialias: true, bloom: true, bloomScale: 0.5, grass: 6000, particles: 3000, trees: 24 }),
	high: Object.freeze({ pixelRatio: 2, antialias: true, bloom: true, bloomScale: 1, grass: 16000, particles: 8000, trees: 36 })
});

/**
 * The preset of a quality, with the pixel ratio capped by the device's.
 * @param {string} quality - 'low', 'medium' or 'high'; anything else is low
 * @param {number} [devicePixelRatio]
 */
export function qualityPreset(quality, devicePixelRatio = 1) {
	const preset = QUALITY_PRESETS[/** @type {'low'|'medium'|'high'} */ (quality)] ?? QUALITY_PRESETS.low;
	const dpr = Number.isFinite(devicePixelRatio) && devicePixelRatio > 0 ? devicePixelRatio : 1;
	return { ...preset, pixelRatio: Math.min(preset.pixelRatio, dpr) };
}

/**
 * @typedef {object} SceneLayout
 * @property {{ x: number, y: number, z: number }} los - the optic's line of sight at the shooter
 * @property {{ x: number, y: number, z: number }} aim - the aim point: centre of the target face
 * @property {number} slope - radians, up positive
 * @property {number} horizontal - horizontal distance from the line of sight origin to the target, m
 * @property {number} targetGroundY - ground height under the target, m
 * @property {number} targetZ - z of the target face
 * @property {number} altitude - shooter altitude, m (terrain only)
 */

/**
 * Where the shooter's line of sight, the target and the ground under it are.
 *
 * The line of sight starts at the optic (`losHeight` above the ground at the shooter, `losZ` along
 * the range) and goes `distanceM` along the slope to the aim point, the centre of the target face.
 * The ground under the target is TARGET_CENTRE_HEIGHT below it. So the target elevation entered is
 * the height of the aim point above the optic, and the ground at the target sits that much above the
 * shooter's ground, less the difference between the target's centre and the optic heights (about
 * 0.9 m, which a slope of hundreds of metres hides).
 *
 * @param {{ distanceM: number, slopeDeg: number, altitudeM?: number }} geometry - tutorialGeometry
 * @param {{ losHeight: number, losZ?: number }} optic
 * @returns {SceneLayout}
 */
export function sceneLayout(geometry, optic) {
	const slope = (geometry.slopeDeg * Math.PI) / 180;
	const distance = Number.isFinite(geometry.distanceM) && geometry.distanceM > 0 ? geometry.distanceM : 300;
	const los = { x: 0, y: optic.losHeight, z: optic.losZ ?? 0 };
	const horizontal = distance * Math.cos(slope);
	const aim = { x: 0, y: los.y + distance * Math.sin(slope), z: los.z - horizontal };
	return {
		los,
		aim,
		slope,
		horizontal,
		targetGroundY: aim.y - TARGET_CENTRE_HEIGHT,
		targetZ: aim.z,
		altitude: Number.isFinite(geometry.altitudeM) ? /** @type {number} */ (geometry.altitudeM) : 0
	};
}

/** Width of the smooth lane between shooter and target, metres either side. */
export const LANE_HALF_WIDTH = 12;

/** Ground flat around the shooter and behind the target, metres. */
const SHOOTER_PAD = 6;
const TARGET_PAD = 8;

/**
 * Smoothstep from 0 at a to 1 at b.
 * @param {number} a
 * @param {number} b
 * @param {number} x
 */
const smooth = (a, b, x) => {
	const t = Math.min(1, Math.max(0, (x - a) / (b - a)));
	return t * t * (3 - 2 * t);
};

/**
 * The ground height at (x, z). Along the lane, the ground goes from 0 at the shooter to
 * targetGroundY at the target with a smooth start and end (flat pads under the shooter and the
 * target), stays flat behind the shooter and rises into a berm behind the target. Away from the lane
 * it rolls a little (deterministic), so the range does not look like a table.
 *
 * @param {number} x
 * @param {number} z
 * @param {SceneLayout} layout
 * @returns {number}
 */
export function terrainHeight(x, z, layout) {
	const start = -SHOOTER_PAD;
	const end = layout.targetZ + TARGET_PAD;
	let base;
	if (z >= start) base = 0;
	else if (z <= end) base = layout.targetGroundY;
	else base = layout.targetGroundY * smooth(start, end, z);
	// A berm behind the target: 3 m high, 15 m behind it.
	const behind = layout.targetZ - z;
	const berm = behind > 0 ? 3 * smooth(4, 15, behind) * (1 - smooth(30, 60, behind)) + 3 * smooth(30, 60, behind) : 0;
	// Rolling ground away from the lane.
	const away = smooth(LANE_HALF_WIDTH, LANE_HALF_WIDTH * 3, Math.abs(x));
	const roll = away * (1.2 * Math.sin(x * 0.045 + z * 0.013) + 0.8 * Math.sin(z * 0.031 - x * 0.02) + 0.6);
	return base + berm + roll;
}

/**
 * Triangle indices for the terrain grid: `columns` vertices per row along +X, rows going down range
 * (each row further along −Z). Each triangle is counter-clockwise seen from above, so its front face
 * (the only side three.js draws) points up (+Y). The other order makes the ground invisible from
 * above (#182 follow-up).
 *
 * @param {number} columns
 * @param {number} rows
 * @returns {number[]}
 */
export function gridIndex(columns, rows) {
	const index = [];
	for (let j = 0; j < rows - 1; j++) {
		for (let i = 0; i < columns - 1; i++) {
			const a = j * columns + i;
			index.push(a, a + 1, a + columns, a + 1, a + columns + 1, a + columns);
		}
	}
	return index;
}

/** Metres per second in a mile per hour. */
const MPS_PER_MPH = 0.44704;

/**
 * The wind speed in m/s from a wind as the page shows it: `mps`, or else mph. Not a number, negative
 * or not finite: 0 (no sway). Only the picture uses it.
 *
 * @param {{ speed: unknown, speedUnit: string }} wind
 * @returns {number}
 */
export function windSpeedMps(wind) {
	const value = readDecimal(wind?.speed);
	if (!(value > 0) || !Number.isFinite(value)) return 0;
	return wind.speedUnit === 'mps' ? value : value * MPS_PER_MPH;
}

/**
 * How the grass and leaves sway (#182). The direction is where the wind comes from (#106): 0° from
 * the target (headwind), 90° from the right. `blow` is the horizontal unit vector the wind blows
 * towards: from the target it blows at the shooter (+Z), from the right to the left (-X).
 *
 * - lean: steady bend in radians, towards `blow`; up to 0.35 rad for grass.
 * - amplitude: gusting bend around the lean, radians.
 * - frequency: gusts per second.
 * Trees bend less than grass (`stiffness` 0.25).
 *
 * @param {{ speed: unknown, speedUnit: string, direction: unknown }} wind - as the page shows it
 * @returns {{ speed: number, blow: { x: number, z: number }, lean: number, amplitude: number, frequency: number, tree: { lean: number, amplitude: number } }}
 */
export function windSway(wind) {
	const speed = windSpeedMps(wind);
	const degrees = readDecimal(wind?.direction);
	const angle = Number.isFinite(degrees) ? (degrees * Math.PI) / 180 : 0;
	// Where it comes from: 0° = (0, -1) on (x, z), 90° = (1, 0); it blows the other way.
	const blow = speed > 0 ? { x: -Math.sin(angle), z: Math.cos(angle) } : { x: 0, z: 0 };
	const strength = 1 - Math.exp(-speed / 8);
	const lean = 0.35 * strength;
	const amplitude = 0.04 + 0.18 * strength;
	const frequency = 0.4 + Math.min(speed, 30) * 0.06;
	const still = speed === 0;
	return {
		speed,
		// + 0 writes -0 as 0.
		blow: { x: blow.x + 0, z: blow.z + 0 },
		lean: still ? 0 : lean,
		amplitude: still ? 0.02 : amplitude,
		frequency: still ? 0.3 : frequency,
		tree: { lean: still ? 0 : lean * 0.25, amplitude: still ? 0.005 : amplitude * 0.25 }
	};
}

/**
 * Neon palette of the scene (#195, owner choice of 2026-11-17: neon grid). Colours as 0xRRGGBB.
 * - solid: the dark fill of every model; cyan and magenta: edge lines; grass: the grass and leaves;
 * - tracer: the bullet's path; hit, miss: the impact mark on and off the target board;
 * - target: the board outline; zoneA, zoneC, zoneD: the zone outlines; backstop: its edges;
 * - highlight: edges of a part a tutorial step points at (pulsing).
 */
export const NEON = Object.freeze({
	solid: 0x05070b,
	cyan: 0x22e6ff,
	magenta: 0xff2bd6,
	grass: 0x2bff9c,
	tracer: 0xff2bd6,
	hit: 0xff2bd6,
	miss: 0xffd60a,
	target: 0x22e6ff,
	zoneA: 0xff2bd6,
	zoneC: 0x22e6ff,
	zoneD: 0x1b8fa8,
	backstop: 0xff2bd6,
	highlight: 0xfff27a
});

/**
 * The look of each scene weather in the neon grid (visual only, #180, #195): digital variants of
 * the four choices. Colours as 0xRRGGBB.
 * - sky: the sky overhead (near-black); horizon: the glow at the horizon; horizonHeight: how high the
 *   glow reaches (0..1 of the way up);
 * - fog, fogDensity: FogExp2 that fades the grid and the far models into the horizon;
 * - grid, gridStrength: colour and brightness of the ground grid lines;
 * - grassShown: the share of the grass tufts drawn (snow covers most of them);
 * - precipitation: 'none', 'rain' (neon streaks) or 'snow' (glowing flakes), in precipitationColor.
 */
export const WEATHER_LOOKS = Object.freeze({
	sunny: Object.freeze({ sky: 0x020309, horizon: 0x1a2f5c, horizonHeight: 0.12, fog: 0x050a18, fogDensity: 0.0009, grid: 0x22e6ff, gridStrength: 1, grassShown: 1, precipitation: 'none', precipitationColor: 0 }),
	cloudy: Object.freeze({ sky: 0x07070d, horizon: 0x4a2a5e, horizonHeight: 0.3, fog: 0x1a1428, fogDensity: 0.0045, grid: 0x22e6ff, gridStrength: 0.7, grassShown: 1, precipitation: 'none', precipitationColor: 0 }),
	rain: Object.freeze({ sky: 0x010208, horizon: 0x0f3a52, horizonHeight: 0.2, fog: 0x06121c, fogDensity: 0.003, grid: 0x1fb8ff, gridStrength: 0.85, grassShown: 1, precipitation: 'rain', precipitationColor: 0x3fd8ff }),
	snow: Object.freeze({ sky: 0x0a0c14, horizon: 0x5a6a8a, horizonHeight: 0.25, fog: 0x2a3040, fogDensity: 0.0035, grid: 0xb8e8ff, gridStrength: 0.6, grassShown: 0.3, precipitation: 'snow', precipitationColor: 0xe8f6ff })
});

/**
 * The look of a weather; anything else is sunny.
 * @param {string} weather
 */
export function weatherLook(weather) {
	return WEATHER_LOOKS[/** @type {'sunny'|'cloudy'|'rain'|'snow'} */ (weather)] ?? WEATHER_LOOKS.sunny;
}

/**
 * A seeded random generator (mulberry32): the same seed gives the same scene on every visit.
 * @param {number} seed
 * @returns {() => number} numbers in [0, 1)
 */
export function seededRandom(seed) {
	let a = seed >>> 0;
	return () => {
		a = (a + 0x6d2b79f5) >>> 0;
		let t = a;
		t = Math.imul(t ^ (t >>> 15), t | 1);
		t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
		return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
	};
}

/** The tree models (#181). */
export const TREE_MODELS = Object.freeze(['tree-broadleaf', 'tree-birch', 'tree-conifer']);

/**
 * The share of each tree model at a shooter altitude: broadleaf and birch in the lowlands, more
 * conifers higher up, conifers only from 1600 m, and fewer trees from 2200 m (tree line).
 *
 * @param {number} altitudeM
 * @returns {{ 'tree-broadleaf': number, 'tree-birch': number, 'tree-conifer': number, density: number }}
 */
export function treeMix(altitudeM) {
	const alt = Number.isFinite(altitudeM) ? altitudeM : 0;
	if (alt >= 1600) return { 'tree-broadleaf': 0, 'tree-birch': 0, 'tree-conifer': 1, density: alt >= 2200 ? 0.35 : 1 };
	if (alt >= 800) return { 'tree-broadleaf': 0.15, 'tree-birch': 0.25, 'tree-conifer': 0.6, density: 1 };
	return { 'tree-broadleaf': 0.5, 'tree-birch': 0.35, 'tree-conifer': 0.15, density: 1 };
}

/**
 * Trees lining both sides of the range, from behind the shooter to past the target, outside the
 * lane. Seeded: the same layout and count give the same trees.
 *
 * @param {SceneLayout} layout
 * @param {number} perSide - from the quality preset
 * @returns {Array<{ model: string, x: number, y: number, z: number, scale: number, rotation: number }>}
 */
export function treePlacements(layout, perSide) {
	const random = seededRandom(180182);
	const mix = treeMix(layout.altitude);
	const count = Math.max(0, Math.round(perSide * mix.density));
	const from = 15;
	const to = layout.targetZ - 25;
	const trees = [];
	for (const side of [-1, 1]) {
		for (let i = 0; i < count; i++) {
			// Closer together near the shooter, where the camera usually is.
			const f = (i + random() * 0.8) / Math.max(1, count);
			const z = from + (to - from) * f * f;
			const x = side * (LANE_HALF_WIDTH + 2 + random() * 14);
			const r = random();
			const model = r < mix['tree-broadleaf'] ? 'tree-broadleaf' : r < mix['tree-broadleaf'] + mix['tree-birch'] ? 'tree-birch' : 'tree-conifer';
			trees.push({ model, x, y: terrainHeight(x, z, layout), z, scale: 0.8 + random() * 0.5, rotation: random() * Math.PI * 2 });
		}
	}
	return trees;
}

/** How far the grass reaches either side of the line of fire, metres. */
export const GRASS_HALF_WIDTH = LANE_HALF_WIDTH + 10;

/**
 * The band the grass covers (#195): GRASS_HALF_WIDTH either side of the line of fire, from 6 m behind
 * the shooter to 10 m past the target.
 *
 * @param {SceneLayout} layout
 * @returns {{ x0: number, x1: number, z0: number, z1: number }} z0 nearer the shooter (z0 > z1)
 */
export function grassBand(layout) {
	return { x0: -GRASS_HALF_WIDTH, x1: GRASS_HALF_WIDTH, z0: 6, z1: layout.targetZ - 10 };
}

/**
 * The cells of the grass grid: about `count` cells over the band, as square as the band allows.
 *
 * @param {{ x0: number, x1: number, z0: number, z1: number }} band
 * @param {number} count
 * @returns {{ columns: number, rows: number, width: number, length: number }} width and length of a cell, m
 */
export function grassGrid(band, count) {
	const w = band.x1 - band.x0;
	const l = band.z0 - band.z1;
	const n = Math.max(0, Math.floor(count));
	if (n === 0 || !(w > 0) || !(l > 0)) return { columns: 0, rows: 0, width: 0, length: 0 };
	const columns = Math.max(1, Math.min(n, Math.round(Math.sqrt((n * w) / l))));
	const rows = Math.max(1, Math.floor(n / columns));
	return { columns, rows, width: w / columns, length: l / rows };
}

/** Grass is kept this far from the sandbag (x, z) and from the target stand, metres. */
const CLEAR = { x: 0.6, z: 1.2 };

/** A tuft stays this share of a cell away from the cell's sides, so float rounding keeps it in its cell. */
const CELL_MARGIN = 0.05;

/**
 * Grass tufts spread evenly over the range (#195): a jittered grid over grassBand, one tuft per cell,
 * at a seeded random place in it (away from the cell's sides by CELL_MARGIN), so there are no clumps
 * and no bare stripes. A tuft that would stand on the sandbag or the target stand moves to the mirror
 * place in its own cell, and is left out if that place is blocked too (cells smaller than the cleared
 * area). Density by quality: about `count` tufts whatever the distance, so a longer range has sparser
 * grass.
 *
 * @param {SceneLayout} layout
 * @param {number} count - from the quality preset
 * @returns {Float32Array} x, y, z, rotation, scale for each tuft (5 numbers each), cell by cell
 */
export function grassPlacements(layout, count) {
	const random = seededRandom(1822);
	const band = grassBand(layout);
	const grid = grassGrid(band, count);
	const out = new Float32Array(grid.columns * grid.rows * 5);
	const blocked = (px, pz) => Math.abs(px) < CLEAR.x && (Math.abs(pz) < CLEAR.z || Math.abs(pz - layout.targetZ) < CLEAR.z);
	const jitter = () => CELL_MARGIN + random() * (1 - 2 * CELL_MARGIN);
	let i = 0;
	for (let r = 0; r < grid.rows; r++) {
		for (let c = 0; c < grid.columns; c++) {
			const cellX = band.x0 + c * grid.width;
			const cellZ = band.z0 - r * grid.length;
			const fx = jitter();
			const fz = jitter();
			const rotation = random() * Math.PI * 2;
			const scale = 0.7 + random() * 0.6;
			let x = cellX + fx * grid.width;
			let z = cellZ - fz * grid.length;
			if (blocked(x, z)) {
				x = cellX + (1 - fx) * grid.width;
				z = cellZ - (1 - fz) * grid.length;
				if (blocked(x, z)) continue;
			}
			out.set([x, terrainHeight(x, z, layout), z, rotation, scale], i * 5);
			i++;
		}
	}
	return out.slice(0, i * 5);
}

/** Distance from the target face to the backstop's front, metres. */
export const BACKSTOP_GAP = 3;

/**
 * The backstop behind the target (#195): a wall wide and high enough to frame the target as seen
 * from the shooter at any distance and elevation. It stands BACKSTOP_GAP behind the target face, is
 * 3% of the distance wide (at least 6 m) and 2% of it high above the target's ground (at least
 * 3.5 m), and goes 1 m into the ground, below the lowest ground under it, so no gap shows.
 *
 * @param {SceneLayout} layout
 * @returns {{ x: number, y: number, z: number, width: number, height: number, depth: number }} centre and size, m
 */
export function backstopBox(layout) {
	const distance = Math.hypot(layout.horizontal, layout.aim.y - layout.los.y);
	const width = Math.max(6, distance * 0.03);
	const above = Math.max(3.5, distance * 0.02);
	const z = layout.targetZ - BACKSTOP_GAP;
	const depth = 1;
	let ground = Infinity;
	for (const x of [-width / 2, 0, width / 2]) {
		for (const dz of [-depth / 2, depth / 2]) ground = Math.min(ground, terrainHeight(x, z + dz, layout));
	}
	const bottom = Math.min(ground, layout.targetGroundY) - 1;
	const top = layout.targetGroundY + above;
	return { x: 0, y: (top + bottom) / 2, z, width, height: top - bottom, depth };
}

/** Half the width of the target board, metres (#181: 46 cm). */
export const TARGET_HALF_WIDTH = 0.23;

/**
 * The four corners of the target face in the scene: what the HUD bracket frames.
 * @param {SceneLayout} layout
 * @returns {Array<[number, number, number]>}
 */
export function targetFaceCorners(layout) {
	const bottom = layout.targetGroundY + TARGET_FACE_BOTTOM;
	const top = bottom + TARGET_FACE_HEIGHT;
	const z = layout.targetZ;
	return [
		[-TARGET_HALF_WIDTH, bottom, z],
		[TARGET_HALF_WIDTH, bottom, z],
		[-TARGET_HALF_WIDTH, top, z],
		[TARGET_HALF_WIDTH, top, z]
	];
}

/** Smallest and largest HUD bracket, CSS pixels. */
export const HUD_MIN_SIZE = 28;
export const HUD_MAX_SIZE = 160;

/**
 * The HUD bracket around the target (#195), from the target's corners projected to normalized device
 * coordinates (x and y in -1..1, z in -1..1 in front of the camera). At least HUD_MIN_SIZE wide and
 * high, centred on the target, so a target of a few pixels gets a bracket that can be seen. Null when
 * a corner is behind the camera, when the target is off screen, or when it is already big on screen
 * (the bracket would be larger than HUD_MAX_SIZE: no help needed).
 *
 * @param {Array<{ x: number, y: number, z: number }>} ndc - projected corners
 * @param {number} width - viewport, CSS pixels
 * @param {number} height
 * @returns {{ x: number, y: number, width: number, height: number } | null} top-left corner and size, CSS pixels
 */
export function hudBracket(ndc, width, height) {
	if (!(width > 0) || !(height > 0) || ndc.length === 0) return null;
	if (ndc.some((p) => !Number.isFinite(p.x) || !Number.isFinite(p.y) || !(p.z > -1 && p.z < 1))) return null;
	const xs = ndc.map((p) => ((p.x + 1) / 2) * width);
	const ys = ndc.map((p) => ((1 - p.y) / 2) * height);
	const left = Math.min(...xs);
	const right = Math.max(...xs);
	const top = Math.min(...ys);
	const bottom = Math.max(...ys);
	if (right < 0 || left > width || bottom < 0 || top > height) return null;
	const w = Math.max(HUD_MIN_SIZE, right - left + 12);
	const h = Math.max(HUD_MIN_SIZE, bottom - top + 12);
	if (w > HUD_MAX_SIZE || h > HUD_MAX_SIZE) return null;
	const cx = (left + right) / 2;
	const cy = (top + bottom) / 2;
	return { x: cx - w / 2, y: cy - h / 2, width: w, height: h };
}

/** Half the height of the view through a riflescope, in mrad (about 6 mrad up and down). */
export const SCOPE_HALF_VIEW_MRAD = 6;
/** Vertical field of view through the holographic sight, in degrees (no magnification). */
export const HOLO_FOV_DEG = 28;

/**
 * The vertical field of view through the optic, in degrees: a riflescope shows ±SCOPE_HALF_VIEW_MRAD,
 * so the reticle overlay's milliradians match the scene's.
 * @param {'scope'|'holo'} optic
 */
export function opticFov(optic) {
	return optic === 'scope' ? (2 * Math.atan(SCOPE_HALF_VIEW_MRAD / 1000) * 180) / Math.PI : HOLO_FOV_DEG;
}

/** Vertical field of view of the shooter view, degrees (#195: narrower, so the target is bigger). */
export const SHOOTER_FOV_DEG = 32;

/**
 * Where each camera preset puts the camera and what it looks at.
 *
 * - shooter: behind and to the right of the shooter, looking at the target, through a narrower field
 *   of view (SHOOTER_FOV_DEG); the look-at point (the orbit centre) is 25 m along that line, so the
 *   camera still turns around the shooter;
 * - optic: on the line of sight, looking at the aim point, through the optic's field of view;
 * - side: off to the right of the middle of the range, far enough to see the whole flight;
 * - target: in front of the target, to its right, looking at it.
 *
 * @param {'shooter'|'optic'|'side'|'target'} preset
 * @param {SceneLayout} layout
 * @param {'scope'|'holo'} optic
 * @returns {{ position: [number, number, number], target: [number, number, number], fov: number }}
 */
export function cameraPose(preset, layout, optic) {
	const { los, aim } = layout;
	switch (preset) {
		case 'optic':
			return { position: [los.x, los.y, los.z + 0.12], target: [aim.x, aim.y, aim.z], fov: opticFov(optic) };
		case 'side': {
			const midZ = (los.z + aim.z) / 2;
			const midY = (los.y + aim.y) / 2;
			const away = Math.max(8, layout.horizontal * 0.55);
			return { position: [away, midY + Math.max(1.5, away * 0.08), midZ], target: [0, midY, midZ], fov: 45 };
		}
		case 'target':
			return { position: [aim.x + 2.2, aim.y + 0.4, aim.z + 6], target: [aim.x, aim.y - 0.1, aim.z], fov: 45 };
		case 'shooter':
		default: {
			const position = [0.9, los.y + 1.3, los.z + 3.2];
			const d = [aim.x - position[0], aim.y - position[1], aim.z - position[2]];
			const n = Math.hypot(...d) || 1;
			const k = Math.min(25, n) / n;
			const target = [position[0] + d[0] * k, position[1] + d[1] * k, position[2] + d[2] * k];
			return { position: /** @type {[number, number, number]} */ (position), target: /** @type {[number, number, number]} */ (target), fov: SHOOTER_FOV_DEG };
		}
	}
}
