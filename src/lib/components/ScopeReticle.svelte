<script>
	import { m } from '$lib/paraglide/messages.js';
	import { getElevationValue, getWindageValue } from '$lib/utils/ballisticCalculator.js';
	import { scopeView } from '$lib/stores/scopeView.svelte.js';
	import { activeProfile } from '$lib/stores/activeProfile.svelte.js';
	import { settings } from '$lib/stores/settings.svelte.js';
	import { RotateCcw } from '@lucide/svelte';

	let { point = null } = $props();

	// ── Constants ────────────────────────────────────────────────────
	const CX = 200;
	const CY = 200;
	const R = 194; // scope glass radius in viewBox units

	// Scale: pixels per angular unit (viewBox units)
	const MRAD_SCALE = 35; // 1 MRAD = 35px → ±5 MRAD visible (175px < 194px radius)
	const MOA_SCALE = 10; // 1 MOA = 10px → ±19 MOA visible

	// Mil-dot: dots at 1, 2, 3, 4 mils from center
	const MIL_DOT_POSITIONS = [35, 70, 105, 140];

	// MOA grid: one line per MOA, up to the visible radius
	const MOA_GRID_LINES = Array.from({ length: Math.floor(R / MOA_SCALE) }, (_, i) => i + 1);

	// MRAD grid: 0.2 MRAD sub-divisions (7 px), below x-axis + horizontal axis only
	const MRAD_STEP = MRAD_SCALE * 0.2; // 7 px per 0.2 MRAD
	// [1..27]: n%5===0 → whole MRAD, label = n/5
	const MRAD_SUB_LINES = Array.from({ length: Math.floor(R / MRAD_STEP) }, (_, i) => i + 1);

	const MOA_PER_MRAD = 3.4377519;

	// ── Theme-aware scope colors ──────────────────────────────────────
	const isDark = $derived(settings.darkMode);
	// Scope glass: near-black in dark mode, dark navy in light mode
	const glassColor = $derived(isDark ? '#070c14' : '#0e1e35');
	// Inner ring highlight
	const innerRingColor = $derived(isDark ? '#1e1e1e' : '#1a3250');
	// Outer tube inner edge
	const outerRingColor = $derived(isDark ? '#383838' : '#2e4868');
	// Reticle line color (cream on dark glass, slightly lighter cream on navy)
	const reticleColor = $derived(isDark ? '#d4cfc0' : '#e0ddd4');
	// Grid/subdivision line color
	const gridColor = $derived(isDark ? '#a0a0b0' : '#8090b0');
	// Label text color
	const labelColor = $derived(isDark ? '#c8c4ba' : '#d8d4cc');

	// Graduation label intervals (every Nth unit): MRAD 2, 4 — MOA 4, 8, 12, 16
	const MRAD_GRAD_LABELS = [2, 4];
	const MOA_GRAD_LABELS = [4, 8, 12, 16];

	// Reticle type from active profile
	const reticleType = $derived(activeProfile.profile?.reticleType ?? 'red-dot');

	// ── Aim point computation ─────────────────────────────────────────
	// BDC holdover logic: the green dot shows the reticle mark the shooter
	// should place ON the target (scope center ends up offset, bullet corrects back).
	//
	// js-ballistics sign conventions (matched by the page direction logic):
	//   dropAdjustment ≤ 0  →  dial UP   (bullet is low  →  hold mark is BELOW center)
	//   dropAdjustment > 0  →  dial DOWN  (bullet is high →  hold mark is ABOVE center)
	//   windageAdjustment ≥ 0 → dial LEFT  (bullet drifted right → hold mark is RIGHT of center)
	//   windageAdjustment < 0 → dial RIGHT (bullet drifted left  → hold mark is LEFT  of center)
	//
	// Therefore:
	//   aimX = CX - windMoa * scale   (positive windMoa = right of center)
	//   aimY = CY - elevMoa * scale   (negative elevMoa = below center via subtraction of negative)

	const elevMoa = $derived(getElevationValue(point, 'MOA'));
	const windMoa = $derived(getWindageValue(point, 'MOA'));

	const aimPoint = $derived.by(() => {
		if (point === null || elevMoa === null || windMoa === null) return null;

		let dx, dy;
		if (reticleType === 'mil-dot' || reticleType === 'mrad') {
			const elevMrad = elevMoa / MOA_PER_MRAD;
			const windMrad = windMoa / MOA_PER_MRAD;
			dx = windMrad * MRAD_SCALE;
			dy = -elevMrad * MRAD_SCALE;
		} else {
			dx = windMoa * MOA_SCALE;
			dy = -elevMoa * MOA_SCALE;
		}

		// Clamp aim indicator to within the visible scope glass
		const maxR = R - 14;
		const dist = Math.sqrt(dx * dx + dy * dy);
		const clamped = dist > maxR;
		const scale = clamped ? maxR / dist : 1;

		return {
			x: CX + dx * scale,
			y: CY + dy * scale,
			clamped
		};
	});
