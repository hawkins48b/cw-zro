# 2026-11-18: Precision dope card distance unit chosen apart (#197)

Issue: [#197](https://github.com/hawkins48b/cw-zro/issues/197). Change to the precision dope card ([#157](2026-11-17-157-precision-dope-card.md), [#160](2026-11-17-160-precision-unit-choice.md)), on an owner request of 2026-11-18.

## What changed

The card's distances followed the zero: a 100 yd zero always gave a yard card, a 100 m zero a metre card. The distance unit is now chosen in the generator, apart from the zero.

| Part | Before | Now |
|------|--------|-----|
| Generator | "Wind, pressure and temperature in": presets, then Wind, Pressure, Temperature | "Units": presets, then **Distance** (m, yd), Wind, Pressure, Temperature. Metric sets m, Imperial sets yd; a preset is pressed only when all four match |
| Default | Distances in the zero's unit | The same: the preset of the zero's unit, reset on profile change |
| Maximum distance field | Suffix and messages in the zero's unit; hint "Units follow the zero (m or yd)." | Suffix and messages in the chosen unit; hint "{min} to {max} {unit}." (100 to 3000) |
| Zero | 100 in the zero's unit, reference atmosphere | Unchanged |
| Pages, ② steps, worksheet unit | Zero's unit | Chosen unit |
| Click size in the footer | cm for an m zero, in for yd | cm for an m card, in for a yd card |
| Cover | Zero and Distances in the zero's unit | Zero in its own unit (e.g. "100 yd"), Distances in the chosen unit (e.g. "100–800 m") |
| Precision guide | "Distances follow the zero, in m or yd, …" | "Distances are in m or yd, chosen apart from …; they start in the unit of the zero." (`dope_guide_wind_mph`, three languages) |

With a 100 yd zero on a metre card, the 100 m page is past the zero (109.4 yd), so its elevation is not 0. With a 100 m zero on a yard card, the 100 yd page (91.4 m) is short of it.

## API

[`computePrecisionCard(profile, options)`](../src/lib/utils/precisionCard.js) takes `options.distanceUnit`: `'m'`, `'yd'`, or undefined for the zero's unit. Any other value (`'km'`, `''`, `null`, an array, an object) gives null before the engine runs. The card has a new `zeroUnit` (`'m'|'yd'`, the profile's); `distanceUnit` is now the chosen unit and `sizeUnit` follows it. [`generatePrecisionDopeCard`](../src/lib/utils/precisionCardPdf.js) passes the option through and prints the cover zero with `zeroUnit`.

The `units` option and `precisionUnits()` are unchanged (three keys): the component keeps the distance unit next to them and passes it as its own option.

Messages: new `dope_precision_units_distance`; changed `dope_precision_units` ("Units"), `dope_precision_max_hint`, `dope_guide_wind_mph`.

## Results

No recorded result changed. Without the option, or with the zero's unit asked, the card is equal to before (tested on the metric sample and the P308 MOA profile). Test totals: **5010 passed, 1 todo**, in 70 files; `npm run build` and `svelte-check` pass.

## Tests

- `precisionCard.test.js`: default and same-unit cards equal; a 100 yd zero on a metre card (pages, ② steps, cm click size, zero kept, each metre page's elevation between the neighbouring yard pages); a 100 m zero on a yard card (in click size, 100 yd page not below the line, 1000 yd less than 1000 m); six damaged values give null.
- `precisionCardPdf.test.js`: both mixed cases print the zero in its unit and the distances in the chosen one on the cover, the chosen unit on each range page and the worksheet, and the matching click size unit.

## Security review

PASS (security-reviewer, 2026-11-18): the option is read once and must be `undefined`, `'m'` or `'yd'`, checked before the engine; the units printed come from code, not the profile; no `{@html}`. No pre-existing issue found on these paths.

## Not verified

The generator screen was not opened in a browser. To check: Calculators › Dope Cards › precision card, with a 100 yd profile pick Distance **m**: the maximum distance field shows m, neither preset is pressed, and the PDF has pages 100 m, 200 m, …, a cover with "Zero 100 yd" and "Distances 100–… m", and the footer click size in cm. Press Metric: all four switch and Metric is pressed.

Release notes: the precision card's distances can be in m or yd whatever the zero's unit.
