# Ballistic Calculator: elevation angle card (#173)

Issue: [#173](https://github.com/hawkins48b/cw-zro/issues/173). Owner request and approval, 2026-11-17.

## What changed

- `ElevationAngleCard.svelte` (new): the Scope View angle card (degrees or cosine, − / +), now shared by Scope View and Ballistic. Scope View markup and messages are unchanged.
- `scopeRange.js`: `scopeAngleCosine` (the factor Scope View already used: exactly 1 for no angle, empty, 0° or cos 1; none for an angle `isUsableScopeAngle` rejects), `MIN_TABLE_COSINE = 1e-6`, `isUsableTableAngle`.
- `calculateFullTrajectory(..., { elevation })`: fires the level shot to range × cos with step × cos, and shows each row at its distance ÷ cos. All distances on the page (rows, chart, near/far zero, highest point, subsonic) are along the line of sight. Each row equals what `calculateShotPoint` gives Scope View for that distance and angle (cosine rule). With a factor of exactly 1 the old code path runs.
- New table limit: a cosine below 1e-6 (steeper than about ±89.99994°) gives no table and the message "Too steep for the table…". Below it the engine's minimum flight would add rows past the range (336,334 rows at 1e-12, a frozen page).
- Store: `ballistic.elevation` (default `{ angle: '0', unit: 'deg' }`), `setElevation`; `storedBallisticElevation` reads states saved before this change as 0°, damaged values as an empty box (flat table).
- Layout: phone and desktop order Distances, Wind, Angle, Atmosphere; 672 px: Distances over Angle beside Wind, Atmosphere below; 768 px: three columns, Distances over Angle, Wind, Atmosphere.
- Messages: Scope View keys reused; new `ballistic_angle_note`, `ballistic_angle_too_steep`.

No result changes at angle 0 or an empty box: no baseline failed or was re-recorded.

## Checks

- `npm run test:run`: pass (new `ballisticAngle.test.js`: table rows equal `calculateShotPoint` in five cases, yd/m, degrees/cosines, up/down, wind, custom air; rejections before the engine; stored states). `npm run build`: pass.
- Security review: PASS. Timing probe: every extreme angle under 300 ms, no table longer than range ÷ step + 2. Low left as is: the message says "between -89.9999° and 89.9999°", a safe range; the real limit is a little wider (±89.99994°).
- Not checked in a browser.

## Open points (owner)

1. Velocity, energy, time and subsonic distance follow the level-equivalent distance, as on Scope View: at 1000 yd and 60° they are those at 500 yd, optimistic on steep shots.
2. The Ballistic angle is saved apart from Scope View's; the highlighted Scope View row matches only with the same angle on both pages.
3. The cosine limit 1e-6 needs approval.

## For the owner to test

Ballistic on phone, 672-767 px, 768-1023 px and desktop: card order and layout as above; the angle card looks as on Scope View. 30°: holds get smaller, distances stay, note under the table. Cosine 0.0000001: "Too steep", no table. 95°: Scope View's message. Scope View's angle card unchanged.
