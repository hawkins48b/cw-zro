# ZRO — Ballistic Calculator

ZRO is a precision shooting sports and long-range marksmanship calculator. It computes bullet trajectories, dope cards, MPBR, and provides an interactive scope view for field use. This is the v2 rewrite, targeting web, mobile (Capacitor), and desktop (Electron) from a single codebase.

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Framework | Svelte 5 (runes) + SvelteKit 3 |
| Language | JavaScript (no TypeScript) |
| UI | Skeleton UI v5 + Tailwind CSS v4 |
| Icons | Lucide Svelte |
| Ballistics | js-ballistics |
| Charts | ApexCharts (lazy-loaded) |
| PDF | pdf-lib |
| i18n | Paraglide JS (English, French, German) |
| Testing | Vitest (jsdom) |
| Package Manager | npm |

## Getting Started

```bash
npm install
npm run dev        # Start dev server at localhost:5173
```

## Scripts

| Command | Description |
|---------|-------------|
| `npm run dev` | Start development server |
| `npm run build` | Production build (static SPA) |
| `npm run preview` | Preview production build |
| `npm run test` | Run tests in watch mode |
| `npm run test:run` | Run tests once (CI) |
| `npm run audit:check` | Fail on high or critical audit findings (CI) |

## Features

### Scope View
Live field calculator — enter distance, wind, and elevation angle to get real-time click adjustments. Interactive reticle display supports red-dot, MOA, MRAD, and mil-dot optics.

### Ballistic Calculator
Full trajectory table with customizable columns, CSV export, elevation chart with zero-crossing annotations, and velocity chart with speed-of-sound reference.

### MPBR Calculator
Computes Maximum Point-Blank Range for a given target size. Shows optimal zero distance, near/far zero, and a visual chart of the point-blank envelope.

### Trajectory Validation
Binary search solver — given a known impact point, solve for muzzle velocity or ballistic coefficient. Results can be saved back to the active profile.

### Trajectory Comparison
Overlay multiple profiles on a single chart to compare loads, calibers, or configurations.

### Dope Cards
Generate downloadable PDF dope cards in imperial or metric units.

### Profile Management
Create, edit, duplicate, and delete ballistic profiles (rifle + optic + ammo configuration). Profiles persist in localStorage. Includes an ammunition library with 50+ loads for quick setup.

### Settings
Dark/light mode (follows OS preference), language switching (EN/FR/DE), about page, and privacy policy.

## Project Structure

```
src/
├── routes/                  # SvelteKit pages
│   ├── +layout.svelte       # Root layout (navigation, header)
│   ├── scope-view/          # Live scope calculator
│   ├── calculators/         # Calculator hub
│   │   ├── ballistic/       # Trajectory table & charts
│   │   ├── mpbr/            # Max point-blank range
│   │   ├── trajectory-validation/
│   │   ├── compare-trajectories/
│   │   └── dope-cards/      # PDF generator
│   ├── profiles/            # Profile CRUD & ammo selector
│   └── settings/            # Preferences, about, privacy
├── lib/
│   ├── components/          # Reusable Svelte components
│   ├── stores/              # Reactive state (.svelte.js)
│   ├── utils/               # Pure business logic (testable)
│   ├── data/                # Static data (ammo library)
│   ├── paraglide/           # Generated i18n runtime
│   └── themes/              # Skeleton theme (zro.css)
├── test/                    # Vitest test files
└── app.css                  # Tailwind + Skeleton imports
```

## Architecture

### Responsive Layout

| Target | Navigation | Layout |
|--------|-----------|--------|
| Mobile (Capacitor) | Bottom bar | Single column |
| Tablet | Side rail | Two-column |
| Desktop (Electron/Web) | Full sidebar | Multi-column |

### Data Storage

All data is stored client-side in localStorage — no backend, no accounts. Profiles, calculator state, and preferences persist across sessions.

### Store Pattern

Stores use Svelte 5 runes (`$state`, `$derived`, `$effect`) in `.svelte.js` files. Business logic is extracted into pure utility functions in `src/lib/utils/` and tested independently. Stores are thin reactive wrappers around those functions.

### Internationalization

All user-facing strings go through Paraglide JS. Translation files live in `messages/{lang}.json`. The app supports URL-based locale switching (`/en/`, `/fr/`, `/de/`).

## Deployment

The app builds as a static SPA (`@sveltejs/adapter-static` with `fallback: 'index.html'`):

```bash
npm run build     # Output: /build/
```

- **Web**: Deploy `/build/` to any static hosting
- **Mobile**: Copy build output into Capacitor project
- **Desktop**: Load build output in Electron

## Dependency Updates

Dependabot (`.github/dependabot.yml`) checks npm and GitHub Actions every week and opens pull requests against `develop`, never `main`. Minor and patch updates are grouped into one pull request per ecosystem. Major updates come one by one.

- **`js-ballistics`** always gets its own pull request. Merge it only with owner approval of the results (#77).
- **`apexcharts`** gets no pull requests at all until the owner decides on its licence (#75).
- **`SamKirkland/FTP-Deploy-Action`** always gets its own pull request, because it runs with the FTP password. Review each update on its own.

Dependabot *security updates*, a repository setting, must stay off: they always target `main` and skip the rules above. Dependabot alerts are fine. No file in this repository can enforce this, so the owner has to confirm it in the repository settings.

### Audit

The `audit` job in CI runs `npm run audit:check`. It audits all dependencies, dev ones included, and fails on any high or critical advisory without a live exception. Moderate and low findings do not fail it.

| Exit code | Meaning | What to do |
|-----------|---------|------------|
| 0 | No unaccepted high or critical finding | Nothing |
| 1 | `AUDIT FAILED`: at least one finding is listed | Update the package, or add an exception |
| 2 | `AUDIT COULD NOT RUN` or `AUDIT NOT DECIDED`: the registry gave no report, the audit covered no dependencies, or the exceptions file is invalid | Rerun the job once the registry is back, or fix the lockfile or the exceptions file |

`npm audit` is retried three times when the registry gives no report. A check that could not run counts as failed, never as passed.

**CI runs inside the production deploy** (`deploy-prod.yml`), so either failure also blocks a deploy, even with no change to the dependencies. An exception is the way out of a finding. It does not help with a registry outage: rerun the job.

### Accepting an exception

Prefer a fix. If there is none yet, or the advisory does not affect ZRO, add it to `.github/audit-exceptions.json` through a pull request to `develop`. A deploy only sees it once it is on `main`.

```json
{
	"exceptions": [
		{
			"id": "GHSA-xxxx-xxxx-xxxx",
			"reason": "Why it is safe to ship, and what would remove the need for this.",
			"expires": "2026-12-31"
		}
	]
}
```

- All three fields are required, and an invalid file fails the check. `id` is the GHSA ID printed by the check.
- An exception covers that advisory only, on every package it reaches. Other advisories on the same package still fail.
- It applies through its `expires` date (UTC), then stops applying and the finding fails again. Keep it within 92 days and renew it with a new reason. A later date still works, but gives a warning.
- An exception that no longer matches a high or critical finding gives a warning: remove it.

## License

Proprietary — all rights reserved.
