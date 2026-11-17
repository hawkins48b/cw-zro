/**
 * Profile import (#166): reading `zro-profile` and `zro-profiles` files, refusing bad files with a
 * reason code, rebuilding each profile from the form's fields (never trusted as stored), new ids and
 * copy names.
 */
import { describe, it, expect } from 'vitest';
import {
	IMPORT_REASONS,
	MAX_IMPORT_FILE_BYTES,
	MAX_IMPORT_FILENAME_LENGTH,
	MAX_IMPORT_NUMBER_LENGTH,
	MAX_IMPORT_PROFILES,
	isImportFileTooLarge,
	parseProfileFile,
	planImport,
	readImportedProfile,
	uniqueCopyName
} from '#lib/utils/profileImport.js';
import { allProfilesExportFile, profileExportJson } from '#lib/utils/profileExport.js';
import { SAMPLE_PROFILE } from '#lib/utils/sampleProfile.js';
import { MAX_NAME_LENGTH } from '#lib/utils/storedProfiles.js';
import { isValid, validateProfile } from '#lib/utils/profileValidation.js';

const DATE = new Date('2026-11-17T09:30:00.000Z');
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;

const profile = (overrides = {}) => ({ ...SAMPLE_PROFILE, id: 'old-id', ...overrides });
const single = (p) => JSON.stringify({ format: 'zro-profile', version: 1, exportedAt: null, profile: p });
const many = (list) => JSON.stringify({ format: 'zro-profiles', version: 1, exportedAt: null, profiles: list });

describe('parseProfileFile: the two formats', () => {
	it('reads a single profile export of #149', () => {
		const result = parseProfileFile('k31.json', profileExportJson(profile({ name: 'K31' }), DATE));
		expect(result).toMatchObject({ ok: true, fileName: 'k31.json', skipped: 0 });
		expect(result.profiles).toHaveLength(1);
		expect(result.profiles[0].name).toBe('K31');
	});

	it('reads an export of all profiles', () => {
		const file = allProfilesExportFile([profile({ name: 'A' }), profile({ name: 'B', id: 'x' })], DATE);
		const result = parseProfileFile(file.filename, file.content);
		expect(result.ok).toBe(true);
		expect(result.profiles.map((p) => p.name)).toEqual(['A', 'B']);
	});

	it('gives profiles without the id of the file', () => {
		const result = parseProfileFile('f', single(profile()));
		expect(result.profiles[0]).not.toHaveProperty('id');
	});

	it('stores a profile as the profile form does: valid, ammo and optic text rebuilt', () => {
		const result = parseProfileFile('f', single(profile({ ammo: 'something else', optic: 'x' })));
		const p = result.profiles[0];
		expect(p.ammo).toBe('M193 55 gr');
		expect(p.optic).toBe('Aimpoint CompM2');
		expect(isValid(validateProfile(p, p.spinDrift, p.tempSensitivity))).toBe(true);
	});

	it('keeps the sample profile values', () => {
		const p = parseProfileFile('f', single(profile())).profiles[0];
		const { id: _id, ...expected } = profile();
		expect(p).toEqual(expected);
	});
});

