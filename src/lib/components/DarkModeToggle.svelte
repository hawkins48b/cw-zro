<script>
	/**
	 * Light / dark theme control (#149).
	 *
	 * @prop {'icon'|'segmented'} variant
	 *   icon: a 44 px icon button (phone and tablet header, tablet rail). A toggle button: its name
	 *     stays "Dark theme" and aria-pressed says whether it is on. Shows a moon in light theme and a
	 *     sun in dark theme, the theme a tap switches to.
	 *   segmented: "Theme" label with Light / Dark buttons (desktop sidebar footer).
	 *   settings: the Theme row of the Settings Display card (#166): 15 px label, 44 px Light / Dark
	 *     buttons with icons, and a hint that the device's setting applies until the user chooses.
	 */
	import { MoonIcon, SunIcon } from '@lucide/svelte';
	import { m } from '#lib/paraglide/messages.js';
	import { settings } from '#lib/stores/settings.svelte.js';

	let { variant = 'icon', class: cls = '' } = $props();

	// The sidebar and the Settings page can both show a theme group: ids must not clash.
	const uid = $props.id();
	const focusRing = 'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary-500';
</script>

{#if variant === 'settings'}
	<div class="flex flex-col gap-2 {cls}">
		<span id="{uid}-label" class="text-[15px] font-medium">{m.theme_label()}</span>
		<div
			role="group"
			aria-labelledby="{uid}-label"
			aria-describedby="{uid}-hint"
			class="grid grid-cols-2 gap-0.5 p-[3px] rounded-container bg-surface-200-800"
		>
			{#each ['light', 'dark'] as theme (theme)}
				{@const on = settings.theme === theme}
				<button
					type="button"
					class="h-11 rounded-base flex items-center justify-center gap-2 text-sm font-semibold {focusRing} {on
						? 'bg-surface-50-950 shadow-sm'
						: 'text-surface-700-300 hover:text-surface-950-50'}"
					aria-pressed={on}
					onclick={() => settings.setTheme(theme)}
				>
					{#if theme === 'dark'}
						<MoonIcon class="size-4" aria-hidden="true" />
						{m.theme_dark()}
					{:else}
						<SunIcon class="size-4" aria-hidden="true" />
						{m.theme_light()}
					{/if}
				</button>
			{/each}
		</div>
		<span id="{uid}-hint" class="text-xs text-surface-600-400">{m.settings_theme_hint()}</span>
	</div>
{:else if variant === 'segmented'}
	<div class="flex flex-col gap-2 {cls}">
		<span id="{uid}-label" class="text-xs text-surface-600-400">{m.theme_label()}</span>
		<div
			role="group"
			aria-labelledby="{uid}-label"
			class="grid grid-cols-2 gap-0.5 p-0.5 rounded-container bg-surface-200-800"
		>
			<button
				type="button"
				class="h-8 rounded-base text-sm font-semibold {focusRing} {settings.darkMode
					? 'text-surface-700-300 hover:text-surface-950-50'
					: 'bg-surface-50-950 shadow-sm'}"
				aria-pressed={!settings.darkMode}
				onclick={() => settings.setDarkMode(false)}
			>
				{m.theme_light()}
			</button>
			<button
				type="button"
				class="h-8 rounded-base text-sm font-semibold {focusRing} {settings.darkMode
					? 'bg-surface-50-950 shadow-sm'
					: 'text-surface-700-300 hover:text-surface-950-50'}"
				aria-pressed={settings.darkMode}
				onclick={() => settings.setDarkMode(true)}
			>
				{m.theme_dark()}
			</button>
		</div>
	</div>
{:else}
	<button
		type="button"
		class="btn-icon size-11 shrink-0 rounded-base hover:preset-tonal-surface {focusRing} {cls}"
		aria-label={m.theme_dark_toggle()}
		aria-pressed={settings.darkMode}
		title={m.theme_dark_toggle()}
		onclick={() => settings.toggleDarkMode()}
	>
		{#if settings.darkMode}
			<SunIcon class="size-5" aria-hidden="true" />
		{:else}
			<MoonIcon class="size-5" aria-hidden="true" />
		{/if}
	</button>
{/if}
