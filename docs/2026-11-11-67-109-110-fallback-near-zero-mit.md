# Deep links on Apache, MPBR near zero, MIT licence

- **Date:** 2026-11-11
- **Branch:** task/67-109-110
- **Issues:** [#67](https://github.com/hawkins48b/cw-zro/issues/67), [#109](https://github.com/hawkins48b/cw-zro/issues/109), [#110](https://github.com/hawkins48b/cw-zro/issues/110)
- **Status:** Not in production yet

## Summary

Three issues in one branch.

| Issue | Change |
|-------|--------|
| #67 | [`static/.htaccess`](../static/.htaccess) sends inner URLs such as `/profiles` or `/fr/profiles` to `index.html` on Apache, so opening or reloading them loads the app |
| #109 | "Set MPBR for current profile" saves the near crossing as the zero, as a whole unit, not the far crossing. A sight height of 0 or less gives no MPBR result |
| #110 | ZRO is under the MIT licence: [`LICENSE`](../LICENSE), README, `package.json` and the About page say so |

**Release notes:**

- Opening or reloading an inner page of the web app (for example `/profiles`) now loads it.
- "Set MPBR" now saves the near zero: 21 yd instead of 249 yd for an 8 in target on the `.308` test profile.
- MPBR distances shrink slightly, at most 2.2 % on the baseline cases.
- A sight height of 0 or less gives no MPBR result.

## Deep links on Apache (#67)

### History

The fix was built on 2026-11-04 on `task/67-spa-fallback` (commits `208655e` and `1a6ad35`). It was reviewed then (PASS) and tested on a local Apache 2.4.69, not on the real host. It was held off `develop` because a `.htaccess` can give a site-wide 500 or 403 on some server settings, and a deploy overwrites any `.htaccess` already at the FTP root. The owner confirmed on 2026-11-11 that the host is fine. The two commits were rebased onto `develop` in this branch.

The 2026-11-04 branch also added a `safeReturnPath.js` for the ammo selector's `?return=` parameter. It was dropped in the rebase: `develop` already has a stricter `safeReturnPath` in [`profileOps.js`](../src/lib/utils/profileOps.js), which accepts only a profile page, with or without a locale prefix. The 2026-11-04 delivery doc was never on `develop` and is not added.

### Rules

[`static/.htaccess`](../static/.htaccess) is copied to the root of `build/`. It only acts when `mod_rewrite` is loaded (`<IfModule mod_rewrite.c>`). Rules in order, first match wins:

| Request | Result |
|---------|--------|
| A path with a segment starting with a dot, except `.well-known` | 404. This hides the FTP deploy action's state file at the root |
| A directory, except the root | 404 |
| A real file, or the root | Served as it is |
| A missing path under `_app/` or `pdf/` | Real 404, no HTML in place of a script or a PDF |
| A missing path whose last segment has a dot (an extension) | Real 404 |
| Anything else | `index.html`, and the client router takes the route |

### Rollback

Delete `.htaccess` from the FTP root. The next deploy puts it back unless the commit is reverted on `develop`.

### Limitations

- It works only when the app is at the domain root. Under a subfolder, the rewrite to `index.html` and the app's paths would not match.
- An unknown route answers HTTP 200 with the app's own error page, not a 404.
- A route whose last segment has a dot gets a real 404. No current route has one.
- Not tested on the real host. Before the release, the owner checks that `AllowOverride` includes `FileInfo` and that no `.htaccess` already at the FTP root would be overwritten. See [Deployment](deployment.md#deep-links-on-the-web-host).

## MPBR near zero (#109)

### Owner decisions (2026-11-11, on #109)

| Question | Decision |
|----------|----------|
| Which crossing to save | The near crossing, as the closest whole unit that keeps the apex inside the zone |
| Precision | Whole units. A near zero to 0.1 unit was measured (about 1 % loss up to 30 in or 100 cm) and declined |
| Sight height of 0 or less | No result: there is no near crossing |

### Implementation

In `calculateMPBR` ([`ballisticCalculator.js`](../src/lib/utils/ballisticCalculator.js)):

1. The bisection to the arc whose apex touches the top of the zone is unchanged (#86).
2. A new `ascentCrossing(rows, top, height)` finds where that arc comes up through the line of sight before the apex. If the first row is already on or over the line (sight height 0 or less), it returns null and so does `calculateMPBR`.
3. The zero tries the unit under the crossing first, `max(floor(crossing), 1)`. The solver zeroes about 0.1 yd past the distance, which lowers a near zero arc, so the unit under can still keep the apex inside, as 21 yd does for a crossing at 21.06 yd on the `.308` with 8 in.
4. If the apex is over the top of the zone, it takes the unit above, `ceil(crossing)`. A further near zero gives a lower arc.
5. A crossing under 1 unit gives a zero of 1 (`MIN_ZERO_DISTANCE`), never 0, which would hang the solver.
6. If the apex is still over the top, or the whole unit lands past the apex (a far zero, on a zone a few thousandths of an inch thin), there is no result. The old check `farZero !== optimalZero` is now `nearZero !== optimalZero`.

At most 2 zero solves, as before, so the documented cost bound (54 fires, 174 integrations) is unchanged. Every returned value still describes the shot zeroed at `optimalZero`, which now equals `nearZero`. [Ballistics model](ballistics-model.md#mpbr) is updated.

### Baseline changes

`ballistics.baseline.test.js`, `mpbr8in` and `mpbr20cm`. `nearZero` did not change and `mpbrMin` stays 0 in every row. Max ordinate is elevation @ distance.

| Profile, target | optimalZero | farZero | mpbrMax | maxOrdinate |
|-----------------|-------------|---------|---------|-------------|
| `P223_G1`, 8 in | 287 → 39 | 287 → 286 | 332.3 → 331.7 | 4 @ 170 → 3.9 @ 170 |
| `P223_G1`, 20 cm | 261 → 36 | 261 → 260 | 302.2 → 301.4 | 9.9 @ 155 → 9.8 @ 154 |
| `P308_G1`, 8 in | 249 → 21 | 249 → 249 | 293.4 → 293.1 | 4 @ 139 → 4 @ 138 |
| `P308_G1`, 20 cm | 226 → 20 | 226 → 220 | 266.4 → 261.3 | 9.9 @ 126 → 9.2 @ 123 |
| `P65_G7`, 8 in | 265 → 27 | 265 → 264 | 312 → 311 | 4 @ 149 → 3.9 @ 148 |
| `P65_G7`, 20 cm | 241 → 25 | 241 → 239 | 283.6 → 281.7 | 9.9 @ 135 → 9.7 @ 134 |
| `P338_G7_METRIC`, 8 in | 292 → 31 | 292 → 287 | 343.4 → 338.9 | 4 @ 164 → 3.8 @ 162 |
| `P338_G7_METRIC`, 20 cm | 265 → 28 | 265 → 265 | 311.7 → 311.8 | 9.9 @ 149 → 10 @ 149 |

`dopeCard.baseline.test.js`, crossings printed for a saved MPBR zero on `P308_G1` (near / far):

| Card, target | Before | After |
|--------------|--------|-------|
| Imperial, 8 in | 21 / 249 | 21 / 249 (unchanged) |
| Metric, 8 in | 19.3 / 227.8 | 19.4 / 227.5 |
| Imperial, 20 cm | 21 / 247 | 22 / 240 |
| Metric, 20 cm | 19.5 / 226.1 | 20.1 / 219.8 |
| Imperial, 100 in | 6 / 678 | 6 / 667 |
| Metric, 100 in | 5.5 / 620.1 | 5.6 / 609.6 |

Other values changed in the MPBR search tests on `P308_G1`: 30 in 498.9 → 479.2, 20 in 424.3 → 417.7, 300 in zero 995 → 4 and 1144.2 → 1048.8, 1 in `mpbrMin` 25.7 → 25.9, a 300 fps load zero 30 → 3 and 36.2 → 31.6. The near zeros on 4 in and 6 in are 28 and 24 (far zeros 193 and 223 before).

### Cost of a whole unit near zero

One unit of near zero moves the arc far more than one unit of far zero, so the apex can end well under the top of the zone. `mpbrMax` against the arc that touches the top, developer's measurements on the four test profiles, in and cm, sizes 0.001 to 33000:

| Targets | Largest loss |
|---------|--------------|
| The 8 baseline cases | 2.2 % (`.308`, 20 cm) |
| Up to 30 in or 100 cm | 4 % |
| 100 in to 1000 in | 8.4 % |
| Near crossing under 1 unit (about 3000 in and up) | 10 to 27 % |
| A 300 fps load on 8 in | 15 % |

Before #109 the far zero lost at most 1 unit.

### Test changes

In [`ballistics.baseline.test.js`](../src/test/ballistics.baseline.test.js), `MPBR search (#86)`:

- The brute-force walks now go over whole near zeros (1 to 60 on 8 and 30 in, 1 to 10 on 300 in) and must match `mpbrMax` within 0.1.
- The 0.05 yd walk over every zero, measured once for #86, is now an upper bound: `mpbrMax` is at most 0.1 over it and loses at most a per-size share (3.1 % on 8 in, 1.6 % on 20 in, 4 % on 30 in, 8.4 % on 300 in).
- Imperial against metric: `mpbrMax` is compared as a share (3 %, 1 %, 4 %, 4 % on 8, 20, 30 and 100 in) instead of within 1 unit. Whole-yard and whole-metre near zeros round to different arcs, so each side loses its own share. The apex is no longer compared across units; each side checks that it stays inside its zone.
- New: the zero is the closest whole near zero that keeps the apex inside (36, 31 and 21 on 2, 3 and 8 in, checked against the apex of the zero one unit closer); a 3000 in zone, near crossing 0.8 yd, gives a zero of 1; sight heights of 0 and -1 give null.
- Zeros now get smaller as the target grows, since a higher arc comes up through the line of sight sooner.
- On a 33000 in target `mpbrMax` must exceed 3000 instead of 4000.

In [`nanElevation.test.js`](../src/test/nanElevation.test.js), the sight-height-0 profile now expects `calculateMPBR` to return null, and checks that it got past the guards and fired.

## MIT licence (#110)

| File | Change |
|------|--------|
| [`LICENSE`](../LICENSE) | New. MIT, "Copyright (c) 2026 hawkins48b" |
| [`README.md`](../README.md#license) | License section: MIT, see LICENSE; third-party packages keep their own licences. Was "Proprietary" |
| `package.json`, `package-lock.json` | `"license": "MIT"` |
| `messages/en.json`, `fr.json`, `de.json` | `about_open_source_desc` names the MIT licence |

`js-ballistics` 2.2.0-beta.2 is ISC, so the existing credit on the About page is accurate.

## Checks

- `npm run test:run`: **3868 passed, 1 todo**, in 33 files (run again for this document).
- `npm run build`, `npm run build:mobile` and `npm run audit:check` passed (developer).
- [Testing](testing.md) and [Ballistics model](ballistics-model.md) are updated. [Deployment](deployment.md) now says the deep link fix is on `develop` and lists the release checks.

## Security review

PASS. One Low finding: [Deployment](deployment.md) still said the deep link fix was held off `develop`. Fixed with this document.

## Known limitations / follow-ups

- The MPBR page was not viewed in a browser after the change.
- `mpbr_about_zero` ("The bullet arcs up to the top of the target zone") is now only roughly true, since the apex can sit under the top. The text was not changed.
- The `.htaccess` was not tested on the real host. See the deep link limitations above.
- No `LICENSE` or third-party licence texts ship in the web bundle or the Electron package. This was already so before #110.

## Changelog

- 2026-11-11: initial delivery
