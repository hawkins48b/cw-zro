/**
 * The list of packages the app ships, with their licences, for Settings > About (#166). Read from
 * package.json and package-lock.json only (no network): scripts/licenses.js writes it to
 * src/lib/data/licenses.json, and src/test/licenses.test.js fails when that file no longer matches
 * the lockfile, so a dependency update (Dependabot) shows up there.
 *
 * What counts as shipped, checked on 2026-11-17 against the source maps of a web build (the npm
 * packages whose code is in the bundle: @lucide/svelte, @sveltejs/kit, apexcharts, clsx, devalue,
 * js-ballistics, pdf-lib and its dependencies, svelte) and the Capacitor and Electron packaging:
 *
 * - Every production `dependency` of package.json and its own dependencies, except the ones in
 *   NOT_SHIPPED. The Capacitor packages ship in the Android and iOS apps (the native runtime and
 *   plugins), electron-serve in the desktop app.
 * - The devDependencies whose code ships anyway: RUNTIME_DEV_DEPENDENCIES (the Svelte and SvelteKit
 *   runtime in the bundle, Skeleton's CSS, the Electron runtime of the desktop app). Their own
 *   dependencies are compiler or server code, so only the ones named in `with` are added.
 * - EMBEDDED: code inside a package that is not an npm package itself (bclibc in js-ballistics).
 *
 * The list leans towards listing too much: a package listed but not in a build is harmless, a
 * missing licence is not.
 */

/** @typedef {'web' | 'android' | 'ios' | 'desktop'} Platform */

/** Every platform the app is built for. */
export const ALL_PLATFORMS = Object.freeze(['web', 'android', 'ios', 'desktop']);
const MOBILE = ['android', 'ios'];
const DESKTOP = ['desktop'];

/**
 * Production dependencies whose code is in no build, with the reason. Their own dependencies are
 * not listed either (unless another shipped package needs them).
 */
export const NOT_SHIPPED = Object.freeze({
	'@capacitor/cli': 'build tool: copies the web build into the native projects',
	'svelte-gestures': 'not imported by the app (src/ and electron/)'
});

/**
 * Production dependencies that are shipped, but only on some platforms. The others ship everywhere.
 * @type {Readonly<Record<string, Platform[]>>}
 */
export const PLATFORMS = Object.freeze({
	'@capacitor/android': ['android'],
	'@capacitor/ios': ['ios'],
	'@capacitor/core': MOBILE,
	'@capacitor/app': MOBILE,
	'@capacitor/splash-screen': MOBILE,
	'@capacitor/status-bar': MOBILE,
	'electron-serve': DESKTOP
});

/**
 * Packages whose own dependencies are build-time code (a compiler, a CLI, a dev server): the
 * package is listed, its dependencies only when named in `with`.
 * @type {Readonly<Record<string, { platforms: Platform[], with: string[] }>>}
 */
export const RUNTIME_DEV_DEPENDENCIES = Object.freeze({
	svelte: { platforms: [...ALL_PLATFORMS], with: ['clsx'] },
	'@sveltejs/kit': { platforms: [...ALL_PLATFORMS], with: ['devalue'] },
	'@skeletonlabs/skeleton': { platforms: [...ALL_PLATFORMS], with: [] },
	'@skeletonlabs/skeleton-svelte': { platforms: [...ALL_PLATFORMS], with: [] },
	tailwindcss: { platforms: [...ALL_PLATFORMS], with: [] },
	electron: { platforms: [...DESKTOP], with: [] }
});

/** Production dependencies with the same rule as RUNTIME_DEV_DEPENDENCIES. */
const COMPILER_DEPENDENCIES = Object.freeze({
	// The compiler of the messages: its generated runtime (src/lib/paraglide) is in the bundle,
	// none of its dependencies.
	'@inlang/paraglide-js': []
});

/**
 * Code embedded in a package, not installed as a package. `in` is the package and the version it
 * was checked for: when the lockfile has another version, buildLicenses throws, so the entry is
 * checked again (CLAUDE.md, "Pinned dependencies").
 */
export const EMBEDDED = Object.freeze([
	{
		name: 'bclibc',
		version: '2.0.0',
		license: 'LGPL-3.0-only',
		homepage: 'https://github.com/ballistics-lab/bclibc',
		in: { name: 'js-ballistics', version: '3.1.0' }
	}
]);

/**
 * The lockfile entry of a package required from a folder, as Node resolves it: the closest
 * node_modules up the tree.
 * @param {Record<string, any>} packages lockfile `packages`
 * @param {string} from path of the requiring package ('' for the root)
 * @param {string} name
 * @returns {{ path: string, entry: any } | null}
 */
export function resolvePackage(packages, from, name) {
	let dir = from;
	for (;;) {
		const path = `${dir ? `${dir}/` : ''}node_modules/${name}`;
		if (packages[path] && !packages[path].link) return { path, entry: packages[path] };
		if (packages[path]?.link) return { path: packages[path].resolved, entry: packages[packages[path].resolved] };
		if (!dir) return null;
		const at = dir.lastIndexOf('/node_modules/');
		dir = at === -1 ? '' : dir.slice(0, at);
	}
}

/** The package name of a lockfile path ('node_modules/a/node_modules/@b/c' gives '@b/c'). */
export function packageName(path) {
	return path.slice(path.lastIndexOf('node_modules/') + 'node_modules/'.length);
}

/**
 * An https web address for a package, from its package.json `homepage` or `repository`, or null.
 * Only https: the page shows it as a link.
 * @param {any} manifest
 * @returns {string | null}
 */
