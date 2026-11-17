/**
 * Shared helpers of the tutorial models (#181): a seeded random generator, materials and the
 * geometry builders that scripts/build-models.js uses to draw every model from three.js primitives.
 *
 * Conventions (docs/development.md, "Tutorial models"):
 * - Units are metres, +Y is up, and "forward" (muzzle, objective, line of sight) is -Z: a shooter at
 *   the origin looks down -Z, so targets stand at negative Z and face +Z.
 * - A named part is either one Mesh (one material) or a Group of meshes named `<part>_<material>`.
 *   Its origin is its pivot: a turret on its axis, a branch at its base, a bolt on the bore axis.
 * - No textures and no UVs: plain colours only (the exporter cannot draw images in Node), so every
 *   mesh has POSITION and NORMAL, and an index.
 * - Nothing random but `rng(seed)`, so a second run writes the same bytes.
 */
import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';

/**
 * A seeded pseudo-random generator (mulberry32): the same seed gives the same numbers on every run.
 * @param {number} seed
 * @returns {() => number} a number in [0, 1)
 */
export function rng(seed) {
	let a = seed >>> 0;
	return () => {
		a = (a + 0x6d2b79f5) >>> 0;
		let t = a;
		t = Math.imul(t ^ (t >>> 15), t | 1);
		t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
		return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
	};
}

/**
 * A plain PBR material. Names are written to the file, so keep them short and stable.
 * @param {string} name
 * @param {number} color sRGB hex
 * @param {{ metalness?: number, roughness?: number, opacity?: number, doubleSide?: boolean, vertexColors?: boolean }} [options]
 */
export function material(name, color, options = {}) {
	const m = new THREE.MeshStandardMaterial({
		name,
		color,
		metalness: options.metalness ?? 0,
		roughness: options.roughness ?? 0.8,
		vertexColors: options.vertexColors ?? false
	});
	if (options.opacity !== undefined) {
		m.transparent = true;
		m.opacity = options.opacity;
	}
	if (options.doubleSide) m.side = THREE.DoubleSide;
	return m;
}

/** Rotation that turns a geometry built along +Y onto an axis. */
function alignY(geometry, axis) {
	if (axis === 'x') geometry.rotateZ(-Math.PI / 2);
	else if (axis === 'z') geometry.rotateX(Math.PI / 2);
	else if (axis === '-z') geometry.rotateX(-Math.PI / 2);
	return geometry;
}

/**
 * A cylinder (or a cone, with rTop 0) between two points of an axis.
 * `from` and `to` are the coordinates along the axis, `at` the centre of its ends on the other two
 * axes. The radius goes from rFrom (at `from`) to rTo (at `to`).
 * @param {{ axis?: 'x'|'y'|'z', from: number, to: number, rFrom: number, rTo?: number, at?: [number, number], segments?: number, open?: boolean }} o
 */
export function tube(o) {
	const axis = o.axis ?? 'y';
	const rTo = o.rTo ?? o.rFrom;
	const length = Math.abs(o.to - o.from);
	// CylinderGeometry: radiusTop at +Y. Build it from `from` to `to` along +Y, then align.
	const up = o.to >= o.from;
	const g = new THREE.CylinderGeometry(up ? rTo : o.rFrom, up ? o.rFrom : rTo, length, o.segments ?? 12, 1, o.open ?? false);
	g.translate(0, (o.from + o.to) / 2, 0);
	alignY(g, axis);
	const [a, b] = o.at ?? [0, 0];
	if (axis === 'x') g.translate(0, a, b);
	else if (axis === 'y') g.translate(a, 0, b);
	else g.translate(a, b, 0);
	return g;
}

/**
 * A cylinder (or cone) from one point to another, in any direction.
 * @param {[number, number, number]} a
 * @param {[number, number, number]} b
 * @param {number} rA radius at a
 * @param {number} [rB] radius at b
 * @param {number} [segments]
 */
