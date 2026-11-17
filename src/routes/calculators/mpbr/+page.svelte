<script>
	import { onMount } from 'svelte';
	import { m } from '#lib/paraglide/messages.js';
	import { localizeHref } from '#lib/paraglide/runtime.js';
	import { activeProfile } from '#lib/stores/activeProfile.svelte.js';
	import { mpbr } from '#lib/stores/mpbr.svelte.js';
	import { settings } from '#lib/stores/settings.svelte.js';
	import { profiles } from '#lib/stores/profiles.svelte.js';
	import { calculateMPBR } from '#lib/utils/ballisticCalculator.js';
	import { MAX_ZERO_DISTANCE } from '#lib/utils/zeroDistance.js';
	import { formatLimit, formatNumber, formatFixed } from '#lib/utils/format.js';
	import { readDecimal } from '#lib/utils/decimal.js';
	import { chartLabelAnchor, mpbrChartMarkers, mpbrZeroChange } from '#lib/utils/mpbrView.js';
	import { profileName } from '#lib/components/profile/profileLabels.js';
	import ChipGroup from '#lib/components/ChipGroup.svelte';
	import ProfileInUseChip from '#lib/components/ProfileInUseChip.svelte';
	import ApplyChangeCard from '#lib/components/calc/ApplyChangeCard.svelte';
	import { Calculator, MapPin, Info, ChevronDown } from '@lucide/svelte';
	import { Unit } from 'js-ballistics';

	// ── ApexCharts (lazy-loaded, browser-only) ────────────────────────
	let ApexCharts = $state(null);
	let chartEl = $state(null);

	onMount(async () => {
		const mod = await import('apexcharts');
		ApexCharts = mod.default;
	});

	const uid = $props.id();
	const focusRing = 'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary-500';

	// ── Info panel ────────────────────────────────────────────────────
	let showInfo = $state(false);

	// ── Calculation state ─────────────────────────────────────────────
	let mpbrResult = $state(null);
	/** The target size the shown result was calculated for, as a number. */
	let resultSize = $state(null);
	let calculating = $state(false);
	let hasCalculated = $state(false);
	/** The zero change saved from the shown result (#166): the page stays and says so. */
	let savedChange = $state(null);

	const distLabel = $derived(mpbr.target.unit === 'cm' ? m.unit_m() : m.unit_yd());
	const elevLabel = $derived(mpbr.target.unit === 'cm' ? m.unit_cm() : m.unit_in());

	function clearResult() {
		mpbrResult = null;
		resultSize = null;
		hasCalculated = false;
		savedChange = null;
	}

	async function calculate() {
		calculating = true;
		clearResult();
		// yield to browser so the loading state renders before the heavy work
		await new Promise((r) => setTimeout(r, 16));
		mpbrResult = calculateMPBR(activeProfile.profile, mpbr.target.size, mpbr.target.unit);
		resultSize = readDecimal(mpbr.target.size);
		hasCalculated = true;
		calculating = false;
	}

	// Invalidate result when target unit changes
	function setUnit(unit) {
		mpbr.setTarget({ unit });
		clearResult();
	}

	// A result belongs to the profile it was calculated for. Since #166 the profile can change on
	// this page (ProfileInUseChip), and saving the old result would give the new profile its zero.
	let resultProfileId = activeProfile.id;
	$effect(() => {
		const id = activeProfile.id;
		if (id !== resultProfileId) {
			resultProfileId = id;
			clearResult();
		}
	});

	// ── Display helpers (no value changes: the result's numbers, in the locale) ──
	const num = (v, digits = 1) => formatNumber(v, { maximumFractionDigits: digits });
	const signed = (v) => `${v > 0 ? '+' : ''}${formatFixed(v, 1)}`;

	let profile = $derived(activeProfile.profile);
	let change = $derived(mpbrZeroChange(profile, mpbrResult));
	let profileLabel = $derived(profile ? profileName(profile) : '');
	const unitText = (u) => (u === 'm' ? m.unit_m() : m.unit_yd());

	function saveZero() {
		if (!change || !change.usable || change.same || !profile) return;
		const snapshot = change;
		if (profiles.update(activeProfile.id, snapshot.patch)) savedChange = snapshot;
	}

	// ── Chart ─────────────────────────────────────────────────────────
	let showAnnotations = $state(true);

	function resolveCSSColor(varName, fallback) {
		const el = document.createElement('span');
		el.style.cssText = `display:none;color:var(${varName})`;
		document.body.appendChild(el);
		const color = getComputedStyle(el).color;
		document.body.removeChild(el);
		return color || fallback;
	}

	/**
	 * Room above the plot for the apex label, in px (#128). With the apex at the top of the
	 * plot (20 in or 40 cm targets on the default profile), the label reached 5 px above it.
	 */
	const MAX_ORD_LABEL_ROOM = 12;

	function buildChartOptions(result, dark, annotations) {
		const distUnitEnum = result.useMetric ? Unit.Meter : Unit.Yard;
		const elevUnitEnum = result.useMetric ? Unit.Centimeter : Unit.Inch;
		const dUnit = result.useMetric ? m.unit_m() : m.unit_yd();
		const eUnit = result.useMetric ? m.unit_cm() : m.unit_in();

		const data = result.trajectory.map((p) => ({
			x: Math.round(p.distance.In(distUnitEnum) * 10) / 10,
			y: Math.round(p.slantHeight.In(elevUnitEnum) * 10) / 10
		}));
		const maxX = data.length > 0 ? data[data.length - 1].x : 0;

		const cPrimary = resolveCSSColor('--color-primary-500', '#0a7a38');
		const cWarning = resolveCSSColor('--color-warning-500', '#a35f00');
		const cZone = resolveCSSColor('--color-tertiary-500', '#2563eb');
		const cMuted = dark ? '#a9adaa' : '#4f5350';
		const cText = dark ? '#f8faf8' : '#181b19';

		const yaxisAnnotations = [];
		const xaxisAnnotations = [];
		const pointAnnotations = [];

		const MARKER = {
			near: { color: cPrimary, text: m.mpbr_chart_near({ distance: num(result.nearZero, 0), unit: dUnit }), below: true },
			far: { color: cPrimary, text: m.mpbr_chart_far(), below: true },
			apex: {
				color: cWarning,
				text: m.mpbr_chart_apex({ value: signed(result.maxOrdinate?.elevation ?? 0), unit: eUnit }),
				below: false
			},
			end: { color: cZone, text: m.mpbr_chart_end(), below: true }
		};

		if (annotations) {
			// Target zone band (±halfTarget around the line of sight)
			yaxisAnnotations.push({
				y: -result.halfTarget,
				y2: result.halfTarget,
				fillColor: cZone,
				opacity: 0.12,
				borderColor: cZone,
				strokeDashArray: 3,
				label: {
					text: m.mpbr_target_zone(),
					borderColor: 'transparent',
					position: 'right',
					textAnchor: 'end',
					offsetY: 16,
					style: { color: cZone, background: 'transparent', fontSize: '11px' }
				}
			});

			// Point blank range band
			if (result.mpbrMax > 0) {
				xaxisAnnotations.push({
					x: result.mpbrMin,
					x2: result.mpbrMax,
					fillColor: cZone,
					opacity: 0.05,
					borderColor: cZone,
					label: {
						text: m.mpbr_chart_pbr({ from: num(result.mpbrMin), to: num(result.mpbrMax), unit: dUnit }),
						borderColor: cZone,
						style: { color: '#fff', background: cZone, fontSize: '11px', fontWeight: 600 },
						// Horizontal and anchored at the band's left edge, inside the plot. Vertical (the
						// default) is drawn to the left of the edge, over the y-axis ticks (#100).
						position: 'bottom',
						orientation: 'horizontal',
						textAnchor: 'start',
						offsetX: 6,
						offsetY: -8
					}
				});
			}

			for (const point of mpbrChartMarkers(result)) {
				const look = MARKER[point.id];
				pointAnnotations.push({
					x: point.x,
					y: point.y,
					marker: { size: 5, fillColor: look.color, strokeColor: '#fff', strokeWidth: 2, radius: 2 },
					label: {
						text: look.text,
						borderColor: look.color,
						style: { color: '#fff', background: look.color, fontSize: '11px', fontWeight: point.id === 'end' ? 700 : 500 },
						// Zeros and the end: under their marker, clear of the curve above. Apex: above it.
						offsetY: look.below ? 30 : -10,
						textAnchor: chartLabelAnchor(point.x, maxX)
					}
				});
			}
		}

		return {
			series: [{ name: m.mpbr_legend_bullet(), data }],
			chart: {
				type: 'line',
				height: 300,
				background: 'transparent',
				toolbar: { show: false },
				animations: { enabled: false },
				zoom: { enabled: false },
				parentHeightOffset: 0,
				fontFamily: 'inherit'
			},
			stroke: { width: 3, curve: 'monotoneCubic' },
			theme: { mode: dark ? 'dark' : 'light' },
			legend: { show: false },
			grid: {
				borderColor: dark ? '#272b28' : '#dfe3e0',
				strokeDashArray: 3,
				// The apex label is drawn above the highest point, often the top of the plot: room
				// above keeps it inside the chart (#128). No value changes.
				padding: { left: 10, right: 20, top: annotations && result.maxOrdinate ? MAX_ORD_LABEL_ROOM : 0, bottom: 0 }
			},
			xaxis: {
				type: 'numeric',
				min: 0,
				max: maxX || undefined,
				title: {
					text: m.calc_axis_distance({ unit: dUnit }),
					style: { fontSize: '12px', fontWeight: 600, color: cText }
				},
				labels: { formatter: (v) => `${Math.round(v)}`, style: { colors: cMuted } }
			},
			yaxis: {
				title: {
					text: m.mpbr_axis_height({ unit: eUnit }),
					style: { fontSize: '12px', fontWeight: 600, color: cText }
				},
				labels: {
					formatter: (v) => {
						const r = Math.round(v * 10) / 10;
						return r > 0 ? `+${r}` : `${r}`;
					},
					style: { colors: cMuted }
				}
			},
			colors: [cPrimary],
			annotations: {
				yaxis: [
					{
						y: 0,
						borderColor: cMuted,
						strokeDashArray: 5,
						borderWidth: 1,
						label: {
							text: m.ballistic_legend_los(),
							position: 'center',
							style: { fontSize: '10px', color: cMuted, background: 'transparent' },
							borderColor: 'transparent'
						}
					},
					...yaxisAnnotations
				],
				xaxis: xaxisAnnotations,
				points: pointAnnotations
			},
			tooltip: {
				theme: dark ? 'dark' : 'light',
				x: { formatter: (v) => `${v} ${dUnit}` },
				y: { formatter: (v) => `${v} ${eUnit}` }
			},
			markers: { size: 0 }
		};
	}

	$effect(() => {
		const ac = ApexCharts;
		const el = chartEl;
		if (!ac || !el || !mpbrResult) return;
		const opts = buildChartOptions(mpbrResult, settings.darkMode, showAnnotations);
		const chart = new ac(el, opts);
		chart.render();
		return () => chart.destroy();
	});

	let chartAria = $derived.by(() => {
		const r = mpbrResult;
		if (!r) return '';
		const parts = [m.mpbr_chart(), m.mpbr_chart_pbr({ from: num(r.mpbrMin), to: num(r.mpbrMax), unit: distLabel })];
		if (r.nearZero !== null) parts.push(m.mpbr_chart_near({ distance: num(r.nearZero, 0), unit: distLabel }));
		if (r.farZero !== null) parts.push(`${m.mpbr_far_zero()} ${num(r.farZero, 0)} ${distLabel}`);
		if (r.maxOrdinate) parts.push(m.mpbr_chart_apex({ value: signed(r.maxOrdinate.elevation), unit: elevLabel }));
		return parts.join('. ');
	});
