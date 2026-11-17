<script>
	import { m } from '#lib/paraglide/messages.js';
	import { readDecimal } from '#lib/utils/decimal.js';
	import { clockHour, dialDirection, DIAL_SNAP_DEGREES } from '#lib/utils/windDirection.js';

	/**
	 * The wind direction dial, used by ScopeWindCard (Scope View #148, Ballistic #151): a shooter's
	 * clock (#165) with the target at 12 and the shooter in the centre; the arrow starts at the hour
	 * the wind comes from and blows at the shooter.
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
	// A non-finite box ("Infinity", "1e999") is drawn as 0°, like an empty one.
	let dirDeg = $derived.by(() => {
		const read = readDecimal(direction);
		return Number.isFinite(read) ? ((read % 360) + 360) % 360 : 0;
	});
	let hour = $derived(clockHour(dirDeg));
	// The hour whose numeral sits on the highlight: only when the direction is exactly on it.
	let onHour = $derived(Number.isInteger(dirDeg) && dirDeg % 30 === 0 ? hour : null);

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

	// Geometry in the 100 x 100 viewBox, from the "Shooter's clock" design (#165): hour numerals and
	// half-hour dots at radius 39, the highlight circle (r 7.5) behind the current position there,
	// and the arrow from radius 30 (tail) to 7 (head tip), short of the shooter in the centre.
	const HOUR_R = 39;

	/** A point at `deg` (0 up, clockwise) and radius `r` from the centre. */
	function at(deg, r) {
		const a = (deg * Math.PI) / 180;
		return { x: 50 + r * Math.sin(a), y: 50 - r * Math.cos(a) };
	}

	// Numerals 1 to 11; 12 is the target symbol.
	const HOURS = Array.from({ length: 11 }, (_, i) => ({ hour: i + 1, ...at((i + 1) * 30, HOUR_R) }));
	// A small dot at each half hour (15°, 45°, ...).
	const HALF_HOURS = Array.from({ length: 12 }, (_, i) => at(i * 30 + 15, HOUR_R));
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
	aria-valuetext={m.scope_view_wind_dial_value({ hour: String(hour), degrees: String(Math.round(dirDeg)) })}
	onpointerdown={onPointerDown}
	onpointermove={onPointerMove}
	onpointerup={onPointerUp}
	onpointercancel={onPointerUp}
	onkeydown={onKeyDown}
>
	<svg viewBox="0 0 100 100" class="size-full overflow-visible" aria-hidden="true">
		<!-- Dial background -->
		<circle
			cx="50" cy="50" r="48"
			class="fill-surface-100 dark:fill-surface-800 stroke-surface-300 dark:stroke-surface-600"
			stroke-width="1"
		/>

		<!-- Highlight behind the current position on the rim, for any angle -->
		<circle
			cx="50" cy={50 - HOUR_R} r="7.5"
			transform="rotate({dirDeg} 50 50)"
			class="fill-blue-500 dark:fill-blue-400"
		/>

		<!-- Hour numerals; the one on the highlight turns white -->
		{#each HOURS as h (h.hour)}
			<text
				x={h.x} y={h.y}
				text-anchor="middle" dominant-baseline="central"
				font-size="9" font-weight="700"
				class={onHour === h.hour ? 'fill-white' : 'fill-surface-950 dark:fill-surface-50'}
			>{h.hour}</text>
		{/each}

		<!-- Half-hour dots -->
		{#each HALF_HOURS as p, i (i)}
			<circle cx={p.x} cy={p.y} r="1.1" class="fill-surface-400 dark:fill-surface-600" />
		{/each}

		<!-- Target at 12 o'clock, in the warning colour (white on the highlight) -->
		<g class={onHour === 12 ? 'fill-white stroke-white' : 'fill-warning-500 stroke-warning-500'}>
			<circle cx="50" cy={50 - HOUR_R} r="4.6" fill="none" stroke-width="1.4" />
			<circle cx="50" cy={50 - HOUR_R} r="1.6" stroke="none" />
		</g>

		<!-- Line of fire from the shooter to the target -->
		<line
			x1="50" y1="45" x2="50" y2="19"
			class="stroke-surface-400 dark:stroke-surface-600"
			stroke-width="0.8" stroke-dasharray="2 2"
		/>

		<!--
			Arrow, drawn at 12 before turning: starts at the rim side the wind comes from and points in at
			the shooter. Thick shaft, filled head short of the centre, two faint streak lines.
		-->
		<g transform="rotate({dirDeg} 50 50)" class="stroke-blue-500 dark:stroke-blue-400 fill-blue-500 dark:fill-blue-400">
			<line x1="43.5" y1="22" x2="43.5" y2="33" stroke-width="1.3" stroke-linecap="round" opacity="0.45" />
			<line x1="56.5" y1="22" x2="56.5" y2="33" stroke-width="1.3" stroke-linecap="round" opacity="0.45" />
			<line x1="50" y1="20" x2="50" y2="36" stroke-width="3.5" stroke-linecap="round" />
			<polygon points="50,43 44.5,35 55.5,35" stroke-width="1.2" stroke-linejoin="round" />
		</g>

		<!-- The shooter in the centre -->
		<circle cx="50" cy="50" r="4.5" class="fill-surface-950 dark:fill-surface-50" />
		<circle cx="50" cy="50" r="1.6" class="fill-surface-100 dark:fill-surface-800" />
	</svg>
</div>
