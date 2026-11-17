# Calculators redesign: profile in use, MPBR, Validation, Compare

- **Date:** 2026-11-17
- **Branch:** task/166-redesign-all
- **Issue:** [#166](https://github.com/hawkins48b/cw-zro/issues/166), third area of four (Calculators)
- **Status:** Delivered, not in production yet. Not checked in a browser

This document covers the **Calculators round only**. The Profiles round and the Settings round have their own documents ([Profiles](2026-11-17-166-profiles-redesign.md), [Settings](2026-11-17-166-settings-redesign.md)). Round 4, "remaining layouts", is still to come on the same branch: the Scope View on tablet and desktop, − and + steppers on every Scope View numeric field and on the shared wind and atmosphere cards, the elevation angle deg / cos chips inside the field, and the guided setup on tablet and desktop.

## Summary

The calculator pages (hub, Ballistic, Dope Cards, MPBR, Trajectory Validation, Compare and its Add page) now follow the canvas "ZRO Calculator Redesign". No calculated value changed: the pages call the same calculation functions with the same arguments (checked by the security reviewer), and only how the results are shown is new.

**Delivered.**

- **Profile in use, everywhere.** Each calculator, and the hub from 640 px, shows the profile in use with "Change". Change opens the profile picker in place (full-screen sheet on phones, dialog from 640 px): tap a row, then "Use this profile". Cancel, Escape or the scrim change nothing. With no profile, the dialog links to New profile.
- **Calculators hub** (`/calculators`): cards in a grid from 640 px. On phones the intro names the profile and there is no chip; from 640 px the intro says "Change it here or from any tool" and the chip is in the header.
- **Ballistic** (`/calculators/ballistic`): Export CSV is an icon button on phones. Below 1024 px the condition cards (distances, wind, atmosphere) are one column, two from 672 px of page width and three in a row from 768 px. The chart has its own legend (Bullet, line of sight). The column picker reads "Columns · N of 17". The step box hint says the step is the gap between two table rows.
- **Dope Cards** (`/calculators/dope-cards`): intro text; the mid-range card and the precision card side by side from 768 px. The mid-range card is closed on phones and has an inline "For <profile> Change" row. The precision card keeps its own profile select.
- **MPBR** (`/calculators/mpbr`): the answer card comes first ("With a 20 cm target, aim dead-on from … to …"), then tiles: "Zero at · near zero", highest point, far zero as a check point, min. and max. point blank. A note says to confirm the zero at the far zero, and what to do past the MPBR. The chart has axis titles, the target zone band and four labelled markers (near zero, far zero, highest point, MPBR end). "Use this zero in your profile" shows the zero before → after and a "Set zero to N" button. The page now stays where it is after the save (before, it went to Profiles).
- **Trajectory Validation** (`/calculators/trajectory-validation`): three steps ("What you saw on the range", "What should ZRO correct?", "Weather that day"), each with hints. The answer card shows the profile value before → after, the difference and the percent. The chart shows the profile now (grey, dashed), the validated path and your observation as a marker. "Apply … to profile" shows before → after and stays on the page; the applied state stays until an input or the profile in use changes.
- **Compare** (`/calculators/compare-trajectories`): four line colours per theme (a fifth line reuses the first), the profile name written at the end of each line, an own legend "name · zero N m", a "Height in" unit choice and a note that changing a zero does not change the saved profile. Adding a profile uses the picker pattern: select, then confirm. Rows already on the chart carry an "On chart" badge. On desktop the Add picker is an inline panel, open on arrival only when the chart is empty; on phones and tablets it is its own page (`/add`), titled "Add a profile".

**Bug fixed on the way.** On MPBR the profile can now change on the page. A result calculated for one profile could then be saved as the zero of another. The result now clears when the profile in use changes.

## Choices not confirmed by the owner

| Topic | Choice |
|-------|--------|
| Hub on phone | No profile chip; the intro names the profile |
| Dope Cards | Side by side from 768 px (`md`); mid-range card closed on phones |
| MPBR and Validation | Two columns from 768 px |
| Charts | ApexCharts kept, styled: primary for the bullet, tertiary for the target zone, warning colour for the markers, grey dashed "Profile now" |
| Compare colours | Light `#4f46e5` `#c2410c` `#0e7490` `#be185d`, dark `#a5b4fc` `#fb923c` `#22d3ee` `#f472b6`; the 5th line reuses the first |
| Compare Add | Preselects the newest profile not on the chart; the desktop panel is open only when the chart is empty |
| Compare unit | "Height in" chips |
| Picker | The summary card shows the 8 key numbers |
| Numbers | Decimals as the calculation returns them, in the locale's format |
| Already saved | "This profile already zeroes at …" / "The profile already has this value." with no button |
| Validation wording | "the calculated path goes through your observation at that range" instead of "exactly" |
| Validation weather | Field order Altitude, Temperature, Pressure, Humidity |

## Release notes

- The calculators show the profile in use with Change; changing it opens a picker on the same page.
- MPBR shows the answer first, with the near zero to zero at and the far zero to check at, and a clearer chart. Setting the zero in the profile shows before and after and keeps you on the page.
- Trajectory Validation is in three steps and shows the change before and after; Apply keeps you on the page.
- Compare writes each profile's name at the end of its line, and adding a profile is a list with a confirm button.
- Ballistic and Dope Cards use the width of tablets better.

## How to use

No account or role. All pages are also under `/fr/...` and `/de/...`.

- **Change the profile from a calculator**: tap the profile chip (or Change), tap a profile in the list, check its summary, tap "Use this profile".
- **MPBR zero**: enter the target size, Calculate, then in "Use this zero in your profile" tap "Set zero to N m". A status line replaces the button: "Saved. The profile now zeroes at N m."
- **Validation**: fill step 1 (range, angle or distance, value, below or above), pick Velocity or BC in step 2, leave ISA on or enter the weather in step 3, Calculate. Then "Apply … to profile".
- **Compare**: "Add a profile" (phone, tablet: its own page; desktop: a panel), select a row, then "Add <name> to the chart" (or "Add <name> again" for one already there).

## Technical changes

### New files

| Path | Role |
|------|------|
| [`ProfileInUseChip.svelte`](../src/lib/components/ProfileInUseChip.svelte) | The profile in use with Change. Props `label`, `variant` (`card`: bordered, 48 px, label above the name; `compact`: one line, 44 px, page headers; `inline`: tinted row in a card, Change as a text button), `class`. Opens `ResponsiveDialog` with `ProfilePicker` and `ProfileSummaryCard`; "Use this profile" calls `activeProfile.setActive` |
| [`calc/ApplyChangeCard.svelte`](../src/lib/components/calc/ApplyChangeCard.svelte) | Before → after card with a save button, then a status line (`doneText`) or an "already" line (`unchangedText`). Computes and saves nothing; the page passes `onapply` |
| [`compare/CompareAddPicker.svelte`](../src/lib/components/compare/CompareAddPicker.svelte) | Compare Add: picker with "On chart" badges, summary card, confirm button. Adds with `compareTrajectories.addEntry` starting on the profile's zero, as before. Used by the Add page (`pinned` bottom bar) and the desktop panel |
| [`utils/mpbrView.js`](../src/lib/utils/mpbrView.js) | `mpbrChartMarkers` (near, far, apex, end from the result), `chartLabelAnchor` (labels near the axis ends anchored into the plot), `mpbrZeroChange` (before, after, `same`, `usable`, `patch`) |
| [`utils/validationView.js`](../src/lib/utils/validationView.js) | `validationChange` (before, after, difference rounded to 0.1 fps or m/s or 0.001 BC, percent, `same`), `validationPatch`, `validationObservationPoint` (the observation on the chart, below negative) |

### Changed files

| Path | Change |
|------|--------|
| [`calculators/+page.svelte`](../src/routes/calculators/+page.svelte) | Hub grid from `sm`, compact chip from `sm` |
| [`ballistic/+page.svelte`](../src/routes/calculators/ballistic/+page.svelte) | Header chip (`card` on phones, `compact` from `sm`), condition cards `@2xl` 2 / `@3xl` 3 columns below `lg`, chart legend, column count, Export icon on phones |
| [`dope-cards/+page.svelte`](../src/routes/calculators/dope-cards/+page.svelte) | Intro, two columns from `md`, inline chip on the mid-range card |
| [`mpbr/+page.svelte`](../src/routes/calculators/mpbr/+page.svelte) | Rewritten layout (see Summary). Saves `profiles.update(activeProfile.id, { zeroDist: optimalZero, zeroUnit })`, the patch of #110, without `goto('/profiles')`. Clears the result when `activeProfile.id` changes |
| [`trajectory-validation/+page.svelte`](../src/routes/calculators/trajectory-validation/+page.svelte) | Three steps, answer card, `ApplyChangeCard`. Saves `{ velocity }` or `{ bc }` as text, as before. The applied change is kept until the observation, solve-for, weather or profile in use changes, not when Apply itself changes the profile |
| [`compare-trajectories/+page.svelte`](../src/routes/calculators/compare-trajectories/+page.svelte) | Colour lists per theme, end-of-line labels as ApexCharts point annotations (SVG text), own legend, inline Add panel on desktop |
| [`compare-trajectories/add/+page.svelte`](../src/routes/calculators/compare-trajectories/add/+page.svelte) | Now only `CompareAddPicker` |
| [`AtmosphereCard.svelte`](../src/lib/components/AtmosphereCard.svelte) | Restyled for Validation step 3: optional `title` and `isaHint`, `SwitchRow` for ISA, fields two columns from `sm`, temperature before pressure, `aria-pressed` on the unit chips |
| [`ProfilePicker.svelte`](../src/lib/components/ProfilePicker.svelte) | `badges` prop: an outlined badge per id ("New" wins) |
| [`picker/PickerRow.svelte`](../src/lib/components/picker/PickerRow.svelte) | `badgeTone`: `tonal` (default) or `outline` |
| [`PrecisionCardGenerator.svelte`](../src/lib/components/PrecisionCardGenerator.svelte) | Card border, to match the mid-range card |
| [`routes/+layout.svelte`](../src/routes/+layout.svelte) | Header titles for MPBR and Trajectory Validation |

### Messages

97 keys added, 5 removed (`mpbr_optimal_zero`, `mpbr_save_zero`, `traj_val_solve_for`, `traj_val_initial`, `traj_val_applied`), 25 English values changed (mostly sentence case; `compare_pick_profile` is now "Add a profile", `mpbr_chart` "Bullet path", `traj_val_chart_title` "Profile vs validated"). Now **884 keys** per language.

The translator made 8 French and 12 German fixes and used one MPBR term table:

| English | French | German |
|---------|--------|--------|
| near zero | zéro proche | Nah-Null |
| far zero | zéro lointain | Fern-Null |
| highest point | point culminant | Höchster Punkt |
| check point | point de contrôle | Kontrollpunkt |

German also uses "Anhalten" for hold and "Nullschussweite" for point blank range.

Left as they were (pre-existing): French terms for the zero distance, German "Einschiessentfernung" (ss), "Schusstafeln" vs "DOPE-Karten", "Trajektorien" vs "Flugbahnen". No native speaker review.

### Guides updated

[`architecture.md`](architecture.md), [`testing.md`](testing.md), [`translations.md`](translations.md), [`ballistics-model.md`](ballistics-model.md) (the MPBR button name).

## Tests

| File | Tests | What |
|------|-------|------|
| [`mpbrView.test.js`](../src/test/mpbrView.test.js) (new) | 14 | Markers on the line of sight, apex and zone bottom; missing or non-finite values left out; label anchors; the zero change and the #110 patch; "already zeroes"; comma and sign in the profile zero; unusable zero (#93) |
| [`validationView.test.js`](../src/test/validationView.test.js) (new) | 12 | Before, after, difference, percent for velocity and BC; no float noise; "same"; no percent on 0; errors; the patch as text; the observation point, sign and 0.1 rounding |
| [`apexcharts.test.js`](../src/test/apexcharts.test.js) | 13 (+1) | Compare end labels: rifle names with markup are drawn as SVG text in the point annotations, no element created |

`npm run test:run` on 2026-11-17: **4776 passed, 1 todo**, in 57 files (was 4749 in 55). No recorded result changed. The pages and components have no component tests.

## What the owner should test

Nothing was checked in a browser. Please check each screen at 390, 768, 900, 1024 and 1280 px, light and dark, in English, French and German:

1. `/calculators`: no chip on phones, chip in the header from 640 px; the card grid.
2. Change on each calculator: the sheet (phone) or dialog, select, "Use this profile"; Cancel and Escape change nothing; the page shows the new profile.
3. `/calculators/ballistic`: Export icon on phones; condition cards 1, 2 then 3 in a row as the page widens below 1024 px; the legend; "Columns · N of 17".
4. `/calculators/dope-cards`: side by side from 768 px; mid-range card closed on phones; its "For … Change" row.
5. `/calculators/mpbr`: answer card, tiles, far zero note, chart markers and axis titles (labels not cut at the ends). "Set zero to N" saves and stays; the "already zeroes" line after it. Change the profile after Calculate: the result clears.
6. `/calculators/trajectory-validation`: the three steps, ISA switch and weather fields; the answer card; the chart's dashed profile line and observation marker; Apply, then change an input: the button comes back.
7. `/calculators/compare-trajectories`: line colours in both themes, names at the line ends, the legend, "Height in". Add on phone (own page, pinned button) and on desktop (panel open only on an empty chart); "On chart" badges and "Add … again".

## Deployment notes

Nothing to do on the server. The release notes above must go out with the release.

## Security review

**PASS**, no findings. The reviewer checked that every calculation call site is unchanged, the profile writes (same patches as before), the new ApexCharts annotation labels with profile names (text, covered by the new `apexcharts.test.js` test), and the picker dialogs.

## Acceptance criteria (#166)

| Criterion | Status |
|-----------|--------|
| Every route matches its canvas board on phone, tablet and desktop, light and dark | Profiles, Settings and Calculators done (not checked in a browser); Scope View tablet/desktop and guided setup tablet/desktop in round 4 |
| Ballistic and Scope View render the same Wind and Atmosphere components | Already shared since #151; steppers in round 4 |
| − and + buttons on every numeric Scope View field | Round 4 |
| Profile selection uses the picker pattern on Profiles, in calculators and in Compare "Add profile" | Done, except the precision dope card, which keeps its own select |
| Export all, Export this profile and Import work | Done (round 1) |
| Deleting the profile in use activates another; the last cannot be deleted | Done (round 1) |
| MPBR near zero | Done |
| About "Provided by Chocolate Warfare" | Done (round 2) |
| Clear all data asks for confirmation and empties local storage | Done (round 2) |
| New strings in EN, FR and DE | Done for this round (884 keys) |
| `npm run test:run` and `npm run build` pass | Tests pass (4776); build to be run before the push |

## Known limitations / follow-ups

- Not checked in a browser, at any width or theme.
- The precision dope card keeps its own profile select, not the chip.
- The phone footnote of the Ballistic page in the canvas was not built.
- The choices above and the translator's term table wait for the owner.
- Pre-existing translation inconsistencies listed above are not fixed.

## Changelog

- 2026-11-17: initial delivery (Calculators round of #166)
