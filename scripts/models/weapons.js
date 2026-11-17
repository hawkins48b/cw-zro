/**
 * Rifle, riflescope, holographic sight and bullet of the tutorial (#181). Conventions in kit.js:
 * metres, +Y up, forward is -Z. Dimensions are typical values, not a given product.
 */
import * as THREE from 'three';
import { box, group, latheZ, material, part, ribbed, rod, sideSlab, tube } from './kit.js';

/** Height of the scope's optical axis above the rail top, given by its rings (rifle + scope). */
export const SCOPE_RING_HEIGHT = 0.038;

const steelOf = () => material('steel', 0x2a2b2e, { metalness: 0.7, roughness: 0.45 });
const blackOf = () => material('black', 0x17181a, { metalness: 0.3, roughness: 0.55 });
const glassOf = () => material('glass', 0x2a3d5c, { metalness: 0.9, roughness: 0.08 });

/**
 * Bolt-action rifle, 24" barrel with a muzzle brake. Origin on the bore axis at the breech (the
 * bolt face); the muzzle is at -Z. Nodes: stock, barrel, muzzle (origin at the muzzle exit),
 * receiver, bolt (origin on the bore axis at the bolt face: it turns about Z and slides along Z),
 * optic-rail (origin at the top of the rail, at its middle), trigger, trigger-guard, magazine.
 */
export function rifle() {
	const steel = steelOf();
	const black = blackOf();
	const wood = material('wood', 0x6b4a2b, { roughness: 0.7 });
	const rubber = material('rubber', 0x111111, { roughness: 0.95 });

	const barrelLength = 0.61;
	const brakeLength = 0.065;
	const receiverRadius = 0.0175;

	const stockOutline = /** @type {Array<[number, number]>} */ ([
		[-0.36, -0.01],
		[0.215, -0.01],
		[0.25, -0.014],
		[0.3, -0.006],
		[0.36, 0.01],
		[0.6, 0.016],
		[0.6, -0.14],
		[0.57, -0.143],
		[0.38, -0.07],
		[0.335, -0.072],
		[0.32, -0.135],
		[0.28, -0.14],
		[0.255, -0.07],
		[0.0, -0.062],
		[-0.3, -0.052],
		[-0.36, -0.042]
	]);
	const stock = part('stock', [
		[wood, sideSlab(stockOutline, 0.05, { bevel: 0.006 })],
		// Butt pad
		[rubber, box(0.058, 0.168, 0.022, 0, -0.063, 0.617)]
	]);

	const barrel = part('barrel', [[steel, tube({ axis: 'z', from: 0, to: -barrelLength, rFrom: 0.0145, rTo: 0.0095, segments: 16 })]]);

	// Muzzle brake: built from the exit (z = 0) back to the barrel, so its origin is the muzzle exit.
	const muzzle = part(
		'muzzle',
		[
			[steel, tube({ axis: 'z', from: brakeLength, to: 0, rFrom: 0.012, segments: 16 })],
			[black, tube({ axis: 'z', from: 0.048, to: 0.036, rFrom: 0.0128, segments: 16 })],
			[black, tube({ axis: 'z', from: 0.028, to: 0.016, rFrom: 0.0128, segments: 16 })]
		],
		{ at: [0, 0, -barrelLength - brakeLength] }
	);

	const receiver = part('receiver', [
		[steel, tube({ axis: 'z', from: -0.005, to: 0.215, rFrom: receiverRadius, segments: 16 })],
		// Recoil lug and tang
		[steel, box(0.03, 0.012, 0.01, 0, -0.02, 0.0)],
		[steel, box(0.014, 0.008, 0.04, 0, -0.012, 0.225)]
	]);

	// Picatinny rail: base and cross-slots (10 mm pitch). Origin at the top of the rail, at its middle.
	const railLength = 0.17;
	const railPieces = /** @type {Array<[THREE.Material, THREE.BufferGeometry]>} */ ([[black, box(0.0156, 0.0065, railLength, 0, -0.0063, 0)]]);
	const teeth = 17;
	for (let i = 0; i < teeth; i++) {
		const z = -railLength / 2 + (i + 0.5) * (railLength / teeth);
		railPieces.push([black, box(0.0212, 0.0035, 0.0053, 0, -0.00175, z)]);
	}
	const rail = part('optic-rail', railPieces, { at: [0, receiverRadius + 0.0095, 0.105] });

	// Bolt: body inside the receiver, shroud behind it, handle to the right (+X) and down.
	const bolt = part('bolt', [
		[steel, tube({ axis: 'z', from: 0.005, to: 0.215, rFrom: 0.0095, segments: 12 })],
		[black, tube({ axis: 'z', from: 0.215, to: 0.255, rFrom: 0.012, rTo: 0.009, segments: 12 })],
		[steel, rod([0, 0, 0.19], [0.055, -0.022, 0.2], 0.004, 0.0035, 8)],
		[black, new THREE.SphereGeometry(0.0095, 10, 8).translate(0.06, -0.025, 0.2)]
	]);

	const trigger = part('trigger', [[steel, box(0.006, 0.024, 0.005, 0, -0.077, 0.205)]]);
	const triggerGuard = part('trigger-guard', [
		[
			black,
			sideSlab(
				[
					[0.165, -0.06],
					[0.255, -0.06],
					[0.255, -0.1],
					[0.165, -0.1]
				],
				0.014,
				{
					holes: [
						[
							[0.175, -0.062],
							[0.175, -0.092],
							[0.245, -0.092],
							[0.245, -0.062]
						]
					]
				}
			)
		]
	]);
	const magazine = part('magazine', [[black, box(0.03, 0.05, 0.075, 0, -0.085, 0.1)]]);

	return group('rifle', { children: [stock, barrel, muzzle, receiver, rail, bolt, trigger, triggerGuard, magazine] });
}

