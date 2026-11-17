<script>
	/**
	 * About (#166): ZRO is open source (MIT), with the GitHub link. Phone: "Open source" above the
	 * card; from 768 px the card has its own title "Open source, MIT License".
	 */
	import { m } from '#lib/paraglide/messages.js';
	import GithubIcon from '#lib/components/GithubIcon.svelte';
	import ExternalLink from './ExternalLink.svelte';
	import { card, focusRing, sectionTitle } from './settingsStyles.js';
</script>

<section class="flex flex-col gap-2.5">
	<h2 class="{sectionTitle} md:hidden">{m.about_open_source()}</h2>
	<div class="{card} p-4 flex flex-col gap-2.5">
		<h2 class="hidden md:block text-[15px] font-semibold">{m.about_open_source_mit()}</h2>
		<p class="text-sm md:text-[13px] text-surface-600-400">{m.about_open_source_desc()}</p>
		<ExternalLink
			href="https://github.com/hawkins48b/cw-zro"
			class="btn preset-tonal-primary self-start h-11 px-4 gap-2 text-sm font-semibold {focusRing}"
		>
			{#snippet icon()}<GithubIcon class="size-5 shrink-0" />{/snippet}
			hawkins48b/cw-zro
		</ExternalLink>
	</div>
</section>
