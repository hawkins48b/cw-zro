/**
 * Dev-only model viewer (#181), served by plugin.js at /dev/models in `npm run dev`: pick a model
 * from static/models, orbit (drag), zoom (wheel), pan (right drag), wireframe, the node tree with the
 * triangles of each part, the file size. Click a node to box it and read its origin. Plain DOM,
 * English only: it is a tool, not part of the app.
 */
import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';

const $ = (id) => /** @type {HTMLElement} */ (document.getElementById(id));
const models = (document.body.dataset.models ?? '').split(',').filter(Boolean);

const canvas = /** @type {HTMLCanvasElement} */ ($('view'));
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
renderer.setPixelRatio(window.devicePixelRatio);
const scene = new THREE.Scene();
scene.background = new THREE.Color(0x30343b);
scene.add(new THREE.HemisphereLight(0xdde6ff, 0x3a3226, 1.6));
const sun = new THREE.DirectionalLight(0xffffff, 2.2);
sun.position.set(3, 5, 4);
scene.add(sun);
const camera = new THREE.PerspectiveCamera(40, 1, 0.01, 100);
const controls = new OrbitControls(camera, canvas);
controls.enableDamping = true;
const helpers = new THREE.Group();
scene.add(helpers);
const loader = new GLTFLoader();

/** @type {THREE.Object3D | null} */
let current = null;
/** @type {THREE.BoxHelper | null} */
let box = null;

function resize() {
	const { clientWidth: w, clientHeight: h } = /** @type {HTMLElement} */ (canvas.parentElement);
	renderer.setSize(w, h, false);
	camera.aspect = w / Math.max(1, h);
	camera.updateProjectionMatrix();
}
window.addEventListener('resize', resize);

function trianglesOf(object) {
	let count = 0;
	object.traverse((o) => {
		if (o.isMesh) count += (o.geometry.index ? o.geometry.index.count : o.geometry.attributes.position.count) / 3;
	});
	return count;
}

const fmt = (n, digits = 3) => Number(n.toFixed(digits)).toString();
const vec = (v) => `${fmt(v.x)}, ${fmt(v.y)}, ${fmt(v.z)}`;

/** Fills a <dl> with [term, value] rows. */
function rows(dl, entries) {
	dl.replaceChildren();
	for (const [term, value] of entries) {
		const dt = document.createElement('dt');
		dt.textContent = term;
		const dd = document.createElement('dd');
		dd.textContent = value;
		dl.append(dt, dd);
	}
}

function setWireframe(object, on) {
	object.traverse((o) => {
		if (!o.isMesh) return;
		for (const m of Array.isArray(o.material) ? o.material : [o.material]) m.wireframe = on;
	});
}

function select(object, span) {
	for (const s of document.querySelectorAll('#tree span.selected')) s.classList.remove('selected');
	span?.classList.add('selected');
	if (box) {
		scene.remove(box);
		box.dispose();
	}
	box = new THREE.BoxHelper(object, 0xffcc33);
	scene.add(box);
	const world = object.getWorldPosition(new THREE.Vector3());
	rows($('node'), [
		['name', object.name || '(none)'],
		['type', object.type],
		['position', vec(object.position)],
		['rotation', `${fmt(object.rotation.x)}, ${fmt(object.rotation.y)}, ${fmt(object.rotation.z)}`],
		['origin (world)', vec(world)],
		['triangles', String(trianglesOf(object))]
	]);
}

function tree(object) {
	const li = document.createElement('li');
	const span = document.createElement('span');
	const tris = trianglesOf(object);
	span.textContent = `${object.name || '(unnamed)'} `;
	const meta = document.createElement('small');
	meta.className = 'muted';
	meta.textContent = `${object.isMesh ? 'mesh' : 'node'} · ${tris} tri`;
	span.append(meta);
	span.addEventListener('click', () => select(object, span));
	li.append(span);
	if (object.children.length) {
		const ul = document.createElement('ul');
		for (const child of object.children) ul.append(tree(child));
		li.append(ul);
	}
	return li;
}

function frame(object) {
	const bounds = new THREE.Box3().setFromObject(object);
	const size = bounds.getSize(new THREE.Vector3());
	const centre = bounds.getCenter(new THREE.Vector3());
	const radius = Math.max(size.length() / 2, 0.005);
	camera.near = radius / 100;
	camera.far = radius * 100;
	camera.position.copy(centre).add(new THREE.Vector3(1, 0.6, 1.2).normalize().multiplyScalar(radius * 3));
	camera.updateProjectionMatrix();
	controls.target.copy(centre);
	controls.update();

	helpers.clear();
	const step = 10 ** Math.floor(Math.log10(radius * 2));
	const grid = new THREE.GridHelper(step * 20, 20, 0x667, 0x445);
	helpers.add(grid, new THREE.AxesHelper(step * 2));
	return { size, step };
}

async function show(name) {
	$('error').textContent = '';
	for (const b of document.querySelectorAll('#models button')) b.setAttribute('aria-current', String(b.dataset.name === name));
	try {
		const response = await fetch(`/models/${encodeURIComponent(name)}.glb`, { cache: 'no-store' });
		if (!response.ok) throw new Error(`HTTP ${response.status}`);
		const buffer = await response.arrayBuffer();
		const gltf = await loader.parseAsync(buffer, '');
		if (current) scene.remove(current);
		if (box) {
			scene.remove(box);
			box = null;
		}
		current = gltf.scene;
		scene.add(current);
		setWireframe(current, /** @type {HTMLInputElement} */ ($('wireframe')).checked);
		const { size, step } = frame(current);
		let meshes = 0;
		const materials = new Set();
		current.traverse((o) => {
			if (o.isMesh) {
				meshes++;
				materials.add(o.material);
			}
		});
		rows($('stats'), [
			['file', `${name}.glb`],
			['size', `${(buffer.byteLength / 1024).toFixed(1)} KB (${buffer.byteLength} bytes)`],
			['triangles', String(trianglesOf(current))],
			['meshes', String(meshes)],
			['materials', String(materials.size)],
			['bounds (m)', vec(size)],
			['grid cell', `${step} m`]
		]);
		const ul = document.createElement('ul');
		for (const child of current.children) ul.append(tree(child));
		$('tree').replaceChildren(ul);
		$('node').replaceChildren();
		history.replaceState(null, '', `#${name}`);
	} catch (error) {
		$('error').textContent = `Could not load ${name}: ${error instanceof Error ? error.message : String(error)}`;
	}
}

for (const name of models) {
	const button = document.createElement('button');
	button.className = 'model';
	button.type = 'button';
	button.dataset.name = name;
	button.textContent = name;
	button.addEventListener('click', () => show(name));
	$('models').append(button);
}
$('wireframe').addEventListener('change', (e) => current && setWireframe(current, /** @type {HTMLInputElement} */ (e.target).checked));
$('helpers').addEventListener('change', (e) => (helpers.visible = /** @type {HTMLInputElement} */ (e.target).checked));
if (models.length === 0) $('error').textContent = 'No model in static/models: run npm run models:build.';

resize();
renderer.setAnimationLoop(() => {
	controls.update();
	box?.update();
	renderer.render(scene, camera);
});

// A broken hash (e.g. #%E0) makes decodeURIComponent throw: fall back to the first model.
let wanted = '';
try {
	wanted = decodeURIComponent(location.hash.slice(1));
} catch {
	wanted = '';
}
if (models.length) show(models.includes(wanted) ? wanted : models[0]);
