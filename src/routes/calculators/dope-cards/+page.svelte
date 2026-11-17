<script>
	import { m } from '#lib/paraglide/messages.js';
	import { localizeHref } from '#lib/paraglide/runtime.js';
	import { activeProfile } from '#lib/stores/activeProfile.svelte.js';
	import { ChevronDown, ChevronRight, Download, Loader } from '@lucide/svelte';
	import { downloadDopeCard } from '#lib/utils/dopeCardDownload.js';
	import PrecisionCardGenerator from '#lib/components/PrecisionCardGenerator.svelte';
	import ProfileInUseChip from '#lib/components/ProfileInUseChip.svelte';

	// ── Download state ────────────────────────────────────────────────
	let loading = $state({ imperial: false, metric: false });
	// The outcome of the last download: a card the profile gives no data for is not saved (#91),
	// and a failed build or save has its own message (#123). See downloadDopeCard.
	let outcome = $state(null);

	async function download(type) {
		const profile = activeProfile.profile;
		if (!profile || loading[type]) return;
		loading[type] = true;
		outcome = null;
		try {
			// Loaded on demand, inside downloadDopeCard so that a failed load counts as a failure.
			const generate = async (p) =>
				type === 'imperial'
					? (await import('#lib/utils/dopeCardImperial.js')).generateImperialDopeCard(p)
					: (await import('#lib/utils/dopeCardMetric.js')).generateMetricDopeCard(p);
			outcome = await downloadDopeCard(generate, profile, (pdfDoc) =>
				savePDF(pdfDoc, `mid-range-dope-card-${type}.pdf`)
			);
		} finally {
			loading[type] = false;
		}
	}

	async function savePDF(pdfDoc, filename) {
		const bytes = await pdfDoc.save();
		const blob = new Blob([bytes], { type: 'application/pdf' });
		const url = URL.createObjectURL(blob);
		const a = document.createElement('a');
		a.href = url;
		a.download = filename;
		a.click();
		URL.revokeObjectURL(url);
	}

	// ── Mid-range card (#166) ─────────────────────────────────────────
	// Phones: a closed row that opens the card (the precision card comes first in view). From sm
	// the card is always open and has a plain heading; from md it sits left of the precision card.
	let expanded = $state(false);
	const uid = $props.id();
	const focusRing = 'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary-500';
</script>

<svelte:head>
	<title>{m.dope_title()} — {m.app_name()}</title>
</svelte:head>

{#if !activeProfile.profile}
	<div class="py-12 text-center space-y-3">
		<p class="text-surface-600-400">{m.dope_no_profile()}</p>
		<a href={localizeHref('/profiles')} class="btn preset-tonal-primary">{m.nav_profiles()}</a>
	</div>
{:else}
	<div class="flex flex-col gap-3 sm:gap-4 lg:gap-5">
		<!-- Header: title on desktop (the app header shows it below lg) and intro from sm -->
		<header class="max-sm:sr-only">
			<h1 class="sr-only lg:not-sr-only lg:text-[28px] lg:font-bold lg:tracking-tight">{m.dope_title()}</h1>
			<p class="lg:mt-1 text-sm text-surface-600-400">{m.dope_intro()}</p>
		</header>

		<div class="flex flex-col gap-2.5 md:grid md:grid-cols-[minmax(260px,300px)_minmax(0,1fr)] md:items-start md:gap-5 lg:grid-cols-[minmax(300px,360px)_minmax(0,1fr)]">
			<!-- Mid-range dope chart (imperial / metric PDF of the profile in use) -->
			<section class="card preset-filled-surface-100-900 border border-surface-200-800 min-w-0" aria-labelledby="{uid}-mid-title">
				<!-- Phone: the heading is a button that opens the card -->
				<h2 id="{uid}-mid-title" class="sm:hidden">
					<button
						type="button"
						class="flex items-center gap-2.5 w-full min-h-[52px] px-4 py-3 text-left text-[15px] font-medium rounded-container {focusRing}"
						aria-expanded={expanded}
						aria-controls="{uid}-mid-body"
						onclick={() => (expanded = !expanded)}
					>
						{#if expanded}
							<ChevronDown class="size-4 text-surface-600-400 shrink-0" aria-hidden="true" />
						{:else}
							<ChevronRight class="size-4 text-surface-600-400 shrink-0" aria-hidden="true" />
						{/if}
						<span class="flex-1">{m.dope_midrange_title()}</span>
						<span class="shrink-0 px-2 py-0.5 rounded-full preset-tonal-surface text-[10px] font-bold tracking-wide">{m.dope_midrange_badge()}</span>
					</button>
				</h2>
				<div class="hidden sm:flex items-center gap-2.5 px-[18px] pt-4" aria-hidden="true">
					<span class="flex-1 text-base font-semibold">{m.dope_midrange_title()}</span>
					<span class="shrink-0 px-2 py-0.5 rounded-full preset-tonal-surface text-[10px] font-bold tracking-wide">{m.dope_midrange_badge()}</span>
				</div>

				<div
					id="{uid}-mid-body"
					class="{expanded ? 'flex' : 'hidden'} sm:flex flex-col gap-3.5 border-t border-surface-200-800 sm:border-0 px-4 py-4 sm:px-[18px] sm:pt-3 sm:pb-[18px]"
				>
					<p class="text-sm leading-relaxed text-surface-600-400">{m.dope_midrange_desc()}</p>

					<ProfileInUseChip variant="inline" label={m.dope_midrange_for()} />

					<div class="grid grid-cols-2 gap-2.5">
						<button
							type="button"
							class="btn h-12 lg:h-11 preset-filled-primary-500 font-semibold {focusRing}"
							onclick={() => download('imperial')}
							disabled={loading.imperial || loading.metric}
						>
							{#if loading.imperial}
								<Loader class="size-4 animate-spin" aria-hidden="true" />
							{:else}
								<Download class="size-4" aria-hidden="true" />
							{/if}
							{m.dope_imperial()}
						</button>

						<button
							type="button"
							class="btn h-12 lg:h-11 preset-filled-primary-500 font-semibold {focusRing}"
							onclick={() => download('metric')}
							disabled={loading.imperial || loading.metric}
						>
							{#if loading.metric}
								<Loader class="size-4 animate-spin" aria-hidden="true" />
							{:else}
								<Download class="size-4" aria-hidden="true" />
							{/if}
							{m.dope_metric()}
						</button>
					</div>

					{#if outcome === 'no-data'}
						<p class="text-sm text-warning-800-200" role="alert">{m.dope_no_result()}</p>
					{:else if outcome === 'failed'}
						<p class="text-sm text-error-500" role="alert">{m.dope_save_failed()}</p>
					{/if}
				</div>
			</section>

			<!-- Precision dope card (#157): A6 booklet, any saved profile -->
			<div class="min-w-0">
				<PrecisionCardGenerator save={savePDF} />
			</div>
		</div>
	</div>
{/if}
