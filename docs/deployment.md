# Deployment

This guide describes the state on 2026-11-05.

## Current state

| Target | State |
|--------|-------|
| Production web | Last successful deploy: 2026-03-03. **Nothing delivered since then is live** |
| `main` | Holds a release from 2026-11-04 whose deploy failed at the FTP step |
| `develop` | 11 commits ahead of `main`. Runs CI, deploys nowhere |
| Desktop | Built by hand. Linux AppImage verified, Windows and macOS not |
| Mobile | No build in the repository or in CI |

**The next deploy will fail unless `FTP_HOST` is fixed.** The last run stopped at the TLS check because the secret did not match the name on the server certificate. It stopped before login, so no credentials were sent and nothing was uploaded. The secret list shows that `FTP_HOST` has not changed since 2026-03-03. See [Before the next release](#before-the-next-release).

## Branch flow

| Branch | Purpose | Runs | Deploys |
|--------|---------|------|---------|
| `task/...` or other feature branch | Work on one issue, branched off `develop` | CI on a pull request | Nothing |
| `develop` | Integration | CI on every push | Nothing yet ([#69](https://github.com/hawkins48b/cw-zro/issues/69)) |
| `main` | Production | CI, then the deploy | **Production** |

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

There is no rollback step: build artifacts are kept for 1 day, and a deploy always ships the current `main`. To go back, merge a revert on `develop` and release it. `package.json` stays at 2.0.0, and releases have no tags.

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

**[#79](https://github.com/hawkins48b/cw-zro/issues/79), open.** No workflow builds or publishes them.

- Desktop packages are built by hand with `npm run electron:build`. The Linux AppImage was built and run. Windows and macOS packages have not been built.
- There is no code signing, no auto-update and no versioned release.
- `android/` and `ios/` are git-ignored, so mobile apps cannot be rebuilt from the repository alone. See [Development](development.md#mobile-build).
- Which platforms to ship, how signing works and whether to commit the native projects are owner decisions.

### Dependency decisions

`js-ballistics` ([#77](https://github.com/hawkins48b/cw-zro/issues/77)) is held. Its licence question affects every shipped build, and it also shifts results.

- `js-ballistics` 3.x embeds LGPL-3.0 code, and its results differ.
- ApexCharts is on 8.8.1 by owner decision of 2026-11-11 ([#75](https://github.com/hawkins48b/cw-zro/issues/75)), which accepts its current licence terms. Its `LICENSE.md` is the same in 8.7.0, 8.8.0 and 8.8.1. Its new dependency `apex-commons` 0.10.0 carries the same licence text under its own name.
