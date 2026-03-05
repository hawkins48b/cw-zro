<script>
	import { m } from '$lib/paraglide/messages.js';
	import { activeProfile } from '$lib/stores/activeProfile.svelte.js';
	import { ChevronDown, ChevronRight, Download, Loader } from '@lucide/svelte';

	// ── Download state ────────────────────────────────────────────────
	let loading = $state({ imperial: false, metric: false });

	async function download(type) {
		const profile = activeProfile.profile;
		if (!profile || loading[type]) return;
		loading[type] = true;
		try {
			if (type === 'imperial') {
				const { generateImperialDopeCard } = await import('$lib/utils/dopeCardImperial.js');
				const pdfDoc = await generateImperialDopeCard(profile);
				await savePDF(pdfDoc, 'mid-range-dope-card-imperial.pdf');
			} else {
				const { generateMetricDopeCard } = await import('$lib/utils/dopeCardMetric.js');
				const pdfDoc = await generateMetricDopeCard(profile);
				await savePDF(pdfDoc, 'mid-range-dope-card-metric.pdf');
			}
		} catch (e) {
			console.error('Dope card generation failed:', e);
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

	// ── Expandable card state ─────────────────────────────────────────
	let expanded = $state(true);
</script>

<svelte:head>
	<title>{m.dope_title()} — {m.app_name()}</title>
</svelte:head>

{#if !activeProfile.profile}
	<div class="py-12 text-center space-y-3">
		<p class="text-surface-500-400">{m.dope_no_profile()}</p>
		<a href="/profiles" class="btn preset-tonal-primary">{m.nav_profiles()}</a>
	</div>
{:else}
	<div class="space-y-4">

		<!-- Mid-range dope chart card -->
		<div class="card preset-filled-surface-100-900">
			<!-- Header (clickable to expand/collapse) -->
			<button
				type="button"
				class="flex items-center gap-3 w-full p-4 text-left"
				onclick={() => (expanded = !expanded)}
			>
				{#if expanded}
					<ChevronDown class="size-4 text-surface-500-400 shrink-0" />
				{:else}
					<ChevronRight class="size-4 text-surface-500-400 shrink-0" />
				{/if}
				<span class="font-medium">{m.dope_midrange_title()}</span>
			</button>

			{#if expanded}
				<div class="border-t border-surface-200-800 px-4 py-4 space-y-3">
					<p class="text-sm text-surface-600-400">{m.dope_midrange_desc()}</p>

					<div class="flex gap-3 flex-wrap">
						<button
							type="button"
							class="btn preset-filled-primary-500"
							onclick={() => download('imperial')}
							disabled={loading.imperial || loading.metric}
						>
							{#if loading.imperial}
								<Loader class="size-4 animate-spin" />
							{:else}
								<Download class="size-4" />
							{/if}
							{m.dope_imperial()}
						</button>

						<button
							type="button"
							class="btn preset-filled-primary-500"
							onclick={() => download('metric')}
							disabled={loading.imperial || loading.metric}
						>
							{#if loading.metric}
								<Loader class="size-4 animate-spin" />
							{:else}
								<Download class="size-4" />
							{/if}
							{m.dope_metric()}
						</button>
					</div>
				</div>
			{/if}
		</div>

	</div>
{/if}
