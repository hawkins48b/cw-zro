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
| Ballistics | `js-ballistics`, held ([#77](https://github.com/hawkins48b/cw-zro/issues/77)) | 2.2.0-beta.2 |
| Charts | ApexCharts, lazy-loaded, held ([#75](https://github.com/hawkins48b/cw-zro/issues/75)) | 5.16.0 |
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
├── app.html                 # HTML shell, sets dark mode before the first paint
├── hooks.client.js          # At start, goes to the stored language when the URL has none
├── hooks.js                 # Removes the locale from the URL before routing
└── hooks.server.js          # Paraglide middleware, server side only
electron/                    # Desktop main process, navigation rules, preload
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

`localStorage` can hold any JSON value, so the stores check each field when they read it, with plain tested functions in `utils/`, and pages only see a usable shape ([#115](https://github.com/hawkins48b/cw-zro/issues/115), [#118](https://github.com/hawkins48b/cw-zro/issues/118), [#120](https://github.com/hawkins48b/cw-zro/issues/120)). A damaged value must not start giving a result for a value the user did not enter, and what the page shows and the result must agree.

| Store | Read by | A damaged value gives |
|-------|---------|-----------------------|
| Range of Scope View, Ballistic and compare | [`storedRange`](../src/lib/utils/storedState.js) | An empty box: the range message and no result. The unit is `m`, else `yd`. An empty Ballistic step is 25, as its placeholder says; the step only picks the table rows |
| Atmosphere of Scope View and Ballistic | [`storedAtmosphere`](../src/lib/utils/storedState.js) | An empty box, which is out of its limits: the box's message and no result. A damaged section is a custom atmosphere with empty boxes, not the standard one. `useISA` is on for any truthy value, as before |
| Scope View angle | [`storedElevation`](../src/lib/utils/storedState.js) | An empty box, a flat shot in either unit, as before. The unit is `deg`, else a cosine, as `scopeEffectiveRange` reads it, so a missing unit changes no result |
| Scope View rotation (cant) | [`storedRotation`](../src/lib/utils/storedState.js) | No cant. Only a finite number from -90 to 90 is used, so the slider, the reticle and the result agree |
| Ballistic display options | [`storedBallisticOptions`](../src/lib/utils/storedState.js) | The default: they change no result |
| Compare entries and chart unit | [`normalizeCompareEntries`](../src/lib/utils/compareEntries.js), [`normalizeYAxisUnit`](../src/lib/utils/yAxisUnit.js) | The entry is left out; the unit is `in` |
| Wind of Scope View and Ballistic | Two getters, see below | No result for a damaged field ([#116](https://github.com/hawkins48b/cw-zro/issues/116)) |
| Profile list | [`normalizeProfiles`](../src/lib/utils/storedProfiles.js) | No profiles for a list that is not a list; an entry that is not an object with a number or text `id` is left out |

A whole store that is not an object reads as empty sections, as above.

Two values are read twice, because the safe value to show would give a result where the stored one gives none:

- **Wind.** The Ballistic and Scope View stores have two wind getters: `wind` is safe to show, and `storedWind` is the raw value that goes to the calculators, so that [`shotWinds`](../src/lib/utils/shotWind.js) decides what a damaged value gives. See [`storedWind.js`](../src/lib/utils/storedWind.js).
- **Profiles.** `profiles.list`, `profiles.get` and `activeProfile.profile` give the profile as stored, and the calculators check every value they read ([#89](https://github.com/hawkins48b/cw-zro/issues/89)). Pages show a profile through [`shownProfile`](../src/lib/utils/storedProfiles.js): names as text, a damaged number as an empty box, a damaged click value as 0.5, units as the calculators read them. Never hand a shown profile to a calculator: an empty barrel twist, for one, would give a result where the damaged stored twist gives none.

The profiles store calls [`profileOps.js`](../src/lib/utils/profileOps.js) for its list operations, on the usable list, so a write replaces a damaged list with a usable one. The MPBR and trajectory validation stores are not checked yet.

### Where shots are built

The input handling is written out five times: in `calculateShotPoint`, `calculateFullTrajectory` and `calculateMPBR`, and in `computeTrajectory` in each dope card file. A change to how an input is read has to be made in all of them, and they do not all apply the same options. See the [table of screens](ballistics-model.md#which-screen-uses-what).

## Build targets

| Target | Command | Output | Difference |
|--------|---------|--------|------------|
| Web | `npm run build` | `build/` | Split in chunks: 87 JS files, ApexCharts and dope cards load on demand |
| Mobile | `npm run build:mobile` | `build/` | `BUILD_TARGET=capacitor` sets `bundleStrategy: 'single'`: 1 JS file |
| Desktop | `npm run electron:build` | `dist-electron/` | The web build, served from `app://-` by `electron-serve` |

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

## Mobile

[`capacitor.config.json`](../capacitor.config.json) sets the app ID, `webDir: build` and the splash and status bar settings. `android/` and `ios/` are generated and git-ignored, so they are not in the repository ([#79](https://github.com/hawkins48b/cw-zro/issues/79)). No Capacitor plugin is imported in `src/`.

## Decisions

The [dated delivery documents](README.md) record why things are as they are. For the stack, start with [the toolchain](2026-11-05-72-toolchain.md), [Skeleton](2026-11-05-74-skeleton-lucide.md) and [Electron](2026-11-05-76-electron.md).
