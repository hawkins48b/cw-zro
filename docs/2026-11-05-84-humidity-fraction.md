# Humidity of 1 % or less

- **Date:** 2026-11-05
- **Branch:** task/84-humidity-fraction
- **Issue:** [#84](https://github.com/hawkins48b/cw-zro/issues/84)
- **Status:** Delivered on `develop`, not in production yet

## Summary

`js-ballistics` divides a humidity above 1 by 100 and keeps anything else as it is. The app passed the percentage straight through, so a value of 1 or less was read as a fraction: 1 % gave 100 %, and 0.5 % gave 50 %.

**Delivered:** the app now always passes the fraction, so humidity changes results smoothly, with no jump at 1 %.

**Correction to #84.** The issue says the effect is about 5 fps at 1000 yd. It is larger. With the .308 test profile at 1000 yd, 1 % against 0 % was off by 12.8 fps at 85 °F at sea level, and by 17.2 fps in the hot altitude case. The conclusion does not change.

### Effect on users

Percentages above 1 % give identical results. Of 456 serialized results compared, only those at 0.25, 0.5, 0.99 and 1 changed.

Saved values of 1 or less now give different results. For example, `0.5` now means 0.5 %, not 50 %, which matches the % label on the field.

Velocity at 1000 yd, .308 test profile (`P308_G1`) in hot altitude air (`ATMO_HOT_ALTITUDE`):

| Humidity | Before (fps) | After (fps) |
|----------|--------------|-------------|
| 0 % | 1355.823 | 1355.823 |
| 0.5 % | 1364.379 | 1355.908 |
| 1 % | 1373.025 | 1355.993 |
| 2 % | 1356.163 | 1356.163 |
| 100 % | 1373.025 | 1373.025 |

**Affected:** the ballistic calculator, trajectory validation and the scope view, when they use a custom atmosphere rather than ISA.

**Not affected:** dope cards and the MPBR search use `new Atmo()` with no humidity, so always 0 %. Compare trajectories passes no atmosphere, so it uses the same default.

## Technical changes

All production changes are in [`src/lib/utils/ballisticCalculator.js`](../src/lib/utils/ballisticCalculator.js). The form, saved data format and translations did not change.

- **`humidityFraction(percent)`**, private. `calculateShotPoint` and `calculateFullTrajectory` use it to build `Atmo`.
- The fraction is the library's documented form (`conditions.d.ts:24`). The branch that caused the bug is the humidity setter (`conditions.js:52-59`), both in `node_modules/js-ballistics/dist/`, version 2.2.0-beta.2.

### Tests

**294 passed, 3 todo.** `npm run build` passes. Both were rerun for this document, as were the table and the 12.8 and 17.2 fps figures. The comparison of 456 results was run during development, is not in the repository and was not rerun.

[`src/test/ballistics.baseline.test.js`](../src/test/ballistics.baseline.test.js) gains 7 tests in a `humidity` block, replacing the `it.todo`:

- recorded velocity and drop at 0, 0.5, 1, 2 and 100 %, in both calculator functions
- no jump at 1 %, in both calculator functions

No existing pinned value changed.

## Deployment notes

Nothing to run or configure. Saved values keep their stored number, and those of 1 or less give new results as soon as this is deployed (see Effect on users).

## Security review

**PASS.** No findings.

## Known limitations / follow-ups

- **Library upgrade.** Recheck the humidity convention during the `js-ballistics` upgrade ([#77](https://github.com/hawkins48b/cw-zro/issues/77)). The new pinned values fail if it changes.
- **Not tested in a browser.** Results were checked through the calculator functions.

## Changelog

- 2026-11-05: initial delivery
