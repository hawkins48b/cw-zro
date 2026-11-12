# ZRO — Ballistic Calculator

ZRO is a ballistic calculator for precision shooting sports and long-range marksmanship. It computes bullet trajectories, dope cards and maximum point-blank range, and it has an interactive scope view. One codebase builds a static web app, a mobile app (Capacitor) and a desktop app (Electron). All calculations run on the device. There is no backend and there are no accounts.

Results are estimates from a point-mass model. Read the [assumptions, limits and accuracy](docs/ballistics-model.md) before relying on them.

## State of the project

- **Production:** a push to `main` deploys the web app over FTPS. Nothing delivered since the last release is in production yet, and the last deploy stopped before uploading. See [Deployment](docs/deployment.md#current-state).
- **`develop`:** the integration branch. It runs CI and deploys nowhere ([#69](https://github.com/hawkins48b/cw-zro/issues/69)).
- **Desktop and mobile:** built by hand. No workflow builds them ([#79](https://github.com/hawkins48b/cw-zro/issues/79)).
- **Pinned by owner decision:** `js-ballistics` on 3.1.0 ([#77](https://github.com/hawkins48b/cw-zro/issues/77)); it embeds the LGPL-3.0 engine bclibc, see [Licences](docs/data-and-privacy.md#licences). ApexCharts on 8.8.1 ([#75](https://github.com/hawkins48b/cw-zro/issues/75)).

## Quick start

You need Node 22.22.2 or later on the 22 line (`.nvmrc` says 22, and `.npmrc` makes npm refuse an older version). Work happens on `develop`, not on the default branch.

```bash
git clone https://github.com/hawkins48b/cw-zro.git
cd cw-zro
git checkout develop
npm ci
npm run test:run
npm run dev        # http://localhost:5173
```

The [development guide](docs/development.md) covers the production, mobile and desktop builds.

## Scripts

| Command | What it does |
|---------|--------------|
| `npm run dev` | Starts the Vite dev server on port 5173 |
| `npm run build` | Builds the web app into `build/` |
| `npm run build:mobile` | Builds the Capacitor bundle into the same `build/` |
| `npm run preview` | Serves `build/` locally |
| `npm run prepare` | Runs `svelte-kit sync`. npm runs it after install |
| `npm run test` | Runs the tests in watch mode |
| `npm run test:run` | Runs the tests once, as CI does |
| `npm run audit:check` | Fails on high or critical audit findings, as CI does |
| `npm run cap:sync` | Runs `build:mobile`, then `npx cap sync` |
| `npm run cap:android` | Runs `cap:sync`, then opens the Android project |
| `npm run cap:ios` | Runs `cap:sync`, then opens the iOS project |
| `npm run electron:dev` | Runs `build`, then opens the app in Electron |
| `npm run electron:build` | Runs `build`, then packages the desktop app into `dist-electron/` |

## Documentation

| Guide | Content |
|-------|---------|
| [Architecture](docs/architecture.md) | Stack and versions, code layout, routes, stores, build targets |
| [Ballistics model](docs/ballistics-model.md) | Inputs and units, what is modelled, input limits, accuracy |
| [Development](docs/development.md) | Setup, daily work, web, mobile and desktop builds, common problems |
| [Testing](docs/testing.md) | Test layers, baselines, tolerances, and the rule for changed results |
| [Deployment](docs/deployment.md) | Branch flow, environments, secret names, releases, known gaps |
| [Translations](docs/translations.md) | Adding messages and languages, locale URLs |
| [Data and privacy](docs/data-and-privacy.md) | What is stored, where, and what leaves the device |

The [docs index](docs/README.md) lists these guides and the dated delivery documents, which record why things were done. Rules for coding agents are in [`CLAUDE.md`](CLAUDE.md).

## Features

| Feature | What it does |
|---------|--------------|
| Scope view | Live field calculator: distance, wind and angle give click adjustments, on a red-dot, MOA, MRAD or mil-dot reticle |
| Ballistic calculator | Trajectory table with selectable columns, CSV export, elevation and velocity charts |
| MPBR | Maximum point-blank range for a target size, with the zero to use and a chart |
| Trajectory validation | Solves muzzle velocity or BC from an observed impact, and can save it to the profile |
| Compare trajectories | Several profiles on one chart |
| Dope cards | PDF cards in imperial or metric |
| Profiles | Rifle, optic and ammunition sets, with a library of 41 loads |
| Settings | Dark mode, language (English, French, German), about and privacy pages |

## Dependency Updates

Dependabot (`.github/dependabot.yml`) checks npm and GitHub Actions every week and opens pull requests against `develop`, never `main`. Minor and patch updates are grouped into one pull request per ecosystem. Major updates come one by one.

- **`js-ballistics`** always gets its own pull request. Merge it only with owner approval of the results (#77), and check the bclibc version and licence it embeds.
- **`apexcharts`** always gets its own pull request, minor and patch updates included. Its licence changed within majors, so diff `LICENSE.md` against 8.8.1 before merging, and stop for the owner if it changed (#75).
- **`SamKirkland/FTP-Deploy-Action`** always gets its own pull request, because it runs with the FTP password. Review each update on its own.

Dependabot *security updates*, a repository setting, must stay off: they always target `main` and skip the rules above. Dependabot alerts are fine. No file in this repository can enforce this, so the owner has to confirm it in the repository settings.

### Audit

The `audit` job in CI runs `npm run audit:check`. It audits all dependencies, dev ones included, and fails on any high or critical advisory without a live exception. Moderate and low findings do not fail it.

| Exit code | Meaning | What to do |
|-----------|---------|------------|
| 0 | No unaccepted high or critical finding | Nothing |
| 1 | `AUDIT FAILED`: at least one finding is listed | Update the package, or add an exception |
| 2 | `AUDIT COULD NOT RUN` or `AUDIT NOT DECIDED`: the registry gave no report, the audit covered no dependencies, or the exceptions file is invalid | Rerun the job once the registry is back, or fix the lockfile or the exceptions file |

`npm audit` is retried three times when the registry gives no report. A check that could not run counts as failed, never as passed.

Known moderate and low findings, which do not ship in the app ([#105](https://github.com/hawkins48b/cw-zro/issues/105)), checked on 2026-11-11:

| Package | Advisory | Comes from | Why it does not affect ZRO |
|---------|----------|------------|-----------------------------|
| `deepmerge` 4.3.1 (4 low) | [GHSA-gcqx-w48m-w2h4](https://github.com/advisories/GHSA-gcqx-w48m-w2h4), prototype poisoning in `mergeObject()` | `@sveltejs/vite-plugin-svelte` | It merges the build configuration on the build machine and is not in the bundle. All versions from 4.2.0 are affected, so there is no fixed version. `@sveltejs/adapter-static` is a devDependency since #105, so `npm audit --omit=dev` reports nothing |
| `minimatch` 7.0.0 to 11.0.0 (6 moderate) | [GHSA-g3hv-75wg-m249](https://github.com/advisories/GHSA-g3hv-75wg-m249), denial of service through glob patterns | `electron-builder` 26 (`app-builder-lib`, `@electron/universal`) | It runs only while packaging the desktop app, on patterns from our own `electron-builder.json`, never on user input. npm's only fix is a downgrade to electron-builder 24. Recheck when electron-builder updates |

**CI runs inside the production deploy** (`deploy-prod.yml`), so either failure also blocks a deploy, even with no change to the dependencies. An exception is the way out of a finding. It does not help with a registry outage: rerun the job.

### Accepting an exception

Prefer a fix. If there is none yet, or the advisory does not affect ZRO, add it to `.github/audit-exceptions.json` through a pull request to `develop`. A deploy only sees it once it is on `main`.

```json
{
	"exceptions": [
		{
			"id": "GHSA-xxxx-xxxx-xxxx",
			"reason": "Why it is safe to ship, and what would remove the need for this.",
			"expires": "2026-12-31"
		}
	]
}
```

- All three fields are required, and an invalid file fails the check. `id` is the GHSA ID printed by the check.
- An exception covers that advisory only, on every package it reaches. Other advisories on the same package still fail.
- It applies through its `expires` date (UTC), then stops applying and the finding fails again. Keep it within 92 days and renew it with a new reason. A later date still works, but gives a warning.
- An exception that no longer matches a high or critical finding gives a warning: remove it.

## License

MIT. See [LICENSE](LICENSE). Third-party packages keep their own licences.
