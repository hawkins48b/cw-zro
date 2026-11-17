/**
 * The three.js scene of the 3D ballistic tutorial (#182), in the neon-grid look (#195). The tutorial
 * page loads this module with `await import()` once step 2 opens, so three.js is only in this
 * route's lazily loaded chunk: never import it, or anything that imports three, from another module.
 * The mobile build has no tutorial and never loads it (tutorialAvailability.js).
 *
 * The scene holds no calculation: the page hands it the geometry and path of utils/tutorialPath.js,
 * and the layout, terrain, backstop, grass, wind, weather, quality and HUD numbers come from
 * utils/tutorialScene.js.
 *
 * Look (#195, owner choice of 2026-11-17): near-black sky with a horizon glow, black ground with a
 * cyan grid (1 m and 10 m lines, drawn in the ground's shader from world x and z, so they follow the
 * slope), models as dark solids with neon edge lines, grass and leaves as glowing wireframes, a
 * magenta tracer, and bloom (EffectComposer + UnrealBloomPass) from Medium quality up. No lights.
 *
 * Models are the .glb files of static/models (#181), fetched from the app's own origin (`/models/`,
 * as the precision card fetches `/pdf/`): no texture, no worker, no blob URL. The post-processing
 * passes are shaders and render targets only. So the Content-Security-Policy needs nothing more.
 */
import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { EffectComposer } from 'three/examples/jsm/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/examples/jsm/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/examples/jsm/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/examples/jsm/postprocessing/OutputPass.js';
import {
	FORE_END_BELOW_BORE,
	NEON,
	REST_AHEAD_OF_BOLT,
	SANDBAG_REST_HEIGHT,
	SCOPE_ABOVE_RAIL,
	TARGET_FACE_BOTTOM,
	TARGET_FACE_HEIGHT,
	TARGET_HALF_WIDTH,
	backstopBox,
	cameraPose,
	grassPlacements,
	gridIndex,
	hudBracket,
	modelPath,
	qualityPreset,
	sceneLayout,
	targetFaceCorners,
	terrainHeight,
	treePlacements,
	weatherLook,
	windSway
} from '#lib/utils/tutorialScene.js';
import { animationDuration, pointAtTime } from '#lib/utils/tutorialPath.js';

/** The models the scene loads (all of static/models but the spotting scope, for later tutorials). */
const MODELS = ['rifle', 'scope', 'holo-sight', 'sandbag', 'ipsc-target', 'bullet', 'grass', 'tree-broadleaf', 'tree-birch', 'tree-conifer', 'flag'];

/** Delay before the terrain, grass and trees are built again after a change, ms. */
const REBUILD_DELAY = 180;

/** Seconds a camera move takes. */
const MOVE_TIME = 1.2;

/** The bullet is drawn this many times its real size, so it can be seen. */
const BULLET_SCALE = 4;

/** Edges between faces that meet at more than this angle get a neon line, degrees. */
const EDGE_ANGLE = 25;

/** Bloom: strength, radius, threshold (UnrealBloomPass). The scene is near-black, so only the lines glow. */
const BLOOM = { strength: 1.1, radius: 0.45, threshold: 0.05 };

/** Edge colour per target node: the board outline and the A, C and D zones glow (#195). */
const TARGET_EDGES = { board: NEON.target, 'zone-a': NEON.zoneA, 'zone-c': NEON.zoneC, 'zone-d': NEON.zoneD };

const easeInOut = (t) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);

/**
 * @typedef {object} SceneSettings
 * @property {'scope'|'holo'} optic
 * @property {import('#lib/utils/tutorialPath.js').TutorialGeometry} geometry
 * @property {import('#lib/utils/tutorialPath.js').TutorialPath|null} path
 * @property {{ speed: unknown, speedUnit: string, direction: unknown }} wind - as the page shows it
 * @property {'sunny'|'cloudy'|'rain'|'snow'} weather
 * @property {'low'|'medium'|'high'} quality
 */

/**
 * Builds the scene in `container` (a canvas is appended to it) and starts drawing.
 *
 * @param {HTMLElement} container
 * @param {SceneSettings} settings
 * @param {{ onorbit?: () => void, onlost?: () => void, hud?: HTMLElement|null }} [events] - onorbit:
 *   the user moved the camera by hand; onlost: the WebGL context was lost (the page offers a
 *   restart); hud: the element of the HUD bracket around the target, which the scene places over the
 *   target each frame (TutorialScene)
 */
