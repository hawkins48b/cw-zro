# 3D ballistic tutorial: page, scene, settings and player

- **Date:** 2026-11-17
- **Branch:** task/182-tutorial-shell
- **Issue:** [#182](https://github.com/hawkins48b/cw-zro/issues/182), child 2 of epic [#180](https://github.com/hawkins48b/cw-zro/issues/180) (3D ballistic tutorial)
- **Status:** Delivered with known issues. The 3D scene has never run: the dev container has no WebGL, and the cw-lab rule says no browser tests by agents. The owner has to check it in a browser (list below). Nothing was run in Electron. Not available in the Capacitor apps (owner decision)

## Summary

The issue asked for the page of the 3D ballistic tutorial: a profile step, a three.js scene built from the models of #181, the settings every tutorial runs in, and a player for the tutorials.

**Delivered.**

- Route `/calculators/ballistic-tutorial`, listed in the calculators hub under "More tools" (graduation cap icon, no badge) and in the sidebar.
- **Step 1**, shown on every visit: the profile in use (`ProfileInUseChip`, Change opens the picker), a "heavy page" warning about CPU, GPU and phones, and a WebGL 2 check. Without WebGL 2 a card says so and "Open the 3D scene" stays disabled.
- **Step 2**: the scene, with camera chips (Shooter, Optic, Side, Target), orbit, and a Fire button. To its right (below it on narrow screens): the tutorial player, a range card (target distance, shooter altitude, target elevation), the app's wind and Atmosphere cards, and a Scene card (weather, quality).
- The rifle carries a holographic sight for a `red-dot` profile and a riflescope for `mil-dot`, `mrad` and `moa`. Through the optic, a reticle is drawn over the scene.
- Fire animates a bullet along the engine trajectory (`calculateFullTrajectory`) and shows the drop and drift at the target.
- A first tutorial, "Scene tour", in 5 steps: rifle, optic, target, wind, fire.
- English, French and German strings (88 new keys).

The developer guides describe the parts in detail: [3D tutorial](architecture.md#3d-tutorial) in the architecture guide, [Tutorials of the 3D tutorial](development.md#tutorials-of-the-3d-tutorial) for the tutorial file format, the [3D tutorial angle](ballistics-model.md#angles) in the ballistics model. This document does not repeat them.

## Owner decisions (2026-11-17)

| Topic | Decision |
|-------|----------|
| Saved state | The tutorial has its own store, `zro-ballistic-tutorial`, not the Ballistic page's or the Scope View's |
| First tutorial | A short "Scene tour" (5 steps) ships with the player |
| Hub entry | Under "More tools", no badge |
| Phone | `pointer: coarse` and a window narrower than 768 px. A phone starts in Low quality |
| Capacitor apps | No tutorial. The mobile build sets `__MOBILE_BUILD__` and the page never imports the scene, so three.js is not in the mobile bundle. [`tutorialAvailability.js`](../src/lib/utils/tutorialAvailability.js) hides the hub card and the sidebar entry there, and a direct visit shows "Not available in the mobile app". This replaces the epic's "works in Capacitor" for the apps. Web and Electron keep the tutorial |

## Defaults chosen during the task, not yet confirmed by the owner

| Topic | Default |
|-------|---------|
| Shooter altitude | Separate from the Atmosphere card's altitude. It shapes the terrain (and the tree mix) only; the ballistics use the Atmosphere card |
| Scene weather | Separate from the Atmosphere card's weather. Sunny, cloudy, rain, snow change the picture only |
| Step 1 | Shown on every visit, so the scene never starts unasked |
| Desktop quality | Medium on a first visit (Low on phones) |
| First-visit units | Follow the profile's zero unit: metres and m/s, or yards, feet and mph. Distance 300, altitude and elevation 0, wind 0 from 90° |
| Target elevation | The height of the aim point above the optic. The target's ground is about 0.9 m lower |
| WebGL | WebGL 2 only. three.js 0.187 has no WebGL 1 |
| Reticle | A new overlay, [`TutorialReticle.svelte`](../src/lib/components/tutorial/TutorialReticle.svelte), drawn in mrad over the camera's field of view, instead of reusing `ScopeReticle` |
| Trees | The mix follows the shooter altitude: broadleaf and birch below 800 m, mostly conifers from 800 m, only conifers from 1600 m, fewer trees from 2200 m |
| Elevation limits | ±500 m or ±1640 ft. A target as high or low as it is far is refused (no angle) |

## How to use

Web and desktop only.

1. Open **Calculators**, then **3D ballistic tutorial** under "More tools" (or the sidebar entry). The address is `/calculators/ballistic-tutorial`.
2. Step 1: check the profile in use (Change to pick another), read the warning, and press **Open the 3D scene**.
3. Step 2:
   - Drag to turn around the shooter, scroll or pinch to zoom, or pick a camera chip.
   - Change the target distance, shooter altitude or target elevation in the range card. The terrain and target follow about 0.2 s after the last change.
   - Set the wind and atmosphere as on the Scope View. The current weather button works here too (web only).
   - Pick the scene's weather and quality. Both are remembered.
   - Press **Fire**. The bullet flies, and the drop and drift at the target show over the scene.
   - In the player, start **Scene tour** and use Next, Back and Exit.

If the graphics card drops the scene, a card "The 3D scene stopped" offers Restart.

## Technical changes

- **Route:** [`src/routes/calculators/ballistic-tutorial/+page.svelte`](../src/routes/calculators/ballistic-tutorial/+page.svelte). It loads the scene with `await import('#lib/tutorial/scene.js')` behind `if (__MOBILE_BUILD__) return;`, starts it when step 2 mounts and disposes of it on leaving.
- **Scene:** [`src/lib/tutorial/scene.js`](../src/lib/tutorial/scene.js), the only app module that imports three.js. It loads 11 of the 12 models (not the spotting scope) from `/models/<name>.glb`. It pauses when the tab is hidden or the scene is off screen, and `dispose()` frees geometries, materials, textures, the renderer and its context, controls, observers and listeners.
- **Tutorials:** [`src/lib/tutorial/registry.js`](../src/lib/tutorial/registry.js) (format, camera presets, value ids, `tutorialProblems`) and [`tutorials/sceneTour.js`](../src/lib/tutorial/tutorials/sceneTour.js).
- **Components:** [`src/lib/components/tutorial/`](../src/lib/components/tutorial/): `TutorialIntro`, `TutorialScene`, `TutorialReticle`, `TutorialRangeCard`, `TutorialDisplayCard`, `TutorialPlayer`.
- **Store:** [`ballisticTutorial.svelte.js`](../src/lib/stores/ballisticTutorial.svelte.js), key `zro-ballistic-tutorial`, with the Scope View store's API so `ScopeWindCard`, `ScopeAtmosphereCard` and `useCurrentWeather` take it. Readers in [`storedTutorial.js`](../src/lib/utils/storedTutorial.js) (also `isPhone`, `defaultQuality`). The key is added to `APP_STORAGE_KEYS` in [`appStorage.js`](../src/lib/utils/appStorage.js), so "Clear all data" removes it.
- **Helpers (tested, no three.js):** [`tutorialPath.js`](../src/lib/utils/tutorialPath.js) (angle from distance and elevation, trajectory in scene metres), [`tutorialScene.js`](../src/lib/utils/tutorialScene.js) (layout, terrain, quality presets, wind sway, weather looks, tree and grass placement, camera poses), [`webgl.js`](../src/lib/utils/webgl.js), [`tutorialAvailability.js`](../src/lib/utils/tutorialAvailability.js).
- **Limits and steppers:** `TARGET_ELEVATION_LIMITS` in [`inputLimits.js`](../src/lib/utils/inputLimits.js); `targetDistance` (step 25) and `targetElevation` (step 1 m or 5 ft) in [`fieldStep.js`](../src/lib/utils/fieldStep.js).
- **Navigation:** hub card in [`calculators/+page.svelte`](../src/routes/calculators/+page.svelte), sidebar entry and page title in [`+layout.svelte`](../src/routes/+layout.svelte), both through `withoutUnavailableTutorial`.
- **Build:** [`vite.config.js`](../vite.config.js) defines `__MOBILE_BUILD__` from `BUILD_TARGET=capacitor`.
- **Messages:** 88 `tutorial_` keys in `messages/en.json`, `fr.json`, `de.json` (988 keys each).
- **Tests:** new `tutorialPath.test.js`, `tutorialScene.test.js`, `tutorialRegistry.test.js`, `ballisticTutorialStore.test.js`, `tutorialSettings.test.js`; `tutorialModels.test.js` now checks that only `scene.js` imports three, that only the tutorial route imports `scene.js`, lazily, and that the import sits behind `__MOBILE_BUILD__`; `clearAllData.test.js` lists the new key.
- **Guides updated:** [architecture](architecture.md), [ballistics model](ballistics-model.md), [development](development.md), [testing](testing.md), [data and privacy](data-and-privacy.md), [translations](translations.md) (key count).

No calculated result or baseline changed. The Content-Security-Policy is unchanged. `three` stays at 0.187.0.

## Bundle size

| Build | Result |
|-------|--------|
| Web | three.js and the scene are one chunk of 655,138 bytes (163,132 gzipped), imported only by the tutorial route |
| Mobile | One bundle of 2,454,294 bytes, against 2,390,810 before #182 (+63,484: the page, components, store, helpers and messages). No `WebGLRenderer`, `GLTFLoader` or `/models/` path in it. With the scene included it had been 3,116,237 bytes |

The mobile check is a grep of the build output, not a test. The documentor's own `npm run build:mobile` gave 2,454,295 bytes and no `WebGLRenderer`, and showed that the tutorial store is created lazily in the mobile bundle, not at app start. The `.glb` files (about 499 KB) are still copied into the mobile build, unused.

## Deployment notes

Nothing to do by hand. The next web and desktop builds carry the tutorial; the mobile build carries the page's "not available" message only.

## Security review

**PASS** in 2 rounds. Round 1 had one Low finding: the change had deleted the model-viewer plugin's tests in `tutorialModels.test.js`. They were restored byte-identical. CSP unchanged: models come from the app's origin, there are no textures (so no `blob:` URL or worker), and three.js compiles shaders with WebGL, not `eval`.

## Verification

- `npm run test:run`: 5145 passed, 1 todo, in 73 files (documentor's run).
- `npm run build` and `npm run build:mobile` pass.
- The tutorial's drop and drift at the target equal the Ballistic page's rounded values on 5 cases (m and yd, flat, uphill, downhill, custom atmosphere and wind); raw values agree within 5e-5 m (`tutorialPath.test.js`).

Not verified:

- **The scene has never run.** jsdom and the dev container have no WebGL, and agents do not test in a browser. Nothing of `scene.js` is covered by tests.
- Nothing was run in Electron.

The owner should check, in a desktop browser (and once on a phone):

1. Hub: the tutorial is under "More tools". Step 1 shows the profile, the warning, and the WebGL card on a browser without WebGL 2.
2. The optic matches the profile's reticle type: holographic sight for `red-dot`, riflescope for `mil-dot`, `mrad`, `moa`. The Optic chip shows the reticle.
3. Changing distance, shooter altitude and target elevation reshapes the terrain and moves the target.
4. Wind 0, 5 and 15 m/s, and a few directions: grass, leaves and flags sway, more with speed, in the right direction.
5. The four weathers look different (sky, light, fog, rain, snow).
6. Quality Low, Medium, High change the picture; the choice survives a reload; a phone starts in Low.
7. Fire: the bullet flies to the target, and the drop shown matches the Ballistic page for the same inputs.
8. Scene tour: all 5 steps, Next, Back, Exit.
9. Leaving the page and switching tabs stop the rendering (no fan or CPU load afterwards).
10. In the Capacitor app: no hub card, no sidebar entry, and the address shows "Not available in the mobile app".

## Known limitations / follow-ups

- The epic's "works in Capacitor" is replaced by "hidden in Capacitor" (owner decision); the unused `.glb` files still ship in the mobile build.
- The defaults above wait for the owner's confirmation.
- Further tutorials come with the next children of epic #180, one data file each.

## Changelog

- 2026-11-17: initial delivery
