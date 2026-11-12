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
| Charts | ApexCharts, lazy-loaded, pinned by owner decision ([#75](https://github.com/hawkins48b/cw-zro/issues/75)) | 8.8.1 |
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
│   ├── actions/             # Svelte actions (swipe)
│   ├── assets/              # Favicon
│   ├── components/          # Reusable Svelte components
│   ├── data/ammo.json       # Ammunition library, 41 loads
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
scripts/                     # Audit check
static/                      # Copied to build/: logo, PDF templates, robots.txt
```

Configuration is in [`vite.config.js`](../vite.config.js). There is no `svelte.config.js`: the SvelteKit options are passed to `sveltekit({...})` there. `#lib` is an alias defined under `imports` in [`package.json`](../package.json).

## Routes

| Route | Page |
|-------|------|
| `/` | Start page |
| `/scope-view` | Scope view |
| `/calculators` | Calculator list |
| `/calculators/ballistic` | Trajectory table and charts |
| `/calculators/mpbr` | Maximum point-blank range |
| `/calculators/trajectory-validation` | Velocity or BC from an observation |
| `/calculators/compare-trajectories` | Compare chart |
| `/calculators/compare-trajectories/add` | Choose a profile to compare |
| `/calculators/dope-cards` | PDF cards |
| `/profiles` | Profile list |
| `/profiles/new`, `/profiles/[id]` | Profile form |
| `/profiles/ammo-selector` | Ammunition library |
| `/settings`, `/settings/about`, `/settings/privacy` | Settings pages |

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
| Atmosphere of Scope View and Ballistic | [`storedAtmosphere`](../src/lib/utils/storedState.js) | An empty box, which is out of its limits: the box's message and no result. A damaged section is a custom atmosphere with empty boxes, not the standard one. `useISA` is on for any truthy value, as before |
| Scope View angle | [`storedElevation`](../src/lib/utils/storedState.js) | An empty box, a flat shot in either unit, as before. The unit is `deg`, else a cosine, as `scopeEffectiveRange` reads it, so a missing unit changes no result. A stored angle at or beyond ±90° is not damaged: the box shows the angle message and there is no result ([#129](https://github.com/hawkins48b/cw-zro/issues/129)) |
| Scope View rotation (cant) | [`storedRotation`](../src/lib/utils/storedState.js) | No cant. Only a finite number from -90 to 90 is used, so the slider, the reticle and the result agree |
| Ballistic display options | [`storedBallisticOptions`](../src/lib/utils/storedState.js) | The default: they change no result |
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

### Ballistic table step

The step only picks the table rows and the chart ticks ([#130](https://github.com/hawkins48b/cw-zro/issues/130), owner decision: at least 1, in the range unit; [#133](https://github.com/hawkins48b/cw-zro/issues/133), owner decision: at most the range). No key point depends on it ([#94](https://github.com/hawkins48b/cw-zro/issues/94)). [`tableStep`](../src/lib/utils/inputLimits.js) is the step the table uses: the size of the value typed, at least 1, and 25 for an empty box, 0 or text, as before; above the range, or infinite, it is the range ([`maxTableStep`](../src/lib/utils/inputLimits.js), at least 1), so the table has the muzzle row and the row at the range. [`tableStepLimit`](../src/lib/utils/inputLimits.js) picks the message under the box: `ballistic_step_min` under 1, for text or NaN; `ballistic_step_max` above the range or infinite. The table keeps `tableStep`. The empty box, 25, on a range under 25 is read as the range without a message. Both charts ask ApexCharts for at most `MAX_CHART_TICKS` (120) x-axis ticks, the count of the default step on the longest range ([`chartTickAmount`](../src/lib/utils/inputLimits.js)).

### Where shots are built

The input handling is written out five times: in `calculateShotPoint`, `calculateFullTrajectory` and `calculateMPBR`, and in `computeTrajectory` in each dope card file. A change to how an input is read has to be made in all of them, and they do not all apply the same options. See the [table of screens](ballistics-model.md#which-screen-uses-what).

## Build targets

| Target | Command | Output | Difference |
|--------|---------|--------|------------|
| Web | `npm run build` | `build/` | Split in chunks: 92 JS files, ApexCharts and dope cards load on demand. The ApexCharts chunk is 950 kB, 280 kB gzipped (8.8.1; 605 kB and 165 kB on 5.16.0) |
| Mobile | `npm run build:mobile` | `build/` | `BUILD_TARGET=capacitor` sets `bundleStrategy: 'single'`: 1 JS file |
| Desktop | `npm run electron:build` | `dist-electron/` | The web build, served from `app://-` by `electron-serve` |

**Aborted ApexCharts request on a reload** ([#99](https://github.com/hawkins48b/cw-zro/issues/99)). The Ballistic, MPBR, Trajectory Validation and Compare pages import ApexCharts in `onMount`, so its chunk is requested after the page has rendered. If the page is reloaded, or left, before that response arrives, the browser cancels the request of the document it unloads, and lists it as aborted (`net::ERR_ABORTED`). The new document requests the chunk again and draws the charts. Reproduced on 2026-11-11 with a production build behind a static host with an `index.html` fallback, in Chromium, by delaying the chunk 400 ms and reloading `/calculators/ballistic` as soon as the page had text: the first request is aborted, the second completes and the chart renders, with no page error. Reloading after the chunk has loaded aborts nothing. The earlier smoke tests (#71, #72) reloaded as soon as the page showed text, which is that race. The chunk path is absolute (`/_app/immutable/...`), so a deep URL does not change it. A start without a locale in the URL and a stored language other than English ([#96](https://github.com/hawkins48b/cw-zro/issues/96)) aborts the requests of the first document the same way, because `hooks.client.js` replaces the page; ApexCharts is not among them, since that document never mounts a page. Neither costs more than a repeated download.

**Web and mobile builds share `build/`.** The second one overwrites the first.

## Layout by screen width

| Width | Navigation |
|-------|------------|
| Under 640 px | Bottom bar |
| 640 to 1023 px | Side rail |
| 1024 px and over | Full sidebar |

The width decides this, not the platform.

## Desktop

[`electron/main.js`](../electron/main.js) opens one window with `sandbox`, `contextIsolation` and no `nodeIntegration`. [`preload.cjs`](../electron/preload.cjs) exposes nothing to the page.

| Request | Result |
|---------|--------|
| A page asks for a new window | Always denied |
| The same, for an `https:` URL | Denied, and the URL opens in the system browser |
| Main window navigates within `app://-` | Allowed |
| Main window navigates anywhere else | Blocked |

An external link needs `target="_blank"`. Without it, the link is blocked instead of opening in the browser. The rules are in [`navigation.js`](../electron/navigation.js) and have tests.

Hardening ([#104](https://github.com/hawkins48b/cw-zro/issues/104)):

| Piece | Where | What it does |
|-------|-------|--------------|
| Permissions | [`permissions.js`](../electron/permissions.js) | Every permission request, check and device request of the default session is refused. The app uses none |
| Menu | [`menu.js`](../electron/menu.js) | File (Quit) or the macOS app menu, Edit, View (zoom, full screen), Window. Reload and the developer tools only when the app is not packaged (`electron:dev`) |
| Fuses | `electronFuses` in [`electron-builder.json`](../electron-builder.json) | `ELECTRON_RUN_AS_NODE`, `NODE_OPTIONS` and `--inspect` are ignored; cookies are encrypted; the app loads only from `app.asar`, checked for integrity on Windows and macOS (Linux has no such check); `file://` gets no extra rights. `resetAdHocDarwinSignature` re-signs an unsigned macOS build after the fuses change it |
| Linux sandbox | `linux.executableArgs: []` | The AppImage desktop entry no longer passes `--no-sandbox`. The AppImage launcher still adds it on hosts where `unshare -Ur true` fails (no user namespaces, as on Ubuntu 24.04 by default), so the app starts there without the OS sandbox |
| Content-Security-Policy | `csp` in [`vite.config.js`](../vite.config.js) | See [Content-Security-Policy](#content-security-policy) |

## Content-Security-Policy

The web and desktop builds carry a `<meta>` Content-Security-Policy, written by SvelteKit (`kit.csp`, hash mode). The mobile build has none until it is tested on a device.

| Directive | Value | Why |
|-----------|-------|-----|
| `default-src` | `'self'` | Anything not listed comes from the app only |
| `script-src` | `'self'`, `'wasm-unsafe-eval'` and the hash of SvelteKit's start script | No other inline script, no `eval`. `'wasm-unsafe-eval'` lets `js-ballistics` 3 compile its embedded WebAssembly engine; without it every calculation fails ([#77](https://github.com/hawkins48b/cw-zro/issues/77), owner decision of 2026-11-12). It does not allow `eval()` or `new Function()` |
| `style-src` | `'self' 'unsafe-inline'` | ApexCharts, Svelte transitions and `style:` set inline styles |
| `img-src` | `'self' data: blob:` | ApexCharts |
| `font-src` | `'self' data:` | |
| `connect-src` | `'self'` | The app fetches only its two PDF templates |
| `object-src` | `'none'` | |
| `base-uri` | `'self'` | |
| `form-action` | `'none'` | No form is submitted anywhere |

ApexCharts 8.8.1 needs nothing more ([#75](https://github.com/hawkins48b/cw-zro/issues/75)): no `eval`, no inline script, no other host. Its two `fetch` calls embed fonts in chart exports, and the app hides the toolbar, so none runs.

`'wasm-unsafe-eval'` is there for `js-ballistics` 3.1.0 ([#77](https://github.com/hawkins48b/cw-zro/issues/77), owner decision of 2026-11-12). Its engine, bclibc, is WebAssembly embedded in the bundle as text and compiled on the device with `WebAssembly.instantiate`. A `script-src` without this keyword refuses that compile (checked in Chromium: "Refused to compile or instantiate WebAssembly module"), and every calculator and dope card then fails. The keyword allows compiling WebAssembly only; `eval()`, `new Function()` and inline scripts stay blocked, and no code is loaded from another origin.

SvelteKit hashes only the scripts it writes. An inline script in [`app.html`](../src/app.html) would be blocked, so the dark mode script is the file [`static/theme-init.js`](../static/theme-init.js). A `<meta>` policy cannot set `frame-ancestors`; that needs a header from the web host. Downloads of `blob:` links (PDF and CSV) are navigations, which the policy does not cover.

## Mobile

[`capacitor.config.json`](../capacitor.config.json) sets the app ID, `webDir: build` and the splash and status bar settings. `android/` and `ios/` are generated and git-ignored, so they are not in the repository ([#79](https://github.com/hawkins48b/cw-zro/issues/79)). No Capacitor plugin is imported in `src/`.

## Decisions

The [dated delivery documents](README.md) record why things are as they are. For the stack, start with [the toolchain](2026-11-05-72-toolchain.md), [Skeleton](2026-11-05-74-skeleton-lucide.md) and [Electron](2026-11-05-76-electron.md).
