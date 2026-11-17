/**
 * Wind presets of the Scope View (#148, owner decision): None, Light and Strong, in the speed unit
 * shown. The same winds as the dope cards' light and strong wind in metric (3.5 and 9 m/s); in mph
 * they are those speeds converted and rounded to 0.1 (7.8 and 20.1). A preset sets the speed only.
 */

/** @typedef {'none'|'light'|'strong'} WindPreset */

/** Preset speeds as the box shows them, per speed unit. The Scope View has mph and m/s only. */
export const WIND_PRESETS = Object.freeze({
	mps: Object.freeze({ none: '0', light: '3.5', strong: '9' }),
	mph: Object.freeze({ none: '0', light: '7.8', strong: '20.1' })
});

/** The preset table of a speed unit: `mps`, or else mph, as shotWinds reads the unit. */
const presetsFor = (speedUnit) => (speedUnit === 'mps' ? WIND_PRESETS.mps : WIND_PRESETS.mph);

/**
 * The speed text a preset sets, in the given unit, or null for anything that is not a preset.
 * @param {unknown} preset
 * @param {unknown} speedUnit
 * @returns {string|null}
 */
export function windPresetSpeed(preset, speedUnit) {
	const presets = presetsFor(speedUnit);
	return typeof preset === 'string' && Object.prototype.hasOwnProperty.call(presets, preset)
		? presets[preset]
		: null;
}

/**
 * The preset whose speed equals the speed shown, in its unit, or null. The speed must be a plain
 * number as the box reads it (`3.5`, `3,5`, `3.50`): an empty or damaged box marks no chip.
 *
 * @param {unknown} speed
 * @param {unknown} speedUnit
 * @returns {WindPreset|null}
 */
export function activeWindPreset(speed, speedUnit) {
	if (typeof speed !== 'string' && typeof speed !== 'number') return null;
	const text = String(speed).trim().replace(',', '.');
	if (!/^[+]?(?:\d+(?:\.\d*)?|\.\d+)$/.test(text)) return null;
	const value = Number(text);
	const presets = presetsFor(speedUnit);
	const match = Object.entries(presets).find(([, preset]) => Number(preset) === value);
	return match ? /** @type {WindPreset} */ (match[0]) : null;
}
