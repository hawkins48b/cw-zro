# Trajectory Validation: step 2 wording, impact picture, Scope View atmosphere (#194)

Issue: [#194](https://github.com/hawkins48b/cw-zro/issues/194). Owner request, 2026-11-17: on `/calculators/trajectory-validation`, (1) reword step 2, (2) explain with a picture through the scope the aim point, the impact according to the ballistic calculator and the observed impact, (3) use the same atmosphere card as the Scope View and the Ballistic page in step 3.

## What changed

### 1. Step 2 wording

`traj_val_step_correct`: "2 · What value should we correct?" (fr "Quelle valeur devons-nous corriger ?", de "Welchen Wert sollen wir korrigieren?").

### 2. Impact picture

- New `src/lib/components/calc/ValidationImpactPicture.svelte`, a card under step 1 titled "What to measure". An inline SVG (240 × 240 view) shows the view through the scope: a target, a reticle with hash marks, the aim point in the centre (red dot), the impact the ballistic calculator expects with the profile (dashed ring) and the observed impact (filled dot), with a dimension line from the aim point to the observed impact. A legend names the marks with their values, and a text explains what to enter: for Distance, how far the real impact is from the aim point, measured on the target; for Angle, the correction that brought the impact onto the aim point.
- Positions come from `validationPicture` in `src/lib/utils/validationView.js`: the larger of the two values reaches `PICTURE_REACH` (84 units), the other is to scale, below the line of sight drawn down and above drawn up. Without a result or an observed value, the picture is an example on the chosen side (calculator at 60 % of the observed impact) and says so.
- The calculator value is `initialMeasure`, now returned by `calculateTrajectoryValidation`: the profile's own shot in the observed unit, rounded to 0.1 and signed, which the search already computed. No calculated value changed.
- The SVG has `role="img"` and an `aria-label` with the values; the colours are Skeleton theme classes, so it follows light and dark.

### 3. Atmosphere card

- Step 3 is now `ScopeAtmosphereCard` (ISA / Estimate / Accurate) with `useCurrentWeather`, wired as on the Ballistic page: `scopeAtmosphereParams`, the "used" line from `usedScopeAtmosphere`, `hasNoAirDensity`. The card has a new optional `title` prop (default "Atmosphere"); the page passes "3 · Weather that day".
- Store `trajectoryValidation.svelte.js`: defaults to `ISA_ATMOSPHERE`, writes with `patchedAtmosphere`. `storedValidationAtmosphere(stored)` now returns the standard atmosphere for a missing or `null` value (as since #127) and otherwise `storedBallisticAtmosphere(stored)`.
- A state saved before #194 gives the same result: the old switch on was the sea-level standard atmosphere, which ISA at altitude 0 gives; off was the boxes as QNH, which reads as Accurate with the pressure converted to station pressure (#172), so the result is the same up to the rounding of the converted box. `src/test/validationAtmosphere.test.js` compares the old and new page paths on 7 saved states (ISA, missing, ISA in metres with BC, hand-edited ISA altitude, imperial and metric custom, hand-edited `pressureRef`) and 3 damaged sections.
- "Use current weather here" is now also on this page (Accurate mode, web and mobile, on a tap only). The request is the existing one of #152; nothing new is sent. `docs/data-and-privacy.md` and the in-app privacy text (`privacy_weather_when`, three languages) name the page.
- `AtmosphereCard.svelte` is removed (no other user), with its now unused messages: `traj_val_isa_hint`, `ballistic_use_isa`, `ballistic_altitude`, `ballistic_atmo_temp`, `ballistic_pressure`, `ballistic_pressure_hint`, `ballistic_humidity`.

Messages: 9 added, 7 removed, 1 changed in en, fr and de (902 per language). No native speaker review.

Guides updated: `docs/architecture.md` (stored values, `ScopeAtmosphereCard`, the new component, current weather), `docs/ballistics-model.md` (atmosphere per screen, Scope View modes, pressure), `docs/data-and-privacy.md`.

## Tests

- `src/test/validationAtmosphere.test.js`: saved states give the same result; `initialMeasure` in MOA and cm.
- `src/test/validationView.test.js`: `validationPicture` (scale, above, decimal comma, example cases).
- `src/test/validationImpactPicture.svelte.test.js`: the component in jsdom (positions, values, texts, example).
- `src/test/currentWeather.svelte.test.js`: Trajectory Validation added to the pages with the weather button (nothing sent on open, fill on a tap, MeteoSwiss credit).
- `storedState.test.js`, `storedStores.test.js`: expectations moved to the new atmosphere shape; a mode-change test.
- `npm run test:run`: 5065 passed, 1 todo. `npm run build`: pass.

## Not done or not checked

- Not checked in a browser or on a device. The picture's look (sizes, colours in dark mode, the narrow left column) needs the owner's eye.
- The picture's wording assumes the scope is set for the profile's zero, as the observed value is measured from the line of sight. Whether that reads clearly is for the owner to judge.

## For the owner to test

1. `/calculators/trajectory-validation` with a profile: step 2 reads "2 · What value should we correct?".
2. Under step 1, "What to measure": enter range 600 yd, angle 14 MOA below. The dashed ring and the filled dot sit below the centre to scale, the legend shows both values. Switch to Above: the marks move above. Switch to Distance: the text changes. Clear the value: "Example picture" appears.
3. Step 3 shows ISA / Estimate / Accurate as on the Scope View. A state saved before shows the same answer as before (ISA, or Accurate with the old values). In Accurate (web or mobile), "Use current weather here" fills the boxes after allowing the location.
4. Check light and dark mode, phone and desktop widths.
