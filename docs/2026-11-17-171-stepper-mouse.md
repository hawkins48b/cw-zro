# Hide the − / + field buttons with a mouse (#171)

Issue: [#171](https://github.com/hawkins48b/cw-zro/issues/171). Owner request, 2026-11-17.

## What changed

- `src/app.css`: a Tailwind variant `pointer-fine` = `@media (pointer: fine)`. The owner chose the pointer type over a width breakpoint, so a touch tablet in landscape keeps the buttons.
- `StepButton.svelte`: `pointer-fine:hidden`. This covers every `StepperField` (Scope View, Ballistic wind and atmosphere cards) and the Scope View cant row.
- `StepperField.svelte`: without the buttons the box gets 6 px side padding (`pointer-fine:!px-1.5`), so value, suffix and unit chips sit 12 px from the edge, like a plain input.
- The hidden buttons are `display: none`: out of the tab order and the accessibility tree. The text boxes keep their labels; the cant slider keeps its arrow keys and Reset.
- Not added: ArrowUp / ArrowDown stepping in the text boxes (there was none before).
- Spec `src/test/stepperMouse.svelte.test.js` (3 tests): the variant and the classes are in place. jsdom applies no CSS, so it does not prove the buttons hide.

No calculated result changed.

## Checks

- `npm run test:run`: 4826 passed, 1 todo, 62 files. `npm run build`: pass.
- Security review: PASS. Low noted, no change: a touchscreen laptop whose main pointer is a trackpad hides the buttons too.
- Not checked in a browser.

## For the owner to test

1. Desktop with a mouse: Scope View and Ballistic show no − / + (wind, direction, angle, altitude, pressure, temperature, humidity, cant). Values and unit chips do not touch the box edges; corners stay rounded.
2. Phone or tablet (a real device, or DevTools touch emulation; resizing the window is not enough), portrait and landscape: − / + show and hold-to-repeat works.
