# Wind dial as a shooter's clock (#165)

Issue: [#165](https://github.com/hawkins48b/cw-zro/issues/165). Design: "ZRO Calculator Redesign" canvas, artboard "Wind direction dial", proposal A (chosen by the owner on 2026-11-17). The owner reported on 2026-11-17 that the app's dial did not look like the design: the issue had been filed but not built.

## What changed

`src/lib/components/WindDial.svelte` (used by `ScopeWindCard`, so Scope View and Ballistic) now draws proposal A, with the design's geometry in the 100 × 100 viewBox:

| Part | Before (#155) | Now |
|------|---------------|-----|
| Rim | 24 points at radius 43, the current one filled | Hour numerals 1–11 at radius 39 (9 px, bold), a dot (r 1.1) at each half hour |
| 12 o'clock | Warning-colour triangle and "0°" | Target symbol (ring r 4.6 and dot) in the warning colour |
| Labels | 0° / 90° / 180° / 270° | None |
| Current position | Filled point, only on a 15° step | Blue circle r 7.5 behind the position, at any angle; the numeral (or target) on it turns white only when the angle is exactly on that hour |
| Centre | Scope reticle | The shooter: a dot in the text colour, a dashed line of fire up to the target |
| Arrow | Head where the wind blows, Wind icon at the tail | Starts at the rim position the wind comes from (radius 30) and points inward; 3.5 shaft, filled head with its tip at radius 7, two faint streak lines |
| `aria-valuetext` | "90°" | "3 o'clock, 90°" (new key `scope_view_wind_dial_value`) |

Unchanged: tap and drag (rim from `DIAL_SNAP_RIM` snaps to 15°, inside sets whole degrees), keys (arrows 5°, Page Up / Down 15°, Home 0°), sizes and props. The inner SVG is `aria-hidden`; the slider element carries the label and value.

Messages: `scope_view_wind_dir_from` reworded in EN, FR, DE to the issue's text ("Where the wind comes from, on a shooter's clock: 12 = from the target, 3 = from the right"); `scope_view_wind_dial_value` added ("{hour} o'clock, {degrees}°", "{hour} heures, {degrees}°", "{hour} Uhr, {degrees}°"). French says "1 heures", like the existing `scope_view_wind_clock`.

Colours map the design's palette to the app's: text `surface-950` / `surface-50`, dots and line of fire `surface-400` / `surface-600`, blue `blue-500` / `blue-400`, target `warning-500`.

## Tests

`src/test/windClockDial.svelte.test.js` (components project, jsdom, 10 tests): numerals 1–11 and no degree labels or Wind icon; highlight and arrow turned to the entered angle (also negative, over 360, decimal comma, empty); `aria-valuetext`; head tip short of the centre; white numeral only on a whole hour; the #155 keys. `npm run test:run`: 4808 passed, 1 todo, 59 files. `npm run build` passes. No calculated result changed.

## Not verified

Not checked in a browser. The owner should check, in light and dark, on Scope View (phone, tablet) and Ballistic: the dial matches the artboard, the arrow at 90° comes from 3 o'clock, dragging on the rim snaps to hours and half hours.
