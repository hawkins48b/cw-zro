/**
 * Range objects of the tutorial (#181): IPSC-style target, spotting scope, wind flag. Conventions in
 * kit.js: metres, +Y up, the shooter is at +Z looking to -Z, so the target faces +Z. Origins on the
 * ground.
 */
import * as THREE from 'three';
import { mergeVertices } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { box, group, latheZ, material, part, rod, slab, tube } from './kit.js';

/** Height of the target's bottom edge above the ground. */
export const TARGET_BOTTOM = 0.8;

/** A flat shape facing +Z, from [x, y] points, with holes. */
function face(outline, holes = []) {
	const shape = new THREE.Shape(outline.map(([x, y]) => new THREE.Vector2(x, y)));
	for (const hole of holes) shape.holes.push(new THREE.Path(hole.map(([x, y]) => new THREE.Vector2(x, y))));
	return new THREE.ShapeGeometry(shape, 1);
}

/** A rectangle as [x, y] points, counter-clockwise. */
const rect = (x0, y0, x1, y1) => [
	[x0, y0],
	[x1, y0],
	[x1, y1],
	[x0, y1]
];

/**
 * IPSC-style target, 46 × 76 cm: an octagonal body and a head. The zones follow the classic
 * target's layout only roughly (not a regulation drawing): A is a 15 × 28 cm box in the body and a
 * 10 × 5 cm box in the head, C the inner octagon and the rest of the head, D the rest of the body.
 * Each zone is its own mesh, in one plane, without overlaps, so a ray hits exactly one.
 *
 * Nodes: target (origin at the middle of the bottom edge of the face, TARGET_BOTTOM above the
 * ground) with board (the cardboard, behind the zones), zone-a, zone-c, zone-d; stand (two laths and
 * a foot). No hard cover: glTF cannot hide a node, so every viewer drew it as a black square.
 */
export function ipscTarget() {
	const card = material('cardboard', 0xb08d5b, { roughness: 0.95 });
	const zoneD = material('zone-d', 0xc4a06a, { roughness: 0.95 });
	const zoneC = material('zone-c', 0xceac78, { roughness: 0.95 });
	const zoneA = material('zone-a', 0xdcbf8f, { roughness: 0.95 });
	const wood = material('wood', 0x9b7a4f, { roughness: 0.9 });

	const bodyD = [
		[-0.15, 0],
		[0.15, 0],
		[0.23, 0.08],
		[0.23, 0.47],
		[0.12, 0.58],
		[-0.12, 0.58],
		[-0.23, 0.47],
		[-0.23, 0.08]
	];
	const head = [
		[-0.075, 0.58],
		[0.075, 0.58],
		[0.075, 0.735],
		[0.05, 0.76],
		[-0.05, 0.76],
		[-0.075, 0.735]
	];
	const bodyC = [
		[-0.1, 0.1],
		[0.1, 0.1],
		[0.15, 0.15],
		[0.15, 0.42],
		[0.09, 0.48],
		[-0.09, 0.48],
		[-0.15, 0.42],
		[-0.15, 0.15]
	];
	const bodyA = rect(-0.075, 0.15, 0.075, 0.43);
	const headA = rect(-0.05, 0.64, 0.05, 0.69);
	// The silhouette: the body with the head on top, for the board.
	const silhouette = [
		[-0.15, 0],
		[0.15, 0],
		[0.23, 0.08],
		[0.23, 0.47],
		[0.12, 0.58],
		[0.075, 0.58],
		[0.075, 0.735],
		[0.05, 0.76],
		[-0.05, 0.76],
		[-0.075, 0.735],
		[-0.075, 0.58],
		[-0.12, 0.58],
		[-0.23, 0.47],
		[-0.23, 0.08]
	];

	const board = part('board', [[card, slab(new THREE.Shape(silhouette.map(([x, y]) => new THREE.Vector2(x, y))), 0.003).translate(0, 0, -0.002)]]);
	const a = part('zone-a', [
		[zoneA, face(bodyA)],
		[zoneA, face(headA)]
	]);
	const c = part('zone-c', [
		[zoneC, face(bodyC, [bodyA])],
		[zoneC, face(head, [headA])]
	]);
	const d = part('zone-d', [[zoneD, face(bodyD, [bodyC])]]);
	const target = group('target', { at: [0, TARGET_BOTTOM, 0], children: [board, a, c, d] });

	const stand = part('stand', [
		[wood, box(0.035, TARGET_BOTTOM + 0.5, 0.018, -0.12, (TARGET_BOTTOM + 0.5) / 2, -0.013)],
		[wood, box(0.035, TARGET_BOTTOM + 0.5, 0.018, 0.12, (TARGET_BOTTOM + 0.5) / 2, -0.013)],
		[wood, box(0.6, 0.06, 0.12, 0, 0.03, -0.013)]
	]);

	return group('ipsc-target', { children: [target, stand] });
}

