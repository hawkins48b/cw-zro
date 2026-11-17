<script>
	import { m } from '#lib/paraglide/messages.js';
	import { Wind } from '@lucide/svelte';
	import { readDecimal } from '#lib/utils/decimal.js';
	import { dialDirection, DIAL_SNAP_DEGREES } from '#lib/utils/windDirection.js';

	/**
	 * The wind direction dial, used by ScopeWindCard (Scope View #148, Ballistic #151).
	 * Drag or tap to set: near the rim it snaps to the 24 points every 15°, inside it sets whole
	 * degrees (#155). Arrow keys turn it by 5°, Page Up / Page Down by 15°, Home sets 0°.
	 *
	 * @prop {string} direction - Where the wind comes from, in degrees, as typed (text).
	 * @prop {(direction: string) => void} onchange - Called with whole degrees as text.
	 * @prop {string} class - Size classes (default size-56, 224 px).
	 */
	let { direction, onchange, class: cls = 'size-56' } = $props();

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

	/** The direction under the pointer: the rim snaps to the 15° points, the inside to 1° (#155). */
	function directionAt(clientX, clientY) {
		const rect = dialEl.getBoundingClientRect();
		const dx = clientX - (rect.left + rect.width / 2);
		const dy = clientY - (rect.top + rect.height / 2);
		return dialDirection(dx, dy, rect.width / 2);
	}

	function onPointerDown(e) {
		dragging = true;
		dialEl.setPointerCapture(e.pointerId);
		onchange(String(directionAt(e.clientX, e.clientY)));
	}

	function onPointerMove(e) {
		if (!dragging) return;
		onchange(String(directionAt(e.clientX, e.clientY)));
	}

	function onPointerUp() {
		dragging = false;
	}

	function onKeyDown(e) {
		const current = readDecimal(direction) || 0;
		const step = e.key === 'PageUp' || e.key === 'PageDown' ? DIAL_SNAP_DEGREES : 5;
		if (e.key === 'ArrowRight' || e.key === 'ArrowDown' || e.key === 'PageDown') {
			onchange(String((((current + step) % 360) + 360) % 360));
			e.preventDefault();
		} else if (e.key === 'ArrowLeft' || e.key === 'ArrowUp' || e.key === 'PageUp') {
			onchange(String((((current - step) % 360) + 360) % 360));
			e.preventDefault();
		} else if (e.key === 'Home') {
			onchange('0');
			e.preventDefault();
		}
	}

	// Geometry in the 100 x 100 viewBox (#155). From the rim inwards: touch points at radius 43, degree
	// labels centred at radius 31 (their inner edge is about 23 for "270°"), the arrow within 21.
	const POINT_R = 43;
	const LABEL_R = 31;
	const HEAD_TIP = 21;
	const HEAD_BASE = 12;
	const TAIL = 11;
	const ICON_SIZE = 11;
	const ICON_R = 17;

	// 24 touch points every 15°, larger on the clock hours (every 30°). 0° is drawn as the
	// downrange marker instead.
	const POINTS = Array.from({ length: 360 / DIAL_SNAP_DEGREES }, (_, i) => {
		const deg = i * DIAL_SNAP_DEGREES;
		const a = (deg * Math.PI) / 180;
		return { deg, x: 50 + POINT_R * Math.sin(a), y: 50 - POINT_R * Math.cos(a), hour: deg % 30 === 0 };
	}).filter((p) => p.deg !== 0);

	// The point to highlight: the current direction when it sits on one.
	let activePoint = $derived(Number.isInteger(dirDeg) && dirDeg % DIAL_SNAP_DEGREES === 0 ? dirDeg : null);
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
	aria-keyshortcuts="ArrowLeft ArrowRight ArrowUp ArrowDown PageUp PageDown Home"
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
			cx="50" cy="50" r="48"
			class="fill-surface-100 dark:fill-surface-800 stroke-surface-300 dark:stroke-surface-600"
			stroke-width="1"
		/>

		<!-- Touch points every 15° (#155): the rim snaps to them. The current one is filled blue. -->
		{#each POINTS as point (point.deg)}
			{#if point.deg === activePoint}
				<circle cx={point.x} cy={point.y} r="3.2" class="fill-blue-500 dark:fill-blue-400" />
			{:else}
				<circle
					cx={point.x} cy={point.y} r={point.hour ? 2 : 1.4}
					class="fill-surface-400 dark:fill-surface-500"
				/>
			{/if}
		{/each}

		<!--
			Fixed downrange marker at 0° / 12 o'clock, in place of the 0° point.
			Shooter always faces this direction. Ringed when the direction is 0°.
		-->
		{#if activePoint === 0}
			<circle cx="50" cy={50 - POINT_R} r="4.2" class="fill-blue-500 dark:fill-blue-400" />
		{/if}
		<polygon points="50,3.5 46.5,9.5 53.5,9.5" class="fill-warning-500" />

		<!-- Degree labels at 0 / 90 / 180 / 270 -->
		<text
			x="50" y={50 - LABEL_R}
			text-anchor="middle" dominant-baseline="central"
			font-size="8" font-weight="700"
			class="fill-warning-500"
		>0°</text>
		<text x={50 + LABEL_R} y="50" text-anchor="middle" dominant-baseline="central" font-size="8" font-weight="600" class="fill-surface-500 dark:fill-surface-400">90°</text>
		<text x="50" y={50 + LABEL_R} text-anchor="middle" dominant-baseline="central" font-size="8" font-weight="600" class="fill-surface-500 dark:fill-surface-400">180°</text>
		<text x={50 - LABEL_R} y="50" text-anchor="middle" dominant-baseline="central" font-size="8" font-weight="600" class="fill-surface-500 dark:fill-surface-400">270°</text>

		<!--
			Rotating arrow, drawn pointing up before rotating: thick shaft, filled head at the downwind
			end, Wind icon at the tail (the side the wind comes from). Kept within radius 23 so it never
			reaches the labels (#155).
		-->
		<g transform="rotate({arrowDeg} 50 50)">
			<line
				x1="50" y1={50 + TAIL} x2="50" y2={50 - HEAD_BASE - 1}
				class="stroke-blue-500 dark:stroke-blue-400" stroke-width="3.5" stroke-linecap="round"
			/>
			<polygon
				points="50,{50 - HEAD_TIP} 44,{50 - HEAD_BASE} 56,{50 - HEAD_BASE}"
				class="fill-blue-500 dark:fill-blue-400 stroke-blue-500 dark:stroke-blue-400"
				stroke-width="1.5" stroke-linejoin="round"
			/>
		</g>

		<!--
			Fixed scope reticle — rendered after the arrow so it always sits on top. Gives the
			"shooter's eye" read of the dial.
		-->
		<line x1="50" y1="40" x2="50" y2="45" class="stroke-surface-500 dark:stroke-surface-400" stroke-width="0.8" />
		<line x1="50" y1="55" x2="50" y2="60" class="stroke-surface-500 dark:stroke-surface-400" stroke-width="0.8" />
		<line x1="40" y1="50" x2="45" y2="50" class="stroke-surface-500 dark:stroke-surface-400" stroke-width="0.8" />
		<line x1="55" y1="50" x2="60" y2="50" class="stroke-surface-500 dark:stroke-surface-400" stroke-width="0.8" />
		<circle cx="50" cy="50" r="4" class="fill-surface-100 dark:fill-surface-800 stroke-blue-500 dark:stroke-blue-400" stroke-width="1.5" />

		<!-- Wind icon past the tail of the arrow, on the side the wind comes from. Drawn mirrored and
			turned a quarter so it reads along the arrow, as before #155. -->
		<g transform="rotate({arrowDeg} 50 50)">
			<g transform="scale(1,-1) translate(0,-100)">
				<g transform="rotate(90, 50, {50 - ICON_R})">
					<Wind
						x={50 - ICON_SIZE / 2} y={50 - ICON_R - ICON_SIZE / 2} size={ICON_SIZE}
						class="stroke-blue-500 dark:stroke-blue-400"
					/>
				</g>
			</g>
		</g>
	</svg>
</div>
