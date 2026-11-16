# MeteoSwiss ICON-CH1 for the current weather in its area

- **Date:** 2026-11-16
- **Branch:** task/154-meteoswiss-icon-ch1
- **Issue:** [#154](https://github.com/hawkins48b/cw-zro/issues/154)
- **Status:** Delivered, not in production yet. Not checked in a browser or on a device

## Summary

The issue asked to use MeteoSwiss's ICON-CH1 model for the current weather fill ([#152](2026-11-16-152-current-weather.md)) where that model has data.

**Delivered.** "Use current weather here" still makes one request to Open-Meteo. It now asks for two models: MeteoSwiss ICON-CH1 first, then Open-Meteo's default ("best match"). Open-Meteo answers with ICON-CH1's values inside that model's area and the default's values elsewhere. The app still fills altitude, pressure (QNH), temperature and humidity the same way.

After a fill with ICON-CH1 values, the attribution line also credits MeteoSwiss:

> Weather data: Open-Meteo.com, Source: MeteoSwiss (ICON-CH1 model)

Elsewhere the line stays "Weather data: Open-Meteo.com". The app makes no request to MeteoSwiss. What is sent is unchanged: latitude and longitude rounded to 2 decimals. The other parameters are fixed, the same for everyone.

## Owner decisions (2026-11-16)

| Topic | Decision |
|-------|----------|
| Source | ICON-CH1 through Open-Meteo, not MeteoSwiss's STAC station data |
| Request | One request: `models=meteoswiss_icon_ch1,best_match`, plus `hourly=temperature_2m,relative_humidity_2m,pressure_msl&forecast_hours=1` |
| Values | From `current`, with the same checks as in #152 |
| Label | From the `hourly` block (`weatherModel`): ICON-CH1 when its three `_meteoswiss_icon_ch1` arrays start with a finite number, else the default |

## Live API check (2026-11-16, 23:00 UTC)

Each point was asked three ways: ICON-CH1 alone, both models, and the default alone. Values are temperature °C / humidity % / `pressure_msl` hPa from `current`.

| Point | ICON-CH1 alone | Both models | Default alone |
|-------|----------------|-------------|---------------|
| Bern 46.95, 7.45 | 8.1 / 88 / 1009.0 | Same as ICON-CH1 | 8.6 / 84 / 1008.8 |
| Turin 45.07, 7.69 | 4.0 / 100 / 1012.1 | Same as ICON-CH1 | 4.7 / 96 / 1012.7 |
| Paris 48.86, 2.35 | 11.6 / 95 / 998.8 | Same as ICON-CH1 | 11.8 / 94 / 999.4 |
| Marseille 43.30, 5.37 | 14.0 / 86 / 1012.8 | Same as ICON-CH1 | 14.6 / 80 / 1013.1 |
| Vienna 48.21, 16.37 | 6.6 / 75 / 1008.4 | Same as ICON-CH1 | 4.0 / 85 / 1008.4 |
| Berlin 52.52, 13.40 | "No data is available for this location" | 7.9 / 73 / 999.9, the default | 7.9 / 73 / 999.9 |
| London 51.51, -0.13 | No data | 5.0 / 86 / 995.6, the default | Same |
| Rome 41.90, 12.50 | No data | 14.1 / 90 / 1015.2, the default | Same |
| New York 40.71, -74.01 | No data | 8.8 / 50 / 1028.8, the default | Same |

- With both models, `current` has plain keys (`temperature_2m`, ...). Their values equal ICON-CH1 alone inside the area and the default alone outside it.
- With both models, `hourly` for Bern has `temperature_2m_meteoswiss_icon_ch1` and `temperature_2m_best_match`. For Berlin it has a plain `temperature_2m`. This is what `weatherModel` reads.
- An ICON-CH1-only request outside the area answers HTTP 400. The app never sends one.
- The area reaches beyond Switzerland: Paris, Marseille and Vienna got ICON-CH1 values. "Switzerland and around it" in the privacy text and guides is approximate.

## Credit

MeteoSwiss's [terms of use](https://opendatadocs.meteoswiss.ch/general/terms-of-use) (read on 2026-11-16):

- the source must be credited (art. 5 para. 1 let. a MetO),
- the data is under CC BY 4.0,
- the credit must not suggest that MeteoSwiss endorses the user.

The card's wording follows that:

| Language | Text |
|----------|------|
| en | Source: MeteoSwiss (ICON-CH1 model) |
| fr | Source : MétéoSuisse (modèle ICON-CH1) |
| de | Quelle: MeteoSchweiz (Modell ICON-CH1) |

It links to `https://www.meteoswiss.admin.ch/` in a new tab (`target="_blank"`, `rel="noopener noreferrer"`), with the screen reader text "(opens in a new window)".

## Release notes

- In Switzerland and around it, "Use current weather here" now uses MeteoSwiss's ICON-CH1 model, through Open-Meteo. Elsewhere nothing changes.
- After such a fill the card credits "Source: MeteoSwiss (ICON-CH1 model)" with a link.
- What is sent is unchanged. The privacy page names the model.

## How to use

Same as [#152](2026-11-16-152-current-weather.md#how-to-use): `/scope-view` or `/calculators/ballistic`, Accurate atmosphere, **Use current weather here**. Nothing to choose: the model depends on the location. No account or role.

## Technical changes

- [`src/lib/utils/currentWeather.js`](../src/lib/utils/currentWeather.js):
  - new constants `WEATHER_MODELS` (`meteoswiss_icon_ch1,best_match`), `ICON_CH1`, `BEST_MATCH`;
  - `weatherUrl` adds `hourly=<the three fields>`, `models=...` and `forecast_hours=1` after `current`;
  - new `weatherModel(json)`: `meteoswiss_icon_ch1` when `temperature_2m_meteoswiss_icon_ch1`, `relative_humidity_2m_meteoswiss_icon_ch1` and `pressure_msl_meteoswiss_icon_ch1` are arrays whose first value is a finite number, else `best_match`. It never throws;
  - `readCurrentWeather` returns `model` too. `readWeather` is unchanged: values still come from `current`;
  - `createWeatherFill` puts `model` in the `done` status. Anything other than `meteoswiss_icon_ch1` becomes `best_match`.
- [`ScopeAtmosphereCard.svelte`](../src/lib/components/ScopeAtmosphereCard.svelte): `weatherStatus.model`; when it is `meteoswiss_icon_ch1`, a second link after Open-Meteo.com.
- Error answers: an HTTP 400 is `network`, an error body with HTTP 200 is `invalid`. In both cases nothing is written, as in #152.
- Messages: new `scope_view_current_weather_model_icon_ch1`; `privacy_weather_desc` gains one sentence on the model. 535 keys per language. Written by the developer in en, fr and de; no native speaker review.
- Guides updated with the change: [`architecture.md`](architecture.md#current-weather), [`data-and-privacy.md`](data-and-privacy.md) (the request, a Model row, the licence row, a meteoswiss.admin.ch link row), [`testing.md`](testing.md).
- CSP unchanged: the only request still goes to `api.open-meteo.com`. Stores unchanged: the model is not stored.

## Tests

| File | Before | After | New |
|------|--------|-------|-----|
| [`currentWeather.test.js`](../src/test/currentWeather.test.js) | 54 | 63 | The URL's fixed parameters; `weatherModel` on Bern- and Berlin-shaped answers, on a missing, null, odd or non-finite `hourly` block, and with only some ICON-CH1 arrays; values read from `current` whatever the model; an error answer fails (`invalid` with 200, `network` with 400); the model in the `done` status |
| [`currentWeather.svelte.test.js`](../src/test/currentWeather.svelte.test.js) | 19 | 28 | The credit shows only after an ICON-CH1 fill. On both pages: the exact request URL, Bern credits MeteoSwiss, Berlin names only Open-Meteo, odd ICON-CH1 hourly values still fill as the default, an error answer leaves the boxes unchanged |

`npm run test:run`: 4403 passed, 1 todo. `npm run build` succeeds. No baseline changed: no ballistic calculation was touched.

## What the owner should test

Nothing was checked in a browser, emulator or device. In a browser, on the Scope View and the Ballistic page, Accurate atmosphere:

1. Fill from a location in Switzerland, or one faked to Bern (DevTools > Sensors). The line reads "Weather data: Open-Meteo.com, Source: MeteoSwiss (ICON-CH1 model)". Both links open in a new tab.
2. Fake Berlin. The line names only Open-Meteo.com.
3. DevTools Network: one request per tap, to `api.open-meteo.com`, with `latitude`, `longitude` (2 decimals), `current`, `hourly`, `models=meteoswiss_icon_ch1,best_match` and `forecast_hours=1`.
4. `/settings/privacy` in en, fr and de: the Current Weather card has the sentence on the ICON-CH1 model.

## Deployment notes

- Nothing to do on the web server.
- The release notes above should go out with the release, since the card shows a new credit.

## Security review

**PASS.** No findings, no pre-existing issues.

- The model label is an inference from the `hourly` block. If Open-Meteo changes its behaviour, only the credit could be wrong, not the filled values: they still come from `current` with the #152 checks.

## Known limitations / follow-ups

- Not checked in a browser, emulator or device: permission prompts, the real request in DevTools and Open-Meteo's CORS answer were not seen.
- The label relies on Open-Meteo giving the same model in `current` as in the first `hourly` hour. The app does not check this per request.
- The ICON-CH1 area is approximate in the texts ("Switzerland and around it"); it reaches at least Paris, Marseille and Vienna.
- The MeteoSwiss link always goes to the English site, whatever the app language.
- Not in production yet.

## Changelog

- 2026-11-16: initial delivery
