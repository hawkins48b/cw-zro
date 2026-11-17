# CLAUDE.md

ZRO is a ballistic calculator: Svelte 5, SvelteKit 3, Vite 8, plain JavaScript, Skeleton, Tailwind 4, Paraglide. One static SPA, also packaged with Capacitor and Electron. No backend. Users act on these numbers, so wrong results are the worst bug here.

Start with [README.md](README.md). Do not repeat the guides here: link to them.

## Commands

```bash
npm ci                 # Node 26 (any 26.x). Not npm install
npm run dev            # Port 5173
npm run test:run       # Before handing work over
npm run build          # Before handing work over
npm run build:mobile   # Also, when a change can affect the bundle
npm run audit:check
```

All scripts: [README](README.md#scripts). Setup: [docs/development.md](docs/development.md).

## Branches

- **Never push to `main`: every push deploys to production.** Nothing in the settings stops it.
- Work on a feature branch off `develop`. A push to `develop` runs CI and deploys to the dev site, once its secrets exist ([#69](https://github.com/hawkins48b/cw-zro/issues/69)). Until then it deploys nothing.
- Releases are an owner decision. See [docs/deployment.md](docs/deployment.md).

## Calculated results

- **The owner must approve any change in calculated results.** This covers library upgrades, refactors and fixes.
- **Never overwrite a baseline, or widen a tolerance, to make a test pass.** A failing baseline is a finding: stop, explain it, measure the shift, report it. See [docs/testing.md](docs/testing.md#when-a-baseline-fails).
- Do not pin known defects as baselines.
- Do not claim more accuracy than [docs/ballistics-model.md](docs/ballistics-model.md#accuracy) shows.
- Input handling is written out six times: `calculateShotPoint`, `calculateFullTrajectory`, `calculateMPBR`, `computeTrajectory` in both mid-range dope cards, and `computePrecisionCard` (precision card, #157). Check them all.

## Engine hangs

`js-ballistics` is synchronous and can loop forever on bad input. **`try/catch` cannot stop it, and neither can a Vitest timeout.** Guard the values before they reach the engine. In a test, stub `setWeaponZero` to throw instead of running the hang. See [Input guards](docs/ballistics-model.md#input-guards) and [Hangs](docs/testing.md#hangs).

## Pinned dependencies

Neither is held any more. Neither may move, not even within a major, without an owner decision on its issue:

- **`js-ballistics`** is pinned on 3.1.0 by owner decision ([#77](https://github.com/hawkins48b/cw-zro/issues/77)), which accepts the LGPL-3.0 engine it embeds (bclibc 2.0.0, WebAssembly) and its result shifts. The app runs it on RK4, `stepMultiplier` 0.5, with the 2.2 flight limits (`src/lib/utils/ballisticEngine.js`). Update it only in its own pull request, with owner approval of any result change. On each update, recheck `flightStop.js` and the stop reasons (#126), the hang probes, the CSP (`'wasm-unsafe-eval'`) and the bclibc version and the js-ballistics tag in `static/licenses/THIRD-PARTY-NOTICES.txt`, the messages, and the rebuild steps in [Replacing the bclibc engine](docs/development.md#replacing-the-bclibc-engine) (#143).
- **`apexcharts`** is pinned on an exact version by owner decision ([#75](https://github.com/hawkins48b/cw-zro/issues/75)), which accepts its licence terms. Those terms changed within majors (7.4.0, 7.7.0, 8.7.0), so update it only in its own pull request (Dependabot opens one per update). `src/test/apexcharts.test.js` checks the exact pin and the sha256 of the `LICENSE.md` of `apexcharts` and of its dependency `apex-commons` (same licence) against the accepted text (#164): if that test fails, the licence changed, so stop for the owner and change the hash only once they accept it.

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
