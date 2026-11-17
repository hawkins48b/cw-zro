<script>
	import { tick } from 'svelte';
	import { Plus, Minus, Keyboard } from '@lucide/svelte';
	import { m } from '#lib/paraglide/messages.js';
	import { MAX_DISTANCE } from '#lib/utils/inputLimits.js';
	import ChipGroup from '#lib/components/ChipGroup.svelte';

	/**
	 * Target distance card of the Scope View (#148): four digit columns (1000, 100, 10, 1) with + / −
	 * per place, yd / m chips, and typed entry. Hold a + / − button to repeat. Tap the digits, or the
	 * keyboard button, to type the distance; Enter, Escape or leaving the box goes back to the digits.
	 *
	 * @prop {string}   label          - Card heading (already translated).
	 * @prop {string}   value          - Current distance as typed or stored (text).
	 * @prop {string}   unit           - Active unit: 'yd' or 'm'.
	 * @prop {string}   hint           - Optional helper text below.
	 * @prop {string}   invalid        - Error message, shown instead of the hint when not empty.
	 * @prop {Function} onchange       - Called with the new value text. Typed text is passed as typed.
	 * @prop {Function} onunitchange   - Called with 'yd' or 'm'.
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
	let unitLabel = $derived(unit === 'm' ? m.unit_m() : m.unit_yd());

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

	// A click from the keyboard (Enter, Space) has detail 0 and no pointer event before it.
	function keyboardStep(e, place, delta) {
		if (e.detail === 0) adjust(place, delta);
	}

	$effect(() => () => stopRepeat());

	// ── Typed entry ──────────────────────────────────────────────
	let editing = $state(false);
	let inputEl = $state(null);

	async function startEditing() {
		editing = true;
		await tick();
		inputEl?.focus();
		inputEl?.select();
	}

	function stopEditing() {
		editing = false;
	}

	function onInputKey(e) {
		if (e.key === 'Enter' || e.key === 'Escape') {
			e.preventDefault();
			stopEditing();
		}
	}
</script>

<section class="card preset-filled-surface-100-900 border border-surface-200-800 px-3.5 py-3 space-y-2">
	<div class="flex items-center justify-between gap-2">
		<h2 class="text-sm font-semibold">{label}</h2>
		<div class="flex items-center gap-1">
			<button
				type="button"
				class="btn-icon size-11 -my-2 flex items-center justify-center rounded-base hover:preset-tonal-surface focus-visible:outline-2 focus-visible:outline-primary-500"
				aria-label={m.scope_view_distance_type()}
				aria-pressed={editing}
				onclick={() => (editing ? stopEditing() : startEditing())}
			>
				<Keyboard class="size-4" />
			</button>
			<ChipGroup
				label={m.scope_view_distance_unit()}
				options={[{ value: 'yd', label: m.unit_yd() }, { value: 'm', label: m.unit_m() }]}
				value={unit}
				onselect={(u) => onunitchange?.(u)}
			/>
		</div>
	</div>

	<div class="grid grid-cols-4 gap-x-2 gap-y-0.5">
		<!-- + row -->
		{#each PLACES as place}
			<button
				type="button"
				class="btn preset-tonal-surface h-11 w-full flex justify-center select-none focus-visible:outline-2 focus-visible:outline-primary-500"
				aria-label={m.scope_view_distance_add({ amount: String(place), unit: unitLabel })}
				onpointerdown={() => startRepeat(place, 1)}
				onpointerup={stopRepeat}
				onpointerleave={stopRepeat}
				onpointercancel={stopRepeat}
				onclick={(e) => keyboardStep(e, place, 1)}
			>
				<Plus class="size-5" />
			</button>
		{/each}

		<!-- Digits, or the typed box -->
		{#if editing}
			<label class="col-span-4 block">
				<span class="sr-only">{label} ({unitLabel})</span>
				<input
					bind:this={inputEl}
					class="input text-center text-3xl font-extrabold tabular-nums h-14"
					type="text"
					inputmode="numeric"
					autocomplete="off"
					{value}
					aria-invalid={!!invalid}
					oninput={(e) => onchange?.(e.target.value)}
					onkeydown={onInputKey}
					onblur={stopEditing}
				/>
			</label>
		{:else}
			<button
				type="button"
				class="col-span-4 grid grid-cols-4 gap-x-2 rounded-base hover:preset-tonal-surface focus-visible:outline-2 focus-visible:outline-primary-500"
				aria-label={m.scope_view_distance_type_current({ distance: String(numValue), unit: unitLabel })}
				onclick={startEditing}
			>
				{#each digits as digit}
					<span class="text-4xl font-extrabold tabular-nums leading-tight text-center select-none" aria-hidden="true"
						>{digit}</span
					>
				{/each}
			</button>
		{/if}

		<!-- − row -->
		{#each PLACES as place}
			<button
				type="button"
				class="btn preset-tonal-surface h-11 w-full flex justify-center select-none focus-visible:outline-2 focus-visible:outline-primary-500"
				aria-label={m.scope_view_distance_subtract({ amount: String(place), unit: unitLabel })}
				onpointerdown={() => startRepeat(place, -1)}
				onpointerup={stopRepeat}
				onpointerleave={stopRepeat}
				onpointercancel={stopRepeat}
				onclick={(e) => keyboardStep(e, place, -1)}
			>
				<Minus class="size-5" />
			</button>
		{/each}
	</div>

	{#if invalid}
		<p class="text-xs text-error-500" role="alert">{invalid}</p>
	{:else if hint}
		<p class="text-xs text-surface-600-400">{hint}</p>
	{/if}
</section>
