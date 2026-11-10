# Damaged stored values, MPBR chart labels and compare chart aria-labels

- **Date:** 2026-11-10
- **Branch:** task/120-stored-values-charts
- **Issues:** [#100](https://github.com/hawkins48b/cw-zro/issues/100), [#111](https://github.com/hawkins48b/cw-zro/issues/111), [#120](https://github.com/hawkins48b/cw-zro/issues/120)
- **Status:** Not in production yet

## Summary

Three issues in one branch, at the owner's request. No calculated result changes for a stored value that was valid: the baselines pass unchanged.

| Issue | Change |
|-------|--------|
| #120 | Every stored field of the Scope View, Ballistic, compare and profiles stores is checked when it is read. A damaged value no longer crashes a page, and the page recovers when the user enters a value, without clearing storage |
| #100 | The MPBR chart labels no longer cover the y-axis ticks or run past the plot edge |
| #111 | Screen readers get compare chart series names as typed, without entities such as `&amp;`, in the chart and legend aria-labels |

## Stored values (#120)

Each row of the issue table was first confirmed on a clean `origin/develop` build in Chromium, then fixed. The issue's rule applies: where a damaged value gave no result, it must not start giving a result for a value the user did not enter, and what the page shows must match the result.

New files:

- [`storedState.js`](../src/lib/utils/storedState.js): `storedObject`, `storedRange`, `storedAtmosphere`, `storedElevation`, `storedRotation`, `storedBallisticOptions`.
- [`storedProfiles.js`](../src/lib/utils/storedProfiles.js): `normalizeProfiles` (the usable list) and `shownProfile` (a copy that pages can show).

What a damaged value now gives:

| Stored value | Page shows | Result |
|--------------|------------|--------|
| Whole store not an object (`zro-scope-view`, `zro-ballistic`, `zro-compare-traj`) | Each section as below | As below |
| Range section, distance not a number or text | Empty range box, range message | No result |
| Range unit unknown | `yd` (`m` stays `m`) | As the calculators read it |
| Ballistic `step` damaged | Empty step box, read as 25, its placeholder | Only the table rows depend on it |
| Atmosphere section damaged | Custom atmosphere with empty boxes, each box's message | No result. Not the standard atmosphere |
| One atmosphere value damaged | That box empty, with its message | No result |
| Scope View angle damaged | Empty angle box | Flat shot, as before |
| Scope View angle unit missing or unknown | Cosine chip | Read as a cosine, as `scopeEffectiveRange` already did, so the result is unchanged |
| Scope View rotation not a finite number, or outside -90 to 90 | Slider and reticle at 0 | No cant |
| Ballistic display options damaged (`visibleColumns` a number, a flag not a boolean) | Default for that option | No result depends on them |
| `zro-profiles` not a list | No profiles | No result until a profile is saved |
| `zro-profiles` entry that is `null`, not an object, or without a number or text `id` | Left out | Left out |
| Profile name, ammo or optic not a number or text | Empty text | Calculators get the stored profile (see below) |
| Profile number field damaged | Empty box | Calculators get the stored profile |
| Profile click value damaged | 0.5 | Scope View counts clicks with 0.5, as it did when it could not read one |

### Decisions

These defaults were chosen by the developer and reported to the owner:

- **A damaged atmosphere is a custom one with empty boxes, not ISA.** ISA would give a result for air the user did not choose. Choosing the standard atmosphere restores it.
- **A damaged Ballistic step reads as 25.** The step only picks the table rows.
- **A damaged rotation is no cant.** Before, `true` or `[1]` gave the same aim point as 1°, and the label read `true°`.
- **A damaged angle is a flat shot.** It was already, through `NaN`.
- **A damaged click value is 0.5.**
- **Arrays are not read as numbers.** Before, a stored range of `["500"]` gave a 500 yd result. This matches the #116 wind decision.
- **An angle without a unit is a cosine.** This was changed after the security review. `{angle: '30', unit: null}` stays no result; `{angle: '0.9'}` stays 450 yd at a 500 yd range. A unitless cosine above 1 now gives no result with the #121 message, where it used to double the range.

### Profiles are read twice

Profiles follow the wind pattern of [#118](2026-11-06-101-97-small-fixes.md):

- `profiles.list`, `profiles.get` and `activeProfile.profile` give the profiles as stored, after `normalizeProfiles`. The calculators check every value they read ([#89](2026-11-10-89-input-limits.md)), so a damaged value still gives no result.
- Pages show a profile through `shownProfile`: names as text, a damaged number as an empty box, a damaged click value as 0.5, units as the calculators read them. A shown profile must never reach a calculator: an empty barrel twist, for one, would give a result where the damaged stored twist gives none. The security review confirmed it does not.
- The edit page fills the form with the shown profile. The form saves only after `validateProfile`, so a damaged field must be fixed before saving.
- Duplicating a profile uses the shown name, so a stored name that is not text cannot throw.

The profiles store now calls `addProfile`, `updateProfile` and `removeProfile` of [`profileOps.js`](../src/lib/utils/profileOps.js) on the usable list. A save therefore replaces a damaged list with a usable one. The one-time click value migration at import runs on the usable list, so a `null` entry no longer crashes every route.

### Wider than the issue table

- Profile fields that are objects also crashed `/profiles`, the compare add page and the profile edit page, not only the compare page. All three now use `shownProfile`.
- A `null` entry in `zro-profiles` crashed every route through the import-time migration.

### Recovery

Entering a range, choosing ISA or entering an altitude gives a result again without clearing storage, also after a reload. Each setter writes from the checked value (`{ ...state(), range: { ...this.range, ...patch } }`), so the damaged field is replaced.

## MPBR chart labels (#100)

Cause: the "Point Blank Range" x-axis annotation label was upright (the default) and centred on the band's left edge, at x = 0. It covered the -5, -10 and -15 y ticks. "Near Zero" did the same near the muzzle.

Changes in `buildChartOptions` of [`mpbr/+page.svelte`](../src/routes/calculators/mpbr/+page.svelte):

| Label | Before | Now |
|-------|--------|-----|
| Point Blank Range | Upright, centred on the band's left edge | Horizontal, at the bottom of the plot, 6 px inside the band's left edge, 8 px above the x-axis |
| Near Zero, Far Zero, Max. Ordinate | Centred on the marker | `pointLabelAnchor(x)`: in the first 15% of the x-axis the label starts at the marker, in the last 15% it ends there, else centred |

Checked on a production build in Chromium: en 8 in, fr 20 in and en 40 cm targets, at 375 and 1280 px, light and dark. Before: 3 to 5 overlaps of a label and a tick per screenshot. After: none, and no page errors.

## Compare chart aria-labels (#111)

Since [#103](2026-11-05-103-chart-name-escaping.md) series names are escaped before they reach ApexCharts, which copied them unchanged into aria-labels. Escaping stays. Changes in [`compare-trajectories/+page.svelte`](../src/routes/calculators/compare-trajectories/+page.svelte) and [`compareEntries.js`](../src/lib/utils/compareEntries.js):

| Label | Fix | Result |
|-------|-----|--------|
| Chart svg | `chart.accessibility.description` from the new message `compare_chart_description`, "Trajectory comparison: {names}", with the plain names | No entities, also after a resize |
| Legend items | A `MutationObserver` on the chart element. For each element with an aria-label, `chartLabelSeries(element)` finds its series (legend `rel` minus 1, or the series group's `data:realIndex`), and `chartLabelText(label, series)` replaces that series' escaped name at the start of the label with the plain text | No entities |
| Keyboard-focused data point | Recorded as a limit. ApexCharts only labels points that have markers, and this chart has none, so the label is never set. The observer would cover it if markers were added | Not applicable |

`chartLabelText` only matches the element's own series, and running it twice changes nothing. After the security review, names `&amp;lt;` and `&lt;` no longer swap labels. `compareSeriesText` gives the plain series text; `compareSeriesName` still escapes it for ApexCharts.

Visible names stay escaped, and markup shows as text. Tested in Chromium with the name `Smith & Wesson <b>x</b>`; a name with `<img onerror>` did not run.

Messages, in `en.json`, `fr.json` and `de.json`: new `compare_chart_description`. Each language now has 378 keys.

## Technical changes

| File | Change |
|------|--------|
| [`storedState.js`](../src/lib/utils/storedState.js) (new) | Readers for range, atmosphere, angle, rotation and Ballistic options. `MAX_ROTATION = 90` |
| [`storedProfiles.js`](../src/lib/utils/storedProfiles.js) (new) | `normalizeProfiles`, `shownProfile` |
| [`scopeView.svelte.js`](../src/lib/stores/scopeView.svelte.js) | Getters read through `storedState.js`; setters write from the checked value; the clock wind migration reads through `storedObject` |
| [`ballistic.svelte.js`](../src/lib/stores/ballistic.svelte.js) | Same. `DEFAULT_OPTIONS` pulled out for `storedBallisticOptions` |
| [`compareTrajectories.svelte.js`](../src/lib/stores/compareTrajectories.svelte.js) | `range` through `storedRange`; whole store through `storedObject` |
| [`profiles.svelte.js`](../src/lib/stores/profiles.svelte.js) | `list` and `get` through `normalizeProfiles`; `add`, `update`, `remove` through `profileOps.js`; migration on the usable list |
| [`profileOps.js`](../src/lib/utils/profileOps.js) | `duplicateProfile` uses the shown name |
| [`compareEntries.js`](../src/lib/utils/compareEntries.js) | New `compareSeriesText`, `chartLabelText`, `chartLabelSeries` |
| Scope View page, [`ScopeReticle.svelte`](../src/lib/components/ScopeReticle.svelte) | Click units, click values and reticle type from `shownProfile` |
| Profiles list, profile edit, ammo selector, compare add | Show `shownProfile` |
| Compare page | Cards show `shownProfile`; svg description; aria-label observer, disconnected when the chart is destroyed |
| MPBR page | `pointLabelAnchor`, Point Blank Range label position |

Guides updated by the developer: [architecture.md](architecture.md) (new "Stored values" section with a table per store, the two readings of wind and profiles) and [testing.md](testing.md) (counts, new files, which stores are now tested). [translations.md](translations.md): key count.

## Checks

- `npm run test:run`: 3065 passed, 1 todo, 28 files (rerun for this document). New: [`storedState.test.js`](../src/test/storedState.test.js) (164), [`storedProfiles.test.js`](../src/test/storedProfiles.test.js) (120), [`storedStores.test.js`](../src/test/storedStores.test.js) (39). [`compareEntries.test.js`](../src/test/compareEntries.test.js) went from 27 to 46. Baselines unchanged.
- `storedStores.test.js` runs the stores with `localStore` replaced by plain values, so the runes in `localStore.svelte.js` are not run.
- `npm run build` passes, as reported by the developer.
- Browser checks in Chromium on the web build, as listed above. The scripts are not kept.
- No unit test for `pointLabelAnchor`: it lives inside the MPBR component.

## Security review

Security review: PASS after two rounds. Round 2 checked both fixes below and found nothing new.

Round 1 was PASS with two findings, both fixed:

- Medium: the first version of `storedElevation` read an angle without a unit as degrees, which changed results. It now reads it as a cosine, as `scopeEffectiveRange` does.
- Low: two series whose names were each other's escaped form could swap aria-labels. Now each element is matched only against its own series.

Pre-existing issues noted by the reviewer, not fixed here:

- `scopeRange` accepts any angle in degrees, so 180° gives a negative distance that is read as positive.
- The Ballistic chart uses `tickAmount = maxX / step` with no lower limit on the step. A step of 0.001 asks for about 3 million ticks. A freeze was not confirmed.
- `activeProfile` and `profiles/[id]` compare ids with `===`, so a profile with a number id cannot be opened.
- The metric dope card reads `opticHeightUnit` `'in'` and `velocityUnit` `'fps'` the reverse way from the calculator. This affects labels only.

## Open points

- The MPBR and trajectory validation stores have the same gap and are not checked yet. Follow-up.
- The Scope View digit picker shows `0001` with an empty stored range. It already did for 0.
- The ApexCharts legend wording stays in English.
- The dope card PDF with damaged profile names was not exercised.
- Only the web build was tested in a browser.
- #100: only the three target profiles above were checked; other profiles and German were not. Pre-existing and not fixed: the Max. Ordinate label is cut off at the top when the apex is at the top of the chart (20 in, 40 cm).
- #111: the keyboard-focused data point label is never set on this chart, as recorded above.

## Changelog

- 2026-11-10: initial delivery
