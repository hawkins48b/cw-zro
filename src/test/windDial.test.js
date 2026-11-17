/** Wind dial pointer input (#155): the rim snaps to 15°, the inside sets whole degrees. Display only. */
import { describe, it, expect } from 'vitest';
import { dialDirection, DIAL_SNAP_RIM } from '#lib/utils/windDirection.js';

const R = 100;

/** Offset at `deg` (0 up, clockwise) and distance `r` from the centre, screen y down. */
function at(deg, r) {
	const a = (deg * Math.PI) / 180;
	return [r * Math.sin(a), -r * Math.cos(a)];
}

describe('dialDirection', () => {
	it.each([
		[0, 0],
		[90, 90],
		[180, 180],
		[270, 270],
		[37, 37],
		[37.4, 37],
		[359.6, 0]
	])('inside the rim, %s° gives %s°', (deg, expected) => {
		expect(dialDirection(...at(deg, 40), R)).toBe(expected);
	});

	it.each([
		[0, 0],
		[7.4, 0],
		[7.6, 15],
		[37, 30],
		[38, 45],
		[100, 105],
		[352.6, 0],
		[351, 345]
	])('on the rim, %s° snaps to %s°', (deg, expected) => {
		expect(dialDirection(...at(deg, 86), R)).toBe(expected);
	});

	it('snaps from the rim edge outwards, also past the dial', () => {
		expect(dialDirection(...at(37, DIAL_SNAP_RIM * R), R)).toBe(30);
		expect(dialDirection(...at(37, DIAL_SNAP_RIM * R - 0.5), R)).toBe(37);
		expect(dialDirection(...at(37, 130), R)).toBe(30);
	});

	it('gives 0 at the centre', () => {
		expect(dialDirection(0, 0, R)).toBe(0);
	});
});
