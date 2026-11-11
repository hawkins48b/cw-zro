# Ballistic step maximum, profile ids in links, Scope View angle limit, max drop and subsonic distance

- **Date:** 2026-11-11
- **Branch:** task/133-step-ids-angle-drop
- **Issues:** [#94](https://github.com/hawkins48b/cw-zro/issues/94), [#129](https://github.com/hawkins48b/cw-zro/issues/129), [#133](https://github.com/hawkins48b/cw-zro/issues/133), [#134](https://github.com/hawkins48b/cw-zro/issues/134)
- **Status:** Not in production yet

## Summary

Four issues in one branch. #129, #133 and #134 follow up the security reviews of [#120](2026-11-10-120-stored-values-charts.md) and [#127](2026-11-11-127-stored-step-labels.md). #94 finishes what [#85](2026-11-05-85-max-apex.md) did for max apex.

| Issue | Change |
|-------|--------|
| #133 | The Ballistic table step has a maximum, the range. A larger or infinite step shows a message, and the table is computed at the range (muzzle row and range row) instead of being empty |
| #134 | Profile ids that a link cannot carry are renumbered when the list is read, so every profile can be opened and made active. The active profile and Compare Trajectories entries follow the new ids |
| #129 | A Scope View angle in degrees gives a result only when it is strictly between -90° and 90°, otherwise a message |
| #94 | Max drop and subsonic distance no longer depend on the table step and never come from a row past the range. **Results change at coarse steps** (owner approved, see below) |

**Release note:** max drop and subsonic distance values change at coarse steps. Within the requested range and at step 1, they are the same as before.

## Ballistic table step maximum (#133)

Owner decision: the step maximum is the range.

On the Ballistic page (`/calculators/ballistic`), the Step box under the range:

- From 1 to the range: no message, the same table as before.
- Above the range, or infinite (`1e9`, `1e999`): the new message `ballistic_step_max` ("Enter a step of at most {max} {unit}, the max distance", in en, fr and de), and the box gets `aria-invalid`. The table uses the range as the step, so it shows the muzzle row and the row at the range. Before, such a step gave no table at 3000 yd ("Max range not reached") or only the muzzle row.
- Under 1, text or NaN: the existing `ballistic_step_min` message (#130).
- Empty box (25) on a range under 25: the range is used, without a message.
- A range under 1 gives a maximum of 1, so the two limits never cross. Without a usable range there is no maximum; the range box shows its own message.

A stored step is read the same way, so a stored step above the range also shows the message. The charts use the same capped step for their tick count.

In [`inputLimits.js`](../src/lib/utils/inputLimits.js): new `maxTableStep(distance)`; `tableStep(step, distance)` caps the step at it; new `tableStepLimit(step, distance)` returns `'min'`, `'max'` or `null`; `isUsableTableStep` now takes the range and uses it. [`ballisticCalculator.js`](../src/lib/utils/ballisticCalculator.js) passes the range to `tableStep`.

## Profile ids in links (#134)

Owner decision: renumber on read, as #131 does for duplicates. In `normalizeProfiles` ([`storedProfiles.js`](../src/lib/utils/storedProfiles.js)):

| Stored id | Read as |
|-----------|---------|
| Empty, `new`, `ammo-selector`, `.`, `..` (`UNUSABLE_IDS`) | `profile` |
| Containing `/`, `?`, `#`, `%`, `\`, a tab or a line break | Each of those characters becomes `-` |
| Spaces or control characters at either end | Each becomes `-` |
| A space inside the id | Kept: the browser encodes it and the route gives it back |
| Any other id | Unchanged |

A renumbered id never takes an id stored on another profile, even later in the list; when it would, it gets `-2`, `-3` and so on, as a duplicate does. The result depends only on the list, so it is the same at every read. The trim at the ends is a loop from each end, not a regular expression (linear time, see the security review). `new` and `ammo-selector` are the static routes under `/profiles/`; a spec fails when a new static child route is added and not listed.

Stored references follow the new ids. When the profiles store ([`profiles.svelte.js`](../src/lib/stores/profiles.svelte.js)) loads and finds renamed ids (`findProfileIdRenames`), it writes the renumbered list and, in the same step, rewrites `zro-active-profile` (`renameActiveProfileId`) and the entries of `zro-compare-traj` (`renameCompareEntries`), whatever page the session starts on. Nothing is written when nothing changes or when a key is missing, and damaged values are left as stored. The active profile and compare stores import the profiles store, so they read the rewritten values; [`compareTrajectories.svelte.js`](../src/lib/stores/compareTrajectories.svelte.js) gained that import to fix the load order. As a fallback, `profiles.findStored(id)` (`profileForStoredId`) still finds a profile by its old stored id; the active profile store and the Compare Trajectories page use it.

## Scope View angle in degrees (#129)

Owner approved. On `/scope-view`, with the angle section open and the unit in degrees, the angle gives a result only when it is finite and strictly between -90° and 90° (`MAX_SCOPE_ANGLE_DEG`, the check is on the degrees, not on the cosine). Otherwise the box shows the new message `scope_view_deg_invalid` ("Enter an angle above -90° and below 90°") and there is no result. Before, 90° gave a range of 0, 180° a negative range read as positive, and 360° the full range, all without a message.

- Text that is not a number now gives no result (before: a flat shot). Approved by the owner.
- An empty box is still a flat shot.
- A stored angle is checked the same way.
- Angles inside the limit give the same results as before.

Changed in [`scopeRange.js`](../src/lib/utils/scopeRange.js) (`isUsableScopeAngle`) and [`scope-view/+page.svelte`](../src/routes/scope-view/+page.svelte).

## Max drop and subsonic distance (#94)

Owner approved. `calculateFullTrajectory` in [`ballisticCalculator.js`](../src/lib/utils/ballisticCalculator.js) already fired the shot a second time for max apex (#85), stopping at the far zero. That fire now covers the whole range on a grid of about one unit that ends on the range, and all three key points come from it:

- `maxApex`: unchanged definition.
- `maxDrop`: the lowest point under the line of sight within [0, range], the muzzle included.
- `subsonicDist`: the first point within the range below the speed of sound at the shooter.

Rows past the range do not count (a 1e-6 tolerance absorbs float noise on the last grid row).

Measured on 1470 cases (7 test profiles, 3 atmospheres, yd and m, 7 ranges from 100 to 3000, steps 1, 5, 25, 100 and 250, no wind), old against new:

| Value | Changed | Detail |
|-------|---------|--------|
| No result | 0 | |
| `maxApex` | 0 | |
| `maxDrop` | 192 | Each previously came from a row past the range. Largest difference 134.8 in or cm |
| `subsonicDist` | 331 | Only at steps 5 to 250; it now equals the old step 1 value. Up to 234 units at step 250 |

Baseline: `P308_G1` `keyPointsM.subsonicDist` 960 → 957 in [`ballistics.baseline.test.js`](../src/test/ballistics.baseline.test.js) (960 had been recorded at step 5). The #85 implementation test was rewritten for the new fire. The measurement script and output are not kept in the repository.

Cost: about 3 ms more per calculation at 1000 yd, 12 to 14 ms more at 3000 yd.

## Technical changes

| File | Change |
|------|--------|
| [`inputLimits.js`](../src/lib/utils/inputLimits.js) | `maxTableStep`, `tableStepLimit`; `tableStep` and `isUsableTableStep` take the range |
| [`ballisticCalculator.js`](../src/lib/utils/ballisticCalculator.js) | Step capped at the range; one grid fire over the whole range for max apex, max drop and subsonic distance |
| [`scopeRange.js`](../src/lib/utils/scopeRange.js) | `MAX_SCOPE_ANGLE_DEG`; degrees checked in `isUsableScopeAngle` |
| [`storedProfiles.js`](../src/lib/utils/storedProfiles.js) | `UNUSABLE_IDS`, link-safe ids in `normalizeProfiles`; new `findProfileIdRenames`, `renameActiveProfileId`, `renameCompareEntries`, `profileForStoredId` |
| [`profiles.svelte.js`](../src/lib/stores/profiles.svelte.js) | Rewrites the list, active id and compare entries at load when ids are renumbered; new `findStored` |
| [`activeProfile.svelte.js`](../src/lib/stores/activeProfile.svelte.js) | Reads the active profile through `profiles.findStored` |
| [`compareTrajectories.svelte.js`](../src/lib/stores/compareTrajectories.svelte.js) | Imports the profiles store first |
| [`ballistic/+page.svelte`](../src/routes/calculators/ballistic/+page.svelte) | Step message for min and max; charts use the capped step |
| [`compare-trajectories/+page.svelte`](../src/routes/calculators/compare-trajectories/+page.svelte) | Entries resolved through `profiles.findStored` |
| [`scope-view/+page.svelte`](../src/routes/scope-view/+page.svelte) | Degree angle message |
| `messages/en.json`, `fr.json`, `de.json` | New `ballistic_step_max`, `scope_view_deg_invalid`. Each language now has 381 keys |

Guides updated by the developer: [architecture.md](architecture.md) (Stored values table: angle, profile list, active id; Ballistic table step section), [ballistics-model.md](ballistics-model.md) (angles, key points table, input limits, rows past the range), [testing.md](testing.md) (counts and files), [translations.md](translations.md) (key count).

## Checks

- `npm run test:run`: 3739 passed, 1 todo, 30 files. Extended: [`tableStep.test.js`](../src/test/tableStep.test.js), [`storedProfiles.test.js`](../src/test/storedProfiles.test.js), [`storedStores.test.js`](../src/test/storedStores.test.js), [`scopeRange.test.js`](../src/test/scopeRange.test.js), [`ballistics.baseline.test.js`](../src/test/ballistics.baseline.test.js), [`storedState.test.js`](../src/test/storedState.test.js).
- `npm run build` passes.
- Not checked: browser, mobile build, Electron.

## Security review

Verdict: PASS after 3 rounds.

- Round 1: the regular expression trimming id ends could take quadratic time on a long run of spaces (ReDoS), replaced by a linear loop; the active profile could switch after a save, fixed; `ammo-selector` added to the unusable ids; a docs note added.
- Round 2: a renamed id was lost across sessions, because only the session that wrote the renumbered list knew the old ids. Fixed by rewriting every reference (active profile, compare entries) in the profiles store, in the same step as the list.
- Round 3: PASS.

Residual, Low: when ids are renumbered, entries of `zro-profiles` that are not usable profiles are dropped from storage on that write. This is consistent with the existing migrations (the click value migration writes the cleaned list the same way).

## Known limitations / follow-ups

- The table and charts can still show flagged rows the engine adds past the range (Mach or far zero crossing) when the step does not divide the range, for example rows 0, 999 and 1998 on a 1000 yd range at step 999. Max drop and subsonic distance ignore them. Documented in [ballistics-model.md](ballistics-model.md); not changed here.
- Only automated tests and the web build were run; no browser, mobile or Electron check.

## Changelog

- 2026-11-11: initial delivery
