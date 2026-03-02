<script>
	import { m } from '$lib/paraglide/messages.js';
	import { GithubIcon, ExternalLinkIcon } from '@lucide/svelte';
	import favicon from '$lib/assets/favicon.svg';
</script>

<svelte:head>
	<title>{m.about_title()} — {m.app_name()}</title>
</svelte:head>

<div class="space-y-4">
	<!-- App Branding -->
	<div class="card p-6 flex items-center gap-5">
		<img src={favicon} alt="ZRO" class="size-16 shrink-0" />
		<div>
			<h1 class="text-3xl font-bold leading-none">ZRO</h1>
			<p class="text-surface-500 mt-1">{m.app_tagline()}</p>
		</div>
	</div>

	<!-- Description & version -->
	<div class="card p-6 space-y-2">
		<p class="text-surface-600-400">{m.about_description()}</p>
		<p class="text-sm text-surface-400-600">{m.about_version({ version: '2.0.0' })}</p>
	</div>

	<!-- Open Source -->
	<div class="card p-6 space-y-3">
		<div class="flex items-center gap-2">
			<GithubIcon class="size-5 text-primary-500" />
			<h2 class="font-semibold">{m.about_open_source()}</h2>
		</div>
		<p class="text-sm text-surface-600-400">{m.about_open_source_desc()}</p>
		<a
			href="https://github.com/hawkins48b/cw-zro"
			target="_blank"
			rel="noopener noreferrer"
			class="btn preset-tonal-primary inline-flex items-center gap-2"
			title={m.about_view_on_github()}
		>
			<GithubIcon class="size-5" />
			<span>hawkins48b/cw-zro</span>
			<ExternalLinkIcon class="size-4" />
		</a>
	</div>

	<!-- js-ballistics -->
	<div class="card p-6 space-y-3">
		<h2 class="font-semibold">{m.about_js_ballistics()}</h2>
		<p class="text-sm text-surface-600-400">{m.about_js_ballistics_desc()}</p>
		<a
			href="https://github.com/o-murphy/js-ballistics"
			target="_blank"
			rel="noopener noreferrer"
			class="btn preset-tonal-surface inline-flex items-center gap-2"
			title={m.about_view_on_github()}
		>
			<GithubIcon class="size-5" />
			<span>o-murphy/js-ballistics</span>
			<ExternalLinkIcon class="size-4" />
		</a>
	</div>
</div>
