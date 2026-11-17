# Current weather at the location

- **Date:** 2026-11-16
- **Branch:** task/152-current-weather
- **Issue:** [#152](https://github.com/hawkins48b/cw-zro/issues/152), part of epic [#153](https://github.com/hawkins48b/cw-zro/issues/153)
- **Status:** Delivered, not in production yet. Not checked in a browser or on a device

## Summary

The issue asked for a way to fill the atmosphere from the current weather at the user's location.

**Delivered.** In the Accurate mode of the atmosphere card, on the Scope View and the Ballistic page, a new button "Use current weather here". On a tap the app:

1. asks the device for its position (the browser or phone shows its permission prompt),
2. sends the latitude and longitude, rounded to 2 decimals (about 1 km), to Open-Meteo,
3. fills altitude, pressure (as QNH), temperature and humidity once, in the units the boxes show.

The user can edit the values after. Nothing is asked or sent before the tap. After a fill the card shows the time and "Weather data: Open-Meteo.com" with a link.

This is the app's first network call that carries user data. The privacy page and [Data and privacy](data-and-privacy.md) say what is sent.

## Owner decisions (2026-11-16)

| Topic | Decision |
|-------|----------|
| Service | Open-Meteo: no key, data under CC BY 4.0, attribution shown after a fill |
| What is sent | Latitude and longitude rounded to 2 decimals, nothing else. One request per tap, no cache |
| Altitude | The device's GPS altitude when it gives one, else Open-Meteo's `elevation` |
| Where | Web and mobile only. Hidden on desktop, where Electron keeps refusing every permission |

## Choices not yet confirmed by the owner

Made during the task (orchestrator and developer). They wait for the owner.

- Pressure is always Open-Meteo's `pressure_msl`, filled as QNH, and the pressure reference is set to QNH. Open-Meteo's `surface_pressure` is for its model ground height, not the GPS altitude, so it is not used.
- The button shows in Accurate mode only.
- German strings use "Sie".
- The attribution shows only after a successful fill.
- A GPS altitude outside the altitude limits (-1000 to 10000 m) falls back to `elevation`.
- An answer whose `current_units` are not Open-Meteo's metric defaults (°C, %, hPa) is rejected as invalid.
- A value outside its box's limits after conversion is rejected as invalid. Nothing is written.
- Waiting for the position is limited to 60 s in total, permission prompt included. The weather request is aborted after 10 s.
- Editing a box while the request runs does not cancel it. The answer then replaces the four boxes.
- The desktop build is detected by its `app:` scheme or `Electron/` in the user agent.
- Vitest is split into two projects, `unit` and `components`.

## Release notes

- New, optional: "Use current weather here" in the Accurate atmosphere of the Scope View and the Ballistic page (web and mobile, not desktop). It fills altitude, pressure, temperature and humidity from the weather at your location.
- It is the first time the app sends user data: on a tap only, your location rounded to about 1 km goes to Open-Meteo. Nothing is sent if you never tap it.
- The privacy page describes this.

## How to use

Open `/scope-view` or `/calculators/ballistic` (also `/fr/...`, `/de/...`). No account or role.

1. In the atmosphere card, choose **Accurate**.
2. Tap **Use current weather here**. Allow the location when the browser or phone asks.
3. The button shows "Getting weather…" while it works. Further taps are ignored.
4. On success: the four boxes are filled, the pressure reference switches to QNH, and a line says when ("Filled from current weather at 14:05") with the Open-Meteo link (new tab).
5. On failure the boxes stay as they were and one message says why:

| Code | When |
|------|------|
| `denied` | Location refused by the user or the platform |
| `unavailable` | No geolocation, no position within the time limit, or a position that is not a coordinate |
| `network` | Request failed, timed out, or answered with an HTTP error |
| `invalid` | Answer not JSON, a value missing, in another unit, or out of the limits |

Changing a box after a fill clears the line. Switching to ISA or Estimate during a request drops it: nothing is written.

## Technical changes

- New [`src/lib/utils/currentWeather.js`](../src/lib/utils/currentWeather.js): `currentPosition`, `weatherUrl`, `fetchWeather` (`credentials: 'omit'`, `referrerPolicy: 'no-referrer'`, `cache: 'no-store'`), `readWeather`, `siteAltitude`, `weatherPatch` (conversion with js-ballistics, rounding: altitude whole, pressure 1 decimal hPa or 2 inHg, temperature 1 decimal, humidity whole), `readCurrentWeather`, `isCurrentWeatherAvailable`, `weatherTime`, `createWeatherFill` (one request at a time, late answers ignored, one `setAtmosphere` call or none), `WeatherError`.
- New [`src/lib/components/currentWeather.svelte.js`](../src/lib/components/currentWeather.svelte.js): `useCurrentWeather(store)`, used by both pages. Status, `request`, an `onchange` that clears the status line, cancel on leaving Accurate, dispose on leaving the page.
- [`ScopeAtmosphereCard.svelte`](../src/lib/components/ScopeAtmosphereCard.svelte): new props `weatherAvailable`, `weatherStatus`, `onweather`; button, error line, attribution, note. The card computes nothing.
- [`scope-view/+page.svelte`](../src/routes/scope-view/+page.svelte) and [`calculators/ballistic/+page.svelte`](../src/routes/calculators/ballistic/+page.svelte): wire `useCurrentWeather`.
- [`settings/privacy/+page.svelte`](../src/routes/settings/privacy/+page.svelte): new "Current Weather (Optional)" card.
- [`vite.config.js`](../vite.config.js): CSP `connect-src` adds `https://api.open-meteo.com` (only that directive). Vitest projects `unit` and `components`; only `components` (`*.svelte.test.js`) resolves with the `browser` condition.
- Messages: 12 new keys (10 `scope_view_current_weather_*`, `privacy_weather_title`, `privacy_weather_desc`), `privacy_no_data_desc` changed. 534 keys per language. Written in en, fr and de by the developer; translator skipped; no native speaker review.
- Guides updated by the developer: [`architecture.md`](architecture.md#current-weather), [`data-and-privacy.md`](data-and-privacy.md), [`development.md`](development.md#location-permission-for-the-current-weather), [`testing.md`](testing.md). Checked against the code for this document.
- Stores unchanged. The filled boxes are saved in `zro-scope-view` or `zro-ballistic` like typed values. No position, answer or time is stored.

## Tests

| File | What |
|------|------|
| [`currentWeather.test.js`](../src/test/currentWeather.test.js) (new, 54) | Rounding, URL content, geolocation options and errors, `fetch` options, HTTP errors, offline, timeout, answer validation, GPS before elevation, conversion and box limits, desktop detection, the fill's one-change-or-none and cancel rules |
| [`currentWeather.svelte.test.js`](../src/test/currentWeather.svelte.test.js) (new, 19) | Card states; both pages mounted in jsdom: no geolocation or `fetch` on load, a click fills the store as QNH, refused location and offline change nothing, no write after leaving the page or the mode, no button on desktop |

`npm run test:run`: 4385 passed, 1 todo, 44 files. `npm run build` and `npm run build:mobile` succeed. No calculated result or baseline changed.

## What the owner should test

Nothing was checked in a browser or on a device. In a browser, on both the Scope View and the Ballistic page:

1. The button shows in Accurate only, not in ISA or Estimate.
2. Allow location: altitude, pressure, temperature and humidity are filled, the reference is QNH, the time line shows, and the Open-Meteo.com link opens in a new tab.
3. Block location: a message says location access is off; the boxes are unchanged.
4. Offline (DevTools): a message says the service could not be reached; the boxes are unchanged.
5. Tap, then switch to Estimate before the answer: nothing is written, no message.
6. DevTools Network: no request to open-meteo before the tap; the request has only `latitude`, `longitude` (2 decimals) and `current` parameters.
7. Privacy page (`/settings/privacy`) in en, fr and de: the new Current Weather card.
8. Desktop app: no button.
9. On Android and iOS, after adding the location permissions by hand (see Deployment notes): the system prompt, then a fill.

## Deployment notes

- Nothing to do on the web server. The release notes above must go out with the release.
- Mobile: the native projects are git-ignored. Add the Android location permissions and the iOS `NSLocationWhenInUseUsageDescription` by hand after `cap add`, as in [development.md](development.md#location-permission-for-the-current-weather). Without them the card reports that location access is off.
- Before a store submission, the owner will likely need to declare approximate location in the Play Store data safety form and the App Store privacy details.

## Security review

**PASS.** Two Low items.

- Low 1, fixed: the browser also sends an `Origin` header (the app's address) to Open-Meteo. The docs and the privacy text now say Open-Meteo sees which site or app made the request.
- Low 2, accepted (informational): Electron shares the web build, so its CSP `connect-src` also allows `api.open-meteo.com`, although the desktop app hides the button and refuses the location.

## Known limitations / follow-ups

- Not checked in a browser, emulator or device. Permission prompts and Open-Meteo's CORS answer were not seen.
- GPS altitude in browsers and Android is usually height above the WGS84 ellipsoid, not above sea level. It can be tens of metres off and is not corrected.
- Android and iOS location permissions are manual steps on the generated projects.
- Store privacy forms are an owner step.
- What Open-Meteo logs and keeps was not checked. Its key-less API is for non-commercial use.
- The unconfirmed choices above wait for the owner.

## Changelog

- 2026-11-16: initial delivery
