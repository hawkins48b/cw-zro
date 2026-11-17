# 2026-11-17: Precision dope card units chosen apart (#160)

Issue: [#160](https://github.com/hawkins48b/cw-zro/issues/160). Change to the precision dope card ([#157](2026-11-17-157-precision-dope-card.md)), on an owner request of 2026-11-17, approach confirmed with the owner on the issue.

## What changed

The card had one unit choice, metric (m/s, hPa, °C) or imperial (mph, inHg, °F). Wind, pressure and temperature now each have their own unit. Metric and Imperial stay as presets that set all three.

| Part | Before | Now |
|------|--------|-----|
| Generator | One toggle: "m/s · hPa · °C" or "mph · inHg · °F" | A Metric / Imperial preset toggle, then one toggle each for Wind (m/s, mph), Pressure (hPa, inHg) and Temperature (°C, °F). A mixed choice presses neither preset |
| Default | Metric for a zero in m, imperial for yd; reset on profile change | The same, as the matching preset |
| `units` option | `'metric'` or `'imperial'` | `{ wind: 'mps'\|'mph', pressure: 'hpa'\|'inhg', temperature: 'c'\|'f' }`, or `'metric'` / `'imperial'` as presets |
| `card.units` | The string | Always the object (frozen) |
| `card.columns` | `PRECISION_UNITS[units]` | `precisionColumns(units)`: `{ pressure, temperature, wind }` from `PRECISION_COLUMNS` |
| Templates | `static/pdf/precision-{en,fr,de}-{metric,imperial}.pdf` (6) | `static/pdf/precision-{en,fr,de}.pdf` (3), with no unit in them |
| Drawn at fill time | Numbers and data words | Also the units: ③ and ④ unit symbol, column values and the lines between the columns; ⑥ ring speeds and unit; worksheet units of ③, ④, ⑥; cover reference pressure, reference temperature and wind unit |

Distances, the ② steps and the footer size (cm or in) still follow the zero, as before.

The number of temperature columns depends on the unit (8 in °C, 7 in °F), so the column lines of ④ moved to the fill code too. They are drawn 0.5 px inside the table's 1 px border, which the template draws.

## API

In [`precisionCardFormat.js`](../src/lib/utils/precisionCardFormat.js), re-exported by `precisionCard.js`:

| Name | What |
|------|------|
| `PRECISION_COLUMNS` | `wind.mps`, `wind.mph`, `pressure.hpa`, `pressure.inhg`, `temperature.c`, `temperature.f`: the columns of #157, unchanged |
| `PRECISION_UNIT_PRESETS` | `metric`: `{ wind: 'mps', pressure: 'hpa', temperature: 'c' }`; `imperial`: `{ wind: 'mph', pressure: 'inhg', temperature: 'f' }` |
| `precisionUnits(value)` | The option read strictly, a new frozen object, or null |
| `precisionUnitPreset(units)` | `'metric'`, `'imperial'` or null for a mixed choice (used by the generator for `aria-pressed`) |
| `precisionColumns(units)` | `{ pressure, temperature, wind }`, or null |

`PRECISION_UNITS` is gone. `precisionTemplatePath(locale)` takes the language only. `buildPrecisionTemplate(locale)` likewise; `TEMPLATE_UNITS` is gone.

### Guard

`precisionUnits` returns null, and `computePrecisionCard` and `generatePrecisionDopeCard` return null without reaching the engine or fetching a template, for:

- a string other than `metric` and `imperial` (case counts; `toString` and `__proto__` are refused);
- null, a number, a function, an array (also one with the three keys set);
- an object whose own keys are not exactly `wind`, `pressure` and `temperature`: a missing key, an extra key (string or symbol), a key only inherited (`Object.create(preset)`), a `__proto__` key from `JSON.parse`;
- a unit that is not an own key of its table: an unknown one (`kmh`, `k`), the printed symbol (`m/s`, `hPa`), an inherited name (`constructor`, `hasOwnProperty`, `__proto__`), a non-string (an object with `toString`, a `String` object);
- an object that throws when read (a getter, a Proxy `ownKeys` trap).

Each key is read once, so a getter cannot pass the check and then give another value. Rejecting extra keys is my choice for "strictly": `{ ...preset, distance: 'm' }` gives no card.

## Calculation

Each table is fired in its own unit: the pressure `Atmo` takes `hPa` or `InHg` from `units.pressure`, the temperature `Atmo` `Celsius` or `Fahrenheit` from `units.temperature`, the wind `MPS` or `MPH` from `units.wind`. Before, all three followed the one `units` string. The reference atmosphere and the other fixed values (pressure columns at 15 °C, temperature columns at 1013.25 hPa, altitude 0, humidity 0) are the same whatever the units, as before.

**The presets give exactly the cards of #159.** Before any change, 76 cards were saved as JSON: the sample, the sample with powder sensitivity (2 fps/°C at 15 °C), the sample zeroed in yd, and each fixture profile zeroed at 100 with 0.1 MRAD and with 1/4 MOA clicks; metric and imperial; clicks and angle; to 1500. After the change the same cards were computed from the preset names and from the preset objects. Both outputs are byte for byte the saved file (`units` left out, since it is now an object). `precisionCard.test.js` keeps a smaller version: a preset name and its object give equal cards, for the sample and the `.308` MOA profile, clicks and angle.

**A mixed choice** takes each table from the card of its unit: with mph, hPa and °F, the sample's wind equals the imperial card's, its pressure the metric card's, its temperature the imperial card's (7 columns), and its distances, elevation, ②, spin drift, time and click size the metric card's. The test checks the opposite mix (m/s, inHg, °C) too.

## PDF

The fill draws the unit-dependent parts at the positions the template used. Rendered with pdf.js in Node (not a browser), at 3×, for the sample at 300 m in clicks, metric and imperial, EN, FR and DE, against the same cards from `origin/develop`:

- cover and worksheet: pixel-identical;
- range pages: 74 to 76 pixels differ per page, all at the top and bottom edges of the ③ and ④ tables, where the column lines now stop 0.5 px inside the border instead of being drawn under it. Nothing else differs.

Sample renders of a mixed card (m/s, inHg, °F, French; mph, hPa, °C, English) were looked at: the cover lists 29.92 inHg, 59 °F and m/s; the 700 m page has inHg and °F columns with m/s rings, or hPa and °C with 5 to 20 mph rings; the worksheet shows inHg, °F and m/s.

## Generator

Under "Wind, pressure and temperature in": a segmented Metric / Imperial toggle (stretched, group named "Unit presets"), then a two-column grid with a label and a stretched segmented toggle per quantity. Each toggle is a `ChipGroup` with its own `aria-label`; the visible labels are `aria-hidden` to avoid reading the name twice. The choice is kept in `$state.raw` as a frozen plain object, so the PDF code gets no Svelte proxy. Picking another profile resets it to the zero's preset, as before.

## Files

| File | Change |
|------|--------|
| `src/lib/utils/precisionCardFormat.js` | `PRECISION_COLUMNS`, `PRECISION_QUANTITIES`, `PRECISION_UNIT_PRESETS`, `precisionUnits`, `precisionUnitPreset`, `precisionColumns`; `PRECISION_UNITS` removed |
| `src/lib/utils/precisionCard.js` | Reads `units` with `precisionUnits`; each table in its own unit; `card.units` is the object |
| `src/lib/utils/precisionCardPdf.js` | Fetches the language's template; draws the units, column values and lines, ring speeds and cover reference values |
| `src/lib/utils/precisionCardLayout.js` | `precisionTemplatePath(locale)` |
| `src/lib/utils/precisionCardWords.js` | Comment: template path |
| `scripts/precision-card-templates.js` | One template per language, no units |
| `static/pdf/precision-{en,fr,de}.pdf` | New, from `npm run templates:precision` |
| `static/pdf/precision-{en,fr,de}-{metric,imperial}.pdf` | Deleted |
| `src/lib/components/PrecisionCardGenerator.svelte` | Presets and three unit toggles |
| `src/routes/calculators/dope-cards/precision-guide/+page.svelte` | `dope_guide_wind_mph` instead of `dope_guide_wind_imperial` |
| `messages/en.json`, `fr.json`, `de.json` | New `dope_precision_units_presets`, `_wind`, `_pressure`, `_temperature`, `dope_guide_wind_mph`; removed `dope_precision_units_metric`, `_imperial`, `dope_guide_wind_imperial`. The presets reuse `dope_metric` and `dope_imperial`, the toggles `unit_mps`, `unit_mph`, `unit_hpa`, `unit_inhg`, `unit_c`, `unit_f`. 622 keys per language |
| `src/test/precisionCard.test.js` | Unit guard, presets equality, mixed choices |
| `src/test/precisionCardPdf.test.js` | 8 choices × 3 languages, templates without units, preset name and object draw the same, unknown unit; overlap and content-area tests with mixed units; one template test per language |
| `docs/ballistics-model.md`, `development.md`, `testing.md`, `translations.md` | Units, templates, counts |

## Checks

- `npm run test:run`: 4613 passed, 1 todo, in 47 files. `npm run build` passes.
- The dial overlap test (no value over another value, a ring speed, the unit or a ray label, on every page of 3000 m and 3000 yd cards) runs also with mph rings, hPa and °F (clicks, `.223` with 1/4 MOA) and m/s rings, inHg and °F (angle, sample with a MOA reticle). The content-area test runs with two mixed choices in each language.

## Open

- French and German labels were written by the developer, not reviewed by a translator or native speaker ("Préréglages d'unités", "Einheiten-Voreinstellungen").
- Not checked in a browser: the generator's look on a phone and in dark mode, and the toggles with a screen reader.
- Not checked on paper.
- The 0.5 px inset of the ③ and ④ column lines is the only visual change on a preset card.
- `docs/architecture.md` says the app fetches "its two PDF templates" (the CSP row); that was already loose before this change and was left as is.
