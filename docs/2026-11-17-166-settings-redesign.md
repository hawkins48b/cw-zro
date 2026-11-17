# Settings and About redesign, Clear all data, included software list

- **Date:** 2026-11-17
- **Branch:** task/166-redesign-all
- **Issue:** [#166](https://github.com/hawkins48b/cw-zro/issues/166), second area of four (Settings + About)
- **Status:** Delivered, not in production yet. Not checked in a browser

This document covers the **Settings round only**. The Profiles round is in [its own document](2026-11-17-166-profiles-redesign.md). The Calculators and the remaining layouts come in later rounds on the same branch.

## Summary

Before this round:

- Settings was one page with the dark mode switch, the language buttons and links. About had cards for ZRO, js-ballistics and bclibc. The Privacy page was a column of plain cards. The Licences page showed the three licence texts.
- `clearAllData` was written and tested in the Profiles round, but no screen called it.
- The app had no list of the third-party packages it ships.

The design is the claude.ai canvas "ZRO Calculator Redesign", pages Settings and About.

**Delivered.**

- **Settings** (`/settings`, "General"):
  - **Display**: Theme (Light / Dark, with a hint that the device setting applies until the user chooses) and Language (English / Français / Deutsch, each in its own language, with a hint that the app reloads).
  - **Data**: the number of profiles on this device, linking to Profiles, where they are exported and imported.
  - **About** links: About ZRO (with the version), Privacy, Licences and notices. On tablets the left pane has them instead, and the page shows a "This copy" card.
  - **Danger zone**: "Clear all data on this device". The confirmation opens inside the card (not a dialog), focus goes to Cancel. "Delete everything" calls `clearAllData()` and opens the Welcome screen, replacing the history entry so Back does not return to an emptied Settings page.
  - The build line "ZRO 2.0.0 · Web app" (or Android app, iOS app, Desktop app).
- **Settings section layout**: phone, one page at a time. Tablet (768 to 1023 px): a 256 px left pane with General, About, Privacy and Licences, and the page on the right; the layout header is hidden from 768 px, the pane holds the title. Desktop (1024 px and over): the sidebar lists the same four pages under Settings.
- **About** (`/settings/about`): logo card, description, "Provided by Chocolate Warfare" ("ZRO is created and maintained by Quentin Mathey", link to chocolate-warfare.com), This copy (version, platform, licence; phone only), Open source (MIT, link to the GitHub repository), Calculation engine (js-ballistics and the bclibc solver, with their versions and licences and source links). From 768 px two columns; on the right the licence texts (tablet) or the included software table (desktop).
- **Licences and notices** (`/settings/about/licenses`): the three licence texts as an accordion (one open at a time, the first open on arrival), then **Included software**: every shipped package with its version and licence, linked to its web page. Licences with terms beyond a permissive one are highlighted; a package that is not in every build has a tag ("Android · iOS", "Desktop").
- **Privacy** (`/settings/privacy`): a summary card, what is stored on this device (with "Clear all data in Settings" as a way to remove it), profile files (export and import stay on the device), the current weather facts as a When / Sent / To / Back / Kept table, and what happens outside the app (web host, offline use, app stores).
- **Links to other sites** open in a new tab (in Electron: the system browser), with an icon and a hidden "(opens in a new tab)".

## Choices not confirmed by the owner

| Topic | Choice |
|-------|--------|
| Breakpoint | Two panes from 768 px (`md`), left pane 256 px |
| About, right column | Tablet shows the licence texts, desktop the included software table |
| Included software | No "Used for" column |
| ApexCharts licence | Shown as "Own licence (LICENSE.md)" (npm's `SEE LICENSE IN LICENSE.md`) |
| Theme hint | "Until you choose, ZRO uses the light or dark setting of the device." The device setting is read once, at start; it is not followed live |
| Wording | "this device" everywhere |
| Privacy page | The line about the old language cookie is gone; the page now says "No cookies." |
| Licence texts | Not in their own scroll box; the first is open on arrival |
| French wording | "Zone sensible" (Danger zone), "Cette copie" (This copy), "manque dans cette version" (list missing from this build) |

## Release notes

- Settings, About, Privacy and Licences have a new layout. On tablets Settings has a left pane; on desktop the sidebar lists its pages.
- "Clear all data on this device" in Settings deletes every profile, value and choice on this device, after a confirmation, and restarts on the Welcome screen.
- About says ZRO is provided by Chocolate Warfare and shows which build and version is running.
- The Licences page lists every included package with its licence.
- The Privacy page now covers profile export and import.

## How to use

No account or role. All pages are also under `/fr/...` and `/de/...`.

- **Theme and language**: `/settings`, Display card. Tap Light or Dark; tap a language (the app reloads in it).
- **Clear all data**: `/settings`, Danger zone.
  1. "Clear all data…" opens the confirmation in the card: "Delete everything on this device?".
  2. Cancel closes it and returns focus to the button. "Delete everything" removes the data and opens `/welcome`.
  The card text says how many profiles will be deleted and suggests Export all first.
- **About**: `/settings/about`, or About ZRO in Settings. External links open in a new tab.
- **Licences**: `/settings/about/licenses`. Tap a licence title to open it; opening one closes the other.
- **Privacy**: `/settings/privacy`.

## Technical changes

### Logic

- New [`src/lib/utils/platform.js`](../src/lib/utils/platform.js): `isDesktopApp(env)` (moved from `currentWeather.js`: `app:` scheme or an `Electron/` user agent), `platformLabel(env)` (`android` or `ios` from `window.Capacitor.getPlatform()`, `desktop`, else `web`; a bridge that throws or says anything else reads as web), `APP_VERSION` (package.json `version` through `__APP_VERSION__`, the one the sidebar shows). Web and mobile share one bundle, so the platform is read at run time. [`currentWeather.js`](../src/lib/utils/currentWeather.js) now imports `isDesktopApp`; same behaviour.
- New [`src/lib/utils/licenseKind.js`](../src/lib/utils/licenseKind.js): `hasExtraTerms(license)`. Permissive SPDX ids (MIT, ISC, BSD, Apache-2.0, 0BSD, Zlib and a few more) are plain; one permissive alternative of an `OR` is enough, every part of an `AND` must be permissive; anything else, or a missing licence, is highlighted.
- [`settings.svelte.js`](../src/lib/stores/settings.svelte.js): `THEMES`, `settings.theme` (`'light'` or `'dark'`) and `settings.setTheme(theme)` (anything else changes nothing and returns `false`). `darkMode` is now `true` only for a stored `true`: a damaged stored value reads as light, as [`theme-init.js`](../static/theme-init.js) does before the first paint. Before, a truthy damaged value could show the light page with the dark button state.
- [`profiles.svelte.js`](../src/lib/stores/profiles.svelte.js): `profiles.count`.

### Included software list

- New [`scripts/license-rules.js`](../scripts/license-rules.js) and [`scripts/licenses.js`](../scripts/licenses.js), new script `npm run licenses:generate`. They write [`src/lib/data/licenses.json`](../src/lib/data/licenses.json) from `package.json`, `package-lock.json` and the installed `package.json` files (for the web address). No network. `node scripts/licenses.js --check` writes nothing and exits 1 when the file is out of date.
- What is listed: every production dependency and its own dependencies, tagged with platforms (`web`, `android`, `ios`, `desktop`); the Capacitor packages for Android and iOS, `electron-serve` and `electron` for desktop; the Svelte, SvelteKit, Skeleton and Tailwind runtime (devDependencies whose code ships), with `clsx` and `devalue`; the Paraglide package without its dependencies (its generated runtime is in the bundle). Left out: `@capacitor/cli` (build tool) and `svelte-gestures` (not imported).
- `bclibc 2.0.0`, LGPL-3.0-only, is an embedded entry: it is code inside `js-ballistics`, not an npm package. The generator stops with an error when `js-ballistics` is no longer 3.1.0, so the bclibc entry is checked again on each update.
- Homepages are kept only when they are `https:` without user or password, in the generator and again in the page.
- Today: 27 entries. Licences: MIT, ISC, 0BSD, `(MIT AND Zlib)` (pako), LGPL-3.0-only (bclibc), and `SEE LICENSE IN LICENSE.md` (apexcharts, apex-commons).

### Components and pages

All new components are in [`src/lib/components/settings/`](../src/lib/components/settings/):

| Component | Role |
|-----------|------|
| `DisplaySettingsCard.svelte` | Theme and Language rows in one card |
| `ProfilesDataCard.svelte` | Profile count, link to Profiles |
| `SettingsLinksCard.svelte` | About ZRO, Privacy, Licences links (phone and desktop) |
| `ClearDataCard.svelte` | Danger zone, inline confirmation, `clearAllData()` then `/welcome` with `replace` |
| `AboutIdentityCard.svelte` | Logo, tagline, "by Chocolate Warfare", version from 768 px |
| `ProvidedByCard.svelte` | "Provided by Chocolate Warfare", maintainer, site link |
| `ThisCopyCard.svelte` | Version, platform, licence (phone About) |
| `OpenSourceCard.svelte` | MIT and the GitHub link |
| `EngineCreditsCard.svelte` | js-ballistics and bclibc, versions and licences read from `licenses.json` |
| `LicenceTexts.svelte` | Accordion of the bclibc notice, LGPL-3.0 and GPL-3.0 (files of `static/licenses/`, imported as text) |
| `IncludedSoftware.svelte` | The package list (`list`) or table (`table`, desktop About) |
| `ExternalLink.svelte` | `target="_blank"`, `rel="noopener noreferrer"`, icon and hidden "(opens in a new tab)" |
| `platformText.js` | Translated platform names (`platformText`, `platformShort`) |
| `settingsStyles.js` | Shared class strings (card, section title, link row, outline button, focus ring) |

| Path | Change |
|------|--------|
| [`routes/settings/+layout.svelte`](../src/routes/settings/+layout.svelte) | New: tablet left pane (768 to 1023 px) with the four pages and the build line |
| [`routes/settings/+page.svelte`](../src/routes/settings/+page.svelte) | Display, Data, About links or This copy, Danger zone, build line |
| [`routes/settings/about/+page.svelte`](../src/routes/settings/about/+page.svelte) | Rewritten from the cards above |
| [`routes/settings/about/licenses/+page.svelte`](../src/routes/settings/about/licenses/+page.svelte) | Licence texts and Included software, side by side from 1024 px |
| [`routes/settings/privacy/+page.svelte`](../src/routes/settings/privacy/+page.svelte) | Rewritten (see Summary) |
| [`routes/+layout.svelte`](../src/routes/+layout.svelte) | Settings sub-items in the desktop sidebar (General, About, Privacy, Licences, matched exactly); the Settings item itself gets `aria-current="true"` when General is the page; header hidden from 768 px on `/settings/...`; title "Licences and notices" on the Licences page |
| [`DarkModeToggle.svelte`](../src/lib/components/DarkModeToggle.svelte) | New `settings` variant; ids from `$props.id()`, so the sidebar and Settings groups no longer share `theme-label` |
| [`LanguageSwitcher.svelte`](../src/lib/components/LanguageSwitcher.svelte) | New `settings` variant: languages in their own names, with `lang=` |

### Messages

80 new keys and 11 removed in en, fr and de (`about_js_ballistics`, `about_js_ballistics_desc`, `about_view_on_github`, `about_bclibc`, `about_bclibc_desc`, `about_licenses`, `privacy_no_data_title`, `privacy_no_data_desc`, `privacy_storage_desc`, `privacy_storage_keep`, `privacy_weather_desc`). No existing value changed. Now 792 keys per language. The translator made 11 French and German fixes in the new strings (such as "Reçu" / "Erhalten" for the weather table's "Back"); no native speaker review.

### Guides updated

[`data-and-privacy.md`](data-and-privacy.md), [`architecture.md`](architecture.md), [`testing.md`](testing.md), [`translations.md`](translations.md), [`development.md`](development.md), and the Scripts and Dependency Updates sections of the [README](../README.md).

## Tests

| File | Tests | What |
|------|-------|------|
| [`licenses.test.js`](../src/test/licenses.test.js) (new) | 9 | `licenses.json` equals what the generator writes from the lockfile; every shipped dependency listed with licence, version and platforms, https homepages only; build tools left out; `svelte-gestures` still not imported in `src/` or `electron/`; `buildLicenses` on fake lockfiles (nested folders, missing optional ones, js-ballistics moved, missing dependency); `resolvePackage`; `packageHomepage` |
| [`platform.test.js`](../src/test/platform.test.js) (new) | 5 | `platformLabel` on Android, iOS, desktop (scheme, user agent), web, a bridge that lies or throws; `APP_VERSION` |
| [`theme.test.js`](../src/test/theme.test.js) (new) | 5 | `setTheme` stores what `theme-init.js` reads; other values ignored; toggle and `setTheme` share one state; system setting when nothing is stored, nothing written; a damaged value reads as light, as in `theme-init.js` |
| [`licenseKind.test.js`](../src/test/licenseKind.test.js) (new) | 5 | `hasExtraTerms`: permissive, copyleft and custom, `OR`, `AND`, missing |
| [`clearAllData.test.js`](../src/test/clearAllData.test.js) | 5 | Also checks `profiles.count` before and after |

`npm run test:run` on 2026-11-17: **4749 passed, 1 todo**, in 55 files (was 4725 in 51). `npm run build` passes. No baseline or calculated result changed. The pages and components have no component tests.

## What the owner should test

Nothing was checked in a browser. Please check in light and dark, at 390, 768, 1024 and 1280 px, in English, French and German (German widths especially):

1. `/settings` on phone: Display, Data, About links, Danger zone, the build line at the bottom.
2. `/settings` on tablet: left pane with General, About, Privacy, Licences, no header bar; This copy card. On desktop: the sidebar sub-items under Settings, the right one highlighted on each page.
3. Theme: Light / Dark switch at once and stay after a reload; the sidebar theme buttons stay in step.
4. Language: each choice reloads the page in that language.
5. Clear all data: the confirmation opens in the card with focus on Cancel; Cancel returns focus. "Delete everything" opens Welcome, Back does not return to Settings, Profiles is empty, the theme follows the device again.
6. `/settings/about`: Provided by Chocolate Warfare, This copy (phone), Open source, Calculation engine. Every external link opens in a new tab (desktop app: the system browser). Tablet: licence texts on the right; desktop: the included software table.
7. `/settings/about/licenses`: the accordion (first open, one at a time), the package list, highlighted licences (bclibc, ApexCharts), platform tags (Capacitor: Android · iOS; Electron: Desktop).
8. `/settings/privacy`: the summary, stored items, profile files, the weather table and the outside-the-app cards.

## Deployment notes

Nothing to do on the server. The release notes above must go out with the release.

After every dependency update, Dependabot's included: run `npm ci`, then `npm run licenses:generate`, and commit `src/lib/data/licenses.json`. Otherwise `licenses.test.js` fails in CI. The generator reads the homepages from `node_modules`, so it needs installed packages. An update of `js-ballistics` stops the generator until the bclibc entry in `scripts/license-rules.js` is checked and updated.

## Security review

**PASS.**

Checked: the Clear all data flow (confirmation, navigation with `replace`), external links (`target="_blank"` with `noopener noreferrer`), the homepage links from `licenses.json`, the licence texts shown as text, the theme and language stores.

Fixed in this round (Low): homepage links are kept only when they start with `https://` in the page, as the generator already did.

Information: the generator follows the `link` paths of the lockfile to read package files. It runs at build time only, on the repository's own lockfile.

## Acceptance criteria (#166)

| Criterion | Status |
|-----------|--------|
| Every route matches its canvas board on phone, tablet and desktop, light and dark | Profiles and Settings routes done (not checked in a browser); other routes in later rounds |
| Ballistic and Scope View render the same Wind and Atmosphere components | Later round |
| − and + buttons on every numeric Scope View field | Later round |
| Profile selection uses the picker pattern on Profiles, in calculators and in Compare "Add profile" | Profiles done (round 1); calculators and Compare later |
| Export all, Export this profile and Import work | Done (round 1) |
| Deleting the profile in use activates another; the last cannot be deleted | Done (round 1) |
| MPBR near zero | Later round |
| About "Provided by Chocolate Warfare" | Done |
| Clear all data asks for confirmation and empties local storage | Done |
| New strings in EN, FR and DE | Done for this round (792 keys) |
| `npm run test:run` and `npm run build` pass | Done |

## Known limitations / follow-ups

- Not checked in a browser, at any width or theme.
- The choices above, and the three French terms, wait for the owner.
- The theme follows the device setting only as read at start; a device change while the app is open is not followed.
- `licenses.json` lists what the lockfile says ships. The list was checked against the source maps of one web build and the packaging on 2026-11-17; it is not re-checked automatically when the bundle changes.
- `swipe.js` and `svelte-gestures` are still in the repository, unused (listed as not shipped).

## Changelog

- 2026-11-17: initial delivery (Settings round of #166)
