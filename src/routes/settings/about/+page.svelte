<script>
	/**
	 * About (#166). Phone: logo card, description, Provided by Chocolate Warfare, This copy, Open
	 * source, Calculation engine (with a link to Licences). From 768 px two columns: the same cards on
	 * the left; on the right the licence texts (tablet) or the included software table (desktop).
	 */
	import { m } from '#lib/paraglide/messages.js';
	import { localizeHref } from '#lib/paraglide/runtime.js';
	import { ScaleIcon } from '@lucide/svelte';
	import GithubIcon from '#lib/components/GithubIcon.svelte';
	import { APP_VERSION } from '#lib/utils/platform.js';
	import AboutIdentityCard from '#lib/components/settings/AboutIdentityCard.svelte';
	import ProvidedByCard from '#lib/components/settings/ProvidedByCard.svelte';
	import ThisCopyCard from '#lib/components/settings/ThisCopyCard.svelte';
	import OpenSourceCard from '#lib/components/settings/OpenSourceCard.svelte';
	import EngineCreditsCard from '#lib/components/settings/EngineCreditsCard.svelte';
	import LicenceTexts from '#lib/components/settings/LicenceTexts.svelte';
	import IncludedSoftware from '#lib/components/settings/IncludedSoftware.svelte';
	import ExternalLink from '#lib/components/settings/ExternalLink.svelte';
	import { platformText } from '#lib/components/settings/platformText.js';
	import { outlineButton, sectionTitle } from '#lib/components/settings/settingsStyles.js';

	const platform = platformText();
</script>

<svelte:head>
	<title>{m.about_title()} — {m.app_name()}</title>
</svelte:head>

<div class="max-w-[1180px] flex flex-col gap-2.5 px-2 sm:px-4 md:px-0 md:gap-5">
	<header class="flex flex-wrap items-center gap-x-6 gap-y-2">
		<div class="flex-1 min-w-0">
			<h1 class="sr-only md:not-sr-only text-xl lg:text-[28px] font-bold tracking-tight">{m.about_title()}</h1>
			<p class="hidden lg:block mt-1 text-sm text-surface-600-400">
				{m.about_header_desc({ version: APP_VERSION, platform })}
			</p>
		</div>
		<ExternalLink href="https://github.com/hawkins48b/cw-zro" class="{outlineButton} max-lg:hidden">
			{#snippet icon()}<GithubIcon class="size-4 shrink-0" />{/snippet}
			{m.about_view_source()}
		</ExternalLink>
	</header>

	<div class="grid gap-2.5 md:grid-cols-2 md:gap-5 lg:gap-6 md:items-start">
		<div class="flex flex-col gap-2.5 md:gap-4">
			<AboutIdentityCard />
			<p class="mx-1 text-sm leading-relaxed text-surface-600-400">{m.about_description()}</p>
			<ProvidedByCard />
			<ThisCopyCard class="md:hidden" />
			<OpenSourceCard />
			<EngineCreditsCard />
		</div>

		<!-- Tablet: the licence texts. Desktop: every included package. -->
		<div class="hidden md:flex flex-col gap-2.5">
			<div class="lg:hidden flex flex-col gap-2.5">
				<h2 class={sectionTitle}>{m.licenses_title()}</h2>
				<p class="mx-1 text-xs text-surface-600-400">{m.licenses_shipped_note()}</p>
				<LicenceTexts />
				<a href={localizeHref('/settings/about/licenses')} class="{outlineButton} self-start">
					<ScaleIcon class="size-4" aria-hidden="true" />
					{m.licenses_see_all()}
				</a>
			</div>
			<div class="hidden lg:flex flex-col gap-2.5">
				<h2 class={sectionTitle}>{m.licenses_included()}</h2>
				<IncludedSoftware variant="table" />
				<p class="mx-1 text-xs text-surface-600-400">{m.licenses_highlight_note()}</p>
				<a href={localizeHref('/settings/about/licenses')} class="{outlineButton} self-start">
					<ScaleIcon class="size-4" aria-hidden="true" />
					{m.licenses_title()}
				</a>
			</div>
		</div>
	</div>
</div>
