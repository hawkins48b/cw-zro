# Wind direction from where the wind comes, long metric dope card zero, aborted ApexCharts request

- **Date:** 2026-11-11
- **Branch:** task/106-wind-crossing-chunk
- **Issues:** [#106](https://github.com/hawkins48b/cw-zro/issues/106), [#124](https://github.com/hawkins48b/cw-zro/issues/124), [#99](https://github.com/hawkins48b/cw-zro/issues/99)
- **Status:** Not in production yet

## Summary

Three issues in one branch. Only #106 changes code. #124 and #99 were investigated and explained, with a test for #124 and a note in a guide for #99.

| Issue | Change |
|-------|--------|
| #106 | The wind direction now means where the wind comes **from**, clockwise from the target: 0° headwind, 90° from the right, 180° tailwind, 270° from the left. A wind from the right now drifts the bullet left. Saved winds are converted once, so their results do not change |
| #124 | No code change. The 2743.3 m far crossing is right: the `.308` test profile's "3000" zero is in yards (2743.2 m). Tests pin it |
| #99 | No code change. The aborted ApexCharts request is the old page's request, cancelled by a reload. The new page loads the chunk and draws the chart. Harmless; written down in [architecture.md](architecture.md) |

**Release note:** the wind direction now means where the wind comes from (90° = from the right). Saved winds are converted automatically. An empty direction is now a headwind.

## Wind direction (#106)

### What was wrong

The engine (js-ballistics `Wind.directionFrom`) reads 0° as a tailwind and 90° as a wind from the left. The app gave it the entered angle unchanged. So entering 90° gave a wind from the left, and the bullet drifted right: +33.92 in at 600 yd, 10 mph, `P308_G1` (developer's measurement). A shooter reading 90° or 3 o'clock as "from the right" got the windage with the wrong sign. The dial comment called the arrowhead the "source end", which it was not.

### Owner decisions (2026-11-11)

- The shown and entered angle is where the wind comes from, clockwise from the target. The engine gets that angle plus 180°.
- An empty box is 0°, so it is now a headwind (it was a tailwind).
- Saved directions are converted once (+180°), so saved results do not change. An empty saved direction becomes `180`.
- The default direction stays `90`. Its speed is 0, so no result changes, but the preset now means wind from the right. This was chosen by the main session and reported to the owner; **not yet confirmed**.

### What the user sees

On the Ballistic page (`/calculators/ballistic`) and Scope View (`/scope-view`), the wind control:

| Entered | Clock | Wind | Effect, 10 mph, `.308` test profile |
|---------|-------|------|-------------------------------------|
| 0° | 12 | Headwind, from the target | More drop than no wind |
| 90° | 3 | From the right | −33.92 in at 600 yd (drift left) |
| 180° | 6 | Tailwind | Less drop than no wind |
| 270° | 9 | From the left | +33.92 in at 600 yd (drift right) |

- The Wind icon on the dial sits at the entered angle, where the wind comes from. The arrowhead points where the wind blows. Dragging still sets the angle under the pointer, so it moves the Wind icon.
- A new line under the direction box says what the angle means: `scope_view_wind_dir_from` ("Where the wind comes from: 0° = from the target, 90° = from the right"), in en, fr and de. The fr and de texts were not reviewed by a native speaker.

### Saved winds

Both stores (`zro-ballistic`, `zro-scope-view`) convert their stored wind when they load, through `migrateStoredWind` in [`storedWind.js`](../src/lib/utils/storedWind.js):

| Stored direction | Becomes |
|------------------|---------|
| A value `shotWinds` reads (`'90'`, `-90.5`, `'1,5'`, `'90abc'`) | The angle half a turn away, as text in [0, 360), rounded to 1e-9°: `'270'`, `'89.5'`, `'181.5'`, `'270'` |
| Empty or whitespace (was a tailwind) | `'180'` |
| Anything `shotWinds` rejects (text, beyond 1e6°, array, object, boolean, null, missing) | Unchanged, still no result |
| Scope View clock value (older shape with `directionUnit`) | Degrees first, as before (3 o'clock → 90), then converted (→ 270). Same result as before |

The converted wind gets `directionConvention: 'from-target'`. A wind with that marker is returned as the same object, so a reload writes nothing and does not convert it back. `patchWind` keeps the marker on every change, and the default winds already carry it. A stored wind that is not an object is left as it is; the next change writes the default wind with the marker.

### Not changed

- The dope cards build their crosswind with the engine's 90° directly (`dopeCardImperial.js`, `dopeCardMetric.js`). They print the windage unsigned, with `LI` and `ST` labels only, so nothing on them changes.
- MPBR and Trajectory Validation have no wind.

## Long metric dope card zero (#124)

Cause: `P308_G1` saves its zero with `zeroUnit: 'yd'`. A "3000" zero is 3000 yd = 2743.2 m.

| Card | Zero | Search range | Far zero printed |
|------|------|--------------|------------------|
| Metric | 3000 yd (2743.2 m) | 3000 m | `2743.3`. The crossing is 0.1 past the zero because the solver checks height one integration step past the distance |
| Imperial | 3000 yd | 3000 yd | Blank: the crossing lies just past the end of the search |
| Metric or imperial | 3000 m | 3000 | Blank on both, for the same reason |

So the value is right, and the blank imperial far zero is the end of the search range, as before. No result changed. New tests in [`dopeCard.baseline.test.js`](../src/test/dopeCard.baseline.test.js) pin all three cases.

## Aborted ApexCharts request (#99)

Reproduced on 2026-11-11 in Chromium, with a production build behind a static server with an `index.html` fallback. The chart pages (Ballistic, MPBR, Trajectory Validation, Compare) import ApexCharts in `onMount`, after the first paint. Reloading or leaving before that response arrives makes the browser cancel the old document's request (`net::ERR_ABORTED`). The new document fetches the chunk again and renders the chart, with no page error. Delaying the chunk by 400 ms makes the abort happen every time; once the chunk has loaded, nothing aborts. Chunk paths are absolute (`/_app/immutable/...`), so a deep URL does not change them. A language redirect at startup (#96) also cancels the first document's requests, but ApexCharts is not among them. Written down in [architecture.md](architecture.md) under the build targets. The browser script was not kept.

## Technical changes

| File | Change |
|------|--------|
| [`windDirection.js`](../src/lib/utils/windDirection.js) | New. `halfTurn(degrees)` (shown ↔ engine angle, in [0, 360)); `MAX_WIND_DIRECTION_DEGREES` moved here from `shotWind.js` |
| [`shotWind.js`](../src/lib/utils/shotWind.js) | `shotWinds` gives the engine `halfTurn` of the entered angle. The 1e6° limit is checked on the entered angle |
| [`storedWind.js`](../src/lib/utils/storedWind.js) | New `WIND_FROM_TARGET`, `shownWindDirection`, `migrateStoredWind` |
| [`ballistic.svelte.js`](../src/lib/stores/ballistic.svelte.js), [`scopeView.svelte.js`](../src/lib/stores/scopeView.svelte.js) | Default wind carries the marker; one-time conversion at import. Scope View's clock migration now goes through `migrateStoredWind` |
| [`localStore.svelte.js`](../src/lib/stores/localStore.svelte.js) | `write()` catches a refused `localStorage.setItem` and warns; the value stays in memory (security review) |
| [`WindInput.svelte`](../src/lib/components/WindInput.svelte) | Arrow and Wind icon turned by angle + 180°; comments fixed; hint line under the direction box |
| [`ballisticCalculator.js`](../src/lib/utils/ballisticCalculator.js) | JSDoc of the wind parameter only |
| `messages/en.json`, `fr.json`, `de.json` | New `scope_view_wind_dir_from`. Each language now has 382 keys |

Guides: the developer updated [ballistics-model.md](ballistics-model.md) (Wind section and table, dope cards, input guards), [architecture.md](architecture.md) (stored wind conversion, aborted ApexCharts request) and [testing.md](testing.md). The documentor corrected the test count in testing.md (3850 in 32 files), added the `localStore.test.js` row, and updated the key count in [translations.md](translations.md).

## Checks

- `npm run test:run`: 3850 passed, 1 todo, 32 files (rerun by the documentor). New: [`windDirection.test.js`](../src/test/windDirection.test.js) (88, on the real engine), [`localStore.test.js`](../src/test/localStore.test.js) (2). Extended: [`storedStores.test.js`](../src/test/storedStores.test.js), [`dopeCard.baseline.test.js`](../src/test/dopeCard.baseline.test.js), [`windGuard.test.js`](../src/test/windGuard.test.js).
- **No expected value changed.** Test inputs were converted to the new convention, so they describe the same wind: `WIND_10MPH` and `WIND_4MPS` 90 → 270; baseline quartering winds 45 → 225 and 300 → 120; the mirrored pair 90/270 → 270/90; one `windGuard` reference 90 → 270; the stored clock wind in `storedStores` now reads `'270'`.
- `npm run build` passes.
- Not run: `npm run build:mobile`, Electron. The dial was checked in Chromium on the production build: an old saved 90 shows as 270 and stays 270 after a reload, the icon sits on the left, the arrow points right, and Scope View says "LEFT 13" clicks. Typing 90 moves the icon to the right and gives "RIGHT 13". No page errors. That run came before the hint line wording was final and before the `localStore` fix.

## Security review

Verdict: PASS.

- Low, fixed: a storage write while a store loads (a seed, or the new wind conversion) could throw when storage is full or blocked, and stop the page loading. `localStore` now catches it, warns, and keeps the value in memory. Pinned by `localStore.test.js`.
- Pre-existing, not changed: an old clock value can store the text `'NaN'` from `parseInt`, as before, with no result and no hang.
- Accepted: a tab still running the pre-#106 build can save a direction in the old convention on a wind that already carries the marker. The old `patchWind` keeps the fields it does not know, so the marker stays, and the new build does not convert that direction. Web only, and only with two versions open at once.

## Known limitations / follow-ups

- The default direction `'90'` now means wind from the right. Owner confirmation pending.
- The fr and de hint texts need a native speaker's review.
- Clearing the direction box with a speed above 0 still gives a result, now for a headwind.
- No mobile or Electron check of the new dial.

## Changelog

- 2026-11-11: initial delivery
