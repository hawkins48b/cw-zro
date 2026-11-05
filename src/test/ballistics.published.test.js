/**
 * Layer 2 of the ballistics reference tests (#70): independent check against published
 * manufacturer tables. Layer 1, the regression baseline, is ballistics.baseline.test.js.
 *
 * Why these sources: js-ballistics is a port of py-ballisticcalc by the same author, so that
 * library is not independent. Federal and Lapua publish their own tables. Those tables look
 * computed from the listed BC rather than measured, so agreement most likely shows that two
 * solvers agree on the same inputs, not that either matches a real bullet.
 *
 * Tolerances here are wider than in layer 1 and cover what the two solvers do not share:
 * rounding of the published figures, and the atmosphere, which the Federal page does not
 * state. They are set per source below, each with its reason.
 *
 * Do not widen a tolerance to make a test pass. A published value that disagrees is a finding
 * to investigate; see the G7 test below for how one is recorded.
 */
import { describe, it, expect } from 'vitest';
import { Unit } from 'js-ballistics';
import { calculateFullTrajectory } from '#lib/utils/ballisticCalculator.js';
import { WIND_10MPH } from './fixtures/ballisticProfiles.js';

// ── Source A: Federal Gold Medal Match GM308M ───────────────────────────────

/**
 * Figures copied as published. Trajectory at 200 yd was unreadable on the page, so it is
 * absent, not estimated. The page text says "zeroed at 100 yd", but see the zero distance
 * tests: the table is a 200 yd zero. Atmosphere: not stated on the page.
 */
const FEDERAL = {
	source: 'Federal Gold Medal Match GM308M, 308 Win, 168 gr Sierra MatchKing',
	url: 'https://www.federalpremium.com/rifle/gold-medal/gold-medal-sierra-matchking/11-GM308M.html',
	retrieved: '2026-11-04',
	inputs: { velocityFps: 2650, bcG1: 0.462, bcG7: 0.224, sightHeightIn: 1.5, windMph: 10 },
	velocityFps: { 0: 2650, 100: 2460, 200: 2277, 300: 2103, 400: 1936, 500: 1778 },
	energyFtLb: { 0: 2619, 100: 2257, 200: 1935, 300: 1650, 400: 1398, 500: 1179 },
	windDriftIn: { 100: 0.7, 200: 3.1, 300: 7.4, 400: 13.4, 500: 22.0 },
	trajectoryIn: { 50: 1.0, 100: 2.1, 300: -8.9, 400: -25.5, 500: -51.5 }
};

const federalProfile = {
	opticHeight: String(FEDERAL.inputs.sightHeightIn),
	opticHeightUnit: 'in',
	zeroDist: 200,
	zeroUnit: 'yd',
	bulletDiameter: '0.308',
	bulletDiameterUnit: 'in',
	bulletWeight: '168',
	bulletWeightUnit: 'gr',
	bcType: 'G1',
	bc: String(FEDERAL.inputs.bcG1),
	velocity: String(FEDERAL.inputs.velocityFps),
	velocityUnit: 'fps',
	spinDrift: false,
	tempSensitivity: false
};

/**
 * Not from the Federal page: a hypothesis for its unstated atmosphere. Army Standard Metro
 * (59 F, 29.53 inHg, 78 % humidity) is the older reference atmosphere for published
 * ballistics. It fits this table far better than ICAO, but the page does not confirm it.
 */
const ARMY_STANDARD_METRO = {
	altitude: '0',
	altitudeUnit: 'ft',
	pressure: '29.53',
	pressureUnit: 'inhg',
	temperature: '59',
	temperatureUnit: 'f',
	humidity: '78'
};