/**
 * Turret cap along +Y: a stem, a ribbed cap and a white zero line at -Z, so a turn shows.
 * @param {THREE.Material} body
 * @param {THREE.Material} mark
 * @param {number} radius
 * @param {number} height
 */
function turretPieces(body, mark, radius, height) {
	return /** @type {Array<[THREE.Material, THREE.BufferGeometry]>} */ ([
		[body, tube({ from: -0.002, to: 0.004, rFrom: radius * 0.75, segments: 16 })],
		[body, ribbed(radius, 0.004, height, 14, radius * 0.06)],
		[mark, box(0.0012, 0.0006, radius * 0.5, 0, height + 0.0003, -radius * 0.6)]
	]);
}

/** Turns a list of pieces built along +Y onto +X or -X. */
function onX(pieces, sign) {
	for (const [, g] of pieces) g.rotateZ(sign > 0 ? -Math.PI / 2 : Math.PI / 2);
	return pieces;
}

/**
 * Riflescope, 30 mm tube, 56 mm objective, with rings. Origin on the optical axis, halfway between
 * the rings; the objective is at -Z. The ring bases sit SCOPE_RING_HEIGHT below the axis, on the
 * rifle's optic-rail origin. No reticle: the app draws it.
 * Nodes and the axis each turns about (in the node's own axes): elevation-turret (Y),
 * windage-turret (X, on the right), parallax-turret (X, on the left), magnification-ring (Z),
 * objective and ocular (origins at the centre of their lens), body, rings, eyepoint (empty: the eye,
 * 90 mm behind the ocular).
 */
