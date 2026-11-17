/**
 * Export all profiles (#166): the `zro-profiles` envelope, its file name, and the download that the
 * single export (#149) shares.
 */
import { describe, it, expect, vi, afterEach } from 'vitest';
import {
	ALL_PROFILES_EXPORT_FALLBACK_NAME,
	DOWNLOAD_URL_LIFETIME_MS,
	allProfilesExportFile,
	allProfilesExportFileName,
	buildAllProfilesExport,
	downloadAllProfiles,
	downloadProfile,
	profileExportJson
} from '#lib/utils/profileExport.js';

const DATE = new Date('2026-11-17T09:30:00.000Z');
const A = { id: 'a', name: 'K31', bc: '0.5' };
const B = { id: 'b', name: 'M4', bc: 'x' };

describe('buildAllProfilesExport', () => {
	it('wraps the profiles as stored in the zro-profiles envelope', () => {
		expect(buildAllProfilesExport([A, B], DATE)).toEqual({
			format: 'zro-profiles',
			version: 1,
			exportedAt: '2026-11-17T09:30:00.000Z',
			profiles: [A, B]
		});
	});

	it('writes each profile as the single export does', () => {
		const single = JSON.parse(profileExportJson(A, DATE)).profile;
		expect(JSON.parse(allProfilesExportFile([A], DATE).content).profiles[0]).toEqual(single);
	});

	it('leaves out entries that are not objects, and reads a damaged list as empty', () => {
		expect(buildAllProfilesExport([A, null, 'x', [1]], DATE).profiles).toEqual([A]);
		expect(buildAllProfilesExport('x', DATE).profiles).toEqual([]);
	});

	it('writes exportedAt null for a date that is not valid', () => {
		expect(buildAllProfilesExport([A], new Date('nope')).exportedAt).toBeNull();
	});
});

describe('allProfilesExportFileName', () => {
	it('uses the local date', () => {
		expect(allProfilesExportFileName(new Date(2026, 0, 5, 23, 59))).toBe('zro-profiles-2026-01-05.json');
		expect(allProfilesExportFileName(new Date(2026, 11, 31, 0, 1))).toBe('zro-profiles-2026-12-31.json');
	});

	it('falls back for a date that is not valid', () => {
		expect(allProfilesExportFileName(new Date('nope'))).toBe(ALL_PROFILES_EXPORT_FALLBACK_NAME);
		expect(allProfilesExportFileName(/** @type {any} */ ('2026-01-01'))).toBe(ALL_PROFILES_EXPORT_FALLBACK_NAME);
	});
});

describe('allProfilesExportFile', () => {
	it('gives JSON with a final line break, the name and the type', () => {
		const file = allProfilesExportFile([A, B], DATE);
		expect(file.type).toBe('application/json');
		expect(file.filename).toMatch(/^zro-profiles-\d{4}-\d{2}-\d{2}\.json$/);
		expect(file.content.endsWith('}\n')).toBe(true);
		expect(JSON.parse(file.content).profiles).toHaveLength(2);
	});

	it('gives no file without profiles or for a profile that cannot be JSON', () => {
		expect(allProfilesExportFile([], DATE)).toBeNull();
		expect(allProfilesExportFile([{ id: 'c', n: 1n }], DATE)).toBeNull();
	});
});

describe('downloads', () => {
	afterEach(() => vi.restoreAllMocks());

	function stubDownload() {
		const clicks = [];
		URL.createObjectURL = vi.fn(() => 'blob:x');
		URL.revokeObjectURL = vi.fn();
		vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(function () {
			clicks.push(this.download);
		});
		return clicks;
	}

	it('downloads all profiles under the dated name', () => {
		vi.useFakeTimers();
		try {
			const clicks = stubDownload();
			expect(downloadAllProfiles([A], new Date(2026, 10, 17))).toBe(true);
			expect(clicks).toEqual(['zro-profiles-2026-11-17.json']);
			// Revoked later, not at once, so the download can start (security review of #166).
			expect(URL.revokeObjectURL).not.toHaveBeenCalled();
			vi.advanceTimersByTime(DOWNLOAD_URL_LIFETIME_MS);
			expect(URL.revokeObjectURL).toHaveBeenCalledWith('blob:x');
		} finally {
			vi.useRealTimers();
		}
	});

	it('downloads one profile under its name', () => {
		const clicks = stubDownload();
		expect(downloadProfile(A, DATE)).toBe(true);
		expect(clicks).toEqual(['zro-profile-K31.json']);
	});

	it('downloads nothing without a profile', () => {
		const clicks = stubDownload();
		expect(downloadAllProfiles([], DATE)).toBe(false);
		expect(downloadProfile(undefined, DATE)).toBe(false);
		expect(clicks).toEqual([]);
	});
});
