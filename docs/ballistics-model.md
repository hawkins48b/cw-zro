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

These two functions run the same Euler engine through a subclass that only notes when a flight ended at the minimum altitude, then rethrows the engine's error ([`flightStop.js`](../src/lib/utils/flightStop.js), [#125](https://github.com/hawkins48b/cw-zro/issues/125)). The integration is the engine's own, so results are unchanged. The subclass overrides the library's internal `_integrate`, so it must be rechecked on any `js-ballistics` upgrade.

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
| Altitude | ft, m | Custom atmosphere: corrects the pressure, and the end of the flight |
| Pressure | inHg, hPa | Custom atmosphere: sea-level pressure (QNH), as in weather reports |
| Air temperature | °F, °C | Custom atmosphere |
| Humidity | % | Custom atmosphere |
| Wind speed | mph, m/s | Wind |
| Wind direction | degrees, where the wind comes from | Wind |

Weight and diameter do not change the drag. The BC alone carries that.

**Typed numbers.** A comma reads as a decimal point, so `1,5` is 1.5 ([#117](https://github.com/hawkins48b/cw-zro/issues/117)). There is no thousands separator: `1,500` is 1.5, not 1500. The profile form accepts only plain finite decimals (`parseDecimal` in [`decimal.js`](../src/lib/utils/decimal.js)) and saves them with a decimal point. The calculators and the boxes on the calculator pages read values as `parseFloat` does, with the first comma read as a decimal point (`readDecimal`), so a value without a comma gives the same result as before, and `90abc` still reads as 90.

**Limits.** Each input with a limit is listed under [Input guards](#input-guards). They are the same in the profile form and on every calculation path ([`inputLimits.js`](../src/lib/utils/inputLimits.js)).

### Which screen uses what

| Screen | Function | Atmosphere | Wind | Powder sensitivity | Spin drift |
|--------|----------|------------|------|--------------------|------------|
| Scope view | `calculateShotPoint` | Standard or custom | Yes | Yes | Yes |
| Ballistic calculator | `calculateFullTrajectory` | Standard or custom | Yes | Yes | Yes |
| Trajectory validation | `calculateTrajectoryValidation` | Standard or custom | No | Yes | Yes |
| Compare trajectories | `calculateFullTrajectory` | Standard only | No | Yes | Yes |
| MPBR | `calculateMPBR` | Standard only | No | No | Vertical only is used |
| Dope cards | `computeTrajectory` in each card file | Standard only | Preset | No | No |

Dope cards go to 500 yd or 500 m. They use a crosswind from the left of 8 and 20 mph (imperial) or 3.5 and 9 m/s (metric), built in the card files with the engine's 90°. The cards print the windage as a size, light wind on the left of each point-of-aim chart and strong wind on the right, marked `LI` and `ST`. No label on them says left or right, so the convention of [#106](https://github.com/hawkins48b/cw-zro/issues/106) changed nothing on them.

## Drag

A single BC scales the standard G1 or G7 drag table from the library. Any `bcType` other than `G7` is treated as G1. The drag coefficient is read from the table by Mach number, through a quadratic fit between table points.

- BC does not change with velocity. The library has a multi-BC model, but the app does not use it.
- There are no custom drag curves.
- The published BC is taken as it is. It is not corrected for the bullet or the rifle.

## Atmosphere

**Standard.** With "use ISA" on, the app calls `new Atmo()`: sea level, 15 °C (59 °F), 1013.25 hPa, 0 % humidity.

**Custom.** Temperature and humidity are passed as entered, and the pressure after the altitude correction below. A temperature outside -90 to 70 °C (-130 to 158 °F), a pressure outside 300 to 1200 hPa (8.86 to 35.4 inHg), a humidity outside 0 to 100, or an altitude outside -1000 to 10000 m (-3281 to 32808 ft) gives no result, and the box shows the allowed range ([#92](https://github.com/hawkins48b/cw-zro/issues/92), [#125](https://github.com/hawkins48b/cw-zro/issues/125)). The limits are in the unit entered.

**Enter the sea-level pressure (QNH), as weather reports give it** ([#107](https://github.com/hawkins48b/cw-zro/issues/107), owner decision of 2026-11-10). The box says so, with the hint that the app corrects it for the altitude above. [`stationPressure`](../src/lib/utils/stationPressure.js) multiplies the entered value by the ISA ratio for the site altitude, `Atmo.standardPressure(altitude) / 1013.25 hPa`, which is `(1 - 0.0065 h / 288.15) ^ 5.255876` with `h` in metres: 1 at 0, 0.887 at 1000 m, 0.692 at 3000 m, 0.261 at 10000 m, 1.124 at -1000 m. The result goes to `Atmo` as the pressure at the site. Air temperature does not enter the correction, so on a day far from the standard temperature the pressure at the site differs a little from a true station pressure. Density then comes from that pressure, temperature and humidity. Entering a station pressure measured at the site now gives too thin air at altitude: at 5000 ft, 24.9 inHg is read as a sea-level 24.9 inHg and becomes 20.7 inHg at the site. The limits of 300 to 1200 hPa (8.86 to 35.4 inHg) apply to the value entered, so the pressure given to the engine runs from about 78 hPa (300 hPa at 10000 m) to about 1349 hPa (1200 hPa at -1000 m).

Before #107 the entered pressure was passed as it was, and altitude did not change the result: changing only the altitude from 0 to 10000 ft left drop and velocity identical. Values saved before #107 in the Ballistic, Scope View and trajectory validation pages were meant as station pressure, and are now read as sea-level pressure. They are not converted.

The altitude also sets where the engine ends a flight, at an altitude of -1410.748 ft, -430 m (see [Engine](#engine)): the site altitude plus the height of the bullet over the muzzle. A low site inside the altitude limits can therefore give no result. The Ballistic, scope view and trajectory validation pages then say under the altitude box that the altitude is too low for this shot ([#125](https://github.com/hawkins48b/cw-zro/issues/125)). On the `.308` test profile there is no result below about -1402 ft at 600 yd, or -365 ft at 3000 yd.

**During the flight**, density and speed of sound follow the height of the bullet once it is more than 30 ft from the starting altitude, using a fixed lapse rate. Speed of sound depends on temperature only, not on humidity.

**Humidity** is entered in percent and passed to the library as a fraction from 0 to 1, through `humidityFraction()`. The library divides values above 1 by 100 and keeps the rest, so passing the percentage would read 1 % as 100 % ([#84](https://github.com/hawkins48b/cw-zro/issues/84)). Saved values of 1 or less changed meaning with that fix.

## Powder sensitivity

With the option on, the velocity changes by the entered value in **fps per degree**, in the profile's temperature unit, also when velocity is entered in m/s ([#81](https://github.com/hawkins48b/cw-zro/issues/81)). The change runs from the profile's temperature to the air temperature of the calculation.

- The change does not depend on muzzle velocity, and it is linear.
- Powder temperature is taken to be the air temperature. There is no separate field for it.
- A negative value is accepted, for a load that slows down when warm.
- The formula depends on the library's `getVelocityForTemp`, so recheck it on a library upgrade.

## Wind

One wind applies for the whole flight, with no vertical part. The direction is where the wind comes from, in degrees clockwise from the target, as on a shooter's clock ([#106](https://github.com/hawkins48b/cw-zro/issues/106), owner decision of 2026-11-11). The library reads its angle the other way round: 0° is a tailwind and 90° a wind from the left (`Wind.directionFrom`, vector (cos, 0, sin)). So [`shotWinds`](../src/lib/utils/shotWind.js) gives the engine the entered angle plus 180°, in [0, 360) ([`halfTurn`](../src/lib/utils/windDirection.js)).

| Direction entered | Clock | Wind | Effect, 10 mph, `.308` test profile at 1000 yd |
|-------------------|-------|------|-------------------------------------------------|
| 0° | 12 | Headwind, from the target | Drop 5.1 in more than with no wind |
| 90° | 3 | From the right | 110.8 in to the left |
| 180° | 6 | Tailwind, from behind | Drop 5.0 in less than with no wind |
| 270° | 9 | From the left | 110.8 in to the right |

On the wind dial, 0° is at the top, towards the target. The Wind icon sits at the entered angle, where the wind comes from, and the arrowhead points where it blows. Dragging the dial moves the Wind icon. A line under the direction box says what the angle means.

An empty direction box counts as 0°, as its placeholder and the dial show ([#116](https://github.com/hawkins48b/cw-zro/issues/116)). Since #106 that is a headwind. So clearing the box with a wind speed above 0 gives a result for a wind the user did not enter.

**Directions saved before #106** were in the library's convention. Both stores convert their wind once, when they load, to the direction half a turn away, so the wind and the result stay the same: a saved 90 (from the left) becomes 270, and an empty box (a tailwind then) becomes 180. A marker in the saved wind stops a second conversion. See [Stored values](architecture.md#stored-values).

A comma in the speed or direction box reads as a decimal point: `1,5` is 1.5, in the result, on the dial and in the badge ([#117](https://github.com/hawkins48b/cw-zro/issues/117)).

## Spin drift

With the option on and a twist entered, the library adds the empirical drift `1.25 × (Sg + 1.2) × t^1.83` inches, where `t` is the time of flight and `Sg` is the Miller stability factor, corrected for velocity, temperature and pressure. The profile form requires bullet length and twist.

- The form accepts a twist of 1 to 100 in (25.4 to 2540 mm) and a length of 0.1 to 4 in (2.54 to 101.6 mm), positive only, so all drift entered in the form is to the right. Left-hand twist cannot be entered, although the calculation supports it: the calculators take a stored negative twist from -1 to -100 in ([#125](https://github.com/hawkins48b/cw-zro/issues/125)).
- It is added to windage, not modelled as a force.
- Spin drift has no independent check.

## Zero

`setWeaponZero` finds the barrel elevation that puts the bullet on the line of sight at the zero distance, to within 0.000005 ft in at most 60 iterations.

**The zero is solved again for every calculation**, on the same shot, with its own atmosphere, wind and powder. So the app does not model a rifle zeroed in one set of conditions and fired in another. Drop at the zero distance is always about 0, in any conditions (0.002 in measured on two atmospheres), and differences from the zero conditions are understated. This is a known modelling limit, and it is not pinned by a test, so that a test does not make it look correct.

The solver checks height on its first integration step past the distance, about 0.1 yd further out.

The zero is the only saved distance. Near and far zero come from the trajectory. Dope cards read both from one extra calculation to 3000 units, and print a blank when a crossing lies past it or does not exist ([#86](https://github.com/hawkins48b/cw-zro/issues/86)). Both cards print them as whole yards or metres; the metric card printed tenths until [#138](https://github.com/hawkins48b/cw-zro/issues/138).

**Dope card scales.** The axis numbers and target grids are printed in the templates: the drop graph runs from +20 to -80 in (imperial) or +50 to -300 cm (metric), each points-of-aim target from about 19 MOA above to 9 below and 20 either side (imperial), or 5 mrad above, 2 below and 5 either side (metric). A point past them is drawn as an arrow on the edge with its true value, and the line stops at the edge ([#136](https://github.com/hawkins48b/cw-zro/issues/136)). The geometry is in `CARD_LAYOUTS` of [`dopeCardLayout.js`](../src/lib/utils/dopeCardLayout.js). Header text that does not fit its field is shrunk down to 7 pt, then cut with an ellipsis ([#137](https://github.com/hawkins48b/cw-zro/issues/137)). The cards print with the standard font Helvetica Bold, which encodes only WinAnsi (Western European): any other character (emoji, CJK, Cyrillic, `ł`) is dropped from the header text, and a space character it cannot encode, such as U+202F, prints as a space ([#140](https://github.com/hawkins48b/cw-zro/issues/140), `encodableText`).

## Angles

**Uphill and downhill.** While its angle section is open, the scope view multiplies the distance by the cosine of the entered angle, or by the entered cosine, and then calculates a flat shot at that shorter distance. An entered cosine must be above 0 and at most 1 ([#121](https://github.com/hawkins48b/cw-zro/issues/121)), and an angle in degrees strictly between -90° and 90° ([#129](https://github.com/hawkins48b/cw-zro/issues/129)), or the box shows a message and there is no result. An empty box is a flat shot. This is an approximation: the engine's look angle is not used. Time, energy and velocity shown with it are those of the shorter distance. No other screen has an angle.

**Cant.** Rotating the scope view recalculates the shot with a cant angle, for the reticle only. The adjustments shown come from the shot without cant. The zero is solved on the canted shot too. At 600 yd on the `.308` test profile, 5° gives 2.01 in of windage and 0.12 in more drop. Cant has a regression test and no independent check.

## Outputs and signs

| Value | Sign |
|-------|------|
| `targetDrop`, `dropAdjustment` | Negative below the line of sight: dial up. Positive above: dial down |
| `windage`, `windageAdjustment` | Positive to the right: dial left |

Values are rounded for display: 0.1 for MOA, MRAD, in and cm, 0.01 for ft and m. The scope view counts clicks from the rounded value.

Energy is `weight × velocity² / 450400`, in ft-lb.

**Max apex**, **max drop** and **subsonic distance** do not depend on the table step ([#85](https://github.com/hawkins48b/cw-zro/issues/85), [#94](https://github.com/hawkins48b/cw-zro/issues/94)). After the table, the same shot is fired again over the whole range on a grid of about one unit that ends on the range, keeping the zero and Mach crossing rows. The library never sets its apex flag, so these three come from that grid:

| Value | Definition | Against step 1 rows |
|-------|------------|---------------------|
| `maxApex` | Highest point above the line of sight. Empty when the bullet stays below it. A bullet still rising at the end of the range gives that last point | Within 1 distance unit and 0.05 in or cm |
| `maxDrop` | Lowest point under the line of sight within [0, range], the muzzle included. On a fractional range this is the row at the range, which step 1 rows do not have | Within 1 distance unit and 0.05 in or cm, the row at the range included |
| `subsonicDist` | First row within the range whose velocity is under the speed of sound at the shooter (`soundSpeedFPS`), or empty. The engine's Mach crossing row compares with the local speed of sound, which differs as the bullet drops, so the value is that row or the next grid row | Within 1 distance unit (tests). Equal to step 1 rows on the 1470 cases measured for #94 |

No row past the range counts. The second fire costs about as much as a step 1 table: about 3 ms more per calculation at 1000 yd and 12 to 14 ms more at 3000 yd, measured in the dev container on the test profiles during #94. The probe is not kept in the repository.

## MPBR

`calculateMPBR` finds the longest range over which the bullet stays inside a target of the given size ([#86](https://github.com/hawkins48b/cw-zro/issues/86)). It uses the standard atmosphere, no wind and no powder sensitivity.

1. It bisects barrel elevation until the apex touches the top of the zone, half the target size.
2. It takes the near crossing of that arc, where the bullet comes up through the line of sight, as the zero ([#109](https://github.com/hawkins48b/cw-zro/issues/109), owner decision of 2026-11-11). The zero is a whole unit: the one under the crossing if the shot zeroed there keeps its apex inside the zone, else the one above. A further near zero gives a lower arc, and the solver zeroes about 0.1 yd past the distance, which lowers it a little more.
3. It zeroes the shot there and reads every returned value from that shot.

| Property | Value |
|----------|-------|
| Zero | Always the near crossing, so `optimalZero` equals `nearZero`. A crossing under 1 unit gives a zero of 1 |
| Against a walk over whole near zeros | Same `mpbrMax`, within 0.1 (tests on 8, 30 and 300 in) |
| Against the best any zero can give | Never more than 0.1 over it. Under it by what one whole unit of near zero costs, see below |
| Rounding | Distances to 0.1 |

One unit of near zero moves the arc far more than one unit of far zero, so a whole unit near zero can leave the apex well under the top of the zone. `mpbrMax` against the arc that touches the top, measured in the dev container on 2026-11-11 for #109 on the four test profiles, in and cm, sizes 0.001 to 33000:

| Targets | Largest loss |
|---------|--------------|
| The 8 baseline cases (8 in, 20 cm) | 5.9 m, 2.2 % (`.308`, 20 cm) |
| Up to 30 in or 100 cm | 20 yd, 4.0 % (`.308`, 30 in) |
| 100 in to 1000 in | 8.4 % (`.308`, 300 in) |
| Near crossing under 1 unit (about 3000 in and up) | 10 to 27 % |
| A 300 fps load on 8 in | 15 % (3 yd zero, 31.6 yd) |

Before #109 the zero was the far crossing (from [#86](2026-11-05-86-mpbr-search.md)), which lost at most 1 unit. A near zero to 0.1 unit would lose at most about 1 % up to 30 in or 100 cm on the same profiles, measured but not implemented.

There is no near crossing when the sight height is 0 or less: the bullet starts on or over the line of sight. MPBR then gives no result.

**"Set MPBR for current profile" saves the near crossing as the zero**: 21 yd for an 8 in target on the `.308` test profile, which comes back down through the line of sight at 249 yd.

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
- Running out of time gives its own message, not no solution, because the goal may still be reachable ([#95](https://github.com/hawkins48b/cw-zro/issues/95)). A solve near the limit can differ between devices.

## Input guards

The library runs synchronously. **Far outside normal values it can stay in its loop for good, and neither `try/catch` nor a timeout can stop that.** So guards have to run before the engine is called. These are the guards in place.

The limits were set by the owner on 2026-11-10 ([#89](https://github.com/hawkins48b/cw-zro/issues/89), [#90](https://github.com/hawkins48b/cw-zro/issues/90), [#91](https://github.com/hawkins48b/cw-zro/issues/91), [#92](https://github.com/hawkins48b/cw-zro/issues/92), [#93](https://github.com/hawkins48b/cw-zro/issues/93), [#114](https://github.com/hawkins48b/cw-zro/issues/114), [#119](https://github.com/hawkins48b/cw-zro/issues/119), [#125](https://github.com/hawkins48b/cw-zro/issues/125)). They live in [`inputLimits.js`](../src/lib/utils/inputLimits.js) and [`zeroDistance.js`](../src/lib/utils/zeroDistance.js), and the form and every path read them from there. Measured on f40933f before the change, 3888 worst-case combinations inside them (G1 and G7, BC 0.01 to 2, 60 to 9999 fps, sight height -10 to 10 in, zero 1 to 3000, both ends of temperature and pressure, no wind and 223 mph at 0° and 90°, the engine's angles) gave no hang through `calculateShotPoint` and `calculateFullTrajectory`. The slowest took 2.2 s, on a 3000 zero. The dope cards, MPBR and validation were not part of that run.

| Limit | Value, in the unit entered |
|-------|----------------------------|
| BC | At least 0.01 (`MIN_BC`) |
| Muzzle velocity | At least 50 fps, under 10000 fps, also when entered in m/s (15.24 to under 3048 m/s) |
| Sight height | At most 10 in or 25.4 cm either way |
| Range | Above 0, at most 3000 yd or m |
| Zero distance | 1 to 3000 yd or m, after taking its absolute value |
| Air temperature, custom | -90 to 70 °C, or -130 to 158 °F |
| Air pressure, custom | 300 to 1200 hPa, or 8.86 to 35.4 inHg, as entered (sea level). About 78 to 1349 hPa after the altitude correction ([#107](https://github.com/hawkins48b/cw-zro/issues/107)) |
| Humidity, custom | 0 to 100 % |
| Altitude, custom | -1000 to 10000 m, or -3281 to 32808 ft ([#125](https://github.com/hawkins48b/cw-zro/issues/125)) |
| Bullet weight | 1 to 2000 gr, or 0.065 to 130 g ([#125](https://github.com/hawkins48b/cw-zro/issues/125)) |
| Bullet diameter | 0.1 to 1 in, or 2.54 to 25.4 mm ([#125](https://github.com/hawkins48b/cw-zro/issues/125)) |
| Bullet length, spin drift on | 0.1 to 4 in, or 2.54 to 101.6 mm ([#125](https://github.com/hawkins48b/cw-zro/issues/125)) |
| Barrel twist, spin drift on | 1 to 100 in, or 25.4 to 2540 mm, either way in the calculators ([#125](https://github.com/hawkins48b/cw-zro/issues/125)) |

All ends are included. The gram and foot ends are the owner's rounded values, not exact conversions: 130 g is 2006 gr, -3281 ft is -1000.05 m.

| Where | Rule | Otherwise |
|-------|------|-----------|
| Profile form | Optic height, zero, diameter, weight, BC, velocity and click values must be plain finite decimals above 0. `Infinity`, `1e999`, hex and text after the number are not numbers | Form error |
| Profile form | Optic height, zero, diameter, weight, BC and velocity within the limits above. The form requires a positive optic height, although the calculators take a negative one | Form error stating the range, in the unit chosen |
| Profile form, spin drift on | Twist and length must be positive and within the limits above | Form error stating the range, in the unit chosen |
| Profile form, sensitivity on | Temperature and modifier must be plain finite decimals | Form error |
| `calculateShotPoint`, `calculateFullTrajectory` | Range within the limit. Step at least 1, 25 when empty, and at most the range: a larger or infinite step is read as the range (full trajectory, `tableStep`, [#133](https://github.com/hawkins48b/cw-zro/issues/133)) | No result |
| Ballistic page, step | At least 1 and at most the range, at least 1 for a range under 1 (`tableStepLimit`). Text and NaN count as under 1, an infinite step as over the range ([#130](https://github.com/hawkins48b/cw-zro/issues/130), [#133](https://github.com/hawkins48b/cw-zro/issues/133)) | A message under the box. The table uses `tableStep`: 1, or the range |
| All five paths | BC at least 0.01 (`isUsableBc`) | No result. A dope card is not saved |
| All five paths | Entered velocity finite and under 10000 fps, and velocity at the current temperature finite, at least 50 and under 10000 fps (`hasFlyableVelocity`). MPBR and the dope cards use no powder sensitivity | No result. A dope card is not saved |
| All five paths | Optic height finite and within 10 in or 25.4 cm either way (`isUsableSightHeight`) | No result. A dope card is not saved |
| All five paths | Bullet weight and diameter within the limits above (`hasUsableBullet`) ([#125](https://github.com/hawkins48b/cw-zro/issues/125)) | No result. A dope card is not saved |
| Shot point, full trajectory, MPBR, spin drift on | Twist, taken either way, and length within the limits above when they are set (`hasUsableBullet`). Empty, they are not passed to the engine (no twist, 2 in length), as before. The dope cards never use spin drift and do not check them | No result |
| Shot point, full trajectory, dope cards | Zero distance 1 to 3000 (`isUsableZeroDistance`) | No result. A dope card is not saved |
| Shot point, full trajectory, MPBR, dope cards | Finite barrel elevation after the zero solve, before any shot (`hasFiniteElevation`). It only rejects NaN and Infinity, so it changes no result. It does not stop every hang: a NaN that appears during the flight solves to a finite elevation, usually 0 | No result. A dope card is not saved |
| Shot point, full trajectory, custom atmosphere | Values within the limits above, altitude included (`isUsableAtmosphere`) | No result, and a message under the box |
| Shot point, full trajectory, custom atmosphere | Air density above 0 after the altitude correction (`hasPositiveDensity`, [#107](https://github.com/hawkins48b/cw-zro/issues/107), approved by the owner on 2026-11-10). The library's density goes below 0 when the water vapour pressure is far above the air pressure: at 10000 m, 70 °C and 100 % humidity, a sea-level pressure of 300 to about 453 hPa (118 hPa at the site). At 60 °C it would need under 290 hPa, so at 60 °C or below it cannot happen inside the limits. 300 hPa ran for more than 5 minutes on a G7 BC 0.01, 9999 fps, 3000 yd zero | No result, and "This air is too thin and humid to calculate" under the pressure box (`hasNoAirDensity`) |
| Ballistic, scope view and trajectory validation pages, custom atmosphere | The engine ended the flight at its minimum altitude of -1410.748 ft, as it reports it: `fire` throws `TrajectoryRangeError` with `MinimumAltitudeReached`, or the zero solve fails after that stop cut one of its flights. The calculators run the default Euler engine through a subclass that only notes that stop ([`flightStop.js`](../src/lib/utils/flightStop.js)), so no result changes ([#125](https://github.com/hawkins48b/cw-zro/issues/125)) | No result, as before, and "altitude too low for this shot" under the altitude box. Validation returns `minimum_altitude` |
| Ballistic page | Range above 0 and at most 3000 (`isUsableBallisticRange`). A negative range gives no result here, as on the compare page ([#122](https://github.com/hawkins48b/cw-zro/issues/122)) | No result, and a message under the box |
| Scope view, angle in cos | Cosine finite, above 0 and at most 1 (`isUsableScopeAngle`). Empty is flat ([#121](https://github.com/hawkins48b/cw-zro/issues/121)) | No result, and a message under the box |
| Scope view, angle in degrees | Angle finite and strictly between -90° and 90° (`isUsableScopeAngle`). Text that is not a number is rejected. Empty is flat ([#129](https://github.com/hawkins48b/cw-zro/issues/129)) | No result, and a message under the box |
| Shot point, full trajectory, wind speed above 0 (`shotWinds`) | Speed at most 100 m/s, about 224 mph, in either unit. Direction a number or text that reads as a number, at most 1e6 degrees either way, so a negative angle is valid; the limit applies to the angle entered, before the half turn of #106, and the engine then gets an angle in [0, 360). An empty or whitespace text counts as 0°, a headwind. Null, a missing value, an object or a boolean is not empty | No result |
| Shot point, full trajectory, stored wind speed that is an array, object or boolean (`shotWinds`) | Rejected, because the page can still show it as a speed | No result |
| Shot point, full trajectory, wind speed empty, text, 0, negative, null or missing (`shotWinds`) | No wind is used, so the direction is not checked | Normal result without wind |
| Compare trajectories | Same zero rule on each entry's field. Range within the limit | Message under the field, and the entry leaves the chart |
| Compare trajectories | A usable zero whose trajectory gives no result ([#114](https://github.com/hawkins48b/cw-zro/issues/114)) | Message under the field, and the entry leaves the chart |
| Dope cards | Any of the four card trajectories gives no result, for any reason. `generateImperialDopeCard` and `generateMetricDopeCard` return null | The page shows "Cannot compute" and saves no PDF ([#91](https://github.com/hawkins48b/cw-zro/issues/91)) |
| Dope cards | Building or saving the PDF throws, for example when the template cannot be fetched (`downloadDopeCard` returns `'failed'`) | The page shows that the PDF could not be created or saved, not "Cannot compute" ([#123](https://github.com/hawkins48b/cw-zro/issues/123)) |
| `calculateMPBR` | Barrel elevation up to 0.5 rad, flight up to 20000 units, at most 54 fires and 2 zero solves | No result. A shot reaching the limit is never reported as a capped distance |
| MPBR page | A suggested zero above 3000. Since #109 the zero is a near crossing, at most 111 units on the measured cases, so this no longer happens on them | Shown, but not offered for saving, with a message |
| `calculateTrajectoryValidation` | Range at least 100 and at most 3000, beyond the zero, value not 0, velocity and BC above 0 | No result, or an error message for the range |
| `calculateTrajectoryValidation` | Velocity between 0 and 10000 in the profile's unit, BC between 0.01 and 2. Each shot goes through `calculateShotPoint`, so its limits apply too | Shot skipped |
| `calculateTrajectoryValidation` | At most 200 shots and 5 seconds, checked before each shot | No solution, or a timeout message when time ended a search that could still move |
| Dope card zero search | Zero elevation at most 0.6 rad | Near and far stay blank |

Saved profiles are read through the same guards on every path, so a stored `Infinity`, hex or out-of-limit value in a field with a limit gives no result instead of freezing a page. Since [#125](https://github.com/hawkins48b/cw-zro/issues/125) this also covers weight, diameter, twist, length and altitude: a stored `Infinity` or `0x10` there gives no result (`0x10` reads as 0, below every lower limit).

**Remaining gaps.** These are known and not fixed:

- The powder sensitivity temperature and modifier only have to be finite in the form. The velocity they give is checked.
- The pressure correction for altitude ([#107](https://github.com/hawkins48b/cw-zro/issues/107)) gives the engine pressures down to 78 hPa. Probed on this branch with the engine in a worker and a 30 s limit: 2048 corners (G1 and G7, BC 0.01 and 2, 60 and 9999 fps, sight height ±10 in, zero 1 and 3000, altitude -1000 and 10000 m with 300 and 1200 hPa, -90 and 70 °C, 0 and 100 % humidity, no wind and 100 m/s at 90° in the engine's angle, shot point and full trajectory, range 3000 yd), and 480 cases at 10000 m from 300 to 1200 hPa. Without the density guard, 4 corners ran past 30 s, all at 10000 m, 300 hPa, 70 °C, 100 %. With it, none did. The slowest took 0.9 s alone. A density just above 0 is not proven safe for every combination. Readings that are physically impossible (water vapour pressure above the air pressure, as at 70 °C below about 312 hPa) still give a result when the density stays above 0.
- The low end of the altitude limits gives no result, because the engine ends every flight below -1410.748 ft. The pages with a custom atmosphere say so. With the standard atmosphere (compare, MPBR, dope cards, and the other pages with "use ISA" on) a flight that drops 1410 ft below the muzzle ends the same way, and shows only the general no-result text.
- In trajectory validation, only the profile's own first shot is checked for that stop. A later shot of the search that ends there counts as a failed shot, and can end in "no solution".
- The hangs measured near the limits needed a sight height about as large as the zero distance or larger (20 in with a 0.5 zero, 10 in with a 0.2 zero), which the limits rule out. No proof covers every combination inside them, and the dope cards, MPBR and validation were not part of the 3888-combination run.
- A zero near 1 on a slow or low-BC load can still give no result. The compare page says so, the other pages show their no-result message.
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

**Table and chart rows past the range.** Not changed by [#94](https://github.com/hawkins48b/cw-zro/issues/94), found in its security review. When the step does not divide the range, the table has no row at the range, and the engine can add a row past it. With extraData it records a flagged row (Mach or far zero crossing) during its last integration steps, and a Mach crossing there is recorded as the next table row. On a 1000 yd or m range, `P223_G1` at step 999 gives the rows 0, 999 and 1998, and at step 600 the rows 0, 600 and 1200. The charts also draw a far zero row past the range, at 1045.9 yd on `P308_G1` with a 1000 yd range and step 999. Max drop and subsonic distance ignore those rows and read within the range, so max drop can be at 1000 while the table ends at 999 or shows 1998.

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
