<script>
	import { Plus, Minus } from '@lucide/svelte';
	import { m } from '#lib/paraglide/messages.js';
	import { MAX_DISTANCE } from '#lib/utils/inputLimits.js';

	/**
	 * Mobile-optimised 4-digit distance input.
	 * Each column (1000s, 100s, 10s, 1s) has + / − buttons to adjust
	 * that place value. Hold a button to repeat continuously.
	 *
	 * @prop {string}   label          - Field label (already translated).
	 * @prop {string}   value          - Current distance as a numeric string.
	 * @prop {string}   unit           - Active unit: 'yd' or 'm'.
	 * @prop {string}   hint           - Optional helper text below.
	 * @prop {string}   invalid        - Error message, shown instead of the hint when not empty.
	 * @prop {Function} onchange       - Called with new value string when value changes.
	 * @prop {Function} onunitchange   - Called with new unit string when unit changes.
	 */
	let { label = '', value = '500', unit = 'yd', hint = null, invalid = '', onchange, onunitchange } = $props();

	const PLACES = [1000, 100, 10, 1];
	const MIN = 1;
	// The buttons stop at the longest range the calculators take (MAX_DISTANCE, #93).
	const MAX = MAX_DISTANCE;
	// The digits show a stored value as it is, up to what four digits hold, so that an old range
	// above MAX (the box used to allow 9999) is not shown as MAX. The page shows its message.
	const SHOWN_MAX = 9999;

	let numValue = $derived(Math.max(MIN, Math.min(SHOWN_MAX, parseInt(value) || MIN)));
	let digits = $derived(PLACES.map((place) => Math.floor((numValue % (place * 10)) / place)));

	function adjust(place, delta) {
		const next = Math.max(MIN, Math.min(MAX, (parseInt(value) || 0) + delta * place));
		onchange?.(String(next));
	}

	// Long-press: one immediate step, then rapid repeat after 350 ms
	let repeatTimeout = null;
	let repeatInterval = null;

	function startRepeat(place, delta) {
		adjust(place, delta);
		repeatTimeout = setTimeout(() => {
			repeatInterval = setInterval(() => adjust(place, delta), 80);
		}, 350);
	}

	function stopRepeat() {
		clearTimeout(repeatTimeout);
		clearInterval(repeatInterval);
		repeatTimeout = null;
		repeatInterval = null;
	}

	$effect(() => () => stopRepeat());
</script>

<div class="space-y-2">
	<!-- Label + unit toggle row -->
	<div class="flex items-center justify-between">
		{#if label}
			<span class="text-sm font-medium">{label}</span>
		{/if}
		<div class="flex items-center gap-1">
			{#each [{ value: 'yd', label: m.unit_yd() }, { value: 'm', label: m.unit_m() }] as opt}
				<button
					type="button"
					class="chip text-xs {unit === opt.value
						? 'preset-filled-primary-500'
						: 'preset-tonal-surface'}"
					onclick={() => onunitchange?.(opt.value)}
				>
					{opt.label}
				</button>
			{/each}
		</div>
	</div>

	<!-- 4-digit columns -->
	<div class="grid grid-cols-4 gap-2">
		{#each PLACES as place, i}
			<div class="flex flex-col items-center gap-1">
				<!-- + button -->
				<button
					type="button"
					class="btn preset-tonal-surface w-full py-3 flex justify-center"
					title={m.scope_view_distance_increase()}
					onpointerdown={() => startRepeat(place, 1)}
					onpointerup={stopRepeat}
					onpointerleave={stopRepeat}
					onpointercancel={stopRepeat}
				>
					<Plus class="size-5" />
				</button>

				<!-- digit display -->
				<span class="text-4xl font-bold tabular-nums leading-tight select-none"
					>{digits[i]}</span
				>

				<!-- − button -->
				<button
					type="button"
					class="btn preset-tonal-surface w-full py-3 flex justify-center"
					title={m.scope_view_distance_decrease()}
					onpointerdown={() => startRepeat(place, -1)}
					onpointerup={stopRepeat}
					onpointerleave={stopRepeat}
					onpointercancel={stopRepeat}
				>
					<Minus class="size-5" />
				</button>
			</div>
		{/each}
	</div>

	{#if invalid}
		<p class="text-xs text-error-500" role="alert">{invalid}</p>
	{:else if hint}
		<p class="text-xs text-surface-600-400">{hint}</p>
	{/if}
</div>
