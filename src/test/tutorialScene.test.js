/**
 * The pure part of the 3D tutorial scene (#182, utils/tutorialScene.js): layout, terrain, quality,
 * wind sway, weather, trees and grass, camera poses. The three.js code itself is not tested here
 * (no WebGL in jsdom); the owner checks it in the browser.
 */
import { describe, it, expect } from 'vitest';
import { existsSync } from 'fs';
import path from 'path';
import {
	LANE_HALF_WIDTH,
	QUALITY_PRESETS,
	SCOPE_HALF_VIEW_MRAD,
	TARGET_CENTRE_HEIGHT,
	WEATHER_LOOKS,
	cameraPose,
	grassPlacements,
	modelPath,
	opticFov,
	qualityPreset,
	sceneLayout,
	seededRandom,
	terrainHeight,
	treeMix,
	treePlacements,
	weatherLook,
	windSpeedMps,
	windSway
} from '#lib/utils/tutorialScene.js';
import { tutorialGeometry } from '#lib/utils/tutorialPath.js';

const OPTIC = { losHeight: 0.24, losZ: 0.4 };
const layoutFor = (distance, elevation, altitude = '0') =>
	sceneLayout(tutorialGeometry({ distance, unit: 'm' }, { altitude, elevation, unit: 'm' }), OPTIC);

describe('qualityPreset', () => {
	it('grows from low to high: shadows, grass, particles, trees, pixel ratio', () => {
		const { low, medium, high } = QUALITY_PRESETS;
		expect(low.shadows).toBe(false);
		expect(medium.shadows && high.shadows).toBe(true);
		for (const key of ['grass', 'particles', 'trees', 'pixelRatio']) {
			expect(low[key]).toBeLessThan(medium[key]);
			expect(medium[key]).toBeLessThan(high[key]);
		}
	});

	it('caps the pixel ratio at the device one, and reads anything else as low', () => {
		expect(qualityPreset('high', 1).pixelRatio).toBe(1);
		expect(qualityPreset('high', 3).pixelRatio).toBe(2);
		expect(qualityPreset('medium', NaN).pixelRatio).toBe(1);
		expect(qualityPreset('ultra', 2)).toEqual({ ...QUALITY_PRESETS.low });
	});
});

describe('sceneLayout and terrainHeight', () => {
	it('puts the aim point on the line of sight at the distance, the target ground under it', () => {
		const flat = layoutFor('300', '0');
		expect(flat.aim).toEqual({ x: 0, y: 0.24, z: 0.4 - 300 });
		expect(flat.targetGroundY).toBeCloseTo(0.24 - TARGET_CENTRE_HEIGHT, 12);
		const up = layoutFor('500', '100');
		expect(up.aim.y).toBeCloseTo(100.24, 9);
		expect(up.horizontal).toBeCloseTo(Math.sqrt(500 ** 2 - 100 ** 2), 9);
	});

	it('reshapes the ground with the distance and the elevation', () => {
		const a = layoutFor('300', '0');
		const b = layoutFor('600', '50');
		expect(terrainHeight(0, 0, a)).toBe(0);
		expect(terrainHeight(0, a.targetZ, a)).toBeCloseTo(a.targetGroundY, 9);
		expect(terrainHeight(0, b.targetZ, b)).toBeCloseTo(b.targetGroundY, 9);
		expect(b.targetGroundY).toBeGreaterThan(48);
		// Halfway up the slope, between the two ends.
		const mid = terrainHeight(0, b.targetZ / 2, b);
		expect(mid).toBeGreaterThan(0);
		expect(mid).toBeLessThan(b.targetGroundY);
		// Downhill.
		const down = layoutFor('400', '-60');
		expect(terrainHeight(0, down.targetZ, down)).toBeLessThan(-60);
	});

	it('keeps the lane smooth and flat under the shooter, with a berm behind the target', () => {
		const l = layoutFor('300', '0');
		for (const x of [-LANE_HALF_WIDTH, 0, LANE_HALF_WIDTH]) expect(terrainHeight(x, 2, l)).toBe(0);
		expect(terrainHeight(0, l.targetZ - 20, l)).toBeGreaterThan(l.targetGroundY + 2);
		for (const v of [terrainHeight(80, -100, l), terrainHeight(-200, -1000, l)]) expect(Number.isFinite(v)).toBe(true);
	});

	it('falls back to 300 m when the distance is unusable', () => {
		const g = tutorialGeometry({ distance: '', unit: 'm' }, { altitude: '0', elevation: '0', unit: 'm' });
		expect(sceneLayout(g, OPTIC).horizontal).toBe(300);
	});
});

