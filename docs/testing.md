# Testing

## Running the tests

```bash
npm run test:run                                       # Once, as CI does
npm run test                                           # Watch mode
npx vitest run src/test/ballistics.baseline.test.js    # One file
npx vitest run -t "MPBR search"                        # By name
```

Vitest is configured in [`vite.config.js`](../vite.config.js): `src/**/*.test.js`, jsdom, globals on. The tests need no build.

On 2026-11-10, after #121 to #125: **2689 passed, 1 todo**, in 23 files. After #96, #102 and #107: **2723 passed, 1 todo**, in 25 files. After #120 and #111: **3065 passed, 1 todo**, in 28 files. On 2026-11-11, after #127, #128, #130, #131 and #132: **3388 passed, 1 todo**, in 30 files. After #94, #129, #133 and #134: **3739 passed, 1 todo**, in 30 files. #107 changed the pressure of the two custom test atmospheres in [`fixtures/ballisticProfiles.js`](../src/test/fixtures/ballisticProfiles.js) to the sea-level equivalent of the station pressure they were recorded with (owner decision), so no recorded result changed.

| File | Tests | Covers |
|------|-------|--------|
| [`ballistics.baseline.test.js`](../src/test/ballistics.baseline.test.js) | 303 | Layer 1: recorded calculator results, and the behaviour added by #81 to #86. Max drop and subsonic distance at every step and within the range (#94) |
| [`dopeCard.baseline.test.js`](../src/test/dopeCard.baseline.test.js) | 39 | Layer 1: figures printed on the cards |
| [`ballistics.published.test.js`](../src/test/ballistics.published.test.js) | 17, 1 todo | Layer 2: published manufacturer tables |
| [`ballistics.units.test.js`](../src/test/ballistics.units.test.js) | 24 | Unit conversions by definition, number formatting |
| [`trajectoryValidation.search.test.js`](../src/test/trajectoryValidation.search.test.js) | 19 | The validation search, on fake curves and a fake clock |
| [`profileValidation.test.js`](../src/test/profileValidation.test.js) | 232 | Profile form rules: plain decimals, decimal comma, limits, including bullet and barrel limits (#125) |
| [`profileOps.test.js`](../src/test/profileOps.test.js) | 37 | Profile list operations, ammo selector return path |
| [`storedProfiles.test.js`](../src/test/storedProfiles.test.js) | 230 | Stored profile list (#120): a list or entry that is not usable, names, numbers, units and click values that cannot be shown, and that the calculators keep the stored profile. Ids read as text, a later duplicate id renumbered, the stored active id (#131). Ids a link cannot carry renumbered with no collision, each read back from a parsed link, and stored references to them, the static routes under `/profiles/`, linear time on long runs of spaces (#134) |
| [`storedState.test.js`](../src/test/storedState.test.js) | 292 | Stored range, atmosphere, angle, rotation and Ballistic options (#120), MPBR target and Trajectory Validation observation, solve for and atmosphere (#127): each damaged value reads as a usable shape and gives no result where it gave none, with the engine stubbed; an array no longer reads as a number; an angle without a unit, or a damaged validation unit or type, keeps its result; a stored rotation that is not a number gives no cant, on the real engine |
| [`storedStores.test.js`](../src/test/storedStores.test.js) | 122 | The Scope View, Ballistic, compare, profiles, MPBR and Trajectory Validation stores on each damaged case of #120 and #127, with `localStore` replaced by plain values: they import, read a usable shape and recover on the next change. Profiles and the active profile with number and duplicate ids (#131), and with ids renumbered for links: the active profile and compare entries keep their profile after any edit, add or remove, and when the first session loads only the profiles store (#134) |
| [`tableStep.test.js`](../src/test/tableStep.test.js) | 191 | Ballistic table step (#130): the step the table uses is unchanged, the box message under 1, the chart tick cap, the same rows for 0.001 as for 1. Maximum step, the range (#133): steps up to it unchanged, a larger or infinite one read as the range, the box message, stored steps |
| [`dopeCardUnits.test.js`](../src/test/dopeCardUnits.test.js) | 30 | Sight height and velocity printed on both dope cards (#132): a damaged unit prints the card of the unit its trajectory used |
| [`auditCheck.test.js`](../src/test/auditCheck.test.js) | 84 | The audit check |
| [`electronNavigation.test.js`](../src/test/electronNavigation.test.js) | 34 | Electron URL rules |
| [`messages.test.js`](../src/test/messages.test.js) | 6 | Message catalogs |
| [`format.test.js`](../src/test/format.test.js) | 7 | Escaping of text for chart labels, limits in messages |
| [`decimal.test.js`](../src/test/decimal.test.js) | 85 | Reading typed numbers: plain decimals, decimal comma |
| [`compareEntries.test.js`](../src/test/compareEntries.test.js) | 46 | Stored compare entries, chart series names, each series name put back as text in its own chart aria-labels (#111) |
| [`storedWind.test.js`](../src/test/storedWind.test.js) | 34 | Stored wind as pages show it |
| [`yAxisUnit.test.js`](../src/test/yAxisUnit.test.js) | 7 | Stored unit of the compare chart |
| [`zeroDistance.test.js`](../src/test/zeroDistance.test.js) | 176 | Zero distance guard, 1 to 3000, with the engine stubbed |
| [`scopeRange.test.js`](../src/test/scopeRange.test.js) | 111 | Scope view range and typed cosine (#121): a stored range above the limit, or a cosine not above 0 and up to 1, gives no result, so the message shows. Angle in degrees (#129): at or beyond ±90° or not a number, typed or stored, gives no result; angles inside give the same range as before |
| [`inputLimits.test.js`](../src/test/inputLimits.test.js) | 462 | BC, velocity, sight height, range and atmosphere limits on every path, dope cards with no data or a failed build or save (#123), decimal comma on the wind path. The engine is stubbed for values past a limit |
| [`bulletLimits.test.js`](../src/test/bulletLimits.test.js) | 655 | Bullet weight, diameter, twist, length and altitude limits on every path (#125). The engine is stubbed for values past a limit |
| [`ballisticPage.test.js`](../src/test/ballisticPage.test.js) | 43 | Ballistic page range: the message and the result agree for every range (#122) |
| [`minimumAltitude.test.js`](../src/test/minimumAltitude.test.js) | 61 | Custom altitude too low for the shot (#125): the engine's minimum altitude stop is reported on both sides of it, on the real engine, and the report changes no result |
| [`nanElevation.test.js`](../src/test/nanElevation.test.js) | 47 | Optic height and barrel elevation guards, with the engine stubbed |
| [`windGuard.test.js`](../src/test/windGuard.test.js) | 311 | Wind speed and direction guard, with the engine stubbed for rejected winds |
| [`stationPressure.test.js`](../src/test/stationPressure.test.js) | 19 | Sea-level pressure corrected for altitude (#107): the ISA ratio, ft and m, hPa and inHg, the calculators passing the corrected pressure, and the density guard with the engine stubbed |
| [`storedLocale.test.js`](../src/test/storedLocale.test.js) | 15 | Language choice at start (#96): the URL prefix wins, a stored `fr` or `de` redirects, other values are ignored, no loop, no redirect to another host, storage and cookie errors caught, old cookie deleted |

The todo is the check of the G7 path against a table published for a G7 BC. The Federal table cannot do this.

Shared inputs are in [`fixtures/ballisticProfiles.js`](../src/test/fixtures/ballisticProfiles.js). They are representative loads, not published data. `fixtures/auditReports.js` holds sample audit reports.

## The two ballistics layers

| Layer | Question | Limits |
|-------|----------|--------|
| 1, baseline | Did the result change? | It records what the app computes. It is not proof that the app is right |
| 2, published data | Does the result match an outside table? | Loose bands, two sources. See [Accuracy](ballistics-model.md#accuracy) |

**Baselines are written out by hand**, not stored as snapshots, so a change cannot be accepted by rerunning with `-u`.

Baseline tolerances, also explained at the top of the test file:

| Value | Tolerance |
|-------|-----------|
| Velocity | 0.05 fps, 0.02 m/s |
| Time | 0.0002 s |
| Drop, wind | 0.01 in, 0.03 cm |
| Energy | 0.5 ft-lb, 0.5 J |
| Zero angle | 0.001 MOA, 0.0003 mrad |
| Near and far zero, max drop distance, subsonic distance | 0.2 |
| Apex and max drop elevation | 0.1 |
| Apex distance | 5 units in the old pins. The max apex tests hold it to 1 unit |
| MPBR distances, solver results, display values, dope card labels | Exact |

They are thousands of times above float noise, and small enough to catch a real change: a switch from the Euler to the RK4 engine fails them.

## When a baseline fails

**The owner must approve any change in calculated results. Never overwrite a baseline to make it pass, and never widen a tolerance to make it pass.**

1. Stop and find the cause. A failing baseline is a finding, not a chore.
2. Check layer 2. It decides whether the shift is plausible.
3. Measure the shift: which values, by how much, on which loads.
4. Report it to the owner, on the issue, with the cause. [#77](https://github.com/hawkins48b/cw-zro/issues/77) is the model: 72 baselines were left failing there, with no expected value changed.
5. Change the numbers only after the owner approves. A fix that deliberately changes a value lists the old and new values in its delivery document, as [#86](2026-11-05-86-mpbr-search.md) does.

A known defect is not pinned, so that a test does not make it look correct. The per-shot re-zero is left out for this reason.

## Hangs

`js-ballistics` runs synchronously and can stay in its loop for good on some inputs. **Neither `try/catch` nor a Vitest timeout can stop that**: the timeout needs the event loop, which the loop holds. A hanging test stalls the whole run.

So a test for a hang must not run the hang:

- Stub the solver to throw, then check that the guard stops the call before it. Without the guard, the test fails on the stub. See `vi.spyOn(Calculator.prototype, 'setWeaponZero')` in the baseline tests. `calculateMPBR` fires before it solves a zero, so stub `fire` too, as `inputLimits.test.js` and `bulletLimits.test.js` do.
- Check the value at each limit too: it must reach the stub. That proves the stub is live and the limit is not stricter than decided.
- If a run stalls, stop it by hand and run the file with `-t` to find the test.

## What the tests do not cover

- **The user interface.** Nothing in the repository runs a browser. Screens, forms and charts are not tested. Browser checks in the delivery documents were run from scripts that are not kept.
- **Electron and Capacitor at runtime.** Only the URL rules are tested.
- **Rendered PDFs.** Field values and coordinates are checked. No one has reviewed a rendered card.
- **The stores**, mostly. `profileOps.js` is tested in place of the profile list operations. `compareEntries.test.js` and `storedStores.test.js` run the compare, Ballistic, Scope View, profiles, MPBR and Trajectory Validation stores with `localStore` replaced by plain values, so the runes in `localStore.svelte.js` are not run.

## CI

[`ci.yml`](../.github/workflows/ci.yml) runs on every pull request and on pushes to `develop`, and [`deploy-prod.yml`](../.github/workflows/deploy-prod.yml) calls it on `main`.

| Job | Steps |
|-----|-------|
| `test` | `npm ci`, `npm run test:run`, `npm run build`, upload `build/` |
| `audit` | `npm run audit:check`, with no `npm ci`, so no dependency code runs |

`build:mobile` is not in CI. Run it yourself when a change can affect it.

Two checks of CI have not been seen on GitHub yet: a run on a pull request, and a failing test blocking a deploy ([#68](https://github.com/hawkins48b/cw-zro/issues/68)). The audit is explained in [Dependency Updates](../README.md#audit).
