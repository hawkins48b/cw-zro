# Dope Cards: one profile selector, A4 PDF badge (#170)

Issue: [#170](https://github.com/hawkins48b/cw-zro/issues/170). Owner request, 2026-11-17.

## What changed

| Before | After |
|--------|-------|
| The Mid-Range Dope Chart card had its own "For <profile> · Change" row (`ProfileInUseChip variant="inline"`) | Removed |
| The Precision Dope Card had its own profile `<select>`, which could print a profile other than the one in use (not saved) | Removed: it uses the profile in use |
| — | One `ProfileInUseChip` in the page header, as on MPBR. "Change" opens the profile picker and puts the chosen profile in use for both cards (and the rest of the app) |
| Mid-Range badge "PDF" | "A4 PDF" / "PDF A4" / "A4-PDF". The templates `static/pdf/rifle-dataset-{imperial,metric}.pdf` are 841 × 595 pt, A4 landscape |

Details:

- `PrecisionCardGenerator.svelte`: the units the user picks are kept with the profile id they were picked for. When another profile is in use, the units follow that profile's zero again (metric for m, imperial for yd), as the old `pickProfile` did.
- Both cards keep their last download message with its profile id, so a message disappears when another profile is put in use. For the mid-range card this was a Low from the review (it was already the case before this change).
- `ProfileInUseChip.svelte`: the `inline` variant had no other user and was removed.
- Messages removed: `dope_midrange_for`, `dope_precision_profile`. Changed: `dope_midrange_badge`.

No calculated result changed. The card generators were not touched.

## Checks

- `npm run test:run`: pass. `npm run build`: pass.
- Security review: PASS. The Low it raised is fixed.
- Not checked in a browser.

## For the owner to test

On `/calculators/dope-cards` (phone, tablet and desktop):
1. There is one profile selector, in the header. Neither card has its own selector.
2. Tap "Change" and pick another profile. Both cards now use it: the precision requirements list updates, and the mid-range download prints the new profile.
3. The Mid-Range Dope Chart badge reads "A4 PDF".
