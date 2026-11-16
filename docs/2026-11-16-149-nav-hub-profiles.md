# Navigation, Calculators hub and Profiles redesign, profile export

- **Date:** 2026-11-16
- **Branch:** task/149-nav-hub-profiles
- **Issue:** [#149](https://github.com/hawkins48b/cw-zro/issues/149), part of epic [#153](https://github.com/hawkins48b/cw-zro/issues/153)
- **Status:** Delivered, not in production yet. Not checked in a browser

## Summary

Before #149:

- The phone bar had three icons without labels (Scope View, Calculators, Profiles). Settings was a gear icon in the header, next to the theme switch.
- The tablet rail was 56 px wide, icons only.
- The navigation used Skeleton's `Navigation` component, and the active item was found on the raw URL. On `/fr/...` and `/de/...` no item was highlighted.
- The Calculators hub was a flat list of five cards. Descriptions showed on desktop only.
- The Profiles page pinned the active profile above the list. The list showed only with two or more profiles. Search sat behind a toggle button. Tapping a card made that profile active. There was no export.

The design is the claude.ai artifact canvas "ZRO Calculator Redesign": artboards "5 · Calculators", "6 · Profiles", the tablet rail and the desktop sidebar. This branch is #149 of epic #153.

**Delivered.**

- **Navigation.**
  - Phone: four tabs with icon and label: Scope, Calculators, Profiles, Settings. Settings is now a tab. The header keeps back, the title and the theme button, and lost its settings icon.
  - Tablet (640 to 1023 px): a 96 px rail with the logo, the same four labelled items and a theme button at the foot.
  - Desktop (1024 px and over): a sidebar with the calculators under Calculators, in the hub's order. At its foot are a Light / Dark control and the version.
  - The active item is now marked in French and German too (bug fix).
- **Calculators hub.** An intro names the active profile. Ballistic and Dope Cards are under "Start here"; MPBR, Compare and Trajectory Validation are under "More tools". Trajectory Validation has an "Advanced" badge. All descriptions are rewritten (en, fr, de) and show at every width.
- **Profiles.**
  - Intro line and an always-visible search. Sort chips show with two profiles or more.
  - Every profile is in the list, the active one included, marked "In use". The pinned card is gone, so a single profile now shows in the list.
  - Each other profile has a "Use" button. Every card has a ⋮ button that opens the sheet: Edit, Duplicate, Export, and Delete (not for the active profile).
  - Long-press opens the same sheet. Swipe-to-delete stays on cards that are not in use.
- **Profile export** (new, owner decision): one profile at a time as a JSON file.

## Owner decision (2026-11-16)

The issue spoke of the "existing" export. There was none. The owner decided to add a JSON export of one profile. There is no import yet.

## Developer's choices, reported, not confirmed by the owner

| Topic | Choice |
|-------|--------|
| A profile that cannot be exported (missing, not an object, not JSON) | Nothing happens: no file, no message |
| Profile id | Kept in the file. A later import should give a new id, as Duplicate does |
| Click value on the card | Shown as stored, for example "MOA 0.25", not "1/4" |
| Version line | Kept at the foot of the sidebar |
| Logo | The existing gradient favicon |
| "New Profile" button | Uses the same message as the page title (`profiles_new`) |

## Translator's choices

- German "Aktiv" for "In use".
- Short tab label for Scope View: "Optik" (de), "Lunette" (fr).
- German "Fortgeschritten" for the "Advanced" badge may be long for the badge. Check it in the browser.

## Release notes

- The navigation has labels, and Settings is a tab on phones (the header gear is gone).
- Tapping a profile card no longer switches profile. Use the "Use" button.
- A profile can be exported as a JSON file from its ⋮ menu. The app cannot import it yet.

## How to use

No account or role. All pages are also under `/fr/...` and `/de/...`.

- **Navigation.** Bottom tabs on a phone, the rail on a tablet, the sidebar on desktop. The theme button is in the header on a phone, at the foot of the rail on a tablet, and the Light / Dark control at the foot of the sidebar on desktop.
- **Calculators** (`/calculators`). The intro names the active profile (rifle · ammo). With no profile it says so and links to "Create a profile" (`/profiles/new`).
- **Profiles** (`/profiles`).
  - Type in the search box to filter by rifle or ammo.
  - Tap a sort chip (Recent, Name, Ammo); tap the active chip again to reverse the order.
  - "Use" makes that profile active.
  - ⋮ (or long-press) opens the sheet: Edit, Duplicate, Export, Delete. Escape or Cancel closes it, and focus goes back to the ⋮ button.
  - Swipe a card that is not in use to delete it, with confirmation.
  - Each card shows the name, the ammo, and a line with zero distance, muzzle velocity and elevation click.
- **Export.** ⋮ → Export saves `zro-profile-<name>.json` through the normal download. The file format and name rules are in [Data and privacy](data-and-privacy.md#what-leaves-the-device).

## Technical changes

- [`src/routes/+layout.svelte`](../src/routes/+layout.svelte):
  - Skeleton `Navigation` replaced by three plain navigations: phone tab bar, tablet rail `<nav>`, desktop `<aside>` with a `<nav>`. All are built from one item list and shown by CSS breakpoints (`sm`, `lg`). The `innerWidth` binding is removed.
  - `isActive` compares the path without its locale (`deLocalizeHref`), and matches the item or a path under it (`/profiles/...`), no longer any path that starts with the same letters.
  - `aria-current` is `page` on the current page and `true` on its section. The navs are labelled "Main" (`nav_main`).
  - Sidebar sub-items in the hub's order: Ballistic, Dope Cards, MPBR, Compare, Trajectory Validation.
  - Settings icon changed to `SlidersHorizontal`.
  - The back button is 44 px and has an `aria-label`.
- [`src/lib/components/DarkModeToggle.svelte`](../src/lib/components/DarkModeToggle.svelte): Skeleton `Switch` replaced. `variant="icon"` is a 44 px toggle button (`aria-pressed`, label "Dark theme"). `variant="segmented"` is the Light / Dark pair for the sidebar.
- [`src/lib/stores/settings.svelte.js`](../src/lib/stores/settings.svelte.js): new `setDarkMode(dark)`. `toggleDarkMode` calls it.
- [`src/routes/calculators/+page.svelte`](../src/routes/calculators/+page.svelte): intro from `activeProfile` through `shownProfile`, two groups, new icons, Advanced badge.
- [`src/routes/profiles/+page.svelte`](../src/routes/profiles/+page.svelte): new layout. The card tap no longer activates (`useProfile` is called only by "Use"). Search is always visible. The pinned card is gone. Export is added to the sheet. The sheet moves focus in when it opens and back to ⋮ when it closes.
- New [`src/lib/utils/profileExport.js`](../src/lib/utils/profileExport.js):
  - `profileExportFile`, `profileExportJson`, `profileExportFilename`, `filenamePart`.
  - Envelope `{ format: "zro-profile", version: 1, exportedAt, profile }`.
  - File name `zro-profile-<name>.json`, name part at most 60 characters, fallback `zro-profile.json`.
  - The page saves it as a `blob:` download and revokes the object URL right after the click, as the CSV and dope card downloads do.
- Messages: 20 new keys in en, fr and de (`nav_scope_short`, `nav_main`, `profiles_intro`, `profiles_in_use`, `profiles_use`, `profiles_use_named`, `profiles_more_actions`, `profiles_export`, `profiles_sort_label`, `profiles_meta_zero`, `calc_hub_*` (5), `calc_advanced`, `theme_label`, `theme_light`, `theme_dark`, `theme_dark_toggle`). Changed: the five `calc_*_desc` and `profiles_search_placeholder` (no ellipsis). Now 467 keys per language. `settings_dark_mode` is no longer used in `src/` but is still in the catalogs.
- Guides updated: [`architecture.md`](architecture.md) (layout by width, downloads in Electron), [`data-and-privacy.md`](data-and-privacy.md) (profile export), [`testing.md`](testing.md), [`translations.md`](translations.md) (key count).

## Tests

| File | What |
|------|------|
| [`profileExport.test.js`](../src/test/profileExport.test.js) (new, 45) | The envelope; the profile kept as stored with its id; no file for a profile that is not an object or cannot be JSON; damaged values. The file name: accented letters kept; path, control, bidirectional and Windows-forbidden characters removed; reserved names; NFC; 60-character cap without splitting a character; fallback name; linear time on long separator runs |

`npm run test:run`: 4174 passed, 1 todo (the G7 published-data todo, unchanged). `npm run build` and `npm run build:mobile` pass. No baseline or calculated result changed. The layout, hub and Profiles page have no component tests.

## What the owner should test

Nothing was checked in a browser. Please check in light and dark themes:

1. Phone width (390 px): four labelled tabs; Settings opens from its tab; the header has back (on inner pages), title and theme button, no gear.
2. Tablet width (768 px): 96 px rail with labels and the theme button at its foot; the header has no theme button.
3. Desktop width (1280 px): sidebar with the calculators in the order Ballistic, Dope Cards, MPBR, Compare, Trajectory Validation; Light / Dark switches the theme; version at the foot; no header.
4. On `/fr/...` and `/de/...`: the current item is highlighted at all three widths, also on an inner page such as `/fr/calculators/mpbr` (Calculators and the MPBR sub-item).
5. `/calculators`: the intro names the active profile; with no profile (clear storage) it shows "Create a profile". "Advanced" badge on Trajectory Validation, also in German.
6. `/profiles` with one profile: it is in the list with "In use", no Use button, no Delete in its sheet, no swipe.
7. With several profiles: search filters; sort chips work and reverse on a second tap; tapping a card body does nothing; "Use" switches the active profile; ⋮ and long-press open the sheet; Escape closes it and focus returns to ⋮; Edit, Duplicate, Delete work; swipe-to-delete still works.
8. Export: the file downloads with the name `zro-profile-<name>.json` and holds the envelope. Try a name with accents, spaces and an emoji.
9. Touch targets at least 44 px; French and German labels fit the tabs, rail and badges.

## Deployment notes

Nothing to do on the server. The release notes above must go out with the release.

## Security review

**PASS.**

- Info: the object URL is revoked right after the click, as the CSV and dope card downloads do. Some WebKit or Android WebViews might not save the file then.
- Pre-existing, Low: choice fields such as `elevationClickUnit` in [`storedProfiles.js`](../src/lib/utils/storedProfiles.js) have no length or value check. They are now shown in the card's meta line, as text (Svelte escapes it).

## Acceptance criteria

| Criterion | Status |
|-----------|--------|
| Phone tab bar with labels, Settings as a tab | Done (not checked in a browser) |
| Tablet rail and desktop sidebar as in the design | Done (not checked in a browser) |
| Calculators hub: intro with the active profile, Start here / More tools, Advanced badge, new descriptions in en, fr, de | Done (not checked in a browser) |
| Profiles: search, sort, In use, Use, ⋮ sheet with Edit, Duplicate, Export, Delete; long-press and swipe kept | Done (not checked in a browser) |
| Export | Added as JSON (owner decision); no import |
| `npm run test:run` and `npm run build` pass | Done |

## Known limitations / follow-ups

- Not checked in a browser at the three widths or in both themes.
- Electron: not checked whether the export shows a save dialog (`main.js` has no `will-download` handler).
- Android and iOS: not checked whether a `blob:` download saves at all. This is the same open point as the CSV and dope cards (#135).
- No import of the exported file yet.
- The developer's choices above wait for the owner's confirmation.
- The pre-existing Low finding on choice fields is not fixed.

## Changelog

- 2026-11-16: initial delivery
