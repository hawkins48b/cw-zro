---
name: skeleton-ui
description: Skeleton UI v4 component library for the ZRO ballistic calculator. Use when adding UI components, styling with presets, theming, creating layouts, using navigation, tabs, dialogs, forms, or any Skeleton-specific patterns. Skeleton uses Tailwind CSS v4 and Zag.js under the hood.
---

# Skeleton UI v4 — ZRO Project Reference

## Project Setup

- **Package**: `@skeletonlabs/skeleton` (core) + `@skeletonlabs/skeleton-svelte` (components)
- **Theme**: `cerberus` (active in `app.html` via `data-theme="cerberus"`)
- **Tailwind CSS v4** via Vite plugin (not PostCSS)
- **Built on Zag.js** for component state management

### Import Pattern

```svelte
<script>
  import { ComponentName } from '@skeletonlabs/skeleton-svelte';
</script>
```

## Quick References

- **Components**: See [references/skeleton-components.md](references/skeleton-components.md) for full component list and APIs
- **Tailwind Components**: See [references/skeleton-tailwind.md](references/skeleton-tailwind.md) for CSS utility classes
- **Theming & Presets**: See [references/skeleton-theming.md](references/skeleton-theming.md) for themes, colors, and presets
- **LLM docs**: https://www.skeleton.dev/llms-svelte.txt

## Three Pillars

### 1. Design System (Core)
Themes, colors, presets, typography, spacing, iconography.

### 2. Tailwind Components (CSS classes)
Badges, buttons, cards, chips, dividers, forms, placeholders, tables.
Applied via CSS classes — no imports needed.

### 3. Framework Components (Svelte)
30 interactive components imported from `@skeletonlabs/skeleton-svelte`.

## Component Patterns

### Composed Pattern
Components expose sub-components for granular control:

```svelte
<AppBar>
  <AppBar.Toolbar>
    <AppBar.Lead>Logo</AppBar.Lead>
    <AppBar.Headline>Title</AppBar.Headline>
    <AppBar.Trail>Actions</AppBar.Trail>
  </AppBar.Toolbar>
</AppBar>
```

### Data Model Pattern
Props for input, callbacks for output:

```svelte
<Switch checked={isEnabled} onCheckedChange={(details) => isEnabled = details.checked} />
```

### Provider Pattern
Access underlying Zag.js API:

```svelte
<Dialog.Provider>
  <Dialog.Trigger>Open</Dialog.Trigger>
  <Dialog.Positioner>
    <Dialog.Content>...</Dialog.Content>
  </Dialog.Positioner>
</Dialog.Provider>
```

## Tailwind Components — Quick Reference

### Buttons

```svelte
<!-- Standard button -->
<button class="btn preset-filled-primary-500">Click</button>

<!-- Sizes: btn-sm, btn-base, btn-lg -->
<button class="btn btn-lg preset-filled-primary-500">Large</button>

<!-- Icon button -->
<button class="btn-icon preset-filled-primary-500">
  <Icon size={18} />
</button>

<!-- Button group -->
<nav class="btn-group preset-outlined-surface-200-800">
  <button class="btn preset-filled">Active</button>
  <button class="btn">Item 2</button>
</nav>
```

### Cards

```svelte
<div class="card preset-filled-surface-100-900 p-4">
  <header class="border-b border-surface-200-800 pb-4">
    <h3 class="h3">Card Title</h3>
  </header>
  <article class="py-4">Content here</article>
  <footer class="border-t border-surface-200-800 pt-4">
    <button class="btn preset-filled-primary-500">Action</button>
  </footer>
</div>
```

### Forms (requires @tailwindcss/forms)

```svelte
<label class="label">
  <span class="label-text">Name</span>
  <input class="input" type="text" placeholder="Enter name" />
</label>

<label class="label">
  <span class="label-text">Type</span>
  <select class="select">
    <option>Option A</option>
  </select>
</label>

<!-- Input group -->
<div class="input-group preset-outlined-surface-200-800">
  <span class="ig-cell">$</span>
  <input class="ig-input" type="number" />
  <button class="ig-btn preset-filled">Go</button>
</div>
```

### Badges & Chips

```svelte
<span class="badge preset-filled-primary-500">Badge</span>
<span class="chip preset-tonal-primary">Chip</span>
```

### Tables

```svelte
<div class="table-wrap">
  <table class="table">
    <thead>
      <tr><th>Range</th><th>Elevation</th><th>Windage</th></tr>
    </thead>
    <tbody>
      <tr><td>100</td><td>0.0</td><td>0.0</td></tr>
    </tbody>
  </table>
</div>
```

## Preset System

### Three Preset Types

| Type | Pattern | Example |
|------|---------|---------|
| Filled | `preset-filled-{color}-{shade}` | `preset-filled-primary-500` |
| Tonal | `preset-tonal-{color}` | `preset-tonal-primary` |
| Outlined | `preset-outlined-{color}-{shade}` | `preset-outlined-primary-500` |

### Available Colors
`primary`, `secondary`, `tertiary`, `success`, `warning`, `error`, `surface`

### Shade Pairings (light-dark)
`950-50`, `900-100`, `800-200`, `700-300`, `600-400`, `500`, `400-600`, `300-700`, `200-800`, `100-900`, `50-950`

## Available Themes

24 themes: catppuccin, cerberus, concord, crimson, fennec, hamlindigo, legacy, mint, modern, mona, nosh, nouveau, pine, reign, rocket, rose, sahara, seafoam, terminus, vintage, vox, wintry

Switch theme: set `data-theme` attribute on `<html>`.

## Layout Pattern

Skeleton v4 no longer has AppShell. Use semantic HTML + Tailwind:

```svelte
<div class="h-screen flex flex-col">
  <!-- App Bar -->
  <AppBar>
    <AppBar.Toolbar>
      <AppBar.Lead>
        <a href="/">ZRO</a>
      </AppBar.Lead>
      <AppBar.Trail>
        <button class="btn-icon">Menu</button>
      </AppBar.Trail>
    </AppBar.Toolbar>
  </AppBar>

  <!-- Main content -->
  <main class="flex-1 overflow-auto p-4">
    {@render children()}
  </main>

  <!-- Bottom navigation (mobile) -->
  <Navigation layout="bar">
    <Navigation.Menu>
      <Navigation.Trigger href="/" title="Home">
        <HomeIcon size={20} />
        <Navigation.TriggerText>Home</Navigation.TriggerText>
      </Navigation.Trigger>
    </Navigation.Menu>
  </Navigation>
</div>
```

## Important Notes

- **Do NOT use Flowbite** — this project uses Skeleton exclusively
- **Do NOT use AppShell** — it was removed in v4, use semantic HTML layouts
- Components accept `class` prop for custom Tailwind utilities
- Use `element` prop to override default HTML elements in components
- Forms require `@tailwindcss/forms` plugin
- Icons: use `lucide-svelte` or `@lucide/svelte`