describe('wind sway', () => {
	it('reads m/s and mph, and no wind for anything else', () => {
		expect(windSpeedMps({ speed: '4', speedUnit: 'mps' })).toBe(4);
		expect(windSpeedMps({ speed: '10', speedUnit: 'mph' })).toBeCloseTo(4.4704, 9);
		for (const speed of ['', 'x', '-5', 'Infinity', null]) expect(windSpeedMps({ speed, speedUnit: 'mps' })).toBe(0);
	});

	it('blows away from where the wind comes from (#106): 0° at the shooter (+Z), 90° to the left (-X)', () => {
		const head = windSway({ speed: '5', speedUnit: 'mps', direction: '0' });
		expect(head.blow.x).toBeCloseTo(0, 12);
		expect(head.blow.z).toBeCloseTo(1, 12);
		const right = windSway({ speed: '5', speedUnit: 'mps', direction: '90' });
		expect(right.blow.x).toBeCloseTo(-1, 12);
		expect(right.blow.z).toBeCloseTo(0, 12);
		const left = windSway({ speed: '5', speedUnit: 'mps', direction: '270' });
		expect(left.blow.x).toBeCloseTo(1, 12);
	});

	it('bends more and faster in a stronger wind, trees less than grass, and almost nothing in still air', () => {
		const light = windSway({ speed: '2', speedUnit: 'mps', direction: '90' });
		const strong = windSway({ speed: '12', speedUnit: 'mps', direction: '90' });
		expect(strong.lean).toBeGreaterThan(light.lean);
		expect(strong.amplitude).toBeGreaterThan(light.amplitude);
		expect(strong.frequency).toBeGreaterThan(light.frequency);
		expect(strong.tree.lean).toBeLessThan(strong.lean);
		expect(windSway({ speed: '200', speedUnit: 'mps', direction: '0' }).lean).toBeLessThanOrEqual(0.35);
		const still = windSway({ speed: '0', speedUnit: 'mps', direction: '90' });
		expect(still).toMatchObject({ speed: 0, lean: 0, blow: { x: 0, z: 0 } });
		expect(still.amplitude).toBeLessThan(light.amplitude);
	});
});

describe('weather looks', () => {
	it('gives four different looks; rain is wet, snow is white, only those fall', () => {
		const looks = ['sunny', 'cloudy', 'rain', 'snow'].map(weatherLook);
		expect(new Set(looks.map((l) => l.sky)).size).toBe(4);
		expect(new Set(looks.map((l) => l.sun)).size).toBe(4);
		expect(weatherLook('rain').wet).toBeGreaterThan(0);
		expect(weatherLook('rain').roughness).toBeLessThan(weatherLook('sunny').roughness);
		expect(weatherLook('snow').groundColor).toBeGreaterThan(0xd00000);
		expect(looks.map((l) => l.precipitation)).toEqual(['none', 'none', 'rain', 'snow']);
		expect(weatherLook('fog')).toBe(WEATHER_LOOKS.sunny);
	});
});