export function scope() {
	const black = blackOf();
	const glass = glassOf();
	const mark = material('mark', 0xe8e8e8, { roughness: 0.6 });

	const body = part('body', [
		[black, tube({ axis: 'z', from: -0.1, to: 0.14, rFrom: 0.015, segments: 20 })],
		// Turret saddle
		[black, box(0.04, 0.042, 0.065)],
		[black, tube({ from: 0.021, to: 0.025, rFrom: 0.014, segments: 16 })],
		[black, tube({ axis: 'x', from: 0.02, to: 0.024, rFrom: 0.014, segments: 16 })],
		[black, tube({ axis: 'x', from: -0.02, to: -0.024, rFrom: 0.011, segments: 16 })]
	]);

	// Objective bell, from the lens (z = 0 at the node) back to the tube.
	const objective = part(
		'objective',
		[
			[
				black,
				latheZ(
					[
						[0.0285, -0.006],
						[0.031, -0.004],
						[0.031, 0.055],
						[0.016, 0.092],
						[0.015, 0.1]
					],
					24
				)
			],
			[glass, new THREE.CircleGeometry(0.0265, 24).rotateY(Math.PI).translate(0, 0, 0.002)]
		],
		{ at: [0, 0, -0.192] }
	);

	const ocular = part(
		'ocular',
		[
			[
				black,
				latheZ(
					[
						[0.0155, -0.055],
						[0.019, -0.04],
						[0.021, -0.012],
						[0.021, 0.0],
						[0.019, 0.003]
					],
					24
				)
			],
			[glass, new THREE.CircleGeometry(0.0165, 24).translate(0, 0, -0.002)]
		],
		{ at: [0, 0, 0.19] }
	);

	const magnification = part('magnification-ring', [[black, ribbed(0.0185, -0.012, 0.012, 16, 0.0012).rotateX(Math.PI / 2)], [mark, box(0.0012, 0.0006, 0.008, 0, 0.0186, 0)]], {
		at: [0, 0, 0.12]
	});

	const elevation = part('elevation-turret', turretPieces(black, mark, 0.0165, 0.024), { at: [0, 0.025, 0] });
	const windage = part('windage-turret', onX(turretPieces(black, mark, 0.0165, 0.024), 1), { at: [0.024, 0, 0] });
	const parallax = part('parallax-turret', onX(turretPieces(black, mark, 0.0125, 0.016), -1), { at: [-0.024, 0, 0] });

	// Rings: a band around the tube, a base down to the rail, a clamp under it.
	const ringPieces = /** @type {Array<[THREE.Material, THREE.BufferGeometry]>} */ ([]);
	for (const z of [-0.065, 0.065]) {
		ringPieces.push([black, tube({ axis: 'z', from: z - 0.0075, to: z + 0.0075, rFrom: 0.0185, segments: 20 })]);
		ringPieces.push([black, box(0.026, 0.022, 0.015, 0, -SCOPE_RING_HEIGHT + 0.011, z)]);
		ringPieces.push([black, box(0.034, 0.005, 0.015, 0.003, -SCOPE_RING_HEIGHT + 0.0025, z)]);
	}
	const rings = part('rings', ringPieces);

	const eyepoint = group('eyepoint', { at: [0, 0, 0.19 + 0.09] });

	return group('scope', { children: [body, objective, ocular, magnification, elevation, windage, parallax, rings, eyepoint] });
}

/**
 * Holographic sight with a boxy hood (in the EOTech style, no brand or logo). Origin at the middle
 * of the base underside (the rail contact), forward is -Z. Nodes: base, housing, battery-cap (the
 * battery tube across the front), hood, window (origin at the middle of the window: the line of
 * sight; no reticle, the app draws it), buttons (at the rear).
 */
export function holoSight() {
	const black = blackOf();
	const glass = material('glass', 0x9fc3c9, { metalness: 0.2, roughness: 0.05, opacity: 0.3 });
	const rubber = material('rubber', 0x2e2e30, { roughness: 0.9 });

	const base = part('base', [
		[black, box(0.04, 0.012, 0.095, 0, 0.006, 0)],
		// Clamp lever on the left
		[black, tube({ axis: 'x', from: -0.02, to: -0.03, rFrom: 0.006, segments: 12, at: [0.006, 0.005] })]
	]);
	const housing = part('housing', [[black, box(0.034, 0.014, 0.05, 0, 0.019, 0.02)]]);
	const battery = part('battery-cap', [
		[black, tube({ axis: 'x', from: -0.028, to: 0.028, rFrom: 0.0115, segments: 16 })],
		[rubber, tube({ axis: 'x', from: 0.028, to: 0.031, rFrom: 0.0105, segments: 16 })]
	], { at: [0, 0.022, -0.036] });

	// Hood: two side walls and a roof around the window.
	const hood = part('hood', [
		[black, box(0.005, 0.042, 0.058, -0.0255, 0.0425, -0.004)],
		[black, box(0.005, 0.042, 0.058, 0.0255, 0.0425, -0.004)],
		[black, box(0.056, 0.006, 0.062, 0, 0.0645, -0.004)],
		// Rear frame below the window
		[black, box(0.046, 0.008, 0.006, 0, 0.026, 0.022)]
	]);
	const windowCentre = /** @type {[number, number, number]} */ ([0, 0.046, -0.004]);
	const sightWindow = part(
		'window',
		[
			[glass, box(0.046, 0.032, 0.0015, 0, 0, -0.025)],
			[glass, box(0.046, 0.032, 0.0015, 0, 0, 0.024)]
		],
		{ at: windowCentre }
	);
	const buttons = part('buttons', [
		[rubber, box(0.008, 0.006, 0.003, -0.008, 0.019, 0.0465)],
		[rubber, box(0.008, 0.006, 0.003, 0.008, 0.019, 0.0465)]
	]);

	return group('holo-sight', { children: [base, housing, battery, hood, sightWindow, buttons] });
}

