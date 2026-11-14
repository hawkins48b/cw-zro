# Desktop release on a version tag

- **Date:** 2026-11-14
- **Branch:** task/79-desktop-release
- **Issue:** [#79](https://github.com/hawkins48b/cw-zro/issues/79)
- **Status:** Delivered with known issues

## Summary

Before this change, desktop and mobile apps were built by hand. No workflow built or published them. Which platforms to ship and how to sign them were open owner decisions.

**Delivered:** pushing a tag `vX.Y.Z` on a commit of `main` now builds unsigned desktop installers for Windows, macOS and Linux. It publishes them as a GitHub release with a checksum file. Mobile stays out of CI. The decisions are recorded in the guides.

No tag has been pushed yet. The workflow has not run on GitHub, and the Windows and macOS builds have never run. The issue stays open until a first release confirms it.

## Decisions

### Owner decisions (2026-11-14)

| Topic | Decision |
|-------|----------|
| Platforms | Web, iOS, Android and desktop (Windows, macOS, Linux) |
| Signing | Desktop installers are unsigned for now |
| Native projects | `android/` and `ios/` stay git-ignored |
| Mobile in CI | Not until LGPL for store builds ([#143](https://github.com/hawkins48b/cw-zro/issues/143)) and the mobile CSP ([#135](https://github.com/hawkins48b/cw-zro/issues/135)) are settled |

### Developer defaults (not confirmed by the owner)

| Topic | Default | Reason |
|-------|---------|--------|
| macOS | Two dmgs, arm64 and x64, instead of one universal app | Merging a universal app is risky with the asar integrity and `onlyLoadAppFromAsar` fuses. No merge step, and each download is half the size |
| Branch | The tagged commit must be on `main` | Releases are cut from `main` (docs/deployment.md), so the installers match the web app in production |
| Architectures | Windows and Linux x64 only | The Windows and Linux builds run on x64 runners; no arm64 build was asked for |
| Pre-release tags | Not treated differently | No pre-release flow exists; a tag that matches `package.json` becomes a normal release |
| Artifact retention | 7 days | Long enough to re-run a failed release job, short enough not to keep unsigned binaries around |

The owner can change any of these.

## How to use

Only when the owner asks for a release. The full steps are in [Deployment: Desktop release](deployment.md#desktop-release).

1. On `develop`, set `version` in `package.json` (for example `2.1.0`) and update `package-lock.json` with `npm install --package-lock-only`.
2. Release `develop` to `main`. This also deploys the web app.
3. Tag the release commit on `main` with `v` + the version and push the tag.
4. Watch the Release run in the Actions tab, then check the release page.

The release holds `ZRO-X.Y.Z-win-x64.exe`, `ZRO-X.Y.Z-mac-arm64.dmg`, `ZRO-X.Y.Z-mac-x64.dmg`, `ZRO-X.Y.Z-linux-x86_64.AppImage` and `SHA256SUMS.txt`.

Users see a SmartScreen warning on Windows and a Gatekeeper warning on macOS on the first start. The release notes and the guide say how to start the app anyway, and how to check the file against `SHA256SUMS.txt`.

## Technical changes

- [`.github/workflows/release.yml`](../.github/workflows/release.yml) (new). Runs on a push of a `v*` tag. Default permission `contents: read`. One concurrency group per tag; a running release is never cancelled.

  | Job | What it does |
  |-----|--------------|
  | `ci` | Calls `ci.yml`: tests, build, audit |
  | `check` | Fails unless the tag is `v` + `package.json` `version`, and the tagged commit is an ancestor of `origin/main` |
  | `build` | Needs `ci` and `check`. Matrix `ubuntu-latest`, `windows-latest`, `macos-latest`: `npm ci`, `npm run build`, `electron-builder --publish never` with `CSC_IDENTITY_AUTO_DISCOVERY=false`. No secrets, no npm cache. Uploads the installers as artifacts, kept 7 days |
  | `release` | The only job with `contents: write`. No checkout, no npm. Downloads the artifacts, fails unless they are exactly the four expected files for this version, writes `SHA256SUMS.txt`, then `gh release create --verify-tag` with `GITHUB_TOKEN` |

- [`electron-builder.json`](../electron-builder.json): `artifactName` `${productName}-${version}-${os}-${arch}.${ext}`, so every installer name carries the platform and architecture. The mac target builds a dmg for `arm64` and `x64`.
- [`docs/deployment.md`](deployment.md): new "Desktop release" section (steps, jobs, files, unsigned installers, mobile), updated state table, branch table and known gaps. The old line "releases have no tags" is removed.
- [`docs/development.md`](development.md): new package names in the desktop table, link to the release section, mobile decision.
- [`README.md`](../README.md): status lines for desktop and mobile.

## Checks

| Check | Result |
|-------|--------|
| Node | 26.13.1 |
| `npm run test:run` | 35 files, 3951 passed, 1 todo |
| `npm run build` | Passed |
| Local Linux electron-builder run | Produced `ZRO-2.0.0-linux-x86_64.AppImage`. Desktop entry `Exec=AppRun %U`, icons present. The app was not started |
| `release.yml` parsed with js-yaml | Passed |
| Tag check script | `v2.0.0` passes, `v2.0.1` fails |
| Installer file-list check | The right four files pass; an extra file fails; a missing file fails |

### Not verified

These need a real tag push by the owner:

- Windows NSIS and macOS dmg builds on GitHub runners.
- The x64 dmg on an Intel Mac (it is built on the Apple silicon runner).
- `gh release create` publishing the release.
- The SmartScreen and Gatekeeper steps in the guide.
- The main-branch check on GitHub.

Suggested first try: bump to a new version on `develop`, release to `main`, and tag it.

## Deployment notes

- Nothing to configure. The workflow uses `GITHUB_TOKEN` only; no new secrets.
- Signing can be added later with repository secrets for electron-builder (`CSC_LINK`, `CSC_KEY_PASSWORD`, and `APPLE_ID`, `APPLE_APP_SPECIFIC_PASSWORD`, `APPLE_TEAM_ID` for notarization). None exist today.
- A tag push does not deploy the web app again: `ci.yml` and `deploy-prod.yml` only run on branches.
- If an upload fails, delete the draft release on GitHub, then re-run the failed jobs. `gh release create` fails if the release already exists.

## Security review

**PASS.** Three Low findings were fixed in the same branch:

| Finding | Fix |
|---------|-----|
| A build job could add an extra file to the release (artifact poisoning) | The `release` job fails unless the downloaded files are exactly the four expected installers |
| The docs presented the main-branch check as a control | GitHub runs the `release.yml` of the tagged commit, so a collaborator could tag a branch commit whose workflow skips the check. The docs now say the check stops mistakes, not a hostile collaborator. A tag ruleset on `refs/tags/v*` (an owner setting, like [#87](https://github.com/hawkins48b/cw-zro/issues/87)) would make it a control |
| Concurrency wording was unclear | Now "a running release is never cancelled" |

Pre-existing, noted and not changed:

- `main` has no branch protection ([#87](https://github.com/hawkins48b/cw-zro/issues/87)).
- `deploy-prod.yml` `workflow_dispatch` runs CI on any branch, but the deploy itself is gated to `main`.

## Acceptance criteria

| Criterion | Status |
|-----------|--------|
| Owner decides platforms and signing | Met |
| A tag creates a release with desktop installers | Built; not verified on GitHub |
| Decision on committing `android/` and `ios/` recorded | Met |
| Mobile not in CI, reason documented | Met |

## Known limitations / follow-ups

- The workflow has never run. Windows and macOS installers have never been built.
- Installers are unsigned and not notarized. There is no auto-update.
- The main-branch check is not a control until the owner adds a `refs/tags/v*` tag ruleset.
- Mobile builds wait for [#143](https://github.com/hawkins48b/cw-zro/issues/143) and [#135](https://github.com/hawkins48b/cw-zro/issues/135). Mobile apps cannot be rebuilt from the repository alone.
- The developer defaults above are not confirmed by the owner.

## Changelog

- 2026-11-14: initial delivery