describe('trees and grass', () => {
	it('mixes the tree models by altitude', () => {
		expect(treeMix(0)['tree-broadleaf']).toBeGreaterThan(treeMix(0)['tree-conifer']);
		expect(treeMix(1000)['tree-conifer']).toBeGreaterThan(0.5);
		expect(treeMix(1800)).toMatchObject({ 'tree-conifer': 1, density: 1 });
		expect(treeMix(2500).density).toBeLessThan(1);
		expect(treeMix(NaN)).toEqual(treeMix(0));
	});

	it('lines both sides of the range outside the lane, on the ground, the same on every build', () => {
		const l = layoutFor('300', '20', '0');
		const trees = treePlacements(l, 10);
		expect(trees).toHaveLength(20);
		expect(treePlacements(l, 10)).toEqual(trees);
		for (const t of trees) {
			expect(Math.abs(t.x)).toBeGreaterThan(LANE_HALF_WIDTH);
			expect(t.y).toBeCloseTo(terrainHeight(t.x, t.z, l), 9);
			expect(t.z).toBeLessThanOrEqual(15);
			expect(t.z).toBeGreaterThanOrEqual(l.targetZ - 25);
		}
		expect(trees.some((t) => t.x < 0) && trees.some((t) => t.x > 0)).toBe(true);
		const alpine = treePlacements(layoutFor('300', '0', '2000'), 10);
		expect(alpine.every((t) => t.model === 'tree-conifer')).toBe(true);
	});

	it('puts the grass near the shooter, the target and along the lane, on the ground', () => {
		const l = layoutFor('400', '-30');
		const grass = grassPlacements(l, 400);
		expect(grass).toHaveLength(400 * 5);
		expect(grassPlacements(l, 400)).toEqual(grass);
		let nearShooter = 0;
		for (let i = 0; i < 400; i++) {
			const [x, y, z] = grass.subarray(i * 5, i * 5 + 3);
			expect(y).toBeCloseTo(terrainHeight(x, z, l), 3);
			if (z > -30) nearShooter++;
		}
		expect(nearShooter).toBeGreaterThanOrEqual(200);
		expect(grassPlacements(l, 0)).toHaveLength(0);
	});

	it('seeds its random numbers', () => {
		const a = seededRandom(7);
		const b = seededRandom(7);
		const values = Array.from({ length: 5 }, () => a());
		expect(Array.from({ length: 5 }, () => b())).toEqual(values);
		for (const v of values) expect(v >= 0 && v < 1).toBe(true);
	});
});

describe('camera and optic', () => {
	it('gives the scope view ±6 mrad, so the reticle overlay matches the scene', () => {
		const fov = (opticFov('scope') * Math.PI) / 180;
		expect(Math.tan(fov / 2) * 1000).toBeCloseTo(SCOPE_HALF_VIEW_MRAD, 9);
		expect(opticFov('holo')).toBeGreaterThan(opticFov('scope'));
	});

	it('looks at the aim point through the optic, at the target from in front, at the range from the side', () => {
		const l = layoutFor('600', '40');
		const optic = cameraPose('optic', l, 'scope');
		expect(optic.target).toEqual([l.aim.x, l.aim.y, l.aim.z]);
		expect(optic.position[1]).toBe(l.los.y);
		const target = cameraPose('target', l, 'scope');
		expect(target.position[2]).toBeGreaterThan(l.aim.z);
		const side = cameraPose('side', l, 'scope');
		expect(side.position[0]).toBeGreaterThan(100);
		expect(side.target[2]).toBeCloseTo((l.los.z + l.aim.z) / 2, 9);
		const shooter = cameraPose('shooter', l, 'holo');
		expect(shooter.position[2]).toBeGreaterThan(l.los.z);
		for (const pose of [optic, target, side, shooter]) {
			expect([...pose.position, ...pose.target].every(Number.isFinite)).toBe(true);
		}
	});
});

describe('modelPath', () => {
	it('points at the committed models on the app origin', () => {
		for (const name of ['rifle', 'scope', 'holo-sight', 'sandbag', 'ipsc-target', 'bullet', 'grass', 'tree-broadleaf', 'tree-birch', 'tree-conifer', 'flag']) {
			const url = modelPath(name);
			expect(url).toBe(`/models/${name}.glb`);
			expect(existsSync(path.join(process.cwd(), 'static', url))).toBe(true);
		}
	});
});