export async function createTutorialScene(container, settings, events = {}) {
	const preset0 = qualityPreset(settings.quality, window.devicePixelRatio);
	const renderer = new THREE.WebGLRenderer({ antialias: preset0.antialias, logarithmicDepthBuffer: true, powerPreference: 'high-performance' });
	renderer.outputColorSpace = THREE.SRGBColorSpace;
	const canvas = renderer.domElement;
	canvas.style.display = 'block';
	canvas.style.width = '100%';
	canvas.style.height = '100%';

	/** Everything this module created that holds GPU memory, freed by dispose(). */
	const owned = { geometries: new Set(), materials: new Set(), textures: new Set() };
	const own = (thing) => {
		if (thing?.isBufferGeometry) owned.geometries.add(thing);
		else if (thing?.isMaterial) owned.materials.add(thing);
		else if (thing?.isTexture) owned.textures.add(thing);
		return thing;
	};
	/** Collect what a loaded or cloned object holds, so dispose() frees it. */
	const ownTree = (object) => {
		object.traverse((o) => {
			if (o.geometry) own(o.geometry);
			for (const mat of [o.material].flat()) if (mat) own(mat);
		});
		return object;
	};

	let disposed = false;
	let running = false;
	let visible = true;
	let onScreen = true;

	// ── Loading ───────────────────────────────────────────────────────
	const loader = new GLTFLoader();
	let loaded;
	try {
		loaded = await Promise.all(MODELS.map((name) => loader.loadAsync(modelPath(name))));
	} catch (error) {
		// No scene without its models: free the context made above, and let the page say so.
		renderer.dispose();
		renderer.forceContextLoss();
		throw error;
	}
	/** @type {Record<string, THREE.Object3D>} */
	const models = {};
	MODELS.forEach((name, i) => {
		models[name] = ownTree(loaded[i].scene);
	});

	container.append(canvas);

	// ── Neon materials ────────────────────────────────────────────────
	/** The dark fill of every model, pushed back a little so its edge lines win the depth test. */
	const solid = own(new THREE.MeshBasicMaterial({ color: NEON.solid, polygonOffset: true, polygonOffsetFactor: 1, polygonOffsetUnits: 1 }));
	/** @type {Map<string, THREE.LineBasicMaterial>} */
	const edgeMaterials = new Map();
	/** A glowing line material per colour, brighter than 1 so bloom picks it up. */
	function edgeMaterial(color, strength = 1.6) {
		const key = `${color}:${strength}`;
		if (!edgeMaterials.has(key)) {
			const material = own(new THREE.LineBasicMaterial({ color: new THREE.Color(color).multiplyScalar(strength), toneMapped: false }));
			edgeMaterials.set(key, material);
		}
		return /** @type {THREE.LineBasicMaterial} */ (edgeMaterials.get(key));
	}
	/** A glowing wireframe (grass, leaves), the wind shader added where needed. */
	const wire = (color) => own(new THREE.MeshBasicMaterial({ color: new THREE.Color(color).multiplyScalar(1.4), wireframe: true, toneMapped: false }));

	const isUnder = (o, test) => {
		for (let p = o; p; p = p.parent) if (test(p)) return true;
		return false;
	};

	/**
	 * Turn a loaded model into the neon look: each mesh gets the dark fill and a child of neon edge
	 * lines (named `edges`, so no node name of the model changes), or a glowing wireframe when
	 * `wireframe` says so. Edge geometry is made once here; clones share it.
	 *
	 * @param {THREE.Object3D} root
	 * @param {(mesh: THREE.Mesh) => number} colorOf - edge colour of a mesh
	 * @param {(mesh: THREE.Mesh) => THREE.Material | null} [wireframe] - a wireframe material, or null for edges
	 */
	function neonize(root, colorOf, wireframe = () => null) {
		const meshes = [];
		root.traverse((o) => {
			if (/** @type {THREE.Mesh} */ (o).isMesh) meshes.push(o);
		});
		for (const mesh of meshes) {
			const wired = wireframe(mesh);
			if (wired) {
				mesh.material = wired;
				continue;
			}
			mesh.material = solid;
			const edges = new THREE.LineSegments(own(new THREE.EdgesGeometry(mesh.geometry, EDGE_ANGLE)), edgeMaterial(colorOf(mesh)));
			edges.name = 'edges';
			edges.userData.edge = true;
			mesh.add(edges);
		}
	}

	// ── Scene, sky, camera ────────────────────────────────────────────
	const scene = new THREE.Scene();
	scene.fog = new THREE.FogExp2(0x000000, 0.001);
	const skyUniforms = {
		uSky: { value: new THREE.Color() },
		uHorizon: { value: new THREE.Color() },
		uHeight: { value: 0.15 }
	};
	// A dome around the camera: near-black overhead, a glow at the horizon. Drawn first, behind all.
	const sky = new THREE.Mesh(
		own(new THREE.SphereGeometry(2000, 32, 16)),
		own(
			new THREE.ShaderMaterial({
				uniforms: skyUniforms,
				side: THREE.BackSide,
				depthTest: false,
				depthWrite: false,
				fog: false,
				vertexShader: `varying vec3 vDir;
				void main() {
					vDir = normalize(position);
					gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
				}`,
				fragmentShader: `uniform vec3 uSky; uniform vec3 uHorizon; uniform float uHeight;
				varying vec3 vDir;
				void main() {
					float h = vDir.y;
					float glow = 1.0 - smoothstep(0.0, uHeight, abs(h));
					vec3 c = mix(uSky, uHorizon, glow * (h >= 0.0 ? 1.0 : 0.5));
					gl_FragColor = vec4(c, 1.0);
					#include <colorspace_fragment>
				}`
			})
		)
	);
	sky.renderOrder = -1000;
	sky.frustumCulled = false;
	scene.add(sky);

	const camera = new THREE.PerspectiveCamera(50, 1, 0.03, 5000);
	const controls = new OrbitControls(camera, canvas);
	controls.enableDamping = true;
	controls.dampingFactor = 0.08;
	controls.minDistance = 0.3;
	controls.maxPolarAngle = Math.PI * 0.495;

	// ── Ground and backstop grids ─────────────────────────────────────
	const gridUniforms = { uGridColor: { value: new THREE.Color() }, uGridStrength: { value: 1 } };
	/**
	 * Black with neon grid lines: 1 m (faint) and 10 m (bright), antialiased with fwidth, from world
	 * coordinates on a plane: `xz` for the ground (the lines follow its slope), `xy` for the
	 * backstop's face. The 1 m lines fade where they would be thinner than a pixel apart.
	 * @param {'xz'|'xy'} plane
	 */
	function gridMaterial(plane) {
		const material = own(new THREE.MeshBasicMaterial({ color: 0x000000, polygonOffset: true, polygonOffsetFactor: 1, polygonOffsetUnits: 1 }));
		material.onBeforeCompile = (shader) => {
			Object.assign(shader.uniforms, gridUniforms);
			shader.vertexShader = shader.vertexShader
				.replace('#include <common>', '#include <common>\nvarying vec3 vGridPos;')
				.replace('#include <begin_vertex>', '#include <begin_vertex>\nvGridPos = (modelMatrix * vec4(position, 1.0)).xyz;');
			shader.fragmentShader = shader.fragmentShader
				.replace('#include <common>', '#include <common>\nvarying vec3 vGridPos;\nuniform vec3 uGridColor;\nuniform float uGridStrength;')
				.replace(
					'#include <opaque_fragment>',
					`#include <opaque_fragment>
					vec2 gc = vGridPos.${plane};
					vec2 gw = fwidth(gc);
					vec2 g1 = abs(fract(gc - 0.5) - 0.5) / max(gw, vec2(1e-5));
					float l1 = 1.0 - min(min(g1.x, g1.y), 1.0);
					vec2 g10 = abs(fract(gc / 10.0 - 0.5) - 0.5) / max(gw / 10.0, vec2(1e-6));
					float l10 = 1.0 - min(min(g10.x, g10.y), 1.0);
					float minorFade = 1.0 - smoothstep(0.12, 0.45, max(gw.x, gw.y));
					float gridLine = max(l1 * 0.3 * minorFade, l10);
					gl_FragColor.rgb += uGridColor * gridLine * uGridStrength;`
				);
		};
		// The two planes compile to different programs.
		material.customProgramCacheKey = () => `tutorial-grid-${plane}`;
		return material;
	}
	const groundMaterial = gridMaterial('xz');
	const wallMaterial = gridMaterial('xy');

	// ── Rifle on the sandbag, with its optic ──────────────────────────
	const sandbag = models['sandbag'];
	scene.add(sandbag);
	const rifleMount = new THREE.Group(); // pivot on the sandbag's rest, pitched by the slope
	rifleMount.position.set(0, SANDBAG_REST_HEIGHT, 0);
	scene.add(rifleMount);
	const rifle = models['rifle'];
	rifle.position.set(0, FORE_END_BELOW_BORE, REST_AHEAD_OF_BOLT);
	rifleMount.add(rifle);
	const rail = rifle.getObjectByName('optic-rail');
	const scope = models['scope'];
	const holo = models['holo-sight'];
	for (const optic of [scope, holo]) {
		optic.position.copy(rail.position);
		rifle.add(optic);
	}
	scope.position.y += SCOPE_ABOVE_RAIL;
	const holoWindow = holo.getObjectByName('window');
	const muzzle = rifle.getObjectByName('muzzle');

	const target = models['ipsc-target'];
	scene.add(target);

	// Edge colours: the rifle and sandbag cyan, the optics magenta, the target by zone.
	neonize(rifle, () => NEON.cyan);
	neonize(scope, () => NEON.magenta);
	neonize(holo, () => NEON.magenta);
	neonize(sandbag, () => NEON.cyan);
	neonize(target, (mesh) => TARGET_EDGES[/** @type {keyof typeof TARGET_EDGES} */ (mesh.name)] ?? NEON.cyan);
	// The target outline glows brighter than the rest (#195).
	target.traverse((o) => {
		if (o.userData.edge && o.parent && o.parent.name in TARGET_EDGES) {
			/** @type {THREE.LineSegments} */ (o).material = edgeMaterial(TARGET_EDGES[/** @type {keyof typeof TARGET_EDGES} */ (o.parent.name)], 3);
		}
	});

	// Backstop: a dark wall with a grid face and magenta edges, behind the target (#195).
	const backstop = new THREE.Mesh(own(new THREE.BoxGeometry(1, 1, 1)), wallMaterial);
	const backstopEdges = new THREE.LineSegments(own(new THREE.EdgesGeometry(backstop.geometry)), edgeMaterial(NEON.backstop, 2));
	backstop.add(backstopEdges);
	scene.add(backstop);

	// ── Bullet, tracer, impact ────────────────────────────────────────
	const dot = own(dotTexture());
	const bullet = models['bullet'];
	neonize(bullet, () => NEON.magenta);
	bullet.scale.setScalar(BULLET_SCALE);
	bullet.visible = false;
	scene.add(bullet);
	const glow = new THREE.Sprite(own(new THREE.SpriteMaterial({ map: dot, color: new THREE.Color(NEON.tracer).multiplyScalar(2), sizeAttenuation: false, depthWrite: false, fog: false, toneMapped: false })));
	glow.scale.setScalar(0.022);
	glow.visible = false;
	scene.add(glow);
	const tracer = new THREE.Line(own(new THREE.BufferGeometry()), own(new THREE.LineBasicMaterial({ color: new THREE.Color(NEON.tracer).multiplyScalar(2.5), fog: false, toneMapped: false })));
	tracer.visible = false;
	tracer.frustumCulled = false;
	scene.add(tracer);
	const hole = new THREE.Mesh(own(new THREE.CircleGeometry(0.012, 16)), own(new THREE.MeshBasicMaterial({ color: new THREE.Color(NEON.hit).multiplyScalar(2), toneMapped: false })));
	hole.visible = false;
	scene.add(hole);
	const impactMark = new THREE.Sprite(own(new THREE.SpriteMaterial({ map: dot, color: NEON.hit, sizeAttenuation: false, depthTest: false, fog: false, toneMapped: false })));
	impactMark.scale.setScalar(0.03);
	impactMark.renderOrder = 10;
	impactMark.visible = false;
	scene.add(impactMark);

	// ── Built from the settings ───────────────────────────────────────
	/** @type {SceneSettings} */
	let current = settings;
	let layout = sceneLayout(settings.geometry, { losHeight: 0.24, losZ: 0.4 });
	let quality = preset0;
	let look = weatherLook(settings.weather);
	let sway = windSway(settings.wind);
	/** @type {THREE.Mesh|null} */
	let terrain = null;
	/** @type {THREE.InstancedMesh|null} */
	let grass = null;
	/** Tufts placed; the weather draws all of them or a share (grassShown). */
	let placementsCount = 0;
	/** @type {Array<{ root: THREE.Object3D, trunk: THREE.Object3D|undefined, axis: THREE.Vector3, branches: THREE.Object3D[], leaves: THREE.Object3D[], phase: number }>} */
	let trees = [];
	const treeGroup = new THREE.Group();
	scene.add(treeGroup);
	/** @type {Array<{ root: THREE.Object3D, cloth: THREE.Object3D }>} */
	let flags = [];
	const flagGroup = new THREE.Group();
	scene.add(flagGroup);
	/** @type {THREE.Object3D|null} */
	let precipitation = null;

	// Grass: a glowing wireframe that sways with the wind (vertex shader).
	const swayUniforms = {
		uTime: { value: 0 },
		uBlow: { value: new THREE.Vector2() },
		uLean: { value: 0 },
		uAmp: { value: 0 },
		uFreq: { value: 0 }
	};
	const grassSource = /** @type {THREE.Mesh} */ (models['grass'].getObjectByName('grass'));
	const grassMaterial = wire(NEON.grass);
	grassMaterial.onBeforeCompile = (shader) => {
		Object.assign(shader.uniforms, swayUniforms);
		shader.vertexShader = shader.vertexShader
			.replace('#include <common>', `#include <common>\nuniform float uTime; uniform vec2 uBlow; uniform float uLean; uniform float uAmp; uniform float uFreq;`)
			.replace(
				'#include <begin_vertex>',
				`#include <begin_vertex>
				#ifdef USE_INSTANCING
				float swayH = max(position.y, 0.0);
				vec3 swayAt = vec3(instanceMatrix[3]);
				float swayPhase = swayAt.x * 0.21 + swayAt.z * 0.17;
				float gust = sin(uTime * uFreq * 6.2832 + swayPhase) * 0.65 + sin(uTime * uFreq * 11.1 + swayPhase * 1.7) * 0.35;
				float bend = (uLean + uAmp * gust) * swayH;
				vec3 blowLocal = transpose(mat3(instanceMatrix)) * vec3(uBlow.x, 0.0, uBlow.y);
				float blowLen = length(blowLocal);
				vec3 swayDir = blowLen > 1e-4 ? blowLocal / blowLen : vec3(0.7071, 0.0, 0.7071);
				transformed.xz += swayDir.xz * bend * swayH * 3.0;
				transformed.y -= bend * bend * swayH * 2.0;
				#endif`
			);
	};
	grassMaterial.customProgramCacheKey = () => 'tutorial-grass';

	// Trees: trunk and branches dark with cyan edges, leaves as a glowing wireframe.
	const leafMaterial = wire(NEON.grass);
	for (const name of ['tree-broadleaf', 'tree-birch', 'tree-conifer']) {
		neonize(
			models[name],
			() => NEON.cyan,
			(mesh) => (isUnder(mesh, (p) => /^leaves/.test(p.name)) ? leafMaterial : null)
		);
	}

	// Flags: pole with edges, cloth as a magenta wireframe that waves.
	const clothUniforms = { uTime: swayUniforms.uTime, uWave: { value: 0 } };
	const clothMaterial = wire(NEON.magenta);
	clothMaterial.side = THREE.DoubleSide;
	clothMaterial.onBeforeCompile = (shader) => {
		Object.assign(shader.uniforms, clothUniforms);
		shader.vertexShader = shader.vertexShader
			.replace('#include <common>', `#include <common>\nuniform float uTime; uniform float uWave;`)
			.replace(
				'#include <begin_vertex>',
				`#include <begin_vertex>
				float along = clamp(position.x / 0.9, 0.0, 1.0);
				transformed.z += sin(position.x * 9.0 - uTime * (4.0 + uWave * 10.0)) * 0.05 * along * (0.3 + uWave);`
			);
	};
	clothMaterial.customProgramCacheKey = () => 'tutorial-cloth';
	neonize(models['flag'], () => NEON.cyan, (mesh) => (mesh.name === 'cloth' ? clothMaterial : null));

	function setOptic(optic) {
		scope.visible = optic === 'scope';
		holo.visible = optic === 'holo';
	}

	/** The line of sight origin for the current optic and slope, in scene coordinates. */
	function lineOfSight(slopeRad) {
		rifleMount.rotation.x = slopeRad;
		rifleMount.updateMatrixWorld(true);
		const at = new THREE.Vector3();
		if (current.optic === 'holo') holoWindow.getWorldPosition(at);
		else scope.getWorldPosition(at);
		return at;
	}

	function buildLayout() {
		const slope = ((current.geometry.slopeDeg || 0) * Math.PI) / 180;
		const los = lineOfSight(slope);
		layout = sceneLayout(current.geometry, { losHeight: los.y, losZ: los.z });
		target.position.set(0, layout.targetGroundY, layout.targetZ);
		const box = backstopBox(layout);
		backstop.position.set(box.x, box.y, box.z);
		backstop.scale.set(box.width, box.height, box.depth);
		controls.maxDistance = Math.max(60, layout.horizontal * 1.6);
		faceCorners = targetFaceCorners(layout).map((c) => new THREE.Vector3(...c));
	}

	function buildTerrain() {
		if (terrain) {
			scene.remove(terrain);
			terrain.geometry.dispose();
			owned.geometries.delete(terrain.geometry);
		}
		const xs = [];
		for (let x = -400; x <= 400; ) {
			xs.push(x);
			x += Math.abs(x) < 30 ? 2 : Math.abs(x) < 100 ? 8 : 25;
		}
		const zs = [];
		const far = layout.targetZ - 400;
		for (let z = 200; z >= far; ) {
			zs.push(z);
			const nearShooter = Math.abs(z) < 40;
			const nearTarget = Math.abs(z - layout.targetZ) < 60;
			z -= nearShooter || nearTarget ? 2 : 12;
		}
		const positions = new Float32Array(xs.length * zs.length * 3);
		let k = 0;
		for (const z of zs) {
			for (const x of xs) {
				positions.set([x, terrainHeight(x, z, layout), z], k * 3);
				k++;
			}
		}
		const geometry = own(new THREE.BufferGeometry());
		geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
		geometry.setIndex(gridIndex(xs.length, zs.length));
		terrain = new THREE.Mesh(geometry, groundMaterial);
		scene.add(terrain);
	}

	function buildGrass() {
		if (grass) {
			scene.remove(grass);
			grass.dispose();
		}
		const placements = grassPlacements(layout, quality.grass);
		const count = placements.length / 5;
		placementsCount = count;
		grass = new THREE.InstancedMesh(grassSource.geometry, grassMaterial, count);
		const m = new THREE.Matrix4();
		const q = new THREE.Quaternion();
		const up = new THREE.Vector3(0, 1, 0);
		for (let i = 0; i < count; i++) {
			const [x, y, z, rot, s] = placements.subarray(i * 5, i * 5 + 5);
			q.setFromAxisAngle(up, rot);
			m.compose(new THREE.Vector3(x, y, z), q, new THREE.Vector3(s, s, s));
			grass.setMatrixAt(i, m);
		}
		grass.instanceMatrix.needsUpdate = true;
		grass.frustumCulled = false;
		applyGrassShown();
		scene.add(grass);
	}

	function applyGrassShown() {
		if (grass) grass.count = Math.floor(placementsCount * look.grassShown);
	}

	function buildTrees() {
		treeGroup.clear();
		trees = [];
		for (const t of treePlacements(layout, quality.trees)) {
			const root = models[t.model].clone(true);
			root.position.set(t.x, t.y, t.z);
			root.rotation.y = t.rotation;
			root.scale.setScalar(t.scale);
			const branches = [];
			const leaves = [];
			root.traverse((o) => {
				if (/^branch-\d+$/.test(o.name)) branches.push(o);
				else if (/^leaves-/.test(o.name)) leaves.push(o);
			});
			const trunk = root.getObjectByName('trunk');
			trees.push({ root, trunk, axis: new THREE.Vector3(), branches, leaves, phase: (t.x * 0.37 + t.z * 0.11) % (Math.PI * 2) });
			treeGroup.add(root);
		}
		applyTreeWind();
	}

	function buildFlags() {
		flagGroup.clear();
		flags = [];
		const spots = [0.5, 1].map((f) => {
			const z = layout.los.z + (layout.targetZ - layout.los.z) * f + (f === 1 ? 6 : 0);
			const x = -(8 + (f === 1 ? 2 : 0));
			return { x, z };
		});
		for (const spot of spots) {
			const root = models['flag'].clone(true);
			root.position.set(spot.x, terrainHeight(spot.x, spot.z, layout), spot.z);
			const cloth = root.getObjectByName('cloth');
			flags.push({ root, cloth });
			flagGroup.add(root);
		}
		applyFlagWind();
	}

	function applyFlagWind() {
		const strength = Math.min(1, sway.speed / 8);
		clothUniforms.uWave.value = strength;
		const heading = sway.speed > 0 ? Math.atan2(-sway.blow.z, sway.blow.x) : 0;
		for (const f of flags) {
			f.root.rotation.y = heading;
			// Limp in still air, out straight from about 8 m/s.
			f.cloth.rotation.z = -(1 - strength) * 1.35;
		}
	}

	function applyTreeWind() {
		const k = new THREE.Vector3(sway.blow.z, 0, -sway.blow.x);
		const inverse = new THREE.Quaternion();
		for (const t of trees) {
			inverse.copy(t.root.quaternion).invert();
			t.axis.copy(k).applyQuaternion(inverse);
			if (t.axis.lengthSq() < 1e-8) t.axis.set(1, 0, 0);
			t.axis.normalize();
		}
	}

	function applyWind() {
		sway = windSway(current.wind);
		swayUniforms.uBlow.value.set(sway.blow.x, sway.blow.z);
		swayUniforms.uLean.value = sway.lean;
		swayUniforms.uAmp.value = sway.amplitude;
		swayUniforms.uFreq.value = sway.frequency;
		applyTreeWind();
		applyFlagWind();
	}

	function applyWeather() {
		look = weatherLook(current.weather);
		scene.background = new THREE.Color(look.sky);
		skyUniforms.uSky.value.set(look.sky);
		skyUniforms.uHorizon.value.set(look.horizon);
		skyUniforms.uHeight.value = look.horizonHeight;
		/** @type {THREE.FogExp2} */ (scene.fog).color.set(look.fog);
		/** @type {THREE.FogExp2} */ (scene.fog).density = look.fogDensity / Math.max(1, layout.horizontal / 600);
		gridUniforms.uGridColor.value.set(look.grid);
		gridUniforms.uGridStrength.value = look.gridStrength;
		applyGrassShown();
		buildPrecipitation();
	}

	function buildPrecipitation() {
		if (precipitation) {
			const old = /** @type {any} */ (precipitation);
			scene.remove(precipitation);
			old.geometry.dispose();
			owned.geometries.delete(old.geometry);
			old.material.dispose();
			owned.materials.delete(old.material);
			precipitation = null;
		}
		if (look.precipitation === 'none') return;
		const count = quality.particles;
		const geometry = own(new THREE.BufferGeometry());
		const rain = look.precipitation === 'rain';
		const positions = new Float32Array(count * (rain ? 6 : 3));
		const random = Math.random;
		for (let i = 0; i < count; i++) {
			const x = (random() - 0.5) * 60;
			const y = random() * 30;
			const z = (random() - 0.5) * 60;
			if (rain) positions.set([x, y, z, x, y + 0.5, z], i * 6);
			else positions.set([x, y, z], i * 3);
		}
		geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
		const color = new THREE.Color(look.precipitationColor).multiplyScalar(rain ? 1.6 : 1.3);
		// Neon rain streaks, glowing snow flakes: added light, no depth writes.
		precipitation = rain
			? new THREE.LineSegments(geometry, precipitationMaterial(new THREE.LineBasicMaterial({ color, transparent: true, opacity: 0.7 })))
			: new THREE.Points(geometry, precipitationMaterial(new THREE.PointsMaterial({ color, size: 0.08, map: dot, transparent: true })));
		precipitation.frustumCulled = false;
		scene.add(precipitation);
	}

	/** Additive, no depth writes, no fog, and freed with the scene. */
	function precipitationMaterial(material) {
		material.blending = THREE.AdditiveBlending;
		material.depthWrite = false;
		material.fog = false;
		material.toneMapped = false;
		return own(material);
	}

	// ── Bloom (Medium and High) ───────────────────────────────────────
	/** @type {EffectComposer|null} */
	let composer = null;
	/** @type {UnrealBloomPass|null} */
	let bloomPass = null;
	/** @type {OutputPass|null} */
	let outputPass = null;

	/** Make the composer the first time bloom is on; it stays (and is resized) until dispose. */
	function ensureComposer() {
		if (composer) return;
		composer = new EffectComposer(renderer);
		composer.addPass(new RenderPass(scene, camera));
		bloomPass = new UnrealBloomPass(new THREE.Vector2(256, 256), BLOOM.strength, BLOOM.radius, BLOOM.threshold);
		composer.addPass(bloomPass);
		outputPass = new OutputPass();
		composer.addPass(outputPass);
	}

	function applyQuality() {
		quality = qualityPreset(current.quality, window.devicePixelRatio);
		renderer.setPixelRatio(quality.pixelRatio);
		if (quality.bloom) ensureComposer();
		composer?.setPixelRatio(quality.pixelRatio);
		resize();
	}

	function buildAll() {
		buildLayout();
		buildTerrain();
		buildGrass();
		buildTrees();
		buildFlags();
		applyWeather();
		applyWind();
		clearShot();
	}

	// ── Updates from the page ─────────────────────────────────────────
	let rebuildTimer = 0;
	/**
	 * Apply new settings: only what changed is rebuilt. The terrain, grass and trees wait for the
	 * typing to settle (REBUILD_DELAY).
	 * @param {SceneSettings} next
	 */
	function update(next) {
		const before = current;
		current = next;
		if (disposed) return;
		if (next.optic !== before.optic) {
			setOptic(next.optic);
			scheduleRebuild();
		}
		const g = next.geometry;
		const h = before.geometry;
		if (g.distanceM !== h.distanceM || g.slopeDeg !== h.slopeDeg || g.altitudeM !== h.altitudeM) scheduleRebuild();
		if (next.path !== before.path) clearShot();
		if (!sameWind(next.wind, before.wind)) applyWind();
		if (next.quality !== before.quality) {
			applyQuality();
			buildGrass();
			buildTrees();
			buildPrecipitation();
		}
		if (next.weather !== before.weather) applyWeather();
	}

	const sameWind = (a, b) => a?.speed === b?.speed && a?.speedUnit === b?.speedUnit && a?.direction === b?.direction;

	function scheduleRebuild() {
		clearTimeout(rebuildTimer);
		rebuildTimer = window.setTimeout(() => {
			if (disposed) return;
			const keep = cameraPreset;
			buildAll();
			if (keep) setCamera(keep, false);
		}, REBUILD_DELAY);
	}

	// ── Camera ────────────────────────────────────────────────────────
	/** @type {string|null} */
	let cameraPreset = null;
	/** @type {{ from: THREE.Vector3, to: THREE.Vector3, fromTarget: THREE.Vector3, toTarget: THREE.Vector3, fromFov: number, toFov: number, t: number } | null} */
	let move = null;

	function moveCamera(position, lookAt, fov, animate) {
		if (!animate) {
			camera.position.copy(position);
			controls.target.copy(lookAt);
			camera.fov = fov;
			camera.updateProjectionMatrix();
			move = null;
			return;
		}
		move = {
			from: camera.position.clone(),
			to: position,
			fromTarget: controls.target.clone(),
			toTarget: lookAt,
			fromFov: camera.fov,
			toFov: fov,
			t: 0
		};
	}

	/**
	 * Move the camera to a preset.
	 * @param {'shooter'|'optic'|'side'|'target'} preset
	 * @param {boolean} [animate]
	 */
	function setCamera(preset, animate = true) {
		cameraPreset = preset;
		const pose = cameraPose(preset, layout, current.optic);
		throughOptic(preset === 'optic');
		moveCamera(new THREE.Vector3(...pose.position), new THREE.Vector3(...pose.target), pose.fov, animate && preset !== 'optic');
	}

	/** Through the optic, the rifle and optic are hidden (the camera is inside them) and orbiting is off. */
	function throughOptic(on) {
		rifle.visible = !on;
		controls.enabled = !on;
	}

	/** The world position of a pose anchor. */
	function anchorPosition(anchor) {
		const at = new THREE.Vector3();
		switch (anchor) {
			case 'rifle':
				rifle.getWorldPosition(at);
				return at.add(new THREE.Vector3(0, 0, -0.2));
			case 'optic':
				return (current.optic === 'holo' ? holoWindow : scope).getWorldPosition(at);
			case 'muzzle':
				return muzzle.getWorldPosition(at);
			case 'target':
				return at.set(layout.aim.x, layout.aim.y, layout.aim.z);
			default:
				return at.set(layout.los.x, layout.los.y, layout.los.z);
		}
	}

	/**
	 * Move the camera to a tutorial step's pose: `offset` metres from the anchor, looking at it.
	 * @param {{ anchor: string, offset: [number, number, number], fov?: number }} pose
	 */
	function setPose(pose) {
		cameraPreset = null;
		throughOptic(false);
		const at = anchorPosition(pose.anchor);
		moveCamera(at.clone().add(new THREE.Vector3(...pose.offset)), at, pose.fov ?? 45, true);
	}

	controls.addEventListener('start', () => {
		move = null;
		if (cameraPreset !== null) {
			cameraPreset = null;
			events.onorbit?.();
		}
	});

	// ── Highlight ─────────────────────────────────────────────────────
	/** @type {Array<{ line: THREE.LineSegments, original: THREE.Material }>} */
	let highlighted = [];

	/**
	 * Make a model, or one of its named nodes, glow: its edge lines turn bright and pulse (the
	 * highlighted lines get their own material, so other parts with the same colour stay as they
	 * are). Null clears it.
	 * @param {{ model: string, node?: string } | null} spec
	 */
	function highlight(spec) {
		for (const h of highlighted) {
			/** @type {THREE.Material} */ (h.line.material).dispose();
			h.line.material = h.original;
		}
		highlighted = [];
		if (!spec) return;
		const root = spec.model === 'optic' ? (current.optic === 'holo' ? holo : scope) : spec.model === 'target' ? target : spec.model === 'sandbag' ? sandbag : rifle;
		const node = spec.node ? root.getObjectByName(spec.node) : root;
		if (!node) return;
		node.traverse((o) => {
			if (!o.userData.edge) return;
			// The optic is a child of the rifle: highlighting the rifle leaves it as it is.
			if (spec.model === 'rifle' && (isUnder(o, (p) => p === scope) || isUnder(o, (p) => p === holo))) return;
			const line = /** @type {THREE.LineSegments} */ (o);
			const original = /** @type {THREE.Material} */ (line.material);
			line.material = new THREE.LineBasicMaterial({ color: NEON.highlight, toneMapped: false });
			highlighted.push({ line, original });
		});
	}

	// ── Fire ──────────────────────────────────────────────────────────
	/** @type {{ points: Array<{x:number,y:number,z:number,t:number}>, duration: number, flight: number, t: number, resolve: () => void } | null} */
	let flight = null;

	function clearShot() {
		if (flight) {
			flight.resolve();
			flight = null;
		}
		bullet.visible = false;
		glow.visible = false;
		tracer.visible = false;
		hole.visible = false;
		impactMark.visible = false;
	}

	/**
	 * Fire along the current path: the bullet flies it in animationDuration seconds, drawing a magenta
	 * tracer, then the impact is marked. Resolves when it lands (or the shot is cleared). Without a
	 * path, resolves at once.
	 * @returns {Promise<void>}
	 */
	function fire() {
		clearShot();
		const path = current.path;
		if (!path || disposed) return Promise.resolve();
		const los = layout.los;
		const points = path.points.map((p) => ({ x: los.x + p.x, y: los.y + p.y, z: los.z + p.z, t: p.t }));
		const positions = new Float32Array(points.length * 3);
		points.forEach((p, i) => positions.set([p.x, p.y, p.z], i * 3));
		tracer.geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
		tracer.geometry.setDrawRange(0, 0);
		tracer.visible = true;
		bullet.visible = true;
		glow.visible = true;
		return new Promise((resolve) => {
			flight = { points, duration: animationDuration(path.time), flight: path.time, t: 0, resolve };
		});
	}

	const toward = new THREE.Vector3();
	function stepFlight(dt) {
		if (!flight) return;
		flight.t += dt;
		const f = Math.min(1, flight.t / flight.duration);
		const p = pointAtTime(flight.points, f * flight.flight);
		bullet.position.set(p.x, p.y, p.z);
		glow.position.copy(bullet.position);
		const next = flight.points[Math.min(flight.points.length - 1, p.index + 1)];
		toward.set(next.x, next.y, next.z);
		if (toward.distanceToSquared(bullet.position) > 1e-8) bullet.lookAt(toward);
		// lookAt points +Z at the target; the bullet's nose is -Z.
		bullet.rotateY(Math.PI);
		tracer.geometry.setDrawRange(0, p.index + 1);
		if (f >= 1) {
			const end = flight.points[flight.points.length - 1];
			bullet.visible = false;
			glow.visible = false;
			tracer.geometry.setDrawRange(0, flight.points.length);
			markImpact(end);
			const done = flight.resolve;
			flight = null;
			done();
		}
	}

	function markImpact(end) {
		const face = layout.targetZ + 0.002;
		const bottom = layout.targetGroundY + TARGET_FACE_BOTTOM;
		const onBoard = Math.abs(end.x) <= TARGET_HALF_WIDTH && end.y >= bottom && end.y <= bottom + TARGET_FACE_HEIGHT;
		hole.position.set(end.x, end.y, face);
		hole.visible = onBoard;
		impactMark.position.set(end.x, end.y, face + 0.01);
		impactMark.material.color.set(onBoard ? NEON.hit : NEON.miss);
		impactMark.visible = true;
	}

	// ── HUD bracket around the target (#195) ──────────────────────────
	const hud = events.hud ?? null;
	/** @type {THREE.Vector3[]} */
	let faceCorners = [];
	const projected = new THREE.Vector3();
	let hudShown = '';
	/** The drawing's size in CSS pixels, from resize(). */
	let viewWidth = 1;
	let viewHeight = 1;

	/** Place the HUD element over the target, or hide it (through the optic, off screen, or big enough). */
	function placeHud() {
		if (!hud) return;
		let box = null;
		if (cameraPreset !== 'optic') {
			const ndc = faceCorners.map((c) => {
				projected.copy(c).project(camera);
				return { x: projected.x, y: projected.y, z: projected.z };
			});
			box = hudBracket(ndc, viewWidth, viewHeight);
		}
		const key = box ? `${Math.round(box.x)},${Math.round(box.y)},${Math.round(box.width)},${Math.round(box.height)}` : 'none';
		if (key === hudShown) return;
		hudShown = key;
		if (!box) {
			hud.style.display = 'none';
			return;
		}
		hud.style.display = 'block';
		hud.style.transform = `translate(${Math.round(box.x)}px, ${Math.round(box.y)}px)`;
		hud.style.width = `${Math.round(box.width)}px`;
		hud.style.height = `${Math.round(box.height)}px`;
	}

	// ── Drawing ───────────────────────────────────────────────────────
	let lastFrame = 0;
	let elapsed = 0;

	function frame() {
		const now = performance.now();
		const dt = lastFrame ? Math.min(0.1, (now - lastFrame) / 1000) : 0;
		lastFrame = now;
		elapsed += dt;
		swayUniforms.uTime.value = elapsed;

		if (move) {
			move.t = Math.min(1, move.t + dt / MOVE_TIME);
			const e = easeInOut(move.t);
			camera.position.lerpVectors(move.from, move.to, e);
			controls.target.lerpVectors(move.fromTarget, move.toTarget, e);
			camera.fov = move.fromFov + (move.toFov - move.fromFov) * e;
			camera.updateProjectionMatrix();
			if (move.t >= 1) move = null;
		}
		if (cameraPreset === 'optic') camera.lookAt(controls.target);
		else controls.update();
		sky.position.copy(camera.position);

		// Trees: the trunk leans, the branches gust, the leaves flutter.
		const gustBase = elapsed * sway.frequency * Math.PI * 2;
		for (const t of trees) {
			const g = Math.sin(gustBase + t.phase) * 0.7 + Math.sin(gustBase * 1.9 + t.phase * 1.3) * 0.3;
			const bend = sway.tree.lean + sway.tree.amplitude * g;
			t.trunk?.quaternion.setFromAxisAngle(t.axis, bend * 0.25);
			for (let i = 0; i < t.branches.length; i++) {
				t.branches[i].quaternion.setFromAxisAngle(t.axis, bend * (1.4 + (i % 3) * 0.3));
			}
			for (let i = 0; i < t.leaves.length; i++) {
				const leaf = t.leaves[i];
				leaf.rotation.x = Math.sin(gustBase * 2.3 + i + t.phase) * sway.tree.amplitude * 1.5;
				leaf.rotation.z = Math.cos(gustBase * 2.1 + i * 1.7 + t.phase) * sway.tree.amplitude * 1.5;
			}
		}

		// Rain or snow around the camera.
		if (precipitation) {
			precipitation.position.set(Math.round(camera.position.x), camera.position.y - 12, Math.round(camera.position.z));
			const attr = /** @type {THREE.BufferAttribute} */ (/** @type {any} */ (precipitation).geometry.getAttribute('position'));
			const a = attr.array;
			const rain = look.precipitation === 'rain';
			const fall = (rain ? 9 : 0.9) * dt;
			const drift = Math.min(sway.speed, 15) * dt * (rain ? 0.25 : 0.6);
			const stride = rain ? 6 : 3;
			for (let i = 0; i < a.length; i += stride) {
				let y = a[i + 1] - fall;
				let x = a[i] + sway.blow.x * drift + (rain ? 0 : Math.sin(elapsed + i) * 0.003);
				let z = a[i + 2] + sway.blow.z * drift;
				if (y < 0) y += 30;
				if (x > 30) x -= 60;
				else if (x < -30) x += 60;
				if (z > 30) z -= 60;
				else if (z < -30) z += 60;
				a[i] = x;
				a[i + 1] = y;
				a[i + 2] = z;
				if (rain) {
					// The streak leans with the wind.
					const lean = Math.min(sway.speed, 15) * 0.02;
					a[i + 3] = x - sway.blow.x * lean;
					a[i + 4] = y + 0.5;
					a[i + 5] = z - sway.blow.z * lean;
				}
			}
			attr.needsUpdate = true;
		}

		// Highlight pulse.
		if (highlighted.length > 0) {
			const pulse = 1.5 + 1.5 * (0.5 + 0.5 * Math.sin(elapsed * 4));
			for (const h of highlighted) /** @type {THREE.LineBasicMaterial} */ (h.line.material).color.set(NEON.highlight).multiplyScalar(pulse);
		}

		stepFlight(dt);
		if (quality.bloom && composer) composer.render(dt);
		else renderer.render(scene, camera);
		placeHud();
	}

	function syncRunning() {
		const should = !disposed && visible && onScreen;
		if (should === running) return;
		running = should;
		// After a pause, the first frame starts the time again (no jump).
		if (should) lastFrame = 0;
		renderer.setAnimationLoop(should ? frame : null);
	}

	function resize() {
		const w = Math.max(1, container.clientWidth);
		const h = Math.max(1, container.clientHeight);
		renderer.setSize(w, h, false);
		viewWidth = w;
		viewHeight = h;
		camera.aspect = w / h;
		camera.updateProjectionMatrix();
		if (composer) {
			composer.setSize(w, h);
			// Bloom works at a share of the drawing size (quality), which the composer's size reset.
			const scale = quality.bloomScale || 0.5;
			bloomPass?.setSize(Math.round(w * quality.pixelRatio * scale), Math.round(h * quality.pixelRatio * scale));
		}
		hudShown = '';
	}

	const resizeObserver = new ResizeObserver(resize);
	resizeObserver.observe(container);
	const intersection = new IntersectionObserver((entries) => {
		onScreen = entries.some((e) => e.isIntersecting);
		syncRunning();
	});
	intersection.observe(container);
	const onVisibility = () => {
		visible = document.visibilityState !== 'hidden';
		syncRunning();
	};
	document.addEventListener('visibilitychange', onVisibility);
	const onLost = (event) => {
		event.preventDefault();
		running = false;
		renderer.setAnimationLoop(null);
		if (hud) hud.style.display = 'none';
		events.onlost?.();
	};
	canvas.addEventListener('webglcontextlost', onLost);

	// ── Start ─────────────────────────────────────────────────────────
	setOptic(settings.optic);
	applyQuality();
	buildAll();
	setCamera('shooter', false);
	onVisibility();

	/** Stop drawing and free everything: GPU memory, post-processing, listeners, observers, timers. */
	function dispose() {
		if (disposed) return;
		disposed = true;
		clearTimeout(rebuildTimer);
		clearShot();
		highlight(null);
		renderer.setAnimationLoop(null);
		if (hud) hud.style.display = 'none';
		document.removeEventListener('visibilitychange', onVisibility);
		canvas.removeEventListener('webglcontextlost', onLost);
		resizeObserver.disconnect();
		intersection.disconnect();
		controls.dispose();
		grass?.dispose();
		bloomPass?.dispose();
		outputPass?.dispose();
		composer?.dispose();
		scene.traverse((o) => {
			const any = /** @type {any} */ (o);
			if (any.geometry) own(any.geometry);
			for (const mat of [any.material].flat()) if (mat) own(mat);
		});
		for (const mat of owned.materials) {
			for (const value of Object.values(mat)) if (value?.isTexture) own(value);
			mat.dispose();
		}
		for (const geometry of owned.geometries) geometry.dispose();
		for (const texture of owned.textures) texture.dispose();
		renderer.dispose();
		renderer.forceContextLoss();
		canvas.remove();
	}

	return { update, setCamera, setPose, highlight, fire, clearShot, dispose };
}

/** A soft round dot (canvas texture): sprites, snow flakes. No URL, so nothing for the CSP. */
function dotTexture() {
	const size = 64;
	const canvas = document.createElement('canvas');
	canvas.width = size;
	canvas.height = size;
	const ctx = canvas.getContext('2d');
	if (ctx) {
		const g = ctx.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2);
		g.addColorStop(0, 'rgba(255,255,255,1)');
		g.addColorStop(0.5, 'rgba(255,255,255,0.9)');
		g.addColorStop(1, 'rgba(255,255,255,0)');
		ctx.fillStyle = g;
		ctx.fillRect(0, 0, size, size);
	}
	const texture = new THREE.CanvasTexture(canvas);
	texture.colorSpace = THREE.SRGBColorSpace;
	return texture;
}
