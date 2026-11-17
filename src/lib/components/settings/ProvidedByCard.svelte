<script>
	/**
	 * About (#166): "Provided by Chocolate Warfare", "ZRO is created and maintained by Quentin
	 * Mathey", and the link to chocolate-warfare.com (new tab).
	 */
	import { m } from '#lib/paraglide/messages.js';
	import ExternalLink from './ExternalLink.svelte';
	import { focusRing } from './settingsStyles.js';

	const MAINTAINER = 'Quentin Mathey';
	const SITE = 'https://chocolate-warfare.com';
	const uid = $props.id();

	// The name in bold: the sentence is translated whole, then split around the name.
	let parts = $derived.by(() => {
		const text = m.about_maintained_by({ name: MAINTAINER });
		const at = text.indexOf(MAINTAINER);
		return at < 0 ? [text, ''] : [text.slice(0, at), text.slice(at + MAINTAINER.length)];
	});
</script>

<section aria-labelledby="{uid}-title" class="card preset-tonal-primary p-4 flex flex-col gap-2">
	<p class="text-xs font-bold tracking-wider uppercase">{m.about_provided_by()}</p>
	<h2 id="{uid}-title" class="text-[22px] font-extrabold leading-tight">Chocolate Warfare</h2>
	<p class="text-sm leading-relaxed">
		{parts[0]}<strong class="font-semibold">{MAINTAINER}</strong>{parts[1]}
	</p>
	<ExternalLink
		href={SITE}
		class="btn preset-filled-primary-500 self-start mt-1.5 h-11 px-4 gap-2 text-[15px] font-semibold {focusRing}"
	>
		chocolate-warfare.com
	</ExternalLink>
</section>
