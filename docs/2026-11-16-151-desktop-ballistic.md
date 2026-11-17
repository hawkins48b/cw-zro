# Ballistic page redesign

- **Date:** 2026-11-16
- **Branch:** task/151-desktop-ballistic
- **Issue:** [#151](https://github.com/hawkins48b/cw-zro/issues/151), part of epic [#153](https://github.com/hawkins48b/cw-zro/issues/153)
- **Status:** Delivered, not in production yet. Not checked in a browser

## Summary

The Ballistic page had collapsible Wind and Atmosphere sections, a "use ISA" switch, five stat tiles and two charts (drop, and velocity behind a toggle).

The design is the artboard "Desktop · Ballistic Calculator" in the claude.ai artifact canvas "ZRO Calculator Redesign". This branch is #151 of epic #153.

**Delivered.** One page, in this order:

1. Header: intro text, the active profile with "Change", and Export CSV.
2. Distances: max distance and step (limits and messages unchanged).
3. Wind: the Scope View wind card (`ScopeWindCard`) with None / Light / Strong presets.
4. Atmosphere: the Scope View atmosphere card (`ScopeAtmosphereCard`), with ISA, Estimate and Accurate.
5. Four stats: Near Zero, Far Zero, Highest Point, Goes Subsonic.
6. Bullet Path chart with a Drop / Velocity switch. The choice is remembered.
7. Data table with the Columns picker (remembered). Two new optional columns: Elev (clicks) and Wind (clicks). The row at the Scope View's target distance is highlighted.

From `lg` (1024 px, where the app sidebar appears) the page has two columns: conditions (Distances, Wind, Atmosphere) on the left, 300 to 340 px wide, results on the right. Below 1024 px it is one column in the order above.

## Owner decisions (2026-11-16)

| Topic | Decision |
|-------|----------|
| Atmosphere | The Ballistic page uses the Scope View's three-mode atmosphere card |
| Click columns | Elev (clicks) and Wind (clicks) are optional columns, off by default |
| Stats | Four stats. The Max drop tile is removed; max drop is still a chart annotation |

## Choices reported to the owner, not yet confirmed

- The click columns are signed like the angle columns next to them: a negative number means dial up. The Scope View shows the same count unsigned, with Up / Down.
- The highlight follows the Scope View range box as typed, not the distance after the uphill or downhill angle. A row matches when both, rounded to 0.1 in the table unit, are equal (1 yd = 0.9144 m). 500 yd highlights the 500 yd row; 510 yd highlights nothing with a 25 yd step.
- The Scope View's reader for a hand-edited ISA altitude is left unchanged (only the Ballistic reader forces altitude 0 on old states).
- Capitals kept in stat names ("Near Zero").
- Far zero note: "Bullet crosses the line of sight again".
- Click column labels: "Elev (clicks)", "Wind (clicks)".
- The page now loads the Scope View store for the highlight. `localStore` writes a store's defaults when its key is missing, so a first visit to the Ballistic page saves the Scope View defaults (`zro-scope-view`, 500 yd, which is then highlighted).

## Release notes

- The Ballistic page is redesigned: two columns on desktop, one on phones.
- The atmosphere has three modes: ISA, Estimate and Accurate (QNH or Station). ISA now uses the altitude when one is entered. Saved states give the same result as before.
- Wind presets None / Light / Strong.
- Optional Elev (clicks) and Wind (clicks) table columns, also in the CSV.
- The velocity chart is now behind the Drop / Velocity switch.
- The Max drop tile is gone (still marked on the drop chart).

## How to use

Open `/calculators/ballistic` (also `/fr/...`, `/de/...`). No account or role. Without an active profile the page shows the existing "No active profile" message.

- **Distances.** Max distance and step, as before.
- **Wind.** Tap a preset (None 0, Light 3.5, Strong 9 m/s; 0, 7.8, 20.1 mph), or type a speed; turn the dial or use − / + 5°.
- **Atmosphere.** ISA (altitude), Estimate (altitude, weather, temperature), Accurate (pressure with QNH / Station, altitude, temperature, humidity). See [Scope View modes](ballistics-model.md#scope-view-modes).
- **Chart.** Switch Drop / Velocity in the chart header. Drop has the annotations toggle; Velocity has the fps / m/s unit.
- **Table.** "Columns" opens the picker. Elev (clicks) and Wind (clicks) are under Elevation and Wind. Export CSV writes the visible columns.
- **Highlight.** Set a distance on the Scope View; the matching row is highlighted, with a line under the table saying so.

## Saved states

The store key is still `zro-ballistic`.

| Field | Change |
|-------|--------|
| `atmosphere.mode`, `weather`, `pressureRef` | New, as on the Scope View. `useISA` is still written, matching the mode |
| `options.chartMode` | New: `drop` (default) or `velocity` |
| `options.showWind`, `showAtmosphere`, `showVelocityChart` | Removed. Not read; the next option change drops them |

A state without a valid `mode` (saved before #151) is read by [`storedBallisticAtmosphere`](../src/lib/utils/storedState.js) as the page computed it then:

- `useISA` on: ISA at altitude 0, so `null` (`new Atmo()`), whatever the boxes hold.
- `useISA` off: Accurate with QNH. A hand-edited `pressureRef: 'station'` is read as QNH, since the old page dropped the field (security review Low finding, fixed).

Reading writes nothing. [`ballisticAtmosphere.test.js`](../src/test/ballisticAtmosphere.test.js) runs ten saved states through the old and the new page logic: `calculateFullTrajectory` gives identical results. No baseline changed.

## Technical changes

- [`src/routes/calculators/ballistic/+page.svelte`](../src/routes/calculators/ballistic/+page.svelte): new layout; atmosphere through `scopeAtmosphereParams` to `ballisticPageTrajectory`; four stats; one chart with the switch; click columns; row highlight from `scopeView.range`.
- [`src/lib/utils/ballisticPage.js`](../src/lib/utils/ballisticPage.js): `scopeDistanceRow` (row of the Scope View distance).
- New [`src/lib/utils/clicks.js`](../src/lib/utils/clicks.js): `clickValue` (0.5 when missing, 0 or unreadable), `clickCount`, `signedClickCount`. The Scope View now uses it too; its values are the same.
- [`src/lib/utils/storedState.js`](../src/lib/utils/storedState.js): `ISA_ATMOSPHERE` and `patchedAtmosphere` (moved out of the Scope View store, shared), `storedBallisticAtmosphere`, `storedBallisticOptions` with `chartMode` and without the section flags.
- Store [`ballistic.svelte.js`](../src/lib/stores/ballistic.svelte.js): atmosphere read by `storedBallisticAtmosphere`, changed by `patchedAtmosphere`; new `windPreset`, `applyWindPreset`; default option `chartMode: 'drop'`.
- Store [`scopeView.svelte.js`](../src/lib/stores/scopeView.svelte.js): uses the shared `ISA_ATMOSPHERE` and `patchedAtmosphere`; behaviour unchanged.
- [`src/routes/scope-view/+page.svelte`](../src/routes/scope-view/+page.svelte): clicks from `clicks.js`.
- `src/lib/components/WindInput.svelte` deleted. Comments updated in `ScopeWindCard`, `ScopeAtmosphereCard`, `WindDial`, `shotWind.js`, `storedWind.js`.
- Messages: 15 new `ballistic_*` keys; 6 removed with `WindInput` (`ballistic_wind`, `scope_view_wind_no_wind`, `scope_view_wind_light_wind`, `scope_view_wind_strong_wind`, `scope_view_wind_target_direction`, `scope_view_wind_relative_to_shooter`). 522 keys per language. The translator fixed 13 fr / de strings; no native speaker review.
- Guides updated: [`architecture.md`](architecture.md), [`ballistics-model.md`](ballistics-model.md), [`testing.md`](testing.md), [`data-and-privacy.md`](data-and-privacy.md), [`translations.md`](translations.md) (key count); README feature table.

## Tests

| File | What |
|------|------|
| [`ballisticAtmosphere.test.js`](../src/test/ballisticAtmosphere.test.js) (new, 32) | Ten saved develop states identical through old and new logic; damaged sections give no result; reading saved, moded and damaged atmospheres; `patchedAtmosphere`; guards in every mode and unit, engine stubbed |
| [`clicks.test.js`](../src/test/clicks.test.js) (new, 21) | Click value and count against the Scope View formulas, the sign of the table columns, the same count as the Scope View on a real trajectory |
| [`ballisticPage.test.js`](../src/test/ballisticPage.test.js) (27 more) | `scopeDistanceRow`: same unit, yd and m converted, float noise, no row, every Scope View range it does not calculate |
| [`storedState.test.js`](../src/test/storedState.test.js), [`storedStores.test.js`](../src/test/storedStores.test.js) | Chart mode, dropped flags; the Ballistic store reads old states without a write, mode switches, presets, remembered chart and columns |

`npm run test:run`: 4312 passed, 1 todo, 42 files (re-run on 2026-11-16). `npm run build` passes.

## What the owner should test

Nothing was checked in a browser. Please check, in light and dark themes:

1. At 1024 px and wider: two columns, conditions left, results right.
2. On a phone: one column, in the order header, Distances, Wind, Atmosphere, stats, chart, table.
3. Drop / Velocity switch and the Columns choice are kept after a reload.
4. Atmosphere ISA, Estimate and Accurate change the chart and table; the "used" line follows.
5. Wind presets set the speed; the direction stays.
6. Turn on Elev (clicks) and Wind (clicks): values match the Scope View's counts (with sign); Export CSV contains them.
7. Scope View at 500 yd: the 500 yd row is highlighted. At 510 yd: no row.

## Deployment notes

Nothing to do on the server. The release notes above must go out with the release.

## Security review

**PASS.** One Low finding, fixed: a hand-edited `pressureRef: 'station'` in an old Ballistic state would have switched it to Station pressure; it is now read as QNH.

Pre-existing, Info, not fixed: a negative click value in a profile is not rejected, so click counts get the wrong sign. This affected the Scope View already and now the table's click columns.

## Known limitations / follow-ups

- Not checked in a browser or on a device.
- The choices listed above wait for the owner's confirmation.
- Negative click values in a profile (pre-existing, see Security review).
- A first visit to the Ballistic page writes `zro-scope-view` defaults.

## Changelog

- 2026-11-16: initial delivery
