# Switch language without a full page reload (#178)

Owner request, [#178](https://github.com/hawkins48b/cw-zro/issues/178). Follows #96. Guide: [Translations](translations.md).

## What changed

Before, every language link had `data-sveltekit-reload` (#96). A click loaded `index.html` again and restarted the app, so the screen went white for a moment and the scroll position was lost.

Now a plain click switches the language in place. The links are still real links, so a new tab or a click before the app has started still works.

| Piece | Change |
|-------|--------|
| [`switchLocale.js`](../src/lib/utils/switchLocale.js) (new) | `switchLocale` stores the choice (`storeLocale`), then calls `goto(href, { replace: true, reset: false })`: no new history entry. After the navigation it puts back the scroll of `<main>` and the focus on the language button that had it (found again by position, as the buttons are rebuilt). |
| | Cross-fade with `document.startViewTransition` where the browser has it and reduced motion is off; otherwise the text swaps at once. |
| | If `goto` fails, it falls back to `location.assign(href)`: a full load in that language, as before. |
| | `isPlainClick`: a click with another button or a modifier key (Ctrl, Cmd, Shift, Alt) is left to the browser; the choice is still stored. |
| | `localeHref` keeps path, query and hash (before: only the path). A target that leaves the current protocol or host gives the start page in that language instead. It compares protocol and host, not `.origin`, which is `"null"` for `app://` and `capacitor://`. |
| [`LanguageSwitcher.svelte`](../src/lib/components/LanguageSwitcher.svelte) | `data-sveltekit-reload` removed from all three variants (settings, chips, group); `href` from `localeHref`; click handler `pick`. A click on the language already in use does nothing. |
| [`+layout.svelte`](../src/routes/+layout.svelte) | `locale` derived from `page.url` (`extractLocaleFromUrl`, else `baseLocale`). The whole layout is wrapped in `{#key locale}`, so it and the page are built again and every message and number format renders in the new language. `<html lang>` follows `locale`. |
| `settings_language_hint` (en, fr, de) | No longer says the app reloads. See below. |

Paraglide's `getLocale()` reads the address (`url` strategy). SvelteKit 3.2.0 calls `history.replaceState` before it applies the navigation result (checked in `navigate()` of `node_modules/@sveltejs/kit/src/runtime/client/client.js`). So when the keyed layout renders again, `getLocale()` already gives the new language.

The startup redirect of #96 (`hooks.client.js`, `startupLocaleRedirect`) is unchanged.

### Hint text

No native speaker review.

| Language | Before | After |
|----------|--------|-------|
| en | The app reloads in the language you pick. | Applies at once and is kept on this device. |
| fr | L'application se recharge dans la langue choisie. | S'applique aussitôt et reste mémorisée sur cet appareil. |
| de | Die App wird in der gewählten Sprache neu geladen. | Gilt sofort und bleibt auf diesem Gerät gespeichert. |

## Checks

- [`switchLocale.test.js`](../src/test/switchLocale.test.js): 9 new tests (`localeHref` keeps path, query and hash, gives the start page for a path that would leave the host, keeps the `app://` host; `isPlainClick`; `switchLocale` stores and navigates with replace, restores scroll and focus, runs inside a view transition, falls back to a full load when `goto` fails).
- `npm run test:run`: 65 files, 4919 tests passed, 1 todo.
- `npm run build` and `npm run build:mobile` pass.
- Security review: PASS. The change also fixes a pre-existing Low open redirect: on a crafted path such as `//evil.example`, the old English link pointed to another host and loaded it with a full reload. `localeHref` now gives the start page.

## Open points (owner)

- Not checked in a browser, in the Electron app or on a Capacitor device. The acceptance criterion "works in web, Electron and Capacitor builds" is unverified.
- Values typed but not saved (for example the profile editor in the middle of an edit) are lost on a switch, as they were with the reload.
- The cross-fade only shows where the browser has View Transitions. Elsewhere the text swaps without animation.

## For the owner to test

1. Open Settings, scroll down a little, pick Français, then Deutsch, then English. Expected: no white page, every text changes, the address gets `/fr` or `/de` (none for English), the scroll position stays, numbers use the new format.
2. Do the same with the chips on the Welcome screen.
3. Ctrl-click (Cmd-click on macOS) a language: it opens in a new tab, the current tab stays as it is.
4. With the keyboard, tab to a language button and press Enter: focus stays on the language buttons.
5. Close and reopen the app: it starts in the last chosen language (#96).
6. Repeat 1 and 5 in the Electron app and on a phone.
