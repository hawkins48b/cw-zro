<script>
	import { m } from '$lib/paraglide/messages.js';
	import { Wind } from '@lucide/svelte';

	let { speed, speedUnit, direction, onchange } = $props();

	// Direction is always in degrees (0–360, 0 = 12 o'clock / downrange, clockwise)
	let dirDeg = $derived(((parseFloat(direction) || 0) % 360 + 360) % 360);

	let dialEl = $state(null);
	let dragging = $state(false);

	function angleFromPointer(clientX, clientY) {
		const rect = dialEl.getBoundingClientRect();
		const cx = rect.left + rect.width / 2;
		const cy = rect.top + rect.height / 2;
		const dx = clientX - cx;
		const dy = clientY - cy;
		let angle = Math.atan2(dx, -dy) * (180 / Math.PI);
		if (angle < 0) angle += 360;
		return angle;
	}

	function onPointerDown(e) {
		dragging = true;
		dialEl.setPointerCapture(e.pointerId);
		onchange({ direction: String(Math.round(angleFromPointer(e.clientX, e.clientY))) });
	}

	function onPointerMove(e) {
		if (!dragging) return;
		onchange({ direction: String(Math.round(angleFromPointer(e.clientX, e.clientY))) });
	}

	function onPointerUp() {
		dragging = false;
	}

	function onKeyDown(e) {
		const current = parseFloat(direction) || 0;
		let next;
		if (e.key === 'ArrowRight' || e.key === 'ArrowDown') {
			next = (current + 5) % 360;
			onchange({ direction: String(next) });
			e.preventDefault();
		} else if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') {
			next = (current - 5 + 360) % 360;
			onchange({ direction: String(next) });
			e.preventDefault();
		}
	}

	// Quick wind presets — mps and mph values are independent round numbers
	const WIND_PRESETS = [
		{ key: 'no_wind', mps: 0, mph: 0, label: () => m.scope_view_wind_no_wind(), hint: () => m.scope_view_wind_hint_no_wind() },
		{ key: 'light_wind', mps: 3.5, mph: 8, label: () => m.scope_view_wind_light_wind(), hint: () => m.scope_view_wind_hint_light_wind() },
		{ key: 'strong_wind', mps: 9, mph: 20, label: () => m.scope_view_wind_strong_wind(), hint: () => m.scope_view_wind_hint_strong_wind() }
	];

	let activePreset = $derived(
		WIND_PRESETS.find((p) => {
			const target = speedUnit === 'mph' ? p.mph : p.mps;
			return Math.abs((parseFloat(speed) || 0) - target) < 0.01;
		}) ?? null
	);

	function applyPreset(preset) {
		const value = speedUnit === 'mph' ? preset.mph : preset.mps;
		onchange({ speed: String(value) });
	}


	// Pre-compute tick mark coordinates for all 12 clock positions
	const TICKS = Array.from({ length: 12 }, (_, i) => {
		const angle = (i / 12) * Math.PI * 2;
		const isMajor = i % 3 === 0;
		const r1 = isMajor ? 36 : 40;
		return {
			x1: 50 + r1 * Math.sin(angle),
			y1: 50 - r1 * Math.cos(angle),
			x2: 50 + 44 * Math.sin(angle),
			y2: 50 - 44 * Math.cos(angle),
			isMajor
		};
	});
</script>

