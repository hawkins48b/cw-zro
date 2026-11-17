# Profiles redesign, profile import and Export all

- **Date:** 2026-11-17
- **Branch:** task/166-redesign-all
- **Issue:** [#166](https://github.com/hawkins48b/cw-zro/issues/166), first area of four (Profiles + import/export)
- **Status:** Delivered, not in production yet. Not checked in a browser

This document covers the **Profiles round only**. #166 also asks for Settings + About, the Calculators and the remaining layouts. They come in later rounds on the same branch, each with its own document. Acceptance criteria that belong to those rounds are listed as open below.

## Summary

Before this round (state after [#149](2026-11-16-149-nav-hub-profiles.md)):

- The Profiles page was a list of cards. Each had a "Use" button and a ⋮ sheet (Edit, Duplicate, Export, Delete), with long-press and swipe-to-delete. The profile in use could not be deleted.
- One profile at a time could be exported as `zro-profile-<name>.json`. There was no import and no export of all profiles.
- The profile editor was one long form. The Ammo Library filled the form on a tap.

The design is the claude.ai canvas "ZRO Calculator Redesign", page Profiles.

**Delivered.**

- **Profiles page** (`/profiles`), with the picker pattern of the guided setup's ammunition step:
  - Search, sort chips Recent / Rifle / Ammo, a profile count, one list card. Recent shows the newest first.
  - Tapping a row puts that profile in use. The selected row is tinted with a check badge. The "Use" button, the ⋮ sheet, long-press and swipe are gone.
  - The profile in use has a summary card with 8 key numbers (zero, velocity, clicks, BC, weight, sight height, twist, reticle), Edit, Duplicate, "Export this profile" and Delete.
  - Phone: one column, tonal summary card under the list. From 768 px: list on the left, a details card on the right.
  - Header: Import, "Export all", New profile.
- **Delete.** The profile in use can now be deleted. The next profile in the list becomes active, else the previous one. The confirmation names the profile that will become active. Delete is disabled, with a note, when only one profile is left.
- **Export all.** One file `zro-profiles-YYYY-MM-DD.json` with every profile. A message after the save names the file.
- **Import.** One or several `.json` files, of both formats, mixed. A review list shows every profile found, all checked; a tap leaves one out. Unreadable files are named with the reason and skipped. Every imported profile gets a new id. A name already used is imported as a copy ("K31 (2)"). The profile in use stays in use. Imported rows are marked New. Phone: full-screen sheet. From 640 px: centred dialog.
- **Profile editor** (`/profiles/new`, `/profiles/[id]`) in 5 sections like the guided setup: 1 Rifle & scope, 2 Ammunition (tonal card + Change, opening the Ammo Library), 3 Velocity (with temperature sensitivity), 4 Zero, 5 Spin drift (twist and bullet length under one switch). Phone: own header and a pinned Cancel / Save bar instead of the tab bar. From 768 px: two columns. From 1024 px: a summary card that stays in view. From 1280 px: a section index on the left. Fields, units, validation, limits and the stored profile are unchanged.
- **Ammo Library** (`/profiles/ammo-selector`): a tap selects, "Use this ammunition" confirms. Groups "From your profiles" and "Library". Desktop: a table with diameter, weight, BC, drag model and length.
- **Guided setup ammunition step**: built from the same picker pieces, so both look the same.
- **Desktop sidebar**: on the profile sub-pages, Profiles lists every profile (rifle · ammunition) and "+ New profile".
- **Clear all data**: the logic is written and tested (`clearAllData`), but no screen calls it yet. The button comes with the Settings round.

## Choices not confirmed by the owner

| Topic | Choice |
|-------|--------|
| Export all | Saves at once and shows a message after it, not a question before it (the issue says "with a confirmation") |
| Sort "Recent" | Newest first (the stored list is oldest first); a second tap reverses it |
| Breakpoints | Profiles two panes from 768 px (`md`); Import dialog from 640 px (`sm`); editor two columns 768, summary 1024, section index 1280 |
| New badge | Stays until the user leaves the Profiles page (kept in page state, not stored) |
| Editor field labels | The labels of the form before #166 are kept |
| Import limits | 1 MiB per file; 500 profiles per file and per import in total |

## Release notes

- The Profiles page is new: tap a profile to use it. Edit, Duplicate, Export and Delete are on the card of the profile in use.
- The profile in use can be deleted; another one becomes active. The last profile cannot be deleted.
- "Export all" saves every profile in one file. "Import" reads that file, or single-profile files, and adds the profiles as new ones.
- The profile editor is split into five sections.
- Swipe-to-delete and long-press on profile cards are gone.

## How to use

No account or role. All pages are also under `/fr/...` and `/de/...`.

- **Profiles** (`/profiles`).
  - Tap a row to use that profile. Search filters by rifle or ammo; sort by Recent, Rifle or Ammo.
  - The card of the profile in use: Edit opens the editor; Duplicate adds "<name> - Copy"; "Export this profile" saves `zro-profile-<name>.json`; Delete asks first.
  - With no profile: "New profile" and "Import".
- **Export all**: header button "Export all (N)". The file `zro-profiles-YYYY-MM-DD.json` (date of the device's time zone) is saved through the normal download.
- **Import**:
  1. Import in the header opens the file chooser. Pick one or several `.json` files.
  2. The review lists the profiles found, grouped by file, all checked. A renamed one shows its copy name. Files that could not be read are listed with the reason. More files can be added from the dialog.
  3. Tap a row to leave it out. "Import N profiles" adds the checked ones. Nothing is stored before this button.
  4. If storage refuses the save (full or blocked), nothing is added and the dialog says so.

Reasons a file is refused:

| Code | Case |
|------|------|
| `too_large` | Over 1 MiB (checked on the size before the file is read) |
| `empty` | Empty or only spaces |
| `not_json` | Not JSON |
| `unknown_format` | JSON, but `format` is not `zro-profile` or `zro-profiles` |
| `unsupported_version` | Known format, `version` not 1 |
| `too_many_profiles` | A `zro-profiles` file with more than 500 profiles |
| `no_valid_profiles` | No profile in it passes the profile form's checks |
| `too_many_total` | The file would take this import over 500 profiles |

A file with some bad profiles imports the good ones and says how many were skipped.

## Technical changes

### Logic

- New [`src/lib/utils/profileImport.js`](../src/lib/utils/profileImport.js):
  - `parseProfileFile(fileName, text, { size })`: one file, both formats; returns the usable profiles or a reason (table above). `isImportFileTooLarge(size)`.
  - `readImportedProfile(raw)`: rebuilds each profile from the profile form's fields only (other keys, `id` and `__proto__` included, are dropped). Text cut to the form's limits (60), a number text longer than 32 characters read as an empty box, units and choices as the calculators read them. The result must pass `validateProfile` and is stored through `buildProfileData`, as the form does.
  - `uniqueCopyName(name, taken)`: "K31" → "K31 (2)", "K31 (2)" → "K31 (3)"; compared trimmed, NFC, case-insensitive; the base is cut so the name with its suffix fits 60 characters.
  - `planImport(existing, parsed)`: the review list. Each candidate gets a new `crypto.randomUUID()` id; names are made unique against stored profiles and earlier candidates; the 500 total cap.
  - Constants: `MAX_IMPORT_FILE_BYTES` (1 MiB), `MAX_IMPORT_PROFILES` (500), `MAX_IMPORT_NUMBER_LENGTH` (32), `MAX_IMPORT_FILENAME_LENGTH` (120), `IMPORT_REASONS`.
- [`src/lib/utils/profileExport.js`](../src/lib/utils/profileExport.js): `buildAllProfilesExport`, `allProfilesExportFileName`, `allProfilesExportFile`, `downloadAllProfiles` (format `zro-profiles`, version 1, fallback name `zro-profiles.json`); shared `downloadFile`, which now revokes the `blob:` URL 1000 ms after the click (`DOWNLOAD_URL_LIFETIME_MS`) instead of at once; `downloadProfile`.
- [`src/lib/utils/profileOps.js`](../src/lib/utils/profileOps.js): `canDeleteProfile` (more than one profile), `nextActiveAfterDelete` (next, else previous), `appendImportedProfiles` (appends, keeps a candidate's UUID if free, else a new one; no stored profile changed).
- [`src/lib/stores/activeProfile.svelte.js`](../src/lib/stores/activeProfile.svelte.js): `deleteProfile(id)`, refuses the last profile and unknown ids, moves the active profile first.
- [`src/lib/stores/profiles.svelte.js`](../src/lib/stores/profiles.svelte.js): `importProfiles(list)`, saves through `trySet` and returns the new ids, or `null` when the save failed (nothing added, in storage or memory).
- [`src/lib/stores/localStore.svelte.js`](../src/lib/stores/localStore.svelte.js): `trySet(value)` (keeps the value only if the write worked) and `resetLocalStores()` (every store back to its default in memory, without writing).
- New [`src/lib/utils/appStorage.js`](../src/lib/utils/appStorage.js): `APP_STORAGE_KEYS`, `appStorageKeys`, `clearAppStorage` (removes the listed keys and any other `zro-` key; other keys on the origin untouched; never throws).
- New [`src/lib/stores/clearAllData.js`](../src/lib/stores/clearAllData.js): `clearAllData()` removes the keys, resets the stores, the ammo selection and form draft, deletes the old locale cookie and reapplies the device theme. It asks nothing and navigates nowhere; not called by any page yet.

### Components and pages

| Path | Role |
|------|------|
| [`ProfilePicker.svelte`](../src/lib/components/ProfilePicker.svelte) | Search, sort chips, list, single choice or checkboxes (import review), New badges, groups |
| [`picker/`](../src/lib/components/picker/) | `PickerSearch`, `PickerList`, `PickerGroup`, `PickerRow`, `AmmoSummaryCard`: the shared pieces, also used by the Ammo Library and the setup ammo step |
| [`profile/ProfileSummaryCard.svelte`](../src/lib/components/profile/ProfileSummaryCard.svelte) | Tonal card with the 8 key numbers and Edit |
| [`profile/ProfileDetailsCard.svelte`](../src/lib/components/profile/ProfileDetailsCard.svelte) | Right pane from 768 px |
| [`profile/ProfileImportDialog.svelte`](../src/lib/components/profile/ProfileImportDialog.svelte) | File chooser, review, import |
| [`profile/profileLabels.js`](../src/lib/components/profile/profileLabels.js) | Names, units and click texts for the cards |
| [`ResponsiveDialog.svelte`](../src/lib/components/ResponsiveDialog.svelte) | Full-screen sheet on phones, dialog from `sm`; Escape, scrim, focus return |
| [`ConfirmDialog.svelte`](../src/lib/components/ConfirmDialog.svelte) | Small confirmation, focus starts on Cancel |
| [`Toast.svelte`](../src/lib/components/Toast.svelte) | Message at the bottom, 8 s or until dismissed |
| [`SwitchRow.svelte`](../src/lib/components/SwitchRow.svelte) | On/off row (`role="switch"`) of the editor |
| [`actions/focusTrap.js`](../src/lib/actions/focusTrap.js) | Keeps focus in a dialog, Escape, focus return |
| [`ProfileForm.svelte`](../src/lib/components/ProfileForm.svelte) | Editor in 5 sections; new props `isNew`, `inUse`, `title` |
| [`routes/profiles/+page.svelte`](../src/routes/profiles/+page.svelte) | New page |
| [`routes/profiles/[id]/+page.svelte`](../src/routes/profiles/[id]/+page.svelte) | Passes `inUse`; re-mounts the form when the id changes (sidebar links); an unknown id shows a link back to Profiles |
| [`routes/profiles/ammo-selector/+page.svelte`](../src/routes/profiles/ammo-selector/+page.svelte) | Picker pattern, select then confirm, desktop table |
| [`setup/SetupAmmoStep.svelte`](../src/lib/components/setup/SetupAmmoStep.svelte) | Built from the picker pieces |
| [`routes/+layout.svelte`](../src/routes/+layout.svelte) | Hides the header (under 1024 px) and the phone tab bar on the editor routes; profile sub-items in the desktop sidebar on `/profiles/...` |

[`swipe.js`](../src/lib/actions/swipe.js) and the `svelte-gestures` dependency are no longer used. They are left in place.

### Messages

101 new keys in en, fr and de (prefixes `profiles_`, `import_`, `profile_editor_`, `ammo_selector_`, and `common_breadcrumb`, `common_close`, `common_dismiss`). No existing value changed, none removed. Now 723 keys per language. `profiles_use` and `profiles_more_actions` are no longer used in `src/` but stay in the catalogs. The translator aligned 14 French and 16 German terms; no native speaker review.

### Guides updated

[`data-and-privacy.md`](data-and-privacy.md) (Export all, import, clear-all keys), [`testing.md`](testing.md), [`translations.md`](translations.md), [`architecture.md`](architecture.md).

## Tests

| File | Tests | What |
|------|-------|------|
| [`profileImport.test.js`](../src/test/profileImport.test.js) (new) | 70 | Both formats; bad files (each reason, size before reading); the same checks as the profile form, extra keys and `id` dropped, long number texts; `uniqueCopyName`; `planImport`: new ids, copy names against stored and earlier candidates, the total cap |
| [`profileDelete.test.js`](../src/test/profileDelete.test.js) (new) | 22 | `canDeleteProfile`, `nextActiveAfterDelete`, `appendImportedProfiles`, the `deleteProfile` and `importProfiles` stores (failed save adds nothing) |
| [`profileExportAll.test.js`](../src/test/profileExportAll.test.js) (new) | 11 | The `zro-profiles` envelope, file name and fallback, no file without profiles, downloads and the delayed revoke |
| [`clearAllData.test.js`](../src/test/clearAllData.test.js) (new) | 5 | `APP_STORAGE_KEYS`, `clearAppStorage` (other keys kept), `clearAllData` resets the stores |
| [`localStore.test.js`](../src/test/localStore.test.js) | 3 (+1) | `trySet` keeps the old value when storage refuses the write |

`npm run test:run`: **4725 passed, 1 todo**, in 51 files (was 4616 in 47). `npm run build` passes. No baseline or calculated result changed. The pages and components have no component tests.

## What the owner should test

Nothing was checked in a browser. Please check in light and dark, at 390, 768, 1024 and 1280 px:

1. `/profiles`: tap a row, it becomes the one in use (check badge, summary card changes). Search; sort Recent (newest first), Rifle, Ammo, and reverse on a second tap.
2. Summary card: the 8 numbers fit; Edit, Duplicate, "Export this profile" work.
3. Delete the profile in use: the confirmation names the next one, which becomes active. With one profile left, Delete is disabled with its note.
4. Export all: the file `zro-profiles-<today>.json` downloads and a message names it. Say whether a confirmation before the save is wanted instead.
5. Import: one file of each format, then several at once, plus a photo, an empty file and a hand-edited JSON. Check the review list, the reasons, copy names ("K31 (2)"), New badges, and that the profile in use did not change. Phone: full-screen sheet; tablet/desktop: dialog. Escape closes it and focus returns to Import.
6. Profile editor: the 5 sections; phone pinned Cancel / Save bar and no tab bar; two columns at 768; summary card at 1024; section index at 1280. Save and Cancel go back to `/profiles`.
7. Ammo Library: tap selects, "Use this ammunition" fills the editor, Cancel changes nothing; groups; desktop table.
8. Guided setup (`/setup`) ammunition step looks like the Ammo Library.
9. Desktop sidebar on `/profiles/<id>`: the profiles listed under Profiles, each opening its editor.
10. French and German labels fit buttons and chips. Touch targets at least 44 px.

## Deployment notes

Nothing to do on the server. The release notes above must go out with the release. No stored data changes shape: profiles imported are stored as the form stores them.

## Security review

**PASS.**

Checked: file reading (size before read, JSON parse, unknown keys and `__proto__` dropped, each profile rebuilt and validated like the form), id renewal, copy-name time on many equal names, storage failure, downloads.

Fixed in this round (all Low):

- No cap on the total of one import across files: now 500 (`too_many_total`).
- A failed save of the imported list kept the profiles in memory: now `trySet`, nothing added, message in the dialog.
- Very long number texts from a file were kept: now over 32 characters reads as an empty box.
- The `blob:` URL was revoked right after the click: now after 1000 ms.

Pre-existing, Low, not fixed: click values have no bounds; `1e-300` is accepted by the form, and so by import.

## Acceptance criteria (#166)

| Criterion | Status |
|-----------|--------|
| Every route matches its canvas board on phone, tablet and desktop, light and dark | Profiles routes done (not checked in a browser); other routes in later rounds |
| Ballistic and Scope View render the same Wind and Atmosphere components | Later round |
| − and + buttons on every numeric Scope View field | Later round |
| Profile selection uses the picker pattern on Profiles, in calculators and in Compare "Add profile" | Profiles done; `ProfilePicker` ready for the calculators and Compare (later round) |
| Export all, Export this profile and Import work; new ids; never replace; unreadable files reported | Done (not checked in a browser) |
| Deleting the profile in use activates another; the last cannot be deleted | Done |
| MPBR near zero | Later round |
| About "Provided by Chocolate Warfare" | Later round |
| Clear all data asks for confirmation and empties local storage | Logic done and tested; screen and confirmation in the Settings round |
| New strings in EN, FR and DE | Done for this round (723 keys) |
| Specs for import/export and the delete-in-use rule | Done |
| `npm run test:run` and `npm run build` pass | Done |

## Known limitations / follow-ups

- Not checked in a browser, at any width or theme.
- The choices above wait for the owner.
- Clear all data has no button yet (Settings round).
- The in-app privacy page is unchanged; it does not mention import or Export all.
- `swipe.js` and `svelte-gestures` are unused; removing them is a later clean-up.
- Android and iOS: whether a `blob:` download saves is still not checked (#135). Electron has no `will-download` handler.
- The pre-existing Low on click value bounds is not fixed.

## Changelog

- 2026-11-17: initial delivery (Profiles round of #166)
