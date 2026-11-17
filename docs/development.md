# Development

## Requirements

| Tool | Version | Why |
|------|---------|-----|
| Node | 26 (any 26.x) | `.nvmrc` says `26`, the active LTS. Checked on 26.13.1 |
| npm | 11.20.0 was used | Comes with Node 26.13.1 |
| Git | Any | |

`package.json` requires Node 26 or later (`engines.node`), and `.npmrc` sets `engine-strict=true`, so an older Node stops `npm ci` with `EBADENGINE`. `.nvmrc` holds the major version only: CI installs the latest 26.x, and `nvm use` takes whichever 26.x you have, so check it with `node -v`.

Every dependency accepts any 26.x. Their own floors are lower (`jsdom` 31 22.22.2, SvelteKit 22.17, Vite and Vitest 22.12, Capacitor 22.0), but `engines.node` refuses anything before 26, the only version CI runs. Vitest 5 does not accept Node 25.

npm 11 warns during `npm ci` that `electron-winstaller` has an install script "not yet covered by allowScripts". It still runs: it copies the bundled 7-Zip binary for the host CPU architecture inside its `vendor/` folder (used to build the Windows installer) and downloads nothing. Nothing needs approving today.

## Setup

```bash
git clone https://github.com/hawkins48b/cw-zro.git
cd cw-zro
git checkout develop
nvm install        # or any Node from the table above
npm ci
```

Use `npm ci`, not `npm install`: it installs exactly what the lockfile holds, which keeps `js-ballistics` and `apexcharts` on their pinned versions. `npm ci` also runs `svelte-kit sync`. The Paraglide code in `src/lib/paraglide` is generated the first time Vite or Vitest runs.

No `.env` file is needed. The only environment variable the app reads is `BUILD_TARGET`, and only `build:mobile` sets it.

## Check that it works

```bash
npm run test:run
npm run build
npm run build:mobile
```

All three must exit with 0. `build:mobile` leaves the mobile bundle in `build/`, so run `npm run build` again before using `build/` as the web app.

## Daily work

```bash
npm run dev        # http://localhost:5173
npm run test       # Tests in watch mode
```

