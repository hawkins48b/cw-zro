<script>
	/**
	 * Settings, General (#166): Display (theme, language), Data (profiles), the About pages, then the
	 * Danger zone. Phone: one column, footer with the build. Tablet: the Settings pane on the left
	 * (+layout.svelte), two columns here, "This copy" instead of the About links. Desktop: two
	 * columns and the About links; the sidebar lists the Settings pages.
	 */
	import { m } from '#lib/paraglide/messages.js';
	import { localizeHref } from '#lib/paraglide/runtime.js';
	import { APP_VERSION } from '#lib/utils/platform.js';
	import DisplaySettingsCard from '#lib/components/settings/DisplaySettingsCard.svelte';
	import ProfilesDataCard from '#lib/components/settings/ProfilesDataCard.svelte';
	import SettingsLinksCard from '#lib/components/settings/SettingsLinksCard.svelte';
	import ClearDataCard from '#lib/components/settings/ClearDataCard.svelte';
	import { platformText } from '#lib/components/settings/platformText.js';
	import { card, outlineButton, sectionTitle } from '#lib/components/settings/settingsStyles.js';

	const platform = platformText();
</script>

<svelte:head>
	<title>{m.settings_title()} — {m.app_name()}</title>
</svelte:head>

<div class="max-w-[1180px] flex flex-col gap-2.5 px-2 sm:px-4 md:px-0 md:gap-5">
	<!-- Phone: the layout header shows "Settings". Tablet: "General" (the pane says Settings). Desktop: "Settings". -->
	<header class="flex flex-wrap items-end gap-x-6 gap-y-1">
		<div class="flex-1 min-w-0">
			<h1 class="sr-only md:not-sr-only text-xl lg:text-[28px] font-bold tracking-tight">
				<span class="lg:hidden">{m.settings_general()}</span>
				<span class="max-lg:hidden">{m.settings_title()}</span>
			</h1>
			<p class="hidden md:block mt-1 text-sm text-surface-600-400">{m.settings_general_intro()}</p>
		</div>
		<p class="hidden lg:block text-[13px] text-surface-600-400">
			{m.settings_footer_build({ version: APP_VERSION, platform })}
		</p>
	</header>

	<div class="grid gap-2.5 md:grid-cols-2 md:gap-5 lg:gap-6 md:items-start">
		<section aria-labelledby="settings-display" class="flex flex-col gap-2.5">
			<h2 id="settings-display" class={sectionTitle}>{m.settings_display()}</h2>
			<DisplaySettingsCard />
			<p class="hidden lg:block mx-1 text-xs text-surface-600-400">{m.settings_theme_sidebar_hint()}</p>
		</section>

		<div class="flex flex-col gap-2.5">
			<section aria-labelledby="settings-data" class="flex flex-col gap-2.5">
				<h2 id="settings-data" class={sectionTitle}>{m.settings_data()}</h2>
				<ProfilesDataCard />
				<p class="hidden md:block mx-1 text-xs text-surface-600-400">{m.settings_data_hint()}</p>
			</section>

			<!-- Phone and desktop: links to the About pages. Tablet: the pane has them. -->
			<section aria-labelledby="settings-about" class="flex flex-col gap-2.5 md:max-lg:hidden">
				<h2 id="settings-about" class="{sectionTitle} md:mt-2.5">{m.settings_about()}</h2>
				<SettingsLinksCard />
			</section>

			<!-- Tablet: this build, with a link to About -->
			<section aria-labelledby="settings-copy" class="hidden md:max-lg:flex flex-col gap-2.5">
				<h2 id="settings-copy" class="{sectionTitle} mt-2.5">{m.about_this_copy()}</h2>
				<div class="{card} p-4 flex items-center gap-3">
					<div class="flex-1 min-w-0">
						<p class="text-[15px] font-semibold">ZRO {APP_VERSION}</p>
						<p class="mt-0.5 text-xs text-surface-600-400">{platform} · {m.about_mit_license()}</p>
					</div>
					<a href={localizeHref('/settings/about')} class={outlineButton}>{m.settings_about()}</a>
				</div>
			</section>
		</div>
	</div>

	<section aria-labelledby="settings-danger" class="flex flex-col gap-2.5 lg:max-w-[780px]">
		<h2 id="settings-danger" class="{sectionTitle} md:mt-0 mt-2.5">{m.settings_danger_zone()}</h2>
		<ClearDataCard />
	</section>

	<p class="md:hidden mx-1 mt-2 mb-2 text-center text-xs text-surface-600-400">
		{m.settings_footer_build({ version: APP_VERSION, platform })} · {m.about_mit_license()}
	</p>
</div>
