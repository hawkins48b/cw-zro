# Data and privacy

ZRO has no backend and no accounts. The app's code sends nothing the user enters anywhere. The one exception is the optional current weather ([#152](https://github.com/hawkins48b/cw-zro/issues/152)): on a tap, it sends the device's position, rounded to about 1 km, to Open-Meteo. This guide says what is stored, where, and what leaves the device, and how each statement was checked.

## What is stored

Data stays in the browser's `localStorage`, or the same store in the Electron and Capacitor web view. It is plain JSON, not encrypted.

| Key | Content | Store |
|-----|---------|-------|
| `zro-profiles` | Profiles: names, rifle and optic names, ammunition, zero, ballistic data, click values. Not written on first launch: since [#150](https://github.com/hawkins48b/cw-zro/issues/150) it appears with the first profile saved (guided setup, sample profile or profile form) | [`profiles`](../src/lib/stores/profiles.svelte.js) |
| `zro-active-profile` | ID of the active profile. Not written on first launch either (#150): it appears when a profile is made active | [`activeProfile`](../src/lib/stores/activeProfile.svelte.js) |
| `zro-ballistic` | Ballistic calculator: range and step, atmosphere (with its mode, weather and pressure reference, #151; filled boxes of the current weather, #152), wind, display options (annotations, table columns, velocity unit, chart shown) | [`ballistic`](../src/lib/stores/ballistic.svelte.js) |
| `zro-scope-view` | Scope view: range, angle, atmosphere (with its mode, weather and pressure reference, #148; filled boxes of the current weather, #152), wind, rotation, Dial or Hold | [`scopeView`](../src/lib/stores/scopeView.svelte.js) |
| `zro-traj-validation` | Trajectory validation inputs | [`trajectoryValidation`](../src/lib/stores/trajectoryValidation.svelte.js) |
| `zro-compare-traj` | Compared profiles, range, chart unit | [`compareTrajectories`](../src/lib/stores/compareTrajectories.svelte.js) |
| `zro-mpbr` | MPBR target size | [`mpbr`](../src/lib/stores/mpbr.svelte.js) |
| `zro-dark-mode` | Dark mode choice, stored only after a change | [`settings`](../src/lib/stores/settings.svelte.js) |
| `zro-locale` | Language picked in the language switcher, `en`, `fr` or `de` as plain text, stored only after a click ([#96](https://github.com/hawkins48b/cw-zro/issues/96)) | [`storedLocale.js`](../src/lib/utils/storedLocale.js), read by [`hooks.client.js`](../src/hooks.client.js) |

These are the only uses of `localStorage` in `src/`, apart from the read in [`theme-init.js`](../static/theme-init.js), loaded by [`app.html`](../src/app.html), that sets dark mode before the first paint. Each stays until the user clears the site data or uninstalls the app. There is no `sessionStorage`, no IndexedDB and no service worker.

**In memory only**, gone on reload: the ammo selection in progress and the profile form draft ([`ammoSelection`](../src/lib/stores/ammoSelection.svelte.js), [`formDraft`](../src/lib/stores/formDraft.svelte.js)).

**No cookie.** Until [#96](https://github.com/hawkins48b/cw-zro/issues/96), Paraglide's runtime wrote `PARAGLIDE_LOCALE`, the language code, for 400 days (max age 34560000 s, path `/`). The `cookie` strategy is gone, so the runtime no longer writes it, and [`hooks.client.js`](../src/hooks.client.js) deletes it at start (`clearLegacyLocaleCookie`). A browser that kept it sends it to the host with the first request after the update, until the app has started once.

### Limits of this storage

- Data lives on one device, in one browser. There is no sync, backup or import of profiles. One profile at a time can be exported as a JSON file ([#149](https://github.com/hawkins48b/cw-zro/issues/149), see below), but the app cannot read it back yet.
- Clearing site data deletes everything. The web, desktop and mobile apps each have their own separate storage.
- A value that is not valid JSON is replaced by the default, so a corrupted store loses its content.
- Anyone with access to the device or browser profile can read it.

## What leaves the device

| Traffic | When | Content | Goes to |
|---------|------|---------|---------|
| Page and code files | Web: opening the app, moving to a page that needs a new chunk | Standard browser request. No cookie, apart from the old locale cookie until it is deleted (see above) | The site's host |
| `/pdf/rifle-dataset-*.pdf`, `/pdf/precision-*.pdf` | Creating a dope card | Fetches the blank template. No profile data is sent | The same origin: the site's host on the web, local files on desktop and mobile |
| `_app/version.json` | When the tab regains focus, and once an hour | Standard browser request. The app does not use the result | The same origin |
| GitHub | Only when the user opens one of the three links on the About page (ZRO, js-ballistics, bclibc) | Opens in a browser | github.com |
| Current weather ([#152](https://github.com/hawkins48b/cw-zro/issues/152)) | Web and mobile only: each tap of "Use current weather here" in the Accurate atmosphere of the Scope View or the Ballistic page, after the user allowed the location. Never on load, never in the background, never on desktop | One `GET https://api.open-meteo.com/v1/forecast?latitude=<lat>&longitude=<lon>&current=temperature_2m,relative_humidity_2m,pressure_msl&hourly=temperature_2m,relative_humidity_2m,pressure_msl&models=meteoswiss_icon_ch1,best_match&forecast_hours=1`, latitude and longitude rounded to 2 decimals; every other parameter is fixed ([#154](https://github.com/hawkins48b/cw-zro/issues/154)). No cookie (`credentials: 'omit'`), no referrer (`referrerPolicy: 'no-referrer'`), no HTTP cache (`cache: 'no-store'`). No profile, no other value, no device altitude. The browser adds its usual headers (user agent, language) and, because the request goes to another site, `Origin`: the app's address (the web site, or `https://localhost` / `capacitor://localhost` on mobile). Open-Meteo sees the IP address | api.open-meteo.com |
| open-meteo.com | Only when the user opens the attribution link shown after a fill | Opens in a browser | open-meteo.com |
| meteoswiss.admin.ch | Only when the user opens the MeteoSwiss link, shown after a fill with ICON-CH1 values ([#154](https://github.com/hawkins48b/cw-zro/issues/154)) | Opens in a browser | www.meteoswiss.admin.ch |

The host sees what any web server sees, such as IP address, requested path and user agent. What it logs and keeps is not in this repository and could not be established.

The ballistic engine (bclibc, WebAssembly, [#77](https://github.com/hawkins48b/cw-zro/issues/77)) is embedded in the app's own code as text and compiled on the device. It is not downloaded from anywhere, and it makes no network call: the module imports nothing from the page.

**Current weather** ([#152](https://github.com/hawkins48b/cw-zro/issues/152), owner decisions of 2026-11-16). The code is in [`currentWeather.js`](../src/lib/utils/currentWeather.js); see [Current weather](architecture.md#current-weather).

| Point | What the code does |
|-------|-------------------|
| When | Only on a tap of the button. The pages load the helper, but it calls neither geolocation nor `fetch` before the tap (tested in `currentWeather.svelte.test.js`). One request per tap; taps while it runs are ignored |
| Location | `navigator.geolocation.getCurrentPosition`, high accuracy, a fix up to 5 minutes old. The exact position stays in memory for the request, then is dropped. It is never stored |
| Sent | Latitude and longitude rounded to 2 decimals: at most about 0.56 km off in latitude, less in longitude away from the equator. Nothing else from the app: the fields, the models and the forecast hours asked for are the same for everyone |
| Model | Since [#154](https://github.com/hawkins48b/cw-zro/issues/154) (owner decision of 2026-11-16): MeteoSwiss ICON-CH1 inside its area (Switzerland and around), Open-Meteo's default models elsewhere, in the same request. MeteoSwiss data reaches the app through Open-Meteo; the app makes no request to MeteoSwiss |
| Altitude | The device's GPS altitude when it gives one, else Open-Meteo's ground elevation of the point. The GPS altitude is not sent. It is usually height above the WGS84 ellipsoid, not above sea level, so it can be tens of metres off; it is not corrected (owner decision) |
| Stored | Only the four filled boxes, with the pressure reference set to QNH, in the page's own key (`zro-scope-view` or `zro-ballistic`), as typed values are. No position, no answer, no time. No cache |
| Failure | Refused location, no fix, no connection, an HTTP error, a 10 s timeout or a bad answer: nothing changes, and a message says why |
| Desktop | The button is hidden (app scheme or Electron user agent), and the desktop app refuses every permission, location included |
| Licence | Open-Meteo's data is under CC BY 4.0. The card shows "Weather data: Open-Meteo.com" with a link after each fill. MeteoSwiss's open data is also under CC BY 4.0, and its [terms of use](https://opendatadocs.meteoswiss.ch/general/terms-of-use) (read on 2026-11-16) require the source to be acknowledged ("Source: MeteoSwiss", "Quelle: MeteoSchweiz", "Source: MétéoSuisse"; art. 5 para. 1 let. a MetO), without suggesting that MeteoSwiss supports the user. After a fill with ICON-CH1 values the card adds ", Source: MeteoSwiss (ICON-CH1 model)" (fr "Source : MétéoSuisse (modèle ICON-CH1)", de "Quelle: MeteoSchweiz (Modell ICON-CH1)"), linked to www.meteoswiss.admin.ch |

What Open-Meteo logs and keeps is in its own terms, not in this repository; it was not checked. Its key-less API is for non-commercial use.

**Generated files** are built on the device. CSV exports, PDF dope cards and profile exports are saved through the normal download. They contain profile names and data, so they go wherever the user sends them.

**Profile export** ([#149](https://github.com/hawkins48b/cw-zro/issues/149)). Export in the profile's menu on the Profiles page saves `zro-profile-<name>.json`, built by [`profileExport.js`](../src/lib/utils/profileExport.js). Nothing is sent: the page makes a `blob:` URL and clicks a download link. The file holds the whole profile as stored (`profiles.get`), its id included, in an envelope:

| Field | Value |
|-------|-------|
| `format` | `"zro-profile"` |
| `version` | `1` |
| `exportedAt` | The time of the export, ISO 8601 in UTC (`null` if the clock gives no valid date) |
| `profile` | The stored profile, every field as stored, damaged values included |

The file name keeps letters (accented ones too), digits, `_` and `-` from the profile name; every other run of characters (spaces, dots, path characters, control and format characters, emoji) becomes one `-`; `-` and `_` are trimmed from the ends, and the name part is cut to 60 characters. A name with nothing left gives `zro-profile.json`. A profile that is missing or not an object gives no file. Not checked on a device: whether the Android and iOS web views save a `blob:` download at all (the same open point as the CSV and the dope cards).

## What does not exist

- No analytics, tracking, advertising or crash reporting
- No remote fonts, images or scripts
- No account, login or server-side storage
- No camera or contacts access in the code. Geolocation only on a tap of "Use current weather here" (#152), on web and mobile; the desktop app hides the button and refuses every permission
- No auto-update in the desktop app (`publish: null`)

## How this was checked

Checked on 2026-11-05 by reading the code:

- **Network:** searched `src/` and `electron/` for `fetch`, `XMLHttpRequest`, `sendBeacon`, `WebSocket`, `EventSource` and URLs. The only `fetch` calls are the two PDF templates.
- **Storage:** searched for `localStorage`, `sessionStorage`, `indexedDB`, `document.cookie`, `caches` and `serviceWorker`, in `src/` and in the generated Paraglide runtime.
- **Build output:** listed every URL in `build/`. They are XML namespaces, library error links, code comments, placeholder hosts for URL parsing, the two GitHub links, and the `pdf-lib` project link. None of those is requested by the code above.
- **Capacitor:** no plugin is imported in `src/`.
- **Rechecked on 2026-11-16** for [#152](https://github.com/hawkins48b/cw-zro/issues/152): searched `src/` for `fetch`, `geolocation`, `XMLHttpRequest`, `sendBeacon`, `WebSocket` and `EventSource`. The new calls are `fetch` and `getCurrentPosition` in `currentWeather.js` only, reached only from the button's handler; the PDF `fetch` calls are unchanged. The built `index.html` of `npm run build` and `npm run build:mobile` has `https://api.open-meteo.com` in `connect-src` only. The specs check the URL holds only the rounded coordinates and the three fields, the `fetch` options, and that opening either page makes no call.
- **Rechecked on 2026-11-12** for [#75](https://github.com/hawkins48b/cw-zro/issues/75), ApexCharts 8.8.1: its chunk has two `fetch` calls, used only to embed fonts in chart exports, which the app never starts (no toolbar), and one new URL, `https://apexcharts.com/pricing`, printed in a console warning only when a paid feature is used. The app uses none. In Chromium, the four chart pages of a production build logged no Content-Security-Policy violation, so no script, style, image, font or `fetch` request went to another host there.
- **Rechecked on 2026-11-10** for [#96](https://github.com/hawkins48b/cw-zro/issues/96) and [#102](https://github.com/hawkins48b/cw-zro/issues/102): the `localStorage` keys in `src/lib/stores/` and `storedLocale.js`, and the generated runtime, where `TREE_SHAKE_COOKIE_STRATEGY_USED` is now `false`, so its cookie code never runs. `document.cookie` is only written by `clearLegacyLocaleCookie`, to delete the old cookie.

**Not checked:**

- Traffic was not captured from a running app, in any target.
- What the Electron runtime, Chromium or the mobile web views do on their own.
- The current weather in a running app: no browser, emulator or device was used for #152, so the permission prompts, the request and the CORS answer of Open-Meteo were not seen. The Android and iOS location permissions must be added to the generated projects by hand ([Mobile build](development.md#location-permission-for-the-current-weather)).
- The generated `android/` and `ios/` projects, which are not in the repository.
- What Google Play or the App Store collect. The privacy page says they may collect usage statistics.

## Offline use

Calculations run on the device. The current weather needs a connection on every target; without one, the boxes stay as they were and the card says the service could not be reached. The web app has no service worker, so it needs a connection to load. Charts and dope cards load code on demand, so they can fail on the web if the connection drops after the first load. The desktop and mobile apps contain their files. The privacy page says this since [#102](https://github.com/hawkins48b/cw-zro/issues/102).

## Security notes

- The web and desktop builds set a Content-Security-Policy that allows scripts, connections and images only from the app itself ([#104](https://github.com/hawkins48b/cw-zro/issues/104)), plus connections to `https://api.open-meteo.com` for the current weather since [#152](https://github.com/hawkins48b/cw-zro/issues/152). Since [#77](https://github.com/hawkins48b/cw-zro/issues/77) its `script-src` also has `'wasm-unsafe-eval'`, so that the embedded WebAssembly engine can be compiled; it does not allow `eval()` (owner decision of 2026-11-12). See [Architecture](architecture.md#content-security-policy). The mobile build sets the same policy since [#135](https://github.com/hawkins48b/cw-zro/issues/135), plus `capacitor://localhost`, the app's origin on iOS. It is not yet checked on a device. What headers the web host adds was not checked.
- The desktop app refuses every permission request (camera, location, notifications, devices).
- The desktop window cannot leave the app, and opens `https:` links only in the system browser. See [Architecture](architecture.md#desktop).
- Saved values are not validated when read, apart from the chart unit of compare trajectories. See [Input guards](ballistics-model.md#input-guards).
- The app's [privacy page](../src/routes/settings/privacy/+page.svelte) lists what is stored, that it stays until the site data is cleared or the app is uninstalled, the web host's view of requests, and the offline limits of the web version ([#102](https://github.com/hawkins48b/cw-zro/issues/102)), and since [#152](https://github.com/hawkins48b/cw-zro/issues/152) what the current weather sends and when. It follows this guide: change both together.

## Licences

ZRO is under the MIT licence ([#110](https://github.com/hawkins48b/cw-zro/issues/110)). Third-party packages keep their own licences.

Since [#77](https://github.com/hawkins48b/cw-zro/issues/77) every build (web, desktop, mobile) ships **bclibc 2.0.0**, the ballistic engine that `js-ballistics` 3.1.0 (ISC) embeds as compiled WebAssembly. bclibc is under the **GNU Lesser General Public License, version 3** (LGPL-3.0); its source is at [ballistics-lab/bclibc](https://github.com/ballistics-lab/bclibc/tree/v2.0.0). The owner accepted that licence on 2026-11-11.

| Where | What |
|-------|------|
| About page | A card "Includes bclibc (LGPL-3.0)", in English, French and German, with a link to the bclibc source and to the licences page |
| `/settings/about/licenses` | The third-party notice and the full LGPL-3.0 and GPL-3.0 texts, shown in the app, so the desktop window never has to leave it |
| `static/licenses/` | `THIRD-PARTY-NOTICES.txt` (bclibc, the link to the ZRO source and how to replace bclibc, since #143), `LGPL-3.0.txt`, `GPL-3.0.txt`, copied into every build under `/licenses/`. The LGPL-3.0 text is identical to the `LICENSE` of bclibc; the LGPL-3.0 incorporates the GPL-3.0, so both are shipped |

`js-ballistics` does not ship a licence notice for bclibc itself; its package declares ISC only.

### App-store builds

Owner decision of 2026-11-15 ([#143](https://github.com/hawkins48b/cw-zro/issues/143)): the notice and the public source are enough. The LGPL-3.0 lets users run ZRO with a modified bclibc. The MIT source of ZRO, public at [hawkins48b/cw-zro](https://github.com/hawkins48b/cw-zro), is the "Corresponding Application Code" of LGPL-3.0 section 4(d)(0): with it, anyone can rebuild the app with their own bclibc. The steps are in [Replacing the bclibc engine](development.md#replacing-the-bclibc-engine), and the notice points to them.

| Store | Required |
|-------|----------|
| Google Play (Android) | The notice (with the links to the ZRO and bclibc source), the licence texts and the in-app licences page, which every build already has |
| App Store (iOS) | The same, plus a custom licence agreement in App Store Connect instead of Apple's standard EULA. The standard EULA adds usage restrictions that the GPL-3.0 (section 10) forbids, and the LGPL-3.0 incorporates the GPL-3.0 |

Not done yet: the text of the iOS licence agreement, an owner step before the first iOS submission. Store builds also still wait for the device check of the mobile Content-Security-Policy ([#135](https://github.com/hawkins48b/cw-zro/issues/135)). The rebuild steps were checked with wasi-sdk only, not with zig or on a device: see the table under [Replacing the bclibc engine](development.md#replacing-the-bclibc-engine).

