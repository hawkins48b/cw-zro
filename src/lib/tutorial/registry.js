/**
 * The tutorials of the 3D ballistic tutorial page (#182), and their format. Each tutorial is a
 * data file in ./tutorials/ (one per child issue of epic #180), added to TUTORIALS below. Nothing
 * here imports three.js: the page loads the scene (./scene.js) on its own.
 *
 * Text is never in the file: a step names its message keys, which must exist in messages/en.json,
 * fr.json and de.json (tutorialRegistry.test.js checks them).
 */
import sceneTour from './tutorials/sceneTour.js';

/** The camera presets of the scene (TutorialScene's chips). */
export const CAMERA_PRESETS = Object.freeze(['shooter', 'optic', 'side', 'target']);

/**
 * Points a step's pose is relative to: the shooter's line of sight origin, the rifle (its bolt face),
 * the optic, the muzzle, the aim point (centre of the target face).
 */
export const POSE_ANCHORS = Object.freeze(['shooter', 'rifle', 'optic', 'muzzle', 'target']);

/** Models a step can highlight. `optic` is the scope or the holographic sight, whichever is shown. */
export const HIGHLIGHT_MODELS = Object.freeze(['rifle', 'optic', 'target', 'sandbag']);

/** Values a step can show over the scene (the page formats them). */
export const STEP_VALUES = Object.freeze(['distance', 'slope', 'wind', 'drop', 'windage', 'time']);

/** Actions a step can run when it opens. */
export const STEP_ACTIONS = Object.freeze(['fire']);

/**
 * @typedef {object} TutorialStep
 * @property {string} id - unique in its tutorial
 * @property {string} titleKey - message key of the step title
 * @property {string} textKey - message key of the text; a blank line (\n\n) starts a paragraph
 * @property {'shooter'|'optic'|'side'|'target'} [camera] - a camera preset
 * @property {{ anchor: string, offset: [number, number, number], fov?: number }} [pose] - instead of
 *   `camera`: the camera at `offset` metres from the anchor (POSE_ANCHORS), looking at it. A step
 *   with neither leaves the camera where it is.
 * @property {{ model: string, node?: string }} [highlight] - a model (HIGHLIGHT_MODELS) or one of its
 *   named nodes (docs/development.md#tutorial-models) glows while the step is open
 * @property {string[]} [values] - STEP_VALUES shown over the scene
 * @property {'fire'} [action] - run when the step opens
 */

/**
 * @typedef {object} Tutorial
 * @property {string} id - unique, kebab-case
 * @property {string} titleKey
 * @property {string} descKey
 * @property {TutorialStep[]} steps - at least one
 */

/** @type {readonly Tutorial[]} */
export const TUTORIALS = Object.freeze([sceneTour]);

/**
 * The tutorial with this id, or null.
 * @param {string} id
 * @returns {Tutorial|null}
 */
export function findTutorial(id) {
	return TUTORIALS.find((t) => t.id === id) ?? null;
}

const isFiniteTriple = (v) => Array.isArray(v) && v.length === 3 && v.every((n) => Number.isFinite(n));

/**
 * What is wrong with a tutorial's format, as text for the tests: an empty list when it is fine.
 * Message keys are checked by the test against the catalogs.
 *
 * @param {Tutorial} tutorial
 * @returns {string[]}
 */
export function tutorialProblems(tutorial) {
	const problems = [];
	if (!tutorial || typeof tutorial !== 'object') return ['not an object'];
	if (typeof tutorial.id !== 'string' || !/^[a-z0-9]+(-[a-z0-9]+)*$/.test(tutorial.id)) problems.push('id');
	for (const key of ['titleKey', 'descKey']) {
		if (typeof tutorial[key] !== 'string' || tutorial[key] === '') problems.push(key);
	}
	if (!Array.isArray(tutorial.steps) || tutorial.steps.length === 0) return [...problems, 'steps'];
	const ids = new Set();
	tutorial.steps.forEach((step, i) => {
		const at = `step ${i + 1}`;
		if (typeof step.id !== 'string' || step.id === '' || ids.has(step.id)) problems.push(`${at}: id`);
		ids.add(step.id);
		for (const key of ['titleKey', 'textKey']) {
			if (typeof step[key] !== 'string' || step[key] === '') problems.push(`${at}: ${key}`);
		}
		if (step.camera !== undefined && !CAMERA_PRESETS.includes(step.camera)) problems.push(`${at}: camera`);
		if (step.pose !== undefined) {
			if (step.camera !== undefined) problems.push(`${at}: camera and pose`);
			if (!POSE_ANCHORS.includes(step.pose?.anchor) || !isFiniteTriple(step.pose?.offset)) problems.push(`${at}: pose`);
			if (step.pose?.fov !== undefined && !(step.pose.fov > 0 && step.pose.fov < 180)) problems.push(`${at}: pose fov`);
		}
		if (step.highlight !== undefined) {
			const h = step.highlight;
			if (!HIGHLIGHT_MODELS.includes(h?.model) || (h.node !== undefined && (typeof h.node !== 'string' || h.node === ''))) {
				problems.push(`${at}: highlight`);
			}
		}
		if (step.values !== undefined && (!Array.isArray(step.values) || !step.values.every((v) => STEP_VALUES.includes(v)))) {
			problems.push(`${at}: values`);
		}
		if (step.action !== undefined && !STEP_ACTIONS.includes(step.action)) problems.push(`${at}: action`);
	});
	return problems;
}

/**
 * The message keys a tutorial uses, for the catalog check.
 * @param {Tutorial} tutorial
 * @returns {string[]}
 */
export function tutorialMessageKeys(tutorial) {
	return [tutorial.titleKey, tutorial.descKey, ...tutorial.steps.flatMap((s) => [s.titleKey, s.textKey])];
}
