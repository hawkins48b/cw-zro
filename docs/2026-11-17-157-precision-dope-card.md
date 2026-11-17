# Precision dope card (Abaque)

- **Date:** 2026-11-17
- **Branch:** task/157-precision-dope-card
- **Issue:** [#157](https://github.com/hawkins48b/cw-zro/issues/157)
- **Status:** Delivered, not in production yet. Printed values not yet approved by the owner. Not checked in a browser or on paper

## Summary

The Dope Cards page only had the mid-range card (0 to 500 m or yd, one sheet). The issue asked for a precision card for long-range shooters: one page per 100 m or yd, every correction in turret clicks, after the Swiss army firing-element pages.

**Delivered.** A second card on `/calculators/dope-cards`, "Precision dope card" ("Abaque de précision" in French, "Präzisions-DOPE-Karte" in German). It makes an A6 PDF (105 × 148 mm):

1. a cover with the profile summary and the card settings,
2. one page per 100 from 100 to the chosen maximum distance (100 to 3000), each with ① elevation, ② the extra clicks at +25, +50 and +75, ③ a pressure table, ④ a temperature table, ⑤ spin drift and time of flight, ⑥ a quarter wind dial, and a footer with the size of one click,
3. a blank click worksheet.

At most 32 pages (cover, 30 range pages, worksheet). A new page, `/calculators/dope-cards/precision-guide`, explains how to read the card; the PDF itself has no explanations.

In French, every dope card is now an "Abaque" (the existing strings are renamed).

## Owner decisions (2026-11-17, on the issue)

| Topic | Decision |
|-------|----------|
| Templates | Drawn by a pdf-lib Node script (`npm run templates:precision`, [`scripts/precision-card-templates.js`](../scripts/precision-card-templates.js)) from one layout module shared with the fill code. No SVG source: the dev container has no SVG-to-PDF tool |
| Imperial temperature columns | +110 to -10 °F, step 20 (7 columns) |
| Imperial pressure columns | 29.5 to 22.0 inHg, step 1.5 |
| Imperial wind rings | 5, 10, 15, 20 mph |
| Maximum distance | 100 to 3000, in the zero's unit |
| Click units | MOA or MRAD required on both turrets |

## Choices not yet confirmed by the owner

Made by the agents during the task. They wait for the owner.

- Words that depend on the data (clicks / MRAD / MOA, Left / Right, the unit, "page") are drawn at fill time from the same word table as the templates. So each template file has 3 pages (cover, range page, worksheet), one per language and unit system (6 files), instead of one template per correction unit.
- Spin drift uses the profile's twist and bullet length whatever its spin-drift switch says. Missing or out of limits: the card prints "–". This does not block the download.
- Rounding: ① and spin drift are counted like the Scope View (angle rounded to 0.1 in the click unit, then whole clicks). ② is clicks(D+x) − clicks(D), so ① + ② is the count at D+x. ③, ④ and the wind round the angle difference, never a difference of rounded counts.
- The pressure columns are station pressure at altitude 0, not QNH.
- Powder sensitivity (when on in the profile) is included in the temperature columns.
- Extra distances past 3000 (on the 3000 page) print "–".
- Numbers use a decimal point in all three languages.
- The form's choices (profile, maximum distance, correction, units) are not saved.
- Units default to metric for a 100 m zero, imperial for a 100 yd zero.
- The maximum distance box is read strictly (`parseDecimal`): text like `800x` is refused.

## Release notes

- New: a precision dope card on the Dope Cards page. A6 booklet, one page per 100 m or yd up to 3000 (at most 32 pages), with elevation, extra distances, pressure, temperature, spin drift, time of flight and wind, in clicks, MRAD or MOA. A guide explains how to read it.
- French: dope cards are now called "Abaques".

## How to use

Open `/calculators/dope-cards` (also `/fr/...`, `/de/...`), or Calculators → Dope Cards. No account or role.

1. In the **Precision dope card** section, pick a profile. The active profile is preselected.
2. Check the list under the profile:
   - Zero at exactly 100 m or 100 yd (required).
   - Reticle `mrad`, `mil-dot` (both MRAD) or `moa` (required).
   - Elevation and windage clicks in MOA or MRAD, value above 0 (required).
   - Twist and bullet length (optional: without them the card prints no spin drift).
   If a required item fails, a warning says why with an **Edit profile** link, the options are dimmed and **Download PDF** is disabled.
3. Set the **maximum distance** (100 to 3000, in the zero's unit). Pages are every 100 up to the last whole 100 within it.
4. Choose **Corrections in**: Clicks, or the reticle's unit (MRAD or MOA).
5. Choose **Wind, pressure and temperature in**: m/s · hPa · °C, or mph · inHg · °F.
6. Tap **Download PDF**. The file is `precision-dope-card.pdf`.

"How to read the card" opens `/calculators/dope-cards/precision-guide`: ① to ⑥, the wind quarters (the dial shows XII to III; the other quarters hold the same numbers, wind from the right is dialled right and from the left dialled left, with a table of which column to read for each direction), a worked example, and printing at 100 % scale, 4 per A4 sheet.

The page distances and the ② steps follow the zero's unit; the Units choice only changes the pressure, temperature and wind columns.

## What the card computes

Full description: [Ballistics model, Precision dope card](ballistics-model.md#precision-dope-card). In short:

- The rifle is zeroed once at 100 in the ICAO standard atmosphere (altitude 0, 1013.25 hPa, 15 °C, humidity 0). Every pressure, temperature and wind value is fired with that same zero elevation. The other calculators solve the zero again in each atmosphere; this card does not, on purpose.
- Columns: pressure 1000 → 750 hPa (step 50) or 29.5 → 22.0 inHg; temperature +45 → -25 °C (step 10) or +110 → -10 °F; wind rings 2/4/6/8 m/s or 5/10/15/20 mph.
- Wind: full crosswind at III, × 0.5 at I, × 0.866 at II, with the spin drift removed.
- Pages stop where the engine ends the reference flight. A column or extra distance whose flight ended earlier prints "–". No card when not even the 100 page exists.

### Sample values

The owner's sample profile: 6.5 Creedmoor 140 gr, G7 0.326, 820 m/s, sight height 4.5 cm, twist 1:8" right, length 1.37 in, zero 100 m, 0.1 MRAD clicks. At 700 m the card matches the design in every cell:

| Item | 700 m |
|------|-------|
| ① Elevation | +58 clicks |
| ② +25 / +50 / +75 | +3 / +7 / +10 |
| ③ Pressure 1000 … 750 hPa | 0, -1, -3, -4, -5, -6 |
| ④ Temperature +45 … -25 °C | -2, -1, -1, 0, +1, +1, +2, +3 |
| ⑤ Spin drift | Left 1 click |
| ⑤ Time of flight | 1.07 s |
| ⑥ Wind I (2/4/6/8 m/s) | 3, 6, 9, 12 |
| ⑥ Wind II | 5, 11, 16, 21 |
| ⑥ Wind III | 6, 12, 18, 24 |
| Footer | 1 click = 7.0 cm |

`precisionCard.test.js` pins these. Spin drift, the pressure and temperature deltas and the wind dial are new outputs with no independent check.

## Technical changes

- New [`src/lib/utils/precisionCard.js`](../src/lib/utils/precisionCard.js): `computePrecisionCard(profile, options)`, `precisionCardRequirements`, `isUsableMaxDistance`, `precisionPageDistances`, constants (`PRECISION_MIN_DISTANCE` 100, `PRECISION_MAX_DISTANCE` 3000, `WIND_FACTORS`). Has the input guards of the other paths; it is the sixth place where input handling is written out (CLAUDE.md, [architecture](architecture.md#where-shots-are-built)).
- New [`precisionCardPdf.js`](../src/lib/utils/precisionCardPdf.js): `generatePrecisionDopeCard(profile, options, locale)`, loaded on demand. Returns null without fetching when the card cannot be computed; otherwise fetches `/pdf/precision-<en|fr|de>-<metric|imperial>.pdf`, copies the template pages and draws the numbers and data words with Helvetica. Profile text is cut and limited to characters Helvetica can encode.
- New [`precisionCardLayout.js`](../src/lib/utils/precisionCardLayout.js) (page geometry, shared by the script and the fill), [`precisionCardWords.js`](../src/lib/utils/precisionCardWords.js) (the PDF words in en, fr, de; other locales get English), [`precisionCardFormat.js`](../src/lib/utils/precisionCardFormat.js) (columns per unit system, number formats, "–").
- New [`scripts/precision-card-templates.js`](../scripts/precision-card-templates.js) and script `templates:precision` in `package.json`. New templates `static/pdf/precision-{en,fr,de}-{metric,imperial}.pdf` (about 12 kB each). See [Precision card templates](development.md#precision-card-templates).
- New [`PrecisionCardGenerator.svelte`](../src/lib/components/PrecisionCardGenerator.svelte), added to [`dope-cards/+page.svelte`](../src/routes/calculators/dope-cards/+page.svelte). Uses `downloadDopeCard` and the page's `savePDF` like the mid-range card.
- New route [`dope-cards/precision-guide/+page.svelte`](../src/routes/calculators/dope-cards/precision-guide/+page.svelte).
- [`+layout.svelte`](../src/routes/+layout.svelte): header titles for `/calculators/dope-cards` and the guide.
- [`ballisticCalculator.js`](../src/lib/utils/ballisticCalculator.js): `powderSensitivity` exported (no change to its code).
- Messages: 83 new keys (`dope_precision_*`, `dope_guide_*` and others), 618 per language. French renames: `dope_title` "Fiches DOPE" → "Abaques", `dope_midrange_title` → "Abaque portée moyenne", `dope_midrange_desc`, `calc_dope_cards` "Fiches de tir" → "Abaques", `calc_dope_cards_desc`, `about_description`, `privacy_offline_desc`. PDF words: zero is "Zéro" (fr) and "Null" (de); powder sensitivity "Sens. therm." (fr) and "Temp.-Empf." (de).
- Guides updated: [`ballistics-model.md`](ballistics-model.md#precision-dope-card), [`development.md`](development.md#precision-card-templates), [`testing.md`](testing.md), [`translations.md`](translations.md), [`architecture.md`](architecture.md) (routes, scripts, input handling), [`data-and-privacy.md`](data-and-privacy.md) (template fetch), README (script, feature line), CLAUDE.md (six input paths). Checked against the code for this document.
- No store, no stored key. No calculated result of another screen changed.

## Tests

| File | What |
|------|------|
| [`precisionCard.test.js`](../src/test/precisionCard.test.js) (new, 90) | Maximum distance and page distances; requirements; every guard with the engine stubbed; twist or length out of limits never reach the engine; the 700 m sample; spin drift whatever the switch, left-hand twist; powder sensitivity and an unflyable cold column; angle mode; 100 yd zero with MOA clicks and imperial columns; pages stop at the end of the flight, extras at 3000 |
| [`precisionCardPdf.test.js`](../src/test/precisionCardPdf.test.js) (new, 23) | Real templates: cover + pages + worksheet, all A6, each language and unit system; no fetch without data; the 700 m values printed; all text inside the content area; angle mode; "–" without spin drift; name encoding and cut; the committed templates equal the script's output byte for byte |

`npm run test:run` on 2026-11-17: 4533 passed, 1 todo, 47 files. No recorded baseline changed. `npm run build` is reported passing by the developer; not re-run for this document.

## What the owner should test

Nothing was checked in a browser or on paper.

1. `/calculators/dope-cards` in en, fr and de: the Precision dope card section, the checklist and the warning with a profile zeroed at 50 m or with a red-dot reticle (Download disabled, Edit profile link).
2. With the sample profile, maximum 1000, Clicks, metric: download, open the PDF, compare the 700 m page with the table above and the design boards P1, P2 to P9, P10.
3. Switch to MRAD, and to imperial units: the words and columns follow.
4. A 100 yd profile with MOA clicks: pages in yards, imperial units preselected.
5. Print at 100 % scale, 4 per A4: each page is a readable A6.
6. The guide page from "How to read the card", in the three languages.
7. Approve (or correct) the printed values: spin drift, pressure and temperature deltas, wind dial.

## Deployment notes

Nothing manual. The six templates are in `static/pdf/` and ship with every build. The release notes above go out with the release.

## Security review

**PASS.**

- Checked: the input guards of `computePrecisionCard` against the other paths; 279 damaged-profile fuzz cases run in a worker with a hard timeout, none hung (slowest 29 ms); at most about 21 engine runs and 32 pages per card; the only new network request is the app's own template on the same origin; profile text in the PDF.
- Low, offered and not fixed: a click value only needs to be above 0, so a stored value like `1e-300` prints absurd numbers. No hang, no crash.

## Known limitations / follow-ups

- The owner's approval of the printed values is an acceptance criterion of #157 and is open.
- No visual check of the PDFs or the screens, and no print test.
- French and German wording not checked by a native speaker. Translator's notes for the owner: German "Schusstafeln" vs "DOPE-Karten", "Fleck" vs "Null" for the zero, ß vs ss, a mix of "Sie" and "du"; French "Dérive" means both wind drift and spin drift.
- Spin drift is the library's empirical formula; only the reference shot's drift is printed, not its change with pressure or temperature.
- The unconfirmed choices above wait for the owner.

## Changelog

- 2026-11-17: initial delivery