describe('parseProfileFile: bad files', () => {
	it.each([
		['not JSON', 'hello', 'not_json'],
		['half a JSON file', '{"format":"zro-profile",', 'not_json'],
		['an empty file', '', 'empty'],
		['only spaces', '  \n\t', 'empty'],
		['a JSON array', '[]', 'unknown_format'],
		['JSON null', 'null', 'unknown_format'],
		['a number', '42', 'unknown_format'],
		['another format', JSON.stringify({ format: 'zro-dope', version: 1 }), 'unknown_format'],
		['no format', JSON.stringify({ version: 1, profile: SAMPLE_PROFILE }), 'unknown_format'],
		['a later single version', JSON.stringify({ format: 'zro-profile', version: 2, profile: SAMPLE_PROFILE }), 'unsupported_version'],
		['a later all version', JSON.stringify({ format: 'zro-profiles', version: 2, profiles: [SAMPLE_PROFILE] }), 'unsupported_version'],
		['a version as text', JSON.stringify({ format: 'zro-profile', version: '1', profile: SAMPLE_PROFILE }), 'unsupported_version'],
		['no version', JSON.stringify({ format: 'zro-profiles', profiles: [SAMPLE_PROFILE] }), 'unsupported_version'],
		['no profile', JSON.stringify({ format: 'zro-profile', version: 1 }), 'no_valid_profiles'],
		['profiles not a list', JSON.stringify({ format: 'zro-profiles', version: 1, profiles: {} }), 'no_valid_profiles'],
		['an empty list', many([]), 'no_valid_profiles'],
		['a profile that is text', single('K31'), 'no_valid_profiles'],
		['a profile with an empty name', single(profile({ name: '  ' })), 'no_valid_profiles']
	])('refuses %s', (_, text, reason) => {
		const result = parseProfileFile('bad.json', text);
		expect(result).toMatchObject({ ok: false, fileName: 'bad.json', reason });
		expect(IMPORT_REASONS).toContain(reason);
	});

	it('refuses text that is not text', () => {
		expect(parseProfileFile('f', null)).toMatchObject({ ok: false, reason: 'not_json' });
	});

	it('refuses a file over the size limit by its size, without reading it', () => {
		expect(isImportFileTooLarge(MAX_IMPORT_FILE_BYTES + 1)).toBe(true);
		expect(isImportFileTooLarge(MAX_IMPORT_FILE_BYTES)).toBe(false);
		expect(isImportFileTooLarge(undefined)).toBe(false);
		expect(parseProfileFile('big', single(profile()), { size: MAX_IMPORT_FILE_BYTES + 1 })).toMatchObject({
			ok: false,
			reason: 'too_large'
		});
	});

	it('refuses a text over the size limit', () => {
		const text = single(profile({ opticName: 'x'.repeat(MAX_IMPORT_FILE_BYTES) }));
		expect(parseProfileFile('big', text)).toMatchObject({ ok: false, reason: 'too_large' });
	});

	it('refuses more than MAX_IMPORT_PROFILES profiles, and reads that many', () => {
		const list = Array.from({ length: MAX_IMPORT_PROFILES }, (_, i) => profile({ name: `P${i}` }));
		expect(parseProfileFile('ok', many(list)).profiles).toHaveLength(MAX_IMPORT_PROFILES);
		expect(parseProfileFile('no', many([...list, profile()]))).toMatchObject({ ok: false, reason: 'too_many_profiles' });
	});

	it('skips the invalid profiles of a file and counts them', () => {
		const result = parseProfileFile('mix', many([profile({ name: 'A' }), 'x', null, profile({ bc: '3' }), profile({ name: 'B' })]));
		expect(result.ok).toBe(true);
		expect(result.profiles.map((p) => p.name)).toEqual(['A', 'B']);
		expect(result.skipped).toBe(3);
	});

	it('counts skipped profiles of a file with none usable', () => {
		expect(parseProfileFile('f', many([{}, profile({ velocity: 'fast' })]))).toMatchObject({
			ok: false,
			reason: 'no_valid_profiles',
			skipped: 2
		});
	});

	it('cuts a long file name and reads a missing one as empty', () => {
		const long = 'a'.repeat(500) + '.json';
		expect(parseProfileFile(long, 'x').fileName).toHaveLength(MAX_IMPORT_FILENAME_LENGTH);
		expect(parseProfileFile(undefined, 'x').fileName).toBe('');
	});
});

