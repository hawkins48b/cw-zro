# Bullet and altitude limits, and clearer no-result messages

- **Date:** 2026-11-10
- **Branch:** task/121-messages-limits
- **Issues:** [#121](https://github.com/hawkins48b/cw-zro/issues/121), [#122](https://github.com/hawkins48b/cw-zro/issues/122), [#123](https://github.com/hawkins48b/cw-zro/issues/123), [#125](https://github.com/hawkins48b/cw-zro/issues/125)
- **Status:** Not in production yet

## Summary

Four follow-ups from the review of [#89 to #119](2026-11-10-89-input-limits.md), done together because they touch the same limits and messages. Pages that gave no result without saying why now say why. Bullet weight, diameter, twist, length and altitude now have limits, chosen by the owner on 2026-11-10.

| Issue | Change |
|-------|--------|
| #121 | A typed cosine in the scope view must be finite, above 0 and at most 1. Otherwise the angle box shows `scope_view_cos_invalid` and there is no result |
| #122 | The Ballistic page shows `validation_range_above_zero` under the range box when the range is not above 0 and at most 3000, and then gives no result |
| #123 | The dope cards page tells a failed PDF build or save (`dope_save_failed`) apart from a profile with no data (`dope_no_result`) |
| #125 | Limits for bullet weight, diameter, twist, length and altitude, in the form and on all five paths. When the engine's minimum flight altitude ends a shot with a custom atmosphere, the page says the altitude is too low for this shot |

## Limits (#125)

Both ends included, in the unit entered. Source: [`inputLimits.js`](../src/lib/utils/inputLimits.js).

| Value | Limit | Checked | Before |
|-------|-------|---------|--------|
| Bullet weight | 1 to 2000 gr, or 0.065 to 130 g | Form, all five paths | Form: above 0. Calculators: none |
| Bullet diameter | 0.1 to 1 in, or 2.54 to 25.4 mm | Form, all five paths | Form: above 0. Calculators: none |
| Bullet length | 0.1 to 4 in, or 2.54 to 101.6 mm | Form with spin drift on. Shot point, full trajectory and MPBR with spin drift on and a value set | Form: above 0. Calculators: none |
| Barrel twist | 1 to 100 in, or 25.4 to 2540 mm | Same as length. The calculators take either sign, the form positive only | Form: above 0. Calculators: none |
| Altitude, custom atmosphere | -1000 to 10000 m, or -3281 to 32808 ft | Shot point and full trajectory (`isUsableAtmosphere`), message in the atmosphere box | Finite |

The gram and foot ends are the owner's rounded values, not exact conversions: 130 g is 2006 gr, -3281 ft is -1000.05 m.

The dope cards never use spin drift, so they check weight and diameter only. An empty twist or length is not checked: as before, the calculators then pass no twist and a 2 in length. A stored `Infinity` or hex value in any of these fields now gives no result (`0x10` reads as 0, below every lower limit).

## Decisions

**Left-hand twist.** The owner kept a negative twist valid in the calculators, from -1 to -100 in, because the calculation supports a left-hand barrel and a baseline covers it. The profile form still accepts a positive twist only.

**Altitude too low for the shot.** The engine ends every flight whose bullet goes below an altitude of -1410.748 ft (-430 m): the site altitude plus the bullet's height over the muzzle. So a low altitude inside the -1000 m limit can give no result. On the `.308` test profile there is no result below about -1402 ft at 600 yd, or -365 ft at 3000 yd. The owner kept the -1000 m limit and asked for a message instead.

- The message `ballistic_altitude_too_low` shows under the altitude box on the Ballistic, scope view and trajectory validation pages, when the box itself holds a valid value. It gives the floor in the unit chosen (-430 m or -1410.7 ft). Trajectory validation also shows it in place of its result, and returns `{ error: 'minimum_altitude' }`.
- It is based on the stop reason the engine reports, never on the empty result alone. [`flightStop.js`](../src/lib/utils/flightStop.js) builds a `Calculator` with a subclass of the default Euler engine, passed through the `engine` option. The subclass notes a `TrajectoryRangeError` with reason `MinimumAltitudeReached` and rethrows the same error. This also catches the case in which the zero solve, which catches that error itself, fails after the floor cut one of its flights.
- The integration is the engine's own, so no result changes. **The subclass overrides `_integrate`, an internal method of js-ballistics: recheck it on any upgrade ([#77](https://github.com/hawkins48b/cw-zro/issues/77)).**
- Compare, MPBR and dope cards always use the standard atmosphere, so they get no altitude message. A flight that drops 1410 ft below the muzzle there still shows only the general no-result text.

## Changed behaviour

No baseline changed. These inputs used to give a result, or a different message, and now do not:

| Where | Input | Before | Now |
|-------|-------|--------|-----|
| Scope view, angle in cos | `0` | Flat shot | Message, no result |
| Scope view, angle in cos | Negative, above 1, `Infinity` | Result for the absolute or a longer distance, or an empty result, no message | Message, no result |
| Scope view, angle in cos | Empty | Flat shot | Flat shot, unchanged |
| Ballistic page | Negative range | Result for its absolute value | Message, no result |
| Ballistic page | 0 or above 3000 | No result, general text only | Message under the range box, no result |
| Any page, profile | Weight, diameter, twist or length past its limit | Result | No result. A dope card is not saved |
| Profile form | Same | Accepted if positive | Form error stating the range, in the unit chosen |
| Custom atmosphere | Altitude past its limit | Result | Message, no result |
| Trajectory validation | Custom altitude too low for the profile's own shot | "No solution" | "Altitude too low" |
| Dope cards | PDF template fetch or save throws | "Cannot compute, check profile" | `dope_save_failed` |

## Technical changes

| File | Change |
|------|--------|
| [`inputLimits.js`](../src/lib/utils/inputLimits.js) | `BULLET_WEIGHT_LIMITS`, `BULLET_DIAMETER_LIMITS`, `BULLET_LENGTH_LIMITS`, `BARREL_TWIST_LIMITS`, `ALTITUDE_LIMITS` and their per-unit getters. `hasUsableBullet(profile, { spinDrift })`. `isUsableAtmosphere` checks the altitude limits |
| [`flightStop.js`](../src/lib/utils/flightStop.js) (new) | `createFlightCalculator`, `endedAtMinimumAltitude`, `isMinimumAltitudeStop`, `MINIMUM_FLIGHT_ALTITUDE_FT`, `minimumFlightAltitude` |
| [`ballisticPage.js`](../src/lib/utils/ballisticPage.js) (new) | `isUsableBallisticRange`, and `ballisticPageTrajectory` returning `{ result, altitudeTooLow }` |
| [`altitudeMessage.js`](../src/lib/components/altitudeMessage.js) (new) | `altitudeTooLowMessage(unit)` |
| [`ballisticCalculator.js`](../src/lib/utils/ballisticCalculator.js) | `hasUsableBullet` in `calculateShotPoint`, `calculateFullTrajectory` and `calculateMPBR`. The first two use `createFlightCalculator` and take `options.report`, where they set `minimumAltitude` |
| [`dopeCardImperial.js`](../src/lib/utils/dopeCardImperial.js), [`dopeCardMetric.js`](../src/lib/utils/dopeCardMetric.js) | `hasUsableBullet(profile, { spinDrift: false })` in `computeTrajectory` |
| [`profileValidation.js`](../src/lib/utils/profileValidation.js) | `profileFieldLimits` and the range check for `bulletWeight`, `bulletDiameter`, `barrelTwist`, `bulletLength` |
| [`scopeRange.js`](../src/lib/utils/scopeRange.js) | `isUsableScopeAngle`. `scopeEffectiveRange` returns null when it fails |
| [`trajectoryValidation.js`](../src/lib/utils/trajectoryValidation.js) | `{ error: 'minimum_altitude' }` when the profile's own shot ends at the floor with a custom atmosphere |
| [`dopeCardDownload.js`](../src/lib/utils/dopeCardDownload.js) | `downloadDopeCard` returns `'saved'`, `'no-data'` or `'failed'` instead of a boolean |
| [`AtmosphereCard.svelte`](../src/lib/components/AtmosphereCard.svelte) | Altitude range message. New `altitudeTooLow` prop |
| [`ProfileForm.svelte`](../src/lib/components/ProfileForm.svelte) | Unit labels for mm, gr and g in range messages |
| Ballistic page | Range message and `aria-invalid` on the range box. Uses `ballisticPageTrajectory`. Passes `altitudeTooLow` |
| Scope view page | Cosine message in place of the angle hint, `aria-invalid` on the angle box. Passes `altitudeTooLow` |
| Trajectory validation page | Altitude message in the atmosphere box and in place of the result |
| Dope cards page | `dope_no_result` for `'no-data'`, `dope_save_failed` for `'failed'` |

Messages, in `en.json`, `fr.json` and `de.json`: new `scope_view_cos_invalid`, `ballistic_altitude_too_low` (with `{min}` and `{unit}`), `dope_save_failed`.

Guides updated: [ballistics-model.md](ballistics-model.md) (engine, atmosphere, spin drift, angles, input guards, remaining gaps) and [testing.md](testing.md) (counts, new files).

## Checks

- `npm run test:run`: 2689 passed, 1 todo, 23 files. New: [`bulletLimits.test.js`](../src/test/bulletLimits.test.js) (655), [`minimumAltitude.test.js`](../src/test/minimumAltitude.test.js) (61, on the real engine), [`ballisticPage.test.js`](../src/test/ballisticPage.test.js) (43). [`scopeRange.test.js`](../src/test/scopeRange.test.js) went from 22 to 58, [`profileValidation.test.js`](../src/test/profileValidation.test.js) from 172 to 232.
- Four tests that are not baselines changed their expectations: three `downloadDopeCard` tests in [`inputLimits.test.js`](../src/test/inputLimits.test.js) (the boolean became an outcome), and one in `profileValidation.test.js` that used bullet weight as an example of a field without limits.
- `npm run build` passes.
- **Not checked in a browser.** The new messages and the `aria-invalid` states were not seen on screen.

## Security review

PASS, no findings. The reviewer ran 22 extreme inputs through the real calculators. None hung, all returned in under 400 ms.

## Open points

- In trajectory validation, only the profile's own first shot is checked for the altitude floor. A later shot of the search that ends there counts as a failed shot and can lead to "No solution".
- Compare, MPBR and the dope cards show only their general no-result text when a flight ends at the altitude floor.
- `flightStop.js` depends on the internal `_integrate` of js-ballistics 2.2.0-beta.2 ([#77](https://github.com/hawkins48b/cw-zro/issues/77)).
- Still open from #89: with the comma rule, a German entry such as altitude `1.500` reads as 1.5 with no error. The powder sensitivity temperature and modifier only have to be finite in the form.

## Changelog

- 2026-11-10: initial delivery
