<script>
	import { MoonIcon, SunIcon } from '@lucide/svelte';
	import { Switch } from '@skeletonlabs/skeleton-svelte';
	import { m } from '$lib/paraglide/messages.js';
	import { settings } from '$lib/stores/settings.svelte.js';
</script>

<Switch
	checked={settings.darkMode}
	onCheckedChange={() => settings.toggleDarkMode()}
>
	<Switch.Control>
		<Switch.Thumb>
			<Switch.Context>
				{#snippet children(ctx)}
					{#if ctx().checked}
						<MoonIcon class="size-3" />
					{:else}
						<SunIcon class="size-3" />
					{/if}
				{/snippet}
			</Switch.Context>
		</Switch.Thumb>
	</Switch.Control>
	<Switch.Label class="hidden lg:inline">{m.settings_dark_mode()}</Switch.Label>
	<Switch.HiddenInput />
</Switch>
