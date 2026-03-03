<script>
	import { onMount } from 'svelte';
	import { m } from '$lib/paraglide/messages.js';
	import { profiles } from '$lib/stores/profiles.svelte.js';
	import { settings } from '$lib/stores/settings.svelte.js';
	import { compareTrajectories } from '$lib/stores/compareTrajectories.svelte.js';
	import { calculateFullTrajectory } from '$lib/utils/ballisticCalculator.js';
	import { Unit } from 'js-ballistics';
	import { Plus, X, Crosshair } from '@lucide/svelte';

	// ── ApexCharts (lazy-loaded, browser-only) ───────────────────────
	let ApexCharts = $state(null);
	let chartEl = $state(null);

	onMount(async () => {
		const mod = await import('apexcharts');
		ApexCharts = mod.default;
	});

	// ── Add a profile to the entries list ────────────────────────────
	function addProfile(profileId) {
		const profile = profiles.get(profileId);
		if (!profile) return;
		compareTrajectories.addEntry(
			profileId,
			String(profile.zeroDist ?? '100'),
			profile.zeroUnit ?? 'yd'
		);
	}

	// ── Chart unit helpers ───────────────────────────────────────────
	const Y_AXIS_OPTIONS = [
		{ value: 'in', label: () => m.unit_in() },
		{ value: 'ft', label: () => m.unit_ft() },
		{ value: 'yd', label: () => m.unit_yd() },
		{ value: 'cm', label: () => m.unit_cm() },
		{ value: 'm', label: () => m.unit_m() }
	];

	function getYUnit(key) {
		switch (key) {
			case 'in': return Unit.Inch;
			case 'ft': return Unit.Foot;
			case 'yd': return Unit.Yard;
			case 'cm': return Unit.Centimeter;
			case 'm': return Unit.Meter;
			default: return Unit.Inch;
		}
	}

	let isMetric = $derived(compareTrajectories.range.unit === 'm');
	let distLabel = $derived(isMetric ? m.unit_m() : m.unit_yd());
	let yAxisKey = $derived(compareTrajectories.yAxis);

	// ── Resolve entries to profiles ──────────────────────────────────
	let resolvedEntries = $derived(
		compareTrajectories.entries.map((entry) => {
			const profile = profiles.get(entry.profileId);
			if (!profile) return null;
			const zeroLabel = `${entry.zeroDist}\u202f${entry.zeroUnit === 'm' ? m.unit_m() : m.unit_yd()}`;
			return {
				...entry,
				profile,
				label: `${profile.name} @ ${zeroLabel}`
			};
		}).filter(Boolean)
	);

	// ── Compute trajectories for all entries ─────────────────────────
	let chartData = $derived.by(() => {
		if (resolvedEntries.length === 0) return null;

		const rangeDist = parseFloat(compareTrajectories.range.distance);
		if (!isFinite(rangeDist) || rangeDist <= 0) return null;

		const step = Math.max(1, Math.round(rangeDist / 50));
		const rangeObj = { distance: rangeDist, unit: compareTrajectories.range.unit, step };

		const series = [];
		for (const entry of resolvedEntries) {
			const overriddenProfile = {
				...entry.profile,
				zeroDist: entry.zeroDist,
				zeroUnit: entry.zeroUnit
			};
			const result = calculateFullTrajectory(overriddenProfile, rangeObj, null, null);
			if (!result) continue;

			const distUnit = isMetric ? Unit.Meter : Unit.Yard;
			const yUnit = getYUnit(yAxisKey);
			const data = (result.trajectory ?? []).map((p) => ({
				x: Math.round(p.distance.In(distUnit) * 10) / 10,
				y: Math.round(p.targetDrop.In(yUnit) * 100) / 100
			}));
			series.push({ name: entry.label, data });
		}

		return series.length > 0 ? series : null;
	});

	// ── Chart rendering ──────────────────────────────────────────────
	const CHART_COLORS = [
		'#6366f1', '#22c55e', '#f59e0b', '#ef4444', '#06b6d4',
		'#8b5cf6', '#ec4899', '#14b8a6', '#f97316', '#64748b'
	];

	function buildChartOptions(series, dark) {
		const dAxisLabel = isMetric ? m.unit_meters() : m.unit_yards();
		const dLabel = isMetric ? m.unit_m() : m.unit_yd();
		const yLabel = Y_AXIS_OPTIONS.find((o) => o.value === yAxisKey)?.label() ?? yAxisKey;

		const maxX = series.reduce((max, s) => {
			const last = s.data.at(-1)?.x ?? 0;
			return last > max ? last : max;
		}, 0);

		return {
			series,
			chart: {
				type: 'line',
				height: 320,
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
				title: { text: dAxisLabel, style: { fontSize: '12px' } },
				labels: { formatter: (v) => `${Math.round(v)}` }
			},
			yaxis: {
				title: { text: yLabel, style: { fontSize: '12px' } },
				labels: { formatter: (v) => `${v}` }
			},
			colors: CHART_COLORS.slice(0, series.length),
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
					}
				]
			},
			tooltip: {
				theme: dark ? 'dark' : 'light',
				x: { formatter: (v) => `${v} ${dLabel}` },
				y: { formatter: (v) => `${v} ${yLabel}` }
			},
			legend: { show: true, position: 'top', horizontalAlign: 'right' },
			markers: { size: 0 }
		};
	}

	$effect(() => {
		const ac = ApexCharts;
		const el = chartEl;
		const data = chartData;
		if (!ac || !el || !data) return;

		const opts = buildChartOptions(data, settings.darkMode);
		const chart = new ac(el, opts);
		chart.render();
		return () => chart.destroy();
	});

	// ── Helper ───────────────────────────────────────────────────────
	function profileZeroLabel(profile) {
		return `${profile.zeroDist}\u202f${profile.zeroUnit === 'm' ? m.unit_m() : m.unit_yd()}`;
	}
