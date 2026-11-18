# 2026-11-18: Precision card maximum distance in hundreds, unit chips inside, no presets (#198)

Issue: [#198](https://github.com/hawkins48b/cw-zro/issues/198). Owner feedback on [#197](2026-11-18-197-precision-distance-unit.md), 2026-11-18.

## What changed

In [`PrecisionCardGenerator.svelte`](../src/lib/components/PrecisionCardGenerator.svelte):

| Part | After #197 | Now |
|------|-----------|-----|
| Maximum distance | Plain box (`UnitField`), unit as a suffix | `StepperField`: − and + by 100 (100 to 3000), the **m / yd chips inside the box**, as on Scope View |
| Distance unit | A "Distance" row in Units | The chips in the box; no Distance row |
| Presets | Metric / Imperial chips | Removed. Wind, pressure and temperature keep one toggle each; with distance, they still start from the zero's unit (metric for m, imperial for yd) and reset on a profile change |
| Units heading | "Units" | "Wind, pressure and temperature in" again (no distance there) |
| Typed value | Used as typed (850 gave pages to 800) | Rounded to the nearest hundred, a half up (850 → 900, 849 → 800): the box shows it when it loses focus, and the card always gets it, even before |
| Out of limits | Error under the box | The same, judged on the rounded value: 3040 → 3000 is fine, 3100 stays as typed with the error and the download disabled |

[`StepperField.svelte`](../src/lib/components/StepperField.svelte) gets an optional `onblur` prop; its other users pass none, so nothing changes for them. [`precisionCard.js`](../src/lib/utils/precisionCard.js) gets `roundMaxDistance(value)`: the nearest multiple of `PRECISION_PAGE_STEP`, NaN for anything that is not a finite number. `computePrecisionCard` still takes any usable maximum and floors the pages, as before.

A − or + from a value that is not a hundred keeps the offset (850 + 100 = 950), and the box is rounded on blur. On a phone, tapping a button blurs the box first, so it rounds before the step.

Messages: new `dope_precision_max_down`, `dope_precision_max_up` ("Decrease/Increase the maximum distance by {step} {unit}"); changed `dope_precision_max_hint` ("{min} to {max} {unit}, in hundreds."), `dope_precision_units`; removed `dope_precision_units_presets`. `dope_precision_units_distance` now names the chips.

## The reported crash

The owner reported the PDF generator failing on values that are not whole hundreds. Not reproduced: `generatePrecisionDopeCard` in Node made cards for 100, 150, 850, 875, 899.5, 1050, 2950, 2999 and 3000, in m and yd. Whatever failed in the browser, the card now only gets whole hundreds.

## Tests

5033 passed, 1 todo, in 71 files; `npm run build` and `svelte-check` pass. New: `roundMaxDistance` cases in `precisionCard.test.js`, and `precisionCardGenerator.svelte.test.js` (jsdom, 10 tests; see [testing](testing.md)). No recorded result changed.

## Security review

PASS (security-reviewer, 2026-11-18): no `{@html}`; the rounded value still goes through `isUsableMaxDistance` in the component and in `computePrecisionCard`; `onblur` is optional, so the other `StepperField` users are unchanged. No pre-existing issue found on these paths.

## Not verified

Not opened in a browser. To check: Calculators › Dope Cards › precision card. The maximum distance box has − and + (on touch screens) and m / yd chips inside; no Metric / Imperial row. Type 850, leave the box: it shows 900 and the summary ends at 900. Download: the last page is 900.
