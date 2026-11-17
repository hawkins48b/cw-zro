<script>
	/**
	 * Reading the precision dope card (#157, board 7b; wind rays every 15° since #159). Static help
	 * text: no data, no store.
	 * The example numbers are those of the sample 6.5 Creedmoor card, not computed here.
	 */
	import { m } from '#lib/paraglide/messages.js';
	import { localizeHref } from '#lib/paraglide/runtime.js';
	import { ArrowLeft } from '@lucide/svelte';

	const focusRing = 'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary-500';

	const items = [
		{ n: '1', title: () => m.dope_guide_elevation_title(), text: () => m.dope_guide_elevation_text() },
		{ n: '2', title: () => m.dope_guide_extra_title(), text: () => m.dope_guide_extra_text() },
		{ n: '3', title: () => m.dope_guide_pressure_title(), text: () => m.dope_guide_pressure_text() },
		{ n: '4', title: () => m.dope_guide_temperature_title(), text: () => m.dope_guide_temperature_text() },
		{ n: '5', title: () => m.dope_guide_spin_title(), text: () => m.dope_guide_spin_text() }
	];

	// Every hour and half hour of the clock, by the ray that reads it (#159). A direction reads
	// the ray of its angle off the line of fire, mirrored left-right and front-back: half past
	// XII is 15°, half past V is 165°, the same crosswind as 15°.
	const clock = [
		{ from: 'XII, VI', read: () => m.dope_guide_clock_none() },
		{ from: 'XII½, V½, VI½, XI½', read: () => '15°' },
		{ from: 'I, V, VII, XI', read: () => 'I (30°)' },
		{ from: 'I½, IV½, VII½, X½', read: () => '45°' },
		{ from: 'II, IV, VIII, X', read: () => 'II (60°)' },
		{ from: 'II½, III½, VIII½, IX½', read: () => '75°' },
		{ from: 'III, IX', read: () => 'III (90°)' }
	];

	// Sample 6.5 Creedmoor values from the design (board 7b): 58 + 7 − 3 − 1 = 61 up; 11 − 1 = 10 right.
	const example = [
		{ k: () => m.dope_guide_ex_elevation(), v: '+58' },
		{ k: () => m.dope_guide_ex_extra(), v: '+7' },
		{ k: () => m.dope_guide_ex_pressure(), v: '−3' },
		{ k: () => m.dope_guide_ex_temperature(), v: '−1' },
		{ k: () => m.dope_guide_ex_elevation_total(), v: () => m.dope_guide_ex_elevation_total_value(), total: true },
		{ k: () => m.dope_guide_ex_spin(), v: () => m.dope_guide_ex_spin_value() },
		{ k: () => m.dope_guide_ex_wind(), v: () => m.dope_guide_ex_wind_value() },
		{ k: () => m.dope_guide_ex_windage_total(), v: () => m.dope_guide_ex_windage_total_value(), total: true }
	];

	const text = (v) => (typeof v === 'function' ? v() : v);
</script>

<svelte:head>
	<title>{m.dope_guide_title()} — {m.app_name()}</title>
</svelte:head>

