# Compare: one Add profile button that opens the Add page (#193)

Issue: [#193](https://github.com/hawkins48b/cw-zro/issues/193). Owner request, 2026-11-17, after the Compare boards of the design canvas (phone and tablet: one "+ Add profile" button that opens "Add a profile").

## What changed

- `src/routes/calculators/compare-trajectories/+page.svelte`: one `addButton` snippet, a link to `/calculators/compare-trajectories/add` on every device. It shows once per screen size: below `sm` in the "On the chart" row, from `sm` up in the page header.
- Removed: the desktop inline picker panel (`addOpen`, the toggle button with `aria-expanded`) and the extra button in the empty chart card. The empty card keeps its "no entries" text.
- `src/routes/calculators/compare-trajectories/add/+page.svelte`: a back link to Compare from `lg` up, because the app header with Back is hidden on desktop (same pattern as the precision card guide). After adding, the page still goes to Compare.
- `src/lib/components/compare/CompareAddPicker.svelte`: only the Add page uses it now, so the `pinned` and `listClass` props are gone and the confirm button always sits in the pinned bottom bar.
- `docs/architecture.md`: the `CompareAddPicker` row says it is only on the `/add` page.
- Spec `src/test/compareAddButton.test.js` (4 tests, reads the source): one link, rendered once per size, no inline picker, back link on the Add page.

No message was added or changed. No calculated result changed.

## Differences from the boards

The desktop board still draws the inline "Add a profile" panel. The owner asked for the page on every device, so desktop now opens the page too.

## Checks

- `npm run test:run`: 5032 passed, 1 todo. `npm run build`: pass.
- Security review: PASS.
- Not checked in a browser.

## For the owner to test

1. Phone width, `/calculators/compare-trajectories`: one "+ Add profile" button, in the "On the chart" row. It opens "Add a profile"; pick a profile and confirm: back on Compare with the new line.
2. Tablet and desktop widths: one "+ Add profile" button in the header, no other one on the page, also with an empty chart. It opens the same page.
3. Desktop, Add page: "← Compare Trajectories" above the title goes back; the confirm button sits at the bottom of the page.
