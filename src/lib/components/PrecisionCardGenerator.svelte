<script>
	/**
	 * Precision dope card generator (#157): the second card of the Dope Cards page.
	 *
	 * The user picks a saved profile (the active one by default), sees whether it can make the card
	 * (precisionCardRequirements), sets the last distance and the units, and downloads an A6 PDF.
	 * The units of wind, pressure and temperature are chosen apart (#160), with a Metric and an
	 * Imperial preset that set all three; a mixed choice selects neither preset.
	 * A profile that cannot make the card dims the form and disables the download; the warning says
	 * why and links to the profile.
	 *
	 * @prop {(pdfDoc: object, filename: string) => Promise<void>} save - The page's savePDF.
	 */
	import { m } from '#lib/paraglide/messages.js';
	import { getLocale, localizeHref } from '#lib/paraglide/runtime.js';
	import { activeProfile } from '#lib/stores/activeProfile.svelte.js';
	import { parseDecimal, readDecimal } from '#lib/utils/decimal.js';
	import { formatLimit } from '#lib/utils/format.js';
	import { downloadDopeCard } from '#lib/utils/dopeCardDownload.js';
	import {
		PRECISION_MIN_DISTANCE,
		PRECISION_MAX_DISTANCE,
		isUsableMaxDistance,
		precisionPageDistances,
		precisionCardRequirements
	} from '#lib/utils/precisionCard.js';
	import { PRECISION_UNIT_PRESETS, precisionUnitPreset } from '#lib/utils/precisionCardFormat.js';
	import ChipGroup from '#lib/components/ChipGroup.svelte';
	import UnitField from '#lib/components/UnitField.svelte';
	import {
		BookOpen,
		Check,
		ChevronDown,
		ChevronRight,
		Download,
		Loader,
		Minus,
		TriangleAlert,
		X
	} from '@lucide/svelte';

	let { save } = $props();

	const uid = $props.id();
	const focusRing = 'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary-500';

	let expanded = $state(true);

	// ── Profile ───────────────────────────────────────────────────────
	// The profile in use (#170): the page's one profile selector changes it for both cards.
	let profile = $derived(activeProfile.profile);
	let profileId = $derived(profile ? String(profile.id) : '');

	// ── Requirements ──────────────────────────────────────────────────
	let req = $derived(profile ? precisionCardRequirements(profile) : null);
	let usable = $derived(Boolean(req?.usable));

	/** 'm' or 'yd': the card's distances follow the zero. A zero in neither unit counts as m. */
	let distUnit = $derived(req?.zero?.unit === 'yd' ? 'yd' : 'm');
	let distUnitLabel = $derived(distUnit === 'yd' ? m.unit_yd() : m.unit_m());

	/** A number from the requirements (number or stored text) as the page shows it. */
	function shownNumber(value) {
		const n = readDecimal(value);
		return Number.isFinite(n) ? formatLimit(n) : String(value ?? '');
	}

	const RETICLE_LABELS = {
		'red-dot': () => m.scope_view_reticle_red_dot(),
		moa: () => m.scope_view_reticle_moa(),
		mrad: () => m.scope_view_reticle_mrad(),
		'mil-dot': () => m.scope_view_reticle_mil_dot()
	};

	/** The checklist rows: { key, state: 'ok'|'fail'|'info', title, detail }. */
	let checks = $derived.by(() => {
		if (!req) return [];
		const rows = [];

		const zero = req.zero;
		const zeroUnitLabel = zero.unit === 'yd' ? m.unit_yd() : m.unit_m();
		rows.push({
			key: 'zero',
			state: zero.ok ? 'ok' : 'fail',
			title:
				zero.value != null && zero.unit
					? m.dope_precision_req_zero({ distance: shownNumber(zero.value), unit: zeroUnitLabel })
					: m.dope_precision_req_zero_none(),
			detail: zero.ok
				? m.dope_precision_req_zero_ok({ unit: zeroUnitLabel })
				: m.dope_precision_req_zero_fail()
		});

		const reticle = req.reticle;
		rows.push({
			key: 'reticle',
			state: reticle.ok ? 'ok' : 'fail',
			title: reticle.ok
				? m.dope_precision_req_reticle({ unit: reticle.unit })
				: m.dope_precision_req_reticle({ unit: RETICLE_LABELS[reticle.type]?.() ?? reticle.type ?? '' }),
			detail: reticle.ok
				? m.dope_precision_req_reticle_ok({ unit: reticle.unit })
				: m.dope_precision_req_reticle_fail()
		});

		const clicks = req.clicks;
		rows.push({
			key: 'clicks',
			state: clicks.ok ? 'ok' : 'fail',
			title: m.dope_precision_req_clicks(),
			detail: clicks.ok
				? m.dope_precision_req_clicks_ok({
						elevation: `${shownNumber(clicks.elevation?.value)} ${clicks.elevation?.unit ?? ''}`.trim(),
						windage: `${shownNumber(clicks.windage?.value)} ${clicks.windage?.unit ?? ''}`.trim()
					})
				: m.dope_precision_req_clicks_fail()
		});

		rows.push({
			key: 'spin',
			state: req.spinDrift?.ok ? 'ok' : 'info',
			title: m.dope_precision_req_spin(),
			detail: req.spinDrift?.ok ? m.dope_precision_req_spin_ok() : m.dope_precision_req_spin_missing()
		});

		return rows;
	});

	/** One sentence per blocking requirement that fails, for the warning. */
	let failures = $derived.by(() => {
		if (!req || req.usable) return [];
		const list = [];
		if (!req.zero.ok) list.push(m.dope_precision_block_zero());
		if (!req.reticle.ok) list.push(m.dope_precision_block_reticle());
		if (!req.clicks.ok) list.push(m.dope_precision_block_clicks());
		return list;
	});

	// ── Form ──────────────────────────────────────────────────────────
	let maxText = $state('800');
	let maxDistance = $derived(parseDecimal(maxText));
	let maxValid = $derived(isUsableMaxDistance(maxDistance));
	let maxError = $derived(
		maxValid
			? ''
			: m.dope_precision_max_invalid({
					min: formatLimit(PRECISION_MIN_DISTANCE),
					max: formatLimit(PRECISION_MAX_DISTANCE),
					unit: distUnitLabel
				})
	);

	/** @type {'clicks'|'angle'} */
	let correction = $state('clicks');
	let angleLabel = $derived(req?.reticle?.unit ?? 'MRAD');

	/**
	 * The units of wind, pressure and temperature (#160) the user picked, a plain frozen object (raw
	 * state, so that the PDF code gets no proxy), kept with the profile they were picked for: when
	 * another profile is in use (#170) the units follow its zero again, the metric preset for m,
	 * imperial for yd.
	 * @type {{ id: string, units: Readonly<import('#lib/utils/precisionCardFormat.js').PrecisionUnits> }|null}
	 */
	let unitsPick = $state.raw(null);
	let unitsChoice = $derived(unitsPick?.id === profileId ? unitsPick.units : null);
	let units = $derived(unitsChoice ?? PRECISION_UNIT_PRESETS[distUnit === 'yd' ? 'imperial' : 'metric']);
	/** The preset the units match, or null for a mixed choice (neither preset pressed). */
	let unitPreset = $derived(precisionUnitPreset(units));

	/** The unit toggles, one per quantity. */
	const UNIT_ROWS = [
		{
			key: 'wind',
			label: () => m.dope_precision_units_wind(),
			options: () => [
				{ value: 'mps', label: m.unit_mps() },
				{ value: 'mph', label: m.unit_mph() }
			]
		},
		{
			key: 'pressure',
			label: () => m.dope_precision_units_pressure(),
			options: () => [
				{ value: 'hpa', label: m.unit_hpa() },
				{ value: 'inhg', label: m.unit_inhg() }
			]
		},
		{
			key: 'temperature',
			label: () => m.dope_precision_units_temperature(),
			options: () => [
				{ value: 'c', label: m.unit_c() },
				{ value: 'f', label: m.unit_f() }
			]
		}
	];

	function pickPreset(name) {
		if (Object.hasOwn(PRECISION_UNIT_PRESETS, name)) unitsPick = { id: profileId, units: PRECISION_UNIT_PRESETS[name] };
	}

	function pickUnit(key, value) {
		unitsPick = { id: profileId, units: Object.freeze({ ...units, [key]: value }) };
	}

	let distances = $derived(maxValid ? precisionPageDistances(maxDistance) : []);

	let canDownload = $derived(usable && maxValid && distances.length > 0);

	// ── Download ──────────────────────────────────────────────────────
	let loading = $state(false);
	/**
	 * The last download's outcome with its profile: the message goes when another profile is in use.
	 * @type {{ id: string, value: import('#lib/utils/dopeCardDownload.js').DopeCardOutcome }|null}
	 */
	let outcomePick = $state(null);
	let outcome = $derived(outcomePick?.id === profileId ? outcomePick.value : null);

	async function download() {
		const p = profile;
		if (!p || loading || !canDownload) return;
		loading = true;
		outcomePick = null;
		const options = { maxDistance, correction, units };
		const locale = getLocale();
		try {
			// Loaded on demand, inside downloadDopeCard so that a failed load counts as a failure.
			const generate = async (pr) =>
				(await import('#lib/utils/precisionCardPdf.js')).generatePrecisionDopeCard(pr, options, locale);
			const value = await downloadDopeCard(generate, p, (pdfDoc) => save(pdfDoc, 'precision-dope-card.pdf'));
			outcomePick = { id: String(p.id), value };
		} finally {
			loading = false;
		}
	}