export function rod(a, b, rA, rB = rA, segments = 8) {
	const from = new THREE.Vector3(...a);
	const dir = new THREE.Vector3(...b).sub(from);
	const length = dir.length();
	const g = new THREE.CylinderGeometry(rB, rA, length, segments, 1);
	g.translate(0, length / 2, 0);
	g.applyQuaternion(new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), dir.normalize()));
	g.translate(from.x, from.y, from.z);
	return g;
}

/**
 * A cylinder along +Y (from y0 to y1) with ribs: every other side vertex is pulled in by `depth`, so a
 * turned knob shows it turning.
 * @param {number} radius
 * @param {number} y0
 * @param {number} y1
 * @param {number} ribs
 * @param {number} depth
 */
export function ribbed(radius, y0, y1, ribs, depth) {
	const segments = ribs * 2;
	const g = new THREE.CylinderGeometry(radius, radius, y1 - y0, segments, 1);
	g.translate(0, (y0 + y1) / 2, 0);
	const p = g.attributes.position;
	const step = (2 * Math.PI) / segments;
	for (let i = 0; i < p.count; i++) {
		const x = p.getX(i);
		const z = p.getZ(i);
		const r = Math.hypot(x, z);
		if (r < 1e-9) continue;
		const index = Math.round(Math.atan2(x, z) / step);
		if (((index % 2) + 2) % 2 === 1) {
			const k = (r - depth) / r;
			p.setXYZ(i, x * k, p.getY(i), z * k);
		}
	}
	g.deleteAttribute('normal');
	g.computeVertexNormals();
	return g;
}

/** A box centred on a point. */
export function box(w, h, d, x = 0, y = 0, z = 0) {
	return new THREE.BoxGeometry(w, h, d).translate(x, y, z);
}

/**
 * A surface of revolution around the Z axis, from [radius, z] points given from -Z to +Z (the
 * normals then face out; src/test/tutorialModels.test.js checks it).
 * @param {Array<[number, number]>} profile [radius, z]
 * @param {number} [segments]
 */
export function latheZ(profile, segments = 16) {
	// LatheGeometry turns (x, y) points around +Y: build it with y = z, then turn +Y onto +Z.
	const points = profile.map(([r, z]) => new THREE.Vector2(r, z));
	const g = new THREE.LatheGeometry(points, segments);
	g.rotateX(Math.PI / 2);
	return g;
}

/**
 * A flat shape (in shape x/y) extruded by `depth`, centred on the extrusion.
 * @param {THREE.Shape} shape
 * @param {number} depth
 * @param {{ bevel?: number, curveSegments?: number }} [options]
 */
export function slab(shape, depth, options = {}) {
	const bevel = options.bevel ?? 0;
	const g = new THREE.ExtrudeGeometry(shape, {
		depth: depth - 2 * bevel,
		curveSegments: options.curveSegments ?? 4,
		bevelEnabled: bevel > 0,
		bevelThickness: bevel,
		bevelSize: bevel,
		bevelSegments: bevel > 0 ? 2 : 0
	});
	g.translate(0, 0, -(depth - 2 * bevel) / 2);
	return g;
}

/**
 * A shape drawn in the side view of a model (z forward-back, y up), extruded across X, `width` wide
 * and centred on x = 0. Shape points are given as [z, y].
 * @param {Array<[number, number]>} outline [z, y] points, in order
 * @param {number} width
 * @param {{ bevel?: number, holes?: Array<Array<[number, number]>> }} [options]
 */
export function sideSlab(outline, width, options = {}) {
	// Shape x = -z: after a quarter turn about Y, shape x lands on world z with the sign flipped.
	const toShape = (points) => points.map(([z, y]) => new THREE.Vector2(-z, y));
	const shape = new THREE.Shape(toShape(outline));
	for (const hole of options.holes ?? []) shape.holes.push(new THREE.Path(toShape(hole)));
	const g = slab(shape, width, options);
	g.rotateY(Math.PI / 2);
	return g;
}

