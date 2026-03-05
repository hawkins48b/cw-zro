# ZRO — Ballistic Calculator

ZRO is a precision shooting sports and long-range marksmanship calculator. It computes bullet trajectories, dope cards, MPBR, and provides an interactive scope view for field use. This is the v2 rewrite, targeting web, mobile (Capacitor), and desktop (Electron) from a single codebase.

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Framework | Svelte 5 (runes) + SvelteKit 2 |
| Language | JavaScript (no TypeScript) |
| UI | Skeleton UI v4 + Tailwind CSS v4 |
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

## License

Proprietary — all rights reserved.