describe('readImportedProfile: the same checks as the profile form', () => {
	it.each([
		['BC over 2 (#147)', { bc: '2.01' }],
		['BC under 0.01', { bc: '0.001' }],
		['velocity 10000 fps', { velocity: '10000' }],
		['zero 3001', { zeroDist: 3001 }],
		['sight height 11 in', { opticHeight: '11' }],
		['bullet weight 2001 gr (#125)', { bulletWeight: '2001' }],
		['diameter 2 in', { bulletDiameter: '2' }],
		['a number field holding an array', { bc: ['0.3'] }],
		['a number field holding an object', { velocity: { valueOf: 3000 } }],
		['Infinity as text', { velocity: 'Infinity' }],
		['no optic name', { opticName: undefined }],
		['no bullet', { bulletBrand: null }],
		['spin drift on without twist', { spinDrift: true, barrelTwist: '' }],
		['twist 200 in with spin drift', { spinDrift: true, barrelTwist: '200', bulletLength: '1' }],
		['powder sensitivity without temperature', { tempSensitivity: true, temperature: '', tempModifier: '1' }],
		['click value 0', { elevationClickValue: '0' }]
	])('drops a profile with %s', (_, overrides) => {
		expect(readImportedProfile(profile(overrides))).toBeNull();
	});

	it.each([[null], ['x'], [[profile()]], [42]])('drops %j', (value) => {
		expect(readImportedProfile(value)).toBeNull();
	});

	it('cuts names to the form limit (#141)', () => {
		const p = readImportedProfile(profile({ name: 'N'.repeat(200), opticName: 'O'.repeat(200), bulletBrand: 'B'.repeat(200) }));
		expect(p.name).toHaveLength(MAX_NAME_LENGTH);
		expect(p.opticName).toHaveLength(MAX_NAME_LENGTH);
		expect(p.bulletBrand).toHaveLength(MAX_NAME_LENGTH);
	});

	it('keeps only the form fields: no id, no unknown or __proto__ key', () => {
		const raw = JSON.parse(single(profile()).replace('"name"', '"__proto__":{"polluted":1},"extra":"x","name"')).profile;
		expect(Object.hasOwn(raw, '__proto__')).toBe(true);
		const p = readImportedProfile(raw);
		expect(Object.hasOwn(p, '__proto__')).toBe(false);
		expect(p).not.toHaveProperty('extra');
		expect(p).not.toHaveProperty('id');
		expect(Object.getPrototypeOf(p)).toBe(Object.prototype);
		expect(/** @type {any} */ ({}).polluted).toBeUndefined();
	});

	it('reads units and choices as the calculators read them', () => {
		const p = readImportedProfile(profile({ zeroUnit: 'meters', bcType: 'G7', reticleType: '<b>', elevationClickUnit: 'mrad', clickLink: false, windageClickValue: '0.25' }));
		expect(p.zeroUnit).toBe('yd');
		expect(p.bcType).toBe('G7');
		expect(p.reticleType).toBe('red-dot');
		expect(p.elevationClickUnit).toBe('MOA');
		expect(p.windageClickValue).toBe('0.25');
	});

	it('reads numbers given as numbers and a decimal comma', () => {
		const p = readImportedProfile(profile({ bc: 0.3, velocity: '2900,5' }));
		expect(p.bc).toBe('0.3');
		expect(p.velocity).toBe('2900.5');
	});

	it('drops a number field that is text but not a number when it is not needed', () => {
		const p = readImportedProfile(profile({ tempModifier: 'abc', barrelTwist: '1e400' }));
		expect(p.tempModifier).toBe('');
		expect(p.barrelTwist).toBe('');
	});

	it('reads number text of at most 32 characters, and a longer one as an empty box', () => {
		expect(MAX_IMPORT_NUMBER_LENGTH).toBe(32);
		const at = '0.' + '3'.repeat(30);
		expect(readImportedProfile(profile({ bc: at })).bc).toBe(at);
		expect(readImportedProfile(profile({ bc: at + '3' }))).toBeNull();
		expect(readImportedProfile(profile({ tempModifier: '1' + '0'.repeat(32) })).tempModifier).toBe('');
	});

		it('takes a profile with spin drift and powder sensitivity in limits', () => {
		const p = readImportedProfile(profile({ spinDrift: true, barrelTwist: '7', bulletLength: '0.9', tempSensitivity: true, temperature: '59', tempModifier: '1.2' }));
		expect(p).toMatchObject({ spinDrift: true, tempSensitivity: true, barrelTwist: '7' });
	});
});

describe('uniqueCopyName', () => {
	it('keeps a free name', () => {
		expect(uniqueCopyName('K31', ['Other'])).toBe('K31');
	});

	it('numbers a taken name from 2', () => {
		expect(uniqueCopyName('K31', ['K31'])).toBe('K31 (2)');
		expect(uniqueCopyName('K31', ['K31', 'K31 (2)'])).toBe('K31 (3)');
	});

	it('compares trimmed and without case', () => {
		expect(uniqueCopyName('k31', [' K31 '])).toBe('k31 (2)');
	});

	it('counts on from a copy name', () => {
		expect(uniqueCopyName('K31 (2)', ['K31', 'K31 (2)'])).toBe('K31 (3)');
	});

	it('keeps the suffix within 60 characters', () => {
		const name = 'X'.repeat(MAX_NAME_LENGTH);
		const copy = uniqueCopyName(name, [name]);
		expect(copy).toHaveLength(MAX_NAME_LENGTH);
		expect(copy.endsWith(' (2)')).toBe(true);
		const taken = [name];
		for (let i = 0; i < 9; i++) taken.push(uniqueCopyName(name, taken));
		const tenth = uniqueCopyName(name, taken);
		expect(tenth.endsWith(' (11)')).toBe(true);
		expect(tenth).toHaveLength(MAX_NAME_LENGTH);
	});

	it('does not split a character that takes two code units', () => {
		const name = 'X'.repeat(55) + '🎯🎯';
		const copy = uniqueCopyName(name, [name]);
		expect(copy.length).toBeLessThanOrEqual(MAX_NAME_LENGTH);
		expect(copy).not.toMatch(/[\ud800-\udbff](?![\udc00-\udfff])/);
	});
});

