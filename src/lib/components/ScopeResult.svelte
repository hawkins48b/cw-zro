<script>
	import { ArrowUp, ArrowDown, ArrowLeft, ArrowRight } from '@lucide/svelte';
	import { m } from '#lib/paraglide/messages.js';
	import ChipGroup from '#lib/components/ChipGroup.svelte';

	/**
	 * Result card of the Scope View (#148): filled primary, with a Dial / Hold switch.
	 * Dial: UP/DOWN and LEFT/RIGHT tiles in clicks (big) and angle (small), then flight time,
	 * energy and velocity. Hold: a slim header, then the `hold` snippet (the page passes ScopeReticle).
	 * The card computes nothing: every number comes from the page.
	 *
	 * @prop {'ok'|'no-profile'|'no-result'} status
	 * @prop {string|null} distance  - The distance as shown in the header (text), or null for a plain title.
	 * @prop {string} unitLabel      - Translated distance unit ('m', 'yd').
	 * @prop {'dial'|'hold'} mode
	 * @prop {(mode: 'dial'|'hold') => void} onmodechange
	 * @prop {string} profilesHref   - Localized link to /profiles (no-profile state).
	 * @prop {{ dir: 'up'|'down', clicks: number, value: number, unit: string } | null} elevation
	 * @prop {{ dir: 'left'|'right', clicks: number, value: number, unit: string } | null} windage
	 * @prop {number|null} flightTime - Seconds.
	 * @prop {{ value: number, unit: string } | null} energy
	 * @prop {{ value: number, unit: string } | null} velocity
	 * @prop {'metric'|'imperial'} energyUnit - J and m/s, or ft·lb and fps.
	 * @prop {(unit: 'metric'|'imperial') => void} onenergyunitchange
	 * @prop {import('svelte').Snippet} hold - Hold mode body.
	 * @prop {boolean} [both] - Tablet (#166, TabletScope board): no Dial / Hold switch; the dial tiles
	 *   and, under the card, the hold body are both shown. The stored mode is left as it is.
	 */
	let {
		status = 'ok',
		distance = null,
		unitLabel = '',
		mode = 'dial',
		onmodechange,
		profilesHref = '/profiles',
		elevation = null,
		windage = null,
		flightTime = null,
		energy = null,
		velocity = null,
		energyUnit = 'metric',
		onenergyunitchange,
		hold,
		both = false
	} = $props();

	/** The mode shown: the dial tiles when both are shown. */
	let shownMode = $derived(both ? 'dial' : mode);

	const clicksWord = (n) => (n === 1 ? m.scope_view_click() : m.scope_view_clicks());

	let title = $derived.by(() => {
		if (distance === null || distance === '') {
			return shownMode === 'hold' ? m.scope_view_result_hold_plain() : m.scope_view_result_dial_plain();
		}
		const args = { distance: String(distance), unit: unitLabel };
		return shownMode === 'hold' ? m.scope_view_result_hold_title(args) : m.scope_view_result_dial_title(args);
	});
</script>

<div class="space-y-3">
	<section
		class="card bg-primary-600 dark:bg-primary-800 text-primary-50 rounded-container p-4 space-y-3"
		aria-labelledby="scope-result-title"
	>
		<div class="flex items-center justify-between gap-2 flex-wrap">
			<h2 id="scope-result-title" class="text-sm font-medium">{title}</h2>
			{#if !both}
				<ChipGroup
					variant="on-primary"
					label={m.scope_view_result_mode()}
					options={[
						{ value: 'dial', label: m.scope_view_mode_dial() },
						{ value: 'hold', label: m.scope_view_mode_hold() }
					]}
					value={mode}
					onselect={(value) => onmodechange?.(value)}
				/>
			{/if}
		</div>

		{#if status === 'no-profile'}
			<div class="py-3 text-center space-y-3" aria-live="polite">
				<p class="text-sm">{m.scope_view_no_profile()}</p>
				<a
					href={profilesHref}
					class="btn min-h-11 bg-primary-50 text-primary-800 font-semibold focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary-50"
				>
					{m.nav_profiles()}
				</a>
			</div>
		{:else if status === 'no-result'}
			<p class="py-3 text-center text-sm font-medium" aria-live="polite">{m.scope_view_no_valid_result()}</p>
		{:else if shownMode === 'dial'}
			<div class="grid grid-cols-2 gap-2.5">
				{#each [{ data: elevation, vertical: true }, { data: windage, vertical: false }] as tile}
					{@const d = tile.data}
					<div class="rounded-base bg-primary-50/15 p-3 min-w-0">
						{#if d}
							<p class="flex items-center gap-1 text-xs font-bold tracking-wider">
								{#if d.dir === 'up'}<ArrowUp class="size-4 shrink-0" strokeWidth={2.5} aria-hidden="true" />{m.scope_view_up()}
								{:else if d.dir === 'down'}<ArrowDown class="size-4 shrink-0" strokeWidth={2.5} aria-hidden="true" />{m.scope_view_down()}
								{:else if d.dir === 'left'}<ArrowLeft class="size-4 shrink-0" strokeWidth={2.5} aria-hidden="true" />{m.scope_view_left()}
								{:else}<ArrowRight class="size-4 shrink-0" strokeWidth={2.5} aria-hidden="true" />{m.scope_view_right()}{/if}
							</p>
							<p class="mt-1 text-4xl font-extrabold leading-none tabular-nums">
								{d.clicks}
								<span class="text-sm font-medium">{clicksWord(d.clicks)}</span>
							</p>
							<p class="mt-1 text-xs opacity-85 tabular-nums">{Math.abs(d.value ?? 0)} {d.unit}</p>
						{:else}
							<p class="text-xs font-bold tracking-wider">
								{tile.vertical ? m.scope_view_elevation() : m.scope_view_windage()}
							</p>
							<p class="mt-1 text-4xl font-extrabold leading-none">—</p>
						{/if}
					</div>
				{/each}
			</div>

			<div class="flex flex-wrap items-center justify-between gap-x-3 gap-y-2">
				<p class="text-xs opacity-90 tabular-nums">
					{m.scope_view_flight_short()} {flightTime ?? '—'} {m.unit_s()}
					· {m.scope_view_energy()} {energy?.value ?? '—'} {energy?.unit ?? ''}
					· {m.scope_view_velocity_short()} {velocity?.value ?? '—'} {velocity?.unit ?? ''}
				</p>
				<ChipGroup
					variant="on-primary"
					label={m.scope_view_energy_units()}
					options={[
						{ value: 'metric', label: `${m.unit_j()} · ${m.unit_mps()}` },
						{ value: 'imperial', label: `${m.unit_ft_lb()} · ${m.unit_fps()}` }
					]}
					value={energyUnit}
					onselect={(value) => onenergyunitchange?.(value)}
				/>
			</div>
		{/if}
	</section>

	{#if (both || mode === 'hold') && status !== 'no-profile'}
		{@render hold?.()}
	{/if}
</div>
