# Language kept across restarts, sea-level pressure, and a fuller privacy page

- **Date:** 2026-11-10
- **Branch:** task/96-107-locale-pressure
- **Issues:** [#96](https://github.com/hawkins48b/cw-zro/issues/96), [#102](https://github.com/hawkins48b/cw-zro/issues/102), [#107](https://github.com/hawkins48b/cw-zro/issues/107)
- **Status:** Not in production yet

## Summary

Three issues in one branch.

| Issue | Change |
|-------|--------|
| #96 | The language picked in the language switcher is kept on the device. A start without `/fr` or `/de` in the URL goes to that language. The language cookie is gone |
| #107 | The custom pressure is now the sea-level pressure (QNH) from weather reports. The app corrects it for the site altitude. Air too thin to calculate gives no result and a message |
| #102 | The privacy page says what is stored on the device, what the web host sees, and what works offline, in English, French and German |

## Language choice (#96)

- A click in [`LanguageSwitcher.svelte`](../src/lib/components/LanguageSwitcher.svelte) stores the language in `localStorage` under `zro-locale`, as `en`, `fr` or `de`. English is stored too, so it can be chosen back.
- The `init` hook in [`hooks.client.js`](../src/hooks.client.js) runs before the first render. When the URL has no locale prefix and `zro-locale` holds `fr` or `de`, it calls `location.replace` with the same path, query and hash in that language. No history entry is added.
- A URL with `/fr` or `/de` wins and does not change the stored choice. Any other stored value is ignored.
- The Paraglide strategy in [`vite.config.js`](../vite.config.js) is now `['url', 'baseLocale']` (was `['url', 'cookie', 'baseLocale']`). The same hook deletes the `PARAGLIDE_LOCALE` cookie that earlier versions wrote for 400 days.
- Storage and cookie errors are caught. If storage cannot be written, the choice lasts until the app restarts.

The decision is in `startupLocaleRedirect` in [`storedLocale.js`](../src/lib/utils/storedLocale.js). It returns no redirect when the target has no locale of its own (no loop), or leaves the current protocol and host (see Security review).

## Sea-level pressure (#107)

**Owner decision of 2026-11-10:** the entered pressure is sea-level pressure (QNH). Before, it was passed to the engine as it was, so it had to be the pressure measured at the site, and the altitude did not change the result.

- [`stationPressure()`](../src/lib/utils/stationPressure.js) multiplies the entered value by the ISA ratio for the site altitude, `Atmo.standardPressure(altitude) / 1013.25 hPa`: 1 at 0, about 0.887 at 1000 m, 0.261 at 10000 m. Air temperature does not enter the correction.
- `shotAtmosphere` in [`ballisticCalculator.js`](../src/lib/utils/ballisticCalculator.js) passes that result to `Atmo`. Only the pages with a custom atmosphere (Ballistic, scope view, trajectory validation) are affected; the standard atmosphere is unchanged.
- The limits (300 to 1200 hPa, 8.86 to 35.4 inHg) stay on the value entered. After the correction the engine gets about 78 to 1349 hPa.
- Labels: "Sea-level pressure (QNH)" (fr "Pression au niveau de la mer (QNH)", de "Luftdruck auf Meereshöhe (QNH)"), with the hint "As given in weather reports. The app corrects it for the altitude above." under the box in [`AtmosphereCard.svelte`](../src/lib/components/AtmosphereCard.svelte).

### Air too thin (owner approved)

A probe for hangs found that the library's air density goes below 0 when the water vapour pressure is far above the air pressure. Inside the limits this happens at 10000 m, 70 °C, 100 % humidity and a sea-level pressure of 300 to about 453 hPa. The engine then never slows the bullet and hangs: 4 of 2048 extreme cases ran past 30 s, one for more than 5 minutes.

- `hasPositiveDensity` in [`inputLimits.js`](../src/lib/utils/inputLimits.js) rejects an atmosphere whose density ratio is not finite and above 0. `shotAtmosphere` then returns null, so there is no result.
- `hasNoAirDensity` lets the atmosphere box show `ballistic_air_too_thin`, "This air is too thin and humid to calculate. Check the pressure, temperature and humidity.", in place of the hint. A range error on the pressure takes precedence.
- With the guard, none of the 2048 cases ran past 30 s.

### Baselines and changed results

With the old fixture inputs, 15 baseline cases failed, because the two custom test atmospheres typed a station pressure. The owner chose to convert the fixture pressures to their sea-level equivalent, so no recorded result or tolerance changed:

| Fixture | Before | Now |
|---------|--------|-----|
| `ATMO_HOT_ALTITUDE` (5000 ft) | 24.9 inHg | 29.926153780852953 inHg |
| `ATMO_COLD_METRIC` (1500 m) | 845 hPa | 1012.5788798414616 hPa |

The shifts measured with the old inputs, which show what a user who keeps typing a station pressure now gets:

| Case | Velocity before → now | Drop before → now |
|------|-----------------------|-------------------|
| P223_G1 hot, 1000 yd | 1070.60 → 1244.78 fps | -363.72 → -295.48 in |
| P308_G1 hot, 1000 yd | 1371.14 → 1539.46 fps | -356.16 → -321.88 in |
| P65_G7 hot, 1000 yd | 1651.54 → 1811.90 fps | -290.38 → -269.92 in |
| P338 hot, 1000 yd | 1903.56 → 2065.22 fps | -228.81 → -214.16 in |
| P223_G1 cold metric, 1000 m | 274.35 → 311.37 m/s | -1469.54 → -1148.33 cm |
| P308_G1 cold metric, 1000 m | 358.82 → 410.64 m/s | -1252.37 → -1102.85 cm |
| P65_G7 cold metric, 1000 m | 445.34 → 500.38 m/s | -982.88 → -897.64 cm |
| P338 cold metric, 1000 m | 521.34 → 577.03 m/s | -767.47 → -707.57 cm |

Trajectory validation, old inputs: hot velocity 2464 → 2398, cold BC 0.397 → 0.322.

**Saved pressures change meaning.** A custom pressure saved before this change (`zro-ballistic`, `zro-scope-view`, `zro-traj-validation`) was meant as station pressure and is now read as sea-level pressure. It is not converted. Owner: no migration, say it in the release notes.

## Privacy page (#102)

[`/settings/privacy`](../src/routes/settings/privacy/+page.svelte) was rewritten in en, fr and de. The owner approved the English text. It now has:

- **No data collection:** nothing entered is sent anywhere; no account, analytics or tracking.
- **Stored on your device:** profiles and the active one, the last values of the calculator pages, dark mode, language. They stay until the site data is cleared or the app is uninstalled; not encrypted, synced or backed up. No cookies; the old language cookie is deleted at start.
- **Web host:** the host sees each file request (IP address, files, browser type); what it logs is not known to the app. Desktop and mobile load their files from the device.
- **Offline use:** desktop and mobile work offline. The web version needs a connection to load, and charts and dope cards load extra code when opened.
- **App store analytics:** unchanged.

## Technical changes

| File | Change |
|------|--------|
| [`hooks.client.js`](../src/hooks.client.js) (new) | `init`: deletes the old cookie, redirects to the stored language |
| [`storedLocale.js`](../src/lib/utils/storedLocale.js) (new) | `LOCALE_STORAGE_KEY`, `readStoredLocale`, `storeLocale`, `clearLegacyLocaleCookie`, `startupLocaleRedirect` |
| [`LanguageSwitcher.svelte`](../src/lib/components/LanguageSwitcher.svelte) | `storeLocale(locale)` on click |
| [`vite.config.js`](../vite.config.js) | Paraglide strategy `['url', 'baseLocale']` |
| [`stationPressure.js`](../src/lib/utils/stationPressure.js) (new) | `STANDARD_SEA_LEVEL_HPA`, `stationPressureRatio`, `stationPressure` |
| [`ballisticCalculator.js`](../src/lib/utils/ballisticCalculator.js) | `shotAtmosphere` split into `customAtmo` (limits, station pressure) and the density check. New export `hasNoAirDensity` |
| [`inputLimits.js`](../src/lib/utils/inputLimits.js) | `hasPositiveDensity`. Comments on the pressure limits |
| [`AtmosphereCard.svelte`](../src/lib/components/AtmosphereCard.svelte) | Pressure hint, or the thin-air message |
| [`privacy/+page.svelte`](../src/routes/settings/privacy/+page.svelte) | Three new cards: stored on device, web host, offline use |
| [`fixtures/ballisticProfiles.js`](../src/test/fixtures/ballisticProfiles.js) | Sea-level pressures in the two custom atmospheres |

Messages in `en.json`, `fr.json`, `de.json`: changed `ballistic_pressure`, `scope_view_pressure`, `privacy_no_data_desc`; new `ballistic_pressure_hint`, `ballistic_air_too_thin`, `privacy_storage_*` (7 keys), `privacy_web_title`, `privacy_web_desc`, `privacy_offline_title`, `privacy_offline_desc`.

Guides updated with the change: [architecture.md](architecture.md), [ballistics-model.md](ballistics-model.md), [data-and-privacy.md](data-and-privacy.md), [testing.md](testing.md), [translations.md](translations.md). The "language does not persist" known problem was removed from translations.md.

## Checks

- `npm run test:run`: 2723 passed, 1 todo, 25 files. New: [`stationPressure.test.js`](../src/test/stationPressure.test.js) (19) and [`storedLocale.test.js`](../src/test/storedLocale.test.js) (15), both rerun for this doc: 34 passed.
- `npm run build` and `npm run build:mobile` pass.
- **Not checked on a device or in a browser.** The restart in the chosen language was checked by the tests and the web build only, not in a browser or a running Electron, Android or iOS app. The new labels, hint and messages were not seen on screen.

## Security review

PASS after one round.

- **Medium, fixed:** open redirect at start. A path such as `//evil.example` or `/\evil.example` localized to a protocol-relative address on another host. Not reachable on the web today, but it would be once the SPA fallback of [#67](https://github.com/hawkins48b/cw-zro/issues/67) serves any path. `startupLocaleRedirect` now follows only a target with the same protocol and host (not `.origin`, which is `"null"` for `app://` and `capacitor://`). Tests cover it.
- **Low, addressed:** air too thin gave no result without a message. Now `ballistic_air_too_thin`.
- Pre-existing, not changed: the app sets no Content-Security-Policy.

## Open points

- Saved custom pressures are read as sea-level pressure without conversion. Needs a line in the release notes.
- A density just above 0 is not proven safe for every combination inside the limits, and physically impossible air (water vapour pressure above air pressure) still gives a result while its density stays above 0.
- `scope_view_pressure` was relabelled, but no component uses it: the scope view shows `ballistic_pressure` through `AtmosphereCard`.

## Changelog

- 2026-11-10: initial delivery
