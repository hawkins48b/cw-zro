import { paraglideVitePlugin } from '@inlang/paraglide-js';
import { sveltekit } from '@sveltejs/kit/vite';
import tailwindcss from '@tailwindcss/vite';
import { readFileSync } from 'fs';
import { defineConfig } from 'vite';

const pkg = JSON.parse(readFileSync('./package.json', 'utf-8'));

export default defineConfig({
	define: {
		__APP_VERSION__: JSON.stringify(pkg.version)
	},
	plugins: [
		tailwindcss(),
		paraglideVitePlugin({
			project: './project.inlang',
			outdir: './src/lib/paraglide',
			strategy: ['url', 'cookie', 'baseLocale']
		}),
		sveltekit()
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
