# Max distance in hundreds; MPBR chart step 1; validation chart ticks every 100

Issue: [#199](https://github.com/hawkins48b/cw-zro/issues/199). Branch `task/199-hundreds-chart-ticks`. Asked by the owner on 2026-11-18.

## What changed

| Page | Before | After |
|------|--------|-------|
| Ballistic, Compare Trajectories | Max distance above 0, at most 3000 | A multiple of 100, from 100 to 3000. Anything else: "Enter a multiple of 100 from 100 to 3000 yd" (en/fr/de, `validation_max_distance_hundreds`) and no result |
| MPBR chart | Rows every 5 yd/m | Rows every 1 yd/m. Axis unchanged (ApexCharts' own ticks, every 100 on the cases seen) |
| Trajectory Validation chart | Axis 100 to the range, ticks left to ApexCharts | Axis 100 to the first hundred at or past the range (at least 200), a tick every 100. The curves run to that end |

Code:

- `isUsableHundredsRange` and `MAX_DISTANCE_STEP` (100) in `src/lib/utils/inputLimits.js`. `isUsableBallisticRange` (`ballisticPage.js`) and the compare page use it. Scope View, zero distance, profile forms and Trajectory Validation keep their own limits.
- `calculateMPBR` (`ballisticCalculator.js`): chart rows `toDistance(1)` instead of `toDistance(5)`.
- `validationChartAxis(range)` in `src/lib/utils/trajectoryValidation.js` gives `{ min: 100, max, tickAmount }`, or null outside 100 to 3000. The page computes both chart curves to `max` and passes min, max and tickAmount to ApexCharts.

## Results

No recorded result changed: all baselines pass. MPBR near and far zero come from the engine's flagged rows, which do not depend on the step. Timing of `calculateMPBR` in the dev container: 35 ms (`.308`, 8 in, 353 rows), 339 ms (`.308`, 33000 in, 3579 rows).

A saved Ballistic or Compare range that is not a whole hundred (e.g. 550) now shows the message and no result until it is changed. The default, 500, is unchanged.

My choices, not asked:

- Trajectory Validation draws the curves past the range up to the next hundred, so the plot has no empty end. The range line and the observation marker stay at the range.
- A validation range of exactly 100 gets an axis to 200, so it is not a single point.
- Ballistic's step limits are unchanged: the step can still be any value from 1 to the range.

## Tests

`src/test/hundredsChartTicks.test.js` (new, 36), `src/test/ballisticPage.test.js` (88: 1, 0.5, 600,5 moved from accepted to rejected, with 99, 437, 500.01, 2999, 250). Full run: 5087 passed, 1 todo, 72 files. `npm run build` passes.

## Review

PASS (security-reviewer, 2026-11-18): no `{@html}`; the hundreds rule only narrows `isUsableRange`; rejected ranges never reach the engine; the validation chart stays within 3000 (at most 29 ticks); MPBR chart rows bounded by the capped `mpbrMax`. Pre-existing, not changed: the validation page passes `readDecimal(...) || 100` as the range line, unused when there is no chart.

## Not verified

Not opened in a browser. To check:

- `/calculators/ballistic` and `/calculators/compare-trajectories`: type 550 in Max distance: the message shows and the table/chart goes. 600 shows them again.
- `/calculators/mpbr`: calculate; the curve is smooth, ticks every 100.
- `/calculators/trajectory-validation`: range 437 yd: axis 100 to 500 with ticks at 100, 200, 300, 400, 500; observation marker at 437.
