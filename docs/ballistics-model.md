# Ballistics model

This guide describes what the app calculates on `develop`, what it assumes, and how far the results have been checked. The code is in [`ballisticCalculator.js`](../src/lib/utils/ballisticCalculator.js), [`trajectoryValidation.js`](../src/lib/utils/trajectoryValidation.js), the two mid-range dope card files and [`precisionCard.js`](../src/lib/utils/precisionCard.js) (precision dope card), on top of the `js-ballistics` library.

**Read this first.** The results are estimates from a point-mass model. Their accuracy depends on the velocity, BC and conditions entered. The evidence below is a comparison with two manufacturer tables that were probably computed, not measured. Nothing in this repository shows that the results are accurate or safe for hunting, competition or any other real-world use. Check them against your own rifle and ammunition.

## Engine

The app uses `js-ballistics` 3.1.0, pinned exactly ([#77](https://github.com/hawkins48b/cw-zro/issues/77), owner decision of 2026-11-11). Version 3 solves in WebAssembly: it embeds bclibc 2.0.0, a C++ engine under the LGPL-3.0 (see [Licences](data-and-privacy.md#licences)). [`ballisticEngine.js`](../src/lib/utils/ballisticEngine.js) loads it once, when the module is first imported, and gives the app a synchronous `Calculator` with the settings below. The library's own `Calculator` is async. Until 3.1.0 the app used 2.2.0-beta.2, a pure JavaScript pre-release, on Euler.

**Why RK4, step 0.5.** On 3.1, RK4 lands closer to the 2.2 Euler results than 3.1's Euler does: the density and drag corrections of 3.1 and Euler's own error go opposite ways. RK4's step is scaled by `stepMultiplier`. Against the 2.2 values of the baseline table, 0.5 gave the smallest total and the smallest largest shift: 131 values outside their tolerance, the worst 10.7 tolerances (0.11 in of drop, 0.23 fps). The 3.x default step (1) gave 118 values but a worst of 18.2 tolerances, 0.25 gave 150, and Euler at 0.25 ft gave 212, the worst 0.27 in and 0.61 fps.

| Setting | Value |
|---------|-------|
| Model | Point mass: position and velocity only, no bullet attitude |
| Integration | RK4, the 3.x default, with half its default step (`stepMultiplier` 0.5). The app used Euler, 0.25 ft per step, on 2.2 (owner decision of 2026-11-12 on #77) |
| Gravity | 32.17405 ft/s², constant and straight down |
| Flight ends at | 50 fps, 15000 ft of drop, or an altitude of -1410.748 ft. The 2.2 limits, set in `ENGINE_CONFIG`: the 3.x defaults are -10000 ft and -1500 ft |
| Zero search | At most 60 iterations, to within 0.000005 ft (3.x default: 40) |

In `calculateShotPoint` and `calculateFullTrajectory`, a flight that ends before the requested range gives no result, not a partial table. The `.223` test profile, for example, gives no result at 3000 yd: its flight ends at 2732 yd.

These two functions note when a flight ended at the minimum altitude, from the stop reason the engine returns ([`flightStop.js`](../src/lib/utils/flightStop.js), [#125](https://github.com/hawkins48b/cw-zro/issues/125), [#126](https://github.com/hawkins48b/cw-zro/issues/126)). `fire` throws the library's `RangeError` with reason `MinimumAltitudeReached`. The zero solve runs inside the WebAssembly engine and does not say why it failed, so after a failed solve the calculator fires the shot it started from to the zero distance and reads that flight's reason. Only the public API is used. That extra fire runs only after a failure, so no result changes.

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
| Pressure | inHg, hPa | Custom atmosphere: sea-level pressure (QNH), as in weather reports (compare). The Accurate mode of the Scope View, the Ballistic page and, since [#194](https://github.com/hawkins48b/cw-zro/issues/194), Trajectory Validation takes station pressure only since [#172](https://github.com/hawkins48b/cw-zro/issues/172) |
| Air temperature | °F, °C | Custom atmosphere; Scope View Estimate mode |
| Humidity | % | Custom atmosphere. Scope View Estimate mode takes it from the weather |
| Wind speed | mph, m/s | Wind |
| Wind direction | degrees, where the wind comes from | Wind |

Weight and diameter do not change the drag. The BC alone carries that.

**Typed numbers.** A comma reads as a decimal point, so `1,5` is 1.5 ([#117](https://github.com/hawkins48b/cw-zro/issues/117)). There is no thousands separator: `1,500` is 1.5, not 1500. The profile form accepts only plain finite decimals (`parseDecimal` in [`decimal.js`](../src/lib/utils/decimal.js)) and saves them with a decimal point. The calculators and the boxes on the calculator pages read values as `parseFloat` does, with the first comma read as a decimal point (`readDecimal`), so a value without a comma gives the same result as before, and `90abc` still reads as 90.

**Limits.** Each input with a limit is listed under [Input guards](#input-guards). They are the same in the profile form and on every calculation path ([`inputLimits.js`](../src/lib/utils/inputLimits.js)).

### Which screen uses what

| Screen | Function | Atmosphere | Wind | Powder sensitivity | Spin drift |
|--------|----------|------------|------|--------------------|------------|
| Scope view | `calculateShotPoint` | ISA (standard at the altitude), Estimate or Accurate, see [Scope View modes](#scope-view-modes) | Yes | Yes | Yes |
| Ballistic calculator | `calculateFullTrajectory` | ISA, Estimate or Accurate, as the Scope View since [#151](https://github.com/hawkins48b/cw-zro/issues/151), see [Scope View modes](#scope-view-modes) | Yes | Yes | Yes |
| Trajectory validation | `calculateTrajectoryValidation` | ISA, Estimate or Accurate, as the Scope View since [#194](https://github.com/hawkins48b/cw-zro/issues/194), see [Scope View modes](#scope-view-modes) | No | Yes | Yes |
| Compare trajectories | `calculateFullTrajectory` | Standard only | No | Yes | Yes |
| MPBR | `calculateMPBR` | Standard only | No | No | Vertical only is used |
| Dope cards | `computeTrajectory` in each card file | Standard only | Preset | No | No |
| 3D tutorial ([#182](https://github.com/hawkins48b/cw-zro/issues/182)) | `calculateFullTrajectory`, through [`tutorialTrajectory`](../src/lib/utils/tutorialPath.js), with the angle of the target elevation | ISA, Estimate or Accurate, as the Scope View (its own state) | Yes | Yes | Yes |
| Precision dope card | `computePrecisionCard` | Standard reference, plus fixed pressure and temperature columns, see [Precision dope card](#precision-dope-card) | Fixed crosswinds | Yes | Yes, from twist and length, whatever the switch says |

Dope cards go to 500 yd or 500 m. They use a crosswind from the left of 8 and 20 mph (imperial) or 3.5 and 9 m/s (metric), built in the card files with the engine's 90°. The cards print the windage as a size, light wind on the left of each point-of-aim chart and strong wind on the right, marked `LI` and `ST`. No label on them says left or right, so the convention of [#106](https://github.com/hawkins48b/cw-zro/issues/106) changed nothing on them.

## Drag

A single BC scales the standard G1 or G7 drag table from the library. Any `bcType` other than `G7` is treated as G1. The drag coefficient is read from the table by Mach number, through monotone cubic (PCHIP) interpolation between table points. 2.2 used a quadratic fit; the change is one cause of the shifts of [#77](https://github.com/hawkins48b/cw-zro/issues/77).

- BC does not change with velocity. The library has a multi-BC model, but the app does not use it.
- There are no custom drag curves.
- The published BC is taken as it is. It is not corrected for the bullet or the rifle.

## Atmosphere

**Standard.** The app calls `new Atmo()`: sea level, 15 °C (59 °F), 1013.25 hPa, 0 % humidity. The ISA mode of the Scope View, the Ballistic page and Trajectory Validation does that at altitude 0 only; see [Scope View modes](#scope-view-modes).

**Custom.** Temperature and humidity are passed as entered, and the pressure after the altitude correction below. A temperature outside -90 to 70 °C (-130 to 158 °F), a pressure outside 300 to 1200 hPa (8.86 to 35.4 inHg), a humidity outside 0 to 100, or an altitude outside -1000 to 10000 m (-3281 to 32808 ft) gives no result, and the box shows the allowed range ([#92](https://github.com/hawkins48b/cw-zro/issues/92), [#125](https://github.com/hawkins48b/cw-zro/issues/125)). The limits are in the unit entered.

**Enter the sea-level pressure (QNH), as weather reports give it** ([#107](https://github.com/hawkins48b/cw-zro/issues/107), owner decision of 2026-11-10). The box says so, with the hint that the app corrects it for the altitude above. [`stationPressure`](../src/lib/utils/stationPressure.js) multiplies the entered value by the ISA ratio for the site altitude, `Atmo.standardPressure(altitude) / 1013.25 hPa`, which is `(1 - 0.0065 h / 288.15) ^ 5.255876` with `h` in metres: 1 at 0, 0.887 at 1000 m, 0.692 at 3000 m, 0.261 at 10000 m, 1.124 at -1000 m. The result goes to `Atmo` as the pressure at the site. Air temperature does not enter the correction, so on a day far from the standard temperature the pressure at the site differs a little from a true station pressure. Density then comes from that pressure, temperature and humidity. Entering a station pressure measured at the site now gives too thin air at altitude: at 5000 ft, 24.9 inHg is read as a sea-level 24.9 inHg and becomes 20.7 inHg at the site. The limits of 300 to 1200 hPa (8.86 to 35.4 inHg) apply to the value entered, so the pressure given to the engine runs from about 78 hPa (300 hPa at 10000 m) to about 1349 hPa (1200 hPa at -1000 m).

Before #107 the entered pressure was passed as it was, and altitude did not change the result: changing only the altitude from 0 to 10000 ft left drop and velocity identical. Values saved before #107 in the Ballistic, Scope View and trajectory validation pages were meant as station pressure, and are now read as sea-level pressure. They are not converted.

The altitude also sets where the engine ends a flight, at an altitude of -1410.748 ft, -430 m (see [Engine](#engine)): the site altitude plus the height of the bullet over the muzzle. A low site inside the altitude limits can therefore give no result. The Ballistic, scope view and trajectory validation pages then say under the altitude box that the altitude is too low for this shot ([#125](https://github.com/hawkins48b/cw-zro/issues/125)). On the `.308` test profile there is no result below about -1402 ft at 600 yd, or -349 ft at 3000 yd (-365 ft on js-ballistics 2.2).

### Scope View modes

Since [#148](https://github.com/hawkins48b/cw-zro/issues/148) the Scope View has three atmosphere modes (owner decision of 2026-11-16), since [#151](https://github.com/hawkins48b/cw-zro/issues/151) the Ballistic page has the same three (owner decision), and since [#194](https://github.com/hawkins48b/cw-zro/issues/194) Trajectory Validation (owner request). [`scopeAtmosphereParams`](../src/lib/utils/scopeAtmosphere.js) turns each into what `calculateShotPoint` (Scope View, Trajectory Validation through `calculateTrajectoryValidation`) or `calculateFullTrajectory` (Ballistic, through `ballisticPageTrajectory`; the Validation chart) gets:

| Mode | Boxes shown | Passed to the calculator |
|------|-------------|-------------------------------|
| ISA | Altitude | At altitude 0, `null` (`new Atmo()`, as before). Elsewhere, a custom atmosphere: 1013.25 hPa as QNH, scaled to the site by `stationPressure`, the ISA temperature of the altitude (`Atmo.standardTemperature`), 0 % humidity. That is the same air as `Atmo.icao` at that altitude |
| Estimate | Altitude, weather, temperature | Custom: 1013.25 hPa as QNH, scaled to the site, the entered temperature, humidity from the weather: Sunny 40 %, Cloudy 65 %, Rain 90 %, Snow 80 % |
| Accurate | Station pressure, temperature, humidity | Custom: the boxes as entered, the pressure as station pressure (`pressureRef: 'station'`) passed to `Atmo` as entered, at the fixed altitude `ACCURATE_ENGINE_ALTITUDE_M` (5000 m), never the stored altitude ([#172](https://github.com/hawkins48b/cw-zro/issues/172)) |

ISA using the altitude is the developer's choice on #148, not yet confirmed by the owner. Before #148 the Scope View's ISA ignored the altitude and reset it to 0, so every saved ISA state has altitude 0 and gives the same result.

The Ballistic page worked the same way before #151: "use ISA" gave `new Atmo()` whatever the boxes held, and choosing it reset them to altitude 0. Its store reads a state saved before #151 (no `mode`) with `useISA` on at altitude 0 ([`storedBallisticAtmosphere`](../src/lib/utils/storedState.js)), so even a hand-edited ISA state gives `null` as before, and a custom one is Accurate with QNH, the air it computed, even with a hand-edited `pressureRef: 'station'`. ISA at another altitude and Estimate only apply once the user picks them. Every custom atmosphere still goes through `calculateFullTrajectory`'s guards; `ballisticAtmosphere.test.js` checks both with the engine stubbed.

Trajectory Validation had the same switch as the Ballistic page before #151. Since #194 its store reads its atmosphere with the same reader ([`storedValidationAtmosphere`](../src/lib/utils/storedState.js) calls `storedBallisticAtmosphere`), and a missing or `null` atmosphere is still the standard one (#127). So a saved state gives the result it gave before, up to the rounding of a QNH box converted to station pressure (#172). `validationAtmosphere.test.js` checks this for ISA, a hand-edited ISA altitude, imperial and metric custom atmospheres, velocity and BC, and the damaged sections.

**Accurate is station pressure only** ([#172](https://github.com/hawkins48b/cw-zro/issues/172), owner decision of 2026-11-17). Accurate values come from a Kestrel-type meter or from the weather fill, which converts its sea-level pressure on the device ([Current weather](architecture.md#current-weather)). With station pressure the site altitude changes no result: measured on the eight test loads, 850 hPa, 10 °C, 50 %, 4 m/s crosswind, 100 to 3000 m, altitudes -1000 to 10000 m, the largest difference to altitude 0 was 0.0008 cm of drop (1364 shots with a result at both). The one exception is the engine's minimum altitude (-1410.748 ft, about -430 m, see [Input guards](#input-guards)): it ends a flight once the bullet is that far below sea level, so a low altitude gave no result. At altitude 0 that hit 14 of those shots (the .223 loads from 2700 to 3000 m, the 300 BLK from 2400 m), and at -430 or -1000 m more than 200. So the engine gets 5000 m, not the stored altitude: from about 4142 m up the floor lies further below the muzzle than the engine's maximum drop (15000 ft), so it never ends an Accurate flight, and every shot that had a result at a stored altitude has the same result now (`accurateStation.test.js`). Shots that a stored altitude stopped at the floor (the altitude message) now have a result. The card shows no altitude box and no altitude message in Accurate. The density check stays, but station air within the limits always has a density (checked at the corners of the limits), so the "air too thin" message cannot appear there now.

**Saved QNH states** ([#172](https://github.com/hawkins48b/cw-zro/issues/172)). An Accurate state saved with QNH (`pressureRef: 'qnh'`, or none: every Scope View state before #148 and every Ballistic custom state before #151) is converted when it is read: the QNH box times the ratio of its saved altitude (`stationPressure`, the correction the calculators made before), rounded to 1 decimal in hPa or 2 in inHg ([`accurateStationAtmosphere`](../src/lib/utils/scopeAtmosphere.js)). The result changes only by that rounding, at most 0.05 hPa or 0.005 inHg. Measured on `P223_G1`, `P308_G1` and `P338_G7_METRIC` at 300 to 1500 m with a 4 m/s crosswind: 1019 hPa at 1234 m (878.5 hPa) moves the drop by at most 0.15 cm (0.001 mil), 30.12 inHg at 4321 ft (25.70 inHg) by at most 1.6 cm (0.011 mil), both on the .223 at 1500 m; 29.92 inHg at 3000 ft (26.82 inHg) by 1.4 cm there. The fixture states, recorded as station pressures, convert back to them (24.9 inHg, 845 hPa) and give the same results as before to the bit. Edge cases: a usable QNH with an altitude out of its limits reads as an empty box (no result, as before); a converted value can fall out of the 300 to 1200 hPa limits (QNH 1013 hPa above about 9100 m, or a QNH over about 1140 hPa far below sea level), and then that state has no result where it had one.

The Scope View, the Ballistic page and, since #194, Trajectory Validation pass `pressureRef` (always `station` in Accurate, `qnh` with 1013.25 hPa in ISA and Estimate). MPBR and the dope cards use the standard atmosphere.

ISA and Estimate show a line with the pressure at the site, temperature and humidity used ([`usedScopeAtmosphere`](../src/lib/utils/scopeAtmosphere.js)). It shows dashes when the altitude, or the Estimate temperature, is out of its limits.

 and speed of sound follow the height of the bullet once it is more than 30 ft from the starting altitude, using a fixed lapse rate. Speed of sound depends on temperature only, not on humidity.

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

The wind dial is a shooter's clock (#165): 12 o'clock (0°) is at the top, towards the target, and the shooter is in the centre. A blue circle marks the entered angle on the rim, where the wind comes from, and the arrow starts there and points at the shooter. Dragging the dial moves the circle and the arrow. A line under the direction box says what the angle means.

An empty direction box counts as 0°, as its placeholder and the dial show ([#116](https://github.com/hawkins48b/cw-zro/issues/116)). Since #106 that is a headwind. So clearing the box with a wind speed above 0 gives a result for a wind the user did not enter.

**Directions saved before #106** were in the library's convention. Both stores convert their wind once, when they load, to the direction half a turn away, so the wind and the result stay the same: a saved 90 (from the left) becomes 270, and an empty box (a tailwind then) becomes 180. A marker in the saved wind stops a second conversion. See [Stored values](architecture.md#stored-values).

A comma in the speed or direction box reads as a decimal point: `1,5` is 1.5, in the result, on the dial and in the badge ([#117](https://github.com/hawkins48b/cw-zro/issues/117)).

**Scope View presets** ([#148](https://github.com/hawkins48b/cw-zro/issues/148), owner decision): None, Light and Strong set the speed to 0, 3.5 or 9 m/s, or 0, 7.8 or 20.1 mph in the unit shown ([`windPreset.js`](../src/lib/utils/windPreset.js)). They are the dope cards' metric winds; the mph values are those converted and rounded to 0.1, not the cards' 8 and 20 mph. A preset changes only the speed box, which stays editable, and goes through the same wind guard. The o'clock hint under the direction (`clockHour`) is display only.

## Spin drift

With the option on and a twist entered, the library adds the empirical drift `1.25 × (Sg + 1.2) × t^1.83` inches, where `t` is the time of flight and `Sg` is the Miller stability factor, corrected for velocity, temperature and pressure. The profile form requires bullet length and twist.

- The form accepts a twist of 1 to 100 in (25.4 to 2540 mm) and a length of 0.1 to 4 in (2.54 to 101.6 mm), positive only, so all drift entered in the form is to the right. Left-hand twist cannot be entered, although the calculation supports it: the calculators take a stored negative twist from -1 to -100 in ([#125](https://github.com/hawkins48b/cw-zro/issues/125)).
- It is added to windage, not modelled as a force.
- Spin drift has no independent check.

## Zero

`setWeaponZero` finds the barrel elevation that puts the bullet on the line of sight at the zero distance, to within 0.000005 ft in at most 60 iterations. If the search fails because the flight from the shot's elevation never reaches the distance, as on a long zero of a slow or low BC load, it starts once more from 0.5 rad. Measured for #77 on zeros of 100 to 3000 on twelve loads (726 cases), 55 need that second start, and then 3.1 solves exactly the 647 cases 2.2 solved, on the same arc (at most 0.0025 rad apart).

**The zero is solved again for every calculation**, on the same shot, with its own atmosphere, wind and powder. So the app does not model a rifle zeroed in one set of conditions and fired in another. Drop at the zero distance is always about 0, in any conditions (0.002 in measured on two atmospheres), and differences from the zero conditions are understated. This is a known modelling limit, and it is not pinned by a test, so that a test does not make it look correct.

The zero is exact: the height at the zero distance is about 1e-13 in (0.000002 in at 100 yd on the `.308`). js-ballistics 2.2 checked the height on its first integration step past the distance, about 0.1 yd further out, which lowered every arc a little. That is why short zeros and MPBR zeros moved most with #77.

The zero is the only saved distance. Near and far zero come from the trajectory. Dope cards read both from one extra calculation to 3000 units, and print a blank when a crossing lies past it or does not exist ([#86](https://github.com/hawkins48b/cw-zro/issues/86)). Both cards print them as whole yards or metres; the metric card printed tenths until [#138](https://github.com/hawkins48b/cw-zro/issues/138).

**Dope card scales.** The axis numbers and target grids are printed in the templates: the drop graph runs from +20 to -80 in (imperial) or +50 to -300 cm (metric), each points-of-aim target from about 19 MOA above to 9 below and 20 either side (imperial), or 5 mrad above, 2 below and 5 either side (metric). A point past them is drawn as an arrow on the edge with its true value, and the line stops at the edge ([#136](https://github.com/hawkins48b/cw-zro/issues/136)). The geometry is in `CARD_LAYOUTS` of [`dopeCardLayout.js`](../src/lib/utils/dopeCardLayout.js). Header text that does not fit its field is shrunk down to 7 pt, then cut with an ellipsis ([#137](https://github.com/hawkins48b/cw-zro/issues/137)). The cards print with the standard font Helvetica Bold, which encodes only WinAnsi (Western European): any other character (emoji, CJK, Cyrillic, `ł`) is dropped from the header text, and a space character it cannot encode, such as U+202F, prints as a space ([#140](https://github.com/hawkins48b/cw-zro/issues/140), `encodableText`). The BC field prints the BC and drag table the card computed with, not the stored text: the number as `readDecimal` reads it, and `G7` or `G1` ([#142](https://github.com/hawkins48b/cw-zro/issues/142), `bcHeaderText`).

## Angles

**Uphill and downhill.** The scope view multiplies the distance by the cosine of the entered angle, or by the entered cosine, and then calculates a flat shot at that shorter distance. An entered cosine must be above 0 and at most 1 ([#121](https://github.com/hawkins48b/cw-zro/issues/121)), and an angle in degrees strictly between -90° and 90° ([#129](https://github.com/hawkins48b/cw-zro/issues/129)), or the box shows a message and there is no result. An empty box is a flat shot. Since [#148](https://github.com/hawkins48b/cw-zro/issues/148) the angle box is always shown and a saved angle always applies (owner decision of 2026-11-16); before, it applied only while its section was open, and the section started closed. This is an approximation: the engine's look angle is not used. Time, energy and velocity shown with it are those of the shorter distance. [`scopeAngleCosine`](../src/lib/utils/scopeRange.js) gives the factor; it is exactly 1 for an empty box, 0° or a cosine of 1.

**Ballistic table** ([#173](https://github.com/hawkins48b/cw-zro/issues/173), owner request of 2026-11-17). The Ballistic page has the same angle card, saved with its own state (not shared with the Scope View). `calculateFullTrajectory` takes it as `options.elevation` and applies it the same way: it fires the flat shot to the range times the cosine, with the step times the cosine, and shows each row at its distance divided by the cosine. So the range, the step and every distance shown (rows, chart, near and far zero, highest point, max drop, subsonic distance) are along the line of sight, and each row holds what `calculateShotPoint` gives the Scope View for that distance and angle. `ballisticAngle.test.js` checks that on five cases (yd and m, degrees and cosines, uphill and downhill, wind and custom atmospheres): rounded elevation and windage in MOA, MRAD, in and cm are equal at every row, the raw values agree within 1e-6, and the time within 1e-9. Uphill and downhill give the same table. No angle, an empty box, 0° or a cosine of 1 gives the flat table of before, value for value (the baselines did not change). Time, energy, velocity and the subsonic distance are, as on the Scope View, those of the shorter distance: a bullet that has flown 1000 yd along a 60° line shows the velocity of 500 yd. The rows of the flat table that were already past the range (zero crossings recorded just after it) are moved by the same factor.

The table needs a cosine of at least `MIN_TABLE_COSINE` (1e-6, about ±89.99994°). The engine always flies to about 1e-6 ft and records table rows up to there. With a step of 1 times a smaller cosine, it gave rows past the range: 3004 rows instead of 3001 at a cosine of 1e-7 on 3000 yd, 336334 at 1e-12, and more below, which would freeze the page. Measured on this branch, cosines from 1e-6 up, on yd and m, ranges 1 to 3000 and steps 1 to 100, give the rows of the flat table. A steeper angle, which the Scope View still takes, gives no table and "Too steep for the table" under the box, before the engine. The Scope View keeps its limits: it fires one row only, but below about 3.3e-7 yd of horizontal distance its point is the engine's, not at the distance asked (a pre-existing limit, unchanged here).

**3D tutorial** ([#182](https://github.com/hawkins48b/cw-zro/issues/182)). The tutorial has no angle box: the angle comes from the target distance (along the line of sight) and the target elevation entered, `asin(elevation / distance)`, both in metres ([`tutorialGeometry`](../src/lib/utils/tutorialPath.js)). That angle goes to `calculateFullTrajectory` as the Ballistic page's angle, so the tutorial's drop and drift at the target are the Ballistic table's row at that distance for the same angle, atmosphere and wind. `tutorialPath.test.js` checks it on five cases (m and yd, flat, uphill and downhill, custom atmospheres and wind): the values shown (0.1 cm or in) are equal, the raw drop and drift agree within 5e-5 m and the time within 5e-5 s, with the Ballistic page's step of 25 (or the distance itself, where 25 does not divide it) against the tutorial's own step (the distance cut into at most 200 equal parts). Before the engine, the tutorial refuses a distance the calculators refuse, an elevation outside ±500 m (±1640 ft), and a target as high or as low as it is far (no angle). The shooter altitude only shapes the terrain; the ballistics use the Atmosphere card's altitude (owner default of 2026-11-17). The scene draws each row at its distance `s` along the line of sight, with `slantHeight` across it and `windage` to the right: `s·(0, sin a, -cos a) + slantHeight·(0, cos a, sin a) + windage·(1, 0, 0)`, from the optic. That picture is the rifleman's rule of the tables, not a flight computed along the slope.

**Cant.** Rotating the scope view recalculates the shot with a cant angle, for the reticle only. The adjustments shown come from the shot without cant. The zero is solved on the canted shot too. At 600 yd on the `.308` test profile, 5° gives 2.01 in of windage and 0.12 in more drop. Cant has a regression test and no independent check.

## Outputs and signs

| Value | Sign |
|-------|------|
| `slantHeight`, `dropAngle` | Negative below the line of sight: dial up. Positive above: dial down. Named `targetDrop` and `dropAdjustment` in js-ballistics 2.2 |
| `windage`, `windageAngle` | Positive to the right: dial left. `windageAdjustment` in 2.2 |

Values are rounded for display: 0.1 for MOA, MRAD, in and cm, 0.01 for ft and m. The scope view counts clicks from the rounded value.

Energy is `weight × velocity² / 450400`, in ft-lb.

**Max apex**, **max drop** and **subsonic distance** do not depend on the table step ([#85](https://github.com/hawkins48b/cw-zro/issues/85), [#94](https://github.com/hawkins48b/cw-zro/issues/94)). After the table, the same shot is fired again over the whole range on a grid of about one unit that ends on the range, keeping the zero and Mach crossing rows. js-ballistics 2.2 never set its apex flag; 3.1 can return an exact apex row, but the app does not ask for it (`EVENT_ROWS`), so the charts keep the rows they had. These three come from that grid:

| Value | Definition | Against step 1 rows |
|-------|------------|---------------------|
| `maxApex` | Highest point above the line of sight. Empty when the bullet stays below it. A bullet still rising at the end of the range gives that last point | Within 1 distance unit and 0.05 in or cm |
| `maxDrop` | Lowest point under the line of sight within [0, range], the muzzle included. On a fractional range this is the row at the range, which step 1 rows do not have | Within 1 distance unit and 0.05 in or cm, the row at the range included |
| `subsonicDist` | First row within the range whose velocity is under the speed of sound at the shooter (`soundSpeedFPS`), or empty. The engine's Mach crossing row compares with the local speed of sound, which differs as the bullet drops, so the value is that row or the next grid row | Within 1 distance unit (tests). Equal to step 1 rows on the 1470 cases measured for #94 |

No row past the range counts. The second fire costs about as much as a step 1 table: about 3 ms more per calculation at 1000 yd and 12 to 14 ms more at 3000 yd, measured in the dev container on the test profiles during #94. The probe is not kept in the repository.

## MPBR

`calculateMPBR` finds the longest range over which the bullet stays inside a target of the given size ([#86](https://github.com/hawkins48b/cw-zro/issues/86)). It uses the standard atmosphere, no wind and no powder sensitivity.

1. It bisects barrel elevation until the apex touches the top of the zone, half the target size.
2. It takes the near crossing of that arc, where the bullet comes up through the line of sight, as the zero ([#109](https://github.com/hawkins48b/cw-zro/issues/109), owner decision of 2026-11-11). The zero is a whole unit: the one under the crossing if the shot zeroed there keeps its apex inside the zone, else the one above. A further near zero gives a lower arc. Since the solver zeroes on the distance ([#77](https://github.com/hawkins48b/cw-zro/issues/77)), the unit under fits only when the crossing is on a whole unit, so the unit above is the usual answer. On 2.2, which zeroed about 0.1 yd past the distance, the unit under often fitted.
3. It zeroes the shot there and reads every returned value from that shot.

| Property | Value |
|----------|-------|
| Zero | Always the near crossing, so `optimalZero` equals `nearZero`. A crossing under 1 unit gives a zero of 1 |
| Against a walk over whole near zeros | Same `mpbrMax`, within 0.1 (tests on 8, 30 and 300 in) |
| Against the best any zero can give | Never more than 0.1 over it. Under it by what one whole unit of near zero costs, see below |
| Rounding | Distances to 0.1 |

One unit of near zero moves the arc far more than one unit of far zero, so a whole unit near zero can leave the apex well under the top of the zone. On js-ballistics 3.1, against near zeros walked in 0.02 unit steps on the four test profiles (measured for #77): at most 2.6 % on 8 in and 20 cm (7.6 yd, the `.308` on 8 in) and 3.3 % on 30 in. `mpbrMax` against the arc that touches the top, measured on js-ballistics 2.2 in the dev container on 2026-11-11 for #109 on the four test profiles, in and cm, sizes 0.001 to 33000:

| Targets | Largest loss |
|---------|--------------|
| The 8 baseline cases (8 in, 20 cm) | 5.9 m, 2.2 % (`.308`, 20 cm) |
| Up to 30 in or 100 cm | 20 yd, 4.0 % (`.308`, 30 in) |
| 100 in to 1000 in | 8.4 % (`.308`, 300 in) |
| Near crossing under 1 unit (about 3000 in and up) | 10 to 27 % |
| A 300 fps load on 8 in | 15 % (3 yd zero, 31.6 yd) |

Before #109 the zero was the far crossing (from [#86](2026-11-05-86-mpbr-search.md)), which lost at most 1 unit. A near zero to 0.1 unit would lose at most about 1 % up to 30 in or 100 cm on the same profiles, measured but not implemented.

There is no near crossing when the sight height is 0 or less: the bullet starts on or over the line of sight. MPBR then gives no result.

**"Set zero to N" (MPBR page, "Use this zero in your profile") saves the near crossing as the zero**, and only the zero distance and its unit (#110; the page shows the zero before and after and stays open since #166): 22 yd for an 8 in target on the `.308` test profile, which comes back down through the line of sight at 240 yd (21 yd and 249 yd on js-ballistics 2.2).

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

The limits were set by the owner on 2026-11-10 ([#89](https://github.com/hawkins48b/cw-zro/issues/89), [#90](https://github.com/hawkins48b/cw-zro/issues/90), [#91](https://github.com/hawkins48b/cw-zro/issues/91), [#92](https://github.com/hawkins48b/cw-zro/issues/92), [#93](https://github.com/hawkins48b/cw-zro/issues/93), [#114](https://github.com/hawkins48b/cw-zro/issues/114), [#119](https://github.com/hawkins48b/cw-zro/issues/119), [#125](https://github.com/hawkins48b/cw-zro/issues/125)), and the highest BC on 2026-11-15 ([#147](https://github.com/hawkins48b/cw-zro/issues/147)). They live in [`inputLimits.js`](../src/lib/utils/inputLimits.js) and [`zeroDistance.js`](../src/lib/utils/zeroDistance.js), and the form and every path read them from there. Measured on f40933f before the change, 3888 worst-case combinations inside them (G1 and G7, BC 0.01 to 2, 60 to 9999 fps, sight height -10 to 10 in, zero 1 to 3000, both ends of temperature and pressure, no wind and 223 mph at 0° and 90°, the engine's angles) gave no hang through `calculateShotPoint` and `calculateFullTrajectory`. The slowest took 2.2 s, on a 3000 zero. The dope cards, MPBR and validation were not part of that run.

**Rechecked on js-ballistics 3.1.0 with RK4 for [#77](https://github.com/hawkins48b/cw-zro/issues/77)**, each case in a worker stopped after 20 or 30 s:

- Inside the limits, 4992 cases gave no hang: the load corners (G1 and G7, BC 0.01 and 2, 60 and 9999 fps, sight height -10 and 10 in, zero 1 and 3000) on the standard atmosphere and 24 custom corners (-130 and 158 °F, 8.86 and 35.4 inHg, -3281, 0 and 32808 ft, 0 and 100 %), no wind and 223 mph at 0° and 90°, range 3000 yd, through `calculateShotPoint` and `calculateFullTrajectory`; plus MPBR on 0.1 to 33000 in and validation on the load corners. The slowest took 1.0 s, an MPBR on a 33000 in target.
- The dope cards, for the first time: 576 cases through both card generators with the real templates (G1 and G7, BC 0.01, 0.3 and 2, 60, 2650 and 9999 fps, sight height -10, 0, 1.5 and 10 in, zeros of 1, 100 and 3000 yd and 3000 m). No hang; the slowest took 0.17 s. 271 gave a card, 305 "Cannot compute".
- Outside the guards, given straight to the engine, these still hang: a NaN velocity, 1e15 fps (new on RK4), a NaN sight height, an infinite or NaN cant (new on 3.1: 2.2 returned a NaN elevation), a NaN wind direction, an infinite wind, 1e140 mph at 45°, -300 °C, a NaN altitude. Each is stopped by a guard below.
- These hung on 2.2 and return on 3.1 with RK4: BC 0.00001, a zero of 0 or 1e-310 (an elevation of 0, an unzeroed barrel), 400000 mph at 90°, and the air below 0 density (10000 m, 70 °C, 100 %, 78 hPa at the site). Their guards stay, as owner decisions, and they still stop meaningless results.
- The same probes on 3.1 with Euler, before the owner chose RK4, gave no hang inside the limits either.

| Limit | Value, in the unit entered |
|-------|----------------------------|
| BC | 0.01 (`MIN_BC`) to 2 (`MAX_BC`), both included, G1 or G7. 2 is the top of the probed range; no real bullet comes near it |
| Muzzle velocity | At least 50 fps, under 10000 fps, also when entered in m/s (15.24 to under 3048 m/s) |
| Sight height | At most 10 in or 25.4 cm either way |
| Range | Above 0, at most 3000 yd or m |
| Zero distance | 1 to 3000 yd or m, after taking its absolute value |
| Air temperature, custom | -90 to 70 °C, or -130 to 158 °F |
| Air pressure, custom | 300 to 1200 hPa, or 8.86 to 35.4 inHg, as entered (sea level). About 78 to 1349 hPa after the altitude correction ([#107](https://github.com/hawkins48b/cw-zro/issues/107)). The Accurate pressure of the Scope View, the Ballistic page and Trajectory Validation (#194) is station pressure, not corrected, so the engine gets 300 to 1200 hPa ([#148](https://github.com/hawkins48b/cw-zro/issues/148), [#172](https://github.com/hawkins48b/cw-zro/issues/172)) |
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
| `calculateShotPoint` | Cant finite (`Number.isFinite`), checked before the zero solve. On 3.1 an infinite or NaN cant hangs the solve ([#77](https://github.com/hawkins48b/cw-zro/issues/77)). The Scope View only passes a stored rotation within ±90° (`storedRotation`) | No result |
| `calculateShotPoint`, `calculateFullTrajectory` | Range within the limit. Step at least 1, 25 when empty, and at most the range: a larger or infinite step is read as the range (full trajectory, `tableStep`, [#133](https://github.com/hawkins48b/cw-zro/issues/133)) | No result |
| Ballistic page, step | At least 1 and at most the range, at least 1 for a range under 1 (`tableStepLimit`). Text and NaN count as under 1, an infinite step as over the range ([#130](https://github.com/hawkins48b/cw-zro/issues/130), [#133](https://github.com/hawkins48b/cw-zro/issues/133)) | A message under the box. The table uses `tableStep`: 1, or the range |
| All six paths | BC from 0.01 to 2 (`isUsableBc`) | No result. A dope card is not saved |
| All six paths | Entered velocity finite and under 10000 fps, and velocity at the current temperature finite, at least 50 and under 10000 fps (`hasFlyableVelocity`). MPBR and the mid-range dope cards use no powder sensitivity. The precision card checks the reference and each pressure and temperature column; a column whose velocity cannot be flown prints a dash | No result. A dope card is not saved |
| All six paths | Optic height finite and within 10 in or 25.4 cm either way (`isUsableSightHeight`) | No result. A dope card is not saved |
| All six paths | Bullet weight and diameter within the limits above (`hasUsableBullet`) ([#125](https://github.com/hawkins48b/cw-zro/issues/125)) | No result. A dope card is not saved |
| Shot point, full trajectory, MPBR, spin drift on | Twist, taken either way, and length within the limits above when they are set (`hasUsableBullet`). Empty, they are not passed to the engine (no twist, 2 in length), as before. The dope cards never use spin drift and do not check them | No result |
| Shot point, full trajectory, dope cards | Zero distance 1 to 3000 (`isUsableZeroDistance`) | No result. A dope card is not saved |
| Shot point, full trajectory, MPBR, dope cards | Finite barrel elevation after the zero solve, before any shot (`hasFiniteElevation`). It only rejects NaN and Infinity, so it changes no result. It does not stop every hang: a NaN that appears during the flight solves to a finite elevation, usually 0. On 3.1 no input inside the other guards was found that makes the solve return NaN | No result. A dope card is not saved |
| Shot point, full trajectory, custom atmosphere | Values within the limits above, altitude included (`isUsableAtmosphere`) | No result, and a message under the box |
| Shot point, full trajectory, custom atmosphere | Air density above 0 after the altitude correction (`hasPositiveDensity`, [#107](https://github.com/hawkins48b/cw-zro/issues/107), approved by the owner on 2026-11-10). The library's density goes below 0 when the water vapour pressure is far above the air pressure: at 10000 m, 70 °C and 100 % humidity, a sea-level pressure of 300 to about 453 hPa (118 hPa at the site). At 60 °C it would need under 290 hPa, so at 60 °C or below it cannot happen inside the limits. 300 hPa ran for more than 5 minutes on a G7 BC 0.01, 9999 fps, 3000 yd zero | No result, and "This air is too thin and humid to calculate" under the pressure box (`hasNoAirDensity`) |
| Ballistic, scope view and trajectory validation pages, custom atmosphere | The engine ended the flight at its minimum altitude of -1410.748 ft, as it reports it: `fire` throws the library's `RangeError` with `MinimumAltitudeReached`, or the zero solve fails and the flight it started from ends there ([`flightStop.js`](../src/lib/utils/flightStop.js), [#125](https://github.com/hawkins48b/cw-zro/issues/125), [#126](https://github.com/hawkins48b/cw-zro/issues/126)). No result changes | No result, as before, and "altitude too low for this shot" under the altitude box. Validation returns `minimum_altitude` |
| Scope View, every atmosphere mode | ISA at an altitude other than 0, Estimate and Accurate all pass a custom atmosphere, so the three custom atmosphere rows above apply: limits, density (checked on the air actually used: Station pressure as entered, Estimate humidity) and the minimum altitude stop, which Accurate no longer reaches (its fixed engine altitude, #172). ISA and Estimate pass 1013.25 hPa, so only their altitude and the Estimate temperature can be out of limits. An ISA altitude out of its limits is passed as entered, so the guard rejects it ([#148](https://github.com/hawkins48b/cw-zro/issues/148)) | No result, and a message under the box |
| Ballistic page | Range above 0 and at most 3000 (`isUsableBallisticRange`). A negative range gives no result here, as on the compare page ([#122](https://github.com/hawkins48b/cw-zro/issues/122)) | No result, and a message under the box |
| Scope view, angle in cos | Cosine finite, above 0 and at most 1 (`isUsableScopeAngle`). Empty is flat ([#121](https://github.com/hawkins48b/cw-zro/issues/121)) | No result, and a message under the box |
| Scope view, angle in degrees | Angle finite and strictly between -90° and 90° (`isUsableScopeAngle`). Text that is not a number is rejected. Empty is flat ([#129](https://github.com/hawkins48b/cw-zro/issues/129)) | No result, and a message under the box |
| Ballistic page, angle (full trajectory with `options.elevation`) | The Scope View's two rows above, and a cosine of at least `MIN_TABLE_COSINE`, 1e-6 (`isUsableTableAngle`, [#173](https://github.com/hawkins48b/cw-zro/issues/173)). Empty, 0°, a cosine of 1 or no angle is the flat table | No result, and a message under the box |
| Shot point, full trajectory, wind speed above 0 (`shotWinds`) | Speed at most 100 m/s, about 224 mph, in either unit. Direction a number or text that reads as a number, at most 1e6 degrees either way, so a negative angle is valid; the limit applies to the angle entered, before the half turn of #106, and the engine then gets an angle in [0, 360). An empty or whitespace text counts as 0°, a headwind. Null, a missing value, an object or a boolean is not empty | No result |
| Shot point, full trajectory, stored wind speed that is an array, object or boolean (`shotWinds`) | Rejected, because the page can still show it as a speed | No result |
| Shot point, full trajectory, wind speed empty, text, 0, negative, null or missing (`shotWinds`) | No wind is used, so the direction is not checked | Normal result without wind |
| Compare trajectories | Same zero rule on each entry's field. Range within the limit | Message under the field, and the entry leaves the chart |
| Compare trajectories | A usable zero whose trajectory gives no result ([#114](https://github.com/hawkins48b/cw-zro/issues/114)) | Message under the field, and the entry leaves the chart |
| Dope cards | Any of the four card trajectories gives no result, for any reason. `generateImperialDopeCard` and `generateMetricDopeCard` return null | The page shows "Cannot compute" and saves no PDF ([#91](https://github.com/hawkins48b/cw-zro/issues/91)) |
| Dope cards | Building or saving the PDF throws, for example when the template cannot be fetched (`downloadDopeCard` returns `'failed'`) | The page shows that the PDF could not be created or saved, not "Cannot compute" ([#123](https://github.com/hawkins48b/cw-zro/issues/123)) |
| `calculateMPBR` | Barrel elevation up to 0.5 rad, flight up to 20000 units, at most 54 fires and 2 zero solves (each up to 60 iterations, run twice when the first start fails) | No result. A shot reaching the limit is never reported as a capped distance |
| MPBR page | A suggested zero above 3000. Since #109 the zero is a near crossing, at most 111 units on the measured cases, so this no longer happens on them | Shown, but not offered for saving, with a message |
| `calculateTrajectoryValidation` | Range at least 100 and at most 3000, beyond the zero, value not 0, velocity and BC above 0 | No result, or an error message for the range |
| `calculateTrajectoryValidation` | Velocity between 0 and 10000 in the profile's unit, BC between 0.01 and 2 (`MIN_BC`, `MAX_BC`), both ends excluded: a profile BC of exactly 0.01 or 2 gives no solution when solving for BC. Each shot goes through `calculateShotPoint`, so its limits apply too | Shot skipped |
| `calculateTrajectoryValidation` | At most 200 shots and 5 seconds, checked before each shot | No solution, or a timeout message when time ended a search that could still move |
| Dope card zero search | Zero elevation at most 0.6 rad | Near and far stay blank |
| Precision dope card (`computePrecisionCard`) | Requirements first (`precisionCardRequirements`): zero exactly 100 m or 100 yd, reticle `mrad`, `mil-dot` or `moa`, both click units MOA or MRAD with a value above 0. Options: maximum distance a finite number from 100 to 3000 (`isUsableMaxDistance`), correction `clicks` or `angle`, units `metric`, `imperial` or one unit per quantity (`precisionUnits`, #160: a plain object with exactly the own keys `wind`, `pressure`, `temperature`, each a known unit; an array, an inherited key or unit name such as `toString`, an extra key or a getter that throws gives null). Then the guards of the other paths: zero, sight height, weight and diameter, BC, velocity at the reference temperature, finite elevation after the zero solve. Twist and length go to the engine only when both are set and within their limits; otherwise no twist and a 2 in length, and the card prints no spin drift. No flight goes past 3000 units | No card: `generatePrecisionDopeCard` returns null and nothing is fetched |

Saved profiles are read through the same guards on every path, so a stored `Infinity`, hex or out-of-limit value in a field with a limit gives no result instead of freezing a page. Since [#125](https://github.com/hawkins48b/cw-zro/issues/125) this also covers weight, diameter, twist, length and altitude: a stored `Infinity` or `0x10` there gives no result (`0x10` reads as 0, below every lower limit).

**Remaining gaps.** These are known and not fixed:

- The powder sensitivity temperature and modifier only have to be finite in the form. The velocity they give is checked.
- The pressure correction for altitude ([#107](https://github.com/hawkins48b/cw-zro/issues/107)) gives the engine pressures down to 78 hPa. Probed on this branch with the engine in a worker and a 30 s limit: 2048 corners (G1 and G7, BC 0.01 and 2, 60 and 9999 fps, sight height ±10 in, zero 1 and 3000, altitude -1000 and 10000 m with 300 and 1200 hPa, -90 and 70 °C, 0 and 100 % humidity, no wind and 100 m/s at 90° in the engine's angle, shot point and full trajectory, range 3000 yd), and 480 cases at 10000 m from 300 to 1200 hPa. Without the density guard, 4 corners ran past 30 s, all at 10000 m, 300 hPa, 70 °C, 100 %. With it, none did. The slowest took 0.9 s alone. That probe ran on js-ballistics 2.2; on 3.1 only the worst corner was rechecked, and it returned. A density just above 0 is not proven safe for every combination. Readings that are physically impossible (water vapour pressure above the air pressure, as at 70 °C below about 312 hPa) still give a result when the density stays above 0.
- A Scope View Station pressure reaches the engine uncorrected, 300 to 1200 hPa at any altitude from -1000 to 10000 m ([#148](https://github.com/hawkins48b/cw-zro/issues/148)). Hang probe of Station extremes (2026-11-16, js-ballistics 3.1.0): the 48 corner combinations of 300 and 1200 hPa, -90 and 70 °C, -1000 and 10000 m, at 100 and 3000 m, with a 20 m/s crosswind and humidity 100 %, on `P223_G1`, `P308_G1` and `P338_G7_METRIC`, each run in its own Vitest process under a 60 s kill timeout; none hung, the slowest took 32 ms, 26 gave a result and 22 none. Values between the corners were not probed. For #172 (2026-11-17), Accurate at its fixed engine altitude of 5000 m: the 24 corners of 300 and 1200 hPa, -90 and 70 °C, 0 and 100 %, at 100 and 3000 m, with a 20 m/s crosswind, on the same three loads, through `calculateShotPoint` and `calculateFullTrajectory`, in one Vitest process under a 120 s kill timeout: none hung, the slowest pair took 40 ms, 46 of 48 shot points gave a result.
- The low end of the altitude limits gives no result, because the engine ends every flight below -1410.748 ft. The pages with a custom atmosphere say so. With the standard atmosphere (compare, MPBR, dope cards, and the other pages with "use ISA" on) a flight that drops 1410 ft below the muzzle ends the same way, and shows only the general no-result text.
- In trajectory validation, only the profile's own first shot is checked for that stop. A later shot of the search that ends there counts as a failed shot, and can end in "no solution".
- The hangs measured near the limits needed a sight height about as large as the zero distance or larger (20 in with a 0.5 zero, 10 in with a 0.2 zero), which the limits rule out; on 3.1 those two cases end at the minimum altitude instead. No proof covers every combination inside the limits. The dope cards were first probed on 3.1 (576 corners).
- The engine is compiled WebAssembly (bclibc). Its loop cannot be read in this repository, only probed; the probes above are the evidence.
- The engine loads with a top-level `await` and `WebAssembly.instantiate`. Browsers or WebViews without both (Chrome before 89, Safari before 15) cannot run any calculation. Not tested on a device.
- A zero near 1 on a slow or low-BC load can still give no result. The compare page says so, the other pages show their no-result message.
- The time budget of the validation search is checked between shots. It cannot stop one slow shot.
- An MPBR calculation has no time limit, because it runs only from a button. It can take seconds on absurd input.

A hang freezes that tab or window. It does not affect other users, because everything runs on the device.

## Precision dope card

The precision dope card ("Abaque de précision", [#157](https://github.com/hawkins48b/cw-zro/issues/157), owner decisions of 2026-11-17) has one A6 page per 100 m or yd, from 100 to the maximum distance (100 to 3000), between a cover and a click worksheet. [`computePrecisionCard`](../src/lib/utils/precisionCard.js) computes it; [`precisionCardPdf.js`](../src/lib/utils/precisionCardPdf.js) prints it. It only takes a profile zeroed at exactly 100 m or 100 yd, with an `mrad`, `mil-dot` (both MRAD) or `moa` reticle and MOA or MRAD clicks. Distances and the steps of ② follow the zero's unit; the `units` option only picks the pressure, temperature and wind columns.

**Units** ([#160](https://github.com/hawkins48b/cw-zro/issues/160), owner request of 2026-11-17). `units` is one unit per quantity, `{ wind: 'mps'|'mph', pressure: 'hpa'|'inhg', temperature: 'c'|'f' }`, or the preset name `'metric'` (`mps`, `hpa`, `c`) or `'imperial'` (`mph`, `inhg`, `f`). Each table is fired in its own unit, whatever the other two are: a card with mph rings, hPa and °F has the wind of the imperial card and the pressure of the metric card. The reference atmosphere is the same for every choice. The presets give exactly the cards of #157 to #159: before the change, 76 cards (the sample with and without powder sensitivity, the sample zeroed in yd, and each fixture profile zeroed at 100 with MRAD and with MOA clicks; metric and imperial; clicks and angle; to 1500) were saved, and after it the same cards from the preset names and from their unit objects were identical, byte for byte as JSON. `precisionUnits` in [`precisionCardFormat.js`](../src/lib/utils/precisionCardFormat.js) reads the option: anything but a preset name or a plain object with exactly the own keys `wind`, `pressure` and `temperature`, each a known unit, gives no card.

**Reference and zero.** The rifle is zeroed once, at 100, in the ICAO standard atmosphere: altitude 0, 1013.25 hPa (29.92 inHg), 15 °C (59 °F), humidity 0, which is `new Atmo()` in js-ballistics 3.1. Every pressure, temperature and wind column fires with that same zero elevation: only the air or the wind changes. This differs from every other calculator, which solves the zero again in each atmosphere (see [Zero](#zero)), and is what the card is for: what a rifle zeroed in standard air needs in other air.

| Column | Values | Fired at |
|--------|--------|----------|
| ③ Pressure, `hpa` | 1000, 950, 900, 850, 800, 750 hPa | 15 °C, altitude 0 |
| ③ Pressure, `inhg` | 29.5, 28.0, 26.5, 25.0, 23.5, 22.0 inHg | 15 °C (59 °F), altitude 0 |
| ④ Temperature, `c` | +45, +35, +25, +15, +5, -5, -15, -25 °C | 1013.25 hPa |
| ④ Temperature, `f` | +110, +90, +70, +50, +30, +10, -10 °F | 1013.25 hPa |
| ⑥ Wind rings, `mps` | 2, 4, 6, 8 m/s | Reference air |
| ⑥ Wind rings, `mph` | 5, 10, 15, 20 mph | Reference air |

The pressure is passed to `Atmo` as the pressure of the air at altitude 0, so a column is a station pressure, not a QNH to be corrected for altitude. **Powder sensitivity** is applied as on the Scope View (`powderSensitivity`, the profile's switch, temperature and modifier): the powder is at the air temperature, so the temperature columns include the change of muzzle velocity, and the reference uses the velocity at 15 °C. A column whose velocity at its temperature cannot be flown (`hasFlyableVelocity`) prints a dash.

**Values per page** (distance D):

| Item | What | Rounding |
|------|------|----------|
| ① Elevation | To dial up at D (a bullet below the line of sight is up) | Clicks as the Scope View counts them ([`clicks.js`](../src/lib/utils/clicks.js)): the angle rounded to 0.1 in the click unit, then divided by the click value and rounded to a whole click |
| ② D+25, D+50, D+75 | Count at D+x minus count at D, so ① + ② is the count at D+x | As ① |
| ③ ④ | (angle in that air - angle in the reference air) / click, signed like ①: thinner or warmer air gives fewer clicks, so negative | The angle difference is rounded, never a difference of rounded counts |
| ⑤ Spin drift | The windage of the reference shot without wind, and the direction to dial, opposite to the drift: a right-hand twist drifts right, so dial left | As ① (Scope View count), on the windage turret |
| ⑤ Time of flight | Of the reference shot at D | 0.01 s |
| ⑥ Wind | A full crosswind (engine angle 90°) at the ring speed, minus the windage without wind (the spin drift), as a magnitude, at III (90°). Each ray of the dial, every 15° ([#159](https://github.com/hawkins48b/cw-zro/issues/159)), prints it times the sine of its angle (`windFactor`, `Math.sin`): 15° × 0.259, 30° (I) × 0.5, 45° × 0.707, 60° (II) × 0.866, 75° × 0.966, 90° (III) × 1 | Each product rounded to a whole click on the windage turret |
| Footer | One elevation click as a size at D: click angle (rad) × D | 0.1 cm (m) or 0.1 in (yd) |

In `angle` mode every value is in the reticle's unit (MRAD or MOA) instead, rounded to 0.1 by the same rules. Elevation values use the elevation turret's click value and unit, windage values the windage turret's. A half rounds away from zero.

**Wind rays** ([#159](https://github.com/hawkins48b/cw-zro/issues/159), owner decision of 2026-11-17). The factor is the sine of the wind's angle off the line of fire, the usual crosswind share; the card does not model the head or tail part of the wind, which changes the drop slightly. Before #159, II used 0.866; `Math.sin(60°)` is 0.8660254. Across 76 cards (the sample and the fixture profiles, MOA and MRAD, clicks and angle, metric and imperial, to 3000) that moved 14 of 8800 II values by one click or 0.1, all at 1100 or beyond; none of the sample's. The 30° and 90° values did not change.

**Spin drift** uses the profile's twist and bullet length whatever the spin drift switch says, when both are set and within their limits (a negative twist is a left-hand barrel). Without them the engine gets no twist and the card prints a dash. The drift is the library's empirical formula (see [Spin drift](#spin-drift)); it has no independent check. Only the reference shot's spin drift is printed: its change with pressure and temperature is not.

**Flight limits.** The reference shot fires every 25 units to the last page + 75, never past 3000 (the range limit of every calculator, so the 3000 page has no ②). Where the engine ends a flight (minimum velocity, maximum drop or minimum altitude, its `RangeError`), the rows up to there are kept: no page for a distance the reference flight does not reach, a dash for an extra distance past it, and a dash in a column whose own flight ended before D. No card when not even the 100 page exists.

**Owner's sample.** At 700 m the card gives the values on the design (6.5 Creedmoor 140 gr, G7 0.326, 820 m/s, sight height 4.5 cm, twist 1:8" right, length 1.37 in, 0.1 MRAD): +58 clicks; +3, +7, +10; pressure 0, -1, -3, -4, -5, -6; temperature -2, -1, -1, 0, +1, +1, +2, +3; spin drift left 1; 1.07 s; wind I (30°) 3, 6, 9, 12, II (60°) 5, 11, 16, 21, III (90°) 6, 12, 18, 24. Since #159 the dial also gives 15° 2, 3, 5, 6; 45° 4, 9, 13, 17; 75° 6, 12, 18, 24. `precisionCard.test.js` pins them. The other printed values (spin drift, pressure and temperature deltas, wind) are new outputs. The owner's approval of them is an acceptance criterion of #157, open when this was written. No check against a published table exists.

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

[`ballistics.published.test.js`](../src/test/ballistics.published.test.js) compares the app with published manufacturer tables. These gaps were measured from the same calculations on js-ballistics 3.1.0 with RK4 for [#77](https://github.com/hawkins48b/cw-zro/issues/77); the 2.2.0-beta.2 figures of 2026-11-05 are in brackets. No expected value or band of that test changed.

**Federal Gold Medal Match GM308M**, .308 Win, 168 gr, G1 0.462, 2650 fps, 200 yd zero, 10 mph crosswind, to 500 yd:

| Series | Largest gap, ICAO atmosphere | Test band | Largest gap, Army Standard Metro | Test band |
|--------|------------------------------|-----------|----------------------------------|-----------|
| Velocity | 12.7 fps (12.6) | 1 % | 1.3 fps (1.5) | 2 fps |
| Energy | 16.7 ft-lb (16.5) | 2 % | 1.9 ft-lb (2.1) | 0.5 % |
| Trajectory | 0.45 in (0.44) | 0.1 in + 1 % | 0.06 in (0.07) | 0.1 in |
| Wind drift | 0.57 in (0.57) | 0.1 in + 3 % | 0.16 in (0.16) | 0.2 in |

**Lapua .223 Rem 55 gr FMJ**, 955 m/s, G1 0.255, velocity only, to 600 m: within 0.4 m/s at 100, 200, 300 and 600 m (also 0.4 m/s on 2.2). The test band is 1 m/s. Confidence in this source is lower, because the figures came through a partly garbled text extraction.

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

**Air density was low until #77.** The 2.2 density formula gave pressure in hPa to terms that expect Pa, so density came out 0.02 to 0.11 % low, with slightly less drop and slightly more velocity. 3.1.0 fixes it. The move to 3.1.0 (owner decision of 2026-11-11) also changed the drag interpolation (PCHIP) and made the zero exact, and the app moved from Euler to RK4, so results moved by more than density:

| Effect of the move to 3.1.0 | Size | Source |
|---------------------------|------|--------|
| Baseline tests, largest | 0.11 in and 0.23 fps (imperial), 0.23 cm (metric, cold air), 1 display step of 0.1 on the scope view (4 of 24 values) | Re-recorded baselines of #77, RK4 |
| Short zeros | The trajectory validation of a 25 yd zero with 3.5 in sight height at 600 yd moved from 3002 to 2995 fps, mostly from the exact zero | #77 |
| MPBR | The `.308` on 8 in: 293.1 to 286.4 yd, zero 21 to 22 yd | #77 |
| Earlier candidate on Euler, for comparison | 0.09 to 0.31 in at 1000 yd, worst 0.77 in and 1.18 fps (`.223`, cold air), scope clicks moved by 1 in about 4 % of tested cases | #77 issue comment, 3.1 on Euler |

**Table and chart rows past the range** (found in the security review of [#94](https://github.com/hawkins48b/cw-zro/issues/94)) are gone with 3.1.0: on a 1000 yd range, `P223_G1` at step 999 now gives the rows 0 and 999, at step 600 the rows 0 and 600, and `P308_G1` at step 999 no chart row past the range. The engine records its flagged rows exactly on the crossing, not on the next integration step. When the step does not divide the range, the table still has no row at the range.

**Integration.** RK4 is not exact either, but its error is far smaller than Euler's at these steps. At 1000 yd on the `.308` test profile with a 10 mph crosswind, the app (RK4, step 0.5) differs from 3.1's Euler at 0.25 ft by 0.13 in of drop, 0.15 fps and 0.04 in of wind drift, and from the 2.2 baseline by 0.02 in, 0.22 fps and 0.02 in.

### Effect of the inputs

These measured figures are the size of the entry errors to expect, at 1000 yd on the `.308` test profile:

| Change | Moves drop by |
|--------|---------------|
| +0.1 % BC | 0.35 in |
| +1 fps muzzle velocity | 0.37 in |

So a small error in velocity or BC is about as large as the known errors above.

## Changing results

The owner must approve any change in calculated results. A failing baseline is a finding to explain, and baselines are never overwritten to pass. See [Testing](testing.md#when-a-baseline-fails).
