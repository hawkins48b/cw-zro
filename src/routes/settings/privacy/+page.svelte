<script>
	import { m } from '$lib/paraglide/messages.js';
	import { ShieldCheckIcon, SmartphoneIcon } from '@lucide/svelte';
</script>

<svelte:head>
	<title>{m.privacy_title()} — {m.app_name()}</title>
</svelte:head>

<div class="space-y-4">
	<!-- No data collection -->
	<div class="card p-6 space-y-3">
		<div class="flex items-center gap-2">
			<ShieldCheckIcon class="size-5 text-success-500" />
			<h2 class="font-semibold">{m.privacy_no_data_title()}</h2>
		</div>
		<p class="text-sm text-surface-600-400">{m.privacy_no_data_desc()}</p>
	</div>

	<!-- App store analytics -->
	<div class="card p-6 space-y-3">
		<div class="flex items-center gap-2">
			<SmartphoneIcon class="size-5 text-warning-500" />
			<h2 class="font-semibold">{m.privacy_store_title()}</h2>
		</div>
		<p class="text-sm text-surface-600-400">{m.privacy_store_desc()}</p>
	</div>
</div>
