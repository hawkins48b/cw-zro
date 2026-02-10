# Paraglide JS — Message Syntax & Usage Patterns

## Message Format (Inlang Message Format)

### Simple Strings

```json
{
  "page_title": "Ballistic Calculator",
  "common_save": "Save"
}
```

```js
m.page_title()  // "Ballistic Calculator"
m.common_save() // "Save"
```

### Interpolation (Variables)

Use `{variableName}` in message text:

```json
{
  "greeting": "Hello {name}!",
  "profile_zero_range": "Zeroed at {distance} {unit}"
}
```

```js
m.greeting({ name: 'John' })                     // "Hello John!"
m.profile_zero_range({ distance: '100', unit: 'yd' }) // "Zeroed at 100 yd"
```

### Pluralization

Uses ICU MessageFormat syntax with `Intl.PluralRules`:

```json
{
  "profile_count": "{count, plural, one {# profile} other {# profiles}}",
  "items_selected": "{count, plural, =0 {No items selected} one {# item selected} other {# items selected}}"
}
```

```js
m.profile_count({ count: 1 })     // "1 profile"
m.profile_count({ count: 5 })     // "5 profiles"
m.items_selected({ count: 0 })    // "No items selected"
```

#### Plural Categories by Language

| Category | English | French | Russian | Arabic |
|----------|---------|--------|---------|--------|
| zero | — | — | — | 0 |
| one | 1 | 0, 1 | 1, 21, 31... | 1 |
| two | — | — | — | 2 |
| few | — | — | 2-4, 22-24... | 3-10 |
| many | — | — | 5-20, 25-30... | 11-99 |
| other | everything else | everything else | everything else | everything else |

Always provide at least `one` and `other`. Add more categories as needed for target languages.

### Ordinal Plurals

For ordinal numbers (1st, 2nd, 3rd):

```json
{
  "finished_place": "{place, selectordinal, one {#st} two {#nd} few {#rd} other {#th}}"
}
```

### Select (Conditional)

```json
{
  "unit_label": "{system, select, imperial {Imperial} metric {Metric} other {Unknown}}"
}
```

```js
m.unit_label({ system: 'imperial' }) // "Imperial"
m.unit_label({ system: 'metric' })   // "Metric"
```

## Advanced Variant Syntax (Inlang Native)

For complex multi-condition matching, use the array/object format:

```json
{
  "download_prompt": [{
    "match": {
      "platform=ios": "Download from the App Store",
      "platform=android": "Download from Google Play",
      "platform=*": "Download the app"
    }
  }]
}
```

## Using in Svelte Components

### Basic Usage

```svelte
<script>
  import { m } from '$lib/paraglide/messages.js';
</script>

<h1>{m.page_title()}</h1>
<button class="btn preset-filled-primary-500">
  {m.common_calculate()}
</button>
```

### With Dynamic Values

```svelte
<script>
  import { m } from '$lib/paraglide/messages.js';

  let { profiles } = $props();
</script>

<p>{m.profile_count({ count: profiles.length })}</p>

{#each profiles as profile}
  <div class="card preset-filled-surface-100-900 p-4">
    <h3 class="h3">{profile.name}</h3>
    <p>{m.profile_zero_range({ distance: profile.zeroDistance, unit: m.unit_yards() })}</p>
  </div>
{/each}
```

### In Attributes

```svelte
<input
  class="input"
  type="number"
  placeholder={m.profile_muzzle_velocity_placeholder()}
  aria-label={m.profile_muzzle_velocity()}
/>

<button class="btn preset-filled-error-500" title={m.common_delete()}>
  <TrashIcon size={18} />
</button>
```

### Page Titles

```svelte
<svelte:head>
  <title>{m.ballistic_page_title()} — ZRO</title>
</svelte:head>
```

### Force Locale

Render a message in a specific locale regardless of current setting:

```js
m.greeting({ name: 'World' }, { locale: 'de' }) // "Hallo World!"
```

## Locale Utilities

```js
import {
  getLocale,       // () => 'en'
  setLocale,       // ('fr') => triggers reload
  locales,         // ['en', 'fr', 'de']
  localizeHref,    // ('/profiles') => '/fr/profiles'
  deLocalizeUrl    // URL => { pathname, locale }
} from '$lib/paraglide/runtime.js';
```

### Language Switcher Component

```svelte
<script>
  import { locales, localizeHref, getLocale } from '$lib/paraglide/runtime.js';
  import { page } from '$app/state';

  const localeNames = {
    en: 'English',
    fr: 'Fran\u00e7ais',
    de: 'Deutsch'
  };
</script>

<div class="btn-group preset-outlined-surface-200-800">
  {#each locales as locale}
    <a
      href={localizeHref(page.url.pathname, { locale })}
      class="btn"
      class:preset-filled-primary-500={getLocale() === locale}
      data-sveltekit-reload
    >
      {localeNames[locale] ?? locale}
    </a>
  {/each}
</div>
```

### Localized Navigation

```svelte
<a href={localizeHref('/profiles')} class="btn preset-tonal-surface">
  {m.nav_profiles()}
</a>

<a href={localizeHref(`/profiles/${id}`)} class="btn preset-tonal-surface">
  {m.nav_edit_profile()}
</a>
```

## Number Formatting Utility

```js
// src/lib/utils/format.js
import { getLocale } from '$lib/paraglide/runtime.js';

export function formatNumber(value, decimals = 1) {
  return new Intl.NumberFormat(getLocale(), {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals
  }).format(value);
}

export function formatInteger(value) {
  return new Intl.NumberFormat(getLocale(), {
    maximumFractionDigits: 0
  }).format(value);
}

// Usage in component:
// formatNumber(2831.5)  → "2,831.5" (en) or "2 831,5" (fr)
```

## ZRO-Specific Key Organization

```
messages/en.json structure:

common_*           → Shared buttons/actions (save, cancel, delete, calculate, back)
nav_*              → Navigation labels (home, profiles, calculators, settings)
profile_*          → Profile management (fields, labels, actions)
ballistic_*        → Ballistic calculator (range, elevation, windage, chart)
dope_*             → Dope card feature
mpbr_*             → Maximum point blank range feature
scope_*            → Scope view feature
trajectory_*       → Trajectory comparison
atmosphere_*       → Atmosphere/weather conditions
unit_*             → Unit labels (yards, meters, moa, mrad, fps, etc.)
error_*            → Error messages
settings_*         → App settings
about_*            → About page
```
