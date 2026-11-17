// @vitest-environment node
/**
 * Tutorial models (#181): the committed files in static/models are what scripts/build-models.js
 * writes (and a second build gives the same bytes), each model has the named nodes the tutorials
 * point at, with their pivots where the conventions say, at real scale, within the size and triangle
 * budgets, with no texture, no external file and nothing that changes from run to run in it. Also
 * that three is pinned, that no app code imports it yet, and that the dev-only viewer plugin only
 * runs in the dev server and only answers GET /dev/models.
 *
 * Node environment: GLTFExporter runs on Node's Blob (jsdom's differs).
 */
import { describe, it, expect, vi } from 'vitest';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import * as THREE from 'three';
import { MODELS, buildModel, modelPath } from '../../scripts/build-models.js';
import { SCOPE_RING_HEIGHT } from '../../scripts/models/weapons.js';
import { SANDBAG_REST, TARGET_BOTTOM } from '../../scripts/models/range.js';
import { MODULE_FILE, VIEWER_PATH, listModels, modelViewer, viewerHtml } from '../../tools/model-viewer/plugin.js';

const root = process.cwd();
const NAMES = Object.keys(MODELS);
const committed = (name) => fs.readFileSync(path.join(root, 'static', modelPath(name)));

/** The JSON chunk of a binary glTF, after checking its header. */
function gltfJson(bytes) {
	const view = Buffer.from(bytes);
	expect(view.toString('latin1', 0, 4)).toBe('glTF');
	expect(view.readUInt32LE(4)).toBe(2);
	expect(view.readUInt32LE(8)).toBe(view.length);
	expect(view.readUInt32LE(16)).toBe(0x4e4f534a); // JSON
	return JSON.parse(view.toString('utf8', 20, 20 + view.readUInt32LE(12)));
}

/** The nodes of a glTF by name (names are unique in every model). */
function nodesByName(json) {
	const map = new Map();
	for (const node of json.nodes) {
		expect(map.has(node.name), `duplicate node name ${node.name}`).toBe(false);
		map.set(node.name, node);
	}
	return map;
}

/** The size of an object along X, Y and Z, in metres. */
const sizeOf = (object) => new THREE.Box3().setFromObject(object).getSize(new THREE.Vector3());

