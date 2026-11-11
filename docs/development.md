# Development

## Requirements

| Tool | Version | Why |
|------|---------|-----|
| Node | 22.22.2 or later on the 22 line | `.nvmrc` says `22`. `jsdom` 31 is the highest floor among the dependencies |
| npm | 10.9.9 was used | Comes with Node 22 |
| Git | Any | |

`.npmrc` sets `engine-strict=true`, so an older Node stops `npm ci` with `EBADENGINE`. `.nvmrc` holds the major version only: CI installs the latest 22.x, and `nvm use` takes whichever 22.x you have, so check it with `node -v`.

The other minimums are lower: SvelteKit needs 22.17, Vite and Vitest 22.12, Capacitor 22.0. `jsdom` also accepts `^24.15.0` and `>=26.0.0`, but only 22 runs in CI.

## Setup

```bash
git clone https://github.com/hawkins48b/cw-zro.git
cd cw-zro
git checkout develop
nvm install        # or any Node from the table above
npm ci
```

Use `npm ci`, not `npm install`: it installs exactly what the lockfile holds, which keeps `js-ballistics` and `apexcharts` on their held versions. `npm ci` also runs `svelte-kit sync`. The Paraglide code in `src/lib/paraglide` is generated the first time Vite or Vitest runs.

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

### Skeleton upgrades

Its tools do not flag every changed default. Diff the old and new CSS, as [the Skeleton delivery](2026-11-05-74-skeleton-lucide.md) explains.

## Web build

```bash
npm run build
npm run preview
```

`build/` is a static site. `preview` serves every inner URL, so it does not show the problem a real host can have with [deep links](deployment.md#deep-links-on-the-web-host).

## Mobile build

`android/` and `ios/` are git-ignored and do not exist after a clone, so create them once. This repository has no signing setup, and no delivery document records a run on a device or emulator ([#79](https://github.com/hawkins48b/cw-zro/issues/79)).

```bash
npm run build:mobile
npx cap add android    # Once. For iOS: npx cap add ios
npm run cap:android    # For iOS: npm run cap:ios
```

`npm run cap:sync` alone rebuilds and copies the bundle. Before `cap add`, `cap:android` fails with "android platform has not been added yet", and `cap:sync` passes without copying to any platform.

You also need Android Studio, or Xcode on macOS, as Capacitor requires. The Android steps above were run up to `cap:sync`. Opening the project, building it and every iOS step were not.

`build:mobile` sets its variable in POSIX shell form, so it needs a POSIX shell. It has not been tried on Windows.

## Desktop build

```bash
npm run electron:dev      # Builds, then opens the app
npm run electron:build    # Packages into dist-electron/
```

The first `electron .` after a fresh install downloads the Electron binary.

| Platform | Package | State |
|----------|---------|-------|
| Linux | `ZRO-2.0.0.AppImage` | Built and run |
| Windows | NSIS installer | Not built. On Linux the build stops at wine |
| macOS | dmg | Not built |

electron-builder targets the platform it runs on. Packages are not signed, and there is no auto-update. Electron 45 needs macOS 13 or later and drops 32-bit Windows and armv7l. [The Electron delivery](2026-11-05-76-electron.md) has the details. Fuses, permissions, the menu and the sandbox are in [Architecture](architecture.md#desktop) ([#104](https://github.com/hawkins48b/cw-zro/issues/104)).

The fuses make a packaged app ignore `--inspect` and `ELECTRON_RUN_AS_NODE`, and it has no developer tools. Debug with `npm run electron:dev`, which keeps them.

`electron-serve` must stay in `dependencies`. As a devDependency, the packaged app crashes on start although the build reports success.

## Common problems

| Symptom | Cause | Fix |
|---------|-------|-----|
| `EBADENGINE` on install | Node older than 22.22.2 | Update Node |
| `vite preview` shows a blank page, then crashes with `ENOENT` | It was left running across a rebuild | Restart it |
| `android platform has not been added yet` | `android/` does not exist | Run `npx cap add android` |
| Web preview behaves like the mobile bundle | `build:mobile` was the last build | Run `npm run build` |
| Text shows raw keys | The message catalog came out empty | Run `npm run test:run`, which fails on it. See [Translations](translations.md) |
| A test run or the page never returns | An input hung the engine | See [Testing](testing.md#hangs) |

## Dependency updates

See [Dependency Updates](../README.md#dependency-updates) in the README. `js-ballistics` is pinned to an exact version in `package.json` ([#126](https://github.com/hawkins48b/cw-zro/issues/126)). `apexcharts` still has a caret range, so `npm update` could move it. Only the lockfile and the Dependabot rules keep it in place.
