/**
 * The pure part of the 3D tutorial scene (#182, neon grid #195, utils/tutorialScene.js): layout,
 * terrain, backstop, quality, wind sway, weather, trees and even grass, camera poses, HUD bracket. The three.js code itself is not tested here
 * (no WebGL in jsdom); the owner checks it in the browser.
 */
import { describe, it, expect } from 'vitest';
import { existsSync } from 'fs';
import path from 'path';
import {
	BACKSTOP_GAP,
	HUD_MAX_SIZE,
	HUD_MIN_SIZE,
	LANE_HALF_WIDTH,
	NEON,
	QUALITY_PRESETS,
	SHOOTER_FOV_DEG,
	SCOPE_HALF_VIEW_MRAD,
	TARGET_CENTRE_HEIGHT,
	WEATHER_LOOKS,
	backstopBox,
	cameraPose,
	grassBand,
	grassGrid,
	grassPlacements,
	hudBracket,
	targetFaceCorners,
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
	windSway,
	gridIndex
} from '#lib/utils/tutorialScene.js';
import { tutorialGeometry } from '#lib/utils/tutorialPath.js';

const OPTIC = { losHeight: 0.24, losZ: 0.4 };
const layoutFor = (distance, elevation, altitude = '0') =>
	sceneLayout(tutorialGeometry({ distance, unit: 'm' }, { altitude, elevation, unit: 'm' }), OPTIC);