/** Keeps POSITION and NORMAL (and COLOR when asked), and gives the geometry an index. */
function clean(geometry, keepColor) {
	const g = geometry;
	for (const name of Object.keys(g.attributes)) {
		if (name !== 'position' && name !== 'normal' && !(keepColor && name === 'color')) g.deleteAttribute(name);
	}
	if (!g.attributes.normal) g.computeVertexNormals();
	// A vertex no triangle uses (three's ConeGeometry has one at its apex seam) gets a zero normal
	// from computeVertexNormals: give it a unit one, as glTF wants.
	const n = g.attributes.normal;
	for (let i = 0; i < n.count; i++) {
		if (Math.hypot(n.getX(i), n.getY(i), n.getZ(i)) < 1e-6) n.setXYZ(i, 0, 1, 0);
	}
	if (!g.index) {
		const count = g.attributes.position.count;
		g.setIndex(Array.from({ length: count }, (_, i) => i));
	}
	g.clearGroups();
	return g;
}

/**
 * Merges geometries into one, with POSITION, NORMAL and an index (and COLOR when they all have it).
 * @param {THREE.BufferGeometry[]} geometries
 */
export function merge(geometries) {
	const keepColor = geometries.every((g) => g.attributes.color);
	const merged = mergeGeometries(geometries.map((g) => clean(g, keepColor)), false);
	if (!merged) throw new Error('could not merge the geometries of a part');
	return merged;
}

/**
 * A named part. `pieces` are [material, geometry] pairs in the part's own space (its origin is the
 * pivot); they are merged by material. One material gives one Mesh named `name`; more give a Group
 * named `name` with one mesh per material, named `<name>_<material>`.
 * @param {string} name
 * @param {Array<[THREE.Material, THREE.BufferGeometry]>} pieces
 * @param {{ at?: [number, number, number], rotation?: [number, number, number], children?: THREE.Object3D[] }} [options]
 * @returns {THREE.Object3D}
 */
export function part(name, pieces, options = {}) {
	/** @type {Map<THREE.Material, THREE.BufferGeometry[]>} */
	const byMaterial = new Map();
	for (const [mat, geo] of pieces) {
		if (!byMaterial.has(mat)) byMaterial.set(mat, []);
		byMaterial.get(mat)?.push(geo);
	}
	/** @type {THREE.Object3D} */
	let node;
	if (byMaterial.size === 1) {
		const [[mat, geos]] = byMaterial;
		node = new THREE.Mesh(merge(geos), mat);
	} else {
		node = new THREE.Group();
		for (const [mat, geos] of byMaterial) {
			const mesh = new THREE.Mesh(merge(geos), mat);
			mesh.name = `${name}_${mat.name}`;
			node.add(mesh);
		}
	}
	node.name = name;
	place(node, options);
	for (const child of options.children ?? []) node.add(child);
	return node;
}

/**
 * An empty named node: a point the app attaches things to or aims at (no mesh).
 * @param {string} name
 * @param {{ at?: [number, number, number], rotation?: [number, number, number], children?: THREE.Object3D[] }} [options]
 */
export function group(name, options = {}) {
	const node = new THREE.Group();
	node.name = name;
	place(node, options);
	for (const child of options.children ?? []) node.add(child);
	return node;
}

function place(node, options) {
	if (options.at) node.position.set(...options.at);
	if (options.rotation) node.rotation.set(...options.rotation);
}

/** Counts the triangles of an object and its children. */
export function triangles(object) {
	let count = 0;
	object.traverse((o) => {
		if (/** @type {THREE.Mesh} */ (o).isMesh) {
			const g = /** @type {THREE.Mesh} */ (o).geometry;
			count += (g.index ? g.index.count : g.attributes.position.count) / 3;
		}
	});
	return count;
}
