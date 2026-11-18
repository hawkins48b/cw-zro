# 2026-11-18: Precision card maximum distance: a field error instead of rounding (#198)

Issue: [#198](https://github.com/hawkins48b/cw-zro/issues/198), reopened. Owner feedback on [the first delivery of #198](2026-11-18-198-max-distance-field.md), 2026-11-18: "instead of correcting, I would prefer a field error".

## What changed

| Part | First delivery (b78f332) | Now |
|------|-----------|-----|
| A value that is not a whole hundred (850, 1234,5) | Rounded to the nearest hundred on blur; the card got the rounded value | Left as typed. Field error "Enter a whole hundred from 100 to 3000 m (100, 200, 300…)." (`dope_precision_max_invalid`, three languages), download disabled |
| `isUsableMaxDistance` ([`precisionCard.js`](../src/lib/utils/precisionCard.js)) | 100 to 3000, any number | 100 to 3000, whole hundreds only. So `precisionPageDistances(850)` is `[]` and `computePrecisionCard` gives null for 850: no PDF can get another value |
| `roundMaxDistance` | Added | Removed |
| `StepperField` `onblur` prop | Added | Removed: nothing uses it |

The m / yd chips in the box, − and + by 100 and the removed presets stay as in the first delivery.

Before #198 the card took any value from 100 to 3000 and stopped at the last whole hundred within it (850 gave pages to 800). That is no longer accepted, from the generator or from code.

− or + from a value that is not a hundred keeps the offset (850 + 100 = 950), which is still an error; the user corrects the box.

## Tests

5033 passed, 1 todo, in 71 files; `npm run build` and `svelte-check` pass. `precisionCard.test.js`: 150.5, 199, 850, 2999 and 100.000001 refused, 850 gives no card; the `roundMaxDistance` tests removed. `precisionCardGenerator.svelte.test.js` (16): eight invalid entries each give the error, stay as typed after blur and disable the download; four valid ones give none; the card gets 900. No recorded result changed.

## Security review

PASS (security-reviewer, 2026-11-18): only a number, finite, 100 to 3000 and a multiple of 100 passes `isUsableMaxDistance`, checked in the component, `precisionPageDistances` and `computePrecisionCard`; no `{@html}`; no other caller affected. No pre-existing issue found on these paths.

## Not verified

Not opened in a browser. To check: Calculators › Dope Cards › precision card. Type 850 and leave the box: it stays 850, the box is marked in error with the message above, and Download is disabled. Type 900: no error, the PDF ends at 900.
