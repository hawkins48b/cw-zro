# Testing

## Running the tests

```bash
npm run test:run                                       # Once, as CI does
npm run test                                           # Watch mode
npx vitest run src/test/ballistics.baseline.test.js    # One file
npx vitest run -t "MPBR search"                        # By name
```

Vitest is configured in [`vite.config.js`](../vite.config.js): `src/**/*.test.js`, jsdom, globals on. The tests need no build.

On 2026-11-06: **1014 passed, 1 todo**, in 15 files.

| File | Tests | Covers |
|------|-------|--------|
| [`ballistics.baseline.test.js`](../src/test/ballistics.baseline.test.js) | 224 | Layer 1: recorded calculator results, and the behaviour added by #81 to #86 |
| [`dopeCard.baseline.test.js`](../src/test/dopeCard.baseline.test.js) | 39 | Layer 1: figures printed on the cards |
| [`ballistics.published.test.js`](../src/test/ballistics.published.test.js) | 17, 1 todo | Layer 2: published manufacturer tables |
| [`ballistics.units.test.js`](../src/test/ballistics.units.test.js) | 24 | Unit conversions by definition, number formatting |
| [`trajectoryValidation.search.test.js`](../src/test/trajectoryValidation.search.test.js) | 17 | The validation search, on fake curves and a fake clock |
| [`profileValidation.test.js`](../src/test/profileValidation.test.js) | 59 | Profile form rules |
| [`profileOps.test.js`](../src/test/profileOps.test.js) | 37 | Profile list operations, ammo selector return path |
| [`auditCheck.test.js`](../src/test/auditCheck.test.js) | 84 | The audit check |
| [`electronNavigation.test.js`](../src/test/electronNavigation.test.js) | 34 | Electron URL rules |
| [`messages.test.js`](../src/test/messages.test.js) | 6 | Message catalogs |
| [`format.test.js`](../src/test/format.test.js) | 6 | Escaping of text for chart labels |
| [`yAxisUnit.test.js`](../src/test/yAxisUnit.test.js) | 7 | Stored unit of the compare chart |
| [`zeroDistance.test.js`](../src/test/zeroDistance.test.js) | 102 | Zero distance guard, with the engine stubbed |
| [`nanElevation.test.js`](../src/test/nanElevation.test.js) | 47 | Optic height and barrel elevation guards, with the engine stubbed |
| [`windGuard.test.js`](../src/test/windGuard.test.js) | 311 | Wind speed and direction guard, with the engine stubbed for rejected winds |

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

- Stub the solver to throw, then check that the guard stops the call before it. Without the guard, the test fails on the stub. See `vi.spyOn(Calculator.prototype, 'setWeaponZero')` in the baseline tests.
- If a run stalls, stop it by hand and run the file with `-t` to find the test.

## What the tests do not cover

- **The user interface.** Nothing in the repository runs a browser. Screens, forms and charts are not tested. Browser checks in the delivery documents were run from scripts that are not kept.
- **Electron and Capacitor at runtime.** Only the URL rules are tested.
- **Rendered PDFs.** Field values and coordinates are checked. No one has reviewed a rendered card.
- **The stores.** `profileOps.js` is tested in their place.

## CI

[`ci.yml`](../.github/workflows/ci.yml) runs on every pull request and on pushes to `develop`, and [`deploy-prod.yml`](../.github/workflows/deploy-prod.yml) calls it on `main`.

| Job | Steps |
|-----|-------|
| `test` | `npm ci`, `npm run test:run`, `npm run build`, upload `build/` |
| `audit` | `npm run audit:check`, with no `npm ci`, so no dependency code runs |

`build:mobile` is not in CI. Run it yourself when a change can affect it.

Two checks of CI have not been seen on GitHub yet: a run on a pull request, and a failing test blocking a deploy ([#68](https://github.com/hawkins48b/cw-zro/issues/68)). The audit is explained in [Dependency Updates](../README.md#audit).
