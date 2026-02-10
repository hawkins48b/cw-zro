# Skeleton v4 — Theming, Colors & Presets

## Theme Setup

### app.css

```css
@import 'tailwindcss';
@import '@skeletonlabs/skeleton';
@import '@skeletonlabs/skeleton-svelte';
@import '@skeletonlabs/skeleton/themes/cerberus';
```

### app.html

```html
<html data-theme="cerberus">
```

## Available Themes (24)

catppuccin, cerberus, concord, crimson, fennec, hamlindigo, legacy, mint, modern, mona, nosh, nouveau, pine, reign, rocket, rose, sahara, seafoam, terminus, vintage, vox, wintry

### Using Multiple Themes

Import multiple themes in `app.css`:

```css
@import '@skeletonlabs/skeleton/themes/cerberus';
@import '@skeletonlabs/skeleton/themes/modern';
```

Switch dynamically:

```js
document.documentElement.setAttribute('data-theme', 'modern');
```

### Custom Theme

Use the theme generator at https://themes.skeleton.dev/ to create custom themes, then import the generated CSS file.

## Color System

### Palette Colors

Each color has 11 shades: `50, 100, 200, 300, 400, 500, 600, 700, 800, 900, 950`

| Color | Usage |
|-------|-------|
| `primary` | Primary brand / accent |
| `secondary` | Secondary brand |
| `tertiary` | Tertiary accents |
| `success` | Success states |
| `warning` | Warning states |
| `error` | Error / danger states |
| `surface` | Backgrounds, borders, neutral UI |

### Color Usage in Tailwind

```html
<!-- Background -->
<div class="bg-primary-500">...</div>
<div class="bg-surface-100-900">...</div>

<!-- Text -->
<p class="text-primary-500">...</p>
<p class="text-surface-400">Muted text</p>

<!-- Border -->
<div class="border border-surface-200-800">...</div>
<div class="border border-primary-500">...</div>
```

### Light-Dark Pairings

Use `{lightShade}-{darkShade}` for automatic light/dark mode:

```html
<!-- Light mode uses shade 100, dark mode uses shade 900 -->
<div class="bg-surface-100-900">Adapts to mode</div>

<!-- Light mode uses shade 200, dark mode uses shade 800 -->
<div class="border-surface-200-800">...</div>
```

### Contrast Colors

Each color shade has a matching contrast color for text readability:

```html
<!-- Auto-contrast text on colored background -->
<div class="bg-primary-500 text-primary-contrast-500">
  Readable text
</div>
```

## Preset System

Presets are pre-built utility class combinations for consistent styling.

### Filled Presets

Solid background with contrast text:

```
preset-filled                           (neutral)
preset-filled-primary-500               (primary at 500)
preset-filled-primary-{shade1}-{shade2} (light-dark pairing)
preset-filled-surface-100-900           (common for cards)
```

All colors: `primary`, `secondary`, `tertiary`, `success`, `warning`, `error`, `surface`

### Tonal Presets

Subtle background tint:

```
preset-tonal                (neutral)
preset-tonal-primary        (primary tint)
preset-tonal-surface        (surface tint)
```

### Outlined Presets

Border only, transparent background:

```
preset-outlined                           (neutral)
preset-outlined-primary-500               (primary border)
preset-outlined-surface-200-800           (common for cards/inputs)
```

### Where to Apply Presets

| Element | Common Presets |
|---------|---------------|
| Buttons | `preset-filled-primary-500`, `preset-tonal-surface`, `preset-outlined-primary-500` |
| Cards | `preset-filled-surface-100-900`, `preset-outlined-surface-200-800`, `preset-tonal-primary` |
| Badges | `preset-filled-success-500`, `preset-filled-error-500`, `preset-tonal-warning` |
| Chips | `preset-filled-primary-500`, `preset-tonal-secondary` |
| Input groups | `preset-outlined-surface-200-800` |
| Button groups | `preset-outlined-surface-200-800` |

### Creating Custom Presets

Add custom presets in your global CSS:

```css
/* In app.css or a dedicated presets file */
.preset-glass-primary {
  @apply bg-primary-500/10 backdrop-blur-sm border border-primary-500/20;
}

.preset-gradient-brand {
  @apply bg-linear-to-br from-primary-500 to-secondary-500 text-white;
}
```

## Dark Mode

Skeleton uses CSS `light-dark()` function. Dark mode strategy configured via Tailwind:

- **media** (default): follows OS preference
- **selector**: uses `.dark` class on `<html>`

### Mode-Specific Styling

```html
<!-- Tailwind dark variant -->
<div class="bg-white dark:bg-surface-900">...</div>

<!-- Skeleton color pairings handle this automatically -->
<div class="bg-surface-100-900">Auto light/dark</div>
```

## CSS Custom Properties

Override theme variables for customization:

```css
[data-theme='cerberus'] {
  --spacing: 0.22rem;
  --radius-container: 0.375rem;
  --body-background-color: #0a0a0a;
  --body-background-color-dark: #0a0a0a;
  --heading-font-family: 'Inter', sans-serif;
  --base-font-family: 'Inter', sans-serif;
}
```

## Iconography

Skeleton recommends Lucide icons:

```bash
npm install @lucide/svelte
```

```svelte
<script>
  import { Home, Settings, ChevronRight } from '@lucide/svelte';
</script>

<Home size={20} />
<Settings size={20} class="text-surface-400" />
```
