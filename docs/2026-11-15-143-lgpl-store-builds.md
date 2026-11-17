# What the LGPL asks of the app-store builds (#143)

Issue: [#143](https://github.com/hawkins48b/cw-zro/issues/143). Branch `task/143-lgpl-store`.

## Summary

ZRO embeds bclibc 2.0.0 (LGPL-3.0) through js-ballistics 3.1.0 (#77). The LGPL lets users run the app with a modified bclibc, which raised the question of what a Google Play or App Store build must offer. The owner settled it: the notice and the public source are enough. This delivery writes that decision down, adds the source link and the replacement steps to the notice shipped in every build, and documents the rebuild in full.

No change in `src/`, no new messages, no calculated result changed.

## Owner decision (2026-11-15)

- The public MIT source of ZRO, at [hawkins48b/cw-zro](https://github.com/hawkins48b/cw-zro), is the "Corresponding Application Code" of LGPL-3.0 section 4(d)(0): with it, anyone can rebuild ZRO with a modified bclibc.
- Google Play: nothing beyond what every build already has (notice, licence texts, in-app licences page).
- App Store: the same, plus a custom licence agreement in App Store Connect instead of Apple's standard EULA, whose usage restrictions the GPL-3.0 (section 10, incorporated by the LGPL-3.0) forbids.
- Installing a rebuilt iOS app needs the user's own Apple signing. Not addressed further.

## What changed

- [`static/licenses/THIRD-PARTY-NOTICES.txt`](../static/licenses/THIRD-PARTY-NOTICES.txt): new sections "Source code of ZRO" (link to the repository, named as the Corresponding Application Code) and "Replacing bclibc" (short steps, pinned to js-ballistics tag `v3.1.0`, commit `b71066fd5b80f1ee9b790a6b35a89bfd28a16315`). The notice is shipped in every build under `/licenses/` and shown on `/settings/about/licenses`.
- [`development.md`](development.md#replacing-the-bclibc-engine): new section "Replacing the bclibc engine": clone at the tag and check `git rev-parse HEAD`, change `lib/bclibc`, `make build` with zig or wasi-sdk 34, `npm pack`, then `npm install --no-save` of the package in ZRO, test and build. It notes that upstream does not pin `ziglang` and suggests `--with ziglang==<version>`, and lists what was checked.
- [`deployment.md`](deployment.md#mobile): Mobile section gets a table of what each store needs; store builds now wait only for #135.
- [`data-and-privacy.md`](data-and-privacy.md#app-store-builds): new "App-store builds" section with the decision and the same table.
- [`CLAUDE.md`](../CLAUDE.md): the js-ballistics update checklist now includes the js-ballistics tag in the notice and the rebuild steps.

## Acceptance criteria

| Criterion | State |
|-----------|-------|
| The owner has recorded what the LGPL requires for the Android and iOS store builds | Met: owner decision of 2026-11-15, recorded on the issue and in the docs |
| Whatever is required is done, or the store builds are held | Met for Android. For iOS, the custom licence agreement is an owner step in App Store Connect before the first submission. Store builds stay held for #135 |
| `docs/data-and-privacy.md` (Licences) states the outcome | Met: "App-store builds" |

## Checks

- The replacement steps were run for real with an unmodified bclibc: js-ballistics v3.1.0 rebuilt with wasi-sdk 34.0 (CMake 3.31.6, Yarn 1.22.22, Node 22); the module is 1,013,692 bytes. `npm install --no-save` of the package into a scratch ZRO copy: all tests pass, `package.json` and the lockfile unchanged. `npm run build` and `npm run build:mobile` pass and embed the rebuilt module.
- Not verified: the zig toolchain (not reachable), `npm run electron:build`, Android Studio and Xcode with the rebuilt engine, a modified bclibc.
- In the worktree on Node 26.13.1: 3951 tests pass (1 todo), `npm run build` passes.
- Security review: PASS. Two Low findings, both fixed: the docs give the js-ballistics commit SHA and a `git rev-parse HEAD` check; the docs note that upstream does not pin `ziglang` and suggest pinning it.

## Open

- The text of the iOS custom licence agreement is not written: owner step in App Store Connect before the first iOS submission.
- Store builds still wait for the device check of the mobile Content-Security-Policy ([#135](https://github.com/hawkins48b/cw-zro/issues/135)).
- A js-ballistics update must recheck the tag, commit and steps in the notice and in `development.md` (in the `CLAUDE.md` checklist).

## Changelog

- 2026-11-15: initial delivery
