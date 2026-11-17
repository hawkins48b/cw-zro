# MPBR and Trajectory Validation stored values, Ballistic step limit, profile ids and dope card labels

- **Date:** 2026-11-11
- **Branch:** task/127-stored-step-labels
- **Issues:** [#127](https://github.com/hawkins48b/cw-zro/issues/127), [#128](https://github.com/hawkins48b/cw-zro/issues/128), [#130](https://github.com/hawkins48b/cw-zro/issues/130), [#131](https://github.com/hawkins48b/cw-zro/issues/131), [#132](https://github.com/hawkins48b/cw-zro/issues/132)
- **Status:** Not in production yet

## Summary

Five follow-ups of [#120](2026-11-10-120-stored-values-charts.md) in one branch. No calculated result changes for a stored value that was valid: the baselines pass unchanged.

| Issue | Change |
|-------|--------|
| #127 | The MPBR and Trajectory Validation stores check each stored field when it is read. The 16 damaged cases that crashed a page no longer do, and the page recovers without clearing storage |
| #128 | The MPBR "Max. Ordinate" label stays inside the chart when the apex is at the top of the plot |
| #130 | The Ballistic table step has a minimum of 1, with a message under the box, and the charts ask for at most 120 ticks. A small step no longer freezes the page |
| #131 | Stored profile ids are read as text, so a profile stored with a number id can be opened and made active. Duplicate ids are renumbered |
| #132 | The metric dope card prints the sight height and velocity in the units its trajectory used, also for a damaged unit |

## Stored values of MPBR and Trajectory Validation (#127)

Each case was first reproduced in a browser on the old code. 16 crashed:

- MPBR (7): store `null`, text, a number or an array; target missing or `null`; target size `{"toString":1}`.
- Trajectory Validation (9): store `null`, text, a number or an array; range `null`; range distance `{"toString":1}`; measure `null` or missing; angle value `{"toString":1}`.

After the change, 52 probed cases, with good data as a control, render without errors and recover when the user enters a value, without clearing storage.

New readers in [`storedState.js`](../src/lib/utils/storedState.js), following the rules of "Stored values" in [architecture.md](architecture.md):

| Stored value | Reader | Page shows | Result |
|--------------|--------|------------|--------|
| Whole store not an object (`zro-mpbr`, `zro-traj-validation`) | `storedObject` | Each section as below | As below |
| MPBR target section or size damaged, or an array | `storedMpbrTarget` | Empty size box | Calculate stays off: no result |
| MPBR target unit unknown | `storedMpbrTarget` | `in` (`cm` stays `cm`) | As `calculateMPBR` reads it: unchanged |
| Validation range damaged | `storedRange` (existing) | Empty range box | No result |
| Validation observation section or value damaged, or an array | `storedValidationMeasure` | Empty boxes | No result |
| Validation type, unit or direction unknown | `storedValidationMeasure` | The chip the calculator already used: `distance` else `angle`, `cm` else `in`, `mrad` else `moa`, `above` else `below` | Unchanged |
| Validation "solve for" damaged | `storedSolveFor` | Velocity | Velocity (see decisions) |
| Validation atmosphere missing or `null` | `storedValidationAtmosphere` | Standard atmosphere, as before | Unchanged |
| Validation atmosphere text, array or other damaged value | `storedValidationAtmosphere` → `storedAtmosphere` | Custom atmosphere with empty boxes | "No solution" |

The setters write from the checked value (`{ ...state(), target: { ...this.target, ...patch } }`), so the damaged field is replaced on the next change. `direction` now reads from the checked observation.

### Decisions

- **Damaged "solve for" is velocity** (owner decision). Before, the calculation solved for the BC on any value other than `velocity`, while the chart and the Apply button took any value other than `bc` as velocity, so Apply could save an `undefined` velocity to the profile. All three now read the same choice.
- **Arrays in the MPBR size and the validation inputs give no result** (owner decision), as for the other stores since #120.

## MPBR Max. Ordinate label (#128)

With a 20 in or a 40 cm target on the default profile, the apex is at the top of the plot and its label was drawn 5 px above the chart. `buildChartOptions` in [`mpbr/+page.svelte`](../src/routes/calculators/mpbr/+page.svelte) now adds 12 px of top padding (`MAX_ORD_LABEL_ROOM`) when the annotations are on and there is a maximum ordinate. The plot is 12 px shorter then.

Checked in a browser: 10 setups at 375 and 1280 px, light and dark (40 cases). Every label is inside the chart, none covers a y-axis tick (#100), and the MPBR results are identical.

## Ballistic table step (#130)

Measured on the old code in a browser, 3000 yd range, .308 profile:

| Step | Before |
|------|--------|
| 25 | 0.9 s, 121 ticks |
| 1 | 5.1 s, 3001 ticks |
| 0.5 | 11.3 s |
| 0.1 | Not drawn after 120 s |
| 0.01, or 0.001 typed | "Maximum call stack size exceeded" |
| 0.001 stored | Page froze |

Changes, in [`inputLimits.js`](../src/lib/utils/inputLimits.js) (owner decision: minimum 1, tick cap 120):

- `tableStep(step)`: the step the table uses, shared by `calculateFullTrajectory` and both charts. As before: the size of the value, at least 1, and 25 for an empty box, 0 or text. Table rows are unchanged.
- `isUsableTableStep(step)`: a step that is not a finite number of at least 1 shows the new message `ballistic_step_min` ("Enter a step of at least 1 yd", in en, fr and de) in place of the hint, and the box gets `aria-invalid`. An empty box shows no message.
- `chartTickAmount(maxX, step)`: one x-axis tick per step, at most `MAX_CHART_TICKS` (120), the count of the default step on the longest range. Used by the trajectory and velocity charts.

After the change, every step takes about 0.9 s to draw.

## Profile ids (#131)

Owner decision: ids are read as text. In [`storedProfiles.js`](../src/lib/utils/storedProfiles.js):

- `normalizeProfiles` reads each id as text. The first profile with an id keeps it; a later one with the same id (`1` and `"1"`, or `"1"` twice) gets `<id>-2`, `<id>-3` and so on, the first one not used in the list. The result depends only on the list order, so it is the same at every read, and the next save stores it.
- New `storedProfileId`: the stored active id (`zro-active-profile`) as text, anything else as none, so the first profile is active. Used by [`activeProfile.svelte.js`](../src/lib/stores/activeProfile.svelte.js).
- Lookups stay strict (`===`), now on text ids.
- The one-time click value migration at import in [`profiles.svelte.js`](../src/lib/stores/profiles.svelte.js) now writes the cleaned list, and only when a profile needs migrating. Before, it changed the profiles in place, which no longer reaches storage when an id is read as a copy.

## Metric dope card labels (#132)

[`dopeCardMetric.js`](../src/lib/utils/dopeCardMetric.js) converted the printed sight height and velocity only when the unit was `in` or `fps`, while the trajectory converts unless it is `cm` or `mps`. The labels now read any unit other than `cm` and `mps` as inches and fps, as the trajectory does. The imperial card already did. Only printed labels change, and only for a damaged unit. The 19 new tests for this failed on the old code.

## Technical changes

| File | Change |
|------|--------|
| [`storedState.js`](../src/lib/utils/storedState.js) | New `storedMpbrTarget`, `storedValidationMeasure`, `storedSolveFor`, `storedValidationAtmosphere` |
| [`mpbr.svelte.js`](../src/lib/stores/mpbr.svelte.js) | Target through `storedMpbrTarget`, whole store through `storedObject` |
| [`trajectoryValidation.svelte.js`](../src/lib/stores/trajectoryValidation.svelte.js) | Range, observation, direction, solve for and atmosphere through the readers; setters write from the checked value |
| [`storedProfiles.js`](../src/lib/utils/storedProfiles.js) | Ids as text, duplicates renumbered; new `storedProfileId` |
| [`activeProfile.svelte.js`](../src/lib/stores/activeProfile.svelte.js) | Active id through `storedProfileId` |
| [`profiles.svelte.js`](../src/lib/stores/profiles.svelte.js) | Click migration writes the cleaned list |
| [`inputLimits.js`](../src/lib/utils/inputLimits.js) | `MIN_TABLE_STEP`, `MAX_CHART_TICKS`, `tableStep`, `isUsableTableStep`, `chartTickAmount` |
| [`ballisticCalculator.js`](../src/lib/utils/ballisticCalculator.js) | Step through `tableStep` |
| [`ballistic/+page.svelte`](../src/routes/calculators/ballistic/+page.svelte) | Step message, `aria-invalid`, charts use `tableStep` and `chartTickAmount` |
| [`mpbr/+page.svelte`](../src/routes/calculators/mpbr/+page.svelte) | `MAX_ORD_LABEL_ROOM` top padding |
| [`dopeCardMetric.js`](../src/lib/utils/dopeCardMetric.js) | Label units read as the trajectory reads them |
| `messages/en.json`, `fr.json`, `de.json` | New `ballistic_step_min`. Each language now has 379 keys |

Guides updated by the developer: [architecture.md](architecture.md) (Stored values table: MPBR, Trajectory Validation, profile ids, active id; new "Ballistic table step" section), [testing.md](testing.md) (counts and new files), [translations.md](translations.md) (key count).

## Checks

- `npm run test:run`: 3388 passed, 1 todo, 30 files. New: [`tableStep.test.js`](../src/test/tableStep.test.js), [`dopeCardUnits.test.js`](../src/test/dopeCardUnits.test.js). Extended: [`storedState.test.js`](../src/test/storedState.test.js), [`storedProfiles.test.js`](../src/test/storedProfiles.test.js), [`storedStores.test.js`](../src/test/storedStores.test.js). Baselines unchanged.
- `npm run build` passes.
- Browser checks on the web build, as listed above. The probe scripts are not kept in the repository.

## Security review

Verdict: PASS.

Low, informational: with duplicate ids `[{id:"1",A},{id:1,B}]` and a stored active id of the number 1, profile A is now active, where B was before. This follows the owner decision that the first profile keeps the id.

Pre-existing issues noted by the reviewer, not changed here:

- A huge or infinite step (`1e9`, `Infinity`) gives no table; there is no maximum step.
- A step of 1 on a 3000 yd range gives a 3001-row table. This is allowed.
- A profile whose id is empty, contains `/`, `?` or `#`, or equals `new` cannot be opened: the profile links do not use `encodeURIComponent` (`src/routes/profiles/+page.svelte:248`, `:373`, `:467`). No script injection.

## Open points

- Only the web build was tested; `build:mobile` and Electron were not run.
- No maximum Ballistic step, and profile ids that cannot be used in a URL, as listed above.
- A renumbered profile id (`<id>-2`) is only written to storage on the next save.

## Changelog

- 2026-11-11: initial delivery
