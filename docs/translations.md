# Translations

ZRO is in English, French and German, through Paraglide 3. English is the base language. All user-visible text goes through messages.

| Piece | Where |
|-------|-------|
| Messages | [`messages/en.json`](../messages/en.json), [`fr.json`](../messages/fr.json), [`de.json`](../messages/de.json) |
| Settings | [`project.inlang/settings.json`](../project.inlang/settings.json) |
| Plugin | [`vite.config.js`](../vite.config.js) |
| Generated code | `src/lib/paraglide/`, git-ignored |

Each language has 379 keys on 2026-11-11.

## Adding a message

1. Add the key to **all three** files: `messages/en.json`, `fr.json` and `de.json`. Use the prefix of its area, such as `scope_view_`, `ballistic_`, `traj_val_` or `unit_`.
2. Use it in code:

   ```svelte
   <script>
   	import { m } from '#lib/paraglide/messages.js';
   </script>

   <p>{m.scope_view_range()}</p>
   ```

3. Parameters go in braces, as in `"about_version": "Version {version}"`, and are passed as `m.about_version({ version })`.
4. Run `npm run test:run`.

Keep the `.js` in the import. The module exists only through the Vite plugin, so `messages.js` works under Vite and Vitest, not in plain Node.

## What the tests check

[`messages.test.js`](../src/test/messages.test.js) fails when:

- the catalog has 300 keys or fewer, which catches an empty catalog
- `fr` or `de` does not have the same keys as `en`
- a message compiles to an empty string or to its own key

This matters because Paraglide only warns when it cannot load messages. The build then succeeds, and the app shows raw keys.

It does not check that a translation is correct, or that a key used in the code exists. No native speaker reviewed the French and German text added in [#82](2026-11-05-82-83-validation-solver.md).

## Locale URLs

| Language | URL |
|----------|-----|
| English | `/profiles` |
| French | `/fr/profiles` |
| German | `/de/profiles` |

English has no prefix. The strategy in `vite.config.js` is `url`, then `baseLocale`. The URL always wins, so a path with no prefix is English. [`hooks.js`](../src/hooks.js) removes the locale before routing.

[`LanguageSwitcher.svelte`](../src/lib/components/LanguageSwitcher.svelte) uses `localizeHref` and a full page reload. On a click it stores the language in `localStorage` under `zro-locale` (`en`, `fr` or `de`, plain text; English too, so that it can be chosen back).

**The choice survives a restart** ([#96](https://github.com/hawkins48b/cw-zro/issues/96)). The `init` hook in [`hooks.client.js`](../src/hooks.client.js) runs before the first render. When the URL has no locale prefix and `zro-locale` holds `fr` or `de`, it replaces the location with the same path, query and hash in that language (`location.replace`, so no history entry). A URL with `/fr` or `/de` wins and does not change the stored choice. Any other stored value is ignored, and so is a target on another protocol or host: a path such as `//evil.example` or `/\evil.example` would otherwise localize to `//evil.example/fr/`, an open redirect. The decision is [`startupLocaleRedirect`](../src/lib/utils/storedLocale.js), tested in [`storedLocale.test.js`](../src/test/storedLocale.test.js). The web, Electron (`app://`) and the Capacitor apps all start at `/`, so the same hook covers them. Storage errors are caught: the choice then holds until the app restarts.

The `cookie` strategy was dropped with this change. The cookie never decided the language, because `/` always resolved to English, and `app://` cannot hold it. The same hook deletes the `PARAGLIDE_LOCALE` cookie that earlier versions wrote.

Not verified on a device: the restart was checked through the tests and the web build only, not in a running Electron, Android or iOS app.

## Adding a language

1. Add it to `locales` in `project.inlang/settings.json`.
2. Add `messages/<locale>.json` with every key.
3. Add it to `catalogs` and the lists in `messages.test.js`.
4. Add a label to `localeLabels` in `LanguageSwitcher.svelte`.
5. Add it to the `(fr|de)` pattern of `safeReturnPath` in [`profileOps.js`](../src/lib/utils/profileOps.js), or the ammo selector drops the locale on return.

## Known problems

- **Long German labels** can clip on phones, for example `Temperaturempfindlichkeit aktivieren`.

## Build notes

- The message plugin is a devDependency pinned in `package.json`, so builds need devDependencies. The plain `npm ci` installs them.
- Builds load no remote code. [`settings.json`](../project.inlang/settings.json) uses a local module path, which the SDK calls "backwards compatibility", so recheck it on SDK upgrades.
