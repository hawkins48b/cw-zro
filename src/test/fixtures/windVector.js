import { Unit } from 'js-ballistics';

/**
 * The wind vector the engine flies, in fps: x along the range, z across it, y 0. js-ballistics 2.2
 * gave it as Wind.vector; 3.x passes speed and direction to its WebAssembly engine instead (#77), so
 * the tests rebuild it with the same formula.
 *
 * @param {Wind} wind
 * @returns {{ x: number, y: number, z: number }}
 */
export function windVector(wind) {
	const fps = wind.velocity.In(Unit.FPS);
	const rad = wind.directionFrom.In(Unit.Radian);
	return { x: fps * Math.cos(rad), y: 0, z: fps * Math.sin(rad) };
}
