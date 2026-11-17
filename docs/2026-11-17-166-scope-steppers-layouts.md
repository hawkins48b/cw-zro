# Scope View steppers and remaining layouts

- **Date:** 2026-11-17
- **Branch:** task/166-redesign-all
- **Issue:** [#166](https://github.com/hawkins48b/cw-zro/issues/166), fourth and last area (remaining layouts)
- **Status:** Delivered, not in production yet. Not checked in a browser

This document covers **round 4 only**, the last round of #166. The earlier rounds have their own documents: [Profiles](2026-11-17-166-profiles-redesign.md), [Settings](2026-11-17-166-settings-redesign.md), [Calculators](2026-11-17-166-calculators-redesign.md). The table [All acceptance criteria of #166](#all-acceptance-criteria-of-166) closes the issue's checklist.

## Summary

Every number box of the Scope View now has − and + buttons. The wind and atmosphere cards are shared with the Ballistic page, so Ballistic has the same buttons. The box stays typeable. A button only changes the text of the box, through the same setter as typing, so the calculators read a stepped value as a typed one. **No calculated result changed** for the same entered values.

The elevation angle is its own card, with the deg / cos chips inside the box. The Scope View has its tablet and desktop layouts, and the guided setup is a centred card on tablet and desktop.

**Delivered.**

- **− and + on every numeric field**, with labelled steps (table below). A step never leaves the limits the calculators check, so it can bring an out-of-range value back in but never takes a usable one out.
- **Elevation angle card**: its own card at every width. The deg / cos chips are inside the box, between the value and +.
- **Accurate atmosphere grid**: columns of at least 140 px (two on phones, three on a wide card). There the unit chips sit in the label row and the unit follows the value, so the box fits 140 px.
- **Profile in use on the Scope View**: the `ProfileInUseChip` of the Calculators round. Change opens the profile picker in place; it no longer goes to `/profiles`.
- **Scope View tablet (640 to 1023 px)**: two equal columns, the answer on the right. The answer shows the dial tiles and the hold reticle together, without the Dial / Hold switch. The stored Dial / Hold choice is not changed and applies again on phone and desktop.
- **Scope View desktop (1024 px and over)**: title and intro line, profile chip on the right of the header, inputs and answer at about 6:5, the answer sticky with its Dial / Hold switch, content at most 1180 px wide.
- **Guided setup on tablet and desktop** (`/setup`, from 640 px): a top bar (logo, title, step) and one centred card with the progress steps, the step and Back / Next at its foot; 680 px wide, 760 px from 1024 px. On the desktop card the ammunition step is in two columns. Phones keep the full-screen layout.

### Steps and limits

| Field | Step | Limits | Empty or unreadable box starts from |
|-------|------|--------|-------------------------------------|
| Wind speed | 0.5 m/s, 1 mph | 0 to 100 m/s (`MAX_WIND_SPEED_MPS` of `shotWinds`, 223.69 mph) | 0 |
| Wind direction | 5° | goes round in 0 to 360 (355 + 5 gives 0) | 0 |
| Elevation angle, deg | 1° | above −90 and below 90 (stops at ±89 with whole degrees) | 0 |
| Elevation angle, cos | 0.01 | above 0, at most 1 | 1 (flat), so − gives 0.99 |
| Altitude | 10 m, 10 ft | `altitudeLimits` | 0 |
| Pressure (QNH or Station) | 1 hPa, 0.01 inHg | `pressureLimits` | 1013 hPa, 29.92 inHg |
| Temperature | 1 °C, 1 °F | `temperatureLimits` | 0 °C, 32 °F (as before) |
| Humidity | 5 % | 0 to 100 % | 65 % |
| Cant (Hold reticle) | 1° | −90 to 90, the slider's range (`MAX_ROTATION`) | 0 |

Target distance keeps its per-digit steppers. Cant has two 44 px buttons beside its slider and is stored through `setRotation`, as the slider stores it.

**Decimals.** A stepped value keeps the decimals of the step or of the value, whichever has more, at most 10. So 29.921 + 0.01 gives 29.931, and the Estimate temperature is no longer rounded to 0.1: 12.55 + 1 gives 13.55 (before, the old ±1 rounded to 0.1). A value clamped to a limit keeps at most one decimal more than the step: a long out-of-range cosine comes back as 0.001, and the box never gets exponent text such as `1e-10`.

**Repairs.** A step reads the box as the calculators do (`1,5` is 1.5). Text that is not a number restarts from the start value of the table: a direction of `Infinity` gives 5 on +. A temperature out of its limits comes back to the nearest limit.

## Choices not confirmed by the owner

| Topic | Choice |
|-------|--------|
| Empty-box start values | As in the table: humidity 65 % (the Cloudy default), pressure the standard 1013 hPa / 29.92 inHg, cosine 1 |
| Decimals | Kept up to 10 (see above); the Estimate temperature no longer rounds to 0.1 |
| Tablet answer | Dial tiles and hold reticle both shown, switch hidden |
| Desktop proportions | Inputs and answer about 6:5, page at most 1180 px |
| Accurate grid | Auto-fit columns of at least 140 px, chips in the label row |
| Setup card | 680 px, 760 px on desktop; ammunition step in two columns on desktop |

**Not built** from the TabletScope board: the numbered section headings and the "Optional" tags.

## Release notes

- Every number on the Scope View and in the Ballistic wind and atmosphere cards has − and + buttons.
- The elevation angle has its own card; deg and cos are chosen inside the box.
- On a tablet the Scope View shows the dial values and the hold reticle together.
- On a desktop the Scope View has inputs on the left and the answer on the right.
- The guided setup is a centred card on tablets and computers.

## How to use

No account or role. All pages are also under `/fr/...` and `/de/...`.

- **Step a value**: tap − or + beside the box on `/scope-view` or `/calculators/ballistic`. The buttons repeat nothing on hold: one tap, one step. Typing still works.
- **Angle unit**: tap deg or cos inside the angle box.
- **Change the profile on the Scope View**: tap the profile chip, select a profile, "Use this profile".

## Technical changes

### New files

| Path | Role |
|------|------|
| [`utils/fieldStep.js`](../src/lib/utils/fieldStep.js) | `fieldStepSpec(field, unit)` (step, limits, open ends, start value, wrap), `stepValue(value, delta, spec)` (the new box text), `decimalsOf`, `maxWindSpeed`. Limits come from `inputLimits.js`, `scopeRange.js`, `shotWind.js` and `storedState.js`, the ones the calculators check |
| [`components/StepperField.svelte`](../src/lib/components/StepperField.svelte) | Typeable box `[−] value [suffix] [unit chips] [+]`, label row with an optional `labelEnd` snippet, hint / error / warning line (`role="alert"` for the last two). Calls `onchange` with the typed or stepped text |
| [`components/StepButton.svelte`](../src/lib/components/StepButton.svelte) | One − or + button, 44 px, with an accessible name and title such as "Increase altitude by 10 m". `inset` (inside a box) or `standalone` (beside the cant slider) |
| [`test/fieldStep.test.js`](../src/test/fieldStep.test.js) | 22 tests, see [Tests](#tests) |

### Changed files

| Path | Change |
|------|--------|
| [`scope-view/+page.svelte`](../src/routes/scope-view/+page.svelte) | Header with title and intro (desktop) and `ProfileInUseChip` (`card` on phones, `compact` from 640 px); grid two equal columns from `sm`, `6fr / 5fr` from `lg`; the angle card uses `StepperField` with the deg / cos chips; `ScopeResult both` while the `MediaQuery` `(min-width: 40rem) and (max-width: 63.98rem)` matches |
| [`ScopeResult.svelte`](../src/lib/components/ScopeResult.svelte) | `both` prop: no Dial / Hold switch, the dial tiles and the `hold` snippet both shown; `mode` and `onmodechange` untouched |
| [`ScopeWindCard.svelte`](../src/lib/components/ScopeWindCard.svelte) | Speed and direction as `StepperField`; the old ±5° direction buttons replaced by the stepper's −/+ (same 5°, same messages) |
| [`ScopeAtmosphereCard.svelte`](../src/lib/components/ScopeAtmosphereCard.svelte) | Altitude, pressure, temperature and humidity as `StepperField`; the own `stepTemperature` (rounded to 0.1) removed; Accurate grid `repeat(auto-fit, minmax(140px, 1fr))` with chips in the label row (`compact`) |
| [`ScopeReticle.svelte`](../src/lib/components/ScopeReticle.svelte) | Cant −/+ around the slider, `setRotation(Number(stepValue(...)))` |
| [`utils/shotWind.js`](../src/lib/utils/shotWind.js) | `MAX_WIND_SPEED_MPS` exported (value unchanged, 100) |
| [`GuidedSetup.svelte`](../src/lib/components/GuidedSetup.svelte) | From `sm`: top bar and centred card (`max-w-[680px]`, `lg:max-w-[760px]`), progress labels numbered, footer at the card's foot; phones unchanged |
| [`setup/SetupAmmoStep.svelte`](../src/lib/components/setup/SetupAmmoStep.svelte) | Two columns on the desktop card |

The stores, the stored values and their readers are unchanged, so [Data and privacy](data-and-privacy.md) needs no change.

### Messages

13 keys added: `scope_view_intro` and 12 step labels `scope_view_step_{speed,angle,altitude,pressure,humidity,cant}_{down,up}` with a `{step}` placeholder. Temperature and direction reuse their existing button labels. Now **897 keys** per language. The translator reworded the French and German intro line. Three older German strings now use "Sie" instead of "du": `scope_view_no_profile`, `scope_view_distance_type_current`, `scope_view_atmo_isa_note`. No native speaker review.

### Guides updated

[`architecture.md`](architecture.md) (Scope View components and layout, guided setup layout), [`testing.md`](testing.md) (totals, `fieldStep.test.js`), [`translations.md`](translations.md) (897 keys).

## Tests

| File | Tests | What |
|------|-------|------|
| [`fieldStep.test.js`](../src/test/fieldStep.test.js) (new) | 22 | `decimalsOf`; `stepValue`: no float noise, the value's decimals kept, comma and trailing text read as the calculators read them, start value for empty, text or infinite boxes, clamping and bringing back, open ends one decimal inside, no rounding past an end, wrap, `-0` written as 0; `fieldStepSpec` for each field and unit, including that a wind step never gives a speed `shotWinds` rejects, a step keeps a usable atmosphere usable, and the cant stays a number `storedRotation` keeps |

`npm run test:run` on 2026-11-17: **4798 passed, 1 todo**, in 58 files (was 4776 in 57). `npm run build` passes. No recorded result changed. The new components have no component tests.

## What the owner should test

Nothing was checked in a browser. Please check at 375, 768, 900, 1024 and 1280 px, light and dark, in English, French and German:

1. `/scope-view` order and layout: phone one column (profile chip, distance, answer, wind, angle, atmosphere); tablet two equal columns with dial tiles and hold reticle together and no switch; desktop title and intro, answer on the right, sticky, with the switch.
2. Each stepper: wind speed in m/s and mph; direction 355 + 5 → 0; angle in deg stops at 89 and −89; in cos, − from an empty box gives 0.99, + stops at 1; altitude, pressure (hPa and inHg, QNH and Station), temperature in °C and °F, humidity stops at 0 and 100; cant beside the slider.
3. The Accurate grid: two columns on a phone, three on a wide card, chips in the label row, nothing cut.
4. The profile chip: Change opens the picker on the page.
5. `/calculators/ballistic`: the same buttons in the wind and atmosphere cards.
6. `/setup` from 640 px: top bar and centred card; the ammunition step in two columns from 1024 px. Phones unchanged.

## Deployment notes

Nothing to do on the server. The release notes above must go out with the release.

## Security review

**PASS.** The reviewer fuzzed about 833,000 inputs through `stepValue` and `fieldStepSpec`: every result was finite, within its limits, and passed `shotWinds` and `isUsableScopeAngle`; a cosine of `1e-10` returns in 3 ms.

- **Low, fixed:** an out-of-range value with many decimals could come back in exponent form (`1e-10`). Clamped values now keep at most one decimal more than the step, and the output is never in exponent form.
- **Info:** the steppers now repair bad text (a direction of `Infinity` restarts at 0; a temperature beyond its limits is clamped). Accepted, as intended.
- **Info, pre-existing:** `setRotation` stores the raw value; the `rotation` getter (`storedRotation`) guards what is used. Not changed.

## All acceptance criteria of #166

| Criterion | Round | Status |
|-----------|-------|--------|
| Every route matches its canvas board on phone, tablet and desktop, in light and dark | 1 Profiles, 2 Settings, 3 Calculators, 4 Scope View and setup | Built; **owner's visual check**. Tablet Scope View numbered headings and "Optional" tags not built |
| Ballistic and Scope View render the same Wind and Atmosphere components | Shared since #151; round 4 steppers | Met |
| Every numeric Scope View field (and the shared cards on Ballistic) has − and + buttons with labelled steps | 4 | Met in code and tests; **owner's visual check** |
| Profile selection uses the picker pattern on Profiles, in calculators and in Compare "Add profile" | 1, 3; Scope View in 4 | Met, except the precision dope card, which keeps its own select |
| Export all, Export this profile and Import (one or several files, both formats) work; new ids; never replace; unreadable files reported | 1 | Met (tested); **owner's visual check** of the screens |
| Deleting the profile in use activates another; the last profile cannot be deleted | 1 | Met (tested) |
| MPBR shows and saves the near zero and advises confirming at the far zero | 3 | Met |
| About shows "Provided by Chocolate Warfare" with the link and "created and maintained by Quentin Mathey" | 2 | Met |
| Clear all data asks for confirmation and empties local storage | 1 logic, 2 screen | Met (tested) |
| New strings in EN, FR and DE | 1 to 4 | Met: 897 keys per language, same keys; no native speaker review |
| Specs for import/export and for the delete-in-use rule | 1 | Met |
| `npm run test:run` and `npm run build` pass | 4 (final) | Met: 4798 passed, 1 todo; build passes |

## Known limitations / follow-ups

- Not checked in a browser, at any width or theme.
- Tablet Scope View numbered section headings and "Optional" tags not built.
- The buttons do not repeat when held.
- The precision dope card keeps its own profile select.
- The choices above, and those of the earlier rounds, wait for the owner. No native speaker review of the messages.

## Changelog

- 2026-11-17: initial delivery (round 4 of #166, the last)
