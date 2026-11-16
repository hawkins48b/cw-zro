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
// new Function(). The app loads nothing from outside its own origin. It sends one request outside
// it: the current weather (#152, owner decision of 2026-11-16), to Open-Meteo, only on a tap of
// "Use current weather here", with the position rounded to about 1 km (docs/data-and-privacy.md).
// Electron shares the web build, so its policy names the host too; the desktop app hides the button
// and refuses the location anyway.
const WEATHER_ORIGIN = 'https://api.open-meteo.com';
const appOrigins = isCapacitor ? ['self', 'capacitor://localhost'] : ['self'];
const csp = {
	mode: 'hash',
	directives: {
		'default-src': appOrigins,
		'script-src': [...appOrigins, 'wasm-unsafe-eval'],
		'style-src': [...appOrigins, 'unsafe-inline'],
		'img-src': [...appOrigins, 'data:', 'blob:'],
		'font-src': [...appOrigins, 'data:'],
		'connect-src': [...appOrigins, WEATHER_ORIGIN],
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
		environment: 'jsdom',
		globals: true,
		projects: [
			{
				extends: true,
				test: { name: 'unit', include: ['src/**/*.test.js'], exclude: ['src/**/*.svelte.test.js'] }
			},
			{
				// Components mounted in jsdom (#152): Svelte's client build, which the browser
				// condition selects. Only these files, so no other test resolves a package differently.
				extends: true,
				resolve: { conditions: ['browser'] },
				test: { name: 'components', include: ['src/**/*.svelte.test.js'] }
			}
		]
	}
});
