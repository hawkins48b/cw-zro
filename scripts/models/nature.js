/**
 * Trees and grass of the tutorial (#181). Conventions in kit.js: metres, +Y up. Origins on the
 * ground, at the foot of the trunk or the middle of the tuft.
 *
 * Trees: trunk > branch-<n> > leaves-<n>-<k> (and leaves-top on the trunk). No node is rotated: a
 * branch's geometry runs from its origin (its base, on the trunk) outwards, so a small rotation of
 * the node about X or Z sways it from its base, with its leaves. Leaf clusters have their origin at
 * their centre. Shapes are drawn with a seeded random generator: the same seed gives the same tree.
 */
import * as THREE from 'three';
import { material, part, rng, rod, tube } from './kit.js';

/**
 * A lumpy leaf cluster, flat-shaded, centred on the origin. Every copy of a vertex moves the same way
 * (the bump is a function of the position), so the surface stays closed.
 * @param {number} radius
 * @param {() => number} random
 */
function leafCluster(radius, random) {
	const g = new THREE.IcosahedronGeometry(radius, 1);
	const k = [3 + random() * 4, 3 + random() * 4, 3 + random() * 4];
	const phase = [random() * 6, random() * 6, random() * 6];
	const p = g.attributes.position;
	for (let i = 0; i < p.count; i++) {
		const x = p.getX(i);
		const y = p.getY(i);
		const z = p.getZ(i);
		const bump = 1 + 0.22 * Math.sin((k[0] * x) / radius + phase[0]) * Math.sin((k[1] * y) / radius + phase[1]) + 0.12 * Math.sin((k[2] * z) / radius + phase[2]);
		p.setXYZ(i, x * bump, y * bump * 0.8, z * bump);
	}
	g.computeVertexNormals();
	return g;
}

/**
 * A broadleaf or birch-like tree: a trunk, branches leaving it upwards, two leaf clusters per branch
 * and one or two on top.
 * @param {string} name
 * @param {{ seed: number, height: number, trunkRadius: number, branches: number, branchLength: number, cluster: number, bark: number, leaves: [number, number], rise: number }} o
 */
function broadleaf(name, o) {
	const random = rng(o.seed);
	const bark = material('bark', o.bark, { roughness: 0.95 });
	const leaves = [material('leaves', o.leaves[0], { roughness: 0.9 }), material('leaves-light', o.leaves[1], { roughness: 0.9 })];
	const pick = () => leaves[random() < 0.6 ? 0 : 1];

	const trunkTop = o.height * 0.72;
	const branches = [];
	for (let b = 0; b < o.branches; b++) {
		const yaw = (b / o.branches) * 2 * Math.PI + random() * 0.8;
		const baseY = trunkTop * (0.45 + 0.5 * (b / Math.max(1, o.branches - 1))) + random() * 0.2;
		const length = o.branchLength * (0.8 + random() * 0.4);
		const dir = new THREE.Vector3(Math.sin(yaw), o.rise + random() * 0.4, Math.cos(yaw)).normalize();
		const tip = dir.clone().multiplyScalar(length);
		const radius = o.trunkRadius * 0.38;
		const clusters = [];
		for (let k = 0; k < 2; k++) {
			const along = k === 0 ? 1 : 0.55;
			const at = dir.clone().multiplyScalar(length * along);
			at.y += o.cluster * 0.3;
			const size = o.cluster * (k === 0 ? 1 : 0.75) * (0.85 + random() * 0.3);
			clusters.push(part(`leaves-${b + 1}-${k + 1}`, [[pick(), leafCluster(size, random)]], { at: [at.x, at.y, at.z] }));
		}
		branches.push(
			part(`branch-${b + 1}`, [[bark, rod([0, 0, 0], [tip.x, tip.y, tip.z], radius, radius * 0.35, 6)]], {
				at: [0, baseY, 0],
				children: clusters
			})
		);
	}
	const top = part('leaves-top', [[pick(), leafCluster(o.cluster * 1.25, random)]], { at: [0, trunkTop + o.cluster * 0.6, 0] });
	const trunk = part(
		'trunk',
		[
			[bark, tube({ from: 0, to: trunkTop, rFrom: o.trunkRadius, rTo: o.trunkRadius * 0.45, segments: 8 })],
			// Root flare
			[bark, tube({ from: 0, to: 0.3, rFrom: o.trunkRadius * 1.5, rTo: o.trunkRadius, segments: 8 })]
		],
		{ children: [...branches, top] }
	);
	const root = new THREE.Group();
	root.name = name;
	root.add(trunk);
	return root;
}

/** Oak-like broadleaf tree, about 6.5 m. */
export function treeBroadleaf() {
	return broadleaf('tree-broadleaf', {
		seed: 181001,
		height: 6.5,
		trunkRadius: 0.2,
		branches: 5,
		branchLength: 2.0,
		cluster: 1.1,
		bark: 0x5b4632,
		leaves: [0x3f6b2a, 0x56803a],
		rise: 0.55
	});
}

