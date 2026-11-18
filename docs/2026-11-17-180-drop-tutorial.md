# 2026-11-17: 3D ballistic tutorial removed (#180)

The owner dropped the 3D ballistic tutorial (epic [#180](https://github.com/hawkins48b/cw-zro/issues/180)) on 2026-11-17, after viewing #182 and #195. Everything the epic added to `develop` is reverted in one commit. Nothing of it reached production.

## Reverted commits

| Commit | Issue | What it added |
|---|---|---|
| a2fc034 | #181 | `three` 0.187.0, `npm run models:build`, the `.glb` models in `static/models/`, the dev-only viewer at `/dev/models` |
| dac070a | #181 | Sharp bullet tip |
| 3543d7a | #181 | Target hard cover removed, spotting scope caps, sandbag model |
| 7b8c460 | #182 | Route `/calculators/ballistic-tutorial`, hub and sidebar entries, scene, store `zro-ballistic-tutorial`, player, Scene tour, `__MOBILE_BUILD__` |
| 5cddc34 | #182 | Translations guide key count |
| 960a76f | #182 | Terrain winding fix |
| 0957556 | #195 | Neon-grid look, backstop, HUD bracket, even grass |

## What is left

- #193 and #194, which landed between these commits, are kept.
- `three` is no longer a dependency, and `licenses.json` is back to its earlier list.
- The guides (architecture, development, testing, data-and-privacy, ballistics-model, translations) describe the app without the tutorial. Each language has 902 keys.
- The delivery docs of #181, #182 and #195 stay as history.
- A `zro-ballistic-tutorial` key already saved in a browser that opened the tutorial on the dev build stays there; no release ever wrote it, and nothing reads it now.

## Issues

Epic #180 and its open children #183 to #192 are closed as not planned. #181, #182 and #195 were already closed.

## Checks

`npm ci`, `npm run test:run`, `npm run build`, `npm run build:mobile` and `npm run audit:check` were run on the revert. Not checked in a browser.