<div class="space-y-3">
	<div class="flex items-start gap-4">
		<!-- ── Direction dial ──────────────────────────── -->
		<!-- svelte-ignore a11y_interactive_supports_focus -->
		<div
			bind:this={dialEl}
			class="shrink-0 size-28 touch-none select-none {dragging ? 'cursor-grabbing' : 'cursor-grab'}"
			role="slider"
			tabindex="0"
			aria-label={m.scope_view_wind_dir()}
			aria-valuenow={parseFloat(direction) || 0}
			aria-valuemin="0"
			aria-valuemax="360"
			onpointerdown={onPointerDown}
			onpointermove={onPointerMove}
			onpointerup={onPointerUp}
			onpointercancel={onPointerUp}
			onkeydown={onKeyDown}
		>
			<svg viewBox="0 0 100 100" class="size-full overflow-visible">
				<!-- Dial background -->
				<circle
					cx="50" cy="50" r="47"
					class="fill-surface-100 dark:fill-surface-800 stroke-surface-300 dark:stroke-surface-600"
					stroke-width="1.5"
				/>

				<!-- Tick marks (all 12, major at 0 / 90 / 180 / 270°) -->
				{#each TICKS as tick}
					<line
						x1={tick.x1} y1={tick.y1}
						x2={tick.x2} y2={tick.y2}
						class="stroke-surface-400 dark:stroke-surface-500"
						stroke-width={tick.isMajor ? 2 : 1}
						stroke-linecap="round"
					/>
				{/each}

				<!--
					Fixed downrange marker at 0° / 12 o'clock.
					Shooter always faces this direction.
				-->
				<polygon points="50,1 46,9 54,9" class="fill-warning-500" />
				<text
					x="50" y="24"
					text-anchor="middle" dominant-baseline="central"
					font-size="8" font-weight="700"
					class="fill-warning-500"
				>0°</text>

				<!-- Cardinal degree labels at 90 / 180 / 270 -->
				<text x="76" y="50" text-anchor="middle" dominant-baseline="central" font-size="8" font-weight="600" class="fill-surface-500 dark:fill-surface-400">90°</text>
				<text x="50" y="77" text-anchor="middle" dominant-baseline="central" font-size="8" font-weight="600" class="fill-surface-500 dark:fill-surface-400">180°</text>
				<text x="24" y="50" text-anchor="middle" dominant-baseline="central" font-size="8" font-weight="600" class="fill-surface-500 dark:fill-surface-400">270°</text>

				<!-- Rotating group: arrow shaft + arrowhead at source end (top) -->
				<g transform="rotate({dirDeg} 50 50)">
					<line
						x1="50" y1="21" x2="50" y2="72"
						class="stroke-blue-400" stroke-width="1.5" stroke-linecap="round"
					/>
					<polyline
						points="44,21 50,13 56,21"
						fill="none" class="stroke-blue-400"
						stroke-width="1.5" stroke-linejoin="round" stroke-linecap="round"
					/>
				</g>

				<!--
					Fixed scope reticle — rendered after the rotating group so it
					always sits on top. Gives the "shooter's eye" read of the dial.
				-->
				<line x1="50" y1="40" x2="50" y2="45" class="stroke-surface-500 dark:stroke-surface-400" stroke-width="0.8" />
				<line x1="50" y1="55" x2="50" y2="60" class="stroke-surface-500 dark:stroke-surface-400" stroke-width="0.8" />
				<line x1="40" y1="50" x2="45" y2="50" class="stroke-surface-500 dark:stroke-surface-400" stroke-width="0.8" />
				<line x1="55" y1="50" x2="60" y2="50" class="stroke-surface-500 dark:stroke-surface-400" stroke-width="0.8" />
				<circle cx="50" cy="50" r="4" fill="none" class="stroke-blue-400" stroke-width="1.5" />

				<!-- Wind icon at tail end of arrow (vertically mirrored from original) -->
				<g transform="rotate({dirDeg} 50 50)">
					<g transform="scale(1,-1) translate(0,-100)">
						<g transform="rotate(90, 50, 18)">
							<Wind x={43} y={11} size={14} class="stroke-blue-400" />
						</g>
					</g>
				</g>
			</svg>
		</div>

		<!-- ── Speed & direction inputs ───────────────── -->
		<div class="flex-1 space-y-3 min-w-0">
			<!-- Wind speed -->
			<div class="space-y-1">
				<span class="text-xs text-surface-500-400">{m.scope_view_wind_speed()}</span>
				<div class="input !flex !items-center gap-2">
					<input
						class="w-10 shrink-0 bg-transparent border-none outline-none shadow-none p-0 text-sm"
						type="text"
						inputmode="decimal"
						placeholder="0"
						value={speed}
						oninput={(e) => onchange({ speed: e.target.value })}
					/>
					<div class="flex items-center gap-1 ml-auto shrink-0">
						{#each [{ value: 'mph', label: m.unit_mph() }, { value: 'mps', label: m.unit_mps() }] as opt}
							<button
								type="button"
								class="chip text-xs {speedUnit === opt.value
									? 'preset-filled-primary-500'
									: 'preset-tonal-surface'}"
								onclick={() => onchange({ speedUnit: opt.value })}
							>{opt.label}</button>
						{/each}
					</div>
				</div>
			</div>

			<!-- Wind direction (degrees only) -->
			<div class="space-y-1">
				<span class="text-xs text-surface-500-400">{m.scope_view_wind_dir()}</span>
				<div class="input !flex !items-center gap-2">
					<input
						class="w-10 shrink-0 bg-transparent border-none outline-none shadow-none p-0 text-sm"
						type="text"
						inputmode="decimal"
						placeholder="0"
						value={direction}
						oninput={(e) => onchange({ direction: e.target.value })}
					/>
					<span class="text-xs text-surface-500-400 ml-auto shrink-0">{m.unit_deg()}</span>
				</div>
			</div>
		</div>
	</div>

	<!-- ── Quick wind presets ──────────────────────────────── -->
	<div class="space-y-2">
		<div class="flex gap-2">
			{#each WIND_PRESETS as preset}
				<button
					type="button"
					class="chip text-xs flex-1 {activePreset?.key === preset.key
						? 'preset-filled-primary-500'
						: 'preset-tonal-surface'}"
					onclick={() => applyPreset(preset)}
				>
					{preset.label()}
				</button>
			{/each}
		</div>
		{#if activePreset}
			<p class="text-xs text-surface-500-400 italic">{activePreset.hint()}</p>
		{/if}
	</div>
</div>
