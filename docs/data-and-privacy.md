# Data and privacy

ZRO has no backend and no accounts. The app's code sends nothing the user enters anywhere. This guide says what is stored, where, and what leaves the device, and how each statement was checked.

## What is stored

Data stays in the browser's `localStorage`, or the same store in the Electron and Capacitor web view. It is plain JSON, not encrypted.

| Key | Content | Store |
|-----|---------|-------|
| `zro-profiles` | Profiles: names, rifle and optic names, ammunition, zero, ballistic data, click values | [`profiles`](../src/lib/stores/profiles.svelte.js) |
| `zro-active-profile` | ID of the active profile | [`activeProfile`](../src/lib/stores/activeProfile.svelte.js) |
| `zro-ballistic` | Ballistic calculator: range, atmosphere, wind, display options | [`ballistic`](../src/lib/stores/ballistic.svelte.js) |
| `zro-scope-view` | Scope view: range, angle, atmosphere, wind, rotation | [`scopeView`](../src/lib/stores/scopeView.svelte.js) |
| `zro-traj-validation` | Trajectory validation inputs | [`trajectoryValidation`](../src/lib/stores/trajectoryValidation.svelte.js) |
| `zro-compare-traj` | Compared profiles, range, chart unit | [`compareTrajectories`](../src/lib/stores/compareTrajectories.svelte.js) |
| `zro-mpbr` | MPBR target size | [`mpbr`](../src/lib/stores/mpbr.svelte.js) |
| `zro-dark-mode` | Dark mode choice, stored only after a change | [`settings`](../src/lib/stores/settings.svelte.js) |

These are the only uses of `localStorage` in `src/`, apart from the read in [`app.html`](../src/app.html) that sets dark mode before the first paint. There is no `sessionStorage`, no IndexedDB and no service worker.

**In memory only**, gone on reload: the ammo selection in progress and the profile form draft ([`ammoSelection`](../src/lib/stores/ammoSelection.svelte.js), [`formDraft`](../src/lib/stores/formDraft.svelte.js)).

**One cookie:** `PARAGLIDE_LOCALE`, the language code (`en`, `fr` or `de`). Paraglide's generated runtime writes it from the page when the language is first read, with a max age of 34560000 seconds (400 days) and path `/`. The app sets no other cookie.

### Limits of this storage

- Data lives on one device, in one browser. There is no sync, backup, export or import of profiles.
- Clearing site data deletes everything. The web, desktop and mobile apps each have their own separate storage.
- A value that is not valid JSON is replaced by the default, so a corrupted store loses its content.
- Anyone with access to the device or browser profile can read it.

## What leaves the device

| Traffic | When | Content | Goes to |
|---------|------|---------|---------|
| Page and code files | Web: opening the app, moving to a page that needs a new chunk | Standard browser request, with the locale cookie | The site's host |
| `/pdf/rifle-dataset-*.pdf` | Creating a dope card | Fetches the blank template. No profile data is sent | The same origin: the site's host on the web, local files on desktop and mobile |
| `_app/version.json` | When the tab regains focus, and once an hour | Standard browser request. The app does not use the result | The same origin |
| GitHub | Only when the user opens one of the two links on the About page | Opens in a browser | github.com |

The host sees what any web server sees, such as IP address, requested path and user agent. What it logs and keeps is not in this repository and could not be established.

**Generated files** are built on the device. CSV exports and PDF dope cards are saved through the normal download. They contain profile names and data, so they go wherever the user sends them.

## What does not exist

- No analytics, tracking, advertising or crash reporting
- No remote fonts, images or scripts
- No account, login or server-side storage
- No geolocation, camera or contacts access in the code
- No auto-update in the desktop app (`publish: null`)

## How this was checked

Checked on 2026-11-05 by reading the code:

- **Network:** searched `src/` and `electron/` for `fetch`, `XMLHttpRequest`, `sendBeacon`, `WebSocket`, `EventSource` and URLs. The only `fetch` calls are the two PDF templates.
- **Storage:** searched for `localStorage`, `sessionStorage`, `indexedDB`, `document.cookie`, `caches` and `serviceWorker`, in `src/` and in the generated Paraglide runtime.
- **Build output:** listed every URL in `build/`. They are XML namespaces, library error links, code comments, placeholder hosts for URL parsing, the two GitHub links, and the `pdf-lib` project link. None of those is requested by the code above.
- **Capacitor:** no plugin is imported in `src/`.

**Not checked:**

- Traffic was not captured from a running app, in any target.
- What the Electron runtime, Chromium or the mobile web views do on their own.
- The generated `android/` and `ios/` projects, which are not in the repository.
- What Google Play or the App Store collect. The privacy page says they may collect usage statistics.

## Offline use

Calculations run on the device, as the privacy page says. But the web app has no service worker, so it needs a connection to load. Charts and dope cards load code on demand, so they can fail on the web if the connection drops after the first load. The desktop and mobile apps contain their files.

## Security notes

- The app sets no Content-Security-Policy, in any target. What headers the web host adds was not checked.
- The desktop window cannot leave the app, and opens `https:` links only in the system browser. See [Architecture](architecture.md#desktop).
- Saved values are not validated when read, apart from the chart unit of compare trajectories. See [Input guards](ballistics-model.md#input-guards).
- The app's [privacy page](../src/routes/settings/privacy/+page.svelte) does not mention `localStorage`, the language cookie or host logs.
