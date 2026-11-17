# Scope View redesign

- **Date:** 2026-11-16
- **Branch:** task/148-scope-view-redesign
- **Issue:** [#148](https://github.com/hawkins48b/cw-zro/issues/148), part of epic [#153](https://github.com/hawkins48b/cw-zro/issues/153)
- **Status:** Delivered, not in production yet. Not checked in a browser

## Summary

The Scope View put the result in a right column on wide screens and below all inputs on phones. It hid the elevation angle behind a toggle, and the atmosphere had one ISA on/off switch.

The design is the claude.ai artifact canvas "ZRO Calculator Redesign" (artboards "4 · Scope View: Dial", "4b · Scope View: Hold", "Tablet · Scope View"). The owner split the whole redesign into epic #153 with #148 to #152. This branch is #148. "Use current weather" is left out and filed as #152.

**Delivered.** On a phone the page is one column, in this order:

1. Active profile bar, with "Change" (or "Choose" with no profile), linking to Profiles.
2. Target distance: four digit columns with + / − per place, yd / m chips, and typed entry.
3. Result card with a Dial / Hold switch. Dial shows UP/DOWN and LEFT/RIGHT in clicks with the angular value, then flight time, energy and velocity. Hold shows the reticle with the cant slider and its reset button. The choice is remembered.
4. Wind: None / Light / Strong presets, speed with mph / m/s, direction dial, a − / + 5° direction box, and an o'clock hint.
5. Elevation angle, always visible, deg / cos, with its hint.
6. Atmosphere with three modes: ISA, Estimate, Accurate.

From the `sm` breakpoint (640 px) the inputs are in the left column and the result card in the right one, sticky at the top.

The Ballistic and Trajectory Validation pages are unchanged. They keep `AtmosphereCard` and `WindInput`.

## Owner decisions (2026-11-16)

| Topic | Decision |
|-------|----------|
| Wind presets | None 0, Light 3.5, Strong 9 m/s; in mph 0, 7.8, 20.1. A preset sets the speed only, in the unit shown; the direction stays |
| Estimate mode | Humidity from the weather: Sunny 40 %, Cloudy 65 %, Rain 90 %, Snow 80 %. Pressure is the ISA pressure at the altitude. Temperature as entered |
| Accurate mode | QNH / Station switch. QNH is converted with `stationPressure()` as before; Station is used as entered |
| Elevation angle | A saved angle now always applies. Before, it applied only while the section was open, and the section started closed on every visit. An empty box or 0 gives the same result as before |

**Developer's choice, reported, not yet confirmed by the owner:** ISA uses the standard atmosphere at the entered altitude. Before, ISA ignored the altitude, and choosing ISA reset the altitude to 0. Altitude 0 takes the previous path (`null`, sea-level `new Atmo()`). Every saved ISA state had altitude 0, so none changes.

## Release notes

- A saved elevation angle on the Scope View now counts. Users who left an angle in the closed section get a different result until they clear it. An empty or 0 angle changes nothing.
- ISA on the Scope View now uses the altitude. Saved ISA states had altitude 0 and are unchanged.
- The Scope View atmosphere has three modes: ISA, Estimate (weather and temperature) and Accurate (with QNH or Station pressure).

## How to use

Open `/scope-view` (also `/fr/scope-view`, `/de/scope-view`). No account or role.

- **Distance.** Tap + or − above or below a digit; hold to repeat. The buttons stay from 1 to 3000 (`MAX_DISTANCE`). Tap the digits, or the keyboard button, to type; Enter, Escape or leaving the box returns to the digits. A typed value out of range shows the existing range message.
- **Dial / Hold.** The switch is in the result card header.
- **Wind.** Tap a preset, or type a speed. The preset chip is marked while the speed equals it in the unit shown (`3.5`, `3,5` and `3.50` all match). Turn the dial, or use − / + to move 5°. The hint gives the clock hour of the direction, where the wind comes from (#106).
- **Atmosphere.**
  - ISA: altitude only. A line shows the standard pressure (at the site) and temperature used.
  - Estimate: altitude, weather (Sunny, Cloudy, Rain, Snow), temperature with ± 1 and quick picks (-10, 0, 10, 20, 30 °C or 14, 32, 50, 68, 86 °F). A line shows the pressure, temperature and humidity used.
  - Accurate: pressure with QNH / Station, altitude, temperature, humidity.
  - Switching modes keeps the entered boxes, so switching back shows them again.

## How each mode reaches the engine

[`scopeAtmosphereParams`](../src/lib/utils/scopeAtmosphere.js) builds what `calculateShotPoint` gets:

| Mode | Passed to `calculateShotPoint` |
|------|-------------------------------|
| ISA, altitude 0 | `null`: `new Atmo()`, as before |
| ISA, other altitude | Custom: 1013.25 hPa as QNH (scaled to the site by `stationPressure`), ISA temperature of the altitude in °C, humidity 0. Same air as `Atmo.icao` at that altitude. An altitude out of its limits is passed as entered, so the guard rejects it |
| Estimate | Custom: the altitude, 1013.25 hPa as QNH, the entered temperature, the weather humidity |
| Accurate | Custom: the boxes as entered, with `pressureRef` `qnh` or `station` |

ISA and Estimate pass 1013.25 hPa, inside the pressure limits, so their pressure limit never rejects a usable altitude. Every custom atmosphere goes through the existing guards: `isUsableAtmosphere`, `hasPositiveDensity` (and `hasNoAirDensity` for the message, on the atmosphere actually used), and the minimum altitude stop (#125).

## Saved states

The store key is still `zro-scope-view`. New fields: `atmosphere.mode`, `atmosphere.weather`, `atmosphere.pressureRef`, and `resultMode`. `useISA` is still written, matching the mode, so a build from before #148 reads new state the same way.

- A state without `mode`: `useISA` true reads as ISA, false as Accurate with QNH. That is what the page computed before.
- Damaged values: a mode that is not one of the three is read from `useISA`; weather falls back to `cloudy`, `pressureRef` to `qnh`, `resultMode` to `dial`.
- Reading writes nothing.
- A test runs four saved develop states (default ISA, ISA with wind, a custom imperial and a custom metric atmosphere) through the old and the new page logic: `calculateShotPoint` gives identical results.

`pressureRef: 'station'` is honoured only from the Scope View. The Ballistic and Trajectory Validation stores read their atmosphere with `storedAtmosphere`, which drops the field, so they stay QNH. MPBR and the dope cards use the standard atmosphere and are unaffected.

No baseline changed.

## Technical changes

- [`src/routes/scope-view/+page.svelte`](../src/routes/scope-view/+page.svelte): new layout and order; the angle always applies (`scopeEffectiveRange(range, elevation)`); atmosphere from `scopeAtmosphereParams`; `hasNoAirDensity` passed to the card.
- New components in `src/lib/components/`:
  - [`ScopeResult.svelte`](../src/lib/components/ScopeResult.svelte): result card, Dial / Hold, no-profile and no-result states. Computes nothing.
  - [`ScopeWindCard.svelte`](../src/lib/components/ScopeWindCard.svelte): presets, speed, dial, ± 5°, o'clock hint.
  - [`ScopeAtmosphereCard.svelte`](../src/lib/components/ScopeAtmosphereCard.svelte): the three modes, range messages, "altitude too low" (#125) and the air density message (#107).
  - [`WindDial.svelte`](../src/lib/components/WindDial.svelte): the direction dial, moved out of `WindInput` and shared by `WindInput` (Ballistic) and `ScopeWindCard`.
  - [`ChipGroup.svelte`](../src/lib/components/ChipGroup.svelte): a row of toggle buttons with `aria-pressed`, at least 44 px wide, with a 44 px touch area.
- Changed components: [`DistanceInput.svelte`](../src/lib/components/DistanceInput.svelte) (card, typed entry, keyboard step on + / −, `ChipGroup` units), [`WindInput.svelte`](../src/lib/components/WindInput.svelte) (uses `WindDial`), [`ScopeReticle.svelte`](../src/lib/components/ScopeReticle.svelte) (badge and scale hint translated, labelled cant slider, 44 px slider and reset button).
- New utils:
  - [`scopeAtmosphere.js`](../src/lib/utils/scopeAtmosphere.js): modes, weather humidities, `scopeAtmosphereParams`, `usedScopeAtmosphere`, `formatUsedAtmosphere`.
  - [`windPreset.js`](../src/lib/utils/windPreset.js): `WIND_PRESETS`, `windPresetSpeed`, `activeWindPreset`.
- Changed utils:
  - [`ballisticCalculator.js`](../src/lib/utils/ballisticCalculator.js): `customAtmo` passes the pressure as entered when `pressureRef === 'station'`; anything else is QNH, as before.
  - [`storedState.js`](../src/lib/utils/storedState.js): `storedScopeAtmosphere`, `storedResultMode`.
  - [`windDirection.js`](../src/lib/utils/windDirection.js): `clockHour`, display only.
- Store [`scopeView.svelte.js`](../src/lib/stores/scopeView.svelte.js): `atmosphere` read by `storedScopeAtmosphere`; new `resultMode`, `setResultMode`, `windPreset`, `applyWindPreset`. `setAtmosphere({ useISA: true })` still resets to the standard atmosphere; `{ mode }` changes the mode and keeps the boxes.
- [`src/app.css`](../src/app.css): `.touch-hit`, a 44 px tall touch area around small controls.
- Messages: 62 new `scope_view_*` keys in en, fr and de. Removed as unused: `scope_view_distance_increase`, `scope_view_distance_decrease`, `scope_view_adjustments`, `scope_view_flight_time`, `scope_view_terminal_velocity`.
- Guides updated: [`ballistics-model.md`](ballistics-model.md), [`architecture.md`](architecture.md), [`testing.md`](testing.md), [`data-and-privacy.md`](data-and-privacy.md).

## Tests

| File | What |
|------|------|
| [`scopeAtmosphere.test.js`](../src/test/scopeAtmosphere.test.js) (new, 75) | Reading saved and damaged atmospheres and the result mode; each mode's parameters; ISA at 0 equals the old standard result; ISA at an altitude equals the same air entered as Station; Estimate equals Accurate with 1013.25 hPa and the weather humidity; each weather changes the result; Station uses the pressure as entered and agrees with QNH only at 0; the density check on the air actually used; the guards in every mode, with the engine stubbed and a live-stub check; the "used" line; wind presets; four saved develop states give identical results; a stored 30° angle now applies |
| [`windClock.test.js`](../src/test/windClock.test.js) (new, 18) | `clockHour`: hours, rounding, null for non-numbers |
| [`storedStores.test.js`](../src/test/storedStores.test.js) (16 more) | The store: old states read as before without writing, result mode remembered and damaged values read as dial, modes switch without losing boxes, the old `useISA` switches, presets in both units keep the direction, a damaged speed unit is mph |

`npm run test:run`: 4129 passed, 1 todo (the G7 published-data todo, unchanged). `npm run build` and `npm run build:mobile` pass.

## What the owner should test

Nothing was checked in a browser. Please check, in light and dark themes:

1. At 390×844 with the default profile: the order is profile, distance, result, wind, angle, atmosphere, and the result card is on the first screen.
2. Switch Dial / Hold, reload: the choice is kept. Hold shows the reticle; the cant slider and reset work.
3. Distance: + / − per digit, hold to repeat, typed entry with Enter and Escape, yd / m.
4. Wind presets in mph (0, 7.8, 20.1) and m/s (0, 3.5, 9); the speed stays editable; typing a preset speed marks its chip; the dial and ± 5° move the direction and the o'clock hint follows.
5. ISA: change the altitude, the "used" line shows the standard pressure and temperature of that altitude, and the result changes.
6. Estimate: each weather changes the humidity in the "used" line and the result; ± and quick picks set the temperature.
7. Accurate: at an altitude above 0, Station and QNH with the same number give different results; at 0 they agree. Out-of-range boxes show their messages.
8. Angle: always visible; deg and cos; a value out of range shows the message.
9. At 640 px and wider: two columns, the result stays visible while the inputs scroll.
10. Ballistic page: the wind dial still works.
11. Touch targets at least 44 px; `/fr` and `/de` texts fit.

## Deployment notes

Nothing to do on the server. The release notes above must go out with the release.

## Security review

**PASS**, no findings.

Note: Station mode lets the engine see site pressures from 300 to 1200 hPa at any altitude from -1000 to 10000 m. Before #148 the site pressure was always the entered QNH scaled to the altitude (about 78 to 1349 hPa overall, but tied to the altitude). The guards are unchanged: the entered pressure is still limited to 300 to 1200 hPa, and the density guard runs on the Station air.

What was checked beyond the review:

- Hang probe of Station extremes (2026-11-16, js-ballistics 3.1.0): the 48 corner combinations of 300 and 1200 hPa, -90 and 70 °C, -1000 and 10000 m, at 100 and 3000 m, with a 20 m/s crosswind and humidity 100 %, on `P223_G1`, `P308_G1` and `P338_G7_METRIC`, each run in its own Vitest process under a 60 s kill timeout; none hung, the slowest took 32 ms, 26 gave a result and 22 none. Values between the corners were not probed.

## Acceptance criteria

| Criterion | Status |
|-----------|--------|
| Phone order matches the design; the result card is on the first screen at 390×844 with the default profile | Order done; the first screen is not checked in a browser |
| Dial / Hold switch; Hold shows the reticle and cant slider; the choice is remembered | Done (store tested; screen not checked in a browser) |
| Distance digit steppers stay within the range limits and keep typed entry possible | Done (not checked in a browser) |
| Wind presets set 0 / 3.5 / 9 m/s (0 / 7.8 / 20.1 mph); the speed stays editable | Done |
| Atmosphere ISA / Estimate / Accurate, QNH / Station in Accurate; existing input guards apply to every mode | Done |
| A saved Scope View state from develop gives the same result after the change (unit test) | Done (four states) |
| New strings in en, fr, de; light and dark themes; touch targets at least 44 px | Strings done; themes and touch targets not checked in a browser |
| `npm run test:run` and `npm run build` pass; no baseline changed | Done |

## Known limitations / follow-ups

- Not checked in a browser or on a device.
- The ISA-at-altitude behaviour is a developer's choice, waiting for the owner's confirmation.
- A saved non-zero angle now changes the result (owner decision); users are told only by the release notes.
- "Use current weather" is #152.

## Changelog

- 2026-11-16: initial delivery
