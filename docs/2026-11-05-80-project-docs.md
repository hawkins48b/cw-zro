# Project documentation

**Issue:** [#80](https://github.com/hawkins48b/cw-zro/issues/80)
**Status:** Delivered on `develop`, not in production yet

## What changed

The README is now an entry point, and the project has guides and a `CLAUDE.md`. No application code changed.

- [README.md](../README.md): quick start, every script, links to each guide. `Dependency Updates` and the licence section are unchanged.
- [CLAUDE.md](../CLAUDE.md): project rules. It was git-ignored, so `.gitignore` no longer lists it. `.claude` stays ignored.
- Guides, indexed in [docs/README.md](README.md): architecture, ballistics model, development, testing, deployment, translations, data and privacy.

## State described

The issue planned this for after #69, #77 and #79. Those are open or held, so the guides describe `develop` on 2026-11-05 and name each gap. Update them when those issues land.

## Verification

From a fresh clone at 29b9186, on Node 22.23.4 and npm 10.9.9: `npm ci`, `npm run test:run` (541 passed, 1 todo), `npm run build`, `npm run build:mobile`, `npm run audit:check`, `npm run cap:sync` and `npm run electron:build` all exit 0. `npm run cap:android` exits 1 with no platform added, as the guide says. All 129 relative links resolve, all 13 scripts are in the README, and stack versions match the lockfile. External links were not checked.

The docs were scanned for hostnames, addresses and credentials: only secret names appear.

## Not verified

- Android, iOS, Windows and macOS builds, and any device run
- The live host's behaviour on deep links
- Runtime network traffic: the privacy guide rests on reading the code and build output, and says so
