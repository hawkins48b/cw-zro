# Blocking unusable zero distances

- **Date:** 2026-11-05
- **Branch:** task/88-zero-distance-guard
- **Issue:** [#88](https://github.com/hawkins48b/cw-zro/issues/88)
- **Status:** Delivered, not in production yet

## Summary

A zero distance of 0 froze the tab or window. `setWeaponZero` in js-ballistics returned a NaN elevation, and the `fire` call after it never ended. The compare trajectories page recalculates on every keystroke, so typing `0` in its zero field was enough.

**Delivered:**

- `isUsableZeroDistance` in `src/lib/utils/zeroDistance.js` is the one rule for a zero distance. It runs before the engine in `calculateShotPoint`, `calculateFullTrajectory` and `computeTrajectory` in both dope cards.
- The compare page shows a message under a zero field that fails the rule, and marks the field `aria-invalid`. That entry leaves the chart. Other entries stay.
- A chart line now takes its colour from its entry. Lines used to be coloured by their position among the lines drawn, so dropping an entry gave the next line the dropped entry's colour, and it read as the wrong rifle.
- New message `compare_zero_invalid` in English, French and German.

`calculateMPBR` searches for its own zero, so it does not read the saved zero and has no change. `calculateTrajectoryValidation` calls `calculateShotPoint`, so it is covered by that guard.

### The rule

A zero is usable when its absolute value is a finite number of at least 0.001, in the unit it was entered in. A negative zero still counts as its absolute value, as before.

The issue asked for 0 only. The engine showed that was not enough, and the owner chose the two extensions marked below.

| Zero | Engine, one .308 load | Before | After |
|------|-----------------------|--------|-------|
| 0, `-0`, up to at least `1e-310` | Hangs | Frozen | No result |
| `1e-308` to about `1e-6` | Absurd elevation, or fails after it | Wrong value or no result | No result (owner decision: floor at 0.001) |
| Empty, text | NaN gives elevation 0, no error | Line from an unzeroed barrel | No result, message on compare (owner decision) |
| `Infinity` | Elevation 0, no error | Line from an unzeroed barrel | No result |
| 0.001 to 0.1 | No result on all 7 reference profiles, after about a second | No result | No result, unchanged |
| 0.2 and above | Solves | Result | Result, unchanged |

### Effect on results

Results change only for the rejected inputs in the table. They were a freeze or a meaningless value. Every baseline passes unchanged, and no baseline or tolerance was edited.

## Verification

- `npm run test:run`: all tests pass. `src/test/zeroDistance.test.js` is new. It stubs `setWeaponZero` to throw, so a failed guard fails the test instead of hanging the run.
- Removing each of the four guards in turn fails between 14 and 17 tests.
- Real engine, no stub, in a separate process under a timeout: 15 zero values, including 0 and `1e-320`, on all 7 reference profiles, with `yd` and `m`. 210 runs and no hang.
- `npm run build` and `npm run build:mobile` pass.
- Headless Chromium on the production build: typed `0`, `0.0`, empty, `-0`, `1e-320` and `0.0005` in the compare field. The page stayed responsive, the message appeared and the other line stayed. Typing `100` restored the line. The message was seen in all three languages. With the middle of three entries rejected, each remaining line had the same colour as its card's dot.

Not checked: the Capacitor and Electron packages, and dope cards in a browser. The dope card guard is covered by tests only, with pdf-lib replaced.

## Security review

Verdict: pass, no Critical or High findings. Two Low findings were fixed: the error element's `id` now uses the row position instead of the stored `entry.id`, and `isUsableZeroDistance` rejects anything but numbers and strings, so it cannot throw on an object from storage. A tampered `entries` value can still crash the compare page, in code this change did not touch.

## Open points

- A zero from 0.001 to about 0.1 usually gives no result with no message, on the compare page and in the profile form. It also blocks the page: one trajectory took 0.7 to 0.9 s here against 13 ms for a normal zero, and the compare page recalculates on each keystroke. This is not new. A higher floor would mostly remove it, but the security review found a slow low-BC load that does solve at 0.0198 yd, so that is an owner decision.
- An empty or non-numeric optic height still hangs `calculateShotPoint` and `calculateFullTrajectory`, with a valid zero. It has the same cause, a NaN elevation, but a different input. The profile form blocks it, so it takes a changed saved profile. Found in the security review and confirmed. A check of the elevation before each `fire` would cover all such inputs, but could change results for absurd inputs.
- On a dope card, an unusable zero downloads the blank template without an error. This is the existing behaviour for any failed trajectory. The profile form rejects a zero of 0, so a saved profile reaches this only if storage was changed by hand.
- The field's placeholder shows the profile's zero, but an empty field does not use it. It gives the message instead.
- A very large zero is not limited here: `1e308` still returns elevation 0. See [#93](https://github.com/hawkins48b/cw-zro/issues/93). Non-numeric forms in the profile form are [#89](https://github.com/hawkins48b/cw-zro/issues/89).
