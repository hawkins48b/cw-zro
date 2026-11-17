# Atmosphere Accurate mode: station pressure only, no altitude field (#172)

Issue: [#172](https://github.com/hawkins48b/cw-zro/issues/172). Owner request, 2026-11-17: Accurate values come from the weather fill or a Kestrel-type meter, so they are station pressure, and altitude has no effect then.

## What changed

- `ScopeAtmosphereCard.svelte` (Scope View, Ballistic): Accurate shows "Station pressure" (with a hint), temperature and humidity. The QNH / Station chips and the altitude field are gone from Accurate. ISA and Estimate are unchanged and keep altitude.
- `scopeAtmosphere.js`: Accurate always passes `pressureRef: 'station'` and a fixed engine altitude `ACCURATE_ENGINE_ALTITUDE_M = 5000`, not the stored altitude (see below). New `stationPressureBox`, `accurateStationAtmosphere`.
- `storedState.js`: an Accurate state saved with QNH is converted on read to station pressure with its saved altitude (1 decimal hPa, 2 decimals inHg). The pre-#151 Ballistic rule runs first. ISA / Estimate states keep their QNH flag until the user switches to Accurate, then the box is converted with the altitude of that moment. New default states are written with `station`.
- `currentWeather.js`: the request is unchanged (rounded lat/lon, `pressure_msl`). `weatherPatch` converts `pressure_msl` to station pressure at the GPS altitude (else Open-Meteo's elevation) and fills pressure, temperature and humidity only; the altitude box is no longer filled.
- Messages: 5 keys removed (`scope_view_pressure_ref`, `_qnh`, `_station`, `_qnh_hint`, unused `scope_view_pressure`); `scope_view_pressure_label`, `scope_view_pressure_station_hint`, `scope_view_current_weather_note` reworded in en / fr / de (German "Sie").
- Other calculators (dope cards, precision card, MPBR, compare, Trajectory Validation) and Estimate are unchanged; `customAtmo` without `pressureRef` is still QNH.

## Engine altitude in Accurate: 5000 m, not 0

With station pressure the altitude does not change the air: on 8 fixture loads (850 hPa, 10 °C, 50 %, 4 m/s, 100-3000 m, stored altitudes -1000 to 10000 m) the largest drop difference against altitude 0 was 0.0008 cm over 1364 shots. But the engine ends a flight below about -430 m above sea level: at altitude 0, 14 long shots lost their result (.223 from 2700 m, 300 BLK from 2400 m). From about 4142 m the floor is lower than the engine's maximum drop, so 5000 m never stops an Accurate flight. Shots that a low stored altitude used to stop now get a result. Hang probe at 5000 m: 48 extreme cases, slowest 40 ms; security fuzz: 36,864 runs, no hang. Needs owner approval (one constant).

## Saved QNH states: rounding shift

| Saved QNH | Station after conversion | Drop shift |
|---|---|---|
| 1019 hPa at 1234 m | 878.5 hPa | ≤ 0.15 cm (0.001 mil) |
| 30.12 inHg at 4321 ft | 25.70 inHg | ≤ 1.6 cm (0.011 mil) |
| 29.92 inHg at 3000 ft | 26.82 inHg | 1.4 cm |

(.223, .308, .338 up to 1500 m.) Fixture states convert back exactly to their recorded station pressures; their results are identical. One exact test of a pre-#151 Ballistic state is now bounded (< 0.1 in, < 0.02 MOA at 600 yd); no recorded baseline changed. Edge cases: a usable QNH with an unusable altitude reads as an empty box (no result, as before); a conversion outside 300-1200 hPa (QNH 1013 above about 9100 m) loses a result it had.

## Checks

- `npm run test:run`: 4903 passed, 1 todo (after rebase on #171, #173). `npm run build`: pass. New `accurateStation.test.js` (14 tests).
- Security review: PASS (request unchanged, damaged stored values guarded, fuzz with no hang).
- Not checked in a browser.

## Open points (owner)

1. Engine altitude 5000 m (default) or 0.
2. inHg box 2 decimals (as now; the weather fill also writes 2) or 3, which cuts the conversion shift about tenfold.

## For the owner to test

On `/scope-view` and `/calculators/ballistic`: Accurate shows only Station pressure, Temperature, Humidity; ISA / Estimate still show altitude; the weather button fills a pressure below the sea-level value at your altitude and leaves the altitude alone; an old Accurate state (29.92 inHg, 4000 ft, QNH) opens as 25.84 inHg.
