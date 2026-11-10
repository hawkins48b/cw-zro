import { paraglideVitePlugin } from '@inlang/paraglide-js';
import adapter from '@sveltejs/adapter-static';
import { sveltekit } from '@sveltejs/kit/vite';
import tailwindcss from '@tailwindcss/vite';
import { readFileSync } from 'fs';
import { defineConfig } from 'vite';

const pkg = JSON.parse(readFileSync('./package.json', 'utf-8'));
const isCapacitor = process.env.BUILD_TARGET === 'capacitor';

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
			...(isCapacitor && {
				output: {
					bundleStrategy: 'single'
				}
			})
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
