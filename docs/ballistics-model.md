# Ballistics model

This guide describes what the app calculates on `develop`, what it assumes, and how far the results have been checked. The code is in [`ballisticCalculator.js`](../src/lib/utils/ballisticCalculator.js), [`trajectoryValidation.js`](../src/lib/utils/trajectoryValidation.js) and the two dope card files, on top of the `js-ballistics` library.

**Read this first.** The results are estimates from a point-mass model. Their accuracy depends on the velocity, BC and conditions entered. The evidence below is a comparison with two manufacturer tables that were probably computed, not measured. Nothing in this repository shows that the results are accurate or safe for hunting, competition or any other real-world use. Check them against your own rifle and ammunition.

## Engine

The app uses `js-ballistics` 2.2.0-beta.2, a pre-release, with its default Euler engine. The upgrade to 3.1.0 is held ([#77](https://github.com/hawkins48b/cw-zro/issues/77)).

| Setting | Value |
|---------|-------|
| Model | Point mass: position and velocity only, no bullet attitude |
| Integration | Euler, 0.25 ft per step |
| Gravity | 32.17405 ft/s², constant and straight down |
| Flight ends at | 50 fps, 15000 ft of drop, or an altitude of -1410.748 ft |

In `calculateShotPoint` and `calculateFullTrajectory`, a flight that ends before the requested range gives no result, not a partial table. The `.223` test profile, for example, gives no result at 3000 yd: its flight ends at 2732 yd.

## Inputs and units

Everything comes from a profile or from the screen. Values are stored as entered, with their unit, and converted when a calculation runs.

| Input | Units | Used for |
|-------|-------|----------|
| Optic height | in, cm | Line of sight above the bore |
| Zero distance | yd, m | Zero solve |
| BC and type | G1 or G7 | Drag |
| Muzzle velocity | fps, m/s | Start of the flight |
| Bullet weight | gr, g | Energy, and stability for spin drift |
| Bullet diameter | in, mm | Stability for spin drift |
| Bullet length | in, mm | Stability for spin drift, with spin drift on |
| Barrel twist | in, mm per turn | Spin drift, with spin drift on |
| Temperature | °F, °C | Temperature the velocity was measured at, with powder sensitivity on |
| Temperature modifier | fps per degree of the unit above | Powder sensitivity |
| Altitude | ft, m | Custom atmosphere |
| Pressure | inHg, hPa | Custom atmosphere |
| Air temperature | °F, °C | Custom atmosphere |
| Humidity | % | Custom atmosphere |
| Wind speed | mph, m/s | Wind |
| Wind direction | degrees | Wind |

Weight and diameter do not change the drag. The BC alone carries that.

### Which screen uses what

| Screen | Function | Atmosphere | Wind | Powder sensitivity | Spin drift |
|--------|----------|------------|------|--------------------|------------|
| Scope view | `calculateShotPoint` | Standard or custom | Yes | Yes | Yes |
| Ballistic calculator | `calculateFullTrajectory` | Standard or custom | Yes | Yes | Yes |
| Trajectory validation | `calculateTrajectoryValidation` | Standard or custom | No | Yes | Yes |
| Compare trajectories | `calculateFullTrajectory` | Standard only | No | Yes | Yes |
| MPBR | `calculateMPBR` | Standard only | No | No | Vertical only is used |
| Dope cards | `computeTrajectory` in each card file | Standard only | Preset | No | No |

Dope cards go to 500 yd or 500 m. They use a crosswind from the left of 8 and 20 mph (imperial) or 3.5 and 9 m/s (metric).

## Drag

A single BC scales the standard G1 or G7 drag table from the library. Any `bcType` other than `G7` is treated as G1. The drag coefficient is read from the table by Mach number, through a quadratic fit between table points.

- BC does not change with velocity. The library has a multi-BC model, but the app does not use it.
- There are no custom drag curves.
- The published BC is taken as it is. It is not corrected for the bullet or the rifle.

## Atmosphere

**Standard.** With "use ISA" on, the app calls `new Atmo()`: sea level, 15 °C (59 °F), 1013.25 hPa, 0 % humidity.

**Custom.** The four values are passed as entered. A value that is not finite, a pressure of 0 or less, or a humidity outside 0 to 100 gives no result.

**Enter the pressure measured at the shooting site.** Density comes from pressure, temperature and humidity. Altitude does not enter it. Changing only the altitude from 0 to 10000 ft left drop and velocity identical on the hot altitude test atmosphere, while changing the pressure from 24.9 to 29.92 inHg moved drop at 1000 yd by 49 in. A sea-level corrected pressure, as in weather reports, gives the wrong density at altitude. The field does not say this on screen.

**During the flight**, density and speed of sound follow the height of the bullet once it is more than 30 ft from the starting altitude, using a fixed lapse rate. Speed of sound depends on temperature only, not on humidity.

**Humidity** is entered in percent and passed to the library as a fraction from 0 to 1, through `humidityFraction()`. The library divides values above 1 by 100 and keeps the rest, so passing the percentage would read 1 % as 100 % ([#84](https://github.com/hawkins48b/cw-zro/issues/84)). Saved values of 1 or less changed meaning with that fix.

## Powder sensitivity

With the option on, the velocity changes by the entered value in **fps per degree**, in the profile's temperature unit, also when velocity is entered in m/s ([#81](https://github.com/hawkins48b/cw-zro/issues/81)). The change runs from the profile's temperature to the air temperature of the calculation.

- The change does not depend on muzzle velocity, and it is linear.
- Powder temperature is taken to be the air temperature. There is no separate field for it.
- A negative value is accepted, for a load that slows down when warm.
- The formula depends on the library's `getVelocityForTemp`, so recheck it on a library upgrade.

## Wind

One wind applies for the whole flight, with no vertical part. Direction is in degrees, clockwise, from the view of the shooter.

| Direction | Library meaning | Effect, 10 mph, `.308` test profile at 1000 yd |
|-----------|-----------------|-----------------------------------------|
| 0° | Tailwind: blowing towards the target | Drop 5.0 in less than with no wind |
| 90° | From the left | 110.8 in to the right |
| 180° | Headwind: blowing towards the shooter | Drop 5.1 in more than with no wind |
| 270° | From the right | 110.8 in to the left |

On the wind dial, 0° is at the top, towards the target, and the arrowhead sits at the entered angle. So the arrowhead shows where the wind is going, not where it comes from. Entering the clock position the wind comes from gives the opposite of the table above.

## Spin drift

With the option on and a twist entered, the library adds the empirical drift `1.25 × (Sg + 1.2) × t^1.83` inches, where `t` is the time of flight and `Sg` is the Miller stability factor, corrected for velocity, temperature and pressure. The profile form requires bullet length and twist.

- The form accepts positive twist only, so all drift is to the right. Left-hand twist cannot be entered, although the calculation supports it.
- It is added to windage, not modelled as a force.
- Spin drift has no independent check.

## Zero

`setWeaponZero` finds the barrel elevation that puts the bullet on the line of sight at the zero distance, to within 0.000005 ft in at most 60 iterations.

**The zero is solved again for every calculation**, on the same shot, with its own atmosphere, wind and powder. So the app does not model a rifle zeroed in one set of conditions and fired in another. Drop at the zero distance is always about 0, in any conditions (0.002 in measured on two atmospheres), and differences from the zero conditions are understated. This is a known modelling limit, and it is not pinned by a test, so that a test does not make it look correct.

The solver checks height on its first integration step past the distance, about 0.1 yd further out.

The zero is the only saved distance. Near and far zero come from the trajectory. Dope cards read both from one extra calculation to 3000 units, and print a blank when a crossing lies past it or does not exist ([#86](https://github.com/hawkins48b/cw-zro/issues/86)).

## Angles

**Uphill and downhill.** While its angle section is open, the scope view multiplies the distance by the cosine of the entered angle, or by the entered cosine, and then calculates a flat shot at that shorter distance. This is an approximation: the engine's look angle is not used. Time, energy and velocity shown with it are those of the shorter distance. No other screen has an angle.

**Cant.** Rotating the scope view recalculates the shot with a cant angle, for the reticle only. The adjustments shown come from the shot without cant. The zero is solved on the canted shot too. At 600 yd on the `.308` test profile, 5° gives 2.01 in of windage and 0.12 in more drop. Cant has a regression test and no independent check.

## Outputs and signs

| Value | Sign |
|-------|------|
| `targetDrop`, `dropAdjustment` | Negative below the line of sight: dial up. Positive above: dial down |
| `windage`, `windageAdjustment` | Positive to the right: dial left |

Values are rounded for display: 0.1 for MOA, MRAD, in and cm, 0.01 for ft and m. The scope view counts clicks from the rounded value.

Energy is `weight × velocity² / 450400`, in ft-lb.

**Max apex** ([#85](https://github.com/hawkins48b/cw-zro/issues/85)) is the highest point above the line of sight within the requested range. The library never sets its apex flag, so the same shot is fired again on a grid of about one unit, stopping at the far zero or the range. The result does not depend on the table step, and it matches a step 1 calculation within 1 distance unit and 0.05 in or cm. It is empty when the bullet stays below the line of sight. It is the highest point inside the range, so a bullet still rising at the end of the range gives that last point.

`maxDrop` and `subsonicDist` do not have this treatment. They still read rows that depend on the step and can run past the range.

## MPBR

`calculateMPBR` finds the longest range over which the bullet stays inside a target of the given size ([#86](https://github.com/hawkins48b/cw-zro/issues/86)). It uses the standard atmosphere, no wind and no powder sensitivity.

1. It bisects barrel elevation until the apex touches the top of the zone, half the target size.
2. It takes the far crossing of that arc, rounded down to a whole unit, as the zero.
3. It zeroes the shot there and reads every returned value from that shot.

| Property | Value |
|----------|-------|
| Zero | Always the far crossing, so `optimalZero` equals `farZero` |
| Tolerance | `mpbrMax` is at most 1 unit under the best any zero can give, and at most 0.1 over it |
| Largest gap measured | 0.69 yd against a brute force walk |
| Rounding | Distances to 0.1 |

**"Set MPBR for current profile" saves the far crossing as the zero**: 249 yd rather than 21 yd for an 8 in target on the `.308` test profile. The page still shows the near zero. The delivery doc asks the owner to confirm this choice, and no confirmation is recorded.

## Trajectory validation

`calculateTrajectoryValidation` finds the muzzle velocity or BC that explains an observed drop or adjustment at a range. It uses the page's atmosphere and no wind.

- The value is entered as positive. **Below** or **Above** sets its side of the line of sight ([#82](https://github.com/hawkins48b/cw-zro/issues/82)). A notice shows when Below is chosen and the profile puts the bullet above the line of sight.
- The search steps from the profile's value, starting at 100 fps or 0.1 BC, and halves the step when it crosses the goal, down to 1 fps or 0.001 BC.
- The measure is compared at 0.1 precision. Results are rounded to whole fps and 0.001 BC, and the returned point is the shot at the rounded value.
- A goal it cannot reach gives "No solution", never a value ([#83](https://github.com/hawkins48b/cw-zro/issues/83)).

Limits:

- Near the failure edge, one step can span several inches.
- On a flat curve, the search returns the first value that rounds to the goal.
- A BC solve can return a physically implausible value, such as 0.021, and the page does not flag it.
- Running out of time is reported as no solution, even for a solvable goal. A solve near the limit can differ between devices.

## Input guards

The library runs synchronously. **Far outside normal values it can stay in its loop for good, and neither `try/catch` nor a timeout can stop that.** So guards have to run before the engine is called. These are the guards in place.

| Where | Rule | Otherwise |
|-------|------|-----------|
| Profile form | Optic height, zero, diameter, weight, BC, velocity and click values must be positive numbers | Form error |
| Profile form, spin drift on | Twist and length must be positive | Form error |
| Profile form, sensitivity on | Temperature and modifier must be numbers | Form error |
| `calculateShotPoint` | Distance above 0, BC above 0 | No result |
| `calculateFullTrajectory` | Distance above 0 and at most 3000, BC above 0. Step at least 1, 25 when empty | No result |
| Both | Velocity at the current temperature finite and at least 50 fps (`hasFlyableVelocity`) | No result |
| Both, custom atmosphere | All values finite, pressure above 0, humidity 0 to 100 | No result |
| `calculateMPBR` | BC at least 0.01, velocity 50 to under 10000 fps, finite optic height | No result |
| `calculateMPBR` | Barrel elevation up to 0.5 rad, flight up to 20000 units, at most 54 fires and 2 zero solves | No result. A shot reaching the limit is never reported as a capped distance |
| `calculateTrajectoryValidation` | Range at least 100 and beyond the zero, value not 0, velocity and BC above 0 | No result, or an error message for the range |
| `calculateTrajectoryValidation` | Velocity between 0 and 10000 fps, BC between 0.01 and 2 | Shot skipped |
| `calculateTrajectoryValidation` | At most 200 shots and 5 seconds, checked before each shot | No solution |
| Dope card zero search | Zero elevation at most 0.6 rad | Near and far stay blank |

**Remaining gaps.** Security reviews recorded these, and they are not fixed:

- `calculateShotPoint` has no upper limit on distance, and no screen limits zero distance, velocity, optic height, wind or atmosphere values, apart from the rules above.
- Dope cards have no velocity guard.
- Compare trajectories takes its own zero distance, without the profile form's check.
- Saved values are not checked when read, so a tampered or absurd value in storage reaches the engine.
- The time budget of the validation search is checked between shots. It cannot stop one slow shot.
- An MPBR calculation has no time limit, because it runs only from a button. It can take seconds on absurd input.

A hang freezes that tab or window. It does not affect other users, because everything runs on the device.

## What is not modelled

- Coriolis and Eötvös effects, and the curvature of the Earth
- Aerodynamic jump, yaw and bullet attitude
- Wind that changes along the flight, and vertical wind
- BC that changes with velocity, and bullet-specific drag curves
- A zero made in different conditions from the shot (see [Zero](#zero))
- A true inclined shot (see [Angles](#angles))
- Powder temperature that differs from air temperature
- Humidity in the speed of sound
- Shot-to-shot variation: velocity spread, dispersion, scope tracking error

## Accuracy

### Independent evidence

[`ballistics.published.test.js`](../src/test/ballistics.published.test.js) compares the app with published manufacturer tables. These gaps were measured from the same calculations on 2026-11-05.

**Federal Gold Medal Match GM308M**, .308 Win, 168 gr, G1 0.462, 2650 fps, 200 yd zero, 10 mph crosswind, to 500 yd:

| Series | Largest gap, ICAO atmosphere | Test band | Largest gap, Army Standard Metro | Test band |
|--------|------------------------------|-----------|----------------------------------|-----------|
| Velocity | 12.6 fps | 1 % | 1.5 fps | 2 fps |
| Energy | 16.5 ft-lb | 2 % | 2.1 ft-lb | 0.5 % |
| Trajectory | 0.44 in | 0.1 in + 1 % | 0.07 in | 0.1 in |
| Wind drift | 0.57 in | 0.1 in + 3 % | 0.16 in | 0.2 in |

**Lapua .223 Rem 55 gr FMJ**, 955 m/s, G1 0.255, velocity only, to 600 m: within 0.4 m/s at 100, 200, 300 and 600 m. The test band is 1 m/s. Confidence in this source is lower, because the figures came through a partly garbled text extraction.

### What that evidence does not show

- **The tables look computed from the listed BC, not measured.** Agreement most likely shows that two solvers agree on the same inputs, not that either matches a real bullet.
- **The Federal atmosphere is a hypothesis.** The page does not state it. Army Standard Metro fits better, but it is not confirmed. The page also states a 100 yd zero, while the numbers fit 200 yd.
- **It stops at 500 yd and 600 m.** Nothing past that has an independent check, and no trajectory check goes past 500 yd.
- **There is no live-fire data** in the repository.
- `js-ballistics` is a port of py-ballisticcalc by the same author, so that library is not an independent source.

### No independent check at all

For these, tests only show that results did not change:

- G7, which has an open `it.todo`. The Federal page's G7 value disagrees with its own table by 43 fps at 500 yd under ICAO, so that table cannot check it
- Transonic and subsonic flight below the last Lapua point, 362 m/s
- MPBR
- Trajectory validation
- Spin drift
- Custom atmospheres

### Known errors

**Air density is low.** The 2.2 density formula gives pressure in hPa to terms that expect Pa, so density comes out 0.02 to 0.11 % low ([#77](https://github.com/hawkins48b/cw-zro/issues/77)). Less drag follows, so the app shows slightly less drop and slightly more velocity. This is fixed in 3.1.0, which is held.

| Effect on drop at 1000 yd | Size | Source |
|---------------------------|------|--------|
| Density corrected alone, standard atmosphere | 0.08 to 0.29 in | Measured for this guide on the `.223`, `.308` and `6.5` test profiles, 100 yd zero |
| Density corrected alone, cold thin air | Up to 0.32 in | Same |
| Whole move to 3.1.0, standard atmosphere | 0.09 to 0.31 in | #77 |
| Whole move to 3.1.0, worst tested case | 0.77 in and 1.18 fps, `.223` in cold air | #77 |

The move to 3.1.0 also changes the drag interpolation and the zero solver, so its figures include more than density. Scope clicks moved by at most 1 click, in about 4 % of all tested cases.

**Integration.** The Euler engine is not exact. At 1000 yd on the `.308` test profile with a 10 mph crosswind, it differs from the library's RK4 engine by 0.32 in of drop, 0.26 fps and 0.08 in of wind drift.

### Effect of the inputs

These measured figures are the size of the entry errors to expect, at 1000 yd on the `.308` test profile:

| Change | Moves drop by |
|--------|---------------|
| +0.1 % BC | 0.35 in |
| +1 fps muzzle velocity | 0.37 in |

So a small error in velocity or BC is about as large as the known errors above.

## Changing results

The owner must approve any change in calculated results. A failing baseline is a finding to explain, and baselines are never overwritten to pass. See [Testing](testing.md#when-a-baseline-fails).
