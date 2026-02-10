---
name: svelte-dev
description: Svelte 5 and SvelteKit development for the ZRO ballistic calculator. Use when creating Svelte components, implementing routing, data loading, stores, form handling, or any Svelte/SvelteKit patterns. This project uses JavaScript (not TypeScript), Svelte 5 runes, and Skeleton UI (not Flowbite).
---

# Svelte 5 & SvelteKit Development — ZRO Project

## Project Context

This is a ballistic calculator app targeting web, mobile (Capacitor), and desktop (Electron).

- **Svelte 5** with runes (`$state`, `$derived`, `$effect`, `$props`, `$bindable`)
- **SvelteKit 2** with file-based routing
- **JavaScript** (no TypeScript)
- **Skeleton UI v4** for components (NOT Flowbite)
- **Tailwind CSS v4** via Vite plugin
- **npm** as package manager

## Svelte 5 Runes — Quick Reference

See [references/svelte5-runes.md](references/svelte5-runes.md) for detailed patterns.

```svelte
<script>
  // Reactive state
  let count = $state(0);

  // Derived values
  let doubled = $derived(count * 2);

  // Complex derived
  let message = $derived.by(() => {
    if (count > 10) return 'High';
    return 'Low';
  });

  // Side effects
  $effect(() => {
    console.log('count changed:', count);
  });

  // Props
  let { name, value = 0, onchange } = $props();

  // Bindable props
  let { open = $bindable(false) } = $props();
</script>
```

### Key Rules

- **NEVER** use legacy `$:` reactive declarations — always use `$derived` or `$effect`
- **NEVER** use `export let` — always use `$props()`
- **NEVER** use `createEventDispatcher` — use callback props instead
- **NEVER** use `on:click` — use `onclick` (lowercase, no colon)
- Use `{#snippet}` and `{@render}` instead of slots
- Arrays/objects in `$state` are deeply reactive

## SvelteKit Patterns

See [references/sveltekit-patterns.md](references/sveltekit-patterns.md) for routing and data loading.

### Project Structure

```
src/
├── routes/              # File-based routing
│   ├── +page.svelte     # Page components
│   ├── +page.js         # Client load functions
│   ├── +page.server.js  # Server load/actions
│   ├── +layout.svelte   # Layout components
│   ├── +layout.js       # Layout load functions
│   └── +error.svelte    # Error pages
├── lib/                 # $lib alias
│   ├── components/      # Reusable components
│   ├── stores/          # Svelte stores
│   └── utils/           # Utility functions
├── app.html             # HTML template
└── app.css              # Global styles (Tailwind + Skeleton)
```

### Routing

```
src/routes/
├── +page.svelte                    # /
├── profiles/
│   ├── +page.svelte                # /profiles
│   ├── [id]/+page.svelte           # /profiles/:id
│   └── new/+page.svelte            # /profiles/new
├── calculators/
│   ├── +page.svelte                # /calculators
│   ├── ballistic/+page.svelte      # /calculators/ballistic
│   └── dope-cards/+page.svelte     # /calculators/dope-cards
```

### Load Functions

```js
// +page.js — runs on client and server
export function load({ params, url }) {
  return { id: params.id };
}

// +page.server.js — server only
export function load({ params }) {
  return { data: fetchFromDB(params.id) };
}
```

### Form Actions

```js
// +page.server.js
export const actions = {
  default: async ({ request }) => {
    const data = await request.formData();
    return { success: true };
  },
  delete: async ({ params }) => {
    // named action
  }
};
```

```svelte
<script>
  import { enhance } from '$app/forms';
  let { form } = $props();
</script>

<form method="POST" use:enhance>
  <input name="name" />
  <button type="submit">Save</button>
</form>

<!-- Named action -->
<form method="POST" action="?/delete" use:enhance>
  <button type="submit">Delete</button>
</form>
```

### Stores

```js
// src/lib/stores/profiles.js
import { writable, derived } from 'svelte/store';

export const profiles = writable([]);
export const profileCount = derived(profiles, $p => $p.length);
```

```svelte
<script>
  import { profiles } from '$lib/stores/profiles.js';
</script>

<p>Count: {$profiles.length}</p>
```

## Component Patterns

### Props with Defaults

```svelte
<script>
  let { label, value = 0, unit = 'moa', onchange } = $props();
</script>

<div>
  <label>{label}</label>
  <input type="number" {value} oninput={(e) => onchange?.(+e.target.value)} />
  <span>{unit}</span>
</div>
```

### Snippets (replacing slots)

```svelte
<!-- Parent -->
<Card>
  {#snippet header()}
    <h2>Title</h2>
  {/snippet}
  {#snippet children()}
    <p>Content</p>
  {/snippet}
</Card>

<!-- Card.svelte -->
<script>
  let { header, children } = $props();
</script>

<div class="card">
  {#if header}
    <div class="card-header">{@render header()}</div>
  {/if}
  {@render children()}
</div>
```

### Event Handling

```svelte
<!-- Svelte 5: lowercase, no colon -->
<button onclick={() => count++}>Click</button>
<input oninput={(e) => name = e.target.value} />

<!-- Callback props (replaces createEventDispatcher) -->
<script>
  let { onclick } = $props();
</script>
<button {onclick}>Click me</button>
```

## Important Notes

- This project does NOT use Flowbite — use Skeleton UI components
- Use `$lib/` alias for imports from the `src/lib/` directory
- Keep components focused and composable
- Use semantic HTML elements
- Forms should work with progressive enhancement
