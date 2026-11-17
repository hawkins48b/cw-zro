# Skeleton 5 and Lucide 1

- **Date:** 2026-11-05
- **Branch:** task/74-skeleton-lucide
- **Issue:** [#74](https://github.com/hawkins48b/cw-zro/issues/74)
- **Status:** Delivered on `develop`, not in production yet

## Summary

The goal was to move Skeleton UI to version 5 and Lucide to version 1, with no missing icons or lost styling at phone, tablet and desktop widths in light and dark themes.

**Delivered:**

| Package | From | To |
|---------|------|----|
| `@skeletonlabs/skeleton` | 4.15.2 | 5.0.1 |
| `@skeletonlabs/skeleton-svelte` | 4.15.2 | 5.0.1 |
| `@lucide/svelte` | 0.577.0 | 1.69.0 |
| `@zag-js/*` (47 packages, plus 2 new: `marquee`, `qr-code`) | 1.39.1 | 1.43.0 |

Skeleton 5 changed several defaults that its migration tools do not flag. Five of them are restored in [`src/app.css`](../src/app.css).

### Effect on users

Text and form heights are unchanged. A few small visual differences remain, listed under [Visible changes accepted](#visible-changes-accepted).

## Technical changes

- **Theme:** the tokens in [`zro.css`](../src/lib/themes/zro.css) use the v5 names, for example `--base-font-color` is now `--typo-base--color-light`. Every existing value is kept. `--default-divide-width` is gone, and the file gains `--default-outline-width` and 44 other new tokens: 38 `inherit`, 2 `initial` and 4 brand colors.
- **GitHub icon:** Lucide 1.0 removed its brand icons, so [`GithubIcon.svelte`](../src/lib/components/GithubIcon.svelte) keeps the same shape locally. The [About page](../src/routes/settings/about/+page.svelte) imports it.
- **README:** the stack table now says Skeleton UI v5.

## Upgrading Skeleton: the tools miss changed defaults

`skeleton migrate skeleton-5` was run on a scratch copy, and its `zro.css` was used. **Neither the CLI nor the migration guide flags the changed defaults below.** They were found by diffing the v4 and v5 CSS. Do the same on future upgrades, and do not rely on the CLI or the guide alone.

## Skeleton 5 defaults restored

All of these are in [`src/app.css`](../src/app.css).

| Skeleton 5 change | Restored by |
|-------------------|-------------|
| Pointer cursor dropped from buttons, checkboxes and the switch | `cursor: pointer` on these, plus radios and `[role='button']` |
| `.input` and `.select` are now opaque, which hid unselected unit chips | Transparent background |
| Chips ignore `text-xs`, so fields grew from 35 px to 46 px | `--chip-size: var(--text-xs)`, and a negative block margin on `.input .chip` |
| Fields with a text suffix came out taller | The same negative margin on `.input > span` |
| `btn-sm` text grew from 12.8 px to 14.9 px, clipping a long German label | `--btn-size: var(--text-xs)` on `.btn-sm:not(.btn-icon)` |

## Visible changes accepted

These are kept as the library's intent:

- Slightly stronger input ring.
- Default buttons go from 35 px to 32 px, and chips from 26 px to 29 px.
- Badges are pill-shaped.
- Sidebar items are about 2 px tighter.
- `btn-icon` buttons are now square, so the `+` button on phones is narrower and taller.
- The `Zap` icon, used on the scope view, has a new shape upstream.

## Checks

**423 passed, 1 todo.** `build` and `build:mobile` pass. Smoke is 49 of 49 on web and on mobile. `npm audit` is unchanged at 11 total, 4 with `--omit=dev`. The test run, `npm audit`, the package versions and the web CSS size were rerun for this document; the builds, smoke and browser checks were not.

- **Bundle:** web JS about -1.8 kB. CSS goes from 140,335 to 160,193 bytes (gzip +2 kB), from Skeleton utilities that are always included.
- **Visual comparison:** 39 states at 3 widths in 2 themes, 234 screenshots per build. Text is identical on all 234, icon counts match, there is no new overflow and no console errors, and form heights are unchanged. Sample side-by-sides were also reviewed by eye.
- **Contrast:** `text-warning-800-200` is unchanged at 5.3:1 light and 13.58:1 dark.

## Deployment notes

Nothing to run or configure.

## Security review

**PASS**, no findings. The lockfile is clean, there are no new install scripts, and no new remote load reached the build.

## Known limitations / follow-ups

- **Not verified:** one scope view state (the rotated reticle), native `title` tooltips, a filtered ammo search, the mobile build by screenshot, Capacitor and Electron at runtime, real devices, Firefox and Safari.
- **Metrics only:** not every width and theme combination was viewed by eye; those rest on the metrics.
- **Existing issue, not from this upgrade:** `text-surface-500-400` compiles to no CSS on either version, because Skeleton has no shade 500 pairing. Its 104 uses render as plain body text rather than muted grey. `text-surface-600-300` and `text-surface-900-50` are also no-ops.
- **Existing issue, same as before:** `Temperaturempfindlichkeit aktivieren` still clips on phones.

## Changelog

- 2026-11-05: initial delivery
