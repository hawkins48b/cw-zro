# Wider temperature box in the Estimate atmosphere

Issue: [#156](https://github.com/hawkins48b/cw-zro/issues/156). Owner request, 2026-11-17.

## Problem

In the Estimate mode of the Atmosphere card (Scope View and the Ballistic calculator), the temperature box with − and + had a fixed width of 144 px (`w-36`). The two 44 px buttons and the unit left about 40 px for the number, so a value such as `−12.5` was cut. On the desktop Ballistic page the card column is 300-340 px, so the box sat alone on its row with empty space next to it.

## Change

[`ScopeAtmosphereCard.svelte`](../src/lib/components/ScopeAtmosphereCard.svelte), Estimate temperature box: `w-36` → `w-full @md:w-48`.

- Card narrower than 448 px (phone, desktop Ballistic column): the box spans the card width, and the quick picks stay on the row below, as before.
- Card 448 px wide or more (Scope View on tablet and desktop): the box is 192 px, about 80 px for the number, with the quick picks beside it.

No calculation, message or stored value changed. The Accurate mode and the other pages' temperature fields are not changed.

## Checks

- `npm run test:run` and `npm run build` pass.
- Security review: see the issue comment.
- Not checked in a browser. To test: /scope-view and /calculators/ballistic, Atmosphere → Estimate, type `−12.5`, in °C and °F, on a desktop window and a phone-width window. The whole value is visible, and the quick picks fit beside the box (wide card) or under it (narrow card).