describe('committed models', () => {
	it('lists the models of the issue', () => {
		expect(NAMES).toEqual(
			expect.arrayContaining(['rifle', 'scope', 'holo-sight', 'grass', 'ipsc-target', 'bullet', 'spotting-scope', 'flag'])
		);
		expect(NAMES.filter((n) => n.startsWith('tree-')).length).toBeGreaterThanOrEqual(2);
		// Nothing else in static/models: every file there comes from the script.
		expect(listModels(root)).toEqual([...NAMES].sort());
		expect(fs.readdirSync(path.join(root, 'static', 'models')).sort()).toEqual(NAMES.map((n) => `${n}.glb`).sort());
	});

	it.each(NAMES)('%s: the committed file is what the script writes, and a second build is identical', async (name) => {
		const first = Buffer.from((await buildModel(name)).bytes);
		const second = Buffer.from((await buildModel(name)).bytes);
		expect(first.equals(second), 'the build is not deterministic').toBe(true);
		expect(first.equals(committed(name)), 'run npm run models:build and commit static/models').toBe(true);
	});

	it.each(NAMES)('%s: one embedded buffer, no texture, image, uri, id or date', (name) => {
		const bytes = committed(name);
		const json = gltfJson(bytes);
		expect(json.asset).toEqual({ version: '2.0', generator: 'THREE.GLTFExporter r187' });
		expect(json.images).toBeUndefined();
		expect(json.textures).toBeUndefined();
		expect(json.samplers).toBeUndefined();
		expect(json.buffers).toHaveLength(1);
		expect(json.buffers[0].uri).toBeUndefined();
		expect(json.extensionsUsed).toBeUndefined();
		const text = bytes.toString('latin1');
		expect(text).not.toMatch(/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/i);
		expect(text).not.toMatch(/20\d\d-\d\d-\d\d/);
		expect(text).not.toContain(root);
		for (const mesh of json.meshes) {
			for (const primitive of mesh.primitives) {
				expect(Object.keys(primitive.attributes).sort()).toEqual(name === 'grass' ? ['COLOR_0', 'NORMAL', 'POSITION'] : ['NORMAL', 'POSITION']);
				expect(primitive.indices).toBeTypeOf('number');
			}
		}
		// Every node has a name, so a tutorial can find any part.
		for (const node of json.nodes) expect(node.name, JSON.stringify(node)).toMatch(/^[a-z0-9-]+(_[a-z0-9-]+)?$/);
	});

	it('stays well under the size budget, with phone-friendly triangle counts', async () => {
		let total = 0;
		for (const name of NAMES) {
			const bytes = committed(name).length;
			const { triangles } = await buildModel(name);
			total += bytes;
			expect(bytes, name).toBeLessThan(150 * 1024);
			expect(triangles, name).toBeLessThan(2500);
		}
		expect(total).toBeLessThan(750 * 1024);
		// A grass tuft is drawn thousands of times.
		expect((await buildModel('grass')).triangles).toBeLessThanOrEqual(32);
	});

	it.each(NAMES)('%s: unit normals, with the winding of their triangles', (name) => {
		MODELS[name]().traverse((o) => {
			const mesh = /** @type {THREE.Mesh} */ (o);
			if (!mesh.isMesh) return;
			const p = mesh.geometry.attributes.position;
			const n = mesh.geometry.attributes.normal;
			for (let i = 0; i < n.count; i++) expect(Math.hypot(n.getX(i), n.getY(i), n.getZ(i))).toBeCloseTo(1, 3);
			// The grass's normals point up on purpose (both sides lit alike).
			if (name === 'grass') return;
			const index = /** @type {THREE.BufferAttribute} */ (mesh.geometry.index);
			let agree = 0;
			let faces = 0;
			const [a, b, c, normal] = [new THREE.Vector3(), new THREE.Vector3(), new THREE.Vector3(), new THREE.Vector3()];
			for (let i = 0; i < index.count; i += 3) {
				a.fromBufferAttribute(p, index.getX(i));
				b.fromBufferAttribute(p, index.getX(i + 1));
				c.fromBufferAttribute(p, index.getX(i + 2));
				const face = c.clone().sub(b).cross(a.clone().sub(b));
				if (face.lengthSq() < 1e-24) continue;
				faces++;
				if (face.dot(normal.fromBufferAttribute(n, index.getX(i))) > 0) agree++;
			}
			expect(agree / faces, mesh.name).toBeGreaterThan(0.95);
		});
	});

	it('faces the surfaces of revolution outwards', () => {
		for (const [model, parts] of [
			['bullet', ['ogive', 'bearing-surface', 'boat-tail']],
			['scope', ['objective_black', 'ocular_black']]
		]) {
			const object = MODELS[model]();
			for (const name of parts) {
				const mesh = /** @type {THREE.Mesh} */ (object.getObjectByName(name));
				const p = mesh.geometry.attributes.position;
				const n = mesh.geometry.attributes.normal;
				let sum = 0;
				for (let i = 0; i < p.count; i++) {
					const r = Math.hypot(p.getX(i), p.getY(i));
					if (r > 1e-5) sum += (n.getX(i) * p.getX(i) + n.getY(i) * p.getY(i)) / r;
				}
				expect(sum / p.count, `${model} ${name}`).toBeGreaterThan(0.5);
			}
		}
	});
});

