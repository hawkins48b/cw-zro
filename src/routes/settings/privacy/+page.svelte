<script>
	/**
	 * Privacy (#166): a summary card, what is stored on the device, the facts of the optional current
	 * weather (#152, #154), profile files, and what happens outside the app. Every statement follows
	 * docs/data-and-privacy.md: change both together.
	 */
	import { m } from '#lib/paraglide/messages.js';
	import { ShieldCheckIcon, CloudSunIcon, FileJsonIcon, ServerIcon, WifiOffIcon, SmartphoneIcon } from '@lucide/svelte';
	import { card, sectionTitle } from '#lib/components/settings/settingsStyles.js';

	const stored = [
		m.privacy_storage_profiles(),
		m.privacy_storage_inputs(),
		m.privacy_storage_dark_mode(),
		m.privacy_storage_language()
	];

	const weather = [
		[m.privacy_weather_when_label(), m.privacy_weather_when()],
		[m.privacy_weather_sent_label(), m.privacy_weather_sent()],
		[m.privacy_weather_to_label(), m.privacy_weather_to()],
		[m.privacy_weather_back_label(), m.privacy_weather_back()],
		[m.privacy_weather_kept_label(), m.privacy_weather_kept()]
	];

	const outside = [
		{ icon: ServerIcon, title: m.privacy_web_title(), desc: m.privacy_web_desc() },
		{ icon: WifiOffIcon, title: m.privacy_offline_title(), desc: m.privacy_offline_desc() },
		{ icon: SmartphoneIcon, title: m.privacy_store_title(), desc: m.privacy_store_desc() }
	];
</script>

<svelte:head>
	<title>{m.privacy_title()} — {m.app_name()}</title>
</svelte:head>

<div class="flex flex-col gap-3 sm:gap-4 lg:gap-5">
	<h1 class="sr-only md:not-sr-only text-xl lg:text-[28px] font-bold tracking-tight">{m.privacy_title()}</h1>

	<!-- Summary -->
	<div class="card preset-tonal-primary p-4 flex items-start gap-3">
		<ShieldCheckIcon class="size-6 shrink-0 mt-0.5" aria-hidden="true" />
		<div class="min-w-0">
			<p class="text-base font-bold">{m.privacy_summary_title()}</p>
			<p class="mt-1 text-[13px] leading-relaxed">{m.privacy_summary_desc()}</p>
		</div>
	</div>

	<div class="grid gap-2.5 lg:grid-cols-2 lg:gap-6 lg:items-start">
		<div class="flex flex-col gap-2.5">
			<!-- Stored on this device -->
			<section aria-labelledby="privacy-stored" class="flex flex-col gap-2.5">
				<h2 id="privacy-stored" class="{sectionTitle}">{m.privacy_storage_title()}</h2>
				<div class="{card} overflow-hidden">
					<ul>
						{#each stored as item, i (item)}
							<li class="flex items-start gap-3 px-4 py-3 text-sm leading-snug {i > 0 ? 'border-t border-surface-200-800' : ''}">
								<span class="mt-[7px] size-1.5 shrink-0 rounded-full bg-primary-600-400" aria-hidden="true"></span>
								{item}
							</li>
						{/each}
					</ul>
					<p class="px-4 py-3 border-t border-surface-200-800 bg-surface-200-800/50 text-xs leading-relaxed text-surface-600-400">
						{m.privacy_storage_keep_short()}
					</p>
				</div>
			</section>

			<!-- Profile files: export and import stay on the device -->
			<div class="{card} p-4 flex items-start gap-3">
				<FileJsonIcon class="size-5 shrink-0 mt-0.5 text-primary-700-300" aria-hidden="true" />
				<div class="min-w-0">
					<h2 class="text-[15px] font-semibold">{m.privacy_files_title()}</h2>
					<p class="mt-1 text-[13px] leading-relaxed text-surface-600-400">{m.privacy_files_desc()}</p>
				</div>
			</div>
		</div>

		<!-- Current weather, only on a tap (#152, #154; docs/data-and-privacy.md, What leaves the device) -->
		<section aria-labelledby="privacy-weather" class="flex flex-col gap-2.5">
			<h2 class="{sectionTitle} max-lg:mt-2.5">{m.privacy_sent_on_request()}</h2>
			<div class="{card} overflow-hidden">
				<div class="flex items-center gap-2.5 px-4 pt-3.5 pb-2.5">
					<CloudSunIcon class="size-5 shrink-0 text-primary-700-300" aria-hidden="true" />
					<h3 id="privacy-weather" class="text-[15px] font-semibold">{m.privacy_weather_title()}</h3>
				</div>
				<dl>
					{#each weather as [term, value], i (term)}
						<div class="grid grid-cols-[76px_minmax(0,1fr)] gap-3 px-4 py-2.5 text-[13px] leading-relaxed border-t border-surface-200-800">
							<dt class="font-semibold">{term}</dt>
							<dd class="text-surface-600-400">{value}</dd>
						</div>
					{/each}
				</dl>
			</div>
		</section>
	</div>

	<!-- Outside the app -->
	<section aria-labelledby="privacy-outside" class="flex flex-col gap-2.5">
		<h2 id="privacy-outside" class="{sectionTitle} max-md:mt-2.5">{m.privacy_outside()}</h2>
		<div class="{card} overflow-hidden grid lg:grid-cols-3">
			{#each outside as item, i (item.title)}
				{@const Icon = item.icon}
				<div
					class="flex items-start gap-3 p-4 {i > 0
						? 'border-t lg:border-t-0 lg:border-l border-surface-200-800'
						: ''}"
				>
					<Icon class="size-5 shrink-0 mt-0.5 text-primary-700-300" aria-hidden="true" />
					<div class="min-w-0">
						<h3 class="text-[15px] font-semibold">{item.title}</h3>
						<p class="mt-1 text-[13px] leading-relaxed text-surface-600-400">{item.desc}</p>
					</div>
				</div>
			{/each}
		</div>
	</section>
</div>
