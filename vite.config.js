import { paraglideVitePlugin } from '@inlang/paraglide-js';
import adapter from '@sveltejs/adapter-static';
import { sveltekit } from '@sveltejs/kit/vite';
import tailwindcss from '@tailwindcss/vite';
import { readFileSync } from 'fs';
import { defineConfig } from 'vite';

const pkg = JSON.parse(readFileSync('./package.json', 'utf-8'));
const isCapacitor = process.env.BUILD_TARGET === 'capacitor';

// Content-Security-Policy for every build: web and Electron (#104), and mobile (#135), written
// as a <meta> tag with the hashes of SvelteKit's inline scripts. The app's own origin in the
// mobile web views is https://localhost on Android (matched by 'self') and capacitor://localhost
// on iOS, a custom scheme that 'self' may not match, so the mobile build also names it. Both
// cover Capacitor's /_capacitor_*_ paths. Capacitor's native bridge needs no source: iOS adds it
// as a user script, and Android as a document-start script (or, on older WebViews, as an inline
// <script> right after <head>, before this <meta>, and a <meta> policy does not apply to what
// comes before it). 'unsafe-inline' styles: ApexCharts, Svelte transitions and style:
// directives set inline styles. data: and blob: images: ApexCharts and the chart exports.
// 'wasm-unsafe-eval' (#77, owner decision of 2026-11-12): js-ballistics 3 compiles its WebAssembly engine
// (bclibc), embedded in the bundle, with WebAssembly.instantiate, which a script-src without it
// refuses, and every calculator then fails. It allows compiling WebAssembly only, not eval() or
// new Function(). The app loads and sends nothing outside its own origin (docs/data-and-privacy.md).
const appOrigins = isCapacitor ? ['self', 'capacitor://localhost'] : ['self'];
const csp = {
	mode: 'hash',
	directives: {
		'default-src': appOrigins,
		'script-src': [...appOrigins, 'wasm-unsafe-eval'],
		'style-src': [...appOrigins, 'unsafe-inline'],
		'img-src': [...appOrigins, 'data:', 'blob:'],
		'font-src': [...appOrigins, 'data:'],
		'connect-src': appOrigins,
		'object-src': ['none'],
		'base-uri': ['self'],
		'form-action': ['none']
	}
};

export default defineConfig({
	define: {
		__APP_VERSION__: JSON.stringify(pkg.version)
	},
	plugins: [
		tailwindcss(),
		paraglideVitePlugin({
			project: './project.inlang',
			outdir: './src/lib/paraglide',
			// The language picked is kept in localStorage and applied at start by hooks.client.js
			// (#96): a cookie never won over the unprefixed `/`, and app:// cannot hold one.
			strategy: ['url', 'baseLocale']
		}),
		sveltekit({
			adapter: adapter({
				fallback: 'index.html'
			}),
			csp,
			...(isCapacitor
				? {
						output: {
							bundleStrategy: 'single'
						}
					}
				: {})
		})
	],
	test: {
		include: ['src/**/*.test.js'],
		environment: 'jsdom',
		globals: true
	}
});
