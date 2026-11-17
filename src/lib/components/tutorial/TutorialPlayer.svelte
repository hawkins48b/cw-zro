<script>
	/**
	 * Tutorial player panel of the 3D ballistic tutorial (#182). Two states:
	 * - no tutorial running (`current` null): the list of tutorials, each a button that starts it;
	 * - a tutorial running: its title, "Step n of N", a progress bar, the step title and text, and
	 *   Back / Next (Finish on the last step), and Exit (the X in its header).
	 * The panel moves nothing itself: the page runs the camera move, the highlight and the overlay
	 * of each step, and passes the step's text, already translated.
	 *
	 * @prop {Array<{ id: string, title: string, description: string, stepCount: number }>} tutorials
	 *   Already translated.
	 * @prop {{ title: string, index: number, count: number, stepTitle: string, text: string } | null} current
	 *   The running tutorial: index from 0, count = number of steps. text may hold line breaks
	 *   (\n\n starts a new paragraph).
	 * @prop {(id: string) => void} onstart
	 * @prop {() => void} onnext  - On the last step it means Finish.
	 * @prop {() => void} onback
	 * @prop {() => void} onexit
	 * @prop {boolean} [disabled] - The scene is not ready: the start buttons are disabled.
	 */
	import { m } from '#lib/paraglide/messages.js';
	import { ChevronLeft, ChevronRight, GraduationCap, X } from '@lucide/svelte';

	let { tutorials = [], current = null, onstart, onnext, onback, onexit, disabled = false } = $props();

	const uid = $props.id();
	const focusRing = 'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary-500';

	let isLast = $derived(!!current && current.index >= current.count - 1);
	let paragraphs = $derived(current ? current.text.split(/\n\s*\n/).filter(Boolean) : []);
	let progress = $derived(current && current.count > 0 ? ((current.index + 1) / current.count) * 100 : 0);
</script>

<section
	class="card preset-filled-surface-100-900 border border-surface-200-800 min-w-0 {current ? 'border-primary-500' : ''}"
	aria-labelledby="{uid}-title"
>
	{#if !current}
		<div class="px-3.5 py-3 space-y-2.5">
			<div class="space-y-1">
				<h2 id="{uid}-title" class="text-sm font-semibold">{m.tutorial_player_title()}</h2>
				<p class="text-xs leading-snug text-surface-600-400">{m.tutorial_player_intro()}</p>
			</div>
			{#if tutorials.length === 0}
				<p class="py-4 text-center text-sm text-surface-600-400">{m.tutorial_player_empty()}</p>
			{:else}
				<ul class="flex flex-col gap-1.5">
					{#each tutorials as t (t.id)}
						<li>
							<button
								type="button"
								class="w-full flex items-center gap-3 px-3 py-2.5 min-h-12 text-left rounded-base border border-surface-200-800 hover:border-primary-500 disabled:opacity-50 disabled:hover:border-surface-200-800 {focusRing}"
								{disabled}
								onclick={() => onstart?.(t.id)}
							>
								<span class="shrink-0 size-9 rounded-base flex items-center justify-center preset-tonal-primary">
									<GraduationCap class="size-[18px]" aria-hidden="true" />
								</span>
								<span class="flex-1 min-w-0">
									<span class="block text-sm font-semibold">{t.title}</span>
									<span class="block text-xs leading-snug text-surface-600-400">{t.description}</span>
									<span class="block mt-0.5 text-[11px] text-surface-600-400">{m.tutorial_steps_count({ count: String(t.stepCount) })}</span>
								</span>
								<ChevronRight class="size-[18px] shrink-0 text-surface-600-400" aria-hidden="true" />
							</button>
						</li>
					{/each}
				</ul>
			{/if}
		</div>
	{:else}
		<div class="flex items-start gap-2 pl-3.5 pr-1.5 pt-2">
			<div class="flex-1 min-w-0 pt-1.5">
				<h2 id="{uid}-title" class="text-xs font-bold tracking-wider uppercase text-primary-700-300 truncate">{current.title}</h2>
				<p class="text-xs text-surface-600-400">
					{m.tutorial_step_of({ current: String(current.index + 1), total: String(current.count) })}
				</p>
			</div>
			<button
				type="button"
				class="btn-icon size-11 shrink-0 rounded-base hover:preset-tonal-surface {focusRing}"
				aria-label={m.tutorial_exit_label()}
				title={m.tutorial_exit_label()}
				onclick={() => onexit?.()}
			>
				<X class="size-5" aria-hidden="true" />
			</button>
		</div>
		<div class="mx-3.5 mt-1.5 h-1 rounded-full bg-surface-200-800 overflow-hidden" aria-hidden="true">
			<div class="h-full bg-primary-500 transition-[width]" style="width: {progress}%"></div>
		</div>

		<!-- The step: read out when it changes -->
		<div class="px-3.5 pt-3 pb-1 space-y-1.5" aria-live="polite">
			<h3 class="text-[15px] font-semibold">{current.stepTitle}</h3>
			{#each paragraphs as p, i (i)}
				<p class="text-sm leading-relaxed text-surface-700-300">{p}</p>
			{/each}
		</div>

		<div class="flex items-center justify-between gap-2 px-3.5 py-3">
			<button
				type="button"
				class="btn h-11 px-3 border border-surface-300-700 hover:preset-tonal-surface font-medium {focusRing}"
				disabled={current.index === 0}
				onclick={() => onback?.()}
			>
				<ChevronLeft class="size-4" aria-hidden="true" />
				{m.common_back()}
			</button>
			<button
				type="button"
				class="btn h-11 px-4 preset-filled-primary-500 font-semibold {focusRing}"
				onclick={() => onnext?.()}
			>
				{isLast ? m.tutorial_finish() : m.tutorial_next()}
				{#if !isLast}<ChevronRight class="size-4" aria-hidden="true" />{/if}
			</button>
		</div>
	{/if}
</section>