/** Rows of a 500 yd table by distance in yards: velocity, energy, drop, windage. */
function federalTable(profile, atmosphere) {
	const result = calculateFullTrajectory(
		profile,
		{ distance: 500, unit: 'yd', step: 50 },
		atmosphere,
		WIND_10MPH
	);
	return Object.fromEntries(
		result.trajectory.map((p) => [
			Math.round(p.distance.In(Unit.Yard)),
			{
				velocityFps: p.velocity.In(Unit.FPS),
				energyFtLb: p.energy.In(Unit.FootPound),
				trajectoryIn: p.targetDrop.In(Unit.Inch),
				windDriftIn: p.windage.In(Unit.Inch)
			}
		])
	);
}

/** Largest |computed - published| over one published series. */
function largestGap(table, field) {
	return Math.max(
		...Object.entries(FEDERAL[field]).map(([d, published]) =>
			Math.abs(table[d][field] - published)
		)
	);
}

function expectWithin(table, field, tolerance) {
	for (const [distance, published] of Object.entries(FEDERAL[field])) {
		const gap = Math.abs(table[distance][field] - published);
		expect(gap, `${field} at ${distance} yd: published ${published}`).toBeLessThanOrEqual(
			tolerance(published)
		);
	}
}

describe('Federal GM308M, standard (ICAO) atmosphere, G1', () => {
	/**
	 * The app's default atmosphere, and the assumption for a table that states none.
	 * The bands come from the unknown atmosphere: moving from ICAO to Army Standard Metro
	 * shifts the 500 yd figures by 0.8 % (velocity), 0.8 % (drop) and 2.2 % (wind drift).
	 * Each band is that shift rounded up, plus 0.1 in on distances for the table's one
	 * decimal. Energy goes with velocity squared. This layer is loose on purpose; the
	 * Army Standard Metro block below is the one that can catch a small error.
	 */
	const table = federalTable(federalProfile, null);

	it('matches published velocity within 1 %', () => {
		expectWithin(table, 'velocityFps', (v) => v * 0.01);
	});

	it('matches published energy within 2 %', () => {
		expectWithin(table, 'energyFtLb', (v) => v * 0.02);
	});

	it('matches published trajectory within 0.1 in + 1 %', () => {
		expectWithin(table, 'trajectoryIn', (v) => 0.1 + Math.abs(v) * 0.01);
	});

	it('matches published 10 mph wind drift within 0.1 in + 3 %', () => {
		expectWithin(table, 'windDriftIn', (v) => 0.1 + v * 0.03);
	});
});

describe('Federal GM308M, Army Standard Metro hypothesis, G1', () => {
	/**
	 * With this atmosphere the two solvers agree to about the published rounding, so the
	 * bands are close to it: 2 fps, 0.5 % energy, 0.1 in trajectory, 0.2 in wind drift (the
	 * wind column is the noisiest in the table). A 0.5 % change of BC breaks these.
	 */
	const table = federalTable(federalProfile, ARMY_STANDARD_METRO);

	it('matches published velocity within 2 fps', () => {
		expectWithin(table, 'velocityFps', () => 2);
	});

	it('matches published energy within 0.5 %', () => {
		expectWithin(table, 'energyFtLb', (v) => v * 0.005);
	});

	it('matches published trajectory within 0.1 in', () => {
		expectWithin(table, 'trajectoryIn', () => 0.1);
	});

	it('matches published 10 mph wind drift within 0.2 in', () => {
		expectWithin(table, 'windDriftIn', () => 0.2);
	});

	it('fits the table better than ICAO on every series', () => {
		const icao = federalTable(federalProfile, null);
		for (const field of ['velocityFps', 'energyFtLb', 'trajectoryIn', 'windDriftIn']) {
			expect(largestGap(table, field), field).toBeLessThan(largestGap(icao, field));
		}
	});
});

