# Trajectory validation above the line of sight, and failure reporting

- **Date:** 2026-11-05
- **Branch:** task/82-83-validation-solver
- **Issues:** [#82](https://github.com/hawkins48b/cw-zro/issues/82), [#83](https://github.com/hawkins48b/cw-zro/issues/83)
- **Status:** Delivered with known issues (on the task branch, not merged yet)

## Summary

The trajectory validation page works out which velocity or BC explains an observed drop. It had two problems:

- **#82.** The solver always treated the observed value as below the line of sight. That is wrong inside a short zero, where the bullet is above it.
- **#83.** The solver reported success after a failed shot, and the returned point could belong to another shot. A goal it could not reach returned 200 fps with no error at 600 yd.

**Decisions.**

- The owner chose an above/below choice in the form. The default is Below, so existing use is unchanged.
- A notice shows when Below is selected and the profile puts the bullet above the line of sight at that range. Issue #82 says "never a wrong velocity", and 3 in Below on the default profile is right for "3 in below" but probably not what was meant. **This notice was decided by the orchestrating session. The owner was not asked.**

**Delivered:**

- The page has a Below / Above choice, and the solver handles both sides of the line of sight.
- A goal the solver cannot reach now gives a translated "No solution" message instead of a value.
- The returned point is always the shot at the returned velocity or BC.
- A search stops after at most 200 shots, or after about 5 seconds.

**Correction to #83.** The issue quotes 150 fps and this document 200 fps. Both are right, for different profiles. With the old code and a 100000 in goal at 600 yd, the .308 test profile returned 150 fps and the default profile 200 fps.

### Effect on users

Results on the default profile (25 yd zero, 3.5 in optic height, 0.285 G1, 3000 fps) at 100 yd, where the bullet is 8.8 in high:

| Observation | Result |
|-------------|--------|
| 3 in, Above | 1406 fps |
| 3 in, Below | 1016 fps, with the notice |
| 50 in, Above | No solution |

Old code against new, on a grid of 3804 cases:

| Outcome | Cases |
|---------|-------|
| Identical | 3331 |
| Old answer changed (all 182 were invalid) | 182: 134 are now an error, 48 a different value |
| Used to fail, now solves | 291 |

## How to use

Open `/calculators/trajectory-validation`. It needs an active profile.

1. Enter the range. It must be at least 100 and greater than the profile's zero distance.
2. Choose what to solve for and how the observation was measured (angle or distance).
3. Under **Bullet vs Line of Sight**, choose **Below** or **Above**. The hint under the value follows the choice.
4. Enter the observed value as a positive number. Its sign is ignored, so the side comes only from the choice in step 3.

The page then shows one of:

- the solved velocity or BC, with **Apply** to save it to the profile
- "No solution", which asks you to check the observed value, the above/below choice, and the profile's zero distance and optic height

The notice can appear with either outcome. It does not block anything: **Apply** stays available when a value was solved.

## Technical changes

### Solver

In [`src/lib/utils/trajectoryValidation.js`](../src/lib/utils/trajectoryValidation.js), `calculateTrajectoryValidation` changes as follows:

- **`direction`**, a new 8th argument, `'below'` (default) or `'above'`. It alone sets the sign of the goal.
- **`MAX_SHOTS`** caps a search at 200 shots. A full walk across the velocity range is 100 shots, so a working search never reaches it.
- **`SEARCH_BUDGET_MS`** is 5000 ms, checked before each shot. One shot cannot be interrupted, so a search can overrun by the length of its last shot. The shot at the rounded answer is also fired past the budget, but only after a search converged.
- **Failed or out-of-bounds shots** halve the step and keep the last good shot, rather than end the search, because the goal can still lie between the two.
- **Convergence tracking** records the closest good shots on each side of the goal. A search that did not converge returns `{ error: 'no_solution' }`.
- **Recompute at the rounded value.** The answer is rounded for display and saving, so the shot is fired again at that value when rounding changed it. `validatedPoint` is always the shot at `validatedVelocity` and `validatedBc`.
- **`suggestAbove`** is true when the goal is below the line of sight but the profile's own shot is above it at this range. It is on every result and, when true, on `no_solution`.
- **A failed initial shot** now returns `no_solution` rather than `null`. `null` still means incomplete or invalid input.

### What converged means

A search has converged in either of two cases:

- The last good shot measures exactly the goal, at the 0.1 the measure is rounded to.
- Two good shots on either side of the goal are less than 2 `minStep` apart (2 fps, or 0.002 BC). That is the width of the last step the search takes, the finest it can resolve. At long range one step moves the measure by more than 0.1, so the search can jump over the goal without ever equalling it, and that still counts as an answer.

Stopping for any other reason means the goal was not reached: only one side seen, bounds or failed shots, or running out of shots or time.

The search only closes on a crossing where the measure rises with the parameter. Where it falls, the search walks away to a bound. That can miss a root, but it cannot settle on a wrong one.

### Page and store

- [`trajectoryValidation.svelte.js`](../src/lib/stores/trajectoryValidation.svelte.js): `measure.direction`, default `'below'`. A `direction` getter reads older saved state, which has no such field, as below.
- [`+page.svelte`](../src/routes/calculators/trajectory-validation/+page.svelte): the Below / Above chips, the hint that follows them, and the notice.
- The failure message, range error and notice use `text-warning-800-200` for contrast: 5.3:1 in light mode, 13.58:1 in dark. The first two used `text-warning-500`.

### Translations

In `messages/en.json`, `fr.json` and `de.json`:

- **New:** `traj_val_direction`, `traj_val_direction_below`, `traj_val_direction_above`, `traj_val_measure_hint_angle_above`, `traj_val_measure_hint_distance_above`, `traj_val_above_los_notice`
- **Reworded:** `traj_val_measure_hint_angle`, `traj_val_no_result`

### Pinned values changed

Only the `measured` column of four baseline rows changed. **No solved velocity or BC changed.** The old pins were the point of the unrounded parameter, which is the #83 defect itself.

| Row | Returned | Old `measured` | New `measured` |
|-----|----------|----------------|----------------|
| Velocity from inches, yd | 2567 | -110.072 | -110.091 |
| BC from inches, yd | 0.172 | -75.317 | -75.425 |
| BC from angle in MOA, yd | 0.399 | -17.529 | -17.542 |
| Velocity from cm, metric | 943 | -748.944 | -747.988 |

The page does not display `validatedPoint`, so these changes are not visible to users.

### Tests

**287 passed, 4 todo.** `npm run build` passes. Both were rerun for this document, as were the 100 yd results, the 200 and 150 fps figures, and the default profile values.

- [`src/test/ballistics.baseline.test.js`](../src/test/ballistics.baseline.test.js) gains 33 tests, in blocks for #82 and #83. They replace the two `it.todo` entries.
- [`src/test/trajectoryValidation.search.test.js`](../src/test/trajectoryValidation.search.test.js) is new, with 17 tests. It uses fake curves, for shapes the real measure does not have, and a fake clock for the time budget.
- [`src/test/fixtures/ballisticProfiles.js`](../src/test/fixtures/ballisticProfiles.js) gains `P223_SHORT_ZERO`, the app's default profile.

The old against new grid was run during development and is not in the repository. The contrast ratios, the timings and the browser checks below also come from the task's reports and were not rerun for this document.

### Browser checks

All five checks passed on the production build, in Chromium at 375, 768 and 1280 px, in light and dark mode, in three languages.

- Text was measured with a substitute font.
- Real devices, Capacitor and Electron were not tested.
- **The first load after a fresh build stayed blank on `vite preview` in four runs.** Later loads were fine. The cause was not determined, and real hosting was not tested.

## Deployment notes

Nothing to run or configure. Saved page state and saved profiles keep working, and saved state opens on Below.

## Security review

**PASS on round 2.** Round 1 found a Medium that this change made worse: the shot cap limits shots, not time, and a search could be up to 7.8 times slower on extreme inputs. The time budget fixes it. The worst measured solve went from 49 s to about 5 s, with overruns to about 6 s.

Pre-existing problems, not fixed here:

- Extreme air temperature and pressure values can hang a single shot, which the budget cannot stop.
- Range and zero distance have no upper limit.

## Known limitations / follow-ups

- **Steep curves.** Near the failure edge one search step can span several inches, so the returned point can differ noticeably from the goal.
- **Flat curves.** The search returns the first value that rounds to the goal.
- **Implausible BC.** BC solves can return physically implausible values such as 0.021, and the page does not flag them.
- **Early stop.** A search stopped by the budget can move an answer by up to the search's resolution.
- **Device differences.** A solve near 5 s can differ between devices.
- **Running out of time** is reported as no solution, even for a solvable goal. This happens only on extreme inputs such as a 20000 yd zero. That was measured on a desktop, and phones are slower.
- **French and German.** No native speaker reviewed the text.
- **Blank first load** on `vite preview`: see Browser checks.

## Changelog

- 2026-11-05: initial delivery
