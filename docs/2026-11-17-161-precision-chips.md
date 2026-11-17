# 2026-11-17: Precision dope card controls in the app's standard style (#161)

Issue: [#161](https://github.com/hawkins48b/cw-zro/issues/161). Owner request after [#160](2026-11-17-160-precision-unit-choice.md): the generator's unit buttons were large, unlike the unit buttons elsewhere in the app.

## Change

| File | Before | After |
|------|--------|-------|
| `src/lib/components/PrecisionCardGenerator.svelte` | "Corrections in", the Metric/Imperial presets and the wind, pressure and temperature toggles were full-width pill tracks (`ChipGroup variant="segmented" stretch`) | The `chips` variant of `ChipGroup`, the small Skeleton chips the profile form's unit fields use, one row per toggle: label on the left, chips on the right, wrapping on a narrow screen. The presets sit on the row of the units heading |
| same | Download PDF was full width and 48 px tall | `btn preset-filled-primary-500`, like the mid-range card's Download buttons |
| `src/routes/calculators/dope-cards/precision-guide/+page.svelte` | "Back to the card generator" was full width on a phone and 48 px tall | `btn preset-filled-primary-500` |

The toggles keep `aria-pressed`, their group names and the 44 px touch areas of `ChipGroup` (`.touch-hit`). No calculation, message or PDF changed.

## Checks

- `npm run test:run`: 4613 passed, 1 todo, in 47 files. `npm run build` passes.
- Security review: PASS.
- Not seen in a browser. The owner checks /calculators/dope-cards and the guide: light and dark, phone width, the chips beside their labels.
