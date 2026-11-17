/**
 * Profile export (#149): the JSON envelope and the file name. localStorage can hold any JSON value
 * (#120), so a damaged profile must give no file or a safe one, never throw.
 */
import { describe, it, expect } from 'vitest';
import {
	MAX_FILENAME_NAME_LENGTH,
	PROFILE_EXPORT_FALLBACK_NAME,
	PROFILE_EXPORT_FORMAT,
	PROFILE_EXPORT_TYPE,
	PROFILE_EXPORT_VERSION,
	filenamePart,
	profileExportFile,
	profileExportFilename,
	profileExportJson
} from '#lib/utils/profileExport.js';
import { normalizeProfiles } from '#lib/utils/storedProfiles.js';

const DATE = new Date('2026-11-16T09:30:00.000Z');

const makeProfile = (overrides = {}) => ({
	id: 'a1b2',
	name: 'Remington 700',
	ammo: 'Sierra 168\u202fgr',
	opticName: 'Vortex Razor',
	zeroDist: 100,
	zeroUnit: 'yd',
	bc: '0.462',
	spinDrift: true,
	...overrides
});

describe('profileExportJson', () => {
	it('wraps the profile in the zro-profile envelope', () => {
		const profile = makeProfile();
		const parsed = JSON.parse(profileExportJson(profile, DATE));
		expect(parsed).toEqual({
			format: 'zro-profile',
			version: 1,
			exportedAt: '2026-11-16T09:30:00.000Z',
			profile
		});
		expect(PROFILE_EXPORT_FORMAT).toBe('zro-profile');
		expect(PROFILE_EXPORT_VERSION).toBe(1);
	});

	it('keeps the profile as stored, id included, with field order and value types', () => {
		const profile = makeProfile({ zeroDist: '100', extra: { nested: [1, 'x'] } });
		const parsed = JSON.parse(profileExportJson(profile, DATE));
		expect(parsed.profile.id).toBe('a1b2');
		expect(parsed.profile.zeroDist).toBe('100');
		expect(Object.keys(parsed.profile)).toEqual(Object.keys(profile));
		expect(parsed.profile.extra).toEqual({ nested: [1, 'x'] });
	});

	it('is pretty JSON with a final line break', () => {
		const text = profileExportJson(makeProfile(), DATE);
		expect(text.startsWith('{\n  "format": "zro-profile",\n')).toBe(true);
		expect(text.endsWith('}\n')).toBe(true);
	});

	it('does not change the profile it is given', () => {
		const profile = makeProfile();
		const copy = structuredClone(profile);
		profileExportJson(profile, DATE);
		expect(profile).toEqual(copy);
	});

	it.each([
		['undefined', undefined],
		['null', null],
		['a number', 1],
		['text', 'profile'],
		['a list', [makeProfile()]],
		['true', true]
	])('gives no file for %s', (_label, value) => {
		expect(profileExportJson(value, DATE)).toBeNull();
		expect(profileExportFile(value, DATE)).toBeNull();
	});

	it('writes damaged stored values as stored, without throwing', () => {
		const stored = JSON.parse(
			'{"id":"x","name":{"toString":1},"zeroDist":null,"bc":[1,2],"velocity":{"a":1},"spinDrift":"yes"}'
		);
		const parsed = JSON.parse(profileExportJson(stored, DATE));
		expect(parsed.profile).toEqual(stored);
	});

	it('exports a profile as the store reads it from a damaged list', () => {
		const [profile] = normalizeProfiles([{ id: 7, name: 42 }, 'junk', null]);
		const parsed = JSON.parse(profileExportJson(profile, DATE));
		expect(parsed.profile).toEqual({ id: '7', name: 42 });
	});

	it('writes exportedAt null for a date that is not valid', () => {
		for (const date of [new Date('nope'), undefined, null, '2026-11-16', 0]) {
			expect(JSON.parse(profileExportJson(makeProfile(), /** @type {any} */ (date))).exportedAt).toBeNull();
		}
	});

	it('gives no file for a profile that cannot be written as JSON', () => {
		const circular = makeProfile();
		circular.self = circular;
		expect(profileExportJson(circular, DATE)).toBeNull();
		expect(profileExportJson(makeProfile({ big: 1n }), DATE)).toBeNull();
	});
});

describe('profileExportFile', () => {
	it('gives the file name, the JSON and its type', () => {
		const file = profileExportFile(makeProfile(), DATE);
		expect(file).toEqual({
			filename: 'zro-profile-Remington-700.json',
			content: profileExportJson(makeProfile(), DATE),
			type: 'application/json'
		});
		expect(PROFILE_EXPORT_TYPE).toBe('application/json');
	});

	it('falls back to zro-profile.json for a profile without a usable name', () => {
		expect(profileExportFile({ id: 'x' }, DATE).filename).toBe('zro-profile.json');
		expect(profileExportFile({ id: 'x', name: { a: 1 } }, DATE).filename).toBe('zro-profile.json');
	});
});