</script>

<div class="card preset-filled-surface-100-900 p-4 space-y-3">
	<!-- Header -->
	<h2 class="h5">{m.scope_view_reticle()}</h2>

	<!-- SVG Reticle View -->
	<div class="flex justify-center">
		<svg
			viewBox="0 0 400 400"
			xmlns="http://www.w3.org/2000/svg"
			class="w-full max-w-sm aspect-square select-none"
			role="img"
			aria-label={m.scope_view_reticle()}
		>
			<defs>
				<!-- Clip all reticle content to the scope circle -->
				<clipPath id="scope-glass-clip">
					<circle cx={CX} cy={CY} r={R} />
				</clipPath>

				<!-- Dark vignette at the edges of the glass -->
				<radialGradient id="scope-vignette" cx="50%" cy="50%" r="50%">
					<stop offset="55%" stop-color="black" stop-opacity="0" />
					<stop offset="100%" stop-color="black" stop-opacity="0.72" />
				</radialGradient>

				<!-- Scope tube outer ring gradient (dark metallic) -->
				<radialGradient id="scope-tube" cx="46%" cy="44%" r="54%">
					<stop offset="0%" stop-color="#484848" />
					<stop offset="60%" stop-color="#242424" />
					<stop offset="100%" stop-color="#141414" />
				</radialGradient>

				<!-- Green aim glow filter -->
				<filter id="aim-glow" x="-80%" y="-80%" width="260%" height="260%">
					<feGaussianBlur stdDeviation="4" result="blur" />
					<feMerge>
						<feMergeNode in="blur" />
						<feMergeNode in="SourceGraphic" />
					</feMerge>
				</filter>
			</defs>

			<!-- ── Scope tube ring (outermost) ───────────────────────── -->
			<circle cx={CX} cy={CY} r="199" fill="url(#scope-tube)" />

			<!-- ── Scope glass background (dark blue-black) ─────────── -->
			<circle cx={CX} cy={CY} r={R} fill={glassColor} />

			<!-- ═══════════════ AIM POINT / HOLD (behind reticle) ════
				 Rendered first so the reticle and grid draw on top.
				 Green cross with soft halo background.
			================================================================ -->
			{#if aimPoint && !aimPoint.clamped}
				<g clip-path="url(#scope-glass-clip)">
					<!-- Halo background -->
					<circle cx={aimPoint.x} cy={aimPoint.y} r="28" fill="#00ff55" opacity="0.07" />
					<circle cx={aimPoint.x} cy={aimPoint.y} r="16" fill="#00ff55" opacity="0.14" />

					<!-- Green cross -->
					<line x1={aimPoint.x - 8} y1={aimPoint.y} x2={aimPoint.x + 8} y2={aimPoint.y} stroke="#00ff55" stroke-width="3.5" />
					<line x1={aimPoint.x} y1={aimPoint.y - 8} x2={aimPoint.x} y2={aimPoint.y + 8} stroke="#00ff55" stroke-width="3.5" />
				</g>
			{/if}

			<!-- ═══════════════ ROTATED RETICLE GROUP ═══════════════════ -->
		<g transform="rotate({scopeView.rotation}, {CX}, {CY})">

		<!-- ═══════════════ RED DOT ═══════════════════════════════ -->
			{#if reticleType === 'red-dot'}
				<g clip-path="url(#scope-glass-clip)">
					<!-- Very faint reference lines for orientation -->
					<line x1={CX} y1="20" x2={CX} y2={CY - 18} stroke={reticleColor} stroke-width="0.6" opacity="0.18" />
					<line x1={CX} y1={CY + 18} x2={CX} y2="380" stroke={reticleColor} stroke-width="0.6" opacity="0.18" />
					<line x1="20" y1={CY} x2={CX - 18} y2={CY} stroke={reticleColor} stroke-width="0.6" opacity="0.18" />
					<line x1={CX + 18} y1={CY} x2="380" y2={CY} stroke={reticleColor} stroke-width="0.6" opacity="0.18" />

					<!-- 2 MOA red dot (radius ≈ 8px at 10px/MOA) -->
					<circle cx={CX} cy={CY} r="8" fill="#ff1e1e" />
				</g>
			{/if}

			<!-- ═══════════════ MIL-DOT ════════════════════════════════
				 Scale: 1 MRAD = 35 px
				 Gap (center dead zone): ±12 px (≈0.34 MRAD each side)
				 Thin post: gap edge → 4-MRAD stadia start (60 px from center)
				 Stadia (thick): 140 px from center → scope edge
				 Dots at 1, 2, 3, 4 MRAD (35, 70, 105, 140 px)
			================================================================ -->
			{#if reticleType === 'mil-dot'}
				<g clip-path="url(#scope-glass-clip)" fill={reticleColor} stroke={reticleColor}>
					<!-- Light grey grid below x-axis for wind correction reference -->
					{#each MIL_DOT_POSITIONS as d}
						<line x1={CX - d} y1={CY} x2={CX - d} y2="394" stroke={gridColor} stroke-width="0.5" opacity="0.28" />
						<line x1={CX + d} y1={CY} x2={CX + d} y2="394" stroke={gridColor} stroke-width="0.5" opacity="0.28" />
						<line x1="6" y1={CY + d} x2="394" y2={CY + d} stroke={gridColor} stroke-width="0.5" opacity="0.28" />
					{/each}

					<!-- Vertical stadia: top -->
					<line x1={CX} y1="6" x2={CX} y2="60" stroke-width="3" />
					<!-- Vertical thin post: top -->
					<line x1={CX} y1="60" x2={CX} y2={CY - 12} stroke-width="1.5" />
					<!-- Vertical thin post: bottom -->
					<line x1={CX} y1={CY + 12} x2={CX} y2="340" stroke-width="1.5" />
					<!-- Vertical stadia: bottom -->
					<line x1={CX} y1="340" x2={CX} y2="394" stroke-width="3" />

					<!-- Horizontal stadia: left -->
					<line x1="6" y1={CY} x2="60" y2={CY} stroke-width="3" />
					<!-- Horizontal thin post: left -->
					<line x1="60" y1={CY} x2={CX - 12} y2={CY} stroke-width="1.5" />
					<!-- Horizontal thin post: right -->
					<line x1={CX + 12} y1={CY} x2="340" y2={CY} stroke-width="1.5" />
					<!-- Horizontal stadia: right -->
					<line x1="340" y1={CY} x2="394" y2={CY} stroke-width="3" />

					<!-- Mil-dots: both axes, symmetric ±1..±4 MRAD -->
					{#each MIL_DOT_POSITIONS as d}
						<!-- Vertical axis -->
						<circle cx={CX} cy={CY - d} r="3.5" stroke="none" />
						<circle cx={CX} cy={CY + d} r="3.5" stroke="none" />
						<!-- Horizontal axis -->
						<circle cx={CX - d} cy={CY} r="3.5" stroke="none" />
						<circle cx={CX + d} cy={CY} r="3.5" stroke="none" />
					{/each}

					<!-- Graduation labels: ±x axis and −y axis (below) only -->
					{#each MRAD_GRAD_LABELS as n}
						<text x={CX - n * MRAD_SCALE} y={CY + 20} text-anchor="middle" font-size="14" font-weight="bold" fill={labelColor} stroke="none">{n}</text>
						<text x={CX + n * MRAD_SCALE} y={CY + 20} text-anchor="middle" font-size="14" font-weight="bold" fill={labelColor} stroke="none">{n}</text>
						<text x={CX - 13} y={CY + n * MRAD_SCALE} text-anchor="end" dominant-baseline="middle" font-size="14" font-weight="bold" fill={labelColor} stroke="none">{n}</text>
					{/each}
				</g>
			{/if}

			<!-- ═══════════════ MOA GRID ════════════════════════════════
				 Scale: 1 MOA = 10 px
				 Gap: ±8 px (≈0.8 MOA each side)
				 Short hash tick: ±4 px perpendicular, every 1 MOA
				 Long hash tick: ±10 px perpendicular, every 5 MOA
				 Stadia start: 150 px from center (15 MOA)
			================================================================ -->
			{#if reticleType === 'moa'}
				<g clip-path="url(#scope-glass-clip)" stroke={reticleColor} fill="none">
					<!-- Light grey grid: every 1 MOA; even lines are 1px thicker -->
					{#each MOA_GRID_LINES as n}
						<line x1={CX - n * MOA_SCALE} y1={CY} x2={CX - n * MOA_SCALE} y2="394" stroke={gridColor} stroke-width={n % 2 === 0 ? 1 : 0.5} opacity="0.28" />
						<line x1={CX + n * MOA_SCALE} y1={CY} x2={CX + n * MOA_SCALE} y2="394" stroke={gridColor} stroke-width={n % 2 === 0 ? 1 : 0.5} opacity="0.28" />
						<line x1="6" y1={CY + n * MOA_SCALE} x2="394" y2={CY + n * MOA_SCALE} stroke={gridColor} stroke-width={n % 2 === 0 ? 1 : 0.5} opacity="0.28" />
					{/each}

					<!-- Vertical stadia: top -->
					<line x1={CX} y1="6" x2={CX} y2="50" stroke-width="2.5" />
					<!-- Vertical thin: top -->
					<line x1={CX} y1="50" x2={CX} y2={CY - 8} stroke-width="1.2" />
					<!-- Vertical thin: bottom -->
					<line x1={CX} y1={CY + 8} x2={CX} y2="350" stroke-width="1.2" />
					<!-- Vertical stadia: bottom -->
					<line x1={CX} y1="350" x2={CX} y2="394" stroke-width="2.5" />

					<!-- Horizontal stadia: left -->
					<line x1="6" y1={CY} x2="50" y2={CY} stroke-width="2.5" />
					<!-- Horizontal thin: left -->
					<line x1="50" y1={CY} x2={CX - 8} y2={CY} stroke-width="1.2" />
					<!-- Horizontal thin: right -->
					<line x1={CX + 8} y1={CY} x2="350" y2={CY} stroke-width="1.2" />
					<!-- Horizontal stadia: right -->
					<line x1="350" y1={CY} x2="394" y2={CY} stroke-width="2.5" />

					<!-- Hash marks: every 1 MOA; even = long tick (±8px), odd = short tick (±4px) -->
					{#each MOA_GRID_LINES as n}
						{#if n % 2 === 0}
							<line x1={CX - 8} y1={CY - n * 10} x2={CX + 8} y2={CY - n * 10} stroke-width="1.5" />
							<line x1={CX - 8} y1={CY + n * 10} x2={CX + 8} y2={CY + n * 10} stroke-width="1.5" />
							<line x1={CX - n * 10} y1={CY - 8} x2={CX - n * 10} y2={CY + 8} stroke-width="1.5" />
							<line x1={CX + n * 10} y1={CY - 8} x2={CX + n * 10} y2={CY + 8} stroke-width="1.5" />
						{:else}
							<line x1={CX - 4} y1={CY - n * 10} x2={CX + 4} y2={CY - n * 10} stroke-width="1.2" />
							<line x1={CX - 4} y1={CY + n * 10} x2={CX + 4} y2={CY + n * 10} stroke-width="1.2" />
							<line x1={CX - n * 10} y1={CY - 4} x2={CX - n * 10} y2={CY + 4} stroke-width="1.2" />
							<line x1={CX + n * 10} y1={CY - 4} x2={CX + n * 10} y2={CY + 4} stroke-width="1.2" />
						{/if}
					{/each}

					<!-- Graduation labels: ±x axis and −y axis (below) only -->
					{#each MOA_GRAD_LABELS as n}
						<text x={CX - n * MOA_SCALE} y={CY + 14} text-anchor="middle" font-size="11" fill={labelColor}>{n}</text>
						<text x={CX + n * MOA_SCALE} y={CY + 14} text-anchor="middle" font-size="11" fill={labelColor}>{n}</text>
						<text x={CX - 9} y={CY + n * MOA_SCALE} text-anchor="end" dominant-baseline="middle" font-size="11" fill={labelColor}>{n}</text>
					{/each}
				</g>
			{/if}

			<!-- ═══════════════ MRAD GRID ═══════════════════════════════
			 Scale: 1 MRAD = 35 px — grid and ticks below x-axis only
			 Grid: vertical + horizontal every 0.2 MRAD, below center only
			 Y-axis ticks: 0.2 MRAD below center only, long at whole MRAD
			 X-axis ticks: 0.2 MRAD both sides, long at whole MRAD
			 Stadia start: 140 px from center (4 MRAD)
		================================================================ -->
		{#if reticleType === 'mrad'}
			<g clip-path="url(#scope-glass-clip)" stroke={reticleColor} fill="none">
				<!-- Grid: vertical + horizontal lines — 0.2 MRAD, below center only -->
				{#each MRAD_SUB_LINES as n}
					<line x1={CX - n * MRAD_STEP} y1={CY} x2={CX - n * MRAD_STEP} y2="394" stroke={gridColor} stroke-width={n % 5 === 0 ? 0.8 : 0.4} opacity="0.28" />
					<line x1={CX + n * MRAD_STEP} y1={CY} x2={CX + n * MRAD_STEP} y2="394" stroke={gridColor} stroke-width={n % 5 === 0 ? 0.8 : 0.4} opacity="0.28" />
					<line x1="6" y1={CY + n * MRAD_STEP} x2="394" y2={CY + n * MRAD_STEP} stroke={gridColor} stroke-width={n % 5 === 0 ? 0.8 : 0.4} opacity="0.28" />
				{/each}

				<!-- Vertical stadia: top -->
				<line x1={CX} y1="6" x2={CX} y2="60" stroke-width="2.5" />
				<!-- Vertical thin: top -->
				<line x1={CX} y1="60" x2={CX} y2={CY - 10} stroke-width="1.2" />
				<!-- Vertical thin: bottom -->
				<line x1={CX} y1={CY + 10} x2={CX} y2="340" stroke-width="1.2" />
				<!-- Vertical stadia: bottom -->
				<line x1={CX} y1="340" x2={CX} y2="394" stroke-width="2.5" />

				<!-- Horizontal stadia: left -->
				<line x1="6" y1={CY} x2="60" y2={CY} stroke-width="2.5" />
				<!-- Horizontal thin: left -->
				<line x1="60" y1={CY} x2={CX - 10} y2={CY} stroke-width="1.2" />
				<!-- Horizontal thin: right -->
				<line x1={CX + 10} y1={CY} x2="340" y2={CY} stroke-width="1.2" />
				<!-- Horizontal stadia: right -->
				<line x1="340" y1={CY} x2="394" y2={CY} stroke-width="2.5" />

				<!-- Y-axis ticks: 0.2 MRAD above and below center, long at whole MRAD; no labels above -->
				{#each MRAD_SUB_LINES as n}
					{#if n % 5 === 0}
						<line x1={CX - 8} y1={CY - n * MRAD_STEP} x2={CX + 8} y2={CY - n * MRAD_STEP} stroke-width="1.5" />
						<line x1={CX - 8} y1={CY + n * MRAD_STEP} x2={CX + 8} y2={CY + n * MRAD_STEP} stroke-width="1.5" />
					{:else}
						<line x1={CX - 3} y1={CY - n * MRAD_STEP} x2={CX + 3} y2={CY - n * MRAD_STEP} stroke-width="1" />
						<line x1={CX - 3} y1={CY + n * MRAD_STEP} x2={CX + 3} y2={CY + n * MRAD_STEP} stroke-width="1" />
					{/if}
				{/each}

				<!-- X-axis ticks: 0.2 MRAD both sides, long at whole MRAD -->
				{#each MRAD_SUB_LINES as n}
					{#if n % 5 === 0}
						<line x1={CX - n * MRAD_STEP} y1={CY - 8} x2={CX - n * MRAD_STEP} y2={CY + 8} stroke-width="1.5" />
						<line x1={CX + n * MRAD_STEP} y1={CY - 8} x2={CX + n * MRAD_STEP} y2={CY + 8} stroke-width="1.5" />
					{:else}
						<line x1={CX - n * MRAD_STEP} y1={CY - 3} x2={CX - n * MRAD_STEP} y2={CY + 3} stroke-width="1" />
						<line x1={CX + n * MRAD_STEP} y1={CY - 3} x2={CX + n * MRAD_STEP} y2={CY + 3} stroke-width="1" />
					{/if}
				{/each}

				<!-- Labels at every whole MRAD: horizontal axis + Y-axis below center -->
				{#each MRAD_SUB_LINES.filter(n => n % 5 === 0) as n}
					<text x={CX - n * MRAD_STEP} y={CY + 20} text-anchor="middle" font-size="14" fill={labelColor}>{n / 5}</text>
					<text x={CX + n * MRAD_STEP} y={CY + 20} text-anchor="middle" font-size="14" fill={labelColor}>{n / 5}</text>
					<text x={CX - 13} y={CY + n * MRAD_STEP} text-anchor="end" dominant-baseline="middle" font-size="14" fill={labelColor}>{n / 5}</text>
				{/each}
			</g>
		{/if}

		<!-- ── Red center cross (mil-dot and MOA only — not red-dot) ── -->
			{#if reticleType !== 'red-dot'}
				<g clip-path="url(#scope-glass-clip)">
					<line x1={CX - 8} y1={CY} x2={CX + 8} y2={CY} stroke="#ff2020" stroke-width="1.5" />
					<line x1={CX} y1={CY - 8} x2={CX} y2={CY + 8} stroke="#ff2020" stroke-width="1.5" />
				</g>
			{/if}

		</g><!-- END rotated reticle group -->

			<!-- ── Vignette overlay (applied over all reticle types) ── -->
			<circle cx={CX} cy={CY} r={R} fill="url(#scope-vignette)" />

			<!-- ── Inner scope ring highlight (subtle depth effect) ── -->
			<circle cx={CX} cy={CY} r={R} fill="none" stroke={innerRingColor} stroke-width="2.5" />

			<!-- ── Outer tube inner edge highlight ─────────────────── -->
			<circle cx={CX} cy={CY} r="196" fill="none" stroke={outerRingColor} stroke-width="1" />

		<!-- ─── Hold value labels (above all overlays) ─── -->
		{#if aimPoint && !aimPoint.clamped && elevMoa !== null && windMoa !== null}
			{@const dx = aimPoint.x - CX}
			{@const dy = aimPoint.y - CY}
			{@const signX = dx >= 0 ? -1 : 1}
			{@const signY = dy >= 0 ? -1 : 1}
			{@const lx = CX + signX * 40}
			{@const ly = CY + signY * 70}
			{@const anchor = signX > 0 ? 'start' : 'end'}
			{@const useMrad = reticleType === 'mrad' || reticleType === 'mil-dot'}
			{@const elevVal = useMrad ? (Math.abs(elevMoa) / MOA_PER_MRAD).toFixed(2) : Math.abs(elevMoa).toFixed(1)}
			{@const windVal = useMrad ? (Math.abs(windMoa) / MOA_PER_MRAD).toFixed(2) : Math.abs(windMoa).toFixed(1)}
			{@const elevIsUp = elevMoa <= 0}
			{@const windIsLeft = windMoa >= 0}
			{@const elevArrow = elevIsUp ? '↑' : '↓'}
			{@const windArrow = windIsLeft ? '←' : '→'}
			{@const elevWord = elevIsUp ? m.scope_view_up() : m.scope_view_down()}
			{@const windWord = windIsLeft ? m.scope_view_left() : m.scope_view_right()}
			{@const elevClass = elevIsUp ? 'fill-primary-500' : 'fill-secondary-500'}
			{@const windClass = windIsLeft ? 'fill-tertiary-500' : 'fill-warning-500'}
			<g clip-path="url(#scope-glass-clip)">
				<text x={lx} y={ly} text-anchor={anchor} font-size="16" font-family="monospace" font-weight="bold" class={elevClass}>{elevArrow} {elevWord} {elevVal}</text>
				<text x={lx} y={ly + 22} text-anchor={anchor} font-size="16" font-family="monospace" font-weight="bold" class={windClass}>{windArrow} {windWord} {windVal}</text>
			</g>
		{/if}

		</svg>
	</div>

	<!-- Legend row below the reticle -->
	<div class="flex items-center gap-3 text-xs text-surface-500-400 flex-wrap">
		{#if aimPoint}
			<span class="flex items-center gap-1.5">
				<span class="inline-block size-2.5 rounded-full shrink-0" style="background:#00ff55"></span>
				{m.scope_view_aim_point()}
				{#if aimPoint.clamped}
					<span class="text-warning-500">— {m.scope_view_aim_out_of_view()}</span>
				{/if}
			</span>
		{:else}
			<span class="italic">{m.scope_view_no_valid_result()}</span>
		{/if}

		<!-- Reticle scale hint -->
		<span class="ml-auto">
			{#if reticleType === 'mil-dot' || reticleType === 'mrad'}
				1 interval = 1 MRAD
			{:else if reticleType === 'moa'}
				1 interval = 1 MOA
			{/if}
		</span>
	</div>

	<!-- Rotation (cant) dial -->
	<div class="space-y-2">
		<div class="flex items-center gap-3">
			<span class="text-xs text-surface-500-400 shrink-0">{m.scope_view_rotation()}</span>
			<input
				type="range"
				min="-90"
				max="90"
				step="1"
				value={scopeView.rotation}
				oninput={(e) => scopeView.setRotation(Number(e.target.value))}
				class="flex-1 accent-primary-500"
			/>
			<span class="text-xs font-mono w-10 text-right tabular-nums">{scopeView.rotation}°</span>
		</div>
		<div class="flex justify-center">
			<button
				type="button"
				class="btn btn-sm preset-tonal-surface"
				title={m.scope_view_rotation_reset()}
				disabled={scopeView.rotation === 0}
				onclick={() => scopeView.resetRotation()}
			>
				<RotateCcw class="size-4" />
				<span class="text-xs">{m.scope_view_rotation_reset()}</span>
			</button>
		</div>
	</div>
</div>
