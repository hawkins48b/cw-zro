# 2026-11-17: picomatch ReDoS advisory accepted until 2026-12-17

Issue: [#176](https://github.com/hawkins48b/cw-zro/issues/176)

## Why

The CI `audit` job failed since #172 on [GHSA-fc5q-39xc-vjpf](https://github.com/advisories/GHSA-fc5q-39xc-vjpf) (picomatch ReDoS through single-branch repeated extglobs, high). While it fails, Deploy Dev does not run. Every published picomatch (≤ 4.0.7) is affected; there is no fixed release to upgrade to.

## What changed

`.github/audit-exceptions.json` accepts GHSA-fc5q-39xc-vjpf until **2026-12-17** (30 days, the rules allow up to 92), the owner's choice of "fix first".

## Why it is safe to ship

- picomatch is reached only through build and test tooling: vite (also through tinyglobby/fdir), vitest, unplugin (Paraglide), the SvelteKit packages and electron-builder.
- It matches glob patterns from our own config and file trees, never input from users.
- It is not in the shipped app: a production `build/` has no trace of it.

## Checks

- `npm run audit:check`: passed (15 findings accepted, all this advisory).
- No code change; tests and build unaffected.
- Security review: done by the main session (config only; the exception is the reviewed decision).

## Open

- When the exception expires, CI fails again: by then upgrade picomatch (or the packages that pin it) if a fix has shipped, or renew the exception with a new reason.
- The exception reaches deploys to production only once it is on `main` (README, "Accepting an exception").
