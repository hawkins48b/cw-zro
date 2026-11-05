# Ballistics reference tests

- **Date:** 2026-11-04
- **Branch:** task/70-ballistics-reference-tests
- **Issue:** [#70](https://github.com/hawkins48b/cw-zro/issues/70)
- **Status:** Delivered with known issues (on the task branch, not merged yet)

## Summary

Users rely on the ballistic numbers in the field, and the calculations had no tests. `js-ballistics` is about to go from 2.2.0-beta.2 to 3.x ([#77](https://github.com/hawkins48b/cw-zro/issues/77)), so a change in results could have gone unnoticed.

This task adds tests only. No production code changed. The tests found calculation problems, listed below. This task fixed none of them. Later tasks fixed the first five.

## How to use

`npm run test:run` runs the tests. Once [#68](https://github.com/hawkins48b/cw-zro/issues/68) is in, CI runs them on every change.

**When the #77 upgrade or an integrator change makes the baseline fail:** do not just copy the new numbers in. The baseline only says the result changed. The published layer decides whether the shift is acceptable. The numbers are written out by hand, not stored as snapshots, so nobody can accept a change by rerunning with `-u`.

## Technical changes

All in `src/test/`:

| File | Content |
|------|---------|
| [`ballistics.baseline.test.js`](../src/test/ballistics.baseline.test.js) | Layer 1: drop, wind drift, velocity, time, energy, zero angle, key points, MPBR and validation solver, in imperial and metric |
| [`dopeCard.baseline.test.js`](../src/test/dopeCard.baseline.test.js) | Layer 1: the figures printed on the imperial and metric dope cards |
| [`ballistics.published.test.js`](../src/test/ballistics.published.test.js) | Layer 2: comparison with published manufacturer tables |
| [`ballistics.units.test.js`](../src/test/ballistics.units.test.js) | Unit conversions checked against their definitions, and number formatting |
| [`fixtures/ballisticProfiles.js`](../src/test/fixtures/ballisticProfiles.js) | Shared inputs: .223 and .308 (G1), 6.5 Creedmoor and .338 Lapua Magnum (G7), custom atmospheres, crosswinds. These are representative loads, not published data |

### Layer 1: exact regression baseline

It records what the app computes today. It is not proof that the app is right.

| Value | Tolerance |
|-------|-----------|
| Velocity | 0.05 fps, 0.02 m/s |
| Time | 0.0002 s |
| Drop, wind | 0.01 in, 0.03 cm |
| Energy | 0.5 ft-lb, 0.5 J |
| Zero angle | 0.001 MOA, 0.0003 mrad |
| Key points | 0.2 on near and far zero, max drop distance and subsonic distance; 0.1 on apex and max drop elevation; 5 units on apex distance, because those pins were recorded from step 5 rows. Since [#85](https://github.com/hawkins48b/cw-zro/issues/85) the calculation no longer depends on the step, and its own tests hold it to 1 unit |
| MPBR distances, solver results, display values, dope card labels | Exact |

These tolerances are thousands of times above float noise, and small enough to catch a real change. At 1000 yd on the .308 profile, +0.1 % BC moves drop by 0.35 in, and +1 fps muzzle velocity moves it by 0.37 in. Switching the library's solver from Euler to RK4 moves drop by 0.32 in, so a solver change fails too.

Unit conversions use a relative tolerance of 1e-8, and 1e-5 for pressure.

### Layer 2: published data

`js-ballistics` is a port of py-ballisticcalc by the same author, so that library is not an independent source. Both sources below were retrieved on 2026-11-04.

- [Federal Gold Medal Match GM308M](https://www.federalpremium.com/rifle/gold-medal/gold-medal-sierra-matchking/11-GM308M.html), .308 Win, 168 gr: velocity, energy, trajectory and 10 mph wind drift to 500 yd.
- [Lapua .223 Rem 55 gr FMJ, product 4315042](https://lapua.com/product/223-rem-target-hunting-cartridge-fmj-36g-55gr-4315042): velocity only, to 600 m, within 1 m/s. Confidence is lower, because the figures came through a partly garbled text extraction.

| Federal check | Velocity | Energy | Trajectory | Wind drift |
|---------------|----------|--------|------------|------------|
| ICAO atmosphere | 1 % | 2 % | 0.1 in + 1 % | 0.1 in + 3 % |
| Army Standard Metro | 2 fps | 0.5 % | 0.1 in | 0.2 in |

### Findings on the published data

- The Federal page says the zero is 100 yd, but the table is a 200 yd zero. Among zeros from 100 to 300 yd, 200 yd is the best fit.
- The table fits G1 .462.
- The page does not state the atmosphere. Army Standard Metro fits better than ICAO on every series, but it is an unconfirmed hypothesis.
- G7 .224, listed on the same page, disagrees: 43 fps below the published 500 yd velocity under ICAO, and 29 fps under Army Standard Metro. This table cannot check the G7 path, so G7 has no independent check.
- These tables look computed from the listed BC, not measured. Agreement most likely shows that two solvers agree on the same inputs, not that either matches a real bullet.

### Do the tests fail when they should?

Yes. Mutation runs during development showed the tests fail when the calculations change. Those runs are not kept in the repository.

## Security review

**PASS.**

## Known limitations / follow-ups

### Open calculation problems

Rows 1 to 5 are fixed and have tests. The others are not fixed. They are deliberately not pinned, so a test does not make a bug look correct. Each one needs a decision, then a test. Row 6 is an `it.todo` entry at the end of the baseline test file.

| Problem | Where |
|---------|-------|
| **Fixed by [#81](https://github.com/hawkins48b/cw-zro/issues/81)** ([delivery doc](2026-11-04-81-powder-sensitivity.md)): powder sensitivity unit mismatch, the form asked for fps per degree and the code used % per 15 C | `powderSensitivity()` in `ballisticCalculator.js` |
| **Fixed by [#82](https://github.com/hawkins48b/cw-zro/issues/82)** ([delivery doc](2026-11-05-82-83-validation-solver.md)): validation solver goal sign, the goal was forced below line of sight, which is wrong inside a short zero | `calculateTrajectoryValidation()` in `trajectoryValidation.js` |
| **Fixed by [#83](https://github.com/hawkins48b/cw-zro/issues/83)** ([delivery doc](2026-11-05-82-83-validation-solver.md)): validation reported success after a failed shot, the solver stopped and still returned a result | `calculateTrajectoryValidation()` in `trajectoryValidation.js` |
| **Fixed by [#84](https://github.com/hawkins48b/cw-zro/issues/84)** ([delivery doc](2026-11-05-84-humidity-fraction.md)): humidity of 1 % or less was read as a fraction, 1 % gave 100 % | `humidityFraction()` in `ballisticCalculator.js` |
| **Fixed by [#85](https://github.com/hawkins48b/cw-zro/issues/85)** ([delivery doc](2026-11-05-85-max-apex.md)): max apex came from recorded rows only, so it depended on the table step | `calculateFullTrajectory()` in `ballisticCalculator.js` |
| MPBR under-reports on large targets: the zero search stops at 200 | `ballisticCalculator.js:477` |
| Per-shot re-zero is a modelling limit | `ballisticCalculator.js:136`, `:339` |
| Dope card near zero prints the zero distance, not the computed near zero | `dopeCardImperial.js:42` (`dopeCardMetric.js:42` has the same code) |

### Not covered

There is no independent check for:

- G7
- MPBR
- the validation solver
- spin drift
- custom atmospheres

For these, the baseline only shows that results did not change.

## Changelog

- 2026-11-04: initial delivery
- 2026-11-04: powder sensitivity marked as fixed by #81. The other `ballisticCalculator.js` line numbers in the table date from before that change
- 2026-11-05: validation goal sign and success after a failed shot marked as fixed by #82 and #83. Summary and the `it.todo` row numbers corrected
- 2026-11-05: humidity marked as fixed by #84. Summary and the `it.todo` row numbers corrected
- 2026-11-05: max apex marked as fixed by #85. Summary, the `it.todo` row and the apex tolerance note corrected
