# In-range dependency updates

- **Date:** 2026-11-05
- **Branch:** task/71-in-range-updates
- **Issue:** [#71](https://github.com/hawkins48b/cw-zro/issues/71)
- **Status:** Delivered on `develop`, not in production yet

## Summary

The goal was to bring every dependency to the latest version in its current major, without major upgrades.

**Delivered:** all packages are at the top of their major, and `npm audit` findings drop from 48 to 13. Only [`package.json`](../package.json) and `package-lock.json` changed; no application code did. `js-ballistics` stays on 2.2.0-beta.2, because [#77](https://github.com/hawkins48b/cw-zro/issues/77) handles it on its own.

| `npm audit` | Total | Critical | High | Moderate | Low | With `--omit=dev` |
|-------------|-------|----------|------|----------|-----|-------------------|
| Before | 48 | 4 | 28 | 11 | 5 | 26 |
| After | 13 | 0 | 1 | 6 | 6 | 6, all low |

### Effect on users

One visible change. On the MPBR chart and the phone ballistic chart, ApexCharts now paints annotation labels over the y-axis numbers instead of under them, so "Point Blank Range" covers digits of some ticks. The overlap already existed; only the stacking flipped. It was left as it is.

Of 60 screenshots per build, 48 are pixel-identical, 4 differ only by a 10 px scroll offset, and 8 show the label stacking change on the MPBR chart and the phone ballistic chart. PDF content is identical to `develop` once dates are normalized.

## Technical changes

Locked versions of the main packages. The full list is in [`package.json`](../package.json).

| Package | Before | After |
|---------|--------|-------|
| `@sveltejs/kit` | 2.50.2 | 2.70.4 |
| `svelte` | 5.50.1 | 5.57.3 |
| `vite` | 7.3.1 | 7.3.7 |
| `vitest` | 4.0.18 | 4.1.12 |
| `tailwindcss` | 4.1.18 | 4.3.4 |
| `@skeletonlabs/skeleton` | 4.12.0 | 4.15.2 |
| `@inlang/paraglide-js` | 2.10.0 | 2.29.3 |
| `@lucide/svelte` | 0.563.1 | 0.577.0 |
| `apexcharts` | 5.7.0 | 5.16.0 |
| `@capacitor/core` | 8.1.0 | 8.6.0 |
| `electron` | 40.6.1 | 40.10.6 |
| `electron-builder` | 26.8.1 | 26.18.1 |

### Version picks

- **`electron-builder` 26.18.1** comes from the maintainers' `v26` tag, above `latest` 26.18.0. `npm outdated` therefore lists `latest` as lower than the installed version.
- **`@lucide/svelte` 0.577.0** is the last 0.x release, outside the old caret range.

### Remaining audit findings

`npm audit fix` changed nothing further. What remains only offers major changes, and for the `electron-builder` group that means going down to 24.13.3.

| Package | Severity | Advisory | Resolved by |
|---------|----------|----------|-------------|
| `electron` | High | 14 advisories | [#76](https://github.com/hawkins48b/cw-zro/issues/76) |
| `@sveltejs/kit` | Low | GHSA-pfhg-q3qv-9q6r, GHSA-27mw-82g8-phjj | [#72](https://github.com/hawkins48b/cw-zro/issues/72) |
| `cookie` | Low | GHSA-pxg6-pf52-xh8x | [#72](https://github.com/hawkins48b/cw-zro/issues/72) |
| `@sveltejs/vite-plugin-svelte-inspector` | Low | Through its parent plugin | [#72](https://github.com/hawkins48b/cw-zro/issues/72) |
| `deepmerge` | Low | GHSA-gcqx-w48m-w2h4 | No issue; no patched release exists |
| `minimatch` | Moderate, dev only | GHSA-g3hv-75wg-m249 | No issue; patched in `minimatch` 11.0.1, but `electron-builder` 26 and the 27 alpha still require `^10.2.5` |

The other 7 of the 13 are flagged only through these packages:

- `@sveltejs/adapter-static` and `@sveltejs/vite-plugin-svelte` (low)
- `electron-builder`, `app-builder-lib`, `dmg-builder`, `electron-builder-squirrel-windows` and `@electron/universal` (moderate, through `minimatch`)

After all of #72 to #77, about 10 findings would remain, none high. `@sveltejs/vite-plugin-svelte` 7 still depends on `deepmerge`, so that chain stays flagged (about 4 low), as do the 6 moderate ones.

None of the 6 production findings reaches code shipped to browsers. The app has `ssr` off and uses no `use:enhance`, form actions, `setHeaders` or cookies, and `deepmerge` is not in the build output.

### Tests

**402 passed, 1 todo**, no baselines touched. `npm ci` is clean on Node 22 with `engine-strict`, and `build` and `build:mobile` pass. The test run, `npm audit` and the npm 10 behaviour below were rerun for this document; `npm ci` only as a dry run. The builds and browser checks were not rerun.

Browser smoke test, 49 checks per build: 48 of 49 on the branch and on `origin/develop` alike, and 49 of 49 on the mobile build. The one failure is the same on both: an ApexCharts chunk request is aborted on a deep reload, with charts still rendering. Its cause is unknown.

Pages covered: scope view, ballistic, compare, trajectory validation, MPBR, profiles, PDF dope card, language switch, and reload on localized URLs.

**Blank first load, not an app bug.** A `vite preview` server left running across a rebuild serves a blank page once, then crashes with `ENOENT` on a removed `start.*.js`. Cold starts were clean, 9 of 9 on each build.

## npm version

**Cleared by [#72](https://github.com/hawkins48b/cw-zro/issues/72).** After the upgrade to `vitest` 5 and `vite` 8, stock npm 10.9.9 runs `npm update`, adds a package and installs without a lockfile, and npm 11 is no longer needed to regenerate the lockfile. The rest of this section describes the state at #71.

`vitest` 4.1 or later with `vite` crashed the resolver of npm 10.9.9 (`Cannot read properties of null (reading 'edgesOut')`).

- **Worked on npm 10, including CI:** `npm ci`, `npm audit` and adding a package.
- **Failed on npm 10:** `npm update` and installing without a lockfile.

The #71 lockfile was generated with npm 11.21.2.

## Deployment notes

Nothing to run or configure.

## Security review

**PASS.** No findings.

- All lockfile entries resolve to the npm registry with integrity, except 6 optional dev packages bundled inside `@tailwindcss/oxide-wasm32-wasi`. They have neither field because they ship in that package's tarball, which has its own integrity.
- No new install scripts and no typosquats. The 70 new package names were all traced to their parents.
- 33 of the new versions were under 48 hours old when locked, with valid provenance on the main ones.

## Known limitations / follow-ups

- **Not verified:** Capacitor runtime (`android/` and `ios/` are not in the checkout), Electron runtime and `electron:build` (no display here), real hosting and devices, Firefox and Safari, and the look of the PDFs.
- **Existing issue, not from this change:** on a static host, `html lang` stays `en` on `/fr` and `/de`, because the fallback `index.html` hardcodes it.
- **Findings with no issue:** `deepmerge` and `minimatch` (see Remaining audit findings).

## Changelog

- 2026-11-05: initial delivery
- 2026-11-05: npm crash cleared by #72
- 2026-11-05: smoke test failure explanation corrected by #72