describe('qualityPreset', () => {
	it('grows from low to high: bloom (off on Low), grass, particles, trees, pixel ratio', () => {
		const { low, medium, high } = QUALITY_PRESETS;
		expect(low.bloom).toBe(false);
		expect(medium.bloom && high.bloom).toBe(true);
		expect(medium.bloomScale).toBeLessThan(high.bloomScale);
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
	it('gives four different digital looks: clear, haze, neon rain, glowing snow', () => {
		const looks = ['sunny', 'cloudy', 'rain', 'snow'].map(weatherLook);
		for (const key of ['sky', 'horizon', 'fog', 'fogDensity']) expect(new Set(looks.map((l) => l[key])).size).toBe(4);
		// Near-black sky overhead in every weather.
		const brightness = (c) => ((c >> 16) & 255) + ((c >> 8) & 255) + (c & 255);
		for (const l of looks) expect(brightness(l.sky)).toBeLessThan(3 * 16);
		// Clear has the thinnest haze, haze the thickest.
		expect(weatherLook('sunny').fogDensity).toBe(Math.min(...looks.map((l) => l.fogDensity)));
		expect(weatherLook('cloudy').fogDensity).toBe(Math.max(...looks.map((l) => l.fogDensity)));
		expect(looks.map((l) => l.precipitation)).toEqual(['none', 'none', 'rain', 'snow']);
		expect(weatherLook('rain').precipitationColor).not.toBe(weatherLook('snow').precipitationColor);
		expect(weatherLook('snow').grassShown).toBeLessThan(1);
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

	describe('grass spread evenly (#195)', () => {
		/** Tufts of a placement as [x, y, z]. */
		const tufts = (grass) => Array.from({ length: grass.length / 5 }, (_, i) => [...grass.subarray(i * 5, i * 5 + 3)]);

		it.each([
			['300 m flat, Low', '300', '0', 1500],
			['300 m flat, High', '300', '0', 16000],
			['1000 m uphill, Medium', '1000', '120', 6000],
			['3000 m downhill, High', '3000', '-400', 16000],
			['25 m, Low', '25', '0', 1500]
		])('puts one tuft in every cell of the grid, on the ground: %s', (_, distance, elevation, count) => {
			const l = layoutFor(distance, elevation);
			const band = grassBand(l);
			const grid = grassGrid(band, count);
			const grass = grassPlacements(l, count);
			expect(grid.columns * grid.rows).toBeLessThanOrEqual(count);
			// Close to the quality's count: never fewer than one row short.
			expect(grid.columns * grid.rows).toBeGreaterThan(count - grid.columns - 1);
			expect(grass.length / 5).toBeLessThanOrEqual(grid.columns * grid.rows);
			const perCell = new Map();
			for (const [x, y, z] of tufts(grass)) {
				expect(x).toBeGreaterThanOrEqual(band.x0);
				expect(x).toBeLessThanOrEqual(band.x1);
				expect(z).toBeLessThanOrEqual(band.z0);
				expect(z).toBeGreaterThanOrEqual(band.z1);
				expect(y).toBeCloseTo(terrainHeight(x, z, l), 3);
				const c = Math.min(grid.columns - 1, Math.floor((x - band.x0) / grid.width));
				const r = Math.min(grid.rows - 1, Math.floor((band.z0 - z) / grid.length));
				perCell.set(`${c},${r}`, (perCell.get(`${c},${r}`) ?? 0) + 1);
			}
			// Every cell holds exactly one tuft: no bare cell, no clump. The only cells allowed to be
			// bare are tiny ones wholly inside the area kept clear around the sandbag and the stand.
			for (const n of perCell.values()) expect(n).toBe(1);
			for (let r = 0; r < grid.rows; r++) {
				for (let c = 0; c < grid.columns; c++) {
					if (perCell.has(`${c},${r}`)) continue;
					const cx = band.x0 + (c + 0.5) * grid.width;
					const cz = band.z0 - (r + 0.5) * grid.length;
					const nearClear = Math.abs(cx) < 0.6 + grid.width && (Math.abs(cz) < 1.2 + grid.length || Math.abs(cz - l.targetZ) < 1.2 + grid.length);
					expect(nearClear, `bare cell ${c},${r}`).toBe(true);
				}
			}
			expect(perCell.size).toBeGreaterThan(grid.columns * grid.rows * 0.99);
			// Cells about square, so the spacing is the same across and along the range.
			const ratio = grid.width / grid.length;
			expect(ratio).toBeGreaterThan(0.5);
			expect(ratio).toBeLessThan(2);
		});

		it('covers the whole range, from behind the shooter to past the target, the same on every build', () => {
			const l = layoutFor('600', '0');
			const grass = grassPlacements(l, 6000);
			expect(grassPlacements(l, 6000)).toEqual(grass);
			const zs = tufts(grass).map((t) => t[2]);
			const step = grassGrid(grassBand(l), 6000).length;
			expect(Math.max(...zs)).toBeGreaterThan(6 - step);
			expect(Math.min(...zs)).toBeLessThan(l.targetZ - 10 + step);
			// No gap along the range wider than two cells.
			const sorted = [...zs].sort((a, b) => a - b);
			for (let i = 1; i < sorted.length; i++) expect(sorted[i] - sorted[i - 1]).toBeLessThan(2 * step);
		});

		it('keeps the sandbag and the target stand clear', () => {
			for (const [distance, count] of [['10', 16000], ['300', 16000], ['50', 6000]]) {
				const l = layoutFor(distance, '0');
				for (const [x, , z] of tufts(grassPlacements(l, count))) {
					const onSandbag = Math.abs(x) < 0.6 && Math.abs(z) < 1.2;
					const onStand = Math.abs(x) < 0.6 && Math.abs(z - l.targetZ) < 1.2;
					expect(onSandbag || onStand).toBe(false);
				}
			}
		});

		it('gives nothing for no count', () => {
			expect(grassPlacements(layoutFor('300', '0'), 0)).toHaveLength(0);
			expect(grassGrid({ x0: 0, x1: 0, z0: 1, z1: 0 }, 100)).toMatchObject({ columns: 0, rows: 0 });
		});
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
		expect(shooter.fov).toBe(SHOOTER_FOV_DEG);
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

describe('gridIndex', () => {
	it('winds every terrain triangle so its front face points up (+Y)', () => {
		// 3 columns along +X, 3 rows going down range (−Z), flat ground.
		const xs = [-2, 0, 2];
		const zs = [0, -2, -4];
		const vertices = zs.flatMap((z) => xs.map((x) => [x, 0, z]));
		const index = gridIndex(xs.length, zs.length);
		expect(index).toHaveLength(2 * 2 * 6);
		for (let t = 0; t < index.length; t += 3) {
			const [a, b, c] = [index[t], index[t + 1], index[t + 2]].map((i) => vertices[i]);
			const e1 = [b[0] - a[0], b[1] - a[1], b[2] - a[2]];
			const e2 = [c[0] - a[0], c[1] - a[1], c[2] - a[2]];
			const normalY = e1[2] * e2[0] - e1[0] * e2[2];
			expect(normalY).toBeGreaterThan(0);
		}
	});

	it('uses every vertex of the grid', () => {
		expect(new Set(gridIndex(4, 5)).size).toBe(20);
	});
});

describe('shooter view (#195)', () => {
	it('is narrower, about 30-35°', () => {
		expect(SHOOTER_FOV_DEG).toBeGreaterThanOrEqual(30);
		expect(SHOOTER_FOV_DEG).toBeLessThanOrEqual(35);
	});

	it.each([['300', '0'], ['1000', '150'], ['2500', '-400'], ['25', '0']])(
		'looks straight at the target, with the orbit centre 25 m out (at most): %s m, %s m',
		(distance, elevation) => {
			const l = layoutFor(distance, elevation);
			const { position, target } = cameraPose('shooter', l, 'scope');
			const toTarget = [l.aim.x - position[0], l.aim.y - position[1], l.aim.z - position[2]];
			const toCentre = [target[0] - position[0], target[1] - position[1], target[2] - position[2]];
			const n1 = Math.hypot(...toTarget);
			const n2 = Math.hypot(...toCentre);
			const cos = toTarget.reduce((sum, v, i) => sum + v * toCentre[i], 0) / (n1 * n2);
			expect(cos).toBeCloseTo(1, 9);
			expect(n2).toBeCloseTo(Math.min(25, n1), 9);
		}
	);

	it('keeps the optic view at ±6 mrad (the reticle overlay stays aligned)', () => {
		const l = layoutFor('300', '0');
		expect(cameraPose('optic', l, 'scope').fov).toBe(opticFov('scope'));
	});
});

describe('backstop (#195)', () => {
	/** Where the line from the optic through a point meets the backstop's front plane. */
	const throughTo = (l, box, [x, y, z]) => {
		const front = box.z + box.depth / 2;
		const t = (front - l.los.z) / (z - l.los.z);
		return [l.los.x + (x - l.los.x) * t, l.los.y + (y - l.los.y) * t];
	};

	it.each([
		['25', '0'],
		['300', '0'],
		['300', '100'],
		['800', '-200'],
		['1500', '500'],
		['3000', '-500'],
		['3000', '0']
	])('stands behind the target and frames it from the shooter: %s m, %s m', (distance, elevation) => {
		const l = layoutFor(distance, elevation);
		const box = backstopBox(l);
		expect(box.z).toBeCloseTo(l.targetZ - BACKSTOP_GAP, 9);
		// Every corner of the target, seen from the optic, falls on the wall with a margin.
		for (const corner of targetFaceCorners(l)) {
			const [x, y] = throughTo(l, box, corner);
			expect(Math.abs(x - box.x)).toBeLessThan(box.width / 2 - 1);
			expect(y).toBeGreaterThan(box.y - box.height / 2 + 0.5);
			expect(y).toBeLessThan(box.y + box.height / 2 - 1);
		}
		// Its foot is in the ground everywhere under it: no gap shows.
		const bottom = box.y - box.height / 2;
		for (const dx of [-box.width / 2, 0, box.width / 2]) {
			for (const dz of [-box.depth / 2, box.depth / 2]) expect(bottom).toBeLessThan(terrainHeight(box.x + dx, box.z + dz, l));
		}
		// Wider with the distance, at least 6 m.
		expect(box.width).toBeGreaterThanOrEqual(6);
	});

	it('grows with the distance, so it frames the target on screen at long range too', () => {
		const near = backstopBox(layoutFor('300', '0'));
		const far = backstopBox(layoutFor('3000', '0'));
		expect(far.width).toBeGreaterThan(near.width * 5);
		// About 30 mrad wide at 3000 m.
		expect(far.width / 3000).toBeCloseTo(0.03, 3);
	});
});

describe('HUD bracket (#195)', () => {
	const point = (x, y, z = 0.99) => ({ x, y, z });

	it('frames a target of a few pixels with a bracket of at least HUD_MIN_SIZE, centred on it', () => {
		const box = hudBracket([point(0, 0), point(0.002, 0), point(0, 0.004), point(0.002, 0.004)], 800, 500);
		expect(box).not.toBeNull();
		expect(box.width).toBe(HUD_MIN_SIZE);
		expect(box.height).toBe(HUD_MIN_SIZE);
		expect(box.x + box.width / 2).toBeCloseTo(400.4, 6);
		expect(box.y + box.height / 2).toBeCloseTo(249.5, 6);
	});

	it('grows with the target, 6 px around it', () => {
		const box = hudBracket([point(-0.1, -0.1), point(0.1, -0.1), point(-0.1, 0.1), point(0.1, 0.1)], 800, 500);
		expect(box.width).toBeCloseTo(80 + 12, 6);
		expect(box.height).toBeCloseTo(50 + 12, 6);
	});

	it('hides when the target is behind the camera, off screen, big already, or the viewport is empty', () => {
		expect(hudBracket([point(0, 0, 1.2), point(0, 0)], 800, 500)).toBeNull();
		expect(hudBracket([point(0, 0, -1.5), point(0, 0)], 800, 500)).toBeNull();
		expect(hudBracket([point(1.5, 0), point(1.6, 0.01)], 800, 500)).toBeNull();
		expect(hudBracket([point(-0.5, -0.5), point(0.5, 0.5)], 800, 500)).toBeNull();
		expect(HUD_MAX_SIZE).toBeGreaterThan(HUD_MIN_SIZE);
		expect(hudBracket([point(0, 0)], 0, 500)).toBeNull();
		expect(hudBracket([], 800, 500)).toBeNull();
		expect(hudBracket([point(NaN, 0)], 800, 500)).toBeNull();
	});

	it('takes the four corners of the target face, 46 × 76 cm, 0.8 m above its ground', () => {
		const l = layoutFor('300', '20');
		const corners = targetFaceCorners(l);
		expect(corners).toHaveLength(4);
		const xs = corners.map((c) => c[0]);
		const ys = corners.map((c) => c[1]);
		expect(Math.max(...xs) - Math.min(...xs)).toBeCloseTo(0.46, 9);
		expect(Math.max(...ys) - Math.min(...ys)).toBeCloseTo(0.76, 9);
		expect(Math.min(...ys)).toBeCloseTo(l.targetGroundY + 0.8, 9);
		expect(Math.min(...ys) + 0.38).toBeCloseTo(l.aim.y, 9);
		for (const c of corners) expect(c[2]).toBe(l.targetZ);
	});
});

describe('neon palette (#195)', () => {
	it('has every colour as a 24-bit number', () => {
		for (const [name, value] of Object.entries(NEON)) {
			expect(Number.isInteger(value), name).toBe(true);
			expect(value >= 0 && value <= 0xffffff, name).toBe(true);
		}
		expect(NEON.tracer).toBe(NEON.magenta);
	});
});
