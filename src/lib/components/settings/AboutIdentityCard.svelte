<script>
	/** About (#166): the logo card. ZRO, the tagline, "by Chocolate Warfare"; the version from 768 px. */
	import { m } from '#lib/paraglide/messages.js';
	import { APP_VERSION } from '#lib/utils/platform.js';
	import favicon from '#lib/assets/favicon.svg';
	import { card } from './settingsStyles.js';
</script>

<div class="{card} p-5 flex items-center gap-4">
	<img src={favicon} alt="" class="size-16 shrink-0" />
	<div class="flex-1 min-w-0">
		<p class="text-[28px] md:text-[30px] font-extrabold leading-none">ZRO</p>
		<p class="mt-1 text-sm text-surface-600-400">{m.app_tagline()}</p>
		<p class="mt-1 text-[13px] font-semibold text-primary-700-300">{m.about_by_cw()}</p>
	</div>
	<p class="hidden md:block self-start text-[13px] text-surface-600-400 tabular-nums">
		{m.about_version({ version: APP_VERSION })}
	</p>
</div>