describe('named nodes and conventions', () => {
	const json = (name) => nodesByName(gltfJson(committed(name)));

	it('rifle: parts, muzzle at -Z, bolt on the bore axis, rail on top', () => {
		const nodes = json('rifle');
		for (const n of ['rifle', 'stock', 'barrel', 'muzzle', 'bolt', 'optic-rail', 'receiver', 'trigger', 'magazine']) expect(nodes.has(n), n).toBe(true);
		const muzzle = nodes.get('muzzle').translation;
		expect(muzzle[0]).toBe(0);
		expect(muzzle[1]).toBe(0);
		expect(muzzle[2]).toBeLessThan(-0.6);
		expect(nodes.get('bolt').translation).toBeUndefined();
		expect(nodes.get('optic-rail').translation[1]).toBeGreaterThan(0.02);
		const size = sizeOf(MODELS.rifle());
		expect(size.z).toBeGreaterThan(1.1);
		expect(size.z).toBeLessThan(1.4);
	});

	it('scope: turrets on their axes, rings down to the rail, no reticle', () => {
		const nodes = json('scope');
		for (const n of ['body', 'objective', 'ocular', 'magnification-ring', 'elevation-turret', 'windage-turret', 'parallax-turret', 'rings', 'eyepoint']) {
			expect(nodes.has(n), n).toBe(true);
		}
		expect([...nodes.keys()].some((n) => n.includes('reticle'))).toBe(false);
		const [ex, ey, ez] = nodes.get('elevation-turret').translation;
		expect([ex, ez]).toEqual([0, 0]);
		expect(ey).toBeGreaterThan(0);
		const [wx, wy, wz] = nodes.get('windage-turret').translation;
		expect([wy, wz]).toEqual([0, 0]);
		expect(wx).toBeGreaterThan(0);
		expect(nodes.get('parallax-turret').translation[0]).toBeLessThan(0);
		for (const n of ['elevation-turret', 'windage-turret', 'parallax-turret', 'magnification-ring']) expect(nodes.get(n).rotation, n).toBeUndefined();
		expect(nodes.get('objective').translation[2]).toBeLessThan(nodes.get('ocular').translation[2]);
		const rings = new THREE.Box3().setFromObject(/** @type {THREE.Object3D} */ (MODELS.scope().getObjectByName('rings')));
		expect(rings.min.y).toBeCloseTo(-SCOPE_RING_HEIGHT, 6);
	});

	it('holo sight: hood, window, no brand text', () => {
		const nodes = json('holo-sight');
		for (const n of ['base', 'hood', 'window', 'battery-cap', 'buttons']) expect(nodes.has(n), n).toBe(true);
		expect(committed('holo-sight').toString('latin1')).not.toMatch(/eotech|l3|harris/i);
	});

	it.each(NAMES.filter((n) => n.startsWith('tree-')))('%s: trunk, branches with leaves, unrotated branch pivots', (name) => {
		const nodes = json(name);
		expect(nodes.has('trunk')).toBe(true);
		const branches = [...nodes.keys()].filter((n) => /^branch-\d+$/.test(n));
		expect(branches.length).toBeGreaterThanOrEqual(3);
		const object = MODELS[name]();
		for (const b of branches) {
			expect(nodes.get(b).rotation, b).toBeUndefined();
			const branch = /** @type {THREE.Object3D} */ (object.getObjectByName(b));
			expect(branch.parent?.name).toBe('trunk');
			expect(branch.children.some((c) => c.name.startsWith('leaves-')), b).toBe(true);
		}
		const size = sizeOf(object);
		expect(size.y).toBeGreaterThan(5);
		expect(size.y).toBeLessThan(12);
	});

	it('trees differ from one another', () => {
		const trees = NAMES.filter((n) => n.startsWith('tree-')).map((n) => committed(n));
		for (let i = 0; i < trees.length; i++) for (let j = i + 1; j < trees.length; j++) expect(trees[i].equals(trees[j])).toBe(false);
	});

	it('grass: one mesh, origin on the ground', () => {
		const gltf = gltfJson(committed('grass'));
		expect(gltf.meshes).toHaveLength(1);
		expect(gltf.nodes).toHaveLength(1);
		const box = new THREE.Box3().setFromObject(MODELS.grass());
		expect(box.min.y).toBeCloseTo(0, 6);
		expect(box.max.y).toBeLessThan(0.5);
	});

	it('ipsc target: A, C and D zones in one plane facing +Z, 46 × 76 cm, on a stand', () => {
		const nodes = json('ipsc-target');
		for (const n of ['target', 'board', 'zone-a', 'zone-c', 'zone-d', 'stand']) expect(nodes.has(n), n).toBe(true);
		// No hard cover: glTF cannot hide a node, so every viewer drew it as a black square.
		expect([...nodes.keys()].some((n) => n.includes('cover'))).toBe(false);
		const object = MODELS['ipsc-target']();
		object.updateMatrixWorld(true);
		const face = new THREE.Box3();
		for (const zone of ['zone-a', 'zone-c', 'zone-d']) {
			const mesh = /** @type {THREE.Mesh} */ (object.getObjectByName(zone));
			const box = new THREE.Box3().setFromObject(mesh);
			expect(box.min.z).toBeCloseTo(0, 9);
			expect(box.max.z).toBeCloseTo(0, 9);
			const n = mesh.geometry.attributes.normal;
			for (let i = 0; i < n.count; i++) expect(n.getZ(i)).toBeCloseTo(1, 6);
			face.union(box);
		}
		const size = face.getSize(new THREE.Vector3());
		expect(size.x).toBeCloseTo(0.46, 6);
		expect(size.y).toBeCloseTo(0.76, 6);
		expect(face.min.y).toBeCloseTo(TARGET_BOTTOM, 6);
		// The zones together cover the face once: their areas add up to the silhouette's.
		const area = (zone) => {
			const mesh = /** @type {THREE.Mesh} */ (object.getObjectByName(zone));
			const p = mesh.geometry.attributes.position;
			const index = /** @type {THREE.BufferAttribute} */ (mesh.geometry.index);
			let sum = 0;
			for (let i = 0; i < index.count; i += 3) {
				const [a, b, c] = [0, 1, 2].map((k) => index.getX(i + k));
				sum += Math.abs((p.getX(b) - p.getX(a)) * (p.getY(c) - p.getY(a)) - (p.getX(c) - p.getX(a)) * (p.getY(b) - p.getY(a))) / 2;
			}
			return sum;
		};
		// Body octagon 0.46 × 0.58 less four 0.08 / 0.11 corners, plus the 0.15 × 0.18 head less two corners.
		const silhouette = 0.46 * 0.58 - 2 * (0.08 * 0.08) / 2 - 2 * (0.11 * 0.11) / 2 + 0.15 * 0.18 - 2 * (0.025 * 0.025) / 2;
		expect(area('zone-a') + area('zone-c') + area('zone-d')).toBeCloseTo(silhouette, 6);
		expect(area('zone-a')).toBeCloseTo(0.15 * 0.28 + 0.1 * 0.05, 6);
	});

	it('bullet: real size, nose at -Z, grooved bearing surface', () => {
		const nodes = json('bullet');
		for (const n of ['ogive', 'bearing-surface', 'boat-tail']) expect(nodes.has(n), n).toBe(true);
		const object = MODELS.bullet();
		const box = new THREE.Box3().setFromObject(object);
		expect(box.max.z).toBeCloseTo(0, 9);
		expect(box.min.z).toBeCloseTo(-0.0312, 6);
		expect(box.max.x * 2).toBeCloseTo(0.00782, 5);
		// Some bearing-surface vertices are pressed in: the engraving.
		const p = /** @type {THREE.Mesh} */ (object.getObjectByName('bearing-surface')).geometry.attributes.position;
		const radii = new Set();
		for (let i = 0; i < p.count; i++) radii.add(Math.hypot(p.getX(i), p.getY(i)).toFixed(5));
		expect(radii.size).toBe(2);
	});

	it('spotting scope: tripod, head, body with objective at -Z', () => {
		const nodes = json('spotting-scope');
		for (const n of ['tripod', 'head', 'scope-body', 'objective', 'eyepiece', 'focus-ring']) expect(nodes.has(n), n).toBe(true);
		expect(nodes.get('objective').translation[2]).toBeLessThan(0);
		const object = MODELS['spotting-scope']();
		expect(/** @type {THREE.Object3D} */ (object.getObjectByName('scope-body')).parent?.name).toBe('head');
		expect(new THREE.Box3().setFromObject(object).min.y).toBeCloseTo(0, 3);
	});

	it('spotting scope: the body is closed at the back (a ray from behind hits its back cap)', () => {
		const object = MODELS['spotting-scope']();
		object.updateMatrixWorld(true);
		const body = /** @type {THREE.Object3D} */ (object.getObjectByName('scope-body'));
		// Low and to the side of the axis, under the eyepiece; meshes are one-sided, so the inside of
		// an open tube would not be hit.
		const from = body.localToWorld(new THREE.Vector3(0.01, -0.015, 1));
		const hits = new THREE.Raycaster(from, new THREE.Vector3(0, 0, -1)).intersectObject(object, true);
		expect(hits.length).toBeGreaterThan(0);
		expect(hits[0].object.name.startsWith('scope-body')).toBe(true);
		expect(body.worldToLocal(hits[0].point.clone()).z).toBeCloseTo(0.14, 6);
	});

	it('sandbag: on the ground, about 26 × 15 × 20 cm, groove along Z with the rest at its bottom', () => {
		const nodes = json('sandbag');
		for (const n of ['bag', 'rest']) expect(nodes.has(n), n).toBe(true);
		expect(nodes.get('rest').translation).toEqual([0, SANDBAG_REST, 0]);
		const object = MODELS.sandbag();
		object.updateMatrixWorld(true);
		const box = new THREE.Box3().setFromObject(object);
		expect(box.min.y).toBeCloseTo(0, 9);
		const size = box.getSize(new THREE.Vector3());
		expect(size.x).toBeGreaterThan(0.25);
		expect(size.x).toBeLessThan(0.28);
		expect(size.z).toBeCloseTo(0.2, 6);
		const topAt = (x) => {
			const hits = new THREE.Raycaster(new THREE.Vector3(x, 1, 0), new THREE.Vector3(0, -1, 0)).intersectObject(object, true);
			return hits[0].point.y;
		};
		expect(topAt(0)).toBeCloseTo(SANDBAG_REST, 3);
		// The groove's walls rise on both sides, higher than the rifle's 5 cm wide fore-end needs.
		expect(topAt(0.025)).toBeGreaterThan(SANDBAG_REST + 0.005);
		expect(topAt(-0.025)).toBeCloseTo(topAt(0.025), 6);
		expect(topAt(0.09)).toBeGreaterThan(SANDBAG_REST + 0.02);
	});

	it('flag: pole and a subdivided cloth hanging along +X from the pole top', () => {
		const nodes = json('flag');
		expect(nodes.has('pole')).toBe(true);
		const [x, y, z] = nodes.get('cloth').translation;
		expect(y).toBeGreaterThan(2.5);
		expect(z).toBe(0);
		expect(x).toBeGreaterThan(0);
		const cloth = /** @type {THREE.Mesh} */ (MODELS.flag().getObjectByName('cloth'));
		expect(cloth.geometry.attributes.position.count).toBeGreaterThanOrEqual(100);
		const box = new THREE.Box3().setFromObject(cloth);
		expect(box.min.x).toBeGreaterThan(0);
		expect(cloth.material.side).toBe(THREE.DoubleSide);
	});
});

