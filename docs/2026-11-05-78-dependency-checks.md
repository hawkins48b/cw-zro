# Automated dependency checks

- **Date:** 2026-11-05
- **Branch:** task/78-dependency-checks
- **Issue:** [#78](https://github.com/hawkins48b/cw-zro/issues/78)
- **Status:** Delivered on `develop`, not in production yet

## Summary

The project fell behind on its libraries because nothing reported new versions or advisories. The goal was weekly update pull requests from Dependabot, and a CI check that fails on high or critical audit findings, with a documented way to accept an exception.

**Delivered:**

- **Dependabot:** a configuration for npm and GitHub Actions. **It has no effect yet.** Dependabot reads it from `main` only, so the first pull requests can only come after a release.
- **Audit:** an `audit` job in CI, which works as soon as this is on `develop`. Today it passes, with 0 critical, 0 high, 6 moderate and 4 low findings.

**The issue stays open.** Two of its three criteria can only be checked after a release:

| Criterion | State |
|-----------|-------|
| Dependabot opens grouped pull requests for npm and GitHub Actions | Open: no Dependabot pull request exists yet |
| Update pull requests run CI | Open: CI runs on every pull request, but no update pull request exists to show it |
| CI fails on new high or critical audit findings | Met: shown with real npm, see [Checks](#checks) |

### Effect on the owner

- Update pull requests will arrive every week, against `develop`, once a release has put the configuration on `main`.
- A failed audit stops a production deploy, even when no dependency changed. So does a registry outage: rerun the job once the registry is back.

## How to use

The [Dependency Updates](../README.md#dependency-updates) section of the README is the reference. It covers the update rules, what to do for each exit code, and how to accept an exception.

`npm run audit:check` runs the same check locally.

## Technical changes

- **Dependabot:** [`.github/dependabot.yml`](../.github/dependabot.yml) covers npm and `github-actions`, weekly, targets `develop`, allows 5 open pull requests per ecosystem, and groups minor and patch updates.
- **CI:** a new `audit` job in [`.github/workflows/ci.yml`](../.github/workflows/ci.yml) runs `npm run audit:check`. `deploy-prod.yml` calls this workflow, so the deploy depends on the job.
- **Check:** [`scripts/audit-check.js`](../scripts/audit-check.js) runs `npm audit` and sets the exit code. The decisions are in [`scripts/audit-rules.js`](../scripts/audit-rules.js), which has no process, network or file access.
- **Exceptions:** [`.github/audit-exceptions.json`](../.github/audit-exceptions.json), empty today.
- **Tests:** 84 new tests in [`src/test/auditCheck.test.js`](../src/test/auditCheck.test.js), with sample reports in [`src/test/fixtures/auditReports.js`](../src/test/fixtures/auditReports.js).
- **Script:** `audit:check` in [`package.json`](../package.json).
- **Correction:** the [#76 document](2026-11-05-76-electron.md) said `npm audit --json` fails on npm 10.9.9. The failure is intermittent, and the document now says so.

## How the audit decides

| Exit code | Meaning |
|-----------|---------|
| 0 | Passed |
| 1 | At least one high or critical finding without a live exception |
| 2 | Could not decide |

**The check fails closed.** A result it cannot trust counts as failed, never as passed. This covers a registry outage, an audit that covered no dependencies, an invalid exceptions file and a crash of the check itself. Exit code 2 keeps these apart from a real finding.

**Pinned audit flags:** `npm audit` is called with fixed values for four settings, because each could otherwise shrink or skip the audit with no error.

| Flag | What it prevents |
|------|------------------|
| `--registry` | A mirror answering that nothing is wrong |
| `--offline=false` | No request being sent at all |
| `--package-lock=true` | Every transitive package being dropped |
| `--include` for dev, optional and peer | Those packages being left out |

Two review rounds found these. The registry flag was the third fix. To check it, `npm_config_registry` was pointed at a dead address: the audit still reached the real registry and passed.

## Decisions

- **`apexcharts`:** all updates are ignored, not only majors, until the owner decides on its licence ([#75](https://github.com/hawkins48b/cw-zro/issues/75)).
- **`js-ballistics`:** it always gets its own pull request, because its results need owner approval ([#77](https://github.com/hawkins48b/cw-zro/issues/77)).
- **FTP deploy action:** it always gets its own pull request, because it runs with the FTP password.
- **Separate `audit` job:** it runs no `npm ci`, so no dependency code runs there. A finding also does not hide the test results.

## Checks

**541 passed, 1 todo**, 84 of them in `auditCheck.test.js`. `npm run audit:check` passes with 0 critical, 0 high, 6 moderate and 4 low. The test run, the audit and the dead registry check were rerun for this document.

The failure paths were shown with real npm and were not rerun:

- A scratch project with a vulnerable dependency.
- A mock registry.
- Stale, expired and malformed exceptions.

All of this ran locally, not in GitHub Actions.

## Deployment notes

- **After the next release:** Dependabot starts reading its configuration. Check that its pull requests target `develop` and run CI, then close the two open criteria and the issue.
- **Owner action:** confirm in the repository settings that Dependabot security updates are off, because they target `main` and ignore the rules above. The current token cannot read this setting, and no file in the repository can enforce it.
- **Exceptions:** a deploy only sees an exception once it is on `main`.

## Security review

Findings F1 to F5 and G1 are all fixed. The pinned audit flags above came out of this review.

## Known limitations / follow-ups

**Not observable yet:**

- **Dependabot pull requests:** none can exist until a release puts the configuration on `main`.
- **`engine-strict` under Dependabot:** `.npmrc` sets it, and `jsdom` needs Node 22.22.2 or later. How Dependabot's own update runs behave with it has not been seen.
- **A blocked deploy:** the workflow makes the deploy depend on CI, but no failed audit has actually stopped one.

**Left open:**

- **Empty answers:** a registry that answers 200 with an empty result cannot be told from a clean audit.
- **Workspaces:** the project has none. Adding them would need `--include-workspace-root` in the audit flags.
- **No schedule:** CI only audits on pull requests, pushes and deploys, so a new advisory goes unnoticed while the repository is quiet. A weekly scheduled run would be a follow-up.
- **Repository settings:** branch protection and the `prod` environment have no restrictions ([#87](https://github.com/hawkins48b/cw-zro/issues/87)).

## Changelog

- 2026-11-05: initial delivery
