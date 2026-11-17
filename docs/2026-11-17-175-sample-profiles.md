# Sample profiles: M193 length, M4 twist and a Remington 700 (#175)

Issue: [#175](https://github.com/hawkins48b/cw-zro/issues/175). Owner request, 2026-11-17.

## What changed

- Ammo library ([`ammo.json`](../src/lib/data/ammo.json)): "M193 5.56x45/.223" length 18.03 mm (0.710 in, too short for a 55 gr FMJBT) → **18.92 mm** (0.745 in, the typical length).
- Sample "Example Colt M4" ([`sampleProfile.js`](../src/lib/utils/sampleProfile.js), `SAMPLE_PROFILE`): barrel twist empty → **1:7 in**, bullet length empty → **0.745 in** (the library M193). All other values unchanged (BC stays 0.285 G1, spin drift off). With twist and length filled, stability and spin drift can now be computed for this profile when spin drift is switched on.
- New frozen sample `SAMPLE_R700`, "Example Remington 700", so the calculators can be explored on a scoped bolt rifle:

  | Field | Value | Source |
  |---|---|---|
  | Ammunition | "308 Winchester 7.62x51", 150 gr, G1 0.435, diameter 0.308 in, length 1.14 in | ammo library |
  | Barrel twist | 1:10 in | agent's choice (SPS Tactical) |
  | Velocity | 2820 fps | agent's choice (150 gr factory load) |
  | Optic | "Riflescope 4-16x44", height 1.5 in | agent's choice |
  | Zero | 100 yd | agent's choice |
  | Reticle, clicks | MOA, 0.25 MOA elevation and windage, linked | agent's choice |
  | Temperature | 59 °F, spin drift and powder sensitivity off | agent's choice |

- `SAMPLE_PROFILES = [SAMPLE_PROFILE, SAMPLE_R700]` (frozen). The Welcome screen ([`welcome/+page.svelte`](../src/routes/welcome/+page.svelte)) now adds both, each through `profiles.add` with a fresh id, and makes the M4 (first) the active profile, then opens Scope View.
- Message `welcome_sample` now plural: en "Try it with sample profiles", fr "Essayer avec des profils d'exemple", de "Mit Beispielprofilen ausprobieren". No new key.

## Results

- Existing profiles are not migrated: profiles already saved, including an "Example Colt M4" added before this change, keep their values. Only sample profiles added from now on get the new values.
- Profiles that pick M193 from the ammo library from now on get 18.92 mm; profiles that took it before keep 18.03 mm.
- No recorded baseline changed.

## Checks

- `npm run test:run`: **4910 passed, 1 todo**. [`firstRun.test.js`](../src/test/firstRun.test.js) 17 → 23 tests: the M4 sample matches the library M193 (55 gr, 18.92 mm = 0.745 in) and has a 1:7 twist; `SAMPLE_R700` uses the library 308 Winchester (weight, BC, BC type, length); `SAMPLE_PROFILES` order, both frozen without id; both samples pass the profile validation, also with spin drift on; the R700 gives a result at 600 yd, below the 100 yd zero and above 1125 fps.
- `npm run build`: pass.
- Security review: PASS. Pre-existing Low, not fixed and not filed: `profiles.add` saves through the plain `store.value` setter, not the keep-only-if-saved path of #166, so with full or blocked storage the samples exist only in memory until the app is closed.
- Not checked in a browser. Translations not reviewed by native speakers.

## Open points (owner)

1. The R700 values marked "agent's choice" above were reported to the owner, not confirmed. In particular many R700 .308 barrels are 1:12, not 1:10.
2. Other library lengths look copied from another entry and were not changed: M855 19.81 mm (likely about 23.0), MK262 23.12 mm (likely about 25.2), MK318 and MK319 19.81 mm (about 24, to check), GP 90 19.81 mm and the BC of M855, MK311 Mod 0 a duplicate of M193 (probably not a real 5.56 load), 5.45x39 22.1 mm (about 25).
3. The M4 sample keeps its BC 0.285 G1; the library M193 has 0.243 G1.

## For the owner to test

On a fresh install (or after clearing all data): Welcome → "Try it with sample profiles" → Scope View with "Example Colt M4" active; Profiles lists "Example Colt M4" and "Example Remington 700". In the M4, twist 1:7 in and bullet length 0.745 in are filled. Check the French and German button texts.
