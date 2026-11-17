# "+ New profile" opens the guided setup, with an optional Advanced step (#177)

Issue: [#177](https://github.com/hawkins48b/cw-zro/issues/177). Owner request, 2026-11-17.

## What changed

Owner decisions: "+ New profile" opens the guided stepper of #150, which links the full form; editing a profile keeps the full form; one optional step 4 "Advanced" with Skip; no sideways scrolling on phones.

- **Entry points.** Every "+ New profile" link uses `NEW_PROFILE_PATH = '/setup'` from the new [`setupSteps.js`](../src/lib/utils/setupSteps.js): the Profiles page button ([`profiles/+page.svelte`](../src/routes/profiles/+page.svelte)), the desktop sidebar item under Profiles ([`+layout.svelte`](../src/routes/+layout.svelte)), the "create a profile" link of the Calculators hub ([`calculators/+page.svelte`](../src/routes/calculators/+page.svelte)), and the empty-list buttons of the profile picker ([`ProfileInUseChip.svelte`](../src/lib/components/ProfileInUseChip.svelte)) and the Compare add picker ([`CompareAddPicker.svelte`](../src/lib/components/compare/CompareAddPicker.svelte)).
- **Full form.** `/profiles/new` is still the full profile form (`FULL_FORM_PATH`). Step 1 of the setup shows a "Use the full form" link to it, which replaces the setup in the history (`data-sveltekit-replacestate`). It is shown on step 1 only, and not on the first run (no usable profile when the setup opened), so the first run stays the guided path of #150. Editing (`/profiles/[id]`) is unchanged.
- **Step 4, Advanced (optional)** ([`SetupAdvancedStep.svelte`](../src/lib/components/setup/SetupAdvancedStep.svelte)): two switches, both off at first, with the same fields, units, hints and checks as the profile form's sections:
  - Spin drift: barrel twist (1 / in or mm) and bullet length (in or mm). The length is prefilled from the ammunition library pick of step 2, with the hint "Filled in from the ammunition you picked" while it is unchanged.
  - Temperature sensitivity: temperature (°F or °C) and modifier (fps per °F or °C).
  - Only the switched-on groups are validated (`setupStepErrors` with the switches). The profile is built by `setupProfileData(form, spinDrift, tempSensitivity)` in [`profileValidation.js`](../src/lib/utils/profileValidation.js), the same `validateProfile` / `buildProfileData` as the full form, so the stored data is the same as from the full form.
  - Skip saves with both switches off, without checking step 4; values typed there are kept as typed, as the full form keeps the fields of a switch that is off.
  - Footer on step 4: Back | Skip | Save. The save button reads "Save" on phones and "Save profile" from 640 px; phones get narrower button padding so the three fit.
- **Steps moved out of the component.** `STEP_FIELDS` / `STEP_COUNT` left [`GuidedSetup.svelte`](../src/lib/components/GuidedSetup.svelte) for `SETUP_STEP_FIELDS` (step 4: `barrelTwist`, `bulletLength`, `temperature`, `tempModifier`) and `SETUP_STEP_COUNT = 4` in `setupSteps.js`. The progress bar has four labels (Rifle, Ammo, Velocity, Advanced).
- **After Save** ([`setup/+page.svelte`](../src/routes/setup/+page.svelte), `setupSavedTarget`): the new profile is added and made active, then:
  - first run: Scope View, replacing the setup (unchanged from #150);
  - opened from a page of the app: a history step back to that page;
  - opened from a profile editor page (`/profiles/new`, `/profiles/<id>`, the Ammo Library, i.e. from the desktop sidebar), from `/setup` or `/welcome`, or directly with no page before it: the Profiles list, replacing the setup.
- **Back on step 1** is unchanged: first run to Welcome, else back to the opener, else Profiles. With all profiles deleted, the setup counts as a first run, so Back on step 1 goes to Welcome.
- **Ammo pick without a length** ([`SetupAmmoStep.svelte`](../src/lib/components/setup/SetupAmmoStep.svelte)): picking a library entry that has no length now clears the length of a previous pick, instead of keeping it.
- **Phone overflow.** The causes were found by reading the code, not measured in a browser:
  - the step 2 "numbers from the box" fieldset grew to its content's width (a fieldset's `min-inline-size` is `min-content`): `min-w-0`; the step 4 cards have `min-w-0` too;
  - the step body's `overflow-y-auto` also allowed sideways scrolling: `overflow-x-hidden` (phones only; from 640 px it is `overflow-visible` as before);
  - four progress labels in a 4-column grid: `min-w-0`, `break-words`, `hyphens-auto`;
  - the setup's root clips sideways (`overflow-x-clip`, `min-w-0`) as a last guard.
- **Messages:** 7 new keys in English, French and German (`setup_step_advanced`, `setup_next_advanced`, `setup_advanced_title`, `setup_advanced_intro`, `setup_advanced_length_from_pick`, `setup_skip`, `setup_full_form`), 900 per language. Not reviewed by native speakers.
- Guides updated by the developer: [architecture.md](architecture.md) (routes `/setup` and `/profiles/new`, setup layout on phones), [testing.md](testing.md) (totals and the three test rows), [translations.md](translations.md) (key count).

No calculated result changed.

## Checks

- `npm run test:run`: **4953 passed, 1 todo**, 66 files (was 4910). New: [`setupSteps.test.js`](../src/test/setupSteps.test.js) (steps and their fields, step 4 checked only with its switches, `setupSavedTarget`, no page or component links `/profiles/new` directly) and [`guidedSetup.svelte.test.js`](../src/test/guidedSetup.svelte.test.js) (components project: four steps, step 4 switches reach validation and save, a step 4 error stops Save, Skip saves with switches off and only on step 4, the full form link only on step 1 and only when given). [`buildProfileData.test.js`](../src/test/buildProfileData.test.js) 23 → 34: `setupProfileData` with step 4 stores what `buildProfileData` stores, each switch's errors store nothing, a skip keeps values with both switches off, only `true` turns a switch on.
- `npm run build`: pass. `svelte-check`: 0 errors, 0 warnings.
- jsdom has no layout, so the phone width is not tested.
- Security review: PASS. Pre-existing Low, not fixed and not filed: `temperature` and `tempModifier` have no range limits in `profileValidation.js` (`checkAny`), so absurd values give absurd velocities; it only affects the user's own local data.
- Not checked in a browser.

## Open points (owner)

Defaults kept by the main session, awaiting the owner's confirmation:

1. The "Use the full form" link is on step 1 only and hidden on the first run.
2. The new profile becomes the profile in use after Save.
3. With all profiles deleted, Back on step 1 goes to Welcome (the setup is then a first run).

## For the owner to test

At 360 px width (phone or DevTools):

1. Profiles → "+ New profile" (also the sidebar item on desktop, the Calculators hub link without profiles): the guided setup opens, step 1 shows "Use the full form"; that link opens the full form, and Back from it does not return to the setup.
2. No sideways scrollbar on any of the four steps, including step 2 with "numbers from the box" open, and in German (`/de/`).
3. Step 2 pick a library ammunition with a length, step 4 switch on spin drift: the length is prefilled with the "Filled in from the ammunition you picked" hint. Enter a twist, Save, open the profile: the full form shows the same values.
4. Step 4 switch on temperature sensitivity, leave it empty, Save: errors under temperature and modifier. Skip: the profile is saved, both switches off in the full form.
5. After Save: back on the page "+ New profile" was opened from, with the new profile in use.
6. First run (Clear all data): Welcome → Set up works as before (three required steps plus the optional fourth, no full form link) and ends on Scope View.
