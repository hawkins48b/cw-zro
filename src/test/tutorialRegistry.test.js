/**
 * The tutorials of the 3D tutorial player (#182): every registered tutorial has the step format of
 * registry.js, its message keys exist in en, fr and de, and the format check catches mistakes, so
 * the child issues (#183-#192) can add a file and rely on this test.
 */
import { describe, it, expect } from 'vitest';
import { readFileSync, readdirSync } from 'fs';
import path from 'path';
import {
	TUTORIALS,
	findTutorial,
	tutorialMessageKeys,
	tutorialProblems
} from '#lib/tutorial/registry.js';

const catalog = (lang) => JSON.parse(readFileSync(path.join(process.cwd(), 'messages', `${lang}.json`), 'utf8'));
const CATALOGS = { en: catalog('en'), fr: catalog('fr'), de: catalog('de') };

describe('registered tutorials', () => {
	it('starts with the Scene tour, 5 steps', () => {
		expect(TUTORIALS[0].id).toBe('scene-tour');
		expect(TUTORIALS[0].steps.map((s) => s.id)).toEqual(['rifle', 'optic', 'target', 'wind', 'fire']);
		expect(findTutorial('scene-tour')).toBe(TUTORIALS[0]);
		expect(findTutorial('nope')).toBeNull();
	});

	it('lists every file of tutorials/', () => {
		const files = readdirSync(path.join(process.cwd(), 'src/lib/tutorial/tutorials')).filter((f) => f.endsWith('.js'));
		expect(files.length).toBe(TUTORIALS.length);
	});

	it.each(TUTORIALS.map((t) => [t.id, t]))('%s has the step format', (_, tutorial) => {
		expect(tutorialProblems(tutorial)).toEqual([]);
	});

	it.each(TUTORIALS.map((t) => [t.id, t]))('%s has its messages in en, fr and de', (_, tutorial) => {
		for (const key of tutorialMessageKeys(tutorial)) {
			for (const [lang, messages] of Object.entries(CATALOGS)) {
				expect(typeof messages[key], `${key} in ${lang}`).toBe('string');
				expect(messages[key].trim(), `${key} in ${lang}`).not.toBe('');
			}
		}
	});

	it('has unique ids', () => {
		expect(new Set(TUTORIALS.map((t) => t.id)).size).toBe(TUTORIALS.length);
	});
});

describe('tutorialProblems', () => {
	const good = {
		id: 'x-y',
		titleKey: 't',
		descKey: 'd',
		steps: [{ id: 'a', titleKey: 'a', textKey: 'a', camera: 'side', highlight: { model: 'optic', node: 'elevation-turret' }, values: ['drop'], action: 'fire' }]
	};
	const withStep = (patch) => ({ ...good, steps: [{ ...good.steps[0], ...patch }] });

	it('accepts a good tutorial and a step with a pose', () => {
		expect(tutorialProblems(good)).toEqual([]);
		const { camera, ...rest } = good.steps[0];
		expect(tutorialProblems({ ...good, steps: [{ ...rest, pose: { anchor: 'muzzle', offset: [1, 0, 0], fov: 30 } }] })).toEqual([]);
	});

	it.each([
		['no steps', { ...good, steps: [] }, 'steps'],
		['a bad id', { ...good, id: 'Scene Tour' }, 'id'],
		['no title', { ...good, titleKey: '' }, 'titleKey'],
		['a camera that is not one', withStep({ camera: 'drone' }), 'step 1: camera'],
		['a camera and a pose', withStep({ pose: { anchor: 'rifle', offset: [0, 0, 1] } }), 'step 1: camera and pose'],
		['a pose without offset', withStep({ camera: undefined, pose: { anchor: 'rifle' } }), 'step 1: pose'],
		['a highlight of another model', withStep({ highlight: { model: 'car' } }), 'step 1: highlight'],
		['a value that is not one', withStep({ values: ['speed'] }), 'step 1: values'],
		['an action that is not one', withStep({ action: 'reload' }), 'step 1: action'],
		['no text key', withStep({ textKey: undefined }), 'step 1: textKey']
	])('reports %s', (_, tutorial, problem) => {
		expect(tutorialProblems(/** @type {any} */ (tutorial))).toContain(problem);
	});

	it('reports a step id used twice', () => {
		expect(tutorialProblems({ ...good, steps: [good.steps[0], good.steps[0]] })).toContain('step 2: id');
	});
});
