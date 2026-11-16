# First-run Welcome screen and guided profile setup

- **Date:** 2026-11-16
- **Branch:** task/150-welcome-setup
- **Issue:** [#150](https://github.com/hawkins48b/cw-zro/issues/150), part of epic [#153](https://github.com/hawkins48b/cw-zro/issues/153)
- **Status:** Delivered, not in production yet. Not checked in a browser

## Summary

Before #150:

- Every new install stored an "Example Colt M4" profile on first launch, and made it the active profile.
- The splash always went on to `/scope-view`.
- A new user had to find the profile form on their own.

The design is the claude.ai artifact canvas "ZRO Calculator Redesign": artboards "2 · Welcome" and "3 · Guided setup". This branch is #150 of epic #153.

**Delivered.**

- **No profile on first launch.** Nothing is written to storage until the user saves a profile. Neither `zro-profiles` nor `zro-active-profile` is seeded any more.
- **The splash decides.** With no usable profile it goes to `/welcome`, otherwise to `/scope-view`.
- **Welcome screen** (`/welcome`), full screen, without app navigation: what ZRO does, the three setup steps, "Set up my rifle", "Try it with a sample profile", a privacy line and EN / FR / DE language chips. It shows only while there is no usable profile; otherwise it goes on to `/scope-view`.
- **Sample path.** "Try it with a sample profile" stores the old Example Colt M4, makes it active and opens Scope View.
- **Guided setup** (`/setup`), full screen, three steps with a progress bar:
  1. Rifle & scope: profile name, scope name, scope height, zero distance, click value.
  2. Ammunition: search the bundled ammunition library, pick a load (a summary shows its weight, BC, diameter and length, with Edit), or "Not in the list? Enter the numbers from the box".
  3. Velocity: muzzle velocity.
- The setup saves through the same validation and builder as the profile form, makes the new profile active and opens Scope View.
- **Shared parts.** The language switcher has a chips variant. `UnitField` now has a real label, a described hint or error, `aria-invalid` and `aria-pressed` on its unit chips; this also applies to the profile form.

No calculated result changed. No baseline was touched.

## Owner decisions (2026-11-16)

- The sample profile is the old Example Colt M4, values unchanged. It is created only by "Try it with a sample profile".
- Step 1 asks for a **Scope name**. It is required, with the same validation as the profile form.

## Choices not confirmed by the owner

| Topic | Choice |
|-------|--------|
| Back on step 1 | On a first run: back to `/welcome`. Otherwise: one step back in history, or `/profiles` when the page was opened directly |
| First-run flag | None. The app is on a first run whenever no usable profile is stored, so deleting every profile shows the Welcome screen again on the next launch |
| Texts | Setup step headings, intros and the "missing ammunition" message were written by the designer |
| Ammunition list | The bundled library only ([`ammo.json`](../src/lib/data/ammo.json)) |
| Theme | No theme toggle on the Welcome and setup screens |
| Back after the first save | The setup replaces itself with Scope View, so Back from Scope View lands on `/welcome`, which goes on to `/scope-view` again. Check on Android (hardware Back) |
| Links to `/setup` | Only from the Welcome screen. The empty Profiles page still links to `/profiles/new` |

## Translator's choices

- "Box" (of ammunition): fr "boîte", de "Packung".
- "{brand} · filled in": fr "{brand} · données reprises", de "{brand} · übernommen".
- Welcome intro, "how many clicks to dial": de "Optik verstellen".
- ß or ss: German keeps the existing label "Einschiessentfernung". The owner should pick one convention.
- Possibly too long, check on a narrow phone: de "Geschwindigkeit" (step label), "Weiter: Geschwindigkeit", the two Welcome buttons, and the "Not in the list?" link.
- No native speaker review.

## Release notes

- New installs open a Welcome screen with a guided setup, instead of an example profile.
- Existing profiles are unchanged.

## How to use

No account or role. All pages are also under `/fr/...` and `/de/...`.

- **First launch.** The splash opens the Welcome screen. Pick a language with the chips if needed.
- **Sample.** "Try it with a sample profile" adds "Example Colt M4", makes it active and opens Scope View.
- **Setup.** "Set up my rifle" opens `/setup`.
  - Fill a step and press Next. Errors show only after Next, under each field, and focus goes to the first wrong field. Once shown, an error goes away as the field is fixed.
  - On a new step the page scrolls to the top and focus goes to the step heading.
  - Back goes to the previous step and keeps what was entered.
  - Step 2: type in the search box (case and punctuation ignored, so "7.5x55" finds "75x55"), tap a load. Edit opens its fields, filled. "Not in the list?" clears the pick and opens empty fields. Next with no load and the fields closed says to pick one or enter the numbers.
  - "Save profile" on step 3 stores the profile, makes it active and opens Scope View.
  - Leaving the setup before saving stores nothing.
- **Later.** `/welcome` with a profile stored goes on to `/scope-view`. New profiles are made with the profile form (`/profiles/new`) as before.

## Technical changes

- New [`src/lib/utils/firstRun.js`](../src/lib/utils/firstRun.js): `isFirstRun(storedProfiles)` (no usable profile after `normalizeProfiles`) and `startPath`, which gives `/welcome` or `/scope-view`.
- New [`src/lib/utils/sampleProfile.js`](../src/lib/utils/sampleProfile.js): `SAMPLE_PROFILE`, frozen, the former `DEFAULT_PROFILE` of the profiles store, without id.
- [`src/lib/stores/profiles.svelte.js`](../src/lib/stores/profiles.svelte.js): `DEFAULT_PROFILE` removed; the store starts from `[]` with `seed: false`, so a missing key stays missing.
- [`src/lib/stores/activeProfile.svelte.js`](../src/lib/stores/activeProfile.svelte.js): `seed: false` too (security review finding, below).
- [`src/lib/utils/profileValidation.js`](../src/lib/utils/profileValidation.js):
  - `buildProfileData(form, spinDrift, tempSensitivity)`: the stored profile, moved out of `ProfileForm` without change.
  - `setupProfileData(form)`: `validateProfile(form, false, false)`, then `buildProfileData`; `null` for an invalid form.
- [`src/lib/components/ProfileForm.svelte`](../src/lib/components/ProfileForm.svelte): calls `buildProfileData`. It stores the same object as before (tested).
- [`src/routes/+page.svelte`](../src/routes/+page.svelte): the splash goes to `startPath(profiles.list)`.
- [`src/routes/+layout.svelte`](../src/routes/+layout.svelte): `/welcome` and `/setup` render without header, rail, sidebar or tab bar.
- New routes:
  - [`src/routes/welcome/+page.svelte`](../src/routes/welcome/+page.svelte): redirects to `/scope-view` when a profile exists; the sample button works once, even on a double tap.
  - [`src/routes/setup/+page.svelte`](../src/routes/setup/+page.svelte): validates each step against its fields only, saves once, handles Back on step 1.
- New components:
  - [`WelcomeScreen.svelte`](../src/lib/components/WelcomeScreen.svelte).
  - [`GuidedSetup.svelte`](../src/lib/components/GuidedSetup.svelte): one form for all steps (so Back keeps values), `STEP_FIELDS`, progress list with `aria-current="step"`, sticky footer. Clicks are linked: windage is the elevation.
  - [`setup/SetupRifleStep.svelte`](../src/lib/components/setup/SetupRifleStep.svelte), [`setup/SetupAmmoStep.svelte`](../src/lib/components/setup/SetupAmmoStep.svelte), [`setup/SetupVelocityStep.svelte`](../src/lib/components/setup/SetupVelocityStep.svelte), [`setup/TextField.svelte`](../src/lib/components/setup/TextField.svelte).
  - The setup uses the profile form's default units and messages for errors. Spin drift, temperature sensitivity, twist and temperature are not asked; the profile is checked with both switches off.
- [`LanguageSwitcher.svelte`](../src/lib/components/LanguageSwitcher.svelte): `variant="chips"` (labelled group, 44 px touch area, `aria-current`); the default `group` variant is unchanged.
- [`UnitField.svelte`](../src/lib/components/UnitField.svelte): `<label for>`, optional `id`, `aria-describedby` on the hint or error, `aria-invalid`, `aria-pressed` on unit chips.
- Messages: 46 new keys in en, fr and de (`welcome_*`, `setup_*`). Now 513 keys per language.
- Guides updated: [`architecture.md`](architecture.md) (routes), [`data-and-privacy.md`](data-and-privacy.md) (`zro-profiles` not written on first launch), [`testing.md`](testing.md), [`translations.md`](translations.md) (key count).

## Tests

| File | What |
|------|------|
| [`firstRun.test.js`](../src/test/firstRun.test.js) (new, 17) | `isFirstRun` and `startPath` for a missing key, an empty or damaged list, unusable entries and one usable profile; the sample profile equals the old example, passes the profile form validation and gives a result at 100 yd |
| [`buildProfileData.test.js`](../src/test/buildProfileData.test.js) (new, 23) | `buildProfileData` stores what `ProfileForm` stored before (comma decimals, metric units, switches on, linked and unlinked clicks); `setupProfileData` builds a valid profile from each `ammo.json` entry and returns `null` for an invalid form |
| [`storedStores.test.js`](../src/test/storedStores.test.js) (+2, now 158) | First launch: a missing `zro-profiles` reads as no profiles, and neither `zro-profiles` nor `zro-active-profile` is written until a profile is added; a list stored before #150 (the seeded example included) and an empty list are kept |

`npm run test:run`: 4216 passed, 1 todo, in 40 files. `npm run build` and `npm run build:mobile` pass. No baseline or calculated result changed. The Welcome screen and the setup have no component tests.

## What the owner should test

Nothing was checked in a browser. Please check, in light and dark themes:

1. Clear the site storage and reload: splash, then the Welcome screen, with no navigation. Storage still has no `zro-profiles` and no `zro-active-profile`.
2. "Try it with a sample profile": Scope View opens with Example Colt M4 active.
3. Clear storage again, "Set up my rifle":
   - Next on an empty step shows errors under the fields and focuses the first one.
   - Step 2: search, pick a load, check the summary, Edit, then "Not in the list?".
   - Back from steps 2 and 3 keeps the values; Back on step 1 returns to the Welcome screen.
   - "Save profile" opens Scope View with the new profile active, and the profile shows in `/profiles` and opens in its edit form.
4. Leave the setup midway (Back, or close the tab): storage stays empty, and the next launch shows the Welcome screen.
5. Open `/welcome` with a profile stored: it goes on to `/scope-view`.
6. Back from Scope View right after the first save (Android hardware Back too): it should end on Scope View, not a loop or a blank page.
7. French and German on a narrow phone (360 to 390 px): the step labels, "Weiter: Geschwindigkeit", the Welcome buttons and the "Not in the list?" link fit.
8. The profile form (`/profiles/new`, edit): labels, errors and unit chips still work as before.

## Deployment notes

Nothing to do on the server. The release notes above must go out with the release.

## Security review

**PASS.**

- Low, fixed in this branch: `zro-active-profile` was still seeded on first load, so a first run that left the Welcome or the setup wrote a `null` active id to storage. The store now uses `seed: false`, and `storedStores.test.js` checks that nothing is written.

## Acceptance criteria

| Criterion | Status |
|-----------|--------|
| Welcome only when no profile exists; the sample profile path creates a usable profile | Done: `firstRun.test.js` checks the decision and that the sample gives a result (screens not checked in a browser) |
| Guided setup saves a profile through the same validation as the profile form | Done: `setupProfileData` (tested) |
| Back keeps entered values; leaving midway saves nothing | Done: one form for all steps; nothing stored before save, checked in `storedStores.test.js` (not checked in a browser) |
| New strings in en, fr, de; `npm run test:run` and `npm run build` pass | Done: 46 keys in each language; tests, `build` and `build:mobile` pass |

## Known limitations / follow-ups

- Not checked in a browser, nor on Android or iOS.
- The choices listed above wait for the owner's confirmation.
- German ß / ss convention is open.
- No native speaker review of the fr and de texts.
- Deleting every profile brings the Welcome screen back on the next launch (no first-run flag).

## Changelog

- 2026-11-16: initial delivery
