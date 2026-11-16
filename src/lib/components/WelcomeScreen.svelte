<script>
	/**
	 * First-run Welcome screen (#150). Full screen: the layout shows no navigation on /welcome.
	 *
	 * @prop {Function} onSetup()  - "Set up my rifle": start the guided setup.
	 * @prop {Function} onSample() - "Try it with a sample profile".
	 */
	import { m } from '#lib/paraglide/messages.js';
	import { ShieldCheck } from '@lucide/svelte';
	import LanguageSwitcher from '#lib/components/LanguageSwitcher.svelte';

	let { onSetup, onSample } = $props();

	const steps = [
		{ titleKey: 'welcome_step_rifle_title', textKey: 'welcome_step_rifle_text' },
		{ titleKey: 'welcome_step_ammo_title', textKey: 'welcome_step_ammo_text' },
		{ titleKey: 'welcome_step_velocity_title', textKey: 'welcome_step_velocity_text' }
	];

	const focusRing = 'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary-500';
</script>

<div class="h-full overflow-y-auto">
	<div
		class="mx-auto w-full max-w-md min-h-full flex flex-col px-5 pt-8 pb-5 sm:justify-center sm:py-12"
		style="padding-left: max(1.25rem, var(--safe-area-left)); padding-right: max(1.25rem, var(--safe-area-right));"
	>
		<!-- Brand -->
		<div class="flex items-center gap-3">
			<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512" class="size-12 shrink-0" aria-hidden="true">
				<circle cx="256" cy="256" r="240" fill="#097A34" />
				<path
					d="M 148 148 L 364 148 L 364 188 L 218 324 L 364 324 L 364 364 L 148 364 L 148 324 L 294 188 L 148 188 Z"
					fill="#FFFFFF"
				/>
			</svg>
			<p class="leading-tight">
				<span class="block text-sm text-surface-600-400">{m.welcome_to()}</span>
				<span class="block font-bold">{m.app_name()}</span>
			</p>
		</div>

		<h1 class="mt-8 text-[28px] leading-tight font-extrabold tracking-tight">{m.welcome_title()}</h1>
		<p class="mt-3 text-[15px] leading-relaxed text-surface-600-400">{m.welcome_intro()}</p>

		<!-- What the setup asks for -->
		<ol class="mt-6 flex flex-col gap-2.5">
			{#each steps as step, i (step.titleKey)}
				<li
					class="card preset-filled-surface-100-900 border border-surface-200-800 p-3.5 flex items-start gap-3"
				>
					<span
						class="size-8 shrink-0 rounded-full preset-tonal-primary flex items-center justify-center text-sm font-bold"
						aria-hidden="true"
					>
						{i + 1}
					</span>
					<div class="min-w-0 pt-0.5">
						<p class="text-[15px] font-semibold">{m[step.titleKey]()}</p>
						<p class="mt-0.5 text-[13px] leading-snug text-surface-600-400">{m[step.textKey]()}</p>
					</div>
				</li>
			{/each}
		</ol>

		<!-- Pushes the actions to the bottom on phones -->
		<div class="flex-1 min-h-8 sm:flex-none sm:h-10"></div>

		<div class="flex flex-col gap-2.5">
			<button
				type="button"
				class="btn preset-filled-primary-500 w-full h-[52px] text-base font-semibold {focusRing}"
				onclick={() => onSetup?.()}
			>
				{m.welcome_setup()}
			</button>
			<button
				type="button"
				class="btn preset-outlined-surface-300-700 hover:preset-tonal-surface w-full h-12 text-[15px] font-semibold {focusRing}"
				onclick={() => onSample?.()}
			>
				{m.welcome_sample()}
			</button>
		</div>

		<!-- Privacy note and language -->
		<div class="mt-5 flex flex-wrap items-center justify-between gap-x-3 gap-y-2">
			<p class="flex items-center gap-1.5 text-xs text-surface-600-400">
				<ShieldCheck class="size-4 shrink-0" aria-hidden="true" />
				{m.welcome_privacy()}
			</p>
			<LanguageSwitcher variant="chips" />
		</div>
	</div>
</div>
