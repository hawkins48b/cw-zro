<script>
	/**
	 * Settings, Display (#166): Theme (Light / Dark) and Language (EN / FR / DE) in one card.
	 * The theme buttons are DarkModeToggle's, the language links LanguageSwitcher's.
	 */
	import DarkModeToggle from '#lib/components/DarkModeToggle.svelte';
	import LanguageSwitcher from '#lib/components/LanguageSwitcher.svelte';
	import { card } from './settingsStyles.js';
</script>

<div class="{card} px-4 py-3.5 flex flex-col gap-3.5">
	<DarkModeToggle variant="settings" />
	<div class="h-px bg-surface-200-800" aria-hidden="true"></div>
	<LanguageSwitcher variant="settings" />
</div>
