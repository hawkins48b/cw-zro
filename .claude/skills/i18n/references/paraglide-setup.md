# Paraglide JS — Setup & Configuration

## Installation

Via SvelteKit CLI (recommended):

```bash
npx sv add paraglide
```

This automatically configures:
- `project.inlang/settings.json` — inlang project settings
- Paraglide Vite plugin in `vite.config.js`
- SvelteKit hooks (`reroute` and `handle`)
- Language/dir attributes in `app.html`
- Updated `.gitignore`

### Manual Installation

```bash
npm install @inlang/paraglide-js
```

## Vite Plugin Configuration

```js
// vite.config.js
import { sveltekit } from '@sveltejs/kit/vite';
import tailwindcss from '@tailwindcss/vite';
import { paraglideVitePlugin } from '@inlang/paraglide-js';
import { defineConfig } from 'vite';

export default defineConfig({
  plugins: [
    tailwindcss(),
    paraglideVitePlugin({
      project: './project.inlang',
      outdir: './src/lib/paraglide',
      strategy: ['url', 'cookie', 'baseLocale']
    }),
    sveltekit()
  ]
});
```

### Strategy Options

The `strategy` array determines locale detection order:
- `'url'` — detect from URL path prefix (`/en/...`, `/fr/...`)
- `'cookie'` — detect from cookie
- `'baseLocale'` — fallback to base locale
- `'acceptLanguage'` — detect from `Accept-Language` header
- `'globalVariable'` — detect from a global variable

For Capacitor/Electron (SPA mode), `['cookie', 'baseLocale']` is likely better since there's no server for URL-based routing.

## Inlang Project Settings

```json
// project.inlang/settings.json
{
  "$schema": "https://inlang.com/schema/project-settings",
  "baseLocale": "en",
  "locales": ["en", "fr", "de"],
  "modules": [
    "https://cdn.jsdelivr.net/npm/@inlang/message-lint-rule-empty-pattern@latest/dist/index.js",
    "https://cdn.jsdelivr.net/npm/@inlang/message-lint-rule-missing-translation@latest/dist/index.js",
    "https://cdn.jsdelivr.net/npm/@inlang/message-lint-rule-without-source@latest/dist/index.js",
    "https://cdn.jsdelivr.net/npm/@inlang/plugin-message-format@latest/dist/index.js"
  ],
  "plugin.inlang.messageFormat": {
    "pathPattern": "./messages/{locale}.json"
  }
}
```

## HTML Template

```html
<!-- src/app.html -->
<!doctype html>
<html lang="%lang%" dir="%dir%" data-theme="cerberus">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    %sveltekit.head%
  </head>
  <body data-sveltekit-preload-data="hover">
    <div style="display: contents">%sveltekit.body%</div>
  </body>
</html>
```

## Server Hooks

```js
// src/hooks.server.js
import { paraglideMiddleware } from '$lib/paraglide/server.js';

/** @type {import('@sveltejs/kit').Handle} */
export const handle = ({ event, resolve }) =>
  paraglideMiddleware(event.request, ({ request, locale }) => {
    event.request = request;
    return resolve(event, {
      transformPageChunk: ({ html }) =>
        html.replace('%lang%', locale).replace('%dir%', locale === 'ar' ? 'rtl' : 'ltr')
    });
  });
```

## Reroute Hook

```js
// src/hooks.js
import { deLocalizeUrl } from '$lib/paraglide/runtime.js';

/** @type {import('@sveltejs/kit').Reroute} */
export const reroute = (request) => {
  return deLocalizeUrl(request.url).pathname;
};
```

## Message Files Structure

```
messages/
├── en.json    # English (base locale — must have ALL keys)
├── fr.json    # French
├── de.json    # German
├── es.json    # Spanish
└── ...
```

## Generated Output

Paraglide compiles messages to `src/lib/paraglide/` (gitignored):

```
src/lib/paraglide/
├── messages.js     # m.key_name() functions
├── runtime.js      # getLocale, setLocale, locales, localizeHref, deLocalizeUrl
└── server.js       # paraglideMiddleware (server only)
```

## Lint Rules

The recommended lint modules catch:
- **Empty patterns** — translation key exists but has no text
- **Missing translations** — key exists in base locale but not in others
- **Without source** — key exists in a translation but not in base locale

## Static Site Generation / SPA Mode

For Capacitor/Electron builds with `adapter-static`:

```js
// src/routes/+layout.js
export const prerender = true;
```

```js
// svelte.config.js
import adapter from '@sveltejs/adapter-static';

export default {
  kit: {
    adapter: adapter({
      pages: 'build',
      assets: 'build',
      fallback: 'index.html'
    }),
    paths: {
      relative: false  // Required for SPA with localized routes
    }
  }
};
```

## Edge / Serverless Deployment

If deploying to edge functions, disable AsyncLocalStorage:

```js
paraglideVitePlugin({
  disableAsyncLocalStorage: true
})
```

Only use this in isolated serverless contexts.
