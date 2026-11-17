# 2026-11-17: Precision dope card distance pages overprinted (#158)

Issue: [#158](https://github.com/hawkins48b/cw-zro/issues/158). Bug in [#157](2026-11-17-157-precision-dope-card.md), found by the owner on the first printed card.

## Problem

On the precision dope card PDF, every distance page showed the numbers of every distance on top of each other, so the pages could not be read. The cover and the worksheet were fine.

## Cause

`generatePrecisionDopeCard` (`src/lib/utils/precisionCardPdf.js`) copied the template's range page once per distance in a single `copyPages` call. Within one call pdf-lib copies each object only once, so all the range pages shared one `/Contents` array. Each distance's numbers were appended to that array, so every range page held the drawing of all distances. The white halo of the wind-dial numbers hid the overprint in the dial, which is why the dial looked readable. The cover and the worksheet are copied only once, so they were not affected.

The #157 tests checked where each text was drawn, not what each page ended up holding, so they passed.

## Fix

| File | Change |
|------|--------|
| `src/lib/utils/precisionCardPdf.js` | One `copyPages` call per page, so each page gets its own copy of the template page and its own `/Contents` |
| `src/test/precisionCardPdf.test.js` | New test: in an 8-distance card, each range page has as many content streams as the single range page of a 1-distance card, and the 8 pages have 8 separate `/Contents`. It fails on the old code (25 streams instead of 4) and passes on the fix |
| `docs/testing.md` | Test counts |

No calculated value changed.

## Checks

- `npm run test:run`: 4534 passed, 1 todo, in 47 files. `npm run build` passes.
- The sample card was rendered to images with pdf.js in Node (not a browser), at 700 m in English metric and 200 m in French imperial: each page shows only its own distance, and the 700 m page shows the design's values.
- Security review: PASS. The PDF grows because the template's resources are now copied once per page: about 108 KB for the largest card (32 pages), against 9.8 KB before. That is accepted; a later change could share the resources and copy only the content.

## Open

- Owner check on paper (print at 100 %, 4 per A4), as for #157.