/**
 * Spotting scope (80 mm objective, 45° eyepiece) on a tripod, eyepiece about 1.35 m above the ground.
 * Nodes: tripod (legs and column), head (origin on the pan axis: turns about Y), scope-body (child of
 * head, origin on the tilt axis: turns about X; objective at -Z) with objective (origin at the lens
 * centre), focus-ring (turns about Z) and eyepiece.
 */
export function spottingScope() {
	const black = material('black', 0x1e1f21, { metalness: 0.3, roughness: 0.6 });
	const green = material('armour', 0x3c4a3a, { roughness: 0.8 });
	const glass = material('glass', 0x2a3d5c, { metalness: 0.9, roughness: 0.08 });
	const alloy = material('alloy', 0x7d8085, { metalness: 0.8, roughness: 0.4 });

	const headY = 1.2;
	const legs = /** @type {Array<[THREE.Material, THREE.BufferGeometry]>} */ ([]);
	const spread = 0.5;
	const footRadius = 0.009;
	// A leg's end is cut square to the leg: lift it by r·sin(lean), so its lowest edge is on the ground.
	const foot = footRadius * Math.sin(Math.atan2(spread, headY - 0.06));
	for (let i = 0; i < 3; i++) {
		const yaw = (i / 3) * 2 * Math.PI + Math.PI / 3;
		legs.push([alloy, rod([0, headY - 0.06, 0], [Math.sin(yaw) * spread, foot, Math.cos(yaw) * spread], 0.014, footRadius, 6)]);
	}
	legs.push([black, tube({ from: headY - 0.25, to: headY - 0.02, rFrom: 0.016, segments: 8 })]);
	legs.push([black, tube({ from: headY - 0.1, to: headY - 0.04, rFrom: 0.035, segments: 10 })]);
	const tripod = part('tripod', legs);

	const objective = part(
		'objective',
		[
			[
				green,
				latheZ(
					[
						[0.046, -0.004],
						[0.048, 0],
						[0.048, 0.1],
						[0.038, 0.14]
					],
					20
				)
			],
			// The glass fills the mouth up to the wall (r 0.048 there), so no gap shows into the tube.
			[glass, new THREE.CircleGeometry(0.047, 20).rotateY(Math.PI).translate(0, 0, 0.003)],
			// Back of the objective, where it meets the narrower body: closed, facing +Z.
			[green, new THREE.CircleGeometry(0.038, 20).translate(0, 0, 0.14)]
		],
		{ at: [0, 0, -0.2] }
	);
	const focusRing = part('focus-ring', [[black, tube({ axis: 'z', from: -0.025, to: 0.025, rFrom: 0.04, segments: 20 })]], { at: [0, 0, 0.0] });
	// Eyepiece at 45°, up and back.
	const eyeFrom = /** @type {[number, number, number]} */ ([0, 0.02, 0.12]);
	const eyeTo = /** @type {[number, number, number]} */ ([0, 0.09, 0.19]);
	const eyepiece = part('eyepiece', [
		[green, rod(eyeFrom, eyeTo, 0.026, 0.022, 14)],
		[black, rod(eyeTo, [0, 0.11, 0.21], 0.024, 0.024, 14)]
	]);
	const scopeBody = part(
		'scope-body',
		[
			[
				green,
				latheZ(
					[
						[0.036, -0.06],
						[0.034, 0.08],
						[0.03, 0.14]
					],
					20
				)
			],
			// End caps: a lathe is open at both ends, so the back showed the inside of the tube.
			[green, new THREE.CircleGeometry(0.036, 20).rotateY(Math.PI).translate(0, 0, -0.06)],
			[green, new THREE.CircleGeometry(0.03, 20).translate(0, 0, 0.14)],
			// Foot on the head
			[black, box(0.03, 0.04, 0.08, 0, -0.04, 0)]
		],
		{ at: [0, 0.06, 0], children: [objective, focusRing, eyepiece] }
	);
	const head = part(
		'head',
		[
			[black, tube({ from: -0.02, to: 0.02, rFrom: 0.03, segments: 10 })],
			// Pan handle, back and down
			[black, rod([0, 0, 0.02], [0, -0.06, 0.3], 0.008, 0.008, 6)]
		],
		{ at: [0, headY, 0], children: [scopeBody] }
	);

	return group('spotting-scope', { children: [tripod, head] });
}