describe('profileExportFilename', () => {
	it.each([
		['Remington 700', 'zro-profile-Remington-700.json'],
		['Tikka T3x  .308 Win', 'zro-profile-Tikka-T3x-308-Win.json'],
		['Carabine fédérale Ç', 'zro-profile-Carabine-fédérale-Ç.json'],
		['Großkaliber_Ü', 'zro-profile-Großkaliber_Ü.json'],
		['Sierra 168\u202fgr', 'zro-profile-Sierra-168-gr.json'],
		['  --My rifle--  ', 'zro-profile-My-rifle.json'],
		['a---b', 'zro-profile-a-b.json'],
		['__x__', 'zro-profile-x.json'],
		[308, 'zro-profile-308.json']
	])('%j gives %j', (name, filename) => {
		expect(profileExportFilename(name)).toBe(filename);
	});

	it.each([
		['empty', ''],
		['spaces', '   '],
		['only symbols', '!!!***'],
		['only dots', '...'],
		['only emoji', '🎯🔫'],
		['undefined', undefined],
		['null', null],
		['an object', { toString: () => 'x' }],
		['a list', ['a']],
		['true', true]
	])('falls back to zro-profile.json for %s', (_label, name) => {
		expect(profileExportFilename(name)).toBe(PROFILE_EXPORT_FALLBACK_NAME);
	});

	it('removes path characters, so the name cannot leave the download folder', () => {
		for (const name of ['../../etc/passwd', '..\\..\\Windows\\win.ini', 'C:\\x', '/abs/path', '~/x']) {
			const filename = profileExportFilename(name);
			expect(filename).not.toMatch(/[\/\\:~]/);
			expect(filename).not.toContain('..');
			expect(filename.startsWith('zro-profile')).toBe(true);
		}
		expect(profileExportFilename('../../etc/passwd')).toBe('zro-profile-etc-passwd.json');
	});

	it('has no extension but .json and no leading dot', () => {
		expect(profileExportFilename('.bashrc')).toBe('zro-profile-bashrc.json');
		expect(profileExportFilename('evil.exe')).toBe('zro-profile-evil-exe.json');
		expect(profileExportFilename('x.json.lnk')).toBe('zro-profile-x-json-lnk.json');
	});

	it('removes characters Windows refuses in file names', () => {
		const filename = profileExportFilename('a<b>c:d"e|f?g*h');
		expect(filename).toBe('zro-profile-a-b-c-d-e-f-g-h.json');
	});

	it('removes control characters, line breaks and bidirectional overrides', () => {
		expect(profileExportFilename('a\u0000b\u0007c\td\ne\rf')).toBe('zro-profile-a-b-c-d-e-f.json');
		// U+202E would show "zro-profile-txt.exe" as "...exe.txt" in a file manager.
		expect(profileExportFilename('abc\u202Etxt.exe')).toBe('zro-profile-abc-txt-exe.json');
		expect(profileExportFilename('a\u200Bb\uFEFFc')).toBe('zro-profile-a-b-c.json');
	});

	it('never gives a reserved Windows base name', () => {
		for (const name of ['CON', 'nul', 'COM1', 'LPT9', 'PRN', 'AUX']) {
			expect(profileExportFilename(name)).toBe(`zro-profile-${name}.json`);
		}
	});

	it('joins a decomposed accent to its letter (NFC)', () => {
		expect(profileExportFilename('Fe\u0301de\u0301ral')).toBe('zro-profile-Fédéral.json');
	});

	it(`cuts the name part to ${MAX_FILENAME_NAME_LENGTH} characters and trims it again`, () => {
		expect(filenamePart('a'.repeat(200))).toBe('a'.repeat(MAX_FILENAME_NAME_LENGTH));
		expect(filenamePart(`${'a'.repeat(59)} b`)).toBe('a'.repeat(59));
		expect(filenamePart('é'.repeat(80))).toBe('é'.repeat(MAX_FILENAME_NAME_LENGTH));
	});

	it('never splits a character that takes two code units', () => {
		const name = '𝐀'.repeat(70); // U+1D400, a letter outside the BMP
		const part = filenamePart(name);
		expect(Array.from(part)).toHaveLength(MAX_FILENAME_NAME_LENGTH);
		expect(part).toBe('𝐀'.repeat(MAX_FILENAME_NAME_LENGTH));
	});

	it('is quick on a long run of separators', () => {
		const start = performance.now();
		const name = `a${'-'.repeat(200_000)}b${'_'.repeat(200_000)}`;
		expect(filenamePart(name)).toBe('a');
		expect(performance.now() - start).toBeLessThan(200);
	});

	it('only ever gives letters, marks, digits, - and _ in the name part', () => {
		const samples = ['x/y\\z', 'a b\tc', '🎯 rifle', 'name.with.dots', '%2e%2e%2f', '$(rm -rf)', '`x`'];
		for (const name of samples) {
			const part = filenamePart(name);
			expect(part).toMatch(/^[\p{L}\p{M}\p{N}_-]*$/u);
			expect(part).not.toMatch(/^[-_]|[-_]$/);
		}
	});
});