{#snippet badge(n)}
	<span
		class="size-[22px] shrink-0 rounded-full inline-flex items-center justify-center text-xs font-extrabold bg-surface-950-50 text-surface-50-950"
		aria-hidden="true">{n}</span
	>
{/snippet}

<div class="max-w-2xl flex flex-col gap-3 px-2 sm:px-0">
	<a
		href={localizeHref('/calculators/dope-cards')}
		class="hidden lg:inline-flex items-center gap-2 self-start min-h-11 text-sm font-semibold text-primary-700-300 hover:underline underline-offset-2 rounded-sm {focusRing}"
	>
		<ArrowLeft class="size-4" aria-hidden="true" />
		{m.calc_dope_cards()}
	</a>

	<h1 class="sr-only lg:not-sr-only text-2xl font-bold">{m.dope_guide_title()}</h1>

	<p class="mx-1 text-sm leading-relaxed text-surface-600-400">{m.dope_guide_intro()}</p>

	<!-- ①–⑤ -->
	<section aria-labelledby="guide-elevation" class="card preset-filled-surface-100-900 border border-surface-200-800 p-4 space-y-3">
		<h2 id="guide-elevation" class="font-bold">{m.dope_guide_section_elevation()}</h2>
		<ol class="space-y-3">
			{#each items as it (it.n)}
				<li class="flex gap-2.5">
					{@render badge(it.n)}
					<div class="flex-1 min-w-0">
						<p class="font-semibold"><span class="sr-only">{it.n}. </span>{it.title()}</p>
						<p class="mt-0.5 text-sm leading-relaxed text-surface-600-400">{it.text()}</p>
					</div>
				</li>
			{/each}
		</ol>
	</section>

	<!-- ⑥ Wind -->
	<section aria-labelledby="guide-wind" class="card preset-filled-surface-100-900 border border-surface-200-800 p-4 space-y-3">
		<h2 id="guide-wind" class="flex items-center gap-2.5 font-bold">
			{@render badge('6')}<span><span class="sr-only">6. </span>{m.dope_guide_wind_title()}</span>
		</h2>
		<p class="text-sm leading-relaxed text-surface-600-400">{m.dope_guide_wind_intro()}</p>

		<figure class="p-3 rounded-base bg-surface-50-950 flex flex-col items-center gap-2">
			<svg
				viewBox="0 0 210 200"
				class="w-full max-w-[240px] h-auto"
				role="img"
				aria-label={m.dope_guide_wind_figure_label()}
			>
				<!-- Rings 2, 4, 6 m/s -->
				<g fill="none" class="stroke-surface-400-600" stroke-width="1" stroke-dasharray="4 3">
					<path d="M20 130 A50 50 0 0 1 70 180" />
					<path d="M20 80 A100 100 0 0 1 120 180" />
					<path d="M20 30 A150 150 0 0 1 170 180" />
				</g>
				<!-- The thin rays every 15° (#159); the example's II (60°) is drawn below -->
				<g class="stroke-surface-300-700" stroke-width="1">
					<path d="M20 180 L61.4 25.5" />
					<path d="M20 180 L100 41.4" />
					<path d="M20 180 L133.1 66.9" />
					<path d="M20 180 L174.5 138.6" />
				</g>
				<!-- The ring and direction of the example -->
				<path d="M20 80 A100 100 0 0 1 120 180" fill="none" class="stroke-primary-600-400" stroke-width="2.5" />
				<g class="stroke-surface-950-50" stroke-width="1.25"><path d="M20 180 V14" /><path d="M20 180 H182" /></g>
				<path d="M20 180 L149.9 105" class="stroke-primary-600-400" stroke-width="2.5" />
				<circle cx="20" cy="180" r="3.5" class="fill-surface-950-50" />
				<!-- Halo in the figure's background so the numbers stay readable over the lines -->
				<g
					font-size="14"
					font-weight="800"
					text-anchor="middle"
					paint-order="stroke"
					stroke-width="5"
					stroke-linejoin="round"
					class="fill-surface-950-50 stroke-surface-50-950"
				>
					<text x="20" y="135" text-decoration="underline">2</text>
					<text x="20" y="85" text-decoration="underline">4</text>
					<text x="20" y="35" text-decoration="underline">6</text>
					<text x="20" y="12" font-size="13">XII</text>
					<text x="106" y="34" font-size="13">I</text>
					<text x="172" y="98" font-size="13">II</text>
					<text x="194" y="185" font-size="13">III</text>
				</g>
				<g
					font-size="14"
					font-weight="800"
					text-anchor="middle"
					paint-order="stroke"
					stroke-width="5"
					stroke-linejoin="round"
					class="fill-tertiary-700-300 stroke-surface-50-950"
				>
					<text x="63" y="160">5</text>
					<text x="107" y="135">11</text>
					<text x="150" y="110">16</text>
				</g>
				<circle cx="106.6" cy="130" r="13" fill="none" class="stroke-primary-600-400" stroke-width="2" />
			</svg>
			<!-- Legend outside the SVG, so long translations wrap -->
			<dl class="grid grid-cols-[auto_1fr] gap-x-2 gap-y-0.5 text-xs text-surface-600-400 self-stretch">
				<dt class="font-bold text-surface-950-50 underline">4</dt>
				<dd>{m.dope_guide_wind_legend_speed()}</dd>
				<dt class="font-bold text-tertiary-700-300">11</dt>
				<dd>{m.dope_guide_wind_legend_clicks()}</dd>
			</dl>
			<figcaption class="text-[13px] leading-snug text-center text-surface-600-400">
				{m.dope_guide_wind_caption()}
			</figcaption>
		</figure>

		<ul class="list-disc pl-5 space-y-1.5 text-sm leading-relaxed text-surface-600-400">
			<li>{m.dope_guide_wind_side()}</li>
			<li>{m.dope_guide_wind_rays()}</li>
			<li>{m.dope_guide_wind_between()}</li>
			<li>{m.dope_guide_wind_mph()}</li>
		</ul>

		<div class="overflow-x-auto">
			<table class="w-full text-sm border-collapse">
				<caption class="pb-1 text-left text-[13px] font-semibold">{m.dope_guide_clock_caption()}</caption>
				<thead>
					<tr>
						<th scope="col" class="px-2 py-1.5 text-left font-semibold border-b border-surface-400-600">{m.dope_guide_clock_from()}</th>
						<th scope="col" class="px-2 py-1.5 text-left font-semibold border-b border-surface-400-600">{m.dope_guide_clock_read()}</th>
					</tr>
				</thead>
				<tbody>
					{#each clock as c (c.from)}
						<tr>
							<td class="px-2 py-1.5 border-b border-surface-200-800">{c.from}</td>
							<td class="px-2 py-1.5 font-semibold border-b border-surface-200-800">{c.read()}</td>
						</tr>
					{/each}
				</tbody>
			</table>
		</div>
		<p class="text-xs leading-relaxed text-surface-600-400">{m.dope_guide_clock_half()}</p>
	</section>

	<!-- Worked example -->
	<section aria-labelledby="guide-example" class="card preset-tonal-primary border border-primary-200-800 p-4 space-y-2">
		<h2 id="guide-example" class="font-bold">{m.dope_guide_ex_title()}</h2>
		<p class="text-sm leading-relaxed">{m.dope_guide_ex_conditions()}</p>
		<table class="w-full text-sm border-collapse tabular-nums">
			<caption class="sr-only">{m.dope_guide_ex_title()}</caption>
			<tbody>
				{#each example as e, i (i)}
					<tr class={e.total ? 'border-t border-primary-300-700' : ''}>
						<th scope="row" class="py-1 text-left {e.total ? 'font-extrabold' : 'font-normal'}">{e.k()}</th>
						<td class="py-1 text-right {e.total ? 'font-extrabold' : ''}">{text(e.v)}</td>
					</tr>
				{/each}
			</tbody>
		</table>
		<p class="text-xs leading-relaxed">{m.dope_guide_ex_note()}</p>
	</section>

	<!-- Printing -->
	<section aria-labelledby="guide-print" class="card preset-filled-surface-100-900 border border-surface-200-800 p-4 space-y-1.5">
		<h2 id="guide-print" class="font-bold">{m.dope_guide_print_title()}</h2>
		<p class="text-sm leading-relaxed text-surface-600-400">{m.dope_guide_print_text()}</p>
	</section>

	<a
		href={localizeHref('/calculators/dope-cards')}
		class="btn preset-filled-primary-500 self-start {focusRing}"
	>
		{m.dope_guide_back()}
	</a>
</div>