/** Height above the ground of the bottom of the sandbag's groove, where the rifle's fore-end rests. */
export const SANDBAG_REST = 0.12;

/** Height of the sandbag's top, and the depth of its groove on the centre line. */
const SANDBAG_HEIGHT = 0.15;
const GROOVE = SANDBAG_HEIGHT - SANDBAG_REST;

/**
 * Front rest sandbag, about 26 cm wide (X), 20 cm long (Z, along the rifle) and 15 cm high, with a
 * groove along Z on top for the rifle's fore-end. A rounded box (superellipsoid), flat where it sits
 * on the ground. Nodes: bag (origin on the ground, at the middle), rest (empty, at the bottom of the
 * groove, SANDBAG_REST above the ground). To lay the rifle on it, put the fore-end's underside on
 * `rest`: in rifle.glb it is about 0.052 m below the bore axis, 0.3 m in front of the bolt face.
 */
export function sandbag() {
	const canvas = material('canvas', 0x7d6b4f, { roughness: 0.95 });
	const W = 0.26;
	const D = 0.2;
	const g = new THREE.BoxGeometry(2, 2, 2, 16, 8, 12);
	g.deleteAttribute('normal');
	g.deleteAttribute('uv');
	const p = g.attributes.position;
	const n = 4; // superellipsoid exponent: a box with well rounded edges
	const floor = -0.9; // below this (in -1..1) the bag is flat on the ground
	for (let i = 0; i < p.count; i++) {
		const x = p.getX(i);
		const y = p.getY(i);
		const z = p.getZ(i);
		const k = (Math.abs(x) ** n + Math.abs(y) ** n + Math.abs(z) ** n) ** (1 / n);
		const w = z / k;
		const u = (x / k) * (1 + 0.04 * (1 - w * w)); // a little fuller in the middle, like a filled bag
		const v = Math.max(y / k, floor);
		let py = ((v - floor) / (1 - floor)) * SANDBAG_HEIGHT;
		// Groove along Z in the top half, deepest on the centre line (GROOVE there, at v = 1).
		if (v > 0) py -= GROOVE * Math.exp(-((((u * W) / 2) / 0.045) ** 2)) * v;
		p.setXYZ(i, (u * W) / 2, py, (w * D) / 2);
	}
	const geometry = mergeVertices(g);
	geometry.computeVertexNormals();
	const bag = part('bag', [[canvas, geometry]]);
	const rest = group('rest', { at: [0, SANDBAG_REST, 0] });
	return group('sandbag', { children: [bag, rest] });
}

/**
 * Range wind flag on a 3 m pole. The cloth (`cloth`, 90 × 45 cm, 16 × 8 quads, double-sided) has its
 * origin at the top of its hoist edge, on the pole, and hangs out along +X: point +X downwind. Its
 * vertices can be moved for the animation; no UVs, use position.x for the distance from the pole.
 * Nodes: pole, cloth.
 */
export function flag() {
	const white = material('pole', 0xd9d9d9, { metalness: 0.4, roughness: 0.5 });
	const red = material('cloth', 0xd9461f, { roughness: 0.9, doubleSide: true });
	const pole = part('pole', [
		[white, tube({ from: 0, to: 3, rFrom: 0.022, rTo: 0.016, segments: 10 })],
		[white, new THREE.SphereGeometry(0.03, 10, 6).translate(0, 3.02, 0)]
	]);
	const cloth = part('cloth', [[red, new THREE.PlaneGeometry(0.9, 0.45, 16, 8).translate(0.45, -0.225, 0)]], { at: [0.018, 2.95, 0] });
	return group('flag', { children: [pole, cloth] });
}
