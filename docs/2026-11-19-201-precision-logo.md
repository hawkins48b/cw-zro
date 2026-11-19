# 2026-11-19: Precision card: Chocolate Warfare logo on the cover

Issue: [#201](https://github.com/hawkins48b/cw-zro/issues/201). Branch `task/201-precision-logo`. Owner request: put the Chocolate Warfare logo of the mid-range dope card on the generated precision dope card.

## What changed

| Item | Before | After |
|------|--------|-------|
| Cover header | Title, name and ammo only | Same, plus the Chocolate Warfare mark at the right, white on the black band |
| Name and ammo width | 20 px short of the content width | Stop 10 px before the logo (shrunk, then cut with an ellipsis) |

- The mark is the one at the top right of `static/pdf/rifle-dataset-imperial.pdf` (and `-metric.pdf`): two filled polygons, 40 % gray there. Their points were read from that template's content stream and stored, normalised to a 1156 × 1000 box, as `LOGO` in `src/lib/utils/precisionCardLayout.js`. On the cover it is 46 px high (about 12 mm), 12 px from the right edge, centred in the 75 px header (`COVER.header.logo`, `coverLogoLeft()`). White, because the 40 % gray of the mid-range card would be faint on black.
- `painter().path` takes a `scale` option.
- `scripts/precision-card-templates.js` draws the mark on the cover; `static/pdf/precision-{en,fr,de}.pdf` regenerated with `npm run templates:precision`.
- `src/lib/utils/precisionCardPdf.js`: the name and ammo are fitted to `coverLogoLeft() - logoGap - textX`.
- Only the cover has the logo; the range pages and the worksheet are unchanged.

No calculated value changed.

## Checks

- `npm run test:run`: 5090 passed, 1 todo. New tests: a long name and ammo are cut and end before the logo; the logo lies inside the header band.
- `npm run build` passes.
- Security review: PASS.
- Rendered in Node (pdf.js) in French with a long name and ammo: the mark shows on the band, the texts end before it.

## Open

- Not printed or seen in a browser: the owner checks the card on paper.
