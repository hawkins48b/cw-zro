---
name: i18n
description: Internationalization for the ZRO app using Paraglide JS (inlang). Use when adding translatable strings, creating new pages or components with user-facing text, setting up language switching, handling plurals, formatting numbers/units, or any i18n-related work.
user-invocable: true
---

# Internationalization — ZRO Project (Paraglide JS)

This project uses **Paraglide JS** by inlang — the officially recommended i18n solution for SvelteKit. It compiles translations into tree-shakable functions at build time (up to 70% smaller bundles than runtime libraries).

See [references/paraglide-setup.md](references/paraglide-setup.md) for full setup and configuration.
See [references/paraglide-patterns.md](references/paraglide-patterns.md) for message syntax, plurals, and usage patterns.

## Core Rule

**Never hardcode user-facing strings.** Every label, placeholder, button text, error message, tooltip, unit name, and table header must use a translation function.

```svelte
<!-- WRONG -->
<button>Calculate</button>
<label>Muzzle Velocity</label>
<span>No profiles found.</span>

<!-- RIGHT -->
<button>{m.common_calculate()}</button>
<label>{m.profile_muzzle_velocity()}</label>
<span>{m.profile_empty_state()}</span>
```

## Quick Reference

### Imports

```js
import { m } from '$lib/paraglide/messages.js';
import { getLocale, setLocale, locales, localizeHref } from '$lib/paraglide/runtime.js';
```

### Using Messages

```svelte
<script>
  import { m } from '$lib/paraglide/messages.js';
</script>

<!-- Simple -->
<h1>{m.page_title()}</h1>

<!-- With interpolation -->
<p>{m.greeting({ name: userName })}</p>

<!-- Force a specific locale -->
<p>{m.greeting({ name: userName }, { locale: 'fr' })}</p>
```

### Message Files

Translation files live in `messages/{locale}.json`:

```
messages/
├── en.json    # English (base locale)
├── fr.json    # French
├── de.json    # German
└── ...
```

### Defining Messages

**messages/en.json**:
```json
{
  "common_calculate": "Calculate",
  "common_save": "Save",
  "common_cancel": "Cancel",
  "common_delete": "Delete",
  "profile_muzzle_velocity": "Muzzle Velocity",
  "profile_bullet_weight": "Bullet Weight",
  "ballistic_range": "Range",
  "ballistic_elevation": "Elevation",
  "unit_yards": "yd",
  "unit_meters": "m",
  "unit_fps": "fps",
  "unit_mps": "m/s",
  "greeting": "Hello {name}!",
  "profile_count": "{count, plural, one {# profile} other {# profiles}}"
}
```

**messages/fr.json**:
```json
{
  "common_calculate": "Calculer",
  "common_save": "Enregistrer",
  "common_cancel": "Annuler",
  "common_delete": "Supprimer",
  "profile_muzzle_velocity": "Vitesse initiale",
  "profile_bullet_weight": "Poids du projectile",
  "ballistic_range": "Distance",
  "ballistic_elevation": "Élévation",
  "unit_yards": "yd",
  "unit_meters": "m",
  "unit_fps": "fps",
  "unit_mps": "m/s",
  "greeting": "Bonjour {name} !",
  "profile_count": "{count, plural, one {# profil} other {# profils}}"
}
```

## Key Naming Convention

Use **flat keys** with dot-like prefixes separated by underscores:

```
{feature}_{element}          → profile_muzzle_velocity
{feature}_{context}_{element} → ballistic_chart_title
common_{element}              → common_save, common_cancel
unit_{name}                   → unit_yards, unit_moa
error_{context}               → error_profile_not_found
```

All keys are accessed as `m.key_name()` — function calls, not property access.

## Number & Unit Formatting

Numbers must respect the user's locale:

```js
// Use Intl.NumberFormat for locale-aware numbers
const fmt = new Intl.NumberFormat(getLocale(), {
  minimumFractionDigits: 1,
  maximumFractionDigits: 1
});
fmt.format(2831.5); // "2,831.5" (en) or "2 831,5" (fr)
```

Create a shared utility for consistent formatting:

```js
// src/lib/utils/format.js
import { getLocale } from '$lib/paraglide/runtime.js';

export function formatNumber(value, decimals = 1) {
  return new Intl.NumberFormat(getLocale(), {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals
  }).format(value);
}
```

## Language Switching

```svelte
<script>
  import { locales, localizeHref } from '$lib/paraglide/runtime.js';
  import { page } from '$app/state';
</script>

<nav>
  {#each locales as locale}
    <a href={localizeHref(page.url.pathname, { locale })} data-sveltekit-reload>
      {locale.toUpperCase()}
    </a>
  {/each}
</nav>
```

## Localized Links

Always use `localizeHref()` for internal navigation:

```svelte
<a href={localizeHref('/profiles')}>
  {m.nav_profiles()}
</a>
```

## What Must Be Translated

| Category | Examples |
|----------|---------|
| Navigation | Menu labels, tab titles, breadcrumbs |
| Forms | Labels, placeholders, validation errors, help text |
| Buttons | All button text, tooltips |
| Data tables | Column headers |
| Units | yd, m, MOA, MRAD, fps, m/s, ft-lbs, J, in, mm |
| Status/feedback | Empty states, loading text, success/error messages |
| Dialogs | Titles, descriptions, confirmation prompts |
| App metadata | Page titles (`<svelte:head>`) |

## What Should NOT Be Translated

- Technical identifiers (profile IDs, enum values)
- Brand names ("ZRO")
- Mathematical formulas and abbreviations used universally
- Log messages and developer-facing errors