export function packageHomepage(manifest) {
	const candidates = [
		manifest?.homepage,
		typeof manifest?.repository === 'string' ? manifest.repository : manifest?.repository?.url
	];
	for (const raw of candidates) {
		if (typeof raw !== 'string') continue;
		let url = raw.trim().replace(/^git\+/, '').replace(/\.git$/, '');
		const short = /^github:([\w.-]+\/[\w.-]+)$/.exec(url) ?? /^([\w.-]+\/[\w.-]+)$/.exec(url);
		if (short) url = `https://github.com/${short[1]}`;
		url = url.replace(/^git:\/\//, 'https://').replace(/^ssh:\/\/git@/, 'https://');
		try {
			const parsed = new URL(url);
			if (parsed.protocol === 'https:' && !parsed.username && !parsed.password) {
				return parsed.href.replace(/#readme$/, '');
			}
		} catch {
			// not a URL: try the next one
		}
	}
	return null;
}

/**
 * The shipped packages with their licences, sorted by name then version.
 *
 * @param {{ lock: any, pkg: any, readManifest?: (path: string) => any }} input
 *   lock: package-lock.json, pkg: package.json, readManifest: the package.json of a lockfile path
 *   (for the homepage), or null when it cannot be read
 * @returns {{ name: string, version: string, license: string, platforms: Platform[], homepage?: string }[]}
 */
export function buildLicenses({ lock, pkg, readManifest = () => null }) {
	const packages = lock?.packages;
	if (!packages || typeof packages !== 'object') throw new Error('package-lock.json has no "packages" (lockfileVersion 2 or 3 needed)');

	/** @type {Map<string, { path: string, entry: any, platforms: Set<string> }>} */
	const found = new Map();

	/**
	 * @param {string} from
	 * @param {string} name
	 * @param {Iterable<string>} platforms
	 * @param {boolean | string[]} walk true: every dependency; an array: only those
	 * @param {boolean} required throw when it is not in the lockfile
	 */
	function add(from, name, platforms, walk, required) {
		const hit = resolvePackage(packages, from, name);
		if (!hit) {
			if (required) throw new Error(`${name} is not in package-lock.json: run npm install`);
			return; // an optional dependency for another system
		}
		let item = found.get(hit.path);
		const before = item ? item.platforms.size : -1;
		if (!item) {
			item = { path: hit.path, entry: hit.entry, platforms: new Set() };
			found.set(hit.path, item);
		}
		for (const p of platforms) item.platforms.add(p);
		if (item.platforms.size === before) return; // seen with these platforms already
		const deps = walk === true
			? [...Object.keys(hit.entry.dependencies ?? {}), ...Object.keys(hit.entry.optionalDependencies ?? {})]
			: walk;
		for (const dep of deps) add(hit.path, dep, item.platforms, true, walk !== true);
	}

	for (const name of Object.keys(pkg?.dependencies ?? {})) {
		if (Object.hasOwn(NOT_SHIPPED, name)) continue;
		const platforms = PLATFORMS[name] ?? ALL_PLATFORMS;
		add('', name, platforms, Object.hasOwn(COMPILER_DEPENDENCIES, name) ? COMPILER_DEPENDENCIES[name] : true, true);
	}
	for (const [name, { platforms, with: deps }] of Object.entries(RUNTIME_DEV_DEPENDENCIES)) {
		add('', name, platforms, deps, true);
	}

	const list = [...found.values()].map(({ path, entry, platforms }) => {
		const item = {
			name: packageName(path),
			version: String(entry.version ?? ''),
			license: typeof entry.license === 'string' && entry.license.trim() ? entry.license.trim() : 'UNKNOWN',
			platforms: ALL_PLATFORMS.filter((p) => platforms.has(p))
		};
		const homepage = packageHomepage(readManifest(path));
		return homepage ? { ...item, homepage } : item;
	});

	for (const { in: host, ...embedded } of EMBEDDED) {
		const hostItem = list.find((p) => p.name === host.name);
		if (!hostItem) throw new Error(`${embedded.name} is embedded in ${host.name}, which is no longer shipped: update EMBEDDED in scripts/license-rules.js`);
		if (hostItem.version !== host.version) {
			throw new Error(
				`${host.name} is now ${hostItem.version}, EMBEDDED in scripts/license-rules.js was checked for ${host.version}: ` +
					`check the ${embedded.name} version and licence it embeds (CLAUDE.md, "Pinned dependencies"), then update the entry`
			);
		}
		list.push({ ...embedded, platforms: [...hostItem.platforms] });
	}

	return dedupe(list).sort((a, b) => (a.name < b.name ? -1 : a.name > b.name ? 1 : a.version < b.version ? -1 : a.version > b.version ? 1 : 0));
}

/** One entry per name and version (a package can be installed in two folders). */
function dedupe(list) {
	const byKey = new Map();
	for (const item of list) {
		const key = `${item.name}@${item.version}`;
		const seen = byKey.get(key);
		if (!seen) {
			byKey.set(key, item);
			continue;
		}
		const platforms = new Set([...seen.platforms, ...item.platforms]);
		const merged = { ...seen, platforms: ALL_PLATFORMS.filter((p) => platforms.has(p)) };
		const homepage = seen.homepage ?? item.homepage;
		if (homepage) merged.homepage = homepage;
		byKey.set(key, merged);
	}
	return [...byKey.values()];
}

/** The JSON text written to src/lib/data/licenses.json. */
export function formatLicenses(list) {
	return `${JSON.stringify(list, null, '\t')}\n`;
}
