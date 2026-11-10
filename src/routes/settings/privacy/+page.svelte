<script>
	import { m } from '#lib/paraglide/messages.js';
	import {
		HardDriveIcon,
		ServerIcon,
		ShieldCheckIcon,
		SmartphoneIcon,
		WifiOffIcon
	} from '@lucide/svelte';
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

	<!-- Stored on the device (docs/data-and-privacy.md, What is stored) -->
	<div class="card p-6 space-y-3">
		<div class="flex items-center gap-2">
			<HardDriveIcon class="size-5 text-primary-500" />
			<h2 class="font-semibold">{m.privacy_storage_title()}</h2>
		</div>
		<p class="text-sm text-surface-600-400">{m.privacy_storage_desc()}</p>
		<ul class="list-disc pl-5 text-sm text-surface-600-400 space-y-1">
			<li>{m.privacy_storage_profiles()}</li>
			<li>{m.privacy_storage_inputs()}</li>
			<li>{m.privacy_storage_dark_mode()}</li>
			<li>{m.privacy_storage_language()}</li>
		</ul>
		<p class="text-sm text-surface-600-400">{m.privacy_storage_keep()}</p>
	</div>

	<!-- Web host -->
	<div class="card p-6 space-y-3">
		<div class="flex items-center gap-2">
			<ServerIcon class="size-5 text-primary-500" />
			<h2 class="font-semibold">{m.privacy_web_title()}</h2>
		</div>
		<p class="text-sm text-surface-600-400">{m.privacy_web_desc()}</p>
	</div>

	<!-- Offline use -->
	<div class="card p-6 space-y-3">
		<div class="flex items-center gap-2">
			<WifiOffIcon class="size-5 text-primary-500" />
			<h2 class="font-semibold">{m.privacy_offline_title()}</h2>
		</div>
		<p class="text-sm text-surface-600-400">{m.privacy_offline_desc()}</p>
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
