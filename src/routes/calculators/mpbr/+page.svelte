<script>
	import { onMount } from 'svelte';
	import { m } from '$lib/paraglide/messages.js';
	import { activeProfile } from '$lib/stores/activeProfile.svelte.js';
	import { mpbr } from '$lib/stores/mpbr.svelte.js';
	import { settings } from '$lib/stores/settings.svelte.js';
	import { calculateMPBR } from '$lib/utils/ballisticCalculator.js';
	import { goto } from '$app/navigation';
	import { profiles } from '$lib/stores/profiles.svelte.js';
	import { Calculator, MapPin, Crosshair, Ruler, TrendingUp, Info, ChevronDown, BookmarkPlus } from '@lucide/svelte';
	import { Unit } from 'js-ballistics';

	// ── ApexCharts (lazy-loaded, browser-only) ────────────────────────
	let ApexCharts = $state(null);
	let chartEl = $state(null);

	onMount(async () => {
		const mod = await import('apexcharts');
		ApexCharts = mod.default;
	});

	// ── Info panel ────────────────────────────────────────────────────
	let showInfo = $state(false);

	// ── Calculation state ─────────────────────────────────────────────
	let mpbrResult = $state(null);
	let calculating = $state(false);
	let hasCalculated = $state(false);

	const distLabel = $derived(mpbr.target.unit === 'cm' ? m.unit_m() : m.unit_yd());
	const elevLabel = $derived(mpbr.target.unit === 'cm' ? m.unit_cm() : m.unit_in());

	async function calculate() {
		calculating = true;
		mpbrResult = null;
		hasCalculated = false;
		// yield to browser so the loading state renders before the heavy work
		await new Promise((r) => setTimeout(r, 16));
		mpbrResult = calculateMPBR(activeProfile.profile, mpbr.target.size, mpbr.target.unit);
		hasCalculated = true;
		calculating = false;
	}

	// Invalidate result when target unit changes
	function setUnit(unit) {
		mpbr.setTarget({ unit });
		mpbrResult = null;
		hasCalculated = false;
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

	function buildChartOptions(result, dark, annotations) {
		const distUnitEnum = result.useMetric ? Unit.Meter : Unit.Yard;
		const elevUnitEnum = result.useMetric ? Unit.Centimeter : Unit.Inch;

		const data = result.trajectory.map((p) => ({
			x: Math.round(p.distance.In(distUnitEnum) * 10) / 10,
			y: Math.round(p.targetDrop.In(elevUnitEnum) * 10) / 10
		}));
		const maxX = data.length > 0 ? data[data.length - 1].x : 0;

		const cPrimary = resolveCSSColor('--color-primary-500', '#6366f1');
		const cSuccess = resolveCSSColor('--color-success-500', '#22c55e');
		const cWarning = resolveCSSColor('--color-warning-500', '#f59e0b');
		const cTertiary = resolveCSSColor('--color-tertiary-500', '#14b8a6');

		const yaxisAnnotations = [];
		const xaxisAnnotations = [];
		const pointAnnotations = [];

		if (annotations) {
			// Target zone band (±halfTarget around LoS)
			yaxisAnnotations.push({
				y: -result.halfTarget,
				y2: result.halfTarget,
				fillColor: cTertiary,
				opacity: 0.12,
				borderColor: cTertiary,
				label: {
					text: m.mpbr_target_zone(),
					borderColor: cTertiary,
					style: { color: '#fff', background: cTertiary, fontSize: '11px' }
				}
			});

			// Point blank range band
			if (result.mpbrMax > 0) {
				xaxisAnnotations.push({
					x: result.mpbrMin,
					x2: result.mpbrMax,
					fillColor: cPrimary,
					opacity: 0.08,
					borderColor: cPrimary,
					label: {
						text: m.mpbr_point_blank(),
						borderColor: cPrimary,
						style: { color: '#fff', background: cPrimary, fontSize: '11px' },
						position: 'bottom'
					}
				});
			}

			// Near zero
			if (result.nearZero !== null) {
				pointAnnotations.push({
					x: result.nearZero,
					y: 0,
					marker: { size: 5, fillColor: cSuccess, strokeColor: '#fff', radius: 2 },
					label: {
						text: m.mpbr_near_zero(),
						borderColor: cSuccess,
						style: { color: '#fff', background: cSuccess, fontSize: '11px' },
						offsetY: -10
					}
				});
			}

			// Far zero
			if (result.farZero !== null) {
				pointAnnotations.push({
					x: result.farZero,
					y: 0,
					marker: { size: 5, fillColor: cPrimary, strokeColor: '#fff', radius: 2 },
					label: {
						text: m.mpbr_far_zero(),
						borderColor: cPrimary,
						style: { color: '#fff', background: cPrimary, fontSize: '11px' },
						offsetY: -10
					}
				});
			}

			// Max ordinate
			if (result.maxOrdinate) {
				pointAnnotations.push({
					x: result.maxOrdinate.distance,
					y: result.maxOrdinate.elevation,
					marker: { size: 5, fillColor: cWarning, strokeColor: '#fff', radius: 2 },
					label: {
						text: m.mpbr_max_ord(),
						borderColor: cWarning,
						style: { color: '#fff', background: cWarning, fontSize: '11px' },
						offsetY: -10
					}
				});
			}
		}

		return {
			series: [{ name: elevLabel, data }],
			chart: {
				type: 'line',
				height: 300,
				background: 'transparent',
				toolbar: { show: false },
				animations: { enabled: false },
				zoom: { enabled: false },
				parentHeightOffset: 0
			},
			stroke: { width: 2, curve: 'monotoneCubic' },
			theme: { mode: dark ? 'dark' : 'light' },
			grid: {
				borderColor: dark ? '#374151' : '#e5e7eb',
				strokeDashArray: 3,
				padding: { left: 10, right: 20, top: 0, bottom: 0 }
			},
			xaxis: {
				type: 'numeric',
				min: 0,
				max: maxX || undefined,
				title: {
					text: result.useMetric ? m.unit_meters() : m.unit_yards(),
					style: { fontSize: '12px' }
				},
				labels: { formatter: (v) => `${Math.round(v)}` }
			},
			yaxis: {
				title: { text: elevLabel, style: { fontSize: '12px' } },
				labels: { formatter: (v) => `${v}` }
			},
			colors: [cPrimary],
			annotations: {
				yaxis: [
					{
						y: 0,
						borderColor: dark ? '#9ca3af' : '#6b7280',
						strokeDashArray: 4,
						borderWidth: 1,
						label: {
							text: m.ballistic_legend_los(),
							position: 'center',
							style: {
								fontSize: '10px',
								color: dark ? '#9ca3af' : '#6b7280',
								background: 'transparent',
								border: 'none'
							}
						}
					},
					...yaxisAnnotations
				],
				xaxis: xaxisAnnotations,
				points: pointAnnotations
			},
			tooltip: {
				theme: dark ? 'dark' : 'light',
				x: { formatter: (v) => `${v} ${distLabel}` },
				y: { formatter: (v) => `${v} ${elevLabel}` }
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
</script>

<svelte:head>
	<title>{m.calc_mpbr()} — {m.app_name()}</title>
</svelte:head>

{#if !activeProfile.profile}
	<div class="py-12 text-center space-y-3">
		<p class="text-surface-500-400">{m.mpbr_no_profile()}</p>
		<a href="/profiles" class="btn preset-tonal-primary">{m.nav_profiles()}</a>
	</div>
{:else}
	<div class="space-y-6">

		<!-- ═══ Two-column on sm+: input card + about MPBR ═══════════════ -->
		<div class="grid gap-6 sm:grid-cols-2">

		<!-- ═══ Input card ════════════════════════════════════════════════ -->
		<div class="card preset-filled-surface-100-900 p-4 space-y-4">
			<!-- Target size -->
			<div class="space-y-1.5">
				<div class="flex items-center justify-between">
					<span class="text-sm font-medium">{m.mpbr_target_size()}</span>
					<div class="flex gap-1">
						{#each [{ value: 'in', label: m.unit_in() }, { value: 'cm', label: m.unit_cm() }] as opt}
							<button
								type="button"
								class="chip text-xs {mpbr.target.unit === opt.value
									? 'preset-filled-primary-500'
									: 'preset-tonal-surface'}"
								onclick={() => setUnit(opt.value)}
							>{opt.label}</button>
						{/each}
					</div>
				</div>
				<div class="input !flex !items-center gap-2">
					<input
						class="flex-1 min-w-0 bg-transparent border-none outline-none shadow-none p-0"
						type="text"
						inputmode="decimal"
						placeholder="8"
						value={mpbr.target.size}
						oninput={(e) => {
							mpbr.setTarget({ size: e.target.value });
							mpbrResult = null;
							hasCalculated = false;
						}}
					/>
					<span class="text-sm text-surface-500-400 shrink-0">{elevLabel}</span>
				</div>
				<p class="text-xs text-surface-500-400">{m.mpbr_target_size_hint()}</p>
			</div>

			<!-- Calculate button -->
			<button
				type="button"
				class="btn preset-filled-primary-500 w-full gap-2"
				onclick={calculate}
				disabled={calculating || !mpbr.target.size}
				title={m.mpbr_calculate()}
			>
				{#if calculating}
					<span class="inline-block size-4 border-2 border-current border-t-transparent rounded-full animate-spin"></span>
					{m.mpbr_calculating()}
				{:else}
					<Calculator class="size-5" />
					{m.mpbr_calculate()}
				{/if}
			</button>
		</div>

		<!-- ═══ About MPBR ════════════════════════════════════════════════ -->
		<div>
			<button
				type="button"
				class="flex items-center gap-2 w-full text-sm text-surface-500-400 hover:text-surface-700-300"
				onclick={() => (showInfo = !showInfo)}
			>
				<Info class="size-4 shrink-0" />
				<span>{m.mpbr_about_title()}</span>
				<ChevronDown class="size-3.5 ml-auto transition-transform duration-200 {showInfo ? 'rotate-180' : ''}" />
			</button>
			{#if showInfo}
				<div class="mt-2 p-3 rounded-lg bg-surface-50-950 space-y-2 text-sm text-surface-600-300">
					<p>{m.mpbr_about_definition()}</p>
					<p>{m.mpbr_about_zero()}</p>
					<p>{m.mpbr_about_beyond()}</p>
					<p class="text-xs text-surface-500-400">{m.mpbr_about_ideal()}</p>
				</div>
			{/if}
		</div>

		</div><!-- end two-column grid -->

		<!-- ═══ Results ═══════════════════════════════════════════════════ -->
		{#if mpbrResult}
			<!-- Summary stats -->
			<div class="grid grid-cols-2 sm:grid-cols-3 gap-2">

				<!-- Optimal Zero -->
				<div class="flex items-center gap-2 px-3 py-2 rounded-lg bg-surface-50-950">
					<div class="size-7 rounded-full preset-tonal-primary flex items-center justify-center shrink-0">
						<Crosshair class="size-3.5" />
					</div>
					<div class="min-w-0">
						<p class="text-xs text-surface-500-400 uppercase tracking-wide leading-none mb-0.5">{m.mpbr_optimal_zero()}</p>
						<p class="text-sm font-semibold tabular-nums leading-none">
							{mpbrResult.optimalZero} <span class="text-xs font-normal text-surface-500-400">{distLabel}</span>
						</p>
					</div>
				</div>

				<!-- Near Zero -->
				<div class="flex items-center gap-2 px-3 py-2 rounded-lg bg-surface-50-950">
					<div class="size-7 rounded-full preset-tonal-success flex items-center justify-center shrink-0">
						<MapPin class="size-3.5" />
					</div>
					<div class="min-w-0">
						<p class="text-xs text-surface-500-400 uppercase tracking-wide leading-none mb-0.5">{m.mpbr_near_zero()}</p>
						{#if mpbrResult.nearZero !== null}
							<p class="text-sm font-semibold tabular-nums leading-none">
								{mpbrResult.nearZero} <span class="text-xs font-normal text-surface-500-400">{distLabel}</span>
							</p>
						{:else}
							<p class="text-xs text-surface-500-400">{m.mpbr_unknown()}</p>
						{/if}
					</div>
				</div>

				<!-- Far Zero -->
				<div class="flex items-center gap-2 px-3 py-2 rounded-lg bg-surface-50-950">
					<div class="size-7 rounded-full preset-tonal-secondary flex items-center justify-center shrink-0">
						<MapPin class="size-3.5" />
					</div>
					<div class="min-w-0">
						<p class="text-xs text-surface-500-400 uppercase tracking-wide leading-none mb-0.5">{m.mpbr_far_zero()}</p>
						{#if mpbrResult.farZero !== null}
							<p class="text-sm font-semibold tabular-nums leading-none">
								{mpbrResult.farZero} <span class="text-xs font-normal text-surface-500-400">{distLabel}</span>
							</p>
						{:else}
							<p class="text-xs text-surface-500-400">{m.mpbr_unknown()}</p>
						{/if}
					</div>
				</div>

				<!-- Min PBR -->
				<div class="flex items-center gap-2 px-3 py-2 rounded-lg bg-surface-50-950">
					<div class="size-7 rounded-full preset-tonal-surface flex items-center justify-center shrink-0">
						<Ruler class="size-3.5" />
					</div>
					<div class="min-w-0">
						<p class="text-xs text-surface-500-400 uppercase tracking-wide leading-none mb-0.5">{m.mpbr_min_pbr()}</p>
						<p class="text-sm font-semibold tabular-nums leading-none">
							{mpbrResult.mpbrMin} <span class="text-xs font-normal text-surface-500-400">{distLabel}</span>
						</p>
					</div>
				</div>

				<!-- Max PBR -->
				<div class="flex items-center gap-2 px-3 py-2 rounded-lg bg-surface-50-950">
					<div class="size-7 rounded-full preset-tonal-primary flex items-center justify-center shrink-0">
						<Ruler class="size-3.5" />
					</div>
					<div class="min-w-0">
						<p class="text-xs text-surface-500-400 uppercase tracking-wide leading-none mb-0.5">{m.mpbr_max_pbr()}</p>
						<p class="text-sm font-semibold tabular-nums leading-none">
							{mpbrResult.mpbrMax} <span class="text-xs font-normal text-surface-500-400">{distLabel}</span>
						</p>
					</div>
				</div>

				<!-- Max Ordinate -->
				<div class="flex items-center gap-2 px-3 py-2 rounded-lg bg-surface-50-950">
					<div class="size-7 rounded-full preset-tonal-warning flex items-center justify-center shrink-0">
						<TrendingUp class="size-3.5" />
					</div>
					<div class="min-w-0">
						<p class="text-xs text-surface-500-400 uppercase tracking-wide leading-none mb-0.5">{m.mpbr_max_ord()}</p>
						{#if mpbrResult.maxOrdinate}
							<p class="text-sm font-semibold tabular-nums leading-none">
								{mpbrResult.maxOrdinate.elevation} <span class="text-xs font-normal text-surface-500-400">{elevLabel}</span>
							</p>
							<p class="text-xs text-surface-500-400 leading-none mt-0.5">{m.mpbr_at()} {mpbrResult.maxOrdinate.distance} {distLabel}</p>
						{:else}
							<p class="text-xs text-surface-500-400">{m.mpbr_unknown()}</p>
						{/if}
					</div>
				</div>
			</div>

			<!-- Chart -->
			<div class="space-y-2">
				<div class="flex items-center justify-between">
					<h2 class="font-semibold">{m.mpbr_chart()}</h2>
					<button
						type="button"
						class="chip text-xs {showAnnotations ? 'preset-filled-primary-500' : 'preset-tonal-surface'}"
						title={m.mpbr_annotations()}
						onclick={() => (showAnnotations = !showAnnotations)}
					>
						<MapPin class="size-3 mr-1" />{m.mpbr_annotations()}
					</button>
				</div>
				<div bind:this={chartEl}></div>
			</div>

			<!-- Save MPBR zero button -->
			<button
				type="button"
				class="btn preset-tonal-primary gap-2"
				title={m.mpbr_save_zero()}
				onclick={() => {
					profiles.update(activeProfile.id, {
						zeroDist: mpbrResult.optimalZero,
						zeroUnit: mpbrResult.useMetric ? 'm' : 'yd'
					});
					goto('/profiles');
				}}
			>
				<BookmarkPlus class="size-5" />
				{m.mpbr_save_zero()}
			</button>

		{:else if !calculating && hasCalculated}
			<!-- Calculation returned no result -->
			<p class="text-sm text-surface-500-400 text-center py-8">{m.mpbr_no_result()}</p>

		{:else if !calculating}
			<!-- Not yet calculated -->
			<p class="text-sm text-surface-500-400 text-center py-8">{m.mpbr_hint()}</p>
		{/if}

	</div>
{/if}
