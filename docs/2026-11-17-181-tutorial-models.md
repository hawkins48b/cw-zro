# 3D tutorial models and dev-only viewer

- **Date:** 2026-11-17
- **Branch:** task/181-tutorial-models
- **Issue:** [#181](https://github.com/hawkins48b/cw-zro/issues/181), child 1 of epic [#180](https://github.com/hawkins48b/cw-zro/issues/180) (3D ballistic tutorial)
- **Status:** Delivered, not in production yet. No page uses the models yet (#182). Nobody has looked at the models in a browser yet

## Summary

The 3D ballistic tutorial (epic #180) needs 3D models. The issue asked for models built by a script, not downloaded, so there is no licence question, and stored as files so phones don't build them on each page load.

**Delivered.**

- `three` 0.187.0 (MIT) added as a dependency, on an exact version, and listed in `licenses.json`.
- `npm run models:build` draws eleven models with three.js and writes them as binary glTF (`.glb`) to `static/models/`. The files are committed and the script is their source. Running it again writes the same bytes.
- A model viewer at `/dev/models` that runs only in `npm run dev`. No build has it.

Models: `rifle`, `scope`, `holo-sight`, `tree-broadleaf`, `tree-birch`, `tree-conifer`, `grass`, `ipsc-target`, `bullet`, `spotting-scope`, `flag`. Together they are 468,824 bytes and 8,680 triangles. The issue's limit was about 1.5 MB. The parts the tutorials will point at or move (turrets, bolt, muzzle, branches, leaves, target zones, flag cloth) are separate named nodes. Their origins are at their pivots.

The [Tutorial models](development.md#tutorial-models) section of the development guide covers the conventions, the node names of each model, triangle and byte counts, and the viewer. This document does not repeat them.

## Owner decisions (2026-11-17)

| Topic | Decision |
|-------|----------|
| Source of the models | A Node build script with three.js writes committed `.glb` files. No third-party models |
| Viewer | Dev only, not in any build |

## Defaults chosen during the task, not yet confirmed by the owner

| Topic | Default |
|-------|---------|
| Owner-held pins in `CLAUDE.md` | `three` is pinned exactly in `package.json`, but it was not added to the owner-held pins list in `CLAUDE.md` (js-ballistics, ApexCharts), because its licence is MIT |
| `licenses.json` | `three` is listed on every platform now, although no page loads it until #182 |
| Shipping | The `.glb` files are in `static/`, so every build already carries them: web, Electron and Capacitor (`build/models/`, 468,824 bytes) |
| Shapes | The IPSC zone layout is approximate, not taken from a regulation drawing. The colours were picked by the developer. The `hard-cover` node is exported visible, and the app will hide it when it is not wanted. The bullet's rifling engraving is 0.15 mm deep, deeper than a real one, so that it can be seen |

## How to use

Developers only. End users see nothing new yet.

- **Rebuild the models** after changing a shape in [`scripts/models/`](../scripts/models/): `npm run models:build`, then commit the `.glb` files. The script prints the triangles and bytes of each model.
- **Look at them:** run `npm run dev` and open http://localhost:5173/dev/models. Pick a model in the list. Drag to orbit, use the wheel to zoom, and right-drag to pan. There are switches for wireframe and for grid and axes. The node tree shows the triangles of each node. Click a node to see its origin. The URL hash selects a model (`#scope`). Reload after a rebuild.

## Technical changes

- [`package.json`](../package.json): `three` 0.187.0 under `dependencies`. New script `models:build`. `package-lock.json` updated.
- [`src/lib/data/licenses.json`](../src/lib/data/licenses.json): regenerated, 28 entries (`three` added).
- [`scripts/build-models.js`](../scripts/build-models.js): exports every model with `GLTFExporter` (binary). It gives the exporter a small `FileReader` on Node's `Blob`. There are no textures, so it needs no canvas. Trees and grass use a seeded random generator. The output holds no uuid, date or local path.
- [`scripts/models/`](../scripts/models/): `kit.js` (shared helpers), `weapons.js` (rifle, scope, holo-sight, bullet), `nature.js` (trees, grass), `range.js` (target, spotting scope, flag).
- `static/models/*.glb`: the eleven generated files.
- [`tools/model-viewer/plugin.js`](../tools/model-viewer/plugin.js): Vite plugin with `apply: 'serve'`. It answers only `GET` and `HEAD` on exactly `/dev/models`, with a page that loads [`tools/model-viewer/main.js`](../tools/model-viewer/main.js). It adds only `main.js` to Vite's `server.fs.allow`. Model names reach the page only if they match `[a-z0-9-]`. This page belongs to the plugin, not to SvelteKit, so the app's Content-Security-Policy does not apply to it.
- [`vite.config.js`](../vite.config.js): adds `modelViewer()` to the plugins.
- [`src/test/tutorialModels.test.js`](../src/test/tutorialModels.test.js): 61 tests. Each committed `.glb` must be byte for byte what the script writes. They check file contents, size and triangle budgets, node names and pivots, that no file in `src/` imports `three`, and the viewer plugin's routing. The full list is in [Testing](testing.md).
- Guides updated: [development](development.md#tutorial-models), [architecture](architecture.md) (stack table, layout, build output), [testing](testing.md), [data and privacy](data-and-privacy.md) (`licenses.json` count), and the script table in the [README](../README.md).

## Deployment notes

Nothing to do by hand. The next deploy uploads `models/*.glb` (about 460 KiB) with the rest of `static/`. The viewer and three.js do not ship, because no app code imports three yet.

## Security review

**PASS.** One Low finding was fixed after the review. In `main.js`, a broken location hash (for example `#%E0`) made `decodeURIComponent` throw. It is now caught, and the viewer falls back to the first model.

What the tests and review cover: the viewer exists only in the dev server and answers only its one path, with no `/dev/models/`, no `..` paths and no POST. Vite may serve no file of `tools/` except `main.js`. Model names are filtered before they go into the page. Grep found no viewer code in `npm run build` or `build:mobile` output.

## Verification

- `npm run test:run`: 5023 passed, 1 todo, in 68 files.
- `npm run build`, `npm run build:mobile` and `npm run audit:check` pass.

Not verified:

- The tests never load the files with three's `GLTFLoader`. They read the glTF JSON and buffers directly.
- Nobody has looked at the models in a browser. The owner should run `npm run dev`, open http://localhost:5173/dev/models, and check each model with orbit, zoom, wireframe and the node tree. Look closely at the turrets, the bolt, the bullet's grooves and the target zones.
- No test sends a `HEAD` request to the viewer.

## Known limitations / follow-ups

- No app page uses the models or three.js yet. The tutorial route comes with #182.
- The defaults above wait for the owner's confirmation.

## Changelog

- 2026-11-17: initial delivery
