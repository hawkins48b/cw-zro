<script>
	/**
	 * About (#166): the calculation engine, js-ballistics (ISC) and the bclibc solver it embeds
	 * (LGPL-3.0, #77), with their source links. Phone: a row per library and a link to Licences;
	 * from 768 px one paragraph and two link buttons.
	 *
	 * Versions and licences come from #lib/data/licenses.json, the list of the Licences page.
	 */
	import { ChevronRightIcon, ScaleIcon } from '@lucide/svelte';
	import { m } from '#lib/paraglide/messages.js';
	import { localizeHref } from '#lib/paraglide/runtime.js';
	import GithubIcon from '#lib/components/GithubIcon.svelte';
	import ExternalLink from './ExternalLink.svelte';
	import licenses from '#lib/data/licenses.json';
	import { hasExtraTerms } from '#lib/utils/licenseKind.js';
	import { card, focusRing, linkRow, rowIcon, sectionTitle } from './settingsStyles.js';

	/** Version and licence of a package in the list ('' when it is missing). */
	function listed(name) {
		const p = Array.isArray(licenses) ? licenses.find((x) => x?.name === name) : null;
		const version = typeof p?.version === 'string' ? p.version : '';
		const license = typeof p?.license === 'string' ? p.license : '';
		return { version, license, strong: hasExtraTerms(license) };
	}

	const JS_BALLISTICS = { ...listed('js-ballistics'), href: 'https://github.com/o-murphy/js-ballistics', repo: 'o-murphy/js-ballistics' };
	// The source of the exact version shipped (static/licenses/THIRD-PARTY-NOTICES.txt links the same tag).
	const BCLIBC = { ...listed('bclibc'), repo: 'ballistics-lab/bclibc' };
	BCLIBC.href = `https://github.com/ballistics-lab/bclibc${BCLIBC.version ? `/tree/v${BCLIBC.version}` : ''}`;

	const libraries = [
		{ name: 'js-ballistics', ...JS_BALLISTICS, desc: m.about_engine_js_desc() },
		{ name: 'bclibc', ...BCLIBC, desc: m.about_engine_bclibc_desc() }
	];

	const textLink = `inline-flex items-center gap-1.5 min-h-11 -my-2 self-start rounded-base text-sm font-semibold text-primary-700-300 underline-offset-2 hover:underline ${focusRing}`;
	const outlineLink = `btn preset-outlined-surface-300-700 hover:preset-tonal-surface h-11 px-3.5 gap-2 text-sm font-semibold ${focusRing}`;
</script>

<section class="flex flex-col gap-2.5">
	<h2 class="{sectionTitle} md:hidden">{m.about_engine_title()}</h2>

	<!-- Phone -->
	<div class="{card} md:hidden overflow-hidden flex flex-col">
		{#each libraries as lib, i (lib.name)}
			<div class="p-4 flex flex-col gap-1.5 {i > 0 ? 'border-t border-surface-200-800' : ''}">
				<p class="flex flex-wrap items-center gap-2 text-[15px] font-semibold">
					<span>{lib.name} <span class="tabular-nums">{lib.version}</span></span>
					{#if lib.license}<span
						class="px-2 py-0.5 rounded-full text-[11px] font-semibold {lib.strong
							? 'preset-tonal-warning'
							: 'preset-tonal-surface'}">{lib.license}</span
					>{/if}
				</p>
				<p class="text-[13px] leading-relaxed text-surface-600-400">{lib.desc}</p>
				<ExternalLink href={lib.href} class={textLink}>
					{#snippet icon()}<GithubIcon class="size-4 shrink-0" />{/snippet}
					{lib.repo}
				</ExternalLink>
			</div>
		{/each}
		<a href={localizeHref('/settings/about/licenses')} class="{linkRow} border-t border-surface-200-800">
			<ScaleIcon class={rowIcon} aria-hidden="true" />
			<span class="flex-1 min-w-0">
				<span class="block text-[15px] font-medium">{m.licenses_title()}</span>
				<span class="block mt-0.5 text-xs text-surface-600-400">{m.about_licenses_desc()}</span>
			</span>
			<ChevronRightIcon class="size-[18px] shrink-0 text-surface-600-400" aria-hidden="true" />
		</a>
	</div>

	<!-- Tablet and desktop -->
	<div class="{card} hidden md:flex p-4 flex-col gap-2.5">
		<h2 class="text-[15px] font-semibold">{m.about_engine_title()}</h2>
		<p class="text-[13px] leading-relaxed text-surface-600-400">
			{m.about_engine_summary({
				jsVersion: JS_BALLISTICS.version,
				jsLicense: JS_BALLISTICS.license,
				bclibcVersion: BCLIBC.version,
				bclibcLicense: BCLIBC.license
			})}
		</p>
		<div class="flex flex-wrap gap-2">
			{#each libraries as lib (lib.name)}
				<ExternalLink href={lib.href} class={outlineLink}>
					{#snippet icon()}<GithubIcon class="size-4 shrink-0" />{/snippet}
					{lib.repo}
				</ExternalLink>
			{/each}
		</div>
	</div>
</section>