Branch from `develop`. See [the branch flow](deployment.md#branch-flow). Before handing work over, run `npm run test:run` and `npm run build`. CI runs both, plus `npm run audit:check`.

### Conventions

| Topic | Rule |
|-------|------|
| Imports from `src/lib` | `#lib/...`, not `$lib/...` |
| Paraglide imports | With `.js`: `#lib/paraglide/messages.js` |
| Environment module | `$app/env`, not `$app/environment` |
| `goto` | `replace`, not `replaceState` |
| Svelte config | In `vite.config.js`. There is no `svelte.config.js` |
| User-visible text | In `messages/*.json`. See [Translations](translations.md) |
| External links | `target="_blank"`, or Electron blocks them |
| Calculations | In `src/lib/utils/`, with tests. See [Testing](testing.md) |

Calculations can hang with no way to stop them. See [Input guards](ballistics-model.md#input-guards) before changing what reaches the engine.

### Precision card templates

The precision dope card (#157) is printed on static templates, `static/pdf/precision-<en|fr|de>-<metric|imperial>.pdf`, three A6 pages each (cover, range page, worksheet). [`scripts/precision-card-templates.js`](../scripts/precision-card-templates.js) draws them with pdf-lib; there is no SVG source. After changing the layout ([`precisionCardLayout.js`](../src/lib/utils/precisionCardLayout.js)), the words ([`precisionCardWords.js`](../src/lib/utils/precisionCardWords.js)) or the columns ([`precisionCardFormat.js`](../src/lib/utils/precisionCardFormat.js)), run:

```bash
npm run templates:precision
```

and commit the six PDFs. The output has no date or id, so an unchanged layout writes the same bytes. `precisionCardPdf.test.js` fails when a committed template differs from what the script writes. The fill code reads the same layout and words, so the numbers stay in their cells.

### Skeleton upgrades

Its tools do not flag every changed default. Diff the old and new CSS, as [the Skeleton delivery](2026-11-05-74-skeleton-lucide.md) explains.

## Web build

```bash
npm run build
npm run preview
```

`build/` is a static site. `preview` serves every inner URL, so it does not show the problem a real host can have with [deep links](deployment.md#deep-links-on-the-web-host).

## Mobile build

`android/` and `ios/` are git-ignored and do not exist after a clone, so create them once. This repository has no signing setup, and no delivery document records a run on a device or emulator ([#79](https://github.com/hawkins48b/cw-zro/issues/79)). They stay out of the repository and out of CI by owner decision: see [Mobile](deployment.md#mobile).

```bash
npm run build:mobile
npx cap add android    # Once. For iOS: npx cap add ios
npm run cap:android    # For iOS: npm run cap:ios
```

`npm run cap:sync` alone rebuilds and copies the bundle. Before `cap add`, `cap:android` fails with "android platform has not been added yet", and `cap:sync` passes without copying to any platform.

You also need Android Studio, or Xcode on macOS, as Capacitor requires. The Android steps above were run up to `cap:sync`. Opening the project, building it and every iOS step were not.

### Location permission for the current weather

"Use current weather here" ([#152](https://github.com/hawkins48b/cw-zro/issues/152)) calls `navigator.geolocation` in the web view. The native projects are generated, so add these by hand after `cap add`, or the web view refuses the location and the card says location access is off:

| Platform | File | Add |
|----------|------|-----|
| Android | `android/app/src/main/AndroidManifest.xml`, in `<manifest>` | `<uses-permission android:name="android.permission.ACCESS_COARSE_LOCATION" />` and `<uses-permission android:name="android.permission.ACCESS_FINE_LOCATION" />` |
| iOS | `ios/App/App/Info.plist` | `NSLocationWhenInUseUsageDescription`, a short reason shown in the system prompt, for example "ZRO uses your location, rounded to about 1 km, to get the current weather when you ask for it." |

As Capacitor's web view is described, Android asks for these permissions at run time when the page calls geolocation and the manifest lists them, and iOS shows the system prompt with the text above (WKWebView may ask a second time for the page). Neither was checked on a device or emulator: the native projects are not in the repository and no device was available here. The Play Store data-safety form and the App Store privacy details will probably need to list approximate location, sent to Open-Meteo on request: an owner step before a store submission.

`build:mobile` sets its variable in POSIX shell form, so it needs a POSIX shell. It has not been tried on Windows.

## Desktop build

```bash
npm run electron:dev      # Builds, then opens the app
npm run electron:build    # Packages into dist-electron/
```

The first `electron .` after a fresh install downloads the Electron binary.

| Platform | Package | State |
|----------|---------|-------|
| Linux | `ZRO-2.0.0-linux-x86_64.AppImage` | Built and run |
| Windows | `ZRO-2.0.0-win-x64.exe`, NSIS installer | Not built. On Linux the build stops at wine |
| macOS | `ZRO-2.0.0-mac-arm64.dmg` and `ZRO-2.0.0-mac-x64.dmg` | Not built |

electron-builder targets the platform it runs on. A version tag builds all three in CI and publishes them: see [Desktop release](deployment.md#desktop-release). Packages are not signed, and there is no auto-update. Electron 45 needs macOS 13 or later and drops 32-bit Windows and armv7l. [The Electron delivery](2026-11-05-76-electron.md) has the details. Fuses, permissions, the menu and the sandbox are in [Architecture](architecture.md#desktop) ([#104](https://github.com/hawkins48b/cw-zro/issues/104)).

The fuses make a packaged app ignore `--inspect` and `ELECTRON_RUN_AS_NODE`, and it has no developer tools. Debug with `npm run electron:dev`, which keeps them.

`electron-serve` must stay in `dependencies`. As a devDependency, the packaged app crashes on start although the build reports success.

## Replacing the bclibc engine

The ballistic engine, bclibc 2.0.0 (LGPL-3.0), is compiled to WebAssembly and embedded as base64 in `node_modules/js-ballistics/dist/index.js`. The LGPL lets users run ZRO with a modified bclibc. These steps rebuild js-ballistics 3.1.0 with your own bclibc, then ZRO with that js-ballistics. See [Licences](data-and-privacy.md#licences).

Extra tools: `make`, CMake, Yarn 1, and one WebAssembly toolchain: zig (what the published package uses) or [wasi-sdk](https://github.com/WebAssembly/wasi-sdk/releases) 34.

1. Get js-ballistics at the pinned version. Its submodule `lib/bclibc` is bclibc at tag `v2.0.0` (commit `bc6b18f`).

   ```bash
   git clone --recursive --branch v3.1.0 https://github.com/o-murphy/js-ballistics.git
   cd js-ballistics
   git rev-parse HEAD   # must print b71066fd5b80f1ee9b790a6b35a89bfd28a16315
   ```

2. Change the bclibc source in `lib/bclibc`.
3. Build js-ballistics. `make build` compiles bclibc to a WebAssembly module, embeds it in `build/bclibc.js` (`scripts/embed-wasm.mjs`), then bundles `dist/` with tsup.

   ```bash
   yarn install --frozen-lockfile
   uv run --no-project --with ziglang make build                          # zig, as its release workflow does
   make build WASM_TOOLCHAIN=wasi-sdk WASI_SDK_PATH=/path/to/wasi-sdk-34.0  # or wasi-sdk
   npm pack                                                               # writes js-ballistics-3.1.0.tgz
   ```

   The js-ballistics release workflow does not pin `ziglang`, so `uv` takes the newest one. For a build you can repeat, pin it: `--with ziglang==<version>`.

4. In a ZRO checkout, install the pinned dependencies, then replace js-ballistics with your package. `--no-save` leaves `package.json` and the lockfile alone, so the exact pin, and its test, stay as they are.

   ```bash
   npm ci
   npm install --no-save /path/to/js-ballistics-3.1.0.tgz
   npm run test:run
   ```

5. Build ZRO as usual: `npm run build` (web), `npm run build:mobile` then the [Mobile build](#mobile-build) steps (Android, iOS), or `npm run electron:build` ([Desktop build](#desktop-build)).

The next `npm ci` puts the published js-ballistics back. To keep your package, set `"js-ballistics": "file:/path/to/js-ballistics-3.1.0.tgz"` in `package.json` and run `npm install`. The test `pins js-ballistics to an exact version` then fails, as it should.

What was checked on 2026-11-15 ([#143](https://github.com/hawkins48b/cw-zro/issues/143)), with an unmodified bclibc, Node 22, CMake 3.31.6, wasi-sdk 34.0 and Yarn 1.22.22:

| Step | State |
|------|-------|
| js-ballistics `v3.1.0` points `lib/bclibc` at bclibc `v2.0.0` | Checked |
| `make build` with wasi-sdk | Built. The module is 1,013,692 bytes, against about 84 KB with zig, so the bundle is larger |
| `make build` with zig | Not verified: zig was not reachable from the build machine |
| `npm install --no-save` of the package, then `npm run test:run` | All tests pass, baselines included. `package.json` and the lockfile do not change |
| `npm run build` and `npm run build:mobile` | Both pass. The mobile bundle embeds the rebuilt module, not the published one |
| `npm run electron:build`, Android Studio, Xcode | Not run with a rebuilt engine |

A modified engine can change every calculated result. The tests compare against recorded baselines, so a failing test shows the shift.

## Common problems

| Symptom | Cause | Fix |
|---------|-------|-----|
| `EBADENGINE` on install | Node older than 26 | `nvm install` (reads `.nvmrc`) |
| `vite preview` shows a blank page, then crashes with `ENOENT` | It was left running across a rebuild | Restart it |
| `android platform has not been added yet` | `android/` does not exist | Run `npx cap add android` |
| Web preview behaves like the mobile bundle | `build:mobile` was the last build | Run `npm run build` |
| Text shows raw keys | The message catalog came out empty | Run `npm run test:run`, which fails on it. See [Translations](translations.md) |
| A test run or the page never returns | An input hung the engine | See [Testing](testing.md#hangs) |

## Dependency updates

See [Dependency Updates](../README.md#dependency-updates) in the README. `js-ballistics` ([#126](https://github.com/hawkins48b/cw-zro/issues/126)) and `apexcharts` ([#75](https://github.com/hawkins48b/cw-zro/issues/75)) are pinned to exact versions in `package.json`, so `npm update` does not move them. `apex-commons`, which ApexCharts needs, has a `^0.10.0` range there: only the lockfile keeps it on 0.10.0.
