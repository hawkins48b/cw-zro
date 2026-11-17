# Stopping hangs from an empty optic height

- **Date:** 2026-11-06
- **Branch:** task/113-nan-elevation
- **Issue:** [#113](https://github.com/hawkins48b/cw-zro/issues/113)
- **Status:** Delivered, not in production yet

## Summary

An empty or non-numeric optic height hung `calculateShotPoint` and `calculateFullTrajectory`, so the tab or window froze. The profile form blocks these values, so it took a saved profile changed outside the form.

**Delivered:**

- A finite optic height check in `calculateShotPoint`, `calculateFullTrajectory` and `computeTrajectory` in both dope cards. `calculateMPBR` already had it.
- `hasFiniteElevation(shot)` in `src/lib/utils/zeroDistance.js`, called between `setWeaponZero` and `fire` on all five paths. It reads `shot.barrelElevation`, the value the engine flies, not `weapon.zeroElevation`. The two differ by the cant.

A rejected input gives no result. A dope card stays blank.

No screen or user-visible text changed, so the ui-designer and translator steps were skipped.

### Correction to the issue

The issue says `setWeaponZero` returns a NaN elevation for this input. Measured, it does not. A NaN sight height solves to elevation 0, and `fire` then hangs on the sight height. So an elevation check does not catch this case. The optic height check does.

An infinite cant angle is what actually solved to NaN. The second open point in the [#88 doc](2026-11-05-88-zero-distance-guard.md) has the same mistake: it gives a NaN elevation as the cause, and says a check before each `fire` would cover all such inputs. That doc is history and stays as it is.

| Input | Zero solve | Stopped by |
|-------|------------|------------|
| Optic height empty, text, `null`, `undefined` or `1e999` | Not reached now. A NaN height solves to elevation 0 | Optic height check |
| Infinite cant angle | NaN, no error | `hasFiniteElevation` |

A finite elevation does not make a shot safe. When a NaN only appears during the flight, the solver stops on a finite elevation, usually 0, and `fire` still hangs. Those inputs need their own checks. See [Open points](#open-points).

### Effect on results

Only non-finite values are rejected. The issue raised using the 0.6 rad limit of `isFlyableZeroElevation` everywhere. That was not done, so no owner decision was needed and no result changes. No baseline or tolerance was edited.

## Verification

- `npm run test:run` and `npm run build` passed before the last test edits. The main session reruns them before pushing.
- `src/test/nanElevation.test.js` is new. The bad optic height and NaN solve tests stub the engine, so a missing guard fails a test instead of hanging the run. The infinite cant test runs the real solver and only watches `fire`. Valid shots run the real engine, and optic height 0 gives a result on all paths.
- Removing each of the 10 guards in turn, 5 optic height checks and 5 elevation checks, fails between 1 and 5 tests.
- The two `if (!rows) return null` lines in `calculateMPBR` are not among the 10. Removing either one fails no test, because the function's `catch` also returns null, after logging an error.
- Real functions in child processes, on a .308 load: `""` and `"abc"` give null with no hang, and `"2"` gives a result, on `calculateShotPoint` and `calculateFullTrajectory`.

`npm run test:run` (703 passed, 1 todo), `npm run build`, `npm run build:mobile` and `npm run audit:check` passed on the final code. There was no browser run and no check of the Capacitor and Electron packages. The dope card guards are covered by tests only, with pdf-lib replaced.

## Security review

Verdict: pass, no Critical or High findings in the change. The reviewer compared `develop` and this branch on 400 random valid input sets and 12 dope card outputs, and they were byte-identical.

Three Low findings were fixed:

- The guide and the code comment now say a finite elevation does not make a shot safe.
- Optic height 0 is tested on all paths.
- The unit tests of `hasFiniteElevation` use a real `Shot`.

## Open points

- **An empty or text wind direction with a wind speed above 0 hangs `calculateShotPoint` and `calculateFullTrajectory`.** Not fixed here. Clearing the direction box in `WindInput` sends the empty value, so it needs no changed storage. Confirmed on the functions, with `""` and `"abc"` at 10 mph, each killed after 12 seconds. Not confirmed in a browser. No open issue covers it: [#106](https://github.com/hawkins48b/cw-zro/issues/106) is about the meaning of the direction.
- The other hangs the reviewer saw are in the Remaining gaps of [the ballistics model](ballistics-model.md#input-guards). Limits on temperature, pressure and sight height are [#92](https://github.com/hawkins48b/cw-zro/issues/92).
- Dope cards still have no velocity guard ([#91](https://github.com/hawkins48b/cw-zro/issues/91)).
- The sight height criterion of #91 is met for the hang, but #91 also asks for a message. That is not done: the card stays blank.