</script>

<svelte:head>
	<title>{m.calc_mpbr()} — {m.app_name()}</title>
</svelte:head>

<!-- ═══ Cards (placed by the layout below) ═════════════════════════════ -->

{#snippet inputCard()}
	<section
		class="card preset-filled-surface-100-900 border border-surface-200-800 p-4 flex flex-col gap-3"
		aria-labelledby="{uid}-target-title"
	>
		<div class="flex items-center justify-between gap-2">
			<h2 id="{uid}-target-title" class="text-[15px] font-semibold">{m.mpbr_target_size()}</h2>
			<ChipGroup
				label={m.mpbr_target_size()}
				options={[
					{ value: 'in', label: m.unit_in() },
					{ value: 'cm', label: m.unit_cm() }
				]}
				value={mpbr.target.unit}
				onselect={setUnit}
			/>
		</div>
		<div class="space-y-1">
			<label for="{uid}-size" class="text-xs text-surface-600-400">{m.mpbr_target_size_label()}</label>
			<div class="input !flex !items-center gap-2 h-12">
				<input
					id="{uid}-size"
					class="flex-1 w-10 min-w-0 bg-transparent border-none outline-none shadow-none p-0 text-[22px] font-bold"
					type="text"
					inputmode="decimal"
					placeholder="8"
					aria-describedby="{uid}-size-hint"
					value={mpbr.target.size}
					oninput={(e) => {
						mpbr.setTarget({ size: e.target.value });
						clearResult();
					}}
				/>
				<span class="text-sm text-surface-600-400 shrink-0">{elevLabel}</span>
			</div>
		</div>
		<p id="{uid}-size-hint" class="text-xs leading-snug text-surface-600-400">{m.mpbr_target_size_hint()}</p>
		<button
			type="button"
			class="btn preset-filled-primary-500 w-full h-12 gap-2 text-[15px] font-semibold {focusRing}"
			onclick={calculate}
			disabled={calculating || !mpbr.target.size}
		>
			{#if calculating}
				<span class="inline-block size-4 border-2 border-current border-t-transparent rounded-full animate-spin" aria-hidden="true"></span>
				{m.mpbr_calculating()}
			{:else}
				<Calculator class="size-[18px]" aria-hidden="true" />
				{m.mpbr_calculate()}
			{/if}
		</button>
	</section>
{/snippet}

{#snippet answerCard()}
	{#if mpbrResult}
		{@const r = mpbrResult}
		<section
			class="card bg-primary-600 dark:bg-primary-800 text-primary-50 rounded-container p-4 flex flex-col gap-3"
			aria-label={m.calc_mpbr()}
			aria-live="polite"
		>
			<span class="text-[13px] font-medium">
				{m.mpbr_answer_lead({ size: num(resultSize, 2), unit: elevLabel })}
			</span>
			<p class="text-[34px] font-extrabold leading-none tabular-nums tracking-tight">
				{num(r.mpbrMin)} – {num(r.mpbrMax)} <span class="text-lg font-semibold">{distLabel}</span>
			</p>
			<p class="text-[13px] leading-snug">{m.mpbr_answer_note()}</p>
			<div class="grid grid-cols-2 gap-2.5">
				<div class="rounded-base bg-primary-50/12 px-3 py-2.5">
					<p class="text-[11px] font-bold uppercase tracking-wider">{m.mpbr_zero_at()}</p>
					<p class="text-2xl font-bold tabular-nums leading-tight">
						{num(r.optimalZero, 0)} <span class="text-sm font-semibold">{distLabel}</span>
					</p>
					<p class="mt-0.5 text-[11px] leading-snug opacity-90">{m.mpbr_zero_at_note()}</p>
				</div>
				<div class="rounded-base bg-primary-50/12 px-3 py-2.5">
					<p class="text-[11px] font-bold uppercase tracking-wider">{m.mpbr_highest()}</p>
					{#if r.maxOrdinate}
						<p class="text-2xl font-bold tabular-nums leading-tight">
							{signed(r.maxOrdinate.elevation)} <span class="text-sm font-semibold">{elevLabel}</span>
						</p>
						<p class="mt-0.5 text-[11px] leading-snug opacity-90">
							{m.mpbr_highest_note({ distance: num(r.maxOrdinate.distance, 0), unit: distLabel })}
						</p>
					{:else}
						<p class="text-2xl font-bold leading-tight">{m.mpbr_unknown()}</p>
					{/if}
				</div>
			</div>
			{#if r.farZero !== null}
				<div class="flex items-start gap-2.5 rounded-base bg-primary-50/12 px-3 py-2.5">
					<MapPin class="size-4 shrink-0 mt-0.5" aria-hidden="true" />
					<p class="text-[13px] leading-snug">
						<strong>{m.mpbr_far_check_title({ distance: num(r.farZero, 0), unit: distLabel })}</strong>
						{m.mpbr_far_check_text({ distance: num(r.farZero, 0), unit: distLabel })}
					</p>
				</div>
			{/if}
			<p class="text-xs leading-snug opacity-90">{m.mpbr_beyond({ distance: num(r.mpbrMax), unit: distLabel })}</p>
		</section>
	{:else}
		<section class="card preset-filled-surface-100-900 border border-surface-200-800 p-4" aria-live="polite">
			{#if calculating}
				<p class="text-sm text-surface-600-400 text-center py-6">{m.mpbr_calculating()}</p>
			{:else if hasCalculated}
				<p class="text-sm text-surface-600-400 text-center py-6">{m.mpbr_no_result()}</p>
			{:else}
				<p class="text-sm text-surface-600-400 text-center py-6">{m.mpbr_hint()}</p>
			{/if}
		</section>
	{/if}
{/snippet}

{#snippet chartCard()}
	{#if mpbrResult}
		<section
			class="card preset-filled-surface-100-900 border border-surface-200-800 p-4 flex flex-col gap-2.5 min-w-0"
			aria-labelledby="{uid}-chart-title"
		>
			<div class="flex flex-wrap items-center gap-x-3 gap-y-2">
				<h2 id="{uid}-chart-title" class="flex-1 min-w-max text-[15px] font-semibold">{m.mpbr_chart()}</h2>
				<button
					type="button"
					class="touch-hit chip text-xs {showAnnotations ? 'preset-filled-primary-500' : 'preset-tonal-surface'} {focusRing}"
					aria-pressed={showAnnotations}
					onclick={() => (showAnnotations = !showAnnotations)}
				>
					<MapPin class="size-3 mr-1" aria-hidden="true" />{m.mpbr_annotations()}
				</button>
			</div>
			<div class="flex flex-wrap gap-x-4 gap-y-1 text-xs text-surface-600-400" aria-hidden="true">
				<span class="flex items-center gap-1.5"><span class="inline-block w-4 h-[3px] rounded-full bg-primary-500"></span>{m.mpbr_legend_bullet()}</span>
				<span class="flex items-center gap-1.5"><span class="inline-block w-4 border-t-2 border-dashed border-surface-500"></span>{m.ballistic_legend_los()}</span>
				<span class="flex items-center gap-1.5">
					<span class="inline-block w-3.5 h-2.5 rounded-sm bg-tertiary-500/20 border border-dashed border-tertiary-500"></span>
					{m.mpbr_legend_zone({ half: num(mpbrResult.halfTarget), unit: elevLabel })}
				</span>
			</div>
			<div role="img" aria-label={chartAria}>
				<div bind:this={chartEl}></div>
			</div>
			<p class="text-xs leading-snug text-surface-600-400">{m.mpbr_chart_note()}</p>
		</section>
	{/if}
{/snippet}

{#snippet saveCard()}
	{#if mpbrResult && change}
		{#if !change.usable}
			<!-- A zero past MAX_ZERO_DISTANCE (a huge target) gives no result anywhere else (#93). -->
			<p class="card preset-tonal-warning p-4 text-sm">{m.mpbr_zero_out_of_range({ max: formatLimit(MAX_ZERO_DISTANCE) })}</p>
		{:else}
			{@const shown = savedChange ?? change}
			{@const afterText = `${num(shown.after.value, 0)} ${unitText(shown.after.unit)}`}
			<ApplyChangeCard
				title={m.mpbr_save_title()}
				label={m.mpbr_zero_distance()}
				before={shown.before.value === null ? '—' : `${num(shown.before.value, 6)} ${unitText(shown.before.unit)}`}
				after={afterText}
				note={mpbrResult.farZero !== null
					? m.mpbr_save_note({ profile: profileLabel, zero: num(shown.after.value, 0), far: num(mpbrResult.farZero, 0), unit: unitText(shown.after.unit) })
					: m.mpbr_save_note_no_far({ profile: profileLabel, zero: num(shown.after.value, 0), unit: unitText(shown.after.unit) })}
				buttonLabel={m.mpbr_save_button({ distance: num(shown.after.value, 0), unit: unitText(shown.after.unit) })}
				doneText={savedChange ? m.mpbr_saved({ distance: num(savedChange.after.value, 0), unit: unitText(savedChange.after.unit) }) : ''}
				unchangedText={!savedChange && change.same ? m.mpbr_already_zeroed({ distance: num(change.after.value, 0), unit: unitText(change.after.unit) }) : ''}
				onapply={saveZero}
			/>
		{/if}
	{/if}
{/snippet}

{#snippet resultTile(label, value, note)}
	<div class="rounded-base bg-surface-50-950 px-3 py-2.5 min-w-0">
		<p class="text-[11px] text-surface-600-400 leading-snug">{label}</p>
		<p class="text-[15px] font-bold tabular-nums">{value}</p>
		<p class="text-[11px] leading-snug text-surface-600-400">{note}</p>
	</div>
{/snippet}

{#snippet allResultsCard()}
	{#if mpbrResult}
		{@const r = mpbrResult}
		<section
			class="card preset-filled-surface-100-900 border border-surface-200-800 p-4 flex flex-col gap-3"
			aria-label={m.mpbr_all_results()}
		>
			<h2 class="text-xs font-bold uppercase tracking-wider text-surface-600-400">{m.mpbr_all_results()}</h2>
			<div class="grid grid-cols-2 @sm:grid-cols-3 gap-2">
				{@render resultTile(m.mpbr_zero_at_near(), `${num(r.optimalZero, 0)} ${distLabel}`, m.mpbr_zero_at_near_note())}
				{@render resultTile(
					m.mpbr_far_check(),
					r.farZero !== null ? `${num(r.farZero, 0)} ${distLabel}` : m.mpbr_unknown(),
					m.mpbr_far_check_note()
				)}
				{@render resultTile(
					m.mpbr_target_size(),
					`${num(resultSize, 2)} ${elevLabel}`,
					m.mpbr_target_tile_note({ half: num(r.halfTarget), unit: elevLabel })
				)}
				{@render resultTile(
					m.mpbr_min_pbr(),
					`${num(r.mpbrMin)} ${distLabel}`,
					r.mpbrMin === 0 ? m.mpbr_min_note_muzzle() : m.mpbr_min_note()
				)}
				{@render resultTile(m.mpbr_max_pbr(), `${num(r.mpbrMax)} ${distLabel}`, m.mpbr_max_note())}
				{@render resultTile(
					m.mpbr_max_ord(),
					r.maxOrdinate ? `${signed(r.maxOrdinate.elevation)} ${elevLabel}` : m.mpbr_unknown(),
					r.maxOrdinate ? `${m.mpbr_at()} ${num(r.maxOrdinate.distance)} ${distLabel}` : ''
				)}
			</div>
		</section>
	{/if}
{/snippet}

{#snippet aboutCard()}
	<section class="card preset-filled-surface-100-900 border border-surface-200-800">
		<button
			type="button"
			class="w-full min-h-12 px-4 py-2 flex items-center gap-2.5 text-left rounded-container {focusRing}"
			aria-expanded={showInfo}
			aria-controls="{uid}-about"
			onclick={() => (showInfo = !showInfo)}
		>
			<span class="size-8 shrink-0 rounded-full flex items-center justify-center preset-tonal-surface" aria-hidden="true">
				<Info class="size-[18px]" />
			</span>
			<span class="flex-1 text-sm font-semibold">{m.mpbr_about_title()}</span>
			<ChevronDown class="size-4 transition-transform duration-200 {showInfo ? 'rotate-180' : ''}" aria-hidden="true" />
		</button>
		{#if showInfo}
			<div id="{uid}-about" class="px-4 pb-4 flex flex-col gap-2 text-[13px] leading-relaxed text-surface-600-400">
				<p>{m.mpbr_about_definition()}</p>
				<p>{m.mpbr_about_zero()}</p>
				<p>{m.mpbr_about_beyond()}</p>
				<p>{m.mpbr_about_ideal()}</p>
			</div>
		{/if}
	</section>
{/snippet}

{#if !activeProfile.profile}
	<div class="py-12 text-center space-y-3">
		<p class="text-surface-600-400">{m.mpbr_no_profile()}</p>
		<a href={localizeHref('/profiles')} class="btn preset-tonal-primary">{m.nav_profiles()}</a>
	</div>
{:else}
	<!--
		Phone: one column, in the order of the order-* classes (input, answer, chart, save, all
		results, about); the two column divs are display: contents there.
		From md (tablet): left inputs, all results, about; right answer, chart, save.
		From lg (desktop sidebar): left inputs, save, about; right answer, chart, all results.
		Save and All results are written in both columns and shown in one; the chart only once.
	-->
	<div class="max-w-[1180px] mx-auto flex flex-col gap-4 lg:gap-5">
		<header class="flex flex-wrap items-center gap-x-4 gap-y-3 px-1 sm:px-0">
			<div class="order-2 sm:order-none flex-[1_1_320px] min-w-0">
				<!-- Below lg the app header already shows the title -->
				<h1 class="sr-only lg:not-sr-only lg:text-[28px] lg:font-bold lg:tracking-tight">{m.calc_mpbr()}</h1>
				<p class="lg:mt-1 text-sm text-surface-600-400">{m.mpbr_intro()}</p>
			</div>
			<ProfileInUseChip class="order-1 sm:order-none sm:flex-[0_1_300px]" />
		</header>

		<div class="flex flex-col gap-4 md:grid md:grid-cols-2 md:items-start lg:grid-cols-[minmax(300px,1fr)_minmax(0,1.9fr)] lg:gap-5">
			<div class="contents md:flex md:flex-col md:gap-4 min-w-0">
				<div class="order-1 md:order-none">{@render inputCard()}</div>
				{#if mpbrResult}
					<div class="order-5 hidden md:block lg:hidden @container">{@render allResultsCard()}</div>
					<div class="order-4 hidden lg:block">{@render saveCard()}</div>
				{/if}
				<div class="order-6 md:order-none">{@render aboutCard()}</div>
			</div>
			<div class="contents md:flex md:flex-col md:gap-4 min-w-0">
				<div class="order-2 md:order-none">{@render answerCard()}</div>
				{#if mpbrResult}
					<div class="order-3 md:order-none min-w-0">{@render chartCard()}</div>
					<div class="order-4 md:order-none lg:hidden">{@render saveCard()}</div>
					<div class="order-5 md:order-none md:hidden lg:block @container">{@render allResultsCard()}</div>
				{/if}
			</div>
		</div>
	</div>
{/if}
