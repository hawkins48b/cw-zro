# Powder sensitivity in fps per degree

- **Date:** 2026-11-04
- **Branch:** task/81-powder-sensitivity
- **Issue:** [#81](https://github.com/hawkins48b/cw-zro/issues/81)
- **Status:** Delivered with known issues (on the task branch, not merged yet)

## Summary

The profile form asks for powder temperature sensitivity in fps per degree. The code divided the value by 100 and passed it to `js-ballistics` as a percentage modifier. The velocity change therefore depended on muzzle velocity and ignored the temperature unit, so drop values were wrong whenever the option was on.

**Decision.** The owner confirmed the setting means fps per degree, in the profile's temperature unit, also when velocity is entered in m/s.

**Delivered:**

- The entered value now gives exactly that change, at any muzzle velocity, in °F and °C.
- A guard returns no result when the velocity at the current temperature is unusable. Without it, the library could hang.

**Correction to #81.** The figures in the issue are too low. The old code gave +19.6 fps at 2650 fps, +23.7 at 3200 and +7.4 at 1000, not +17.7, +21.5 and +7.0. The conclusion does not change.

### Effect on users

Results for saved profiles with this option on will shift. Measured velocity change, old code against new, for a setting of 1 over 20 °F (11.1 °C):

| Muzzle velocity | 1 fps/°F, old | 1 fps/°F, new | 1 fps/°C, old | 1 fps/°C, new |
|-----------------|---------------|---------------|---------------|---------------|
| 1000 fps | +7.4 | +20 | +7.4 | +11.1 |
| 2650 fps | +19.6 | +20 | +19.6 | +11.1 |
| 2700 fps | +20.0 | +20 | +20.0 | +11.1 |
| 3200 fps | +23.7 | +20 | +23.7 | +11.1 |

°C profiles change the most. °F profiles near 2700 fps barely change, but °F profiles far from that velocity do.

- An effective velocity that was negative used to return meaningless numbers. It now returns no result.
- Any velocity below 50 fps now returns no result, with or without this option.
- A plain velocity of 0 no longer hangs the ballistic calculators listed below. The profile form already rejects 0.

## How to use

In a profile (`/profiles/new` or `/profiles/<id>`), turn on temperature sensitivity, then fill in:

- **Temperature:** the ambient temperature when the velocity was measured. Its unit selector (°F or °C) also sets the unit of the modifier.
- **Temperature Modifier:** the velocity change per degree, shown as fps/°F or fps/°C. It stays in fps when the velocity is entered in m/s. A negative value is accepted, for a load that slows down when warm.

The change runs from this temperature to the air temperature of the calculation.

The setting applies to the ballistic calculator, compare trajectories, trajectory validation and the scope view. **Dope cards and the MPBR calculator ignore it:** they build their ammunition without sensitivity, as before.

## Technical changes

All production changes are in [`src/lib/utils/ballisticCalculator.js`](../src/lib/utils/ballisticCalculator.js). The form, saved profile format and translations did not change.

- **`powderSensitivity(profile, mv)`**, private. It replaces the duplicated blocks in `calculateShotPoint` and `calculateFullTrajectory`.
- **`hasFlyableVelocity(ammo, atmo)`**, private. It is called before `setWeaponZero` in the same two functions, which return `null` unless the effective velocity is finite and at least `defaultEngineConfig.cMinimumVelocity` (50 fps).

### The formula

```
tempModifier = fpsPerDegree x (1.8 for °F, 1 for °C) x 15 / muzzleVelocityInFps
```

`Ammo.getVelocityForTemp` (`node_modules/js-ballistics/dist/munition.js:71-74`, version 2.2.0-beta.2) computes, in m/s and °C:

```
v = (tempModifier / (15 / v0)) * tDelta + v0
```

The library's modifier scales with `v0`, so dividing by the muzzle velocity cancels that out. One °C is 1.8 °F, so a fps/°F value counts 1.8 times per °C.

`tDelta` runs from the profile's `temperature` (`Ammo.powderTemp`) to the air temperature, because the app never sets `powderT` and `Atmo` then uses its own temperature.

### Why the guard exists

Sensitivity can bring the velocity to about 0. The library then never leaves its integration loop, and try/catch cannot stop that, so the check has to run before the solver.

### Tests

**237 passed, 6 todo.** `npm run build` passes. Both were rerun for this document.

[`src/test/ballistics.baseline.test.js`](../src/test/ballistics.baseline.test.js) gains 29 tests in a `powder sensitivity` block, replacing the `it.todo`. They cover:

- the change at 1000, 2650 and 3200 fps in °F and °C
- negative values, and colder air
- velocity entered in m/s
- mixed profile and air temperature units
- a load matching the same load entered 20 fps faster, in both calculator functions
- the guard, on both sides of the 50 fps limit
- the option turned off, or left empty

No pinned value changed. The existing tests only gained an updated comment.

The hang cases stub `setWeaponZero` to throw, because a Vitest timeout cannot stop synchronous code. Without the guard they fail on the stub instead of stalling the run.

## Deployment notes

Nothing to run or configure. Saved profiles keep their stored values, and their results shift as soon as this is deployed (see Effect on users).

## Security review

**PASS on round 2.** Round 1 found a Low regression: sensitivity could bring the velocity to about 0 and hang the library loop. The `hasFlyableVelocity` guard fixes it.

Pre-existing problems, not fixed here:

- Velocity has no upper limit, and extremely high values, far beyond any real load, can hang the calculation.
- The dope card solvers have no guard.
- Other fields can also hang the calculation: optic height, zero distance, BC, wind and atmosphere.

## Known limitations / follow-ups

- **Not tested in a browser.** Everything was checked through the calculator functions. The profile form, and how each screen shows a calculation with no result, were not exercised.
- **Re-zero at current conditions.** `setWeaponZero` runs on the same shot, so the drop change from temperature is smaller than for a rifle zeroed at the reference temperature. This is pre-existing and unchanged. It is the "Per-shot re-zero" limit in the [reference tests doc](2026-11-04-70-ballistics-reference-tests.md).
- **Library upgrade.** The formula depends on the library's `getVelocityForTemp`, so recheck it during the `js-ballistics` upgrade ([#77](https://github.com/hawkins48b/cw-zro/issues/77)). The new tests fail if the velocity change moves.

## Changelog

- 2026-11-04: initial delivery
