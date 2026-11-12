# CLAUDE.md

ZRO is a ballistic calculator: Svelte 5, SvelteKit 3, Vite 8, plain JavaScript, Skeleton, Tailwind 4, Paraglide. One static SPA, also packaged with Capacitor and Electron. No backend. Users act on these numbers, so wrong results are the worst bug here.

Start with [README.md](README.md). Do not repeat the guides here: link to them.

## Commands

```bash
npm ci                 # Node 22.22.2 or later on the 22 line. Not npm install
npm run dev            # Port 5173
npm run test:run       # Before handing work over
npm run build          # Before handing work over
npm run build:mobile   # Also, when a change can affect the bundle
npm run audit:check
```

All scripts: [README](README.md#scripts). Setup: [docs/development.md](docs/development.md).

## Branches

- **Never push to `main`: every push deploys to production.** Nothing in the settings stops it.
- Work on a feature branch off `develop`. `develop` runs CI and deploys nowhere ([#69](https://github.com/hawkins48b/cw-zro/issues/69)).
- Releases are an owner decision. See [docs/deployment.md](docs/deployment.md).

## Calculated results

- **The owner must approve any change in calculated results.** This covers library upgrades, refactors and fixes.
- **Never overwrite a baseline, or widen a tolerance, to make a test pass.** A failing baseline is a finding: stop, explain it, measure the shift, report it. See [docs/testing.md](docs/testing.md#when-a-baseline-fails).
- Do not pin known defects as baselines.
- Do not claim more accuracy than [docs/ballistics-model.md](docs/ballistics-model.md#accuracy) shows.
- Input handling is written out five times: `calculateShotPoint`, `calculateFullTrajectory`, `calculateMPBR` and `computeTrajectory` in both dope cards. Check them all.

## Engine hangs

`js-ballistics` is synchronous and can loop forever on bad input. **`try/catch` cannot stop it, and neither can a Vitest timeout.** Guard the values before they reach the engine. In a test, stub `setWeaponZero` to throw instead of running the hang. See [Input guards](docs/ballistics-model.md#input-guards) and [Hangs](docs/testing.md#hangs).

## Held dependencies

Do not upgrade these, not even within a major, without an owner decision on the issue:

- **`js-ballistics`** stays on 2.2.0-beta.2, Euler engine ([#77](https://github.com/hawkins48b/cw-zro/issues/77)). 3.1.0 embeds LGPL-3.0 code and shifts results.

`apexcharts` is no longer held: it is pinned on 8.8.1 by owner decision ([#75](https://github.com/hawkins48b/cw-zro/issues/75)), which accepts its licence terms. Those terms changed within majors (7.4.0, 7.7.0, 8.7.0), so update it only in its own pull request: diff its `LICENSE.md` against 8.8.1, and stop for the owner if the text changed. It brings `apex-commons` (same licence), locked at 0.10.0.

Both are pinned to an exact version. Use `npm ci`, and check the lockfile diff.

## Code rules

- `#lib/...` imports, never `$lib/...`. It is defined under `imports` in `package.json`.
- Config is in `vite.config.js`. There is no `svelte.config.js`, so do not add one.
- `$app/env`, not `$app/environment`. `goto` takes `replace`, not `replaceState`.
- **Web and mobile builds share `build/`.** The last one wins, so never assume which one is there.
- Calculations go in `src/lib/utils/`, as plain tested functions. Stores stay thin.
- External links need `target="_blank"`, or Electron blocks them.
- `electron-serve` stays in `dependencies`.
- No inline `<script>` in `app.html`: the Content-Security-Policy blocks it. Put it in `static/`. See [Content-Security-Policy](docs/architecture.md#content-security-policy).
- A new external host for scripts, styles, images or fonts needs a change to `csp` in `vite.config.js` (and an owner decision, see below).
- Code comments and script output point at the `Dependency Updates` and `Accepting an exception` headings in README.md. Keep those headings there.

## Messages

All user-visible text goes in `messages/en.json`, `fr.json` and `de.json`, with the same key in all three. Use `import { m } from '#lib/paraglide/messages.js'`. See [docs/translations.md](docs/translations.md).

## Security and privacy

- Never commit secrets, FTP details or signing material. Docs give secret names only.
- The app sends no user data anywhere. A new network call needs an owner decision, and an update to [docs/data-and-privacy.md](docs/data-and-privacy.md).

## Docs

- Guides in `docs/` have no date. They describe the state on `develop`, so update them with the change.
- Each delivered task gets `docs/YYYY-MM-DD-<slug>.md`, linked newest first from [docs/README.md](docs/README.md) under the guides. These record history: do not rewrite them.
- Write from the code. Every claim must be checkable, and say what is unfinished or unverified.
- Plain short sentences, tables where they help, no marketing.

## Issues

Work is tracked in [hawkins48b/cw-zro](https://github.com/hawkins48b/cw-zro/issues). A `Closes #N` line closes the issue when it reaches `main`, even if the deploy fails.
