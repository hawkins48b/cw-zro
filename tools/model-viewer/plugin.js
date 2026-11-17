/**
 * Dev-only viewer of the tutorial models (#181), at http://localhost:5173/dev/models in `npm run dev`.
 *
 * Not a SvelteKit route, so it is in no build: this Vite plugin applies to the dev server only
 * (`apply: 'serve'`), and answers exactly GET /dev/models with a page that loads main.js (beside this
 * file) through Vite. Nothing in src/ imports it. Its middleware is added straight in
 * configureServer, so it runs before SvelteKit's, and the page is ours, so SvelteKit's
 * Content-Security-Policy does not apply to it. It serves no other path: the models themselves come
 * from static/ like any static file. SvelteKit limits what Vite serves (server.fs.allow) to src/,
 * node_modules/ and its own folders; the plugin adds main.js alone to that list, not tools/.
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

export const VIEWER_PATH = '/dev/models';
const MODULE = '/tools/model-viewer/main.js';
/** The viewer module on disk: the one file of tools/ the dev server may serve. */
export const MODULE_FILE = fileURLToPath(new URL('./main.js', import.meta.url));
const NAME = /^[a-z0-9-]+\.glb$/;

/**
 * The model names in static/models (file names without .glb). Only plain names: they go into the page.
 * @param {string} root project root
 * @returns {string[]}
 */
export function listModels(root) {
	let files = [];
	try {
		files = fs.readdirSync(path.join(root, 'static', 'models'));
	} catch {
		return [];
	}
	return files
		.filter((f) => NAME.test(f))
		.map((f) => f.slice(0, -'.glb'.length))
		.sort();
}

/**
 * The viewer page, before Vite adds its client.
 * @param {string[]} models names matching [a-z0-9-]
 */
export function viewerHtml(models) {
	const list = models.filter((m) => /^[a-z0-9-]+$/.test(m)).join(',');
	return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="robots" content="noindex">
<title>ZRO models (dev)</title>
<style>
	html, body { margin: 0; height: 100%; font: 13px system-ui, sans-serif; background: #1d1f23; color: #e6e6e6; }
	body { display: flex; }
	aside { width: 280px; flex: none; overflow: auto; padding: 10px; box-sizing: border-box; border-right: 1px solid #333; }
	main { flex: 1; position: relative; min-width: 0; }
	canvas { display: block; width: 100%; height: 100%; }
	h1 { font-size: 14px; margin: 0 0 8px; }
	h2 { font-size: 12px; margin: 14px 0 6px; text-transform: uppercase; color: #9aa; }
	button.model { display: block; width: 100%; text-align: left; margin: 2px 0; padding: 4px 6px; background: #2a2d33; color: inherit; border: 1px solid #3a3d44; border-radius: 4px; cursor: pointer; }
	button.model[aria-current="true"] { background: #3d5a80; border-color: #5b7fb0; }
	label { display: block; margin: 4px 0; }
	dl { display: grid; grid-template-columns: auto 1fr; gap: 2px 8px; margin: 0; }
	dt { color: #9aa; }
	dd { margin: 0; font-variant-numeric: tabular-nums; }
	ul { list-style: none; margin: 0; padding-left: 12px; }
	#tree > ul { padding-left: 0; }
	li > span { cursor: pointer; padding: 1px 3px; border-radius: 3px; }
	li > span:hover { background: #2a2d33; }
	li > span.selected { background: #3d5a80; }
	.muted { color: #889; }
	#error { color: #f88; }
</style>
</head>
<body data-models="${list}">
<aside>
	<h1>ZRO tutorial models</h1>
	<p class="muted">Dev only. Rebuild with <code>npm run models:build</code>, then reload.</p>
	<h2>Models</h2>
	<div id="models"></div>
	<h2>View</h2>
	<label><input type="checkbox" id="wireframe"> Wireframe</label>
	<label><input type="checkbox" id="helpers" checked> Grid and axes (X red, Y green, Z blue)</label>
	<h2>Model</h2>
	<dl id="stats"></dl>
	<p id="error"></p>
	<h2>Nodes</h2>
	<div id="tree"></div>
	<h2>Selected node</h2>
	<dl id="node"></dl>
</aside>
<main><canvas id="view"></canvas></main>
<script type="module" src="${MODULE}"></script>
</body>
</html>
`;
}

/**
 * The Vite plugin. vite.config.js adds it; with `apply: 'serve'` Vite leaves it out of every build.
 * @param {{ root?: string }} [options]
 * @returns {import('vite').Plugin}
 */
export function modelViewer(options = {}) {
	const root = options.root ?? process.cwd();
	return {
		name: 'zro-model-viewer',
		apply: 'serve',
		config() {
			// Merged with SvelteKit's list (Vite concatenates arrays).
			return { server: { fs: { allow: [MODULE_FILE] } } };
		},
		configureServer(server) {
			server.middlewares.use(async (req, res, next) => {
				const url = (req.url ?? '').split('?')[0];
				if (url !== VIEWER_PATH || (req.method !== 'GET' && req.method !== 'HEAD')) return next();
				try {
					const html = await server.transformIndexHtml(VIEWER_PATH, viewerHtml(listModels(root)));
					res.statusCode = 200;
					res.setHeader('Content-Type', 'text/html; charset=utf-8');
					res.setHeader('Cache-Control', 'no-store');
					res.end(req.method === 'HEAD' ? undefined : html);
				} catch (error) {
					next(error);
				}
			});
		}
	};
}