describe('three', () => {
	const pkg = JSON.parse(fs.readFileSync(path.join(root, 'package.json'), 'utf-8'));

	it('is pinned to an exact version in dependencies', () => {
		expect(pkg.dependencies.three).toMatch(/^\d+\.\d+\.\d+$/);
		expect(pkg.devDependencies.three).toBeUndefined();
		const lock = JSON.parse(fs.readFileSync(path.join(root, 'package-lock.json'), 'utf-8'));
		expect(lock.packages['node_modules/three'].version).toBe(pkg.dependencies.three);
		expect(THREE.REVISION).toBe(pkg.dependencies.three.split('.')[1]);
	});

	// Since #182, src/lib/tutorial/scene.js is the one module that imports three, and the tutorial
	// route loads it with import() only, so three stays in that route's lazy chunk.
	it('is imported by the tutorial scene only, which only the tutorial route loads, lazily; no app code imports the model scripts or the viewer', () => {
		const threeImports = [];
		const sceneImports = [];
		const toolImports = [];
		const walk = (dir) => {
			for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
				const file = path.join(dir, entry.name);
				if (entry.isDirectory()) {
					if (!['test', 'paraglide'].includes(entry.name)) walk(file);
				} else if (/\.(js|svelte)$/.test(entry.name)) {
					const text = fs.readFileSync(file, 'utf-8');
					const rel = path.relative(root, file);
					if (/from ['"]three['"/]|import\(['"]three/.test(text)) threeImports.push(rel);
					if (/tutorial\/scene(\.js)?['"]/.test(text)) {
						const lazy = /await import\(['"]#lib\/tutorial\/scene\.js['"]\)/.test(text);
						const stat = /from ['"][^'"]*tutorial\/scene(\.js)?['"]/.test(text);
						sceneImports.push({ rel, lazy, stat });
					}
					if (/scripts\/models|scripts\/build-models|model-viewer/.test(text)) toolImports.push(rel);
				}
			}
		};
		walk(path.join(root, 'src'));
		expect(threeImports).toEqual(['src/lib/tutorial/scene.js']);
		expect(sceneImports).toEqual([{ rel: 'src/routes/calculators/ballistic-tutorial/+page.svelte', lazy: true, stat: false }]);
		expect(toolImports).toEqual([]);
	});

	// The Capacitor apps have no tutorial (#182, owner decision of 2026-11-17): vite.config.js sets
	// __MOBILE_BUILD__ for BUILD_TARGET=capacitor, and the page returns before the scene's import when
	// it is true, so the mobile build drops the import as dead code (checked on the build output when
	// this was written: no three.js in the mobile bundle).
	it('is left out of the mobile build: the scene import sits behind __MOBILE_BUILD__', () => {
		const config = fs.readFileSync(path.join(root, 'vite.config.js'), 'utf-8');
		expect(config).toMatch(/__MOBILE_BUILD__: JSON\.stringify\(isCapacitor\)/);
		const page = fs.readFileSync(path.join(root, 'src/routes/calculators/ballistic-tutorial/+page.svelte'), 'utf-8');
		const guard = page.indexOf('if (__MOBILE_BUILD__) return;');
		const load = page.indexOf("await import('#lib/tutorial/scene.js')");
		expect(guard).toBeGreaterThan(0);
		expect(load).toBeGreaterThan(guard);
		expect(page.match(/await import\(['"]#lib\/tutorial\/scene\.js['"]\)/g)).toHaveLength(1);
	});
});

describe('model viewer plugin', () => {
	/** Runs the plugin's middleware on a request. */
	async function request(url, method = 'GET') {
		const plugin = modelViewer({ root });
		let middleware;
		const server = {
			middlewares: { use: (fn) => (middleware = fn) },
			transformIndexHtml: vi.fn(async (_url, html) => html.replace('<head>', '<head><script type="module" src="/@vite/client"></script>'))
		};
		// @ts-ignore: only what the plugin uses
		plugin.configureServer(server);
		const res = { statusCode: 0, headers: {}, body: undefined, setHeader(k, v) { this.headers[k] = v; }, end(body) { this.body = body; } };
		const next = vi.fn();
		await middleware({ url, method }, res, next);
		return { res, next, transform: server.transformIndexHtml };
	}

	it('applies to the dev server only, and opens only the viewer module', () => {
		const plugin = modelViewer({ root });
		expect(plugin.apply).toBe('serve');
		// @ts-ignore
		expect(plugin.config()).toEqual({ server: { fs: { allow: [MODULE_FILE] } } });
		expect(MODULE_FILE).toBe(path.join(root, 'tools', 'model-viewer', 'main.js'));
		expect(fs.existsSync(MODULE_FILE)).toBe(true);
	});

	it('serves the page at GET /dev/models, with the model list', async () => {
		for (const url of [VIEWER_PATH, `${VIEWER_PATH}?x=1`]) {
			const { res, next, transform } = await request(url);
			expect(next).not.toHaveBeenCalled();
			expect(transform).toHaveBeenCalledWith(VIEWER_PATH, expect.any(String));
			expect(res.statusCode).toBe(200);
			expect(res.headers['Content-Type']).toBe('text/html; charset=utf-8');
			expect(res.body).toContain('src="/tools/model-viewer/main.js"');
			expect(res.body).toContain(`data-models="${[...NAMES].sort().join(',')}"`);
		}
	});

	it.each(['/dev/models/', '/dev/models/x', '/dev/models/../package.json', '/dev', '/', '/tools/model-viewer/plugin.js', '/DEV/MODELS'])('passes %s on', async (url) => {
		const { res, next } = await request(url);
		expect(next).toHaveBeenCalled();
		expect(res.body).toBeUndefined();
	});

	it('passes a POST on', async () => {
		const { next } = await request(VIEWER_PATH, 'POST');
		expect(next).toHaveBeenCalled();
	});

	it('lists only plain .glb names, and writes only those into the page', () => {
		const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'zro-models-'));
		try {
			fs.mkdirSync(path.join(dir, 'static', 'models'), { recursive: true });
			for (const f of ['b.glb', 'a-1.glb', 'Upper.glb', 'x".glb', '<i>.glb', 'notes.txt', 'c.glb.bak']) fs.writeFileSync(path.join(dir, 'static', 'models', f), '');
			expect(listModels(dir)).toEqual(['a-1', 'b']);
			expect(listModels(path.join(dir, 'missing'))).toEqual([]);
		} finally {
			fs.rmSync(dir, { recursive: true, force: true });
		}
		expect(viewerHtml(['ok', 'x"><script>', 'a b'])).toContain('data-models="ok"');
	});
});
