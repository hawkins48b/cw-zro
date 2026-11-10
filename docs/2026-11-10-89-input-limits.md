# Input limits, strict profile form and decimal comma

- **Date:** 2026-11-10
- **Branch:** task/89-input-limits
- **Issues:** [#89](https://github.com/hawkins48b/cw-zro/issues/89), [#90](https://github.com/hawkins48b/cw-zro/issues/90), [#91](https://github.com/hawkins48b/cw-zro/issues/91), [#92](https://github.com/hawkins48b/cw-zro/issues/92), [#93](https://github.com/hawkins48b/cw-zro/issues/93), [#114](https://github.com/hawkins48b/cw-zro/issues/114), [#117](https://github.com/hawkins48b/cw-zro/issues/117), [#119](https://github.com/hawkins48b/cw-zro/issues/119)
- **Status:** Not in production yet

## Summary

Eight issues about values that could freeze the app, done together because they share one set of limits. The owner set the limits on 2026-11-10. The profile form and every calculation path now read them from one place, and values past them give a form error or no result before the engine is called.

| Issue | Change |
|-------|--------|
| #89 | The profile form accepts only plain finite decimals. `Infinity`, `1e999`, hex and `90abc` are form errors. A stored value that is not a string or a number is a form error too |
| #90 | Muzzle velocity is 50 to under 10000 fps on all five paths and in the form (15.24 to under 3048 m/s) |
| #91 | The dope card solvers have the BC, velocity and sight height guards. A card with no data is not saved, and the page shows `dope_no_result` |
| #92 | Custom temperature, pressure and sight height have limits. The atmosphere box shows the allowed range |
| #93 | Range and zero are at most 3000, in the unit entered. The range buttons stop at 3000 |
| #114 | Minimum zero is 1 (was 0.001). The compare page shows a message when a usable zero gives no result |
| #117 | A decimal comma reads as a point: `1,5` is 1.5 |
| #119 | BC is at least 0.01 on all five paths and in the form |

## Limits

All in the unit entered. Source: [`inputLimits.js`](../src/lib/utils/inputLimits.js) and [`zeroDistance.js`](../src/lib/utils/zeroDistance.js).

| Value | Limit | Before |
|-------|-------|--------|
| BC | At least 0.01 | Above 0, except MPBR and validation (0.01) |
| Muzzle velocity | 50 to under 10000 fps, also after powder sensitivity | At least 50 fps, except MPBR and validation (under 10000) |
| Sight height | At most 10 in or 25.4 cm either way. The form still requires a positive value | Finite |
| Range | Above 0, at most 3000 | Full trajectory at most 3000, shot point no limit |
| Zero distance | 1 to 3000, after taking the absolute value | At least 0.001 |
| Custom temperature | -90 to 70 °C, or -130 to 158 °F | Finite |
| Custom pressure | 300 to 1200 hPa, or 8.86 to 35.4 inHg | Above 0 |
| Humidity | 0 to 100 % | The same |

Weight, diameter, twist, length and altitude have no upper limit. The full table of guards per path is in [Input guards](ballistics-model.md#input-guards).

## Decisions

**Decimal comma (#117).** A comma reads as a decimal point everywhere a number is read. There is no thousands separator, so `1,500` is 1.5, not 1500. Two parsers in [`decimal.js`](../src/lib/utils/decimal.js):

| Function | Used by | `90abc` | `1,5` | `Infinity`, `0x10` |
|----------|---------|---------|-------|--------------------|
| `parseDecimal` (strict) | Profile form | Error | 1.5 | Error |
| `readDecimal` (lenient) | Calculators, calculator page boxes, wind dial | 90, as pinned since #116 | 1.5 | Infinity and 0, then rejected by the limits where a field has one |

`readDecimal` is `parseFloat` with the first comma replaced, so a value without a comma reads as before. The form saves numbers with a decimal point (`normalizedNumbers`), because other code reads stored values with `parseFloat` or `Number`.

**Zero limits (#114, #93).** The owner chose option 1 of #114, with a floor of 1 rather than the proposed 0.2. A zero near 1 on a slow or low-BC load can still give no result: the compare page now says so (`compare_zero_no_result`).

**MPBR above a 3000 zero.** A huge target can give a suggested zero above 3000. The result is shown as before, but the "Set MPBR for current profile" button is replaced by `mpbr_zero_out_of_range`, since every other path would reject that zero.

**Scope view range.** The range picker used to go to 9999. A stored range above 3000 now gives no result and a message ([`scopeRange.js`](../src/lib/utils/scopeRange.js)). The digits still show the stored value, and the buttons clamp to 3000.

## Changed results

The owner approved these on 2026-11-10. No other baseline changed.

| Test in [`dopeCard.baseline.test.js`](../src/test/dopeCard.baseline.test.js) | Before | Now |
|------|--------|-----|
| Far zero blank past the search range, imperial | 3500 yd zero | 3000 yd zero, same assertions |
| Same, metric | 3500 m zero, card with a blank far zero | 3500 m zero gives no card (`null`) |

The metric case did not move to 3000 m because a 3000 m zero prints a far crossing at 2743 m. That is existing behaviour and was not investigated.

Any value that used to give a result and is now past a limit gives no result instead. A comma value now gives the result for the full number, where it used to be cut at the comma.

## Technical changes

| File | Change |
|------|--------|
| [`inputLimits.js`](../src/lib/utils/inputLimits.js) (new) | Limits and checks: `isUsableBc`, `hasFlyableVelocity` (moved here), `isUsableSightHeight`, `isUsableRange`, `isUsableAtmosphere` |
| [`decimal.js`](../src/lib/utils/decimal.js) (new) | `parseDecimal`, `readDecimal`, `normalizeDecimal` |
| [`dopeCardDownload.js`](../src/lib/utils/dopeCardDownload.js) (new) | Saves a card only when the generator returns one. A thrown error counts as no card |
| [`scopeRange.js`](../src/lib/utils/scopeRange.js) (new) | Scope view range check and effective range, moved out of the page |
| [`zeroDistance.js`](../src/lib/utils/zeroDistance.js) | `MIN_ZERO_DISTANCE` 1, `MAX_ZERO_DISTANCE` 3000, `zeroDistanceValue` |
| [`ballisticCalculator.js`](../src/lib/utils/ballisticCalculator.js) | Shot point, full trajectory and MPBR use the shared checks. Custom atmosphere moved to `shotAtmosphere`. The MPBR-only BC and velocity constants are gone |
| [`dopeCardImperial.js`](../src/lib/utils/dopeCardImperial.js), [`dopeCardMetric.js`](../src/lib/utils/dopeCardMetric.js) | BC, velocity and sight height guards. The generators return `null` instead of a blank PDF |
| [`profileValidation.js`](../src/lib/utils/profileValidation.js) | Strict parsing, `out_of_range` error, `profileFieldLimits`, `normalizedNumbers` |
| [`trajectoryValidation.js`](../src/lib/utils/trajectoryValidation.js) | Range at most 3000, `readDecimal`, BC floor from `MIN_BC` |
| [`shotWind.js`](../src/lib/utils/shotWind.js), [`WindInput.svelte`](../src/lib/components/WindInput.svelte) | Wind read with `readDecimal`, so dial, badge and result agree |
| [`format.js`](../src/lib/utils/format.js) | `formatLimit`: a limit in the locale without grouping (`25,4` in French and German) |
| [`ProfileForm.svelte`](../src/lib/components/ProfileForm.svelte) | Range messages in the unit chosen. Saves numbers with a decimal point |
| [`AtmosphereCard.svelte`](../src/lib/components/AtmosphereCard.svelte) | Message under each box out of its range, and under an altitude that is not a number |
| [`DistanceInput.svelte`](../src/lib/components/DistanceInput.svelte) | Buttons stop at 3000. New `invalid` prop for a message |
| Compare page | Range at most 3000 with a message. Each entry is calculated once, and a usable zero with no result shows `compare_zero_no_result` |
| Dope cards page | `dope_no_result` when no card is saved |
| MPBR page | `mpbr_zero_out_of_range` in place of the save button above a 3000 zero |
| Trajectory validation page | Range message above 3000 |
| Scope view page | Range message above 3000. Click values read with `readDecimal` |
| Ballistic page | Step and wind badge read with `readDecimal` |

Messages, in `en.json`, `fr.json` and `de.json`: new `validation_range`, `validation_range_above_zero`, `validation_min`, `validation_range_below_max`, `mpbr_zero_out_of_range`, `compare_zero_no_result`. `compare_zero_invalid` now states the range. `dope_no_result` already existed.

Guides updated: [ballistics-model.md](ballistics-model.md) (typed numbers, custom atmosphere, wind, input guards, remaining gaps) and [testing.md](testing.md) (counts, new files, hang stubs for MPBR).

## Checks

- `npm run test:run`: 1830 passed, 1 todo, 20 files. New: [`inputLimits.test.js`](../src/test/inputLimits.test.js) (458), [`decimal.test.js`](../src/test/decimal.test.js) (85), [`scopeRange.test.js`](../src/test/scopeRange.test.js) (22). Values past a limit are tested with the engine stubbed to throw, and values at each limit must reach the stub.
- `npm run build` passes. `npm run build:mobile` also passes on the final code, run before the last web build.
- **Not checked in a browser.** The messages, the range buttons and the form errors were not seen on screen.

Hang measurements, through `calculateShotPoint` and `calculateFullTrajectory`:

| Run | Combinations | Result |
|-----|--------------|--------|
| Before the change (f40933f), worst cases inside the limits, 16 in parallel | 3888 | No hang. Slowest 2.2 s, on a 3000 zero |
| Before the change, outside them | n/a | Hangs past 6 s only with a sight height about the zero distance or more (20 in with a 0.5 yd zero, 10 in with a 0.2 yd zero) |
| After the change: limit values, values just past them, absurd values (1e300, -273 °C, BC 1e-9) | 57,600 | No hang, none over 0.5 s. Values past a limit gave no result |
| Security review, metric worst case | n/a | Slowest 2.1 s |
| Security review, fields without a limit (altitude, weight, diameter, twist, length, step, cant, MPBR target) | n/a | All under 1 s |

The dope cards, MPBR and validation were not part of the 3888 and 57,600 runs. No run proves that every combination inside the limits returns.

## Security review

PASS after one round. Two Low findings, both fixed:

- A stored scope range above 3000 was shown as 3000 with no result. The picker now shows the stored value and the page shows the range message.
- A stored array such as `["1","2"]` read as 1.2 in the form and as 1 in the calculators. The form now rejects any stored value that is not a string or a number.

Pre-existing, not fixed:

- A typed cosine in the scope view is not range-checked. 2 doubles the distance and gives an empty result with no message. -1 silently uses the absolute distance.
- The dope card page shows `dope_no_result` also when saving the file fails.
- MPBR target size has no upper limit. No hang was found.
- With the comma rule, a German entry such as altitude `1.500` reads as 1.5 with no error.

## Open points

- Weight, diameter, twist, length and altitude have no upper limit. A stored `Infinity` or hex weight or diameter still gives a result.
- The Ballistic page range box shows no message above 3000. It gives no result there, as the full trajectory already did before this change.
- The metric far crossing at 2743 m with a 3000 m zero was not investigated.

## Changelog

- 2026-11-10: initial delivery
