# Deployment

This guide describes the state on 2026-11-05.

## Current state

| Target | State |
|--------|-------|
| Production web | Last successful deploy: 2026-03-03. **Nothing delivered since then is live** |
| `main` | Holds a release from 2026-11-04 whose deploy failed at the FTP step |
| `develop` | 11 commits ahead of `main`. Runs CI, deploys nowhere |
| Desktop | A `v*` tag builds unsigned installers and publishes a GitHub release ([`release.yml`](../.github/workflows/release.yml)). No tag pushed yet, so the workflow has not run. Linux AppImage verified by hand, Windows and macOS not run |
| Mobile | Not in CI. `android/` and `ios/` are git-ignored, by owner decision ([#79](https://github.com/hawkins48b/cw-zro/issues/79)) |

**The next deploy will fail unless `FTP_HOST` is fixed.** The last run stopped at the TLS check because the secret did not match the name on the server certificate. It stopped before login, so no credentials were sent and nothing was uploaded. The secret list shows that `FTP_HOST` has not changed since 2026-03-03. See [Before the next release](#before-the-next-release).

## Branch flow

| Branch | Purpose | Runs | Deploys |
|--------|---------|------|---------|
| `task/...` or other feature branch | Work on one issue, branched off `develop` | CI on a pull request | Nothing |
| `develop` | Integration | CI on every push | Nothing yet ([#69](https://github.com/hawkins48b/cw-zro/issues/69)) |
| `main` | Production | CI, then the deploy | **Production** |
| Tag `vX.Y.Z` on `main` | Desktop release | CI, then the desktop builds | A GitHub release with the installers |

1. Branch off `develop`.
2. Merge into `develop` when CI passes.
3. Merge `develop` into `main` only when the owner asks for a release.

**Never push to `main` for anything else: every push deploys to production.** Nothing in the repository settings prevents it yet ([#87](https://github.com/hawkins48b/cw-zro/issues/87)).

A `Closes #N` line closes the issue when it reaches `main`, even if the deploy fails. That happened to #66 and #68, which had to be reopened.

## Environments

| Environment | Used by | State |
|-------------|---------|-------|
| `prod` | The `deploy` job | No branch restriction or reviewers |
| `dev` | Nothing | Exists on GitHub. Its host and secrets are open ([#69](https://github.com/hawkins48b/cw-zro/issues/69)) |

There is no staging site, so a release cannot be checked on a real host first.

## Secrets

Only names are listed here. Values are in GitHub settings, and they never go in the repository.

| Name | Where | Use |
|------|-------|-----|
| `FTP_HOST` | Repository secret | Server name. Must match the name on the server certificate |
| `FTP_USER` | Repository secret | FTP user |
| `FTP_PWD` | Repository secret | FTP password |
| `SSH_PWD`, `SSH_USER`, `SERVER_HOST`, `SERVER_PATH` | `prod` and `dev` environments | Unused by any workflow. To remove ([#87](https://github.com/hawkins48b/cw-zro/issues/87)) |

The app itself has no secrets and no runtime configuration. `build/` contains no environment values.

## How a deploy runs

[`deploy-prod.yml`](../.github/workflows/deploy-prod.yml) runs on a push to `main`, or by hand from the Actions tab.

1. The `ci` job calls [`ci.yml`](../.github/workflows/ci.yml): tests, build and audit. The build is uploaded as an artifact, kept for 1 day.
2. The `deploy` job needs `ci`, and runs only on `refs/heads/main`. Started from another branch, the workflow runs CI and skips the deploy.
3. The `deploy` job downloads the artifact and sends it by FTPS with strict certificate checks. It has no checkout and no npm, so no dependency code runs beside the FTP password, and production gets exactly the tested build.

A failed audit blocks a deploy, even with no change to the dependencies. See [Audit](../README.md#audit).

A running deploy is never cancelled, and a newer run replaces a queued one.

## Before the next release

| Check | Who | Issue |
|-------|-----|-------|
| Set `FTP_HOST` to the hostname on the server certificate | Owner | [#66](https://github.com/hawkins48b/cw-zro/issues/66) |
| Rotate `FTP_PWD` | Owner | [#66](https://github.com/hawkins48b/cw-zro/issues/66) |
| Check `AllowOverride` includes `FileInfo`, and that no `.htaccess` at the FTP root gets overwritten (see [Deep links](#deep-links-on-the-web-host)) | Owner | [#67](https://github.com/hawkins48b/cw-zro/issues/67) |
| Confirm that Dependabot security updates are off | Owner | [#78](https://github.com/hawkins48b/cw-zro/issues/78) |
| Accept the shifts in saved results listed below | Owner | |

The first successful deploy replaces content at the FTP root, which the owner has confirmed is allowed (#66).

### What users will notice

Saved profiles keep their values, but some results shift as soon as this is live:

- Powder sensitivity now means fps per degree ([#81](2026-11-04-81-powder-sensitivity.md)).
- Saved humidity of 1 or less now means that percentage ([#84](2026-11-05-84-humidity-fraction.md)).
- MPBR finds a better arc, and dope cards print computed near and far zeros ([#86](2026-11-05-86-mpbr-search.md)).
- "Set MPBR" saves the near zero as a whole unit, for example 21 yd for an 8 in target on the `.308` test profile. Between #86 and #109, `develop` saved the far zero (249 yd there). MPBR distances shrink slightly against #86, at most 2.2 % on the baseline cases. A sight height of 0 or less gives no MPBR result ([#109](2026-11-11-67-109-110-fallback-near-zero-mit.md)).
- Opening or reloading an inner page such as `/profiles` or `/fr/profiles` now loads the app ([#67](2026-11-11-67-109-110-fallback-near-zero-mit.md)).
- The About page says ZRO is under the MIT licence ([#110](2026-11-11-67-109-110-fallback-near-zero-mit.md)).
- Trajectory validation has a Below / Above choice ([#82](2026-11-05-82-83-validation-solver.md)).
- The minimum browsers rise to Safari 16.4, Chrome 111 and Firefox 114 ([#72](2026-11-05-72-toolchain.md)).

## Release

Only when the owner asks:

1. Check that CI on `develop` is green.
2. Merge `develop` into `main` with a merge commit, and push.
3. Watch the Deploy Prod run to the end.

Then:

1. Check the live site, including the profile list edit button ([#66](https://github.com/hawkins48b/cw-zro/issues/66)).
2. Check that Dependabot pull requests start, target `develop` and run CI ([#78](https://github.com/hawkins48b/cw-zro/issues/78)). It reads its configuration from `main` only, so it does nothing until a release.
3. Reopen any issue that a `Closes` line closed too early.

There is no rollback step: build artifacts are kept for 1 day, and a deploy always ships the current `main`. To go back, merge a revert on `develop` and release it.

## Desktop release

The web release above does not need a tag. A desktop release does. Only when the owner asks:

1. On `develop`, set `version` in `package.json` to the new version, for example `2.1.0`, and run `npm install --package-lock-only` so `package-lock.json` matches. Merge it like any change.
2. Release `develop` to `main` as above. This also deploys the web app.
3. Tag the release commit on `main` and push the tag:

   ```bash
   git fetch origin
   git tag v2.1.0 origin/main
   git push origin v2.1.0
   ```

4. Watch the Release run in the Actions tab, then check the release page.

[`release.yml`](../.github/workflows/release.yml) runs on a push of a tag that starts with `v`:

| Job | What it does |
|-----|--------------|
| `ci` | Calls [`ci.yml`](../.github/workflows/ci.yml): tests, build, audit |
| `check` | Fails unless the tag is `v` + the `version` in `package.json`, and the tagged commit is on `main` |
| `build` | On `ubuntu-latest`, `windows-latest` and `macos-latest`: `npm ci`, `npm run build` (the web build, not `build:mobile`), then electron-builder with `--publish never`. No secrets, no npm cache, `CSC_IDENTITY_AUTO_DISCOVERY=false`. Uploads the installers as artifacts, kept 7 days |
| `release` | The only job with `contents: write`. No checkout and no npm. Downloads the installers, fails unless they are exactly the four files listed below for this version, writes `SHA256SUMS.txt` and runs `gh release create` with `GITHUB_TOKEN` |

The builds need `ci` and `check`, so a failing test, audit or check stops the release before anything is published.

The workflow refuses a tag on a commit that is not on `main`, such as a commit of `develop` or a feature branch. This stops mistakes, but it is not a control: GitHub runs the `release.yml` of the tagged commit, so anyone who can push a tag can tag a branch commit whose workflow skips the check. A tag ruleset on `refs/tags/v*` would make it one. That is an owner setting, like the branch protection in [#87](https://github.com/hawkins48b/cw-zro/issues/87). `ci.yml` and `deploy-prod.yml` only run on branches, so a tag push does not deploy the web app again.

Runs for the same tag share one concurrency group. A running release is never cancelled. GitHub keeps only one pending run per group, so a newer run replaces a pending one. `gh release create` fails if the release exists. It uploads to a draft and publishes at the end: if an upload fails, delete the draft release on GitHub, then re-run the failed jobs. To replace a published release, delete it and its tag, fix the problem, and tag again with a new version.

The release holds:

| File | Platform |
|------|----------|
| `ZRO-X.Y.Z-win-x64.exe` | Windows, NSIS installer |
| `ZRO-X.Y.Z-mac-arm64.dmg` | macOS, Apple silicon |
| `ZRO-X.Y.Z-mac-x64.dmg` | macOS, Intel. Built on the Apple silicon runner |
| `ZRO-X.Y.Z-linux-x86_64.AppImage` | Linux |
| `SHA256SUMS.txt` | SHA-256 of each file above |

The names come from `artifactName` in [`electron-builder.json`](../electron-builder.json). macOS gets two dmgs rather than one universal app: no merge step, and each download is half the size.

### Unsigned installers

By owner decision ([#79](https://github.com/hawkins48b/cw-zro/issues/79)), the installers are not signed and not notarized. The release notes say so. Users see a warning on the first start:

| Platform | Warning | How to start it |
|----------|---------|-----------------|
| Windows | SmartScreen: "Windows protected your PC" | "More info", then "Run anyway" |
| macOS | Gatekeeper: the app "cannot be opened" or "is damaged" | Try to open it once, then System Settings, Privacy & Security, "Open Anyway". If macOS says the app is damaged: `xattr -dr com.apple.quarantine /Applications/ZRO.app` |
| Linux | None. The AppImage must be executable | `chmod +x ZRO-*.AppImage` |

Users should first compare the file with `SHA256SUMS.txt` (`sha256sum`, `shasum -a 256` on macOS, `Get-FileHash` on Windows). The checksums come from the same release, so they catch a broken download, not a replaced release.

The macOS app carries only the ad-hoc signature that the `resetAdHocDarwinSignature` fuse writes, which Apple silicon needs to run it at all. Signing can be added later with repository secrets for electron-builder (`CSC_LINK`, `CSC_KEY_PASSWORD`, and for notarization `APPLE_ID`, `APPLE_APP_SPECIFIC_PASSWORD`, `APPLE_TEAM_ID`). None exist today. Signing material never goes in the repository.

### Mobile

Mobile apps are not built in CI, by owner decision ([#79](https://github.com/hawkins48b/cw-zro/issues/79)):

- `android/` and `ios/` stay git-ignored, so the native projects are not in the repository. See [Development](development.md#mobile-build).
- Store builds wait for LGPL compliance of the engine ([#143](https://github.com/hawkins48b/cw-zro/issues/143)) and a Content-Security-Policy for the mobile build ([#135](https://github.com/hawkins48b/cw-zro/issues/135)).

## Known gaps

### Deep links on the web host

**[#67](https://github.com/hawkins48b/cw-zro/issues/67).** The app is a single `index.html` with client-side routes. Without a rewrite rule, opening or reloading an inner URL such as `/profiles` or `/fr/profiles` can give the host's 404, while moving around inside the app works.

- The fix, [`static/.htaccess`](../static/.htaccess), is on `develop` and is copied to `build/`. Its rules are in [the delivery document](2026-11-11-67-109-110-fallback-near-zero-mit.md#deep-links-on-apache-67).
- It was tested on a local Apache 2.4.69, not on the real host. The owner said on 2026-11-11 that the host is fine.
- A `.htaccess` can give a site-wide 500 or 403 when the server does not allow its directives, and a deploy overwrites any `.htaccess` already at the FTP root. Before the release that carries it, the owner checks that `AllowOverride` includes `FileInfo` and that no existing `.htaccess` at the FTP root would be overwritten.
- Rollback: delete `.htaccess` from the FTP root.

### Repository settings

**[#87](https://github.com/hawkins48b/cw-zro/issues/87), open.** `main` is not protected, `prod` has no branch rule, and the FTP secrets are repository secrets. The `if` on the deploy job lives in the workflow file, so a branch can change it. Only settings can enforce this, and only the owner can change them. `hawkins48b` is the only collaborator today, which limits the risk.

### CI proof

**[#68](https://github.com/hawkins48b/cw-zro/issues/68), open.** Two criteria have not been seen on GitHub: a run on a pull request, and a failing test blocking a deploy.

### Production fix

**[#66](https://github.com/hawkins48b/cw-zro/issues/66), open.** `npm ci`, tests and build pass on `main`. The FTP step has not.

### Dev deployment

**[#69](https://github.com/hawkins48b/cw-zro/issues/69), open.** The branch flow is agreed. The `dev` deployment, its host and its own FTP secrets are not done.

### Desktop and mobile releases

**[#79](https://github.com/hawkins48b/cw-zro/issues/79), open.** See [Desktop release](#desktop-release).

- No tag has been pushed, so the Release workflow, and the Windows and macOS builds, have not run. Only the Linux AppImage has been built and run, by hand.
- The installers are not signed, and there is no auto-update.
- Mobile apps are not built in CI and cannot be rebuilt from the repository alone ([Mobile](#mobile)).

### Dependency decisions

Both libraries with licence questions are pinned by owner decision.

- `js-ballistics` is on 3.1.0 by owner decision of 2026-11-11 ([#77](https://github.com/hawkins48b/cw-zro/issues/77)), which accepts the LGPL-3.0 engine it embeds (bclibc) and the result shifts. Every build ships the notice and licence texts ([Licences](data-and-privacy.md#licences)). App-store LGPL compliance: open, see [#143](https://github.com/hawkins48b/cw-zro/issues/143).
- ApexCharts is on 8.8.1 by owner decision of 2026-11-11 ([#75](https://github.com/hawkins48b/cw-zro/issues/75)), which accepts its current licence terms. Its `LICENSE.md` is the same in 8.7.0, 8.8.0 and 8.8.1. Its new dependency `apex-commons` 0.10.0 carries the same licence text under its own name.
