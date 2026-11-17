/**
 * Settings > About, "every included package with its licence" (#166): src/lib/data/licenses.json is
 * generated from package-lock.json by scripts/licenses.js, and must match it, so a dependency update
 * (Dependabot) that forgets it fails here.
 */
import { existsSync, readdirSync, readFileSync } from 'fs';
import { describe, expect, it } from 'vitest';
import {
	ALL_PLATFORMS,
	NOT_SHIPPED,
	buildLicenses,
	formatLicenses,
	packageHomepage,
	resolvePackage
} from '../../scripts/license-rules.js';
import licenses from '#lib/data/licenses.json';

const readJson = (path) => JSON.parse(readFileSync(path, 'utf-8'));
const lock = readJson('package-lock.json');
const pkg = readJson('package.json');
const readManifest = (path) => (existsSync(`${path}/package.json`) ? readJson(`${path}/package.json`) : null);

const FIX = 'src/lib/data/licenses.json is out of date with package-lock.json: run npm run licenses:generate and commit it';

describe('src/lib/data/licenses.json', () => {
	it('matches package-lock.json', () => {
		const expected = formatLicenses(buildLicenses({ lock, pkg, readManifest }));
		expect(readFileSync('src/lib/data/licenses.json', 'utf-8'), FIX).toBe(expected);
	});

	it('lists every shipped dependency, with a licence, a version and platforms', () => {
		const names = licenses.map((p) => p.name);
		for (const name of Object.keys(pkg.dependencies)) {
			if (Object.hasOwn(NOT_SHIPPED, name)) expect(names).not.toContain(name);
			else expect(names, FIX).toContain(name);
		}
		for (const name of ['svelte', '@sveltejs/kit', 'electron', 'bclibc', 'apex-commons', 'pako']) expect(names).toContain(name);
		for (const item of licenses) {
			expect(item.license).not.toBe('UNKNOWN');
			expect(item.version).toMatch(/^\d+\.\d+\.\d+/);
			expect(item.platforms.length).toBeGreaterThan(0);
			for (const p of item.platforms) expect(ALL_PLATFORMS).toContain(p);
			if ('homepage' in item) expect(item.homepage).toMatch(/^https:\/\//);
		}
	});

	it('leaves out build tools and their dependencies', () => {
		const names = licenses.map((p) => p.name);
		for (const name of ['@capacitor/cli', 'native-run', 'vite', 'electron-builder', '@inlang/sdk', 'acorn', 'commander']) {
			expect(names).not.toContain(name);
		}
	});

	it('the packages left out as not imported are still not imported', () => {
		const sources = [...walk('src'), ...walk('electron')].filter((f) => /\.(js|svelte|cjs|mjs)$/.test(f) && !f.startsWith('src/test/'));
		for (const [name, reason] of Object.entries(NOT_SHIPPED)) {
			if (!reason.startsWith('not imported')) continue;
			for (const file of sources) expect(readFileSync(file, 'utf-8'), `${file} imports ${name}`).not.toContain(`'${name}`);
		}
	});
});

/** The files under a folder, without node_modules and the generated paraglide folder. */
function walk(dir) {
	/** @type {string[]} */
	const out = [];
	for (const entry of readdirSync(dir, { withFileTypes: true })) {
		const path = `${dir}/${entry.name}`;
		if (!entry.isDirectory()) out.push(path);
		else if (entry.name !== 'node_modules' && entry.name !== 'paraglide') out.push(...walk(path));
	}
	return out;
}

describe('buildLicenses', () => {
	const lockOf = (packages) => ({ packages: { '': {}, ...packages } });

	it('walks production dependencies, nested folders first, and skips missing optional ones', () => {
		const list = buildLicenses({
			pkg: { dependencies: { 'js-ballistics': '3.1.0', a: '^1' } },
			lock: lockOf({
				'node_modules/js-ballistics': { version: '3.1.0', license: 'ISC' },
				'node_modules/a': { version: '1.0.0', license: 'MIT', dependencies: { b: '^2' }, optionalDependencies: { gone: '1' } },
				'node_modules/a/node_modules/b': { version: '2.0.0', license: 'ISC' },
				'node_modules/b': { version: '1.0.0', license: 'MIT' },
				'node_modules/svelte': { version: '5.0.0', license: 'MIT', dependencies: { acorn: '1', clsx: '2' } },
				'node_modules/acorn': { version: '1.0.0', license: 'MIT' },
				'node_modules/clsx': { version: '2.0.0', license: 'MIT' },
				'node_modules/@sveltejs/kit': { version: '3.0.0', license: 'MIT', dependencies: { devalue: '5' } },
				'node_modules/devalue': { version: '5.0.0', license: 'MIT' },
				'node_modules/@skeletonlabs/skeleton': { version: '5.0.0', license: 'MIT' },
				'node_modules/@skeletonlabs/skeleton-svelte': { version: '5.0.0', license: 'MIT' },
				'node_modules/tailwindcss': { version: '4.0.0', license: 'MIT' },
				'node_modules/electron': { version: '45.0.0', license: 'MIT', dependencies: { '@electron/get': '5' } }
			})
		});
		const ids = list.map((p) => `${p.name}@${p.version}`);
		expect(ids).toContain('b@2.0.0');
		expect(ids).not.toContain('b@1.0.0');
		expect(ids).not.toContain('acorn@1.0.0');
		expect(ids).toContain('clsx@2.0.0');
		expect(ids).toContain('bclibc@2.0.0');
		expect(list.find((p) => p.name === 'electron').platforms).toEqual(['desktop']);
		const names = list.map((p) => p.name);
		expect(names).toEqual([...names].sort());
	});

	it('fails when js-ballistics moved, so the embedded bclibc entry is checked again', () => {
		const base = {
			'node_modules/svelte': { version: '5.0.0', license: 'MIT', dependencies: {} },
			'node_modules/clsx': { version: '2.0.0', license: 'MIT' },
			'node_modules/@sveltejs/kit': { version: '3.0.0', license: 'MIT' },
			'node_modules/devalue': { version: '5.0.0', license: 'MIT' },
			'node_modules/@skeletonlabs/skeleton': { version: '5.0.0', license: 'MIT' },
			'node_modules/@skeletonlabs/skeleton-svelte': { version: '5.0.0', license: 'MIT' },
			'node_modules/tailwindcss': { version: '4.0.0', license: 'MIT' },
			'node_modules/electron': { version: '45.0.0', license: 'MIT' },
			'node_modules/js-ballistics': { version: '3.2.0', license: 'ISC' }
		};
		expect(() => buildLicenses({ pkg: { dependencies: { 'js-ballistics': '3.2.0' } }, lock: lockOf(base) })).toThrow(/bclibc/);
	});

	it('fails on a dependency missing from the lockfile, and on a lockfile without packages', () => {
		expect(() => buildLicenses({ pkg: { dependencies: { nope: '1' } }, lock: lockOf({}) })).toThrow(/npm install/);
		expect(() => buildLicenses({ pkg: {}, lock: {} })).toThrow(/lockfileVersion/);
	});
});

describe('resolvePackage', () => {
	it('looks up the tree as Node does', () => {
		const packages = { 'node_modules/x': { version: '1' }, 'node_modules/a/node_modules/x': { version: '2' } };
		expect(resolvePackage(packages, 'node_modules/a', 'x')?.entry.version).toBe('2');
		expect(resolvePackage(packages, 'node_modules/b', 'x')?.entry.version).toBe('1');
		expect(resolvePackage(packages, '', 'y')).toBeNull();
	});
});

describe('packageHomepage', () => {
	it('gives an https address only', () => {
		expect(packageHomepage({ homepage: 'https://svelte.dev' })).toBe('https://svelte.dev/');
		expect(packageHomepage({ homepage: 'https://github.com/a/b#readme' })).toBe('https://github.com/a/b');
		expect(packageHomepage({ repository: { url: 'git+https://github.com/a/b.git' } })).toBe('https://github.com/a/b');
		expect(packageHomepage({ repository: 'github:a/b' })).toBe('https://github.com/a/b');
		expect(packageHomepage({ repository: 'a/b' })).toBe('https://github.com/a/b');
		expect(packageHomepage({ homepage: 'javascript:alert(1)' })).toBeNull();
		expect(packageHomepage({ homepage: 'http://example.com' })).toBeNull();
		expect(packageHomepage({ homepage: 'https://user:pw@example.com' })).toBeNull();
		expect(packageHomepage(null)).toBeNull();
	});
});
