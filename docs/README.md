# Documentation

## Guides

Living documents. They describe the current state of `develop`.

- [Architecture](architecture.md): stack and versions, code layout, routes, stores, build targets
- [Ballistics model](ballistics-model.md): inputs and units, what is modelled, input limits, accuracy
- [Development](development.md): setup, daily work, web, mobile and desktop builds, common problems
- [Testing](testing.md): test layers, baselines, tolerances, and the rule for changed results
- [Deployment](deployment.md): branch flow, environments, secret names, releases, known gaps
- [Translations](translations.md): adding messages and languages, locale URLs
- [Data and privacy](data-and-privacy.md): what is stored, where, and what leaves the device

## Delivery documentation

- [2026-11-05: Blocking unusable zero distances](2026-11-05-88-zero-distance-guard.md): a zero of 0 no longer freezes the app; an empty or tiny zero now gives no result, and the compare page shows a message
- [2026-11-05: Escaping profile names in the compare chart](2026-11-05-103-chart-name-escaping.md): names with markup and a bad stored chart unit no longer run as HTML; screen readers get entities in some labels for names with `&`, `<` or `>`
- [2026-11-05: Project documentation](2026-11-05-80-project-docs.md): README rewritten as an entry point, guides and `CLAUDE.md` added; describes the state on `develop` and names what is unfinished
- [2026-11-05: Automated dependency checks](2026-11-05-78-dependency-checks.md): weekly Dependabot configuration and a CI audit that fails on high or critical findings and blocks deploys; Dependabot only starts after a release, so the issue stays open
- [2026-11-05: Electron 45 and a working desktop package](2026-11-05-76-electron.md): Electron on 45.2.3, the packaged app now starts and the window stays inside the app; checked on Linux only, Windows and macOS not run
- [2026-11-05: Skeleton 5 and Lucide 1](2026-11-05-74-skeleton-lucide.md): UI library and icons on their new majors; defaults that Skeleton 5 changed without notice are restored, and the small visible changes that remain are listed
- [2026-11-05: Paraglide 3](2026-11-05-73-paraglide.md): Paraglide on 3.1.0 with no application code changes; builds no longer load remote code, and a new test fails on an empty message catalog
- [2026-11-05: SvelteKit 3 and Vite 8 toolchain](2026-11-05-72-toolchain.md): build toolchain on its latest majors, audit findings down from 13 to 11; `$lib` is now `#lib`, `svelte.config.js` is gone and Node 22.22.2 is the minimum
- [2026-11-05: In-range dependency updates](2026-11-05-71-in-range-updates.md): every dependency at the latest in its major, audit findings down from 48 to 13; lists what remains and which issue resolves it
- [2026-11-05: MPBR search without the 200 unit limit](2026-11-05-86-mpbr-search.md): large targets are no longer under-reported; the zero is always the far crossing, and dope cards print computed near and far zeros
- [2026-11-05: Max apex independent of the table step](2026-11-05-85-max-apex.md): max apex is now the same at any step and stays within the range; pinned values unchanged
- [2026-11-05: Humidity of 1 % or less](2026-11-05-84-humidity-fraction.md): 1 % no longer gives the result of 100 %; saved values of 1 or less shift, values above 1 are unchanged
- [2026-11-05: Trajectory validation above the line of sight, and failure reporting](2026-11-05-82-83-validation-solver.md): Below / Above choice on the page; unreachable goals now give "No solution" instead of a value
- [2026-11-04: Powder sensitivity in fps per degree](2026-11-04-81-powder-sensitivity.md): the setting now gives the entered fps per degree at any velocity; results of saved profiles shift
- [2026-11-04: Ballistics reference tests](2026-11-04-70-ballistics-reference-tests.md): regression baseline and published-data checks before the js-ballistics upgrade; lists open calculation problems
- [2026-11-04: Working production deploy and CI](2026-11-04-66-68-ci-deploy.md): Node 22 fix, CI before every deploy, FTPS, and open owner actions
