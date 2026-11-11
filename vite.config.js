import { paraglideVitePlugin } from '@inlang/paraglide-js';
import adapter from '@sveltejs/adapter-static';
import { sveltekit } from '@sveltejs/kit/vite';
import tailwindcss from '@tailwindcss/vite';
import { readFileSync } from 'fs';
import { defineConfig } from 'vite';

const pkg = JSON.parse(readFileSync('./package.json', 'utf-8'));
const isCapacitor = process.env.BUILD_TARGET === 'capacitor';

// Content-Security-Policy for the web and Electron builds (#104), written as a <meta> tag
// with the hashes of SvelteKit's inline scripts. The mobile build has none until it is
// tested on a device. 'unsafe-inline' styles: ApexCharts, Svelte transitions and style:
// directives set inline styles. data: and blob: images: ApexCharts and the chart exports.
// The app loads and sends nothing outside its own origin (docs/data-and-privacy.md).
const csp = {
	mode: 'hash',
	directives: {
		'default-src': ['self'],
		'script-src': ['self'],
		'style-src': ['self', 'unsafe-inline'],
		'img-src': ['self', 'data:', 'blob:'],
		'font-src': ['self', 'data:'],
		'connect-src': ['self'],
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
			...(isCapacitor
				? {
						output: {
							bundleStrategy: 'single'
						}
					}
				: { csp })
		})
	],
	ssr: {
		// js-ballistics uses extensionless ESM imports which Node.js strict ESM can't resolve.
		// Bundling it for SSR lets Vite handle the resolution instead of Node.
		noExternal: ['js-ballistics']
	},
	test: {
		include: ['src/**/*.test.js'],
		environment: 'jsdom',
		globals: true
	}
});
