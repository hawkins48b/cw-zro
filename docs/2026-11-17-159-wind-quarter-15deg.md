# 2026-11-17: Precision dope card wind dial every 15° (#159)

Issue: [#159](https://github.com/hawkins48b/cw-zro/issues/159). Change to the ⑥ wind dial of the precision dope card ([#157](2026-11-17-157-precision-dope-card.md)), on owner decisions of 2026-11-17 on the issue.

## What changed

The quarter wind dial had three rays: I (30°), II (60°) and III (90°). It now has six, one every 15°: 15°, 30° (I), 45°, 60° (II), 75° and 90° (III). The rays between the hours are the half hours of the wind clock.

| Part | Before | Now |
|------|--------|-----|
| Rays | I, II thin; III the axis | 15°, 30°, 45°, 60°, 75° thin; 90° the III axis |
| Ray labels | I, II, III | I, II, III with a small 30°, 60°, 90° (after I and II, under III); "15°", "45°", "75°" at the end of their rays |
| Factor of a ray | I × 0.5, II × 0.866, III × 1 | `Math.sin` of the angle: 0.259, 0.5, 0.707, 0.866, 0.966, 1 |
| Values | 12 per page, 15 px (12 px in angle mode) | 24 per page, 11 px bold blue on a white halo, in both modes |
| Data | `wind[i]` = `{ speed, I, II, III }` | `wind[i]` = `{ speed, values }`, one value per angle of `WIND_ANGLES` |

### Stagger

On the inner ring the rays are about 13 px apart, too close for a value on each. So on the two inner rings, the values of the 15°, 45° and 75° rays sit outside their ring on their ray: 22 px out on the inner ring (2 m/s, 5 mph), 12 px on the second (4 m/s, 10 mph). The values of I, II and III, and every value on the two outer rings, sit on the ring. A staggered value stays below the next ring, so along any ray the n-th number from the centre belongs to the n-th ring. The offsets are `RANGE.dial.stagger` in `precisionCardLayout.js`. `dialValuePoint` places every value, and the fill code and the tests both use it.

The offsets were chosen by measuring Helvetica Bold boxes with the widest values the card can print. Three-digit clicks ("888") on every ring and "88.8" angles on the inner rings ("888.8" on the outer) all fit in metric and imperial. With 14 px on both inner rings, three-digit clicks still overlapped on the inner ring at 30°/45° and 60°/75°.

## Values of the sample at 700 m

The owner's sample (6.5 Creedmoor 140 gr, 0.1 MRAD clicks), metric, clicks:

| Ring | 15° | 30° (I) | 45° | 60° (II) | 75° | 90° (III) |
|------|-----|---------|-----|----------|-----|-----------|
| 2 m/s | 2 | 3 | 4 | 5 | 6 | 6 |
| 4 m/s | 3 | 6 | 9 | 11 | 12 | 12 |
| 6 m/s | 5 | 9 | 13 | 16 | 18 | 18 |
| 8 m/s | 6 | 12 | 17 | 21 | 24 | 24 |

The 30°, 60° and 90° columns are the values pinned by #157.

## Calculated results

No value other than the wind changed. Before the change, 76 cards were saved: the sample and the fixture profiles, each with MOA and MRAD clicks, in clicks and angle mode, metric and imperial, to 3000. They were compared after it. Every field other than the wind is identical, and every 30° and 90° value equals the old I and III.

**60° (II) moved in 14 of 8800 values.** Before #159 the code used 0.866 for II. Now it uses `Math.sin(60°)` = 0.8660254, as the owner decided. That moved 14 II values up by one click or 0.1, all at 1100 or beyond (for example the `.223` 55 gr fixture with 0.1 MRAD clicks, imperial columns, 2300 yd, 20 mph ring: 227 → 228 clicks). None of the sample's values moved. Replacing `windFactor(60)` with 0.866 would bring back the old values exactly. The owner approved the exact sine and these changes on 2026-11-17.

## Files

| File | Change |
|------|--------|
| `src/lib/utils/precisionCard.js` | `WIND_ANGLES` and `windFactor` replace `WIND_FACTORS`; one wind value per ray |
| `src/lib/utils/precisionCardLayout.js` | Six rays, small angle labels, half-ray labels, value size 11, stagger offsets, halo, `dialValuePoint` |
| `src/lib/utils/precisionCardPdf.js` | Fills 24 values per page at `dialValuePoint` |
| `scripts/precision-card-templates.js` | Draws the five thin rays and the new labels |
| `static/pdf/precision-{en,fr,de}-{metric,imperial}.pdf` | Regenerated with `npm run templates:precision` |
| `src/routes/calculators/dope-cards/precision-guide/+page.svelte` | Figure with the thin 15°–75° rays and an I label; clock table for every hour and half hour |
| `messages/en.json`, `fr.json`, `de.json` | 4 changed (`dope_guide_wind_intro`, `dope_guide_wind_side`, `dope_guide_clock_caption`, `dope_guide_clock_read`), 2 new (`dope_guide_wind_rays`, `dope_guide_clock_half`) |
| `src/test/precisionCard.test.js` | The six rays at 700 m; each ray is the 90° value times its sine; existing tests on the new shape |
| `src/test/precisionCardPdf.test.js` | Dial overlap tests; the 700 m values printed in ray order |
| `docs/ballistics-model.md`, `docs/testing.md` | Wind section, sample values, test counts |

## Guide

The guide's clock table now maps every hour and half hour to a ray. A direction reads the ray of its angle off the line of fire, mirrored left-right and front-back:

| Wind from | Read |
|-----------|------|
| XII, VI | No wind correction |
| XII½, V½, VI½, XI½ | 15° |
| I, V, VII, XI | I (30°) |
| I½, IV½, VII½, X½ | 45° |
| II, IV, VIII, X | II (60°) |
| II½, III½, VIII½, IX½ | 75° |
| III, IX | III (90°) |

A note under the table explains ½ (XII½ is half past XII). The worked example (4 m/s from II, 11 clicks) is unchanged.

## Checks

- `npm run test:run`: 4540 passed, 1 todo, in 47 files. `npm run build` passes.
- The overlap test failed with the first stagger (14 px on both inner rings) and passes with 22 / 12 px.
- Pages were rendered to images with pdf.js in Node (not a browser): 700 m English metric in clicks, 700 m French metric in MRAD, and 1500 yd for a `.308` with 1/4 MOA clicks in clicks (English) and in MOA (German). No value overlaps another or a label.

## Open

- Owner approved `Math.sin(60°)` for II on 2026-11-17 (14 values moved by one at 1100 or beyond).
- Translator review of the six messages in French and German.
- Owner check on paper (print at 100 %, 4 per A4), as for #157.
- Before this change, the ring unit ("m/s", "mph") next to the outer ring's speed already sat on that ring's dashed arc. It is unchanged here.
