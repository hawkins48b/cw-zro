# js-ballistics 3.1.0 on RK4, and the minimum altitude stop on the public API

- **Date:** 2026-11-12
- **Branch:** task/77-js-ballistics-3
- **Issues:** [#77](https://github.com/hawkins48b/cw-zro/issues/77), [#126](https://github.com/hawkins48b/cw-zro/issues/126)
- **Status:** Not in production yet

## Summary

`js-ballistics` goes from 2.2.0-beta.2, a pure JavaScript pre-release run on Euler, to exactly 3.1.0, run on RK4. Version 3 solves in WebAssembly: it embeds bclibc 2.0.0, a C++ engine under the LGPL-3.0. The owner accepted that licence and the result shifts. Every value outside its tolerance against 2.2 was re-recorded, with no tolerance changed, and is listed under [Baseline changes](#baseline-changes).

#126 is done in the same branch: `flightStop.js` no longer overrides the library's internal `_integrate`, and reads the minimum altitude stop from the public API only.

**Release notes:**

- Calculated results shift slightly. On the recorded baselines: drop by at most +0.11 in (imperial) or -0.23 cm (metric), velocity by at most -0.23 fps. Four Scope View values move by one display step.
- MPBR moves more where its zero moves by a whole unit. The `.308` on an 8 in target goes from 293.1 to 286.4 yd, and its saved zero from 21 to 22 yd.
- A zero of 3000 now prints a far zero of 3000 on the dope cards, where it was blank.
- New page: About > Licences and notices, with the bclibc notice and the LGPL-3.0 and GPL-3.0 texts.
- The calculators need a browser with WebAssembly and top-level `await`: Chrome 89 or later, Safari 15 or later.

## Owner decisions

| Date | Question | Decision |
|------|----------|----------|
| 2026-11-11 | Ship the LGPL-3.0 engine and accept the result shifts | Merge 3.1.0. Re-record the baselines to 3.1.0 and list every changed value in this document. Add an LGPL notice for bclibc. #126 in the same branch |
| 2026-11-12 | CSP | `'wasm-unsafe-eval'` in `script-src` (web and Electron), needed to compile the engine. JS `eval` stays blocked |
| 2026-11-12 | Integrator | RK4 instead of Euler, because it lands closer to the 2.2 results |
| 2026-11-12 | Dope card far zero of a 3000 zero | Print 3000 |
| 2026-11-12 | App-store LGPL compliance | Does not block the merge to `develop`. Open in [#143](https://github.com/hawkins48b/cw-zro/issues/143) |
| 2026-11-12 | MPBR cost test | Counts `fire` calls (at most 54) and zero solves (`setWeaponZero`, at most 2), and checks `maxIterations` 60. Integrations inside a zero solve can no longer be counted, since the solve runs in WebAssembly |

### RK4 step

The step was chosen by the developer, not the owner. RK4 in 3.1 scales its step with `stepMultiplier`. Each setting was run against the 2.2 values of the REFERENCE table in `ballistics.baseline.test.js` (shifts in tolerance units, trajectory values only):

| Integrator, `stepMultiplier` | Values outside tolerance | Sum of shifts | Largest shift | Largest drop shift (in) | Largest velocity shift (fps) |
|---|---|---|---|---|---|
| RK4, 0.25 | 150 | 322 | 10.9 | 0.069 | 0.31 |
| **RK4, 0.5 (chosen)** | 131 | 261 | 10.7 | 0.107 | 0.23 |
| RK4, 1 (3.1 default) | 118 | 265 | 18.2 | 0.182 | 0.31 |
| RK4, 2 | 172 | | | 0.383 | 0.93 |
| RK4, 4 | 255 | | | 0.797 | 2.16 |
| Euler, 0.5 (the earlier candidate) | 212 | | | 0.272 | 0.61 |

0.5 has the smallest total and the smallest largest shift. 1 leaves fewer values outside tolerance, but moves the worst one about 1.7 times as far. Blank cells were not measured.

## Changes

| Area | Change |
|------|--------|
| `package.json`, lockfile | `"js-ballistics": "3.1.0"`, exact |
| [`ballisticEngine.js`](../src/lib/utils/ballisticEngine.js) (new) | Loads the engine once with a top-level `await WasmManager.init()`. The WebAssembly is embedded in the library's bundle as base64 text, so nothing is downloaded. Exports a synchronous `Calculator` (`setWeaponZero`, `fire`), because the library's own is async and the calculations run inside reactive page state. Settings: `IntegrationMethod.RK4`, `stepMultiplier` 0.5, and the 2.2 limits restored over the 3.x defaults: `maxIterations` 60 (3.x: 40), `minimumAltitude` -1410.748 ft (3.x: -1500), `maximumDrop` -15000 ft (3.x: -10000). `EVENT_ROWS` asks for range, zero and Mach rows, not the new apex row, which would add a chart point |
| Zero retry | When the zero solve throws `SolverRuntimeError`, `setWeaponZero` tries once more from 0.5 rad. 3.1 starts from the shot's elevation and gives up when that flight never reaches the distance, as a flat shot does on a long zero of a slow load, which 2.2 solved. `ZeroFindingError` and `OutOfRangeError` are real answers and are not retried. A failed retry puts the elevation back |
| [`flightStop.js`](../src/lib/utils/flightStop.js) (#126) | Rewritten on the public API. `fire` throws the library's `RangeError` with reason `MinimumAltitudeReached`. The zero solve runs in WebAssembly and does not say why it failed, so after a failed solve the calculator fires the shot it started from to the zero distance and notes whether that flight ended at the minimum altitude. That fire only runs after a failure, so no result changes. `MINIMUM_FLIGHT_ALTITUDE_FT` now reads `ENGINE_CONFIG` |
| [`ballisticCalculator.js`](../src/lib/utils/ballisticCalculator.js) | `calculateShotPoint` returns no result for a cant that is not finite, before the zero solve: on 3.1 an infinite or NaN cant hangs the solve (2.2 returned a NaN elevation). The Scope View only passes a stored rotation within ±90°, so no result there changes. `Table` is now `DragTables`, `TrajectoryRangeError` is the library's `RangeError`, `extraData` is `EVENT_ROWS` |
| [`dopeCardZeros.js`](../src/lib/utils/dopeCardZeros.js) | `findZeroCrossings` takes the distance of a row flagged `ZERO_UP` or `ZERO_DOWN` as the crossing, and still interpolates between rows without a flag. A 3000 zero is solved so exactly that its crossing row is about 1e-13 in either side of the line, so the sign alone printed it on some loads and not on others |
| Renamed library fields | `targetDrop` is `slantHeight`, `dropAdjustment` is `dropAngle`, `windageAdjustment` is `windageAngle`: in both dope cards, trajectory validation, the Ballistic, MPBR, Compare and Trajectory Validation pages and `ScopeReticle.svelte` |
| [`inputLimits.js`](../src/lib/utils/inputLimits.js), [`zeroDistance.js`](../src/lib/utils/zeroDistance.js) | Limits read `ENGINE_CONFIG`. Comments record what changed on 3.1: the low-density case returned at once, and a zero of 0 solves to an elevation of 0. The guards stay as approved |
| Licences | [`static/licenses/`](../static/licenses/): `THIRD-PARTY-NOTICES.txt` (bclibc 2.0.0, LGPL-3.0, shipped unmodified, source link), `LGPL-3.0.txt`, `GPL-3.0.txt`. Every build ships them under `/licenses/`. New page [`/settings/about/licenses`](../src/routes/settings/about/licenses/+page.svelte) shows the three texts in collapsible blocks, imported at build time, so the Electron window never leaves the app. The About page gets a bclibc card with a GitHub link (`ballistics-lab/bclibc`, tag v2.0.0) and a link to that page |
| Messages | 8 new keys in `en`, `fr`, `de`: `about_bclibc`, `about_bclibc_desc`, `about_licenses`, `licenses_title`, `licenses_intro`, `licenses_notice_title`, `licenses_lgpl_title`, `licenses_gpl_title` |
| [`vite.config.js`](../vite.config.js) | `script-src` gets `'wasm-unsafe-eval'`. Without it Chromium refuses to compile the module and every calculator fails. `ssr.noExternal: ['js-ballistics']` is removed. It bundled 2.2 for SSR because of its extensionless imports |
| Guides | `README.md`, `CLAUDE.md` ("Pinned dependencies"), `docs/architecture.md`, `docs/ballistics-model.md`, `docs/data-and-privacy.md` (new "Licences" section), `docs/deployment.md`, `docs/testing.md`. `testing.md` also gets three per-file test counts that were already stale on `develop`: `dopeCardLayout` 56 to 75, `profileOps` 37 to 38, `storedProfiles` 230 to 237 |

### If the engine does not load

Every calculator imports `ballisticEngine.js`, which waits for the engine. If the WebAssembly cannot be compiled (no WebAssembly, no top-level `await`, or a CSP without `'wasm-unsafe-eval'`), the page fails to load and shows the error page. No calculation runs, so no wrong result is shown.

## Hangs

`js-ballistics` 3 is compiled WebAssembly. Its loop cannot be read in this repository, only probed. Probes run on this branch:

| Probe | Cases | Result |
|-------|-------|--------|
| Inside the limits, `calculateShotPoint` and `calculateFullTrajectory`: load corners (G1 and G7, BC 0.01 and 2, 60 and 9999 fps, sight height -10 and 10 in, zero 1 and 3000), standard and 24 custom atmosphere corners, no wind and 223 mph at 0° and 90°, range 3000 yd; plus MPBR on 0.1 to 33000 in and validation on the load corners | 4992 | No hang. Slowest 1.0 s, an MPBR on a 33000 in target |
| Both dope card generators with the real templates, the first probe of the cards | 576 | No hang. Slowest 0.17 s. 271 gave a card, 305 "Cannot compute" |
| Values outside the guards, given straight to the engine | 9 | All still hang: NaN velocity, 1e15 fps, NaN sight height, infinite or NaN cant, NaN wind direction, infinite wind, 1e140 mph at 45°, -300 °C, NaN altitude. Each is stopped by a guard. 1e15 fps is new on RK4 and stopped by the velocity limit. The cant is new on 3.1 and stopped by the new cant guard |

**Zero coverage.** Zeros of 100 to 3000 yd and m on the test loads and three extreme ones (726 cases): 3.1 solves the same 647 as 2.2, on the same low arc (at most 0.0025 rad apart). 55 of them need the retry from 0.5 rad.

## Baseline changes

Old is the value recorded on `origin/develop` (2.2.0-beta.2, Euler, 0.25 ft). New is what the app computes on 3.1.0 with RK4 and the settings above. Only values outside their tolerance against 2.2 were re-recorded; the others keep their 2.2 literal. No tolerance changed. All 17 published-data tests (`ballistics.published.test.js`) pass with no expected value changed.

| Where | Values changed |
|---|---|
| `ballistics.baseline.test.js`, REFERENCE table | 131 |
| `ballistics.baseline.test.js`, other tests | 32, and one test input |
| `dopeCard.baseline.test.js`, the six recorded cards | 40 labels |
| `dopeCard.baseline.test.js`, zero crossing tests | 14 printed crossings, and 2 cards that now print a far zero of 3000 (approved) |
| `windDirection.test.js` | 0 (33.92 in stays within 0.005) |

Largest shifts in the REFERENCE table:

| Value | Count changed | Largest delta | Where |
|---|---|---|---|
| Drop, imperial | 8 | +0.11 in | P223_G1, 1000 yd, ATMO_HOT_ALTITUDE |
| Drop, metric | 10 | -0.23 cm | P308_G1, 1000 m, ATMO_COLD_METRIC |
| Velocity, imperial / metric | 19 / 22 | -0.23 fps / -0.13 m/s | P338_G7_METRIC, 1000 yd / 1000 m cold |
| Windage, imperial / metric | 4 / 8 | +0.02 in / -0.11 cm | P308_G1 1000 yd / P223_G1 1000 m cold |
| Time | 3 | +0.0004 s | P223_G1, 1000 m cold |
| Energy | 5 | -1.05 J | P338_G7_METRIC, 1000 m cold |
| Zero angle | 6 | -0.0041 MOA, -0.0012 mrad | P308_G1 |
| Key points | 11 | subsonic distance +0.8 yd | P223_G1 |
| Scope View display values | 4 | 0.1 (one display step) | |
| MPBR | 31 | mpbrMax -6.7 yd (293.1 to 286.4), far zero -9 yd | P308_G1, 8 in |

Tolerances: velocity 0.05 fps / 0.02 m/s, time 0.0002 s, drop and windage 0.01 in / 0.03 cm, energy 0.5, zero angle 0.001 MOA / 0.0003 mrad, key points 0.2 (apex distance 5, apex and max drop elevation 0.1), Scope View and MPBR exact.

**Causes** (measured on #77): the 2.2 air density used hPa where Pa was expected, so density was 0.02 to 0.11 % low (fixed in 3.1); PCHIP drag interpolation instead of a quadratic fit; an exact zero solver (2.2 zeroed on its first integration step past the distance, about 0.1 yd further out); and RK4 instead of Euler. Euler's error and the density and drag corrections go opposite ways, which is why RK4 lands closer to 2.2 than 3.1's Euler.

**MPBR, `.308` on 8 in: 293.1 to 286.4 yd**, zero 21 to 22 yd, far zero 249 to 240 yd. 3.1 zeroes exactly on the distance, so a 21 yd zero (crossing at 21.06 yd) now gives an arc 4.03 in high, over the 4 in top, and the search takes 22 yd, a lower arc. With near zeros walked in 0.02 yd steps on RK4, the best is 294.0 yd at 21.06 yd, so the whole-unit zero costs 2.6 %.

**Changed test input.** "max apex (#85) > keeps an arc narrower than one unit" used a `P223_G1` zero of 111 (2.2: near 111.2, far 111.9). On 3.1 a zero of 111 gives near 111 and far 112.1, an arc 1.1 wide. An arc under one unit with no whole-unit row inside gives an apex only when a crossing row sits about 1e-13 in over the line, which RK4 and Euler decide differently. The input is now 112.05 (RK4: near 111.1, far 112.0, apex at the 112 row), which holds the 112 row by a real margin.

**The two trajectory validation cases:**

- **`P65_G7`, 800 yd, 6.5 mrad: 2660 to 2673 fps.** A rounding edge, not a real shift. The curve is flat: every velocity from 2660 to 2677 fps (2.2) or 2661 to 2677 fps (3.1) rounds to 6.5 mrad. 2660 sat exactly on the edge (-6.550 mrad on 2.2). On 3.1 it rounds to 6.6, and the halving search stops on 2673, inside the same window. The physical shift at the profile's velocity is about 0.0014 mrad.
- **`P223_SHORT_ZERO` (25 yd zero, 3.5 in sight height), 600 yd, 40 in: 3002 to 2995 fps.** A real shift of about 0.49 in at 600 yd, mostly from the exact zero: 0.1 yd of error in a 25 yd zero tilts the line by 3.5 in over 25 yd, about 0.32 in at 600 yd (measured on Euler). The rest is density and drag. At about 0.09 in per fps the answer moves 5 to 7 fps.

Both give the same result on RK4 and Euler.

Unchanged on RK4, though they moved on 3.1 with Euler: the 5° cant (-102.306 in against -102.3), validation "velocity from inches" (2567, -110.096), the wind direction values (33.92 in). On the dope cards: the imperial card of a 3000 m zero (blank), the metric card of a 3000 yd zero (2743), the 2800 yd zero (0, 2560), the imperial narrow arc (111, 112).

<details>
<summary>REFERENCE table, <code>ballistics.baseline.test.js</code>: 131 values</summary>

| Profile | Table, conditions | Case | Field | Old | New | Delta |
|---|---|---|---|---|---|---|
| P223_G1 | imperial, ICAO, 10 mph from the left | 500 yd | drop (in) | -49.55 | -49.53 | 0.02 |
| P223_G1 | imperial, ICAO, 10 mph from the left | 800 yd | velocity (fps) | 1038.74 | 1038.57 | -0.17 |
| P223_G1 | imperial, ICAO, 10 mph from the left | 800 yd | drop (in) | -232.2 | -232.14 | 0.06 |
| P223_G1 | imperial, ICAO, 10 mph from the left | 1000 yd | velocity (fps) | 895.48 | 895.31 | -0.17 |
| P223_G1 | imperial, ICAO, 10 mph from the left | 1000 yd | drop (in) | -503.62 | -503.55 | 0.07 |
| P223_G1 | imperial, ICAO, 10 mph from the left | 1000 yd | windage (in) | 191.71 | 191.73 | 0.02 |
| P223_G1 | metric, ICAO, 4 m/s from the left | 500 m | drop (cm) | -167.44 | -167.38 | 0.06 |
| P223_G1 | metric, ICAO, 4 m/s from the left | 800 m | velocity (m/s) | 297.31 | 297.25 | -0.06 |
| P223_G1 | metric, ICAO, 4 m/s from the left | 800 m | drop (cm) | -803.33 | -803.16 | 0.17 |
| P223_G1 | metric, ICAO, 4 m/s from the left | 1000 m | velocity (m/s) | 258.18 | 258.12 | -0.06 |
| P223_G1 | metric, ICAO, 4 m/s from the left | 1000 m | drop (cm) | -1746.73 | -1746.59 | 0.14 |
| P223_G1 | metric, ICAO, 4 m/s from the left | 1000 m | windage (cm) | 530.3 | 530.35 | 0.05 |
| P223_G1 | keyPointsYd, ICAO, no wind, step 5 | 1000 yd | nearZero | 100.2 | 100 | -0.2 |
| P223_G1 | keyPointsYd, ICAO, no wind, step 5 | 1000 yd | maxDrop.drop | -503.6 | -503.5 | 0.1 |
| P223_G1 | keyPointsYd, ICAO, no wind, step 5 | 1000 yd | subsonicDist | 731.2 | 732 | 0.8 |
| P223_G1 | keyPointsM, ICAO, no wind, step 5 | 1000 m | nearZero | 91.7 | 91.4 | -0.3 |
| P223_G1 | keyPointsM, ICAO, no wind, step 5 | 1000 m | farZero | 113.5 | 113.7 | 0.2 |
| P223_G1 | keyPointsM, ICAO, no wind, step 5 | 1000 m | maxDrop.drop | -1746.7 | -1746.6 | 0.1 |
| P223_G1 | keyPointsM, ICAO, no wind, step 5 | 1000 m | subsonicDist | 668.6 | 669 | 0.4 |
| P223_G1 | hotAltitude, ATMO_HOT_ALTITUDE, 10 mph from 225° | 300 yd | velocity (fps) | 2363.19 | 2363.27 | 0.08 |
| P223_G1 | hotAltitude, ATMO_HOT_ALTITUDE, 10 mph from 225° | 1000 yd | velocity (fps) | 1070.6 | 1070.5 | -0.1 |
| P223_G1 | hotAltitude, ATMO_HOT_ALTITUDE, 10 mph from 225° | 1000 yd | drop (in) | -363.72 | -363.61 | 0.11 |
| P223_G1 | hotAltitude, ATMO_HOT_ALTITUDE, 10 mph from 225° | 1000 yd | windage (in) | 98.14 | 98.13 | -0.01 |
| P223_G1 | coldMetric, ATMO_COLD_METRIC, 4 m/s from 120° | 300 m | velocity (m/s) | 668.35 | 668.3 | -0.05 |
| P223_G1 | coldMetric, ATMO_COLD_METRIC, 4 m/s from 120° | 1000 m | velocity (m/s) | 274.35 | 274.28 | -0.07 |
| P223_G1 | coldMetric, ATMO_COLD_METRIC, 4 m/s from 120° | 1000 m | time (s) | 2.1628 | 2.1632 | 0.0004 |
| P223_G1 | coldMetric, ATMO_COLD_METRIC, 4 m/s from 120° | 1000 m | drop (cm) | -1469.54 | -1469.72 | -0.18 |
| P223_G1 | coldMetric, ATMO_COLD_METRIC, 4 m/s from 120° | 1000 m | windage (cm) | -399.26 | -399.37 | -0.11 |
| P223_G1 | scope600yd, ICAO, 10 mph from the left | 600 yd, CM | elevation (display) | -225.8 | -225.7 | 0.1 |
| P223_G1 | mpbr8in, MPBR | 8 in | farZero | 286 | 287 | 1 |
| P223_G1 | mpbr8in, MPBR | 8 in | mpbrMax | 331.7 | 332.5 | 0.8 |
| P223_G1 | mpbr8in, MPBR | 8 in | maxOrdinate.elevation | 3.9 | 4 | 0.1 |
| P223_G1 | mpbr20cm, MPBR | 20 cm | farZero | 260 | 261 | 1 |
| P223_G1 | mpbr20cm, MPBR | 20 cm | mpbrMax | 301.4 | 301.9 | 0.5 |
| P223_G1 | mpbr20cm, MPBR | 20 cm | maxOrdinate.distance | 154 | 155 | 1 |
| P308_G1 | imperial, ICAO, 10 mph from the left | 300 yd | velocity (fps) | 2094.4 | 2094.3 | -0.1 |
| P308_G1 | imperial, ICAO, 10 mph from the left | 500 yd | velocity (fps) | 1765.42 | 1765.29 | -0.13 |
| P308_G1 | imperial, ICAO, 10 mph from the left | 800 yd | velocity (fps) | 1351.93 | 1351.74 | -0.19 |
| P308_G1 | imperial, ICAO, 10 mph from the left | 1000 yd | velocity (fps) | 1151.82 | 1151.6 | -0.22 |
| P308_G1 | imperial, ICAO, 10 mph from the left | 1000 yd | drop (in) | -422.41 | -422.43 | -0.02 |
| P308_G1 | imperial, ICAO, 10 mph from the left | 1000 yd | windage (in) | 110.8 | 110.82 | 0.02 |
| P308_G1 | metric, ICAO, 4 m/s from the left | 300 m | velocity (m/s) | 623.65 | 623.63 | -0.02 |
| P308_G1 | metric, ICAO, 4 m/s from the left | 500 m | velocity (m/s) | 516.29 | 516.25 | -0.04 |
| P308_G1 | metric, ICAO, 4 m/s from the left | 800 m | velocity (m/s) | 386.65 | 386.58 | -0.07 |
| P308_G1 | metric, ICAO, 4 m/s from the left | 1000 m | velocity (m/s) | 330.41 | 330.34 | -0.07 |
| P308_G1 | metric, ICAO, 4 m/s from the left | 1000 m | drop (cm) | -1395.79 | -1395.88 | -0.09 |
| P308_G1 | metric, ICAO, 4 m/s from the left | 1000 m | windage (cm) | 310.15 | 310.21 | 0.06 |
| P308_G1 | zeroMoa, zero angle | muzzle row | angle | 3.922 | 3.918 | -0.004 |
| P308_G1 | zeroMrad, zero angle | muzzle row | angle | 1.14087 | 1.13967 | -0.0012 |
| P308_G1 | keyPointsYd, ICAO, no wind, step 5 | 1000 yd | farZero | 100.2 | 100 | -0.2 |
| P308_G1 | keyPointsM, ICAO, no wind, step 5 | 1000 m | maxDrop.drop | -1395.8 | -1395.9 | -0.1 |
| P308_G1 | hotAltitude, ATMO_HOT_ALTITUDE, 10 mph from 225° | 1000 yd | velocity (fps) | 1371.14 | 1371.06 | -0.08 |
| P308_G1 | hotAltitude, ATMO_HOT_ALTITUDE, 10 mph from 225° | 1000 yd | drop (in) | -356.16 | -356.15 | 0.01 |
| P308_G1 | coldMetric, ATMO_COLD_METRIC, 4 m/s from 120° | 300 m | velocity (m/s) | 644.81 | 644.76 | -0.05 |
| P308_G1 | coldMetric, ATMO_COLD_METRIC, 4 m/s from 120° | 1000 m | velocity (m/s) | 358.82 | 358.71 | -0.11 |
| P308_G1 | coldMetric, ATMO_COLD_METRIC, 4 m/s from 120° | 1000 m | time (s) | 1.8925 | 1.8928 | 0.0003 |
| P308_G1 | coldMetric, ATMO_COLD_METRIC, 4 m/s from 120° | 1000 m | drop (cm) | -1252.37 | -1252.6 | -0.23 |
| P308_G1 | coldMetric, ATMO_COLD_METRIC, 4 m/s from 120° | 1000 m | windage (cm) | -227.27 | -227.36 | -0.09 |
| P308_G1 | scope600yd, ICAO, 10 mph from the left | 600 yd, FT | elevation (display) | -8.51 | -8.52 | -0.01 |
| P308_G1 | mpbr8in, MPBR | 8 in | optimalZero | 21 | 22 | 1 |
| P308_G1 | mpbr8in, MPBR | 8 in | nearZero | 21 | 22 | 1 |
| P308_G1 | mpbr8in, MPBR | 8 in | farZero | 249 | 240 | -9 |
| P308_G1 | mpbr8in, MPBR | 8 in | mpbrMax | 293.1 | 286.4 | -6.7 |
| P308_G1 | mpbr8in, MPBR | 8 in | maxOrdinate.elevation | 4 | 3.6 | -0.4 |
| P308_G1 | mpbr8in, MPBR | 8 in | maxOrdinate.distance | 138 | 134 | -4 |
| P308_G1 | mpbr20cm, MPBR | 20 cm | farZero | 220 | 221 | 1 |
| P308_G1 | mpbr20cm, MPBR | 20 cm | mpbrMax | 261.3 | 262.2 | 0.9 |
| P308_G1 | mpbr20cm, MPBR | 20 cm | maxOrdinate.elevation | 9.2 | 9.3 | 0.1 |
| P65_G7 | imperial, ICAO, 10 mph from the left | 300 yd | velocity (fps) | 2274.31 | 2274.23 | -0.08 |
| P65_G7 | imperial, ICAO, 10 mph from the left | 500 yd | velocity (fps) | 2008.15 | 2008.01 | -0.14 |
| P65_G7 | imperial, ICAO, 10 mph from the left | 800 yd | velocity (fps) | 1640.46 | 1640.26 | -0.2 |
| P65_G7 | imperial, ICAO, 10 mph from the left | 1000 yd | velocity (fps) | 1413.55 | 1413.32 | -0.23 |
| P65_G7 | imperial, ICAO, 10 mph from the left | 1000 yd | drop (in) | -328.3 | -328.31 | -0.01 |
| P65_G7 | imperial, ICAO, 10 mph from the left | 1000 yd | windage (in) | 83.14 | 83.16 | 0.02 |
| P65_G7 | metric, ICAO, 4 m/s from the left | 300 m | velocity (m/s) | 681.46 | 681.43 | -0.03 |
| P65_G7 | metric, ICAO, 4 m/s from the left | 500 m | velocity (m/s) | 593.9 | 593.86 | -0.04 |
| P65_G7 | metric, ICAO, 4 m/s from the left | 800 m | velocity (m/s) | 473.59 | 473.53 | -0.06 |
| P65_G7 | metric, ICAO, 4 m/s from the left | 1000 m | velocity (m/s) | 400.14 | 400.07 | -0.07 |
| P65_G7 | metric, ICAO, 4 m/s from the left | 1000 m | drop (cm) | -1067.36 | -1067.42 | -0.06 |
| P65_G7 | metric, ICAO, 4 m/s from the left | 1000 m | windage (cm) | 237.54 | 237.59 | 0.05 |
| P65_G7 | zeroMoa, zero angle | muzzle row | angle | 4.1642 | 4.1611 | -0.0031 |
| P65_G7 | zeroMrad, zero angle | muzzle row | angle | 1.2113 | 1.2104 | -0.0009 |
| P65_G7 | keyPointsYd, ICAO, no wind, step 5 | 1000 yd | nearZero | 75 | 75.2 | 0.2 |
| P65_G7 | keyPointsYd, ICAO, no wind, step 5 | 1000 yd | farZero | 100.2 | 100 | -0.2 |
| P65_G7 | hotAltitude, ATMO_HOT_ALTITUDE, 10 mph from 225° | 1000 yd | velocity (fps) | 1651.54 | 1651.46 | -0.08 |
| P65_G7 | coldMetric, ATMO_COLD_METRIC, 4 m/s from 120° | 300 m | velocity (m/s) | 698.38 | 698.34 | -0.04 |
| P65_G7 | coldMetric, ATMO_COLD_METRIC, 4 m/s from 120° | 1000 m | velocity (m/s) | 445.34 | 445.22 | -0.12 |
| P65_G7 | coldMetric, ATMO_COLD_METRIC, 4 m/s from 120° | 1000 m | time (s) | 1.6503 | 1.6505 | 0.0002 |
| P65_G7 | coldMetric, ATMO_COLD_METRIC, 4 m/s from 120° | 1000 m | drop (cm) | -982.88 | -983.02 | -0.14 |
| P65_G7 | coldMetric, ATMO_COLD_METRIC, 4 m/s from 120° | 1000 m | windage (cm) | -127.46 | -127.52 | -0.06 |
| P65_G7 | coldMetric, ATMO_COLD_METRIC, 4 m/s from 120° | 1000 m | energy (J) | 899.7 | 899.2 | -0.5 |
| P65_G7 | scope600yd, ICAO, 10 mph from the left | 600 yd, IN | elevation (display) | -84.9 | -85 | -0.1 |
| P65_G7 | mpbr8in, MPBR | 8 in | farZero | 264 | 265 | 1 |
| P65_G7 | mpbr8in, MPBR | 8 in | mpbrMax | 311 | 312.3 | 1.3 |
| P65_G7 | mpbr8in, MPBR | 8 in | maxOrdinate.elevation | 3.9 | 4 | 0.1 |
| P65_G7 | mpbr8in, MPBR | 8 in | maxOrdinate.distance | 148 | 149 | 1 |
| P65_G7 | mpbr20cm, MPBR | 20 cm | farZero | 239 | 240 | 1 |
| P65_G7 | mpbr20cm, MPBR | 20 cm | mpbrMax | 281.7 | 282.7 | 1 |
| P65_G7 | mpbr20cm, MPBR | 20 cm | maxOrdinate.elevation | 9.7 | 9.8 | 0.1 |
| P65_G7 | mpbr20cm, MPBR | 20 cm | maxOrdinate.distance | 134 | 135 | 1 |
| P338_G7_METRIC | imperial, ICAO, 10 mph from the left | 300 yd | velocity (fps) | 2534.07 | 2533.99 | -0.08 |
| P338_G7_METRIC | imperial, ICAO, 10 mph from the left | 500 yd | velocity (fps) | 2264.53 | 2264.39 | -0.14 |
| P338_G7_METRIC | imperial, ICAO, 10 mph from the left | 800 yd | velocity (fps) | 1892.71 | 1892.51 | -0.2 |
| P338_G7_METRIC | imperial, ICAO, 10 mph from the left | 1000 yd | velocity (fps) | 1663.18 | 1662.95 | -0.23 |
| P338_G7_METRIC | imperial, ICAO, 10 mph from the left | 1000 yd | drop (in) | -255.18 | -255.19 | -0.01 |
| P338_G7_METRIC | metric, ICAO, 4 m/s from the left | 300 m | velocity (m/s) | 760.53 | 760.51 | -0.02 |
| P338_G7_METRIC | metric, ICAO, 4 m/s from the left | 500 m | velocity (m/s) | 671.78 | 671.73 | -0.05 |
| P338_G7_METRIC | metric, ICAO, 4 m/s from the left | 800 m | velocity (m/s) | 550.23 | 550.16 | -0.07 |
| P338_G7_METRIC | metric, ICAO, 4 m/s from the left | 800 m | energy (J) | 2452.5 | 2451.9 | -0.6 |
| P338_G7_METRIC | metric, ICAO, 4 m/s from the left | 1000 m | velocity (m/s) | 475.54 | 475.46 | -0.08 |
| P338_G7_METRIC | metric, ICAO, 4 m/s from the left | 1000 m | drop (cm) | -825.6 | -825.63 | -0.03 |
| P338_G7_METRIC | metric, ICAO, 4 m/s from the left | 1000 m | windage (cm) | 191.84 | 191.88 | 0.04 |
| P338_G7_METRIC | metric, ICAO, 4 m/s from the left | 1000 m | energy (J) | 1831.9 | 1831.3 | -0.6 |
| P338_G7_METRIC | zeroMoa, zero angle | muzzle row | angle | 3.8582 | 3.8559 | -0.0023 |
| P338_G7_METRIC | zeroMrad, zero angle | muzzle row | angle | 1.12231 | 1.12163 | -0.00068 |
| P338_G7_METRIC | hotAltitude, ATMO_HOT_ALTITUDE, 10 mph from 225° | 1000 yd | velocity (fps) | 1903.56 | 1903.47 | -0.09 |
| P338_G7_METRIC | coldMetric, ATMO_COLD_METRIC, 4 m/s from 120° | 300 m | velocity (m/s) | 777.78 | 777.73 | -0.05 |
| P338_G7_METRIC | coldMetric, ATMO_COLD_METRIC, 4 m/s from 120° | 300 m | energy (J) | 4900.4 | 4899.8 | -0.6 |
| P338_G7_METRIC | coldMetric, ATMO_COLD_METRIC, 4 m/s from 120° | 1000 m | velocity (m/s) | 521.34 | 521.21 | -0.13 |
| P338_G7_METRIC | coldMetric, ATMO_COLD_METRIC, 4 m/s from 120° | 1000 m | drop (cm) | -767.47 | -767.56 | -0.09 |
| P338_G7_METRIC | coldMetric, ATMO_COLD_METRIC, 4 m/s from 120° | 1000 m | windage (cm) | -99.34 | -99.39 | -0.05 |
| P338_G7_METRIC | coldMetric, ATMO_COLD_METRIC, 4 m/s from 120° | 1000 m | energy (J) | 2201.7 | 2200.7 | -1 |
| P338_G7_METRIC | scope600yd, ICAO, 10 mph from the left | 600 yd, IN | windage (display) | 21.4 | 21.5 | 0.1 |
| P338_G7_METRIC | mpbr8in, MPBR | 8 in | farZero | 287 | 288 | 1 |
| P338_G7_METRIC | mpbr8in, MPBR | 8 in | mpbrMax | 338.9 | 340 | 1.1 |
| P338_G7_METRIC | mpbr20cm, MPBR | 20 cm | optimalZero | 28 | 29 | 1 |
| P338_G7_METRIC | mpbr20cm, MPBR | 20 cm | nearZero | 28 | 29 | 1 |
| P338_G7_METRIC | mpbr20cm, MPBR | 20 cm | farZero | 265 | 258 | -7 |
| P338_G7_METRIC | mpbr20cm, MPBR | 20 cm | mpbrMax | 311.8 | 305.9 | -5.9 |
| P338_G7_METRIC | mpbr20cm, MPBR | 20 cm | maxOrdinate.elevation | 10 | 9.2 | -0.8 |
| P338_G7_METRIC | mpbr20cm, MPBR | 20 cm | maxOrdinate.distance | 149 | 146 | -3 |

</details>

<details>
<summary>Other tests in <code>ballistics.baseline.test.js</code>: 32 values</summary>

| Test | Case | Field | Old | New | Delta |
|---|---|---|---|---|---|
| trajectory validation baseline | velocity from angle in mrad, yd (P65_G7, 800 yd, 6.5 mrad) | validatedVelocity | 2660 | 2673 | +13 |
| trajectory validation baseline | velocity from angle in mrad, yd | validated point (mrad) | -6.55 | -6.476 | +0.074 |
| trajectory validation baseline | BC from inches, yd (P223_G1, 500 yd, 75 in) | validated point (in) | -75.425 | -75.374 | +0.051 |
| trajectory validation baseline | velocity from cm, metric profile (P338_G7_METRIC, 1000 m, 750 cm) | validated point (cm) | -747.988 | -748.014 | -0.026 |
| trajectory validation baseline | velocity in a custom atmosphere (P308_G1, 600 yd, hot) | validated point (in) | -109.965 | -109.975 | -0.010 (0.0105 unrounded) |
| trajectory validation above the line of sight (#82) | 3 in below, P223_SHORT_ZERO, 100 yd | validatedVelocity | 1016 | 1013 | -3 |
| trajectory validation above the line of sight (#82) | beyond the far zero crossing, P223_SHORT_ZERO, 600 yd, 40 in | validatedVelocity | 3002 | 2995 | -7 |
| humidity | 0 % (P308_G1, 1000 yd, ATMO_HOT_ALTITUDE) | velocity (fps) / drop (in) | 1355.823 / -359.676 | 1355.754 / -359.661 | -0.069 / +0.015 |
| humidity | 0.5 % | velocity / drop | 1355.908 / -359.656 | 1355.84 / -359.641 | -0.068 / +0.015 |
| humidity | 1 % | velocity / drop | 1355.993 / -359.635 | 1355.925 / -359.62 | -0.068 / +0.015 |
| humidity | 2 % | velocity / drop | 1356.163 / -359.593 | 1356.095 / -359.579 | -0.068 / +0.014 |
| humidity | 100 % | velocity / drop | 1373.025 / -355.559 | 1372.86 / -355.569 | -0.165 / -0.010 |
| max apex (#85) | a short zero, yd (P223_SHORT_ZERO) | apex elevation (in) | 17.7 | 18 | +0.3 (distance 267 against 266, within its 1 unit: kept) |
| max apex (#85) | a short zero, m | apex elevation (cm) | 45.1 | 45.7 | +0.6 (distance 244 against 243: kept) |
| max drop and subsonic distance (#94) | P308_G1: range with no subsonic distance | it.each input | 1046 | 1045 | -1 |
| max drop and subsonic distance (#94) | range giving it at the range | it.each input and expected | 1047 -> 1047 | 1046 -> 1046 | -1 |
| max drop and subsonic distance (#94) | 1100 yd range | expected | 1047 | 1046 | -1 |
| MPBR search (#86) | values on the targets of #86: 30 in | mpbrMax (yd) | 479.2 | 482.7 | +3.5 |
| MPBR search (#86) | 20 in | mpbrMax (yd) | 417.7 | 420.5 | +2.8 |
| MPBR search (#86) | 8 in | mpbrMax (yd) | 293.1 | 286.4 | -6.7 |
| MPBR search (#86) | not limited by the old 900 unit range, 300 in | mpbrMax (yd) | 1048.8 | 1063.7 | +14.9 |
| MPBR search (#86) | near crossing for every target size, 4 in | optimalZero (zeros[4]) | 28 | 29 | +1 |
| MPBR search (#86) | closest whole near zero, 3 in | optimalZero | 31 | 32 | +1 |
| MPBR search (#86) | closest whole near zero, 8 in | optimalZero | 21 | 22 | +1 |
| MPBR search (#86) > where the bullet enters the zone | not on the 5 unit grid, 1 in | mpbrMin (yd) | 25.9 | 25.8 | -0.1 |
| MPBR search (#86) > targets and loads at the limits | slow load (300 fps), 8 in | mpbrMax (yd) | 31.6 | 32.6 | +1 |

The subsonic rows are the `it.each` inputs `[1046, null], [1047, 1047], [1100, 1047]`, now `[1045, null], [1046, 1046], [1100, 1046]`: on 3.1 the bullet goes under the shooter's speed of sound between 1045 and 1046 yd, on 2.2 between 1046 and 1047.

</details>

<details>
<summary><code>dopeCard.baseline.test.js</code>: 40 labels and the zero crossings</summary>

Labels as printed. Graph is the drop at that distance on the card; points of aim are MOA (imperial) or mrad (metric).

| Test | Field | Old | New |
|---|---|---|---|
| imperial dope card > records a card from imperial inputs | graph at 225 | -6.3 | -6.4 |
| imperial dope card > converts metric inputs | points of aim 300 elevation | +3 | +3.1 |
| metric dope card > records a card from metric inputs | graph at 75 | 0 | -0.1 |
| metric dope card > records a card from metric inputs | graph at 500 | -132 | -132.1 |
| metric dope card > converts imperial inputs | far zero | 92 | 91 |
| metric dope card > converts imperial inputs | graph at 375 | -93.1 | -93.2 |
| metric dope card > converts imperial inputs | graph at 475 | -176.2 | -176.3 |
| metric dope card > converts imperial inputs | graph at 500 | -202.2 | -202.3 |
| subsonic dope cards (#136) > records the imperial card | graph at 125 | -4.8 | -4.9 |
| subsonic dope cards (#136) > records the imperial card | graph at 150 | -11.9 | -12 |
| subsonic dope cards (#136) > records the imperial card | graph at 225 | -47.3 | -47.4 |
| subsonic dope cards (#136) > records the imperial card | graph at 250 | -63.9 | -64 |
| subsonic dope cards (#136) > records the imperial card | graph at 300 | -104.5 | -104.6 |
| subsonic dope cards (#136) > records the imperial card | graph at 350 | -155.2 | -155.3 |
| subsonic dope cards (#136) > records the imperial card | graph at 375 | -184.4 | -184.5 |
| subsonic dope cards (#136) > records the imperial card | graph at 400 | -216.3 | -216.4 |
| subsonic dope cards (#136) > records the imperial card | graph at 425 | -250.8 | -250.9 |
| subsonic dope cards (#136) > records the imperial card | graph at 450 | -288 | -288.2 |
| subsonic dope cards (#136) > records the imperial card | graph at 475 | -328 | -328.1 |
| subsonic dope cards (#136) > records the imperial card | graph at 500 | -370.8 | -370.9 |
| subsonic dope cards (#136) > records the imperial card | points of aim 200 elevation | +15.8 | +15.9 |
| subsonic dope cards (#136) > records the imperial card | points of aim 400 elevation | +51.6 | +51.7 |
| subsonic dope cards (#136) > records the metric card | far zero | 92 | 91 |
| subsonic dope cards (#136) > records the metric card | graph at 75 | +5.4 | +5.3 |
| subsonic dope cards (#136) > records the metric card | graph at 125 | -20 | -20.1 |
| subsonic dope cards (#136) > records the metric card | graph at 150 | -43.1 | -43.2 |
| subsonic dope cards (#136) > records the metric card | graph at 175 | -73.2 | -73.3 |
| subsonic dope cards (#136) > records the metric card | graph at 200 | -110.6 | -110.7 |
| subsonic dope cards (#136) > records the metric card | graph at 225 | -155.3 | -155.4 |
| subsonic dope cards (#136) > records the metric card | graph at 250 | -207.4 | -207.6 |
| subsonic dope cards (#136) > records the metric card | graph at 275 | -267.1 | -267.3 |
| subsonic dope cards (#136) > records the metric card | graph at 300 | -334.5 | -334.7 |
| subsonic dope cards (#136) > records the metric card | graph at 325 | -409.7 | -409.9 |
| subsonic dope cards (#136) > records the metric card | graph at 350 | -492.8 | -493 |
| subsonic dope cards (#136) > records the metric card | graph at 375 | -584 | -584.2 |
| subsonic dope cards (#136) > records the metric card | graph at 400 | -683.3 | -683.5 |
| subsonic dope cards (#136) > records the metric card | graph at 425 | -790.8 | -791.1 |
| subsonic dope cards (#136) > records the metric card | graph at 450 | -906.8 | -907.1 |
| subsonic dope cards (#136) > records the metric card | graph at 475 | -1031.3 | -1031.6 |
| subsonic dope cards (#136) > records the metric card | graph at 500 | -1164.4 | -1164.8 |

Zero crossing tests, [near, far] as printed:

| Test | Case | Old | New |
|---|---|---|---|
| prints both crossings of a .308 zeroed at 100 yd | metric | 51, 92 | 51, 91 |
| prints the real crossings of a saved MPBR zero | imperial, 8 in | 21, 249 | 22, 240 |
| prints the real crossings of a saved MPBR zero | metric, 8 in | 19, 228 | 20, 220 |
| prints the real crossings of a saved MPBR zero | imperial, 20 cm | 22, 240 | 22, 242 |
| prints the real crossings of a saved MPBR zero | metric, 20 cm | 20, 220 | 20, 221 |
| prints a saved zero past the 500 units of the card (100 in MPBR zero) | imperial | 6, 667 | 7, 610 |
| prints a saved zero past the 500 units of the card | metric | 6, 610 | 6, 558 |
| prints the far crossing of a short zero | imperial | 25, 465 | 25, 467 |
| prints the far crossing of a short zero | metric | 23, 425 | 23, 427 |
| keeps an arc narrower than a row (P223_G1, zero 111) | metric | 102, 102 | 102, 103 |
| leaves near zero blank when the muzzle is on the line of sight | metric, far zero | 92 | 91 |
| far zero at the end of the search range (P308_G1, 3000 yd zero) | imperial | blank | 3000 (approved) |
| far zero at the end of the search range (#124, P308_G1, 3000 m zero) | metric | blank | 3000 (approved) |

The short zero MPBR test compares with the MPBR result, which moved from 49, 280 to 49, 281.

</details>

### Test changes that are not expected values

| File | Change |
|---|---|
| `stationPressure.test.js` | Compares every row field except `densityRatio`, which 3.1 reports against the standard density at the site altitude. The motion is identical |
| `windGuard.test.js`, `windDirection.test.js` | New `fixtures/windVector.js` rebuilds 2.2's `Wind.vector` |
| `ballistics.baseline.test.js` | MPBR cost test as decided above |
| `nanElevation.test.js` | A cant that is not finite is stopped before the solve |
| `minimumAltitude.test.js` | The error types of a failed 3.1 zero solve |
| `dopeCard.baseline.test.js` | 3000 zero tests for the new behaviour, `findZeroCrossings` with flagged rows |
| `electronHardening.test.js` | Exact version 3.1.0 |
| All | `Calculator` from `#lib/utils/ballisticEngine.js`, renamed library fields |

## Tests and checks

- `npm run test:run`: 3951 passed, 1 todo, in 35 files. `src/test/minimumAltitude.test.js` passes on 3.1.0 (#126).
- `npm run build`, `npm run build:mobile` and `npm run audit:check` pass.
- Browser check in Chromium of the web and the mobile build: Scope View, Ballistic, MPBR, Compare, Trajectory Validation, both dope cards, About and Licences, in English, French and German. No console error and no CSP violation.

## Security review

PASS, with nothing to fix. Not checked: whether a crash inside the WebAssembly can leave its memory damaged for later calls. No input within the guards was found that triggers one.

## Not verified

- The packaged Electron app.
- Real Android and iOS devices, and older WebViews (top-level `await`, WebAssembly).
- The shipped WebAssembly against the bclibc 2.0.0 source.

## Open

- [#143](https://github.com/hawkins48b/cw-zro/issues/143): what the LGPL asks of the app-store builds.
