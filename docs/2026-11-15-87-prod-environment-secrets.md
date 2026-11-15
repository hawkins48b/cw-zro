# Production secrets in the prod environment (#87)

Issue: [#87](https://github.com/hawkins48b/cw-zro/issues/87), closed 2026-11-15.

## What changed

Repository settings, done by the owner on 2026-11-14:

- `FTP_HOST`, `FTP_USER` and `FTP_PWD` are `prod` environment secrets. There are no repository secrets any more, so a job in the `dev` environment cannot read them.
- The unused `SSH_PWD`, `SSH_USER`, `SERVER_HOST` and `SERVER_PATH` secrets were deleted from `prod` and `dev`. No workflow used them.

Code, branch `task/87-prod-environment`:

- [`.github/workflows/deploy-ftp.yml`](../.github/workflows/deploy-ftp.yml): the dev guard that refused `DEV_FTP_USER` or `DEV_FTP_PWD` equal to the production ones is removed. The dev job can no longer see `FTP_*`, so the guard did nothing. A missing production secret now reports "not all set in the prod environment".
- [`deployment.md`](deployment.md): secrets table, how a deploy runs, dev site setup (warns that `DEV_FTP_USER` must never be the production user) and Repository settings updated.

## Owner decisions

- 2026-11-14: drop the dev guard instead of replacing it with a `PROD_FTP_USER` variable or a password hash.
- 2026-11-15: do not protect `main` and do not restrict `prod` or `dev` to a branch. Close #87 without them.

## Acceptance criteria

| Criterion | State |
|-----------|-------|
| Deploy secrets are only available to the `prod` environment | Met |
| A run from another branch cannot use the `prod` environment | Not done, by decision. The ref check in `deploy-ftp.yml` stops mistakes; a branch can edit it |
| `main` is protected, and a release merge can still be pushed | Not done, by decision |
| Unused SSH secrets are removed or kept for a recorded reason | Met |
| A deploy from `main` still works | Not seen: no release since. The prod FTP step was already expected to fail on the host name (#66) |

## Checks

- actionlint on all workflows: no findings.
- Security review: PASS. Its wording suggestion (any branch can still declare `environment: prod`) is in `deployment.md`.

## Remaining risk

- Any workflow on any pushed branch can declare `environment: prod` and read `FTP_*`. `hawkins48b` is the only collaborator.
- Nothing checks that `DEV_FTP_USER` is not the production account: setting it to the production user would deploy `develop` to production.
- [`2026-11-14-69-dev-deploy.md`](2026-11-14-69-dev-deploy.md) still describes the guard; it is a record of that delivery and is left as is. `secrets: inherit` is still safe, as no repository secrets exist.
