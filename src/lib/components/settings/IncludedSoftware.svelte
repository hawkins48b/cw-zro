<script>
	/**
	 * Every package the app includes, with its licence (#166). The list comes from
	 * #lib/data/licenses.json: [{ name, version, license, platforms, homepage? }], written by
	 * scripts/licenses.js. Licences with terms beyond a permissive one (hasExtraTerms) are
	 * highlighted; a package not in every build gets a tag with its platforms ("Android · iOS").
	 *
	 * @prop {'list'|'table'} [variant] - list: one row per package (phone, tablet, Licences page);
	 *   table: Package, Version, Licence columns (desktop About).
	 */
	import { m } from '#lib/paraglide/messages.js';
	import licenses from '#lib/data/licenses.json';
	import { hasExtraTerms } from '#lib/utils/licenseKind.js';
	import ExternalLink from './ExternalLink.svelte';
	import { platformShort } from './platformText.js';
	import { card, focusRing } from './settingsStyles.js';

	let { variant = 'list', class: cls = '' } = $props();

	/** Only http(s) homepages become links. */
	function safeHomepage(url) {
		return typeof url === 'string' && /^https:\/\//i.test(url) ? url : '';
	}

	const ALL = ['web', 'android', 'ios', 'desktop'];

	/** "SEE LICENSE IN LICENSE.md" (npm's form for a licence of its own) reads "Own licence (LICENSE.md)". */
	function licenseText(license) {
		if (typeof license !== 'string' || !license.trim()) return m.licenses_unknown();
		const own = /^SEE LICEN[CS]E IN (.+)$/i.exec(license.trim());
		return own ? m.licenses_own({ file: own[1] }) : license;
	}

	/** The platforms of a package not in every build, else ''. */
	function platformTag(platforms) {
		if (!Array.isArray(platforms) || ALL.every((pl) => platforms.includes(pl))) return '';
		return ALL.filter((pl) => platforms.includes(pl)).map(platformShort).join(' · ');
	}

	const packages = (Array.isArray(licenses) ? licenses : [])
		.filter((p) => p && typeof p.name === 'string')
		.map((p) => ({
			key: `${p.name}@${p.version}`,
			name: p.name,
			version: typeof p.version === 'string' ? p.version : '',
			license: licenseText(p.license),
			homepage: safeHomepage(p.homepage),
			extra: hasExtraTerms(p.license),
			only: platformTag(p.platforms)
		}));

	const nameLink = `inline-flex items-center gap-1 rounded-sm font-semibold underline-offset-2 hover:underline hover:text-primary-700-300 ${focusRing}`;
</script>

{#snippet name(p)}
	{#if p.homepage}
		<ExternalLink href={p.homepage} class={nameLink}>{p.name}</ExternalLink>
	{:else}
		<span class="font-semibold">{p.name}</span>
	{/if}
{/snippet}

{#snippet only(p)}
	{#if p.only}
		<span class="inline-block ml-1 px-1.5 py-px rounded-base border border-surface-300-700 text-[10px] font-semibold text-surface-600-400 align-middle">
			<span class="sr-only">{m.licenses_only_in()}</span>
			{p.only}
		</span>
	{/if}
{/snippet}

{#snippet badge(p)}
	<span
		class="inline-block max-w-full px-2 py-0.5 rounded-full text-[11px] font-semibold break-words {p.extra
			? 'preset-tonal-warning'
			: 'preset-tonal-surface'}"
	>
		{p.license}
	</span>
{/snippet}

{#if packages.length === 0}
	<p class="{card} p-4 text-sm text-surface-600-400 {cls}">{m.licenses_list_empty()}</p>
{:else if variant === 'table'}
	<div class="{card} overflow-x-auto {cls}">
		<table class="w-full text-sm">
			<caption class="sr-only">{m.licenses_included()}</caption>
			<thead>
				<tr class="text-left text-xs font-bold tracking-wide uppercase text-surface-600-400 border-b border-surface-200-800">
					<th scope="col" class="px-4 py-2.5">{m.licenses_col_package()}</th>
					<th scope="col" class="px-4 py-2.5">{m.licenses_col_version()}</th>
					<th scope="col" class="px-4 py-2.5">{m.licenses_col_license()}</th>
				</tr>
			</thead>
			<tbody>
				{#each packages as p (p.key)}
					<tr class="border-t border-surface-200-800 first:border-t-0 {p.extra ? 'bg-warning-50-950/60' : ''}">
						<th scope="row" class="px-4 py-2.5 text-left font-normal">{@render name(p)}{@render only(p)}</th>
						<td class="px-4 py-2.5 tabular-nums text-surface-600-400">{p.version}</td>
						<td class="px-4 py-2.5">{@render badge(p)}</td>
					</tr>
				{/each}
			</tbody>
		</table>
	</div>
{:else}
	<ul class="{card} overflow-hidden {cls}">
		{#each packages as p, i (p.key)}
			<li class="flex items-center gap-3 min-h-12 px-4 py-2.5 {i > 0 ? 'border-t border-surface-200-800' : ''}">
				<p class="flex-1 min-w-0 text-sm break-words">
					{@render name(p)}
					<span class="ml-1 text-xs text-surface-600-400 tabular-nums">{p.version}</span>
					{@render only(p)}
				</p>
				<span class="shrink-0 max-w-[45%] text-right">{@render badge(p)}</span>
			</li>
		{/each}
	</ul>
{/if}
