/**
 * Builds the 3D models of the ballistic tutorial (#180, #181) from three.js primitives and writes
 * them to `static/models/<name>.glb` with three's GLTFExporter (binary glTF).
 *
 * Run: npm run models:build
 *
 * This script is the source of the models: no third-party model and no texture is used, only
 * three.js geometry and plain materials (vertex colours for the grass). The shapes are in
 * scripts/models/ (kit.js holds the conventions: metres, +Y up, forward is -Z, a named node's origin
 * is its pivot). The output is deterministic: no date, id or random number (trees and grass use a
 * seeded generator), so an unchanged model writes the same bytes, and src/test/tutorialModels.test.js
 * checks that the committed files are what this script writes. Run it after any change to
 * scripts/models/ and commit the .glb files. See docs/development.md, "Tutorial models".
 *
 * GLTFExporter is written for the browser: in Node it needs FileReader, which is shimmed below on
 * top of Node's Blob. With no textures it needs no canvas.
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { GLTFExporter } from 'three/examples/jsm/exporters/GLTFExporter.js';
import { triangles } from './models/kit.js';
import { flag, ipscTarget, spottingScope } from './models/range.js';
import { grass, treeBirch, treeBroadleaf, treeConifer } from './models/nature.js';
import { bullet, holoSight, rifle, scope } from './models/weapons.js';

/** Every model: file name (without .glb) and the function that draws it. */
export const MODELS = Object.freeze({
	rifle,
	scope,
	'holo-sight': holoSight,
	'tree-broadleaf': treeBroadleaf,
	'tree-birch': treeBirch,
	'tree-conifer': treeConifer,
	grass,
	'ipsc-target': ipscTarget,
	bullet,
	'spotting-scope': spottingScope,
	flag
});

/** The path of a model, relative to `static/` (and to the site root). */
export const modelPath = (name) => `models/${name}.glb`;

/** FileReader.readAsArrayBuffer, as much of it as GLTFExporter uses, for Node. */
class NodeFileReader {
	/** @type {ArrayBuffer | null} */
	result = null;
	/** @type {(() => void) | null} */
	onloadend = null;
	/** @param {Blob} blob */
	readAsArrayBuffer(blob) {
		blob.arrayBuffer().then((buffer) => {
			this.result = buffer;
			this.onloadend?.();
		});
	}
}

/**
 * The binary glTF of an object.
 * @param {import('three').Object3D} object
 * @returns {Promise<Uint8Array>}
 */
export async function exportGlb(object) {
	if (typeof globalThis.FileReader === 'undefined') {
		// @ts-ignore: only the part the exporter uses
		globalThis.FileReader = NodeFileReader;
	}
	const result = await new GLTFExporter().parseAsync(object, { binary: true, trs: true });
	return new Uint8Array(/** @type {ArrayBuffer} */ (result));
}

/**
 * A model's file, and its triangle count.
 * @param {string} name a key of MODELS
 */
export async function buildModel(name) {
	const draw = MODELS[name];
	if (!draw) throw new Error(`unknown model: ${name}`);
	const object = draw();
	return { bytes: await exportGlb(object), triangles: triangles(object) };
}

/** Writes every model into `static/models/`. */
export async function writeModels(root = process.cwd()) {
	const dir = path.join(root, 'static', 'models');
	fs.mkdirSync(dir, { recursive: true });
	const written = [];
	for (const name of Object.keys(MODELS)) {
		const file = path.join(root, 'static', modelPath(name));
		const { bytes, triangles: count } = await buildModel(name);
		fs.writeFileSync(file, bytes);
		written.push({ file: path.relative(root, file), bytes: bytes.length, triangles: count });
	}
	return written;
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
	const written = await writeModels();
	for (const w of written) console.log(`wrote ${w.file}: ${w.bytes} bytes, ${w.triangles} triangles`);
	console.log(`total: ${written.reduce((sum, w) => sum + w.bytes, 0)} bytes`);
}