</script>

<div class="card preset-filled-surface-100-900 border border-surface-200-800">
	<button
		type="button"
		class="flex items-center gap-3 w-full p-4 text-left rounded-container {focusRing}"
		aria-expanded={expanded}
		aria-controls="{uid}-body"
		onclick={() => (expanded = !expanded)}
	>
		{#if expanded}
			<ChevronDown class="size-4 text-surface-600-400 shrink-0" aria-hidden="true" />
		{:else}
			<ChevronRight class="size-4 text-surface-600-400 shrink-0" aria-hidden="true" />
		{/if}
		<span class="font-medium">{m.dope_precision_title()}</span>
		<span class="ml-auto shrink-0 px-2 py-0.5 rounded-full preset-tonal-primary text-[10px] font-bold tracking-wide">
			{m.dope_precision_badge()}
		</span>
	</button>

	{#if expanded}
		<div id="{uid}-body" class="border-t border-surface-200-800 px-4 py-4 space-y-4">
			<p class="text-sm text-surface-600-400">{m.dope_precision_desc()}</p>

			<a
				href={localizeHref('/calculators/dope-cards/precision-guide')}
				class="inline-flex items-center gap-2 min-h-11 -my-2 text-sm font-semibold text-primary-700-300 hover:underline underline-offset-2 rounded-sm {focusRing}"
			>
				<BookOpen class="size-[18px] shrink-0" aria-hidden="true" />
				{m.dope_precision_guide_link()}
			</a>

			<!-- Requirements -->
			<ul
				aria-label={m.dope_precision_requirements()}
				class="space-y-1.5 px-3 py-2.5 rounded-base bg-surface-50-950"
			>
				{#each checks as c (c.key)}
					<li class="flex items-start gap-2 text-[13px] leading-snug">
						{#if c.state === 'ok'}
							<Check class="size-4 mt-px shrink-0 text-primary-700-300" strokeWidth={2.5} aria-hidden="true" />
							<span class="sr-only">{m.dope_precision_req_met()}</span>
						{:else if c.state === 'fail'}
							<X class="size-4 mt-px shrink-0 text-warning-700-300" strokeWidth={2.5} aria-hidden="true" />
							<span class="sr-only">{m.dope_precision_req_not_met()}</span>
						{:else}
							<Minus class="size-4 mt-px shrink-0 text-surface-600-400" strokeWidth={2.5} aria-hidden="true" />
							<span class="sr-only">{m.dope_precision_req_optional()}</span>
						{/if}
						<span>
							<span class="font-semibold">{c.title}</span>
							<span class="text-surface-600-400">— {c.detail}</span>
						</span>
					</li>
				{/each}
			</ul>

			{#if !usable && profile}
				<div
					role="alert"
					class="flex gap-2.5 px-3 py-2.5 rounded-base border border-warning-500 bg-warning-50-950 text-warning-900-100 text-[13px] leading-snug"
				>
					<TriangleAlert class="size-4 mt-px shrink-0" aria-hidden="true" />
					<div class="space-y-1">
						{#each failures as text (text)}
							<p>{text}</p>
						{/each}
						<p>
							{m.dope_precision_block_fix()}
							<a
								href={localizeHref(`/profiles/${profileId}`)}
								class="font-semibold underline underline-offset-2 hover:no-underline rounded-sm {focusRing}"
							>
								{m.dope_precision_edit_profile()}
							</a>
						</p>
					</div>
				</div>
			{/if}

			<!-- Options: disabled together while the profile cannot make the card -->
			<fieldset disabled={!usable} class="space-y-4 min-w-0 {usable ? '' : 'opacity-45'}">
				<legend class="sr-only">{m.dope_precision_options()}</legend>

				<UnitField
					id="{uid}-max"
					label={m.dope_precision_max()}
					bind:value={maxText}
					suffix={distUnitLabel}
					inputmode="decimal"
					hint={m.dope_precision_max_hint({
						min: formatLimit(PRECISION_MIN_DISTANCE),
						max: formatLimit(PRECISION_MAX_DISTANCE),
						unit: distUnitLabel
					})}
					invalid={usable ? maxError : ''}
				/>

				<!-- Toggles (#161): the app's small unit chips, one labelled row each, as in the profile form -->
				<div class="flex flex-wrap items-center justify-between gap-x-3 gap-y-1.5">
					<span class="text-sm font-medium" aria-hidden="true">{m.dope_precision_correction()}</span>
					<ChipGroup
						label={m.dope_precision_correction()}
						value={correction}
						onselect={(v) => (correction = /** @type {'clicks'|'angle'} */ (v))}
						options={[
							{ value: 'clicks', label: m.dope_precision_correction_clicks() },
							{ value: 'angle', label: angleLabel }
						]}
					/>
				</div>

				<!-- Units (#160): the presets beside the heading, then one row per quantity -->
				<div class="space-y-1.5">
					<div class="flex flex-wrap items-center justify-between gap-x-3 gap-y-1.5">
						<span class="text-sm font-medium" aria-hidden="true">{m.dope_precision_units()}</span>
						<ChipGroup
							label={m.dope_precision_units_presets()}
							value={unitPreset}
							onselect={pickPreset}
							options={[
								{ value: 'metric', label: m.dope_metric() },
								{ value: 'imperial', label: m.dope_imperial() }
							]}
						/>
					</div>
					{#each UNIT_ROWS as row (row.key)}
						<div class="flex flex-wrap items-center justify-between gap-x-3 gap-y-1.5">
							<!-- The group's aria-label names it; the visible label is for sight only. -->
							<span class="text-sm text-surface-600-400" aria-hidden="true">{row.label()}</span>
							<ChipGroup
								label={row.label()}
								value={units[row.key]}
								onselect={(v) => pickUnit(row.key, v)}
								options={row.options()}
							/>
						</div>
					{/each}
				</div>
			</fieldset>

			<p class="text-xs text-surface-600-400" aria-live="polite">
				{#if !usable}
					{m.dope_precision_summary_blocked()}
				{:else if canDownload}
					{m.dope_precision_summary({
						pages: formatLimit(distances.length + 2),
						first: `${formatLimit(distances[0])} ${distUnitLabel}`,
						last: `${formatLimit(distances[distances.length - 1])} ${distUnitLabel}`
					})}
				{/if}
			</p>

			<button
				type="button"
				class="btn preset-filled-primary-500"
				onclick={download}
				disabled={!canDownload || loading}
			>
				{#if loading}
					<Loader class="size-4 animate-spin" aria-hidden="true" />
				{:else}
					<Download class="size-4" aria-hidden="true" />
				{/if}
				{m.dope_precision_download()}
			</button>

			{#if outcome === 'no-data'}
				<p class="text-sm text-warning-800-200" role="alert">{m.dope_no_result()}</p>
			{:else if outcome === 'failed'}
				<p class="text-sm text-error-500" role="alert">{m.dope_save_failed()}</p>
			{/if}
		</div>
	{/if}
</div>