</script>

<svelte:head>
	<title>{m.compare_title()} — {m.app_name()}</title>
</svelte:head>

<div class="space-y-6">

	{#if profiles.list.length === 0}
		<div class="py-12 text-center space-y-3">
			<p class="text-surface-500-400">{m.compare_no_profiles()}</p>
			<a href="/profiles" class="btn preset-tonal-primary">{m.nav_profiles()}</a>
		</div>
	{:else}

		<!-- ═══ Profile selector (card-based, like /profiles) ════════ -->
		<div class="space-y-2">
			<span class="text-sm font-medium">{m.compare_add_profile()}</span>
			<div class="grid gap-2 max-w-2xl">
				{#each profiles.list as profile}
					<button
						type="button"
						class="card preset-outlined-surface-200-800 bg-surface-50-950 text-left hover:preset-tonal-primary transition-colors"
						onclick={() => addProfile(profile.id)}
					>
						<div class="p-3 flex items-start gap-3">
							<div class="flex-1 min-w-0">
								<p class="font-semibold leading-snug">{profile.name}</p>
								<p class="text-sm mt-0.5 text-surface-500">{profile.ammo}</p>
							</div>
							<Plus class="size-5 text-surface-400 shrink-0 mt-0.5" />
						</div>
						<div class="border-t border-surface-200-800 px-3 py-2 grid grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-2.5 text-sm text-surface-500">
							<Crosshair class="size-3.5" />
							<span class="truncate">{profile.optic}</span>
							<span class="chip text-xs font-semibold preset-tonal-primary">
								{profileZeroLabel(profile)}
							</span>
						</div>
					</button>
				{/each}
			</div>
		</div>

		<!-- ═══ Entries list with editable zero ══════════════════════ -->
		{#if resolvedEntries.length > 0}
			<div class="space-y-2">
				{#each resolvedEntries as entry, i}
					<div class="card preset-filled-surface-100-900 p-3 space-y-2">
						<!-- Header: color dot + name + remove -->
						<div class="flex items-center gap-3">
							<span
								class="size-3 rounded-full shrink-0"
								style="background-color: {CHART_COLORS[i % CHART_COLORS.length]}"
							></span>
							<div class="flex-1 min-w-0">
								<p class="text-sm font-semibold truncate">{entry.profile.name}</p>
								<p class="text-xs text-surface-500-400 truncate">{entry.profile.ammo}</p>
							</div>
							<button
								type="button"
								class="btn btn-icon btn-sm preset-tonal-error shrink-0"
								title={m.compare_remove()}
								onclick={() => compareTrajectories.removeEntry(entry.id)}
							>
								<X class="size-4" />
							</button>
						</div>

						<!-- Zero distance override -->
						<div class="space-y-1.5">
							<span class="text-xs font-medium text-surface-500-400">{m.compare_zero_override()}</span>
							<div class="input !flex !items-center gap-2">
								<input
									class="flex-1 min-w-0 bg-transparent border-none outline-none shadow-none p-0"
									type="text"
									inputmode="decimal"
									placeholder={String(entry.profile.zeroDist)}
									value={entry.zeroDist}
									oninput={(e) => compareTrajectories.updateEntry(entry.id, { zeroDist: e.target.value })}
								/>
								<div class="flex items-center gap-1 shrink-0">
									{#each [{ value: 'yd', label: m.unit_yd() }, { value: 'm', label: m.unit_m() }] as opt}
										<button
											type="button"
											class="chip text-xs {entry.zeroUnit === opt.value
												? 'preset-filled-primary-500'
												: 'preset-tonal-surface'}"
											onclick={() => compareTrajectories.updateEntry(entry.id, { zeroUnit: opt.value })}
										>{opt.label}</button>
									{/each}
								</div>
							</div>
						</div>
					</div>
				{/each}
			</div>
		{/if}

		<!-- ═══ Chart controls ═══════════════════════════════════════ -->
		<div class="grid grid-cols-1 sm:grid-cols-2 gap-4">
			<!-- Max distance -->
			<div class="card preset-filled-surface-100-900 p-4 space-y-1.5">
				<span class="text-sm font-medium">{m.compare_max_dist()}</span>
				<div class="input !flex !items-center gap-2">
					<input
						class="flex-1 min-w-0 bg-transparent border-none outline-none shadow-none p-0"
						type="text"
						inputmode="decimal"
						placeholder="500"
						value={compareTrajectories.range.distance}
						oninput={(e) => compareTrajectories.setRange({ distance: e.target.value })}
					/>
					<div class="flex items-center gap-1 shrink-0">
						{#each [{ value: 'yd', label: m.unit_yd() }, { value: 'm', label: m.unit_m() }] as opt}
							<button
								type="button"
								class="chip text-xs {compareTrajectories.range.unit === opt.value
									? 'preset-filled-primary-500'
									: 'preset-tonal-surface'}"
								onclick={() => compareTrajectories.setRange({ unit: opt.value })}
							>{opt.label}</button>
						{/each}
					</div>
				</div>
			</div>

			<!-- Y axis unit -->
			<div class="card preset-filled-surface-100-900 p-4 space-y-1.5">
				<span class="text-sm font-medium">{m.compare_y_axis()}</span>
				<div class="flex flex-wrap gap-1">
					{#each Y_AXIS_OPTIONS as opt}
						<button
							type="button"
							class="chip text-xs {compareTrajectories.yAxis === opt.value
								? 'preset-filled-primary-500'
								: 'preset-tonal-surface'}"
							onclick={() => compareTrajectories.setYAxis(opt.value)}
						>{opt.label()}</button>
					{/each}
				</div>
			</div>
		</div>

		<!-- ═══ Chart ════════════════════════════════════════════════ -->
		{#if chartData}
			<div class="space-y-2">
				<h2 class="font-semibold">{m.compare_chart_title()}</h2>
				<div bind:this={chartEl}></div>
			</div>
		{:else if resolvedEntries.length === 0}
			<p class="text-sm text-surface-500-400 text-center py-4">{m.compare_no_entries()}</p>
		{/if}

	{/if}
</div>