describe('Federal GM308M zero distance', () => {
	/**
	 * The page text says the rifle is zeroed at 100 yd, but +2.1 in at 100 yd cannot be a
	 * 100 yd zero. These tests settle it from the numbers rather than from the text.
	 */
	const trajectoryGap = (zeroDist) =>
		largestGap(federalTable({ ...federalProfile, zeroDist }, null), 'trajectoryIn');

	it('fits a 200 yd zero', () => {
		expect(trajectoryGap(200)).toBeLessThanOrEqual(0.5);
	});

	it('does not fit a 100 yd zero', () => {
		const table = federalTable({ ...federalProfile, zeroDist: 100 }, null);
		expect(Math.abs(table[100].trajectoryIn)).toBeLessThan(0.01);
		expect(table[100].trajectoryIn - FEDERAL.trajectoryIn[100]).toBeLessThan(-2);
		expect(table[300].trajectoryIn - FEDERAL.trajectoryIn[300]).toBeLessThan(-6);
		expect(trajectoryGap(100)).toBeGreaterThan(10);
	});

	it('finds 200 yd as the best fit among zeros from 100 to 300 yd', () => {
		const zeros = Array.from({ length: 21 }, (_, i) => 100 + i * 10);
		const best = zeros.reduce((a, b) => (trajectoryGap(b) < trajectoryGap(a) ? b : a));
		expect(best).toBe(200);
	});
});

describe('Federal GM308M, G7 input', () => {
	/**
	 * Recorded disagreement, not a pass. The page lists G7 .224 next to G1 .462, but its table
	 * follows the G1 number. With G7 .224 the app is 43 fps (2.4 %) below the published 500 yd
	 * velocity under ICAO, and 29 fps under Army Standard Metro, outside every band above.
	 * Two single BCs for one bullet do not describe the same drag curve, so this says nothing
	 * about whether the G7 path is right, only that this table cannot check it.
	 */
	const g7Profile = { ...federalProfile, bcType: 'G7', bc: String(FEDERAL.inputs.bcG7) };

	it('fits worse than G1, so the table was computed from the G1 value', () => {
		for (const atmosphere of [null, ARMY_STANDARD_METRO]) {
			const g1 = federalTable(federalProfile, atmosphere);
			const g7 = federalTable(g7Profile, atmosphere);
			expect(largestGap(g7, 'velocityFps')).toBeGreaterThan(largestGap(g1, 'velocityFps'));
			expect(largestGap(g7, 'windDriftIn')).toBeGreaterThan(largestGap(g1, 'windDriftIn'));
		}
	});

	it.todo('check the G7 drag path against a table published for a G7 BC');
});

// ── Source B: Lapua .223 Rem 55 gr FMJ 4315042 ──────────────────────────────

/**
 * Lower confidence: these figures came through a partly garbled text extraction of the page.
 * Only the velocities are used. Atmosphere: not stated on the page.
 */
const LAPUA = {
	source: 'Lapua .223 Rem 55 gr FMJ, product 4315042',
	url: 'https://lapua.com/product/223-rem-target-hunting-cartridge-fmj-36g-55gr-4315042',
	retrieved: '2026-11-04',
	inputs: { velocityMps: 955, bcG1: 0.255 },
	velocityMps: { 100: 828, 200: 712, 300: 606, 600: 362 }
};

describe('Lapua 4315042, standard (ICAO) atmosphere, G1', () => {
	// Sight height and zero are not published. They do not affect these velocities beyond
	// noise, so any plausible value serves.
	const profile = {
		...federalProfile,
		zeroDist: 100,
		zeroUnit: 'm',
		bulletDiameter: '0.224',
		bulletWeight: '55',
		bc: String(LAPUA.inputs.bcG1),
		velocity: String(LAPUA.inputs.velocityMps),
		velocityUnit: 'mps'
	};
	const rows = calculateFullTrajectory(profile, { distance: 600, unit: 'm', step: 100 }, null, null)
		.trajectory;

	// 1 m/s: the 0.5 m/s rounding of the published figures, plus 0.5 m/s between solvers.
	// The 600 m point is below Mach 1.1, so it also exercises the transonic part of G1.
	it.each(Object.entries(LAPUA.velocityMps))('matches published velocity at %s m', (d, v) => {
		const row = rows.find((p) => Math.round(p.distance.In(Unit.Meter)) === Number(d));
		expect(Math.abs(row.velocity.In(Unit.MPS) - v)).toBeLessThanOrEqual(1);
	});
});
