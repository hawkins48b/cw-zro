<script>
	import { goto } from '$app/navigation';
	import { page } from '$app/state';
	import { localizeHref } from '$lib/paraglide/runtime.js';
	import { m } from '$lib/paraglide/messages.js';
	import { profiles } from '$lib/stores/profiles.svelte.js';
	import { ammoSelection } from '$lib/stores/ammoSelection.svelte.js';
	import ammoData from '$lib/data/ammo.json';

	const returnPath = page.url.searchParams.get('return') ?? '/profiles';

	// Extract unique ammo from existing profiles
	const profileAmmo = [...new Map(
		profiles.list
			.filter(p => p.bulletBrand && p.bulletWeight && p.bulletDiameter && p.bc)
			.map(p => [
				p.bulletBrand + '|' + p.bulletWeight + '|' + p.bulletWeightUnit + '|' + p.bulletDiameter,
				{
					brand: p.bulletBrand,
					weight: Number(p.bulletWeight),
					weightUnit: p.bulletWeightUnit.toUpperCase(),
					diameter: Number(p.bulletDiameter),
					diameterUnit: p.bulletDiameterUnit.toUpperCase(),
					ballisticCoefficient: Number(p.bc),
					ballisticCoefficientProfile: p.bcType,
					length: p.bulletLength ? Number(p.bulletLength) : null,
					lengthUnit: p.bulletLengthUnit?.toUpperCase() ?? 'IN'
				}
			])
	).values()];

	let query = $state('');

	function normalize(s) {
		return s.toLowerCase().replace(/[\s\W]+/g, '');
	}

	const filtered = $derived.by(() => {
		const q = normalize(query);
		function matches(item) {
			return !q || normalize(item.brand).includes(q);
		}
		return {
			profiles: profileAmmo.filter(matches),
			library: ammoData.filter(matches)
		};
	});

	function select(ammo) {
		ammoSelection.set(ammo);
		goto(localizeHref(returnPath));
	}

</script>

<svelte:head>
	<title>{m.ammo_selector_title()} — {m.app_name()}</title>
</svelte:head>

<div class="max-w-lg space-y-4">
	<!-- Search -->
	<input
		class="input"
		type="search"
		bind:value={query}
		placeholder={m.ammo_selector_search_placeholder()}
	/>

	<!-- Results -->
	{#if filtered.profiles.length === 0 && filtered.library.length === 0}
		<p class="text-surface-500-400 text-sm py-4 text-center">{m.ammo_selector_no_results()}</p>
	{:else}
		<div class="space-y-4">
			{#if filtered.profiles.length > 0}
				<div class="card preset-filled-surface-100-900 p-4 space-y-1">
					<p class="text-xs font-semibold text-surface-500-400 uppercase tracking-wide pb-1 border-b border-surface-200-800">
						{m.ammo_selector_from_profiles()}
					</p>
					{#each filtered.profiles as item}
						<button
							type="button"
							class="w-full text-left px-2 py-2 rounded hover:preset-tonal-surface transition-colors"
							onclick={() => select(item)}
						>
							<span class="font-medium">{item.brand}</span>
							<span class="text-surface-500-400 text-sm ml-1">— {item.weight} {item.weightUnit.toLowerCase()}</span>
						</button>
					{/each}
				</div>
			{/if}

			{#if filtered.library.length > 0}
				<div class="card preset-filled-surface-100-900 p-4 space-y-1">
					<p class="text-xs font-semibold text-surface-500-400 uppercase tracking-wide pb-1 border-b border-surface-200-800">
						{m.ammo_selector_library()}
					</p>
					{#each filtered.library as item}
						<button
							type="button"
							class="w-full text-left px-2 py-2 rounded hover:preset-tonal-surface transition-colors"
							onclick={() => select(item)}
						>
							<span class="font-medium">{item.brand}</span>
							<span class="text-surface-500-400 text-sm ml-1">— {item.weight} {item.weightUnit.toLowerCase()}</span>
						</button>
					{/each}
				</div>
			{/if}
		</div>
	{/if}

	<!-- Disclaimer -->
	<p class="text-xs text-surface-500-400 text-center pb-4">{m.ammo_selector_disclaimer()}</p>
</div>