/** Birch-like tree: slim, white bark, branches rising steeply, about 8 m. */
export function treeBirch() {
	return broadleaf('tree-birch', {
		seed: 181002,
		height: 8,
		trunkRadius: 0.12,
		branches: 4,
		branchLength: 1.4,
		cluster: 0.8,
		bark: 0xd8d2c4,
		leaves: [0x6f9a3c, 0x89ad4c],
		rise: 1.3
	});
}

/**
 * Spruce-like conifer, about 9 m: a trunk and five tiers. Each tier is a branch-<n> node on the trunk
 * (limbs) with its foliage cone leaves-<n>, both with their origin on the trunk.
 */
export function treeConifer() {
	const random = rng(181003);
	const bark = material('bark', 0x4a3a2a, { roughness: 0.95 });
	const needles = material('needles', 0x2c4a2c, { roughness: 0.9 });
	const height = 9;
	const tiers = 5;
	const branches = [];
	for (let t = 0; t < tiers; t++) {
		const baseY = 1.2 + t * 1.45;
		const radius = 2.1 * (1 - t / (tiers + 0.6));
		const coneHeight = 2.6 - t * 0.25;
		const limbs = [];
		for (let l = 0; l < 4; l++) {
			const yaw = (l / 4) * 2 * Math.PI + random() * 0.6;
			const r = radius * 0.8;
			limbs.push([bark, rod([0, 0.1, 0], [Math.sin(yaw) * r, 0.25, Math.cos(yaw) * r], 0.035, 0.012, 5)]);
		}
		// Foliage cone with a ragged lower edge.
		const cone = new THREE.ConeGeometry(radius, coneHeight, 9, 1);
		cone.translate(0, coneHeight / 2, 0);
		const p = cone.attributes.position;
		for (let i = 0; i < p.count; i++) {
			if (p.getY(i) < 1e-6 && Math.hypot(p.getX(i), p.getZ(i)) > 1e-6) {
				// Same position, same offset: a function of the angle, so the seam stays closed.
				const angle = Math.atan2(p.getX(i), p.getZ(i));
				const drop = 0.18 * (1 + Math.sin(angle * 4 + t * 1.7));
				p.setY(i, -drop);
			}
		}
		cone.computeVertexNormals();
		const foliage = part(`leaves-${t + 1}`, [[needles, cone]]);
		branches.push(part(`branch-${t + 1}`, limbs, { at: [0, baseY, 0], children: [foliage] }));
	}
	const trunk = part('trunk', [[bark, tube({ from: 0, to: height, rFrom: 0.22, rTo: 0.03, segments: 8 })]], { children: branches });
	const root = new THREE.Group();
	root.name = 'tree-conifer';
	root.add(trunk);
	return root;
}

/**
 * A grass tuft for instancing: 7 blades of 3 triangles, one mesh (`grass`, the root), double-sided,
 * coloured by vertex (dark at the foot, light at the tip). Normals point up, the usual trick so a
 * thin blade is lit the same from both sides. Origin at the middle of the tuft, on the ground.
 */
export function grass() {
	const random = rng(181004);
	const blades = 7;
	const foot = new THREE.Color(0x2f4f1f);
	const tip = new THREE.Color(0x9bbd5a);
	const positions = [];
	const colors = [];
	const index = [];
	for (let b = 0; b < blades; b++) {
		const yaw = random() * 2 * Math.PI;
		const height = 0.18 + random() * 0.14;
		const lean = 0.05 + random() * 0.08;
		const width = 0.008 + random() * 0.005;
		const ox = (random() - 0.5) * 0.06;
		const oz = (random() - 0.5) * 0.06;
		const across = [Math.cos(yaw), Math.sin(yaw)];
		const out = [-Math.sin(yaw), Math.cos(yaw)];
		const start = positions.length / 3;
		// Foot pair, middle pair, tip: the blade bends outwards as it rises.
		const rows = [
			[0, width, 0],
			[0.55, width * 0.7, lean * 0.35],
			[1, 0, lean]
		];
		for (const [t, w, bend] of rows) {
			const cx = ox + out[0] * bend;
			const cz = oz + out[1] * bend;
			const y = t * height;
			const colour = foot.clone().lerp(tip, t);
			if (w > 0) {
				positions.push(cx - across[0] * w, y, cz - across[1] * w, cx + across[0] * w, y, cz + across[1] * w);
				colors.push(colour.r, colour.g, colour.b, colour.r, colour.g, colour.b);
			} else {
				positions.push(cx, y, cz);
				colors.push(colour.r, colour.g, colour.b);
			}
		}
		index.push(start, start + 1, start + 2, start + 1, start + 3, start + 2, start + 2, start + 3, start + 4);
	}
	const g = new THREE.BufferGeometry();
	g.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
	g.setAttribute('normal', new THREE.Float32BufferAttribute(positions.map((_, i) => (i % 3 === 1 ? 1 : 0)), 3));
	g.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
	g.setIndex(index);
	const blade = material('grass', 0xffffff, { roughness: 0.9, doubleSide: true, vertexColors: true });
	return part('grass', [[blade, g]]);
}
