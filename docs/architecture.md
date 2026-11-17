# Architecture

ZRO is a client-only application. Everything runs on the device: there is no backend, no database and no account. One SvelteKit codebase produces three targets from the same `build/` folder.

## Stack

Versions are those locked in `package-lock.json` on `develop`.

| Layer | Technology | Version |
|-------|------------|---------|
| Framework | Svelte (runes) | 5.57.3 |
| Application | SvelteKit, `@sveltejs/adapter-static` | 3.1.1, 4.0.1 |
| Build | Vite | 8.3.6 |
| Language | JavaScript, no TypeScript | |
| UI | Skeleton, Tailwind CSS | 5.0.1, 4.3.4 |
| Icons | `@lucide/svelte` | 1.69.0 |
| Ballistics | `js-ballistics`, pinned by owner decision ([#77](https://github.com/hawkins48b/cw-zro/issues/77)), with its WebAssembly engine bclibc (LGPL-3.0) | 3.1.0 (bclibc 2.0.0) |
| Charts | ApexCharts, lazy-loaded, pinned on an exact version by owner decision ([#75](https://github.com/hawkins48b/cw-zro/issues/75)); licence text checked by a test (#164) | 8.8.1 |
| PDF | `pdf-lib` | 1.17.1 |
| Translations | Paraglide | 3.1.0 |
| Tests | Vitest, jsdom | 5.1.0, 31.0.0 |
| Mobile | Capacitor | 8.6.0 |
| Desktop | Electron, electron-builder | 45.2.3, 26.18.1 |

## Layout

```
src/
├── routes/                  # Pages, see below
├── lib/
│   ├── actions/             # Svelte actions (focusTrap; swipe, unused since #166)
│   ├── assets/              # Favicon
│   ├── components/          # Reusable Svelte components
│   ├── data/ammo.json       # Ammunition library, 41 loads
│   ├── data/licenses.json   # Shipped packages and licences, generated (#166)
│   ├── paraglide/           # Generated, git-ignored
│   ├── stores/              # Reactive state (.svelte.js)
│   ├── themes/zro.css       # Skeleton theme
│   └── utils/               # Calculations and other pure logic
├── test/                    # Vitest tests and fixtures
├── app.css                  # Tailwind and Skeleton, and restored Skeleton defaults
├── app.html                 # HTML shell; static/theme-init.js sets dark mode before the first paint
├── hooks.client.js          # At start, goes to the stored language when the URL has none
├── hooks.js                 # Removes the locale from the URL before routing
└── hooks.server.js          # Paraglide middleware, server side only
electron/                    # Desktop main process, navigation rules, menu, permissions, preload
messages/                    # en.json, fr.json, de.json
project.inlang/              # Paraglide settings
resources/                   # Desktop icons
scripts/                     # Audit check, precision card templates, licence list
static/                      # Copied to build/: logo, PDF templates, robots.txt
```

Configuration is in [`vite.config.js`](../vite.config.js). There is no `svelte.config.js`: the SvelteKit options are passed to `sveltekit({...})` there. `#lib` is an alias defined under `imports` in [`package.json`](../package.json).

## Routes

| Route | Page |
|-------|------|
| `/` | Start page (splash): goes on to `/welcome` when there is no usable profile, else to `/scope-view` ([#150](https://github.com/hawkins48b/cw-zro/issues/150), [`startPath`](../src/lib/utils/firstRun.js)) |
| `/welcome` | First-run Welcome screen, without navigation. Opened while a profile exists, it goes on to `/scope-view` |
| `/setup` | Guided profile setup in three steps, without navigation. Saves through the profile form's validation and builder ([`setupProfileData`](../src/lib/utils/profileValidation.js)); nothing is stored before the last step |
| `/scope-view` | Scope view |
| `/calculators` | Calculator list |
| `/calculators/ballistic` | Trajectory table and charts |
| `/calculators/mpbr` | Maximum point-blank range |
| `/calculators/trajectory-validation` | Velocity or BC from an observation |
| `/calculators/compare-trajectories` | Compare chart |
| `/calculators/compare-trajectories/add` | Choose a profile to compare |
| `/calculators/dope-cards` | PDF cards: the mid-range card (imperial, metric) and the precision dope card generator ([`PrecisionCardGenerator.svelte`](../src/lib/components/PrecisionCardGenerator.svelte), [#157](https://github.com/hawkins48b/cw-zro/issues/157)); both use the profile in use, one `ProfileInUseChip` in the header ([#170](https://github.com/hawkins48b/cw-zro/issues/170)) |
| `/calculators/dope-cards/precision-guide` | How to read the precision dope card (①–⑥, wind quarters, printing) |
| `/profiles` | Profiles: picker list (tap to use), summary of the profile in use, Import, Export all ([#166](2026-11-17-166-profiles-redesign.md)) |
| `/profiles/new`, `/profiles/[id]` | Profile editor in five sections ([`ProfileForm`](../src/lib/components/ProfileForm.svelte)) |
| `/profiles/ammo-selector` | Ammunition library: select, then "Use this ammunition" |
| `/settings` | Settings, General: Display (theme, language), Data, About links, Danger zone with Clear all data ([#166](2026-11-17-166-settings-redesign.md)) |
| `/settings/about` | About: identity, Provided by Chocolate Warfare, This copy, Open source, Calculation engine |
| `/settings/about/licenses` | Licences and notices: licence texts and Included software |
| `/settings/privacy` | Privacy |

`/fr` and `/de` prefix any route. English has no prefix. A start without a prefix goes to the language the user picked last, stored in `localStorage` ([#96](https://github.com/hawkins48b/cw-zro/issues/96)). See [Translations](translations.md#locale-urls).

## Rendering

`ssr` is off in [`+layout.js`](../src/routes/+layout.js) and no page is prerendered, so `build/` holds a single `index.html` fallback plus assets. The browser renders every route. A web host therefore has to send `index.html` for inner URLs, and today nothing in `build/` asks it to. See [Deployment](deployment.md#deep-links-on-the-web-host).

`hooks.server.js` does not run on a static host. The `index.html` in `build/` has `lang="en"`, so the root layout sets `<html lang>` from the locale on the client ([#97](https://github.com/hawkins48b/cw-zro/issues/97)).

## Layers

| Layer | Role | Rule |
|-------|------|------|
| `routes/`, `components/` | Screens | No calculations here |
| `stores/` | Reactive state, saved to `localStorage` | Thin wrappers |
| `utils/` | Calculations and validation | Plain functions, tested without Svelte |

Stores use runes in `.svelte.js` files. [`localStore.svelte.js`](../src/lib/stores/localStore.svelte.js) is the shared helper that reads and writes `localStorage`.

### Stored values

`localStorage` can hold any JSON value, so the stores check each field when they read it, with plain tested functions in `utils/`, and pages only see a usable shape ([#115](https://github.com/hawkins48b/cw-zro/issues/115), [#118](https://github.com/hawkins48b/cw-zro/issues/118), [#120](https://github.com/hawkins48b/cw-zro/issues/120), [#127](https://github.com/hawkins48b/cw-zro/issues/127)). A damaged value must not start giving a result for a value the user did not enter, and what the page shows and the result must agree.

| Store | Read by | A damaged value gives |
|-------|---------|-----------------------|
| Range of Scope View, Ballistic, compare and Trajectory Validation | [`storedRange`](../src/lib/utils/storedState.js) | An empty box: the range message and no result. The unit is `m`, else `yd`. An empty Ballistic step is 25, as its placeholder says; the step only picks the table rows. A step below 1 or above the range is not damaged: the box shows the limit, see [Ballistic table step](#ballistic-table-step) |
| Atmosphere boxes | [`storedAtmosphere`](../src/lib/utils/storedState.js) | An empty box, which is out of its limits: the box's message and no result. A damaged section is a custom atmosphere with empty boxes, not the standard one. `useISA` is on for any truthy value, as before. Fields it does not list, such as `pressureRef`, are dropped. The Scope View and Ballistic readers below start from it |
| Atmosphere of Ballistic | [`storedBallisticAtmosphere`](../src/lib/utils/storedState.js) ([#151](https://github.com/hawkins48b/cw-zro/issues/151)) | As the Scope View below, with two differences for a state without a valid `mode` (saved before #151): with `useISA` on it is read at altitude `0`, since the page used the sea-level standard atmosphere for any such state and only ever saved altitude 0 with it; and its `pressureRef` is read as `qnh`, since the page dropped the field and always used QNH (security review of #151). So every saved result stays the same; the next change writes these values with the mode. A state with a mode keeps its altitude and reference |
| Atmosphere of Scope View | [`storedScopeAtmosphere`](../src/lib/utils/storedState.js) ([#148](https://github.com/hawkins48b/cw-zro/issues/148)) | The boxes as `storedAtmosphere` reads them, plus `mode` (`isa`, `estimate`, `accurate`), `weather` (`cloudy` unless `sunny`, `rain` or `snow`) and `pressureRef` (`qnh` unless `station`). A missing or damaged mode comes from `useISA`: ISA, else Accurate with QNH, which is what the page computed before #148. `useISA` is read back from the mode and still written beside it. Switching modes keeps the boxes ([`patchedAtmosphere`](../src/lib/utils/storedState.js), shared with the Ballistic store). [`scopeAtmosphereParams`](../src/lib/utils/scopeAtmosphere.js) turns it into the calculator's atmosphere, see [Scope View modes](ballistics-model.md#scope-view-modes) |
| Scope View result mode | [`storedResultMode`](../src/lib/utils/storedState.js) ([#148](https://github.com/hawkins48b/cw-zro/issues/148)) | `dial`; only `hold` is kept. It changes no result |
| Scope View angle | [`storedElevation`](../src/lib/utils/storedState.js) | An empty box, a flat shot in either unit, as before. Since #148 the stored angle always applies. The unit is `deg`, else a cosine, as `scopeEffectiveRange` reads it, so a missing unit changes no result. A stored angle at or beyond ±90° is not damaged: the box shows the angle message and there is no result ([#129](https://github.com/hawkins48b/cw-zro/issues/129)) |
| Scope View rotation (cant) | [`storedRotation`](../src/lib/utils/storedState.js) | No cant. Only a finite number from -90 to 90 is used, so the slider, the reticle and the result agree |
| Ballistic display options | [`storedBallisticOptions`](../src/lib/utils/storedState.js) | The default: they change no result. Read: `showAnnotations`, `visibleColumns`, `velChartUnit`, `chartMode` (`velocity`, else `drop`, [#151](https://github.com/hawkins48b/cw-zro/issues/151)). The section flags `showAtmosphere`, `showWind` and `showVelocityChart` of before #151 are not read, and the next option change drops them |
| MPBR target | [`storedMpbrTarget`](../src/lib/utils/storedState.js) | An empty size: the Calculate button stays off. The unit is `cm`, else `in`, as `calculateMPBR` reads it |
| Trajectory Validation observation | [`storedValidationMeasure`](../src/lib/utils/storedState.js) | An empty value: no result. Type `distance`, else `angle`; units `cm`, else `in`, and `mrad`, else `moa`; direction `above`, else `below`, as `calculateTrajectoryValidation` reads them |
| Trajectory Validation solve for | [`storedSolveFor`](../src/lib/utils/storedState.js) | `bc`, else velocity. The result, the chart and the Apply button read the same choice |
| Trajectory Validation atmosphere | [`storedValidationAtmosphere`](../src/lib/utils/storedState.js) | Missing or `null`: the standard atmosphere, as before. Any other damaged section or value: as `storedAtmosphere`, no result |
| Compare entries and chart unit | [`normalizeCompareEntries`](../src/lib/utils/compareEntries.js), [`normalizeYAxisUnit`](../src/lib/utils/yAxisUnit.js) | The entry is left out; the unit is `in` |
| Wind of Scope View and Ballistic | Two getters, see below | No result for a damaged field ([#116](https://github.com/hawkins48b/cw-zro/issues/116)). A damaged direction keeps its value through the one-time direction conversion of [#106](https://github.com/hawkins48b/cw-zro/issues/106), see below |
| Profile list | [`normalizeProfiles`](../src/lib/utils/storedProfiles.js) | No profiles for a list that is not a list; an entry that is not an object with a number or text `id` is left out. Ids are read as text, and a later profile with an id already used (`1` and `"1"`) gets the id with `-2`, `-3` and so on ([#131](https://github.com/hawkins48b/cw-zro/issues/131)). An id a link cannot carry is renumbered the same way ([#134](https://github.com/hawkins48b/cw-zro/issues/134)): empty, `new`, `ammo-selector` (the static routes under `/profiles/`, checked by a test), `.` and `..` become `profile`; `/`, `?`, `#`, `%`, `\`, tabs, line breaks, and spaces or control characters at either end become `-`, the ends with a linear loop, not a regular expression. A changed id never takes one stored on another profile. Usable ids, a space inside an id included, stay as they are. A text `name`, `opticName`, `optic` or `bulletBrand` longer than 60 UTF-16 code units (`MAX_NAME_LENGTH`), or an `ammo` longer than 80 (`MAX_AMMO_LENGTH`), is cut to it without splitting an emoji; the next save stores the cut text ([#141](https://github.com/hawkins48b/cw-zro/issues/141)). The profile form's rifle designation, optic name and ammo brand inputs have `maxlength` 60 |
| Active profile id | [`storedProfileId`](../src/lib/utils/storedProfiles.js), [`profileForStoredId`](../src/lib/utils/storedProfiles.js) | A number or text as text, else the first profile. At load, in the same step as it writes the renumbered list, the profiles store rewrites `zro-active-profile` and the entries of `zro-compare-traj` to the new ids (`findProfileIdRenames`, `renameActiveProfileId`, `renameCompareEntries`), whatever page the session starts on. The active profile and compare stores import it, so they read the rewritten values. A missing key is not written, and damaged values are left as stored. So no later session or save can leave a reference on an old id (security review of #134). `profileForStoredId` stays as a fallback |

A whole store that is not an object reads as empty sections, as above.

Two values are read twice, because the safe value to show would give a result where the stored one gives none:

- **Wind.** The Ballistic and Scope View stores have two wind getters: `wind` is safe to show, and `storedWind` is the raw value that goes to the calculators, so that [`shotWinds`](../src/lib/utils/shotWind.js) decides what a damaged value gives. See [`storedWind.js`](../src/lib/utils/storedWind.js).
  Since [#106](https://github.com/hawkins48b/cw-zro/issues/106) the direction is where the wind comes from, half a turn from the engine's angle (see [Wind](ballistics-model.md#wind)). Directions stored before that are in the engine's convention, so both stores convert their wind once when they are imported ([`migrateStoredWind`](../src/lib/utils/storedWind.js)): a direction `shotWinds` reads becomes the angle half a turn away, as text in [0, 360), an empty box becomes `180` (it was a tailwind), and anything `shotWinds` rejects stays as it is. The wind then carries `directionConvention: 'from-target'`, which `patchWind` keeps and the default winds already have, so a reload or a later change does not convert it again. Scope View first turns a clock direction to degrees, as before (3 o'clock becomes 90, then 270). A wind stored that is not an object is left as it is; the next change writes the default wind with the marker.
- **Profiles.** `profiles.list`, `profiles.get` and `activeProfile.profile` give the profile as stored, and the calculators check every value they read ([#89](https://github.com/hawkins48b/cw-zro/issues/89)). Pages show a profile through [`shownProfile`](../src/lib/utils/storedProfiles.js): names as text, a damaged number as an empty box, a damaged click value as 0.5, units as the calculators read them. Never hand a shown profile to a calculator: an empty barrel twist, for one, would give a result where the damaged stored twist gives none.

The profiles store calls [`profileOps.js`](../src/lib/utils/profileOps.js) for its list operations, on the usable list, so a write replaces a damaged list with a usable one. The same goes for the one-time click value migration at import, and for the ids read as text: the first write stores them. Lookups stay strict (`===`), on text ids.

### Scope View components

Since [#148](https://github.com/hawkins48b/cw-zro/issues/148) the Scope View page ([`+page.svelte`](../src/routes/scope-view/+page.svelte)) is built from these components. They compute nothing: the page passes every value.

| Component | Role |
|-----------|------|
| [`DistanceInput`](../src/lib/components/DistanceInput.svelte) | Target distance card: + / − per digit (1 to `MAX_DISTANCE`), typed entry, yd / m |
| [`ScopeResult`](../src/lib/components/ScopeResult.svelte) | Result card with Dial / Hold; Hold renders the `hold` snippet, which the page fills with [`ScopeReticle`](../src/lib/components/ScopeReticle.svelte) (reticle and cant slider with −/+ 1°). With `both` (tablet, #166) the switch is hidden and the dial tiles and the `hold` snippet are both shown; the stored mode is not changed |
| [`StepperField`](../src/lib/components/StepperField.svelte) | Typeable number box `[−] value [suffix] [unit chips] [+]` with label row and hint / error line (#166). The buttons call `onchange` with the new text, so the page passes it to the same store setter as typing. Used for the angle and in the wind and atmosphere cards |
| [`StepButton`](../src/lib/components/StepButton.svelte) | One 44 px − or + button with a named step ("Increase altitude by 10 m"), `inset` in a box or `standalone` beside the cant slider. Held, it repeats after 400 ms every 100 ms and makes 10 steps a repeat after 10 repeats ([`holdRepeat.js`](../src/lib/utils/holdRepeat.js), #168); `onclick` gets the number of steps. Release, leaving the button and touch cancel stop it; Enter / Space make one step; the context menu of a long tap is blocked |
| [`ScopeWindCard`](../src/lib/components/ScopeWindCard.svelte) | Wind presets, speed with −/+, dial, direction with −/+ 5°, o'clock hint. Presets come from [`windPreset.js`](../src/lib/utils/windPreset.js) through the store (`windPreset`, `applyWindPreset`). Also on the Ballistic page since #151 |
| [`ScopeAtmosphereCard`](../src/lib/components/ScopeAtmosphereCard.svelte) | ISA / Estimate / Accurate, with QNH / Station; altitude, pressure, temperature and humidity are `StepperField`s, each on its own full-width line with its unit chips inside the box since #167 (Estimate: the temperature quick picks under the box). Also on the Ballistic page since #151. In Accurate, "Use current weather here" since #152 (see [Current weather](#current-weather)). The Trajectory Validation page keeps [`AtmosphereCard`](../src/lib/components/AtmosphereCard.svelte) (ISA switch and four fields, restyled for its step 3 in #166: optional `title` and `isaHint`, order Altitude, Temperature, Pressure, Humidity) |
| [`WindDial`](../src/lib/components/WindDial.svelte) | The direction dial of `ScopeWindCard`, a shooter's clock (#165): hours 1 to 11, a target at 12, the shooter in the centre and an arrow from the hour the wind comes from towards the shooter; `aria-valuetext` gives the hour and the degrees. 24 snap positions every 15° (hours and half hours); near the rim a tap or drag snaps to them, inside it sets whole degrees ([`dialDirection`](../src/lib/utils/windDirection.js), #155). Arrows turn 5°, Page Up / Page Down 15°, Home sets 0°. `WindInput`, the Ballistic wind box before #151, was removed in #151 |
| [`ChipGroup`](../src/lib/components/ChipGroup.svelte) | A row of toggle buttons with `aria-pressed`, at least 44 px wide, with a 44 px touch area (`.touch-hit` in [`app.css`](../src/app.css)) |

On phones the page is one column: profile chip (`ProfileInUseChip`, Change opens the picker in place since #166), distance, result, wind, angle, atmosphere. The elevation angle is its own card at every width, with the deg / cos chips inside the box. From 640 px the result is in a right column, sticky. From 640 to 1023 px (tablet) the two columns are equal and the page passes `both` to `ScopeResult` (a `MediaQuery` on `(min-width: 40rem) and (max-width: 63.98rem)`). From 1024 px (desktop) the page shows its title and intro, the columns are `6fr / 5fr`, at most 1180 px wide, and the result keeps its Dial / Hold switch.

**Steppers** ([#166](2026-11-17-166-scope-steppers-layouts.md)). [`fieldStep.js`](../src/lib/utils/fieldStep.js) holds the step of each field: `fieldStepSpec(field, unit)` gives the step, the limits (those the calculators check: `inputLimits.js`, `scopeRange.js`, `MAX_WIND_SPEED_MPS` of `shotWind.js`, `MAX_ROTATION`), open ends, the start value of an empty box and the wrap of the direction; `stepValue(value, delta, spec)` gives the new box text. The buttons compute no result. Steps: wind speed 0.5 m/s or 1 mph, direction 5° round 0 to 360, angle 1° (inside ±90) or 0.01 as a cosine (above 0, at most 1), altitude 10 m or ft, pressure 1 hPa or 0.01 inHg, temperature 1°, humidity 5 %, cant 1° (±90). A result keeps the decimals of the step or the value (at most 10), a clamped one at most one more than the step, never in exponent form.

### Profile components

Since [#166](2026-11-17-166-profiles-redesign.md) (Profiles round) profile and ammunition selection share the picker pattern of the guided setup: search, one list card, the selected row tinted with a check badge, a tonal summary card. The components compute nothing; import, export and delete logic is in `utils/` and the stores.

| Component | Role |
|-----------|------|
| [`ProfilePicker`](../src/lib/components/ProfilePicker.svelte) | Search, sort Recent (newest first) / Rifle / Ammo, single choice or checkboxes, New badges, an outlined badge per id (`badges`, Compare "On chart"; New wins), groups. Used by Profiles, the import review, `ProfileInUseChip` and `CompareAddPicker` |
| [`picker/`](../src/lib/components/picker/) | `PickerSearch`, `PickerList`, `PickerGroup`, `PickerRow` (badge `badgeTone` `tonal` or `outline`), `AmmoSummaryCard`, shared with the Ammo Library and the setup ammunition step |
| [`profile/ProfileSummaryCard`](../src/lib/components/profile/ProfileSummaryCard.svelte), [`ProfileDetailsCard`](../src/lib/components/profile/ProfileDetailsCard.svelte) | The profile in use: 8 key numbers and Edit (phone), right pane from 768 px |
| [`profile/ProfileImportDialog`](../src/lib/components/profile/ProfileImportDialog.svelte) | File chooser and review; reads files with [`profileImport.js`](../src/lib/utils/profileImport.js), stores with `importProfiles` |
| [`ResponsiveDialog`](../src/lib/components/ResponsiveDialog.svelte), [`ConfirmDialog`](../src/lib/components/ConfirmDialog.svelte), [`Toast`](../src/lib/components/Toast.svelte), [`SwitchRow`](../src/lib/components/SwitchRow.svelte) | Sheet on phones / dialog from 640 px; small confirmation; bottom message; on/off row. Dialogs use the [`focusTrap`](../src/lib/actions/focusTrap.js) action |

Store functions added: `deleteProfile` in [`activeProfile.svelte.js`](../src/lib/stores/activeProfile.svelte.js) (refuses the last profile; the next, else the previous, becomes active), `importProfiles` in [`profiles.svelte.js`](../src/lib/stores/profiles.svelte.js) (appends, `null` when the save fails), `trySet` and `resetLocalStores` in [`localStore.svelte.js`](../src/lib/stores/localStore.svelte.js), and [`clearAllData.js`](../src/lib/stores/clearAllData.js) (called from Settings > Danger zone since the Settings round). `swipe.js` and the `svelte-gestures` dependency are no longer used.

### Settings components

Since the Settings round of [#166](2026-11-17-166-settings-redesign.md) the Settings pages are built from [`components/settings/`](../src/lib/components/settings/). [`settings/+layout.svelte`](../src/routes/settings/+layout.svelte) adds a 256 px left pane from 768 to 1023 px (General, About, Privacy, Licences, and the build line); on phones one page at a time, on desktop the sidebar lists the same pages.

| Component | Role |
|-----------|------|
| `DisplaySettingsCard` | Theme and Language rows: the `settings` variants of [`DarkModeToggle`](../src/lib/components/DarkModeToggle.svelte) and [`LanguageSwitcher`](../src/lib/components/LanguageSwitcher.svelte) |
| `ProfilesDataCard` | `profiles.count`, link to Profiles |
| `SettingsLinksCard` | About ZRO, Privacy, Licences (phone and desktop) |
| `ClearDataCard` | Danger zone: inline confirmation, `clearAllData()`, then `goto('/welcome', { replace: true })` |
| `AboutIdentityCard`, `ProvidedByCard`, `ThisCopyCard`, `OpenSourceCard`, `EngineCreditsCard` | The About cards |
| `LicenceTexts` | Accordion of the three files of `static/licenses/`, imported as text, one open at a time |
| `IncludedSoftware` | The packages of [`licenses.json`](../src/lib/data/licenses.json), as a list or a table; [`hasExtraTerms`](../src/lib/utils/licenseKind.js) picks the highlight |
| `ExternalLink` | `target="_blank"`, `rel="noopener noreferrer"`, icon and hidden "(opens in a new tab)" |
| `platformText.js`, `settingsStyles.js` | Translated platform names; shared class strings |

- **Platform and version.** [`platform.js`](../src/lib/utils/platform.js): `platformLabel()` gives `android` or `ios` from `window.Capacitor.getPlatform()` (the native bridge; the app does not import `@capacitor/core`), `desktop` from `isDesktopApp()` (`app:` scheme or `Electron/` user agent, moved here from `currentWeather.js`), else `web`. Web and mobile share one bundle, so this is read at run time. `APP_VERSION` is `__APP_VERSION__`, the package.json version set in `vite.config.js`.
- **Theme.** [`settings.svelte.js`](../src/lib/stores/settings.svelte.js) has `theme` (`'light'` or `'dark'`) and `setTheme(theme)`, beside `darkMode`, `toggleDarkMode` and `setDarkMode`; all write `zro-dark-mode`. `darkMode` is true only for a stored `true`, as [`theme-init.js`](../static/theme-init.js) reads it before the first paint.
- **Licence list.** [`scripts/licenses.js`](../scripts/licenses.js) writes `src/lib/data/licenses.json` with the rules of [`scripts/license-rules.js`](../scripts/license-rules.js), at development time, not during the build. See [Included software list](development.md#included-software-list).
- **Ids.** `DarkModeToggle`, `LanguageSwitcher` and the settings components take their element ids from `$props.id()`, so two copies on one page (sidebar and Settings) do not clash.

### Calculator components

Since the Calculators round of [#166](2026-11-17-166-calculators-redesign.md) the calculator pages share these components. They compute nothing: the result comes from the same calculation calls as before.

| Component | Role |
|-----------|------|
| [`ProfileInUseChip`](../src/lib/components/ProfileInUseChip.svelte) | The profile in use with Change, on every calculator, the hub (from 640 px) and the Scope View (round 4). Variants: `card` (bordered, 48 px, label above the name; Scope View style) (also the Dope Cards header, one selector for both cards, #170), `compact` (one line, 44 px, page headers). Change opens `ResponsiveDialog` with `ProfilePicker` and `ProfileSummaryCard`; "Use this profile" calls `activeProfile.setActive` |
| [`calc/ApplyChangeCard`](../src/lib/components/calc/ApplyChangeCard.svelte) | Before → after with a save button, then a status line or an "already at this value" line. MPBR "Use this zero in your profile" and Validation "Apply to profile"; the page saves through `profiles.update` and stays |
| [`compare/CompareAddPicker`](../src/lib/components/compare/CompareAddPicker.svelte) | Compare "Add a profile": picker with "On chart" badges, preselects the newest profile not on the chart, confirm button; adds with `compareTrajectories.addEntry` on the profile's zero. On the `/add` page (phone, tablet) and in an inline panel on desktop |

The view logic is in `utils/`, tested without Svelte:

- [`mpbrView.js`](../src/lib/utils/mpbrView.js): `mpbrChartMarkers` (near zero, far zero, highest point, MPBR end), `chartLabelAnchor`, `mpbrZeroChange` (before, after, `same`, `usable`, and the patch `{ zeroDist: optimalZero, zeroUnit }` of #110). The MPBR page clears its result when the profile in use changes, so a result is never saved to another profile.
- [`validationView.js`](../src/lib/utils/validationView.js): `validationChange` (before, after, difference, percent), `validationPatch` (`{ velocity }` or `{ bc }` as text, as before), `validationObservationPoint` (the observation marker on the chart). The applied change stays shown until the observation, solve-for, weather or profile in use changes.
- Compare draws each profile name at the end of its line as an ApexCharts point annotation (SVG text, checked by `apexcharts.test.js`), with four colours per theme; a fifth line reuses the first.

### Ballistic page

Since [#151](https://github.com/hawkins48b/cw-zro/issues/151) the Ballistic page ([`+page.svelte`](../src/routes/calculators/ballistic/+page.svelte)) has a header (title, the active profile with Change, Export CSV; since #166 the profile is a `ProfileInUseChip` and Export is an icon button on phones), then the conditions (Distances, `ScopeWindCard`, `ScopeAtmosphereCard`) and the results (four stats, the Bullet Path chart, the data table). Under 1024 px (`lg`) it is one column in that order (since #166 the condition cards are 2 in a row from 672 px of page width and 3 from 768 px, container queries `@2xl` and `@3xl`); from 1024 px the conditions are a left column of 300 to 340 px and the results fill the right.

| Part | Source |
|------|--------|
| Atmosphere | The Scope View's three modes: the store's `atmosphere` (see [Stored values](#stored-values)) through [`scopeAtmosphereParams`](../src/lib/utils/scopeAtmosphere.js) to [`ballisticPageTrajectory`](../src/lib/utils/ballisticPage.js); the line under the card from `usedScopeAtmosphere` and `formatUsedAtmosphere`; `hasNoAirDensity` on the atmosphere used. See [Scope View modes](ballistics-model.md#scope-view-modes) |
| Wind presets | `ballistic.windPreset` and `ballistic.applyWindPreset`, from [`windPreset.js`](../src/lib/utils/windPreset.js), as on the Scope View |
| Stats | Near zero, far zero, highest point (`maxApex`) and goes subsonic (`subsonicDist`) of `calculateFullTrajectory`: no new calculation |
| Chart | Drop or Velocity, one at a time, remembered in `options.chartMode` |
| Click columns | `elevClicks` and `windClicks`, off by default. The angle in the profile's click unit (`getElevationValue`, `getWindageValue`), counted with [`clicks.js`](../src/lib/utils/clicks.js) as the Scope View counts them: rounded to a whole click, the click value read with a 0.5 fallback. Signed like the angle columns: a negative elevation is dialled up. Export CSV writes every visible column, the click columns included |
| Columns | The column picker toggles `options.visibleColumns`, which the store keeps |
| Highlighted row | [`scopeDistanceRow`](../src/lib/utils/ballisticPage.js): the row whose distance, rounded to 0.1, equals the Scope View range box converted to the table unit (1 yd = 0.9144 m) and rounded to 0.1. The range box, not the range after the Scope View angle. No row, or a Scope View range it does not calculate, highlights nothing |



The step only picks the table rows and the chart ticks ([#130](https://github.com/hawkins48b/cw-zro/issues/130), owner decision: at least 1, in the range unit; [#133](https://github.com/hawkins48b/cw-zro/issues/133), owner decision: at most the range). No key point depends on it ([#94](https://github.com/hawkins48b/cw-zro/issues/94)). [`tableStep`](../src/lib/utils/inputLimits.js) is the step the table uses: the size of the value typed, at least 1, and 25 for an empty box, 0 or text, as before; above the range, or infinite, it is the range ([`maxTableStep`](../src/lib/utils/inputLimits.js), at least 1), so the table has the muzzle row and the row at the range. [`tableStepLimit`](../src/lib/utils/inputLimits.js) picks the message under the box: `ballistic_step_min` under 1, for text or NaN; `ballistic_step_max` above the range or infinite. The table keeps `tableStep`. The empty box, 25, on a range under 25 is read as the range without a message. Both charts ask ApexCharts for at most `MAX_CHART_TICKS` (120) x-axis ticks, the count of the default step on the longest range ([`chartTickAmount`](../src/lib/utils/inputLimits.js)).

### Current weather

Since [#152](https://github.com/hawkins48b/cw-zro/issues/152) (owner decisions of 2026-11-16), the Accurate mode of `ScopeAtmosphereCard` has a button that fills altitude, pressure, temperature and humidity from the weather at the user's location, on the Scope View and the Ballistic page. What is sent is in [Data and privacy](data-and-privacy.md#what-leaves-the-device). Since [#154](https://github.com/hawkins48b/cw-zro/issues/154) the same request asks for MeteoSwiss ICON-CH1 inside its area and Open-Meteo's default models elsewhere.

| Piece | Where | What it does |
|-------|-------|--------------|
| Request and conversion | [`currentWeather.js`](../src/lib/utils/currentWeather.js) | `currentPosition` (geolocation, high accuracy, 15 s timeout, a fix up to 5 minutes old, at most 60 s with the permission prompt), `weatherUrl` (latitude and longitude rounded to 2 decimals, plus fixed parameters), `weatherModel` (which model answered, #154), `fetchWeather` (`credentials: 'omit'`, `referrerPolicy: 'no-referrer'`, `cache: 'no-store'`, aborted after 10 s), `readWeather` (each value a finite number within the [input limits](ballistics-model.md#input-guards), Open-Meteo's default units), `siteAltitude`, `weatherPatch` (to the units the boxes show), `createWeatherFill` (one request at a time, a late answer ignored) |
| Page wiring | [`currentWeather.svelte.js`](../src/lib/components/currentWeather.svelte.js) | `useCurrentWeather(store)`, called by both pages: the status, the button's `request`, the card's `onchange` that clears the status line after a change, a cancel on leaving Accurate, and a dispose when the page is left |
| Display | `ScopeAtmosphereCard` | `weatherAvailable`, `weatherStatus` and `onweather` props; the card computes nothing |

- **Nothing before a tap.** The pages create the helper on load, but it calls neither geolocation nor `fetch` until `request()`, which only the button calls.
- **One change or none.** The answer is converted with the units shown when it arrives, then written in one `setAtmosphere` call: `mode: 'accurate'`, `pressureRef: 'qnh'` and the four boxes. Pressure is always Open-Meteo's `pressure_msl`, a sea-level pressure, so it is filled as QNH, and the app corrects it to the altitude as for a typed QNH ([`stationPressure`](../src/lib/utils/stationPressure.js), #107). Open-Meteo's `surface_pressure` is not used: it is for the model's ground height, not the GPS altitude. On any error the boxes stay as they were and the card shows one of four messages: `denied`, `unavailable`, `network`, `invalid`.
- **Model (#154, owner decision of 2026-11-16).** One request, `models=meteoswiss_icon_ch1,best_match`, with the three fields also asked under `hourly` for `forecast_hours=1`. The values always come from `current`, with the same checks as before: with both models, Open-Meteo gives ICON-CH1's values there inside its area (Switzerland and around) and the default's elsewhere, under plain keys (checked against the live API on 2026-11-16, Bern, Turin, Paris, Marseille and Vienna inside; Berlin, London, Rome and New York outside). `hourly` is read only for the label: `weatherModel` gives `meteoswiss_icon_ch1` when `temperature_2m_meteoswiss_icon_ch1`, `relative_humidity_2m_meteoswiss_icon_ch1` and `pressure_msl_meteoswiss_icon_ch1` are arrays whose first value is a finite number, else `best_match`. A missing or odd `hourly` block never fails the fill. The model reaches the card as `weatherStatus.model`; after an ICON-CH1 fill the attribution line adds a link to MeteoSwiss ("Source: MeteoSwiss (ICON-CH1 model)", the source credit its terms of use ask for, new tab) after the Open-Meteo.com link. The label says which model Open-Meteo reports for the first hour; that `current` holds the same model's values relies on Open-Meteo's behaviour, which the app does not check per request.
- **Rounding.** Altitude whole (ft or m), pressure 1 decimal in hPa or 2 in inHg, temperature 1 decimal (°C or °F), humidity whole. Conversions are js-ballistics'. A value outside the limits of its box after conversion is `invalid`.
- **Altitude.** The device's GPS altitude when it is a finite number within the altitude limits, else Open-Meteo's `elevation` (its model ground height at the point). Browser and Android GPS altitude is usually height above the WGS84 ellipsoid, not above sea level; the two differ by the geoid height, tens of metres in many places and up to about 100 m. It is not corrected (owner decision: GPS first). The user can edit the box.
- **Stale answers.** Leaving the page, or leaving the Accurate mode, aborts the request and drops a late answer. A change to a box while the request runs does not stop it: the answer then replaces the four boxes.
- **Where it shows.** [`isCurrentWeatherAvailable`](../src/lib/utils/currentWeather.js): web and mobile, with `navigator.geolocation`, `fetch` and `AbortController`. Not on the desktop build, detected by its `app:` scheme or an `Electron/` user agent ([`isDesktopApp`](../src/lib/utils/platform.js) since #166); the desktop app also refuses the location permission ([`permissions.js`](../electron/permissions.js), unchanged).

### Where shots are built

The input handling is written out six times: in `calculateShotPoint`, `calculateFullTrajectory` and `calculateMPBR`, in `computeTrajectory` in each mid-range dope card file, and in `computePrecisionCard` ([`precisionCard.js`](../src/lib/utils/precisionCard.js), #157). A change to how an input is read has to be made in all of them, and they do not all apply the same options. See the [table of screens](ballistics-model.md#which-screen-uses-what).

## Build targets

| Target | Command | Output | Difference |
|--------|---------|--------|------------|
| Web | `npm run build` | `build/` | Split in chunks: 92 JS files, ApexCharts and dope cards load on demand. The ApexCharts chunk is 950 kB, 280 kB gzipped (8.8.1; 605 kB and 165 kB on 5.16.0) |
| Mobile | `npm run build:mobile` | `build/` | `BUILD_TARGET=capacitor` sets `bundleStrategy: 'single'`: 1 JS file |
| Desktop | `npm run electron:build` | `dist-electron/` | The web build, served from `app://-` by `electron-serve` |

**Aborted ApexCharts request on a reload** ([#99](https://github.com/hawkins48b/cw-zro/issues/99)). The Ballistic, MPBR, Trajectory Validation and Compare pages import ApexCharts in `onMount`, so its chunk is requested after the page has rendered. If the page is reloaded, or left, before that response arrives, the browser cancels the request of the document it unloads, and lists it as aborted (`net::ERR_ABORTED`). The new document requests the chunk again and draws the charts. Reproduced on 2026-11-11 with a production build behind a static host with an `index.html` fallback, in Chromium, by delaying the chunk 400 ms and reloading `/calculators/ballistic` as soon as the page had text: the first request is aborted, the second completes and the chart renders, with no page error. Reloading after the chunk has loaded aborts nothing. The earlier smoke tests (#71, #72) reloaded as soon as the page showed text, which is that race. The chunk path is absolute (`/_app/immutable/...`), so a deep URL does not change it. A start without a locale in the URL and a stored language other than English ([#96](https://github.com/hawkins48b/cw-zro/issues/96)) aborts the requests of the first document the same way, because `hooks.client.js` replaces the page; ApexCharts is not among them, since that document never mounts a page. Neither costs more than a repeated download.

**Web and mobile builds share `build/`.** The second one overwrites the first.

## Layout by screen width

| Width | Navigation | Theme control |
|-------|------------|---------------|
| Under 640 px | Tab bar at the bottom: Scope, Calculators, Profiles, Settings, each with icon and label. The header shows back (when there is history), the page title and the theme button | Header button |
| 640 to 1023 px | Rail, 96 px wide: logo, the same four items with icon and label. The header shows back and the title | Button at the foot of the rail |
| 1024 px and over | Sidebar, 240 px: logo and tagline, the four items, the calculators listed under Calculators (Ballistic, Dope Cards, MPBR, Compare, Trajectory Validation, the hub's order), the version at the foot. No header | Light / Dark buttons at the foot |

Page frame (#169): the layout gives every page the same frame, so pages set no width, centring or side padding. Side padding is 16 px under 640 px, 24 px from 640 px (in line with the header), `clamp(16px, 3vw, 40px)` from 1024 px with 32 px above and 48 px below; on every device the content is centred within 1180 px. Page roots use the same gaps, `gap-3 sm:gap-4 lg:gap-5`. Narrow pages (Compare › Add, precision guide) are a centred 672 px column. Welcome and the guided setup are bare routes with their own frame.

The width decides this, not the platform. Since [#149](2026-11-16-149-nav-hub-profiles.md) the three are plain `<nav>` elements in [`+layout.svelte`](../src/routes/+layout.svelte), built from one item list and shown by CSS breakpoints (`sm`, `lg`); Skeleton's `Navigation` component is no longer used. An item is active on its page and on the pages under it, compared on the path without `/fr` or `/de`, so it is marked in every language; `/` counts as Scope View. The link of the page itself has `aria-current="page"`, a section the page is in `aria-current="true"`.

The guided setup (`/setup`, [`GuidedSetup`](../src/lib/components/GuidedSetup.svelte)) has no navigation at any width. On phones it is full screen with a sticky footer; from 640 px it has a top bar and one centred card holding the progress, the step and Back / Next, 680 px wide and 760 px from 1024 px, where the ammunition step is in two columns (#166).

On the profile editor routes (`/profiles/new`, `/profiles/[id]`) the layout hides its header under 1024 px and the phone tab bar: the editor has its own header and a pinned Cancel / Save bar. On every `/profiles/...` sub-page the desktop sidebar lists the profiles (rifle · ammunition) and "+ New profile" under Profiles (#166).

Settings (#166, Settings round): the desktop sidebar always lists General, About, Privacy and Licences under Settings, each matched on its exact path; on General the Settings item gets `aria-current="true"` and the sub-item `"page"`. On `/settings/...` the layout header is hidden from 768 px, where the Settings pane holds the title (see [Settings components](#settings-components)).

## Desktop

[`electron/main.js`](../electron/main.js) opens one window with `sandbox`, `contextIsolation` and no `nodeIntegration`. [`preload.cjs`](../electron/preload.cjs) exposes nothing to the page.

| Request | Result |
|---------|--------|
| A page asks for a new window | Always denied |
| The same, for an `https:` URL | Denied, and the URL opens in the system browser |
| Main window navigates within `app://-` | Allowed |
| Main window navigates anywhere else | Blocked |

An external link needs `target="_blank"`. Without it, the link is blocked instead of opening in the browser. Downloads (CSV, PDF dope cards, profile JSON) are `<a download>` clicks on a `blob:` URL; `main.js` has no `will-download` handler, so Electron uses its default, which usually shows a save dialog. Not checked in a running desktop build. The rules are in [`navigation.js`](../electron/navigation.js) and have tests.

Hardening ([#104](https://github.com/hawkins48b/cw-zro/issues/104)):

| Piece | Where | What it does |
|-------|-------|--------------|
| Permissions | [`permissions.js`](../electron/permissions.js) | Every permission request, check and device request of the default session is refused. The app uses none |
| Menu | [`menu.js`](../electron/menu.js) | File (Quit) or the macOS app menu, Edit, View (zoom, full screen), Window. Reload and the developer tools only when the app is not packaged (`electron:dev`) |
| Fuses | `electronFuses` in [`electron-builder.json`](../electron-builder.json) | `ELECTRON_RUN_AS_NODE`, `NODE_OPTIONS` and `--inspect` are ignored; cookies are encrypted; the app loads only from `app.asar`, checked for integrity on Windows and macOS (Linux has no such check); `file://` gets no extra rights. `resetAdHocDarwinSignature` re-signs an unsigned macOS build after the fuses change it |
| Linux sandbox | `linux.executableArgs: []` | The AppImage desktop entry no longer passes `--no-sandbox`. The AppImage launcher still adds it on hosts where `unshare -Ur true` fails (no user namespaces, as on Ubuntu 24.04 by default), so the app starts there without the OS sandbox |
| Content-Security-Policy | `csp` in [`vite.config.js`](../vite.config.js) | See [Content-Security-Policy](#content-security-policy) |

## Content-Security-Policy

Every build carries a `<meta>` Content-Security-Policy, written by SvelteKit (`kit.csp`, hash mode): web and desktop since [#104](https://github.com/hawkins48b/cw-zro/issues/104), mobile since [#135](https://github.com/hawkins48b/cw-zro/issues/135).

In the mobile web views the app's own origin is `https://localhost` on Android, which `'self'` matches, and `capacitor://localhost` on iOS. That is a custom scheme `'self'` may not match, so the mobile build also lists `capacitor://localhost` in every directive below that has `'self'`, except `base-uri`. Both origins cover Capacitor's `/_capacitor_file_` and `/_capacitor_http_interceptor_` paths. Capacitor's native bridge needs no source: iOS adds it as a user script and Android as a document-start script (`addDocumentStartJavaScript`), which the policy does not cover. On older Android WebViews it is instead an inline `<script>` right after `<head>`, before the policy `<meta>`, which does not apply to anything before it. The bridge has no `eval`. Only a device or emulator run shows whether the web views need more (see the issue).

| Directive | Value | Why |
|-----------|-------|-----|
| `default-src` | `'self'` | Anything not listed comes from the app only |
| `script-src` | `'self'`, `'wasm-unsafe-eval'` and the hash of SvelteKit's start script | No other inline script, no `eval`. `'wasm-unsafe-eval'` lets `js-ballistics` 3 compile its embedded WebAssembly engine; without it every calculation fails ([#77](https://github.com/hawkins48b/cw-zro/issues/77), owner decision of 2026-11-12). It does not allow `eval()` or `new Function()` |
| `style-src` | `'self' 'unsafe-inline'` | ApexCharts, Svelte transitions and `style:` set inline styles |
| `img-src` | `'self' data: blob:` | ApexCharts |
| `font-src` | `'self' data:` | |
| `connect-src` | `'self' https://api.open-meteo.com` | The app fetches its two PDF templates, and the [current weather](#current-weather) from Open-Meteo on a tap (#152, owner decision of 2026-11-16). Only this directive names the host: no script, style, image or font comes from it. The desktop build shares the web build, so its policy names the host too, but it hides the button and refuses the location |
| `object-src` | `'none'` | |
| `base-uri` | `'self'` | |
| `form-action` | `'none'` | No form is submitted anywhere |

ApexCharts 8.8.1 needs nothing more ([#75](https://github.com/hawkins48b/cw-zro/issues/75)): no `eval`, no inline script, no other host. Its two `fetch` calls embed fonts in chart exports, and the app hides the toolbar, so none runs.

`'wasm-unsafe-eval'` is there for `js-ballistics` 3.1.0 ([#77](https://github.com/hawkins48b/cw-zro/issues/77), owner decision of 2026-11-12). Its engine, bclibc, is WebAssembly embedded in the bundle as text and compiled on the device with `WebAssembly.instantiate`. A `script-src` without this keyword refuses that compile (checked in Chromium: "Refused to compile or instantiate WebAssembly module"), and every calculator and dope card then fails. The keyword allows compiling WebAssembly only; `eval()`, `new Function()` and inline scripts stay blocked, and no code is loaded from another origin.

SvelteKit hashes only the scripts it writes. An inline script in [`app.html`](../src/app.html) would be blocked, so the dark mode script is the file [`static/theme-init.js`](../static/theme-init.js). A `<meta>` policy cannot set `frame-ancestors`; that needs a header from the web host. Downloads of `blob:` links (PDF, CSV and profile JSON) are navigations, which the policy does not cover.

## Mobile

[`capacitor.config.json`](../capacitor.config.json) sets the app ID, `webDir: build` and the splash and status bar settings. `android/` and `ios/` are generated and git-ignored, so they are not in the repository ([#79](https://github.com/hawkins48b/cw-zro/issues/79)). No Capacitor plugin is imported in `src/`.

The [current weather](#current-weather) (#152) uses the web view's own `navigator.geolocation`, not a Capacitor plugin. The native projects need location permissions for it; see [Mobile build](development.md#location-permission-for-the-current-weather).

## Decisions

The [dated delivery documents](README.md) record why things are as they are. For the stack, start with [the toolchain](2026-11-05-72-toolchain.md), [Skeleton](2026-11-05-74-skeleton-lucide.md) and [Electron](2026-11-05-76-electron.md).