describe('planImport', () => {
	const existing = [{ ...profile({ name: 'K31' }), id: 'a' }];

	it('gives every candidate a new id, never the one of the file', () => {
		const parsed = [parseProfileFile('f', many([profile({ id: 'a' }), profile({ id: 'a' })]))];
		const { candidates } = planImport(existing, parsed);
		expect(candidates).toHaveLength(2);
		for (const c of candidates) {
			expect(c.profile.id).toMatch(UUID);
			expect(c.key).toBe(c.profile.id);
		}
		expect(candidates[0].profile.id).not.toBe(candidates[1].profile.id);
	});

	it('renames a clash with a stored profile and among candidates', () => {
		const parsed = [
			parseProfileFile('one.json', single(profile({ name: 'K31' }))),
			parseProfileFile('all.json', many([profile({ name: 'K31' }), profile({ name: 'New' }), profile({ name: 'new' })]))
		];
		const { candidates } = planImport(existing, parsed);
		expect(candidates.map((c) => [c.profile.name, c.originalName, c.renamed, c.fileName])).toEqual([
			['K31 (2)', 'K31', true, 'one.json'],
			['K31 (3)', 'K31', true, 'all.json'],
			['New', 'New', false, 'all.json'],
			['new (2)', 'new', true, 'all.json']
		]);
	});

	it('mixes both formats and reports the refused files', () => {
		const parsed = [
			parseProfileFile('a.json', single(profile({ name: 'A' }))),
			parseProfileFile('photo.jpg', 'ÿØ'),
			parseProfileFile('b.json', many([profile({ name: 'B' }), { name: 'broken' }]))
		];
		const plan = planImport(existing, parsed);
		expect(plan.candidates.map((c) => c.profile.name)).toEqual(['A', 'B']);
		expect(plan.errors).toEqual([{ fileName: 'photo.jpg', reason: 'not_json' }]);
		expect(plan.skipped).toEqual([{ fileName: 'b.json', count: 1 }]);
	});

	it('reads damaged stored names without throwing', () => {
		const plan = planImport([{ id: 'x', name: { toString: 1 } }, 'junk'], [parseProfileFile('f', single(profile()))]);
		expect(plan.candidates).toHaveLength(1);
	});

	it('caps the import at MAX_IMPORT_PROFILES across files, refusing the file that goes over', () => {
		const file = (n, prefix) =>
			parseProfileFile(`${prefix}.json`, many(Array.from({ length: n }, (_, i) => profile({ name: `${prefix}${i}` }))));
		const plan = planImport([], [file(300, 'a'), file(201, 'b'), file(200, 'c'), parseProfileFile('d.json', single(profile()))]);
		expect(plan.candidates).toHaveLength(MAX_IMPORT_PROFILES);
		expect(plan.errors).toEqual([
			{ fileName: 'b.json', reason: 'too_many_total' },
			{ fileName: 'd.json', reason: 'too_many_total' }
		]);
		expect(IMPORT_REASONS).toContain('too_many_total');
		expect(new Set(plan.candidates.map((c) => c.fileName))).toEqual(new Set(['a.json', 'c.json']));
	});

	it('names 500 profiles of one name quickly and uniquely', () => {
		const list = Array.from({ length: MAX_IMPORT_PROFILES }, () => profile({ name: 'K31' }));
		const start = performance.now();
		const plan = planImport(Array.from({ length: 500 }, (_, i) => ({ id: `s${i}`, name: i ? `K31 (${i + 1})` : 'K31' })), [parseProfileFile('f', many(list))]);
		expect(performance.now() - start).toBeLessThan(1000);
		const names = plan.candidates.map((c) => c.profile.name);
		expect(new Set(names).size).toBe(MAX_IMPORT_PROFILES);
		expect(names[0]).toBe('K31 (501)');
		expect(names.at(-1)).toBe('K31 (1000)');
	});

		it('gives nothing for nothing', () => {
		expect(planImport([], [])).toEqual({ candidates: [], errors: [], skipped: [] });
	});
});