/**
 * Spitzer boat-tail bullet, .30 calibre (7.82 mm, 31.2 mm long), with the engraving of 6 rifling
 * grooves on its bearing surface, twisted as a 1:10" barrel leaves them. The engraving is 0.15 mm
 * deep, a little more than a real one, to be seen. Origin at the middle of the base, nose at -Z.
 * Nodes: ogive (with the tip), bearing-surface (the engraved part), boat-tail (with the base).
 */
export function bullet() {
	const copper = material('copper', 0xb87333, { metalness: 0.9, roughness: 0.35 });
	const R = 0.00391;
	const length = 0.0312;
	const boatTail = 0.0045;
	const bearing = 0.01;
	const ogiveLength = length - boatTail - bearing;
	const segments = 48;

	// Tangent ogive from a sharp point (r = 0, no meplat) to the bearing surface (r = R).
	const rho = (R * R + ogiveLength * ogiveLength) / (2 * R);
	const ogiveProfile = /** @type {Array<[number, number]>} */ ([[0, -length]]);
	const steps = 10;
	for (let i = 1; i <= steps; i++) {
		const x = (i / steps) * ogiveLength; // from the tip
		const r = Math.sqrt(Math.max(0, rho * rho - (ogiveLength - x) ** 2)) + R - rho;
		ogiveProfile.push([r, -length + x]);
	}
	const ogive = part('ogive', [[copper, latheZ(ogiveProfile, segments)]]);

	const tail = part('boat-tail', [
		[
			copper,
			latheZ(
				[
					[R, -boatTail],
					[0.0033, 0],
					[0, 0]
				],
				segments
			)
		]
	]);

	const engraved = part('bearing-surface', [[copper, engravedBearing(R, -boatTail - bearing, -boatTail, segments)]]);

	return group('bullet', { children: [ogive, engraved, tail] });
}

/**
 * The bearing surface with 6 helical groove engravings. The first and last rows are at full radius,
 * so it meets the ogive and the boat tail without a gap.
 */
function engravedBearing(R, z0, z1, segments) {
	const grooves = 6;
	const depth = 0.00015;
	const rows = 8;
	const twist = 0.254; // 1:10", metres per turn
	const positions = [];
	const index = [];
	for (let row = 0; row <= rows; row++) {
		const z = z0 + ((z1 - z0) * row) / rows;
		const turn = ((z - z0) / twist) * 2 * Math.PI;
		for (let s = 0; s <= segments; s++) {
			// The grid turns with the helix, so each groove stays on the same columns of vertices.
			const column = (s / segments) * 2 * Math.PI;
			const theta = column + turn;
			const inGroove = row > 0 && row < rows && s % (segments / grooves) < segments / grooves / 4;
			const r = inGroove ? R - depth : R;
			positions.push(r * Math.sin(theta), r * Math.cos(theta), z);
		}
	}
	const width = segments + 1;
	for (let row = 0; row < rows; row++) {
		for (let s = 0; s < segments; s++) {
			const a = row * width + s;
			const b = a + 1;
			const c = a + width;
			const d = c + 1;
			index.push(a, c, b, b, c, d);
		}
	}
	const g = new THREE.BufferGeometry();
	g.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
	g.setIndex(index);
	g.computeVertexNormals();
	return g;
}
