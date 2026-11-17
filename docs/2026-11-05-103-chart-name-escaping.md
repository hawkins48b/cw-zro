# Escaping profile names in the compare chart

- **Date:** 2026-11-05
- **Branch:** task/103-chart-name-escaping
- **Issue:** [#103](https://github.com/hawkins48b/cw-zro/issues/103)
- **Status:** Delivered with known issues, not in production yet

## Summary

ApexCharts 5.16.0 writes legend text and tooltip labels with `innerHTML`. A profile name containing markup therefore ran as HTML on the compare trajectories chart.

**Delivered:**

- The whole series label is escaped before it reaches the chart. Names with markup now display as plain text.
- The security review found a second path: a stored `yAxis` value reached the tooltip the same way. The stored value is now checked when read.

### Effect on users

| Case | Before | After |
|------|--------|-------|
| Name with markup | Ran as HTML in the legend and tooltip | Displays as plain text |
| Name with `&`, accents or quotes | Displayed as typed, except where `&` began an entity | Displays as typed |
| Bad `yAxis` in `localStorage` | Reached the tooltip as HTML | Chart shows `in`. The bad value stays in `localStorage` until the user picks a unit |
| Screen reader, name with `&`, `<` or `>` | Read the name | Reads entities in some labels. See [Known limitations](#known-limitations--follow-ups) |

**No calculated result changes.** No calculation file, baseline or tolerance was touched. A bad `yAxis` already gave values in inches through the default case of `getYUnit`, so only the label changes.

**Other charts.** The ballistic, MPBR and trajectory-validation charts were not changed. They receive no user text: their series names, axis titles and tooltip units all come from message strings, and the data is numbers.

## Technical changes

No messages, routes, saved data format or dependencies changed.

| File | Change |
|------|--------|
| [`src/lib/utils/format.js`](../src/lib/utils/format.js) | New `escapeHtmlText(value)` |
| [`src/lib/utils/yAxisUnit.js`](../src/lib/utils/yAxisUnit.js) | New file: `Y_AXIS_UNITS` and `normalizeYAxisUnit(value)` |
| [`src/lib/stores/compareTrajectories.svelte.js`](../src/lib/stores/compareTrajectories.svelte.js) | The `yAxis` getter uses `normalizeYAxisUnit` |
| [`src/routes/calculators/compare-trajectories/+page.svelte`](../src/routes/calculators/compare-trajectories/+page.svelte) | The series name goes through `escapeHtmlText`. The `?? yAxisKey` fallback on `yLabel` is removed |

### Fix 1: series label

`escapeHtmlText` is applied to the whole label, `<name> @ <zero distance>`, so the zero distance is covered too.

It escapes `&`, `<` and `>` only. Quotes stay unescaped because ApexCharts copies the same string to aria-labels with `setAttribute`, which does not decode entities. Names reach attributes only through `setAttribute` or `Utils.escapeString`.

**This function is not safe inside HTML attribute values.** A comment in the code says so.

Where the name goes in `node_modules/apexcharts/src/`, version 5.16.0:

| Use | Location | How |
|-----|----------|-----|
| Legend text | `modules/legend/Legend.js:309` | `innerHTML` |
| Tooltip label | `modules/tooltip/Labels.js:351` | `innerHTML` |
| Legend item aria-label | `modules/legend/Legend.js:301` | `setAttribute` |
| Chart svg aria-label | `modules/Core.js:150` | `attr` |
| `seriesName` attribute | `modules/legend/Legend.js:397`, `charts/Line.js:336` | `Utils.escapeString` |

### Fix 2: stored y-axis unit

`yLabel` is part of the tooltip value, which ApexCharts writes with `innerHTML` (`modules/tooltip/Labels.js:355`). Through the `?? yAxisKey` fallback, an unknown stored value became that label.

`normalizeYAxisUnit` returns the value if it is in `Y_AXIS_UNITS`, otherwise `in`. The store getter applies it, so the page only sees an allowed unit, and the fallback is gone.

The getter does not write back. A bad value stays in `localStorage` until `setYAxis` replaces it.

### Tests

**554 passed, 1 todo, in 12 files.** `npm run build` and `npm run build:mobile` pass. All three were rerun for this document. The web build still gives 87 JS files.

| File | Tests | Covers |
|------|-------|--------|
| [`src/test/format.test.js`](../src/test/format.test.js) | 6 | Escaping, and the text coming back unchanged through `innerHTML` with no child elements |
| [`src/test/yAxisUnit.test.js`](../src/test/yAxisUnit.test.js) | 7 | Allowed, missing and bad values, in the function and the store getter |

[Testing](testing.md) is updated with both files.

### Browser check

Production web build, Chromium, real hover, five seeded profiles. This check was run during development, is not in the repository and was not rerun for this document.

| Build | Payload | Result |
|-------|---------|--------|
| Escaping removed, as a control | `onerror` payload in a name | Executed |
| Before fix 2 | Stored `yAxis` payload | Executed |
| Final | Both of the above | Neither executed. No `img` elements in the chart |
| Final | Attribute-breaking payloads | Did nothing |

Also on the final build:

- Names with markup, an ampersand, accents and both kinds of quote displayed as plain text in the legend and tooltip.
- The `ft` unit worked.
- The legend toggle worked.

**Not run:** the Electron and mobile WebViews.

## Deployment notes

Nothing to run or configure. Saved data is not migrated.

## Security review

**Round 1: CHANGES REQUIRED.** The stored `yAxis` reached tooltip `innerHTML` (fix 2).

**Round 2: PASS.**

## Known limitations / follow-ups

- **Screen readers.** Names containing `&`, `<` or `>` show entities in aria-labels, for example `Smith &amp; Wesson`. On-screen text is correct.
  - Legend item: corrects itself after a toggle, because `modules/legend/Helpers.js` rebuilds the label from `textContent`.
  - Chart svg: does not correct itself.
  - Keyboard-focused data point: `_buildPointLabel` in `modules/accessibility/KeyboardNavigation.js` uses the same name, so it should show entities too. This comes from reading the code and was not run.
- **The page wiring has no test.** No test fails if the `escapeHtmlText` call is removed from the page. Only the browser check covered that wiring.
- **The unit list is written twice.** `Y_AXIS_UNITS` repeats the list in the page. A comment says so, but no test enforces it.
- **Keep `legend.tooltipHoverFormatter` unset** unless these paths are reviewed again. With it set, ApexCharts writes the formatter's result with `innerHTML` and passes it the URI-encoded name (`modules/tooltip/Tooltip.js`).

Pre-existing, not fixed:

- The app sets no Content-Security-Policy.
- `localStore` does not validate parsed data.
- A lone surrogate in a series name can throw in the legend, at `encodeURIComponent` (`modules/legend/Legend.js:330`). Whether the form can produce one was not established.

## Changelog

- 2026-11-05: initial delivery
