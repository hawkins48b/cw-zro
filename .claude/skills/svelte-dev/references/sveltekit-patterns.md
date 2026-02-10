# SvelteKit Patterns — Detailed Reference

## Routing

### File-based Routes

```
src/routes/
├── +page.svelte           # GET /
├── +layout.svelte         # Layout wrapping all child routes
├── about/+page.svelte     # GET /about
├── blog/
│   ├── +page.svelte       # GET /blog
│   └── [slug]/
│       ├── +page.svelte   # GET /blog/:slug
│       └── +page.js       # Load data for blog post
├── (group)/               # Route group (no URL segment)
│   ├── +layout.svelte     # Shared layout for group
│   ├── login/+page.svelte
│   └── signup/+page.svelte
├── [...rest]/+page.svelte # Catch-all route (404)
└── api/
    └── data/+server.js    # API endpoint
```

### Dynamic Parameters

```svelte
<!-- src/routes/profiles/[id]/+page.svelte -->
<script>
  let { data } = $props();
</script>

<h1>{data.profile.name}</h1>
```

```js
// src/routes/profiles/[id]/+page.js
export function load({ params }) {
  return {
    profile: getProfile(params.id)
  };
}
```

### Optional Parameters

```
src/routes/[[lang]]/+page.svelte  # Matches / and /en, /fr, etc.
```

### Rest Parameters

```
src/routes/files/[...path]/+page.svelte  # Matches /files/a/b/c
```

## Load Functions

### Universal Load (+page.js)

Runs on server (SSR) and client (navigation):

```js
// +page.js
export function load({ params, url, fetch }) {
  const searchQuery = url.searchParams.get('q');
  return {
    items: fetch(`/api/items?q=${searchQuery}`).then(r => r.json())
  };
}
```

### Server Load (+page.server.js)

Runs only on the server:

```js
// +page.server.js
export async function load({ params, cookies, locals }) {
  const session = cookies.get('session');
  return {
    user: await getUser(session),
    secretData: await getSecretData(params.id)
  };
}
```

### Layout Load (+layout.js / +layout.server.js)

Data available to all child routes:

```js
// +layout.js
export function load() {
  return {
    settings: getSettings()
  };
}
```

## Form Actions

### Default Action

```js
// +page.server.js
export const actions = {
  default: async ({ request }) => {
    const formData = await request.formData();
    const name = formData.get('name');

    if (!name) {
      return { success: false, error: 'Name required' };
    }

    await saveProfile({ name });
    return { success: true };
  }
};
```

### Named Actions

```js
export const actions = {
  create: async ({ request }) => { /* ... */ },
  delete: async ({ params }) => { /* ... */ },
  update: async ({ request, params }) => { /* ... */ }
};
```

```svelte
<form method="POST" action="?/create" use:enhance>...</form>
<form method="POST" action="?/delete" use:enhance>...</form>
```

### Progressive Enhancement

```svelte
<script>
  import { enhance } from '$app/forms';

  let { form } = $props();
</script>

<form method="POST" use:enhance>
  <input name="name" value={form?.name ?? ''} />
  {#if form?.error}
    <p class="text-error-500">{form.error}</p>
  {/if}
  <button>Save</button>
</form>
```

### Custom Enhance

```svelte
<form method="POST" use:enhance={() => {
  // Before submit
  return async ({ result, update }) => {
    if (result.type === 'success') {
      // Handle success
    }
    await update(); // Apply default behavior
  };
}}>
```

## API Routes (+server.js)

```js
// src/routes/api/profiles/+server.js
import { json, error } from '@sveltejs/kit';

export async function GET({ url }) {
  const profiles = await getAllProfiles();
  return json(profiles);
}

export async function POST({ request }) {
  const body = await request.json();
  const profile = await createProfile(body);
  return json(profile, { status: 201 });
}
```

## Navigation

### Programmatic Navigation

```svelte
<script>
  import { goto } from '$app/navigation';
  import { page } from '$app/state';

  function navigate() {
    goto('/profiles');
  }
</script>

<p>Current path: {page.url.pathname}</p>
```

### Prefetching

```svelte
<a href="/about" data-sveltekit-preload-data="hover">About</a>
```

## Layouts

### Basic Layout

```svelte
<!-- +layout.svelte -->
<script>
  let { children, data } = $props();
</script>

<nav>...</nav>
<main>
  {@render children()}
</main>
<footer>...</footer>
```

### Layout Groups

Group routes to share layouts without affecting URLs:

```
src/routes/
├── (app)/
│   ├── +layout.svelte    # App layout (with nav)
│   ├── dashboard/
│   └── profiles/
├── (auth)/
│   ├── +layout.svelte    # Auth layout (no nav)
│   ├── login/
│   └── signup/
```

## Error Handling

### Error Page

```svelte
<!-- +error.svelte -->
<script>
  import { page } from '$app/state';
</script>

<h1>{page.status}</h1>
<p>{page.error?.message}</p>
```

### Throwing Errors

```js
import { error } from '@sveltejs/kit';

export function load({ params }) {
  const profile = getProfile(params.id);
  if (!profile) {
    error(404, 'Profile not found');
  }
  return { profile };
}
```

## Hooks

### Server Hooks (src/hooks.server.js)

```js
export async function handle({ event, resolve }) {
  // Runs for every request
  const session = event.cookies.get('session');
  event.locals.user = session ? await getUser(session) : null;
  return resolve(event);
}
```

## Adapter Configuration

For Capacitor/Electron (static output):

```js
// svelte.config.js
import adapter from '@sveltejs/adapter-static';

export default {
  kit: {
    adapter: adapter({
      pages: 'build',
      assets: 'build',
      fallback: 'index.html' // SPA mode
    })
  }
};
```

## Environment Variables

```js
// Access public env vars (available in browser)
import { PUBLIC_API_URL } from '$env/static/public';

// Access private env vars (server only)
import { DATABASE_URL } from '$env/static/private';

// Dynamic env vars
import { env } from '$env/dynamic/public';
```
