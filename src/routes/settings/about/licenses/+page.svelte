<script>
	import { m } from '#lib/paraglide/messages.js';
	// The same files every build ships under /licenses/ (#77). They are shown here, not linked,
	// so that the Electron window, which has no back button, never leaves the app.
	import notice from '../../../../../static/licenses/THIRD-PARTY-NOTICES.txt?raw';
	import lgpl from '../../../../../static/licenses/LGPL-3.0.txt?raw';
	import gpl from '../../../../../static/licenses/GPL-3.0.txt?raw';

	const texts = [
		{ title: m.licenses_notice_title(), text: notice },
		{ title: m.licenses_lgpl_title(), text: lgpl },
		{ title: m.licenses_gpl_title(), text: gpl }
	];
</script>

<svelte:head>
	<title>{m.licenses_title()} — {m.app_name()}</title>
</svelte:head>

<div class="space-y-4">
	<div class="card p-6 space-y-2">
		<h1 class="font-semibold">{m.licenses_title()}</h1>
		<p class="text-sm text-surface-600-400">{m.licenses_intro()}</p>
	</div>

	{#each texts as { title, text } (title)}
		<details class="card p-6">
			<summary class="font-semibold cursor-pointer">{title}</summary>
			<pre class="mt-3 text-xs whitespace-pre-wrap break-words text-surface-600-400">{text}</pre>
		</details>
	{/each}
</div>
