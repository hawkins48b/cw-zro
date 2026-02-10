# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

ZRO is a ballistic calculator for firearms (v2 rewrite), targeting web, mobile (Capacitor), and desktop (Electron). It replaces a Vue/Quasar v1 app. The app computes bullet trajectories, dope cards, MPBR, and provides a scope view for field use.

## iOS App Store Compliance

This app **must** pass Apple App Store review. Follow these rules strictly:

- **No firearms sales or marketplace features** — calculation and reference tool only
- **No content promoting violence** — all language must be neutral and technical (e.g., "target distance", "point of impact", not combat/hunting-glorifying language)
- **Educational/sporting framing** — present the app as a precision shooting sports and long-range marksmanship tool
- **Age rating**: likely 12+ (firearms reference). Ensure metadata and content match the declared rating
- **No web-only features behind paywall** that bypass App Store IAP rules
- **Privacy**: declare any data collection accurately. Prefer local-only storage where possible
- **No private API usage** via Capacitor plugins — use only App Store-approved APIs

## Tech Stack

- **Svelte 5** with runes (`$state`, `$derived`, `$effect`, `$props`) — no legacy `$:` or `export let`
- **SvelteKit 2** with file-based routing
- **JavaScript** (not TypeScript)
- **Skeleton UI v4** (`@skeletonlabs/skeleton` + `@skeletonlabs/skeleton-svelte`) — NOT Flowbite
- **Tailwind CSS v4** via Vite plugin (not PostCSS)
- **npm** as package manager
- **i18n**: all user-facing strings must go through the translation system — never hardcode display text

## Commands

```bash
npm run dev        # Start dev server
npm run build      # Production build
npm run preview    # Preview production build
```

## Architecture

### Responsive Layout Strategy

The app serves three form factors from a single codebase:

| Target | Navigation | Layout |
|--------|-----------|--------|
| **Mobile** (Capacitor) | Bottom bar (`Navigation layout="bar"`) | Single column, full-width cards |
| **Tablet** | Side rail (`Navigation layout="rail"`) | Two-column where appropriate |
| **Desktop** (Electron/Web) | Sidebar (`Navigation layout="sidebar"`) | Multi-column, wider data tables |

Use Tailwind responsive breakpoints (`sm:`, `md:`, `lg:`) to switch layouts. Navigation layout should adapt based on viewport, not platform detection.

### Dark / Light Theme

Every component **must** support both dark and light modes:

- Use Skeleton color pairings (e.g., `bg-surface-100-900`, `border-surface-200-800`) which auto-adapt to the active mode
- Use `preset-filled-*`, `preset-tonal-*`, `preset-outlined-*` which handle both modes
- **Never** hardcode colors like `bg-white`, `text-black`, `bg-gray-800` — always use Skeleton's semantic color tokens
- Theme is set via `data-theme` on `<html>` in `app.html`. Mode (light/dark) follows OS preference by default and can be toggled by the user
- Test every new component in both modes before considering it done

### Internationalization (i18n)

All user-facing text must be translatable:

- **Never** hardcode display strings in components — always use translation keys
- This includes: labels, placeholders, button text, error messages, units, tooltips, and table headers
- Keep translation keys organized by feature/page (e.g., `ballistic.range`, `profile.muzzleVelocity`)
- Unit labels (MOA, MRAD, fps, m/s, yards, meters) must also be translatable for localization
- Number formatting must respect locale (decimal separators, grouping)

### Styling Pipeline

`app.css` imports Tailwind, Skeleton core, Skeleton Svelte components, and the theme. The root layout (`+layout.svelte`) imports `app.css`. Tailwind runs as a Vite plugin (configured in `vite.config.js`), not via PostCSS.

### Skeleton UI Conventions

- **Framework components**: imported from `@skeletonlabs/skeleton-svelte` (AppBar, Navigation, Tabs, Dialog, etc.)
- **Tailwind components**: CSS classes applied directly — `btn`, `card`, `input`, `select`, `table`, `badge`, `chip` (no imports)
- **Presets**: `preset-filled-{color}-{shade}`, `preset-tonal-{color}`, `preset-outlined-{color}-{shade}`
- **Colors**: `primary`, `secondary`, `tertiary`, `success`, `warning`, `error`, `surface`
- **Composed pattern**: components use sub-components (e.g., `AppBar.Toolbar`, `AppBar.Lead`, `Tabs.List`, `Tabs.Trigger`)
- **No AppShell**: removed in v4 — use semantic HTML + Tailwind for layouts
- **LLM docs**: https://www.skeleton.dev/llms-svelte.txt

### Svelte 5 Rules

- Use `$props()` not `export let`
- Use `onclick` not `on:click`
- Use `{#snippet}` / `{@render}` not `<slot>`
- Use callback props not `createEventDispatcher`
- Arrays/objects in `$state()` are deeply reactive

### Deployment Targets

The adapter will be switched to `@sveltejs/adapter-static` with `fallback: 'index.html'` (SPA mode) for Capacitor and Electron builds.
