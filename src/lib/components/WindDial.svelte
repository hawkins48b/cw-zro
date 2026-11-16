<script>
	import { m } from '#lib/paraglide/messages.js';
	import { Wind } from '@lucide/svelte';
	import { readDecimal } from '#lib/utils/decimal.js';

	/**
	 * The wind direction dial, used by ScopeWindCard (Scope View #148, Ballistic #151).
	 * Drag or tap to set, arrow keys turn it by 5°.
	 *
	 * @prop {string} direction - Where the wind comes from, in degrees, as typed (text).
	 * @prop {(direction: string) => void} onchange - Called with whole degrees as text.
	 * @prop {string} class - Size classes (default size-28, 112 px).
	 */
	let { direction, onchange, class: cls = 'size-28' } = $props();

	// Direction is where the wind comes FROM, in degrees clockwise from the target, as on a shooter's
	// clock (#106): 0 = from the target (12 o'clock), 90 = from the right (3 o'clock), 180 = from
	// behind, 270 = from the left. Boxes are read as shotWinds reads them, with a comma as a decimal
	// point, so the dial matches the result.
	let dirDeg = $derived(((readDecimal(direction) || 0) % 360 + 360) % 360);
	// The arrow is drawn pointing up, head at the top and Wind icon at the bottom. Turned by the
	// direction plus half a turn, the icon sits on the side the wind comes from and the head points
	// where it blows.
	let arrowDeg = $derived((dirDeg + 180) % 360);

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
		onchange(String(Math.round(angleFromPointer(e.clientX, e.clientY))));
	}

	function onPointerMove(e) {
		if (!dragging) return;
		onchange(String(Math.round(angleFromPointer(e.clientX, e.clientY))));
	}

	function onPointerUp() {
		dragging = false;
	}

	function onKeyDown(e) {
		const current = readDecimal(direction) || 0;
		if (e.key === 'ArrowRight' || e.key === 'ArrowDown') {
			onchange(String((current + 5) % 360));
			e.preventDefault();
		} else if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') {
			onchange(String((current - 5 + 360) % 360));
			e.preventDefault();
		}
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

<!-- svelte-ignore a11y_interactive_supports_focus -->
<div
	bind:this={dialEl}
	class="{cls} rounded-full touch-none select-none focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary-500 {dragging ? 'cursor-grabbing' : 'cursor-grab'}"
	role="slider"
	tabindex="0"
	aria-label={m.scope_view_wind_dir()}
	aria-valuenow={readDecimal(direction) || 0}
	aria-valuemin="0"
	aria-valuemax="360"
	aria-valuetext="{Math.round(dirDeg)}°"
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

		<!-- Rotating group: arrow shaft + arrowhead at the downwind end (top before rotating) -->
		<g transform="rotate({arrowDeg} 50 50)">
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

		<!-- Wind icon at the tail of the arrow, on the side the wind comes from (vertically mirrored
			from original) -->
		<g transform="rotate({arrowDeg} 50 50)">
			<g transform="scale(1,-1) translate(0,-100)">
				<g transform="rotate(90, 50, 18)">
					<Wind x={43} y={11} size={14} class="stroke-blue-400" />
				</g>
			</g>
		</g>
	</svg>
</div>
