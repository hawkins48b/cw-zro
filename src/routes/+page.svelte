<script>
	import { goto } from '$app/navigation';
	import { localizeHref } from '$lib/paraglide/runtime';
	import { m } from '$lib/paraglide/messages.js';
	import { onMount } from 'svelte';

	let visible = $state(true);
	let fading = $state(false);

	const curves = [
		{ d: 'M -10 75 Q 20 30, 55 45',    color: '#22c55e', delay: 0 },
		{ d: 'M -10 78 Q 25 15, 70 50',     color: '#3b82f6', delay: 0.2 },
		{ d: 'M -10 80 Q 30 5, 85 55',      color: '#f97316', delay: 0.4 },
		{ d: 'M -10 76 Q 15 45, 42 60',     color: '#ef4444', delay: 0.6 },
		{ d: 'M -10 82 Q 35 -5, 100 58',    color: '#a855f7', delay: 0.8 },
		{ d: 'M -10 79 Q 22 22, 60 48',     color: '#14b8a6', delay: 1.0 },
	];

	onMount(() => {
		const timer = setTimeout(() => {
			fading = true;
			setTimeout(() => {
				visible = false;
				goto(localizeHref('/scope-view'), { replaceState: true });
			}, 400);
		}, 2500);

		return () => clearTimeout(timer);
	});
</script>

{#if visible}
	<div
		class="fixed inset-0 z-50 bg-surface-50-950 transition-opacity duration-400"
		class:opacity-0={fading}
	>
		<!-- Full-screen trajectory SVG background -->
		<svg
			class="absolute inset-0 w-full h-full text-surface-900-50"
			viewBox="0 0 100 100"
			preserveAspectRatio="none"
			fill="none"
			xmlns="http://www.w3.org/2000/svg"
		>
			<!-- Grid lines -->
			{#each [10, 20, 30, 40, 50, 60, 70, 80, 90] as x}
				<line x1={x} y1="0" x2={x} y2="100" stroke="currentColor" stroke-width="0.15" opacity="0.06" />
			{/each}
			{#each [10, 20, 30, 40, 50, 60, 70, 80, 90] as y}
				<line x1="0" y1={y} x2="100" y2={y} stroke="currentColor" stroke-width="0.15" opacity="0.06" />
			{/each}

			<!-- Muzzle origin dot -->
			<circle cx="-5" cy="78" r="0.8" fill="#22c55e" opacity="0.5" />
		</svg>

		<!-- Curves SVG (separate so aspect ratio is preserved) -->
		<svg
			class="absolute inset-0 w-full h-full"
			viewBox="0 0 100 100"
			preserveAspectRatio="none"
			fill="none"
			xmlns="http://www.w3.org/2000/svg"
		>
			{#each curves as curve}
				<path
					d={curve.d}
					stroke={curve.color}
					stroke-width="2"
					stroke-linecap="round"
					fill="none"
					vector-effect="non-scaling-stroke"
					class="trajectory-curve"
					style="animation-delay: {curve.delay}s;"
				/>
			{/each}
		</svg>

		<!-- Centered logo + text overlay -->
		<div class="relative z-10 flex flex-col items-center justify-center h-full">
			<!-- Logo -->
			<div class="mb-4 animate-fade-in">
				<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512" class="size-24 sm:size-32 drop-shadow-lg">
					<defs>
						<linearGradient id="splash-bg" x1="0%" y1="0%" x2="100%" y2="100%">
							<stop offset="0%" stop-color="#097A34"/>
							<stop offset="100%" stop-color="#065A26"/>
						</linearGradient>
					</defs>
					<circle cx="256" cy="256" r="240" fill="url(#splash-bg)"/>
					<circle cx="256" cy="256" r="220" fill="none" stroke="#0a8a3b" stroke-width="2" opacity="0.4"/>
					<circle cx="256" cy="256" r="200" fill="none" stroke="rgba(255,255,255,0.12)" stroke-width="1.5"/>
					<path d="M 148 148 L 364 148 L 364 188 L 218 324 L 364 324 L 364 364 L 148 364 L 148 324 L 294 188 L 148 188 Z" fill="#FFFFFF"/>
				</svg>
			</div>

			<!-- App name -->
			<h1 class="text-4xl sm:text-5xl font-bold tracking-tight text-surface-900-50 mb-2 animate-fade-in drop-shadow-sm">
				ZRO
			</h1>
			<p class="text-base sm:text-lg text-surface-500 animate-fade-in">
				{m.calc_ballistic()}
			</p>
		</div>
	</div>
{/if}

<style>
	@keyframes fade-in {
		from { opacity: 0; transform: translateY(8px); }
		to { opacity: 1; transform: translateY(0); }
	}

	@keyframes draw-curve {
		from { stroke-dashoffset: 2000; }
		to { stroke-dashoffset: 0; }
	}

	.animate-fade-in {
		animation: fade-in 0.6s ease-out both;
	}

	.trajectory-curve {
		stroke-dasharray: 2000;
		stroke-dashoffset: 2000;
		animation: draw-curve 1.4s ease-out forwards;
	}
</style>
