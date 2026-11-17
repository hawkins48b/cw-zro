<script>
	/**
	 * Licences and notices (#166): the licence texts (one open at a time), then every included
	 * package with its licence. From 1024 px the two sit side by side.
	 */
	import { m } from '#lib/paraglide/messages.js';
	import LicenceTexts from '#lib/components/settings/LicenceTexts.svelte';
	import IncludedSoftware from '#lib/components/settings/IncludedSoftware.svelte';
	import { sectionTitle } from '#lib/components/settings/settingsStyles.js';
</script>

<svelte:head>
	<title>{m.licenses_title()} — {m.app_name()}</title>
</svelte:head>

<div class="flex flex-col gap-3 sm:gap-4 lg:gap-5">
	<header>
		<h1 class="sr-only md:not-sr-only text-xl lg:text-[28px] font-bold tracking-tight">{m.licenses_title()}</h1>
		<p class="mx-1 md:mx-0 md:mt-1 text-sm leading-relaxed text-surface-600-400">{m.licenses_intro()}</p>
	</header>

	<div class="grid gap-2.5 lg:grid-cols-2 lg:gap-6 lg:items-start">
		<section aria-labelledby="licenses-texts" class="flex flex-col gap-2.5">
			<h2 id="licenses-texts" class="{sectionTitle}">{m.licenses_texts()}</h2>
			<LicenceTexts />
		</section>

		<section aria-labelledby="licenses-packages" class="flex flex-col gap-2.5">
			<h2 id="licenses-packages" class="{sectionTitle} max-lg:mt-2.5">{m.licenses_included()}</h2>
			<IncludedSoftware />
			<p class="mx-1 text-xs text-surface-600-400">{m.licenses_highlight_note()}</p>
		</section>
	</div>
</div>
