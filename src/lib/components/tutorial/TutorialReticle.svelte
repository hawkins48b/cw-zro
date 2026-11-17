<script>
	/**
	 * The reticle over the 3D scene in the "through the optic" camera (#182). Drawn in milliradians:
	 * the SVG's height is the camera's vertical field of view (2 × halfView mrad), so a mark at 1 mrad
	 * covers what 1 mrad covers in the scene (the target, the impact). The shapes follow ScopeReticle:
	 * mil-dot (dots at 1 to 4 mrad), mrad (0.2 mrad ticks), moa (1 MOA ticks), and for the red dot
	 * the holographic sight's 65 MOA ring and 1 MOA dot. ScopeReticle itself is not reused: it is a
	 * card with its own glass and scale, and it reads and sets the Scope View's cant.
	 *
	 * @prop {'red-dot'|'mil-dot'|'mrad'|'moa'} type
	 * @prop {number} halfView - half the height of the view, in mrad
	 */
	let { type = 'red-dot', halfView = 6 } = $props();

	/** One MOA in mrad. */
	const MOA = 0.29088821;
	const holo = $derived(type === 'red-dot');
	const R = $derived(halfView * 0.97);
	const color = '#1b1b1b';

	const range = (from, to, step) => {
		const out = [];
		for (let v = from; v <= to + 1e-9; v += step) out.push(Math.round(v * 1e6) / 1e6);
		return out;
	};
	// Tick positions (mrad) on each side of the centre, inside the glass.
	const milDots = [1, 2, 3, 4];
	const mradTicks = $derived(range(0.2, R - 0.2, 0.2));
	const moaTicks = $derived(range(MOA, R - 0.2, MOA));
</script>

<svg
	class="absolute inset-0 w-full h-full pointer-events-none"
	viewBox="{-halfView} {-halfView} {2 * halfView} {2 * halfView}"
	preserveAspectRatio="xMidYMid meet"
	overflow="visible"
	aria-hidden="true"
>
	{#if holo}
		<!-- Holographic sight: 65 MOA ring, 1 MOA dot, a short tick at each quarter -->
		<g fill="none" stroke="#ff2a2a" stroke-opacity="0.9">
			<circle r={32.5 * MOA} stroke-width="2" vector-effect="non-scaling-stroke" />
			{#each [0, 90, 180, 270] as angle}
				<line
					x1="0"
					y1={-32.5 * MOA}
					x2="0"
					y2={-28 * MOA}
					transform="rotate({angle})"
					stroke-width="2"
					vector-effect="non-scaling-stroke"
				/>
			{/each}
		</g>
		<circle r={0.5 * MOA} fill="#ff2a2a" />
	{:else}
		<!-- Eyepiece: black outside the glass -->
		<path
			d="M {-halfView * 50} {-halfView * 50} H {halfView * 50} V {halfView * 50} H {-halfView * 50} Z M {R} 0 A {R} {R} 0 1 0 {-R} 0 A {R} {R} 0 1 0 {R} 0 Z"
			fill="#050505"
			fill-rule="evenodd"
		/>
		<circle r={R} fill="none" stroke="#000" stroke-opacity="0.6" stroke-width="10" vector-effect="non-scaling-stroke" />

		<g stroke={color} fill="none">
			<!-- Crosshair: thin near the centre, thick posts outside -->
			<line x1={-R} y1="0" x2={-4.5} y2="0" stroke-width="4" vector-effect="non-scaling-stroke" />
			<line x1={4.5} y1="0" x2={R} y2="0" stroke-width="4" vector-effect="non-scaling-stroke" />
			<line x1="0" y1={-R} x2="0" y2={-4.5} stroke-width="4" vector-effect="non-scaling-stroke" />
			<line x1="0" y1={4.5} x2="0" y2={R} stroke-width="4" vector-effect="non-scaling-stroke" />
			<line x1={-4.5} y1="0" x2={4.5} y2="0" stroke-width="1.2" vector-effect="non-scaling-stroke" />
			<line x1="0" y1={-4.5} x2="0" y2={4.5} stroke-width="1.2" vector-effect="non-scaling-stroke" />

			{#if type === 'mrad'}
				{#each mradTicks as v}
					{@const long = Math.abs(v - Math.round(v)) < 1e-6}
					{@const half = long ? 0.18 : 0.08}
					{#if v < 4.5}
						<line x1={v} y1={-half} x2={v} y2={half} stroke-width="1" vector-effect="non-scaling-stroke" />
						<line x1={-v} y1={-half} x2={-v} y2={half} stroke-width="1" vector-effect="non-scaling-stroke" />
						<line x1={-half} y1={v} x2={half} y2={v} stroke-width="1" vector-effect="non-scaling-stroke" />
						<line x1={-half} y1={-v} x2={half} y2={-v} stroke-width="1" vector-effect="non-scaling-stroke" />
					{/if}
				{/each}
			{:else if type === 'moa'}
				{#each moaTicks as v, i}
					{@const long = (i + 1) % 2 === 0}
					{@const half = long ? 0.16 : 0.08}
					{#if v < 4.5}
						<line x1={v} y1={-half} x2={v} y2={half} stroke-width="1" vector-effect="non-scaling-stroke" />
						<line x1={-v} y1={-half} x2={-v} y2={half} stroke-width="1" vector-effect="non-scaling-stroke" />
						<line x1={-half} y1={v} x2={half} y2={v} stroke-width="1" vector-effect="non-scaling-stroke" />
						<line x1={-half} y1={-v} x2={half} y2={-v} stroke-width="1" vector-effect="non-scaling-stroke" />
					{/if}
				{/each}
			{/if}
		</g>

		{#if type === 'mil-dot'}
			<g fill={color}>
				{#each milDots as d}
					<circle cx={d} cy="0" r="0.11" />
					<circle cx={-d} cy="0" r="0.11" />
					<circle cx="0" cy={d} r="0.11" />
					<circle cx="0" cy={-d} r="0.11" />
				{/each}
			</g>
		{/if}

		{#if type === 'mrad' || type === 'mil-dot'}
			<g fill={color} font-size="0.5" text-anchor="middle">
				{#each [2, 4] as n}
					<text x={n} y="0.85">{n}</text>
					<text x={-n} y="0.85">{n}</text>
					<text x="-0.45" y={n + 0.17} text-anchor="end">{n}</text>
				{/each}
			</g>
		{:else if type === 'moa'}
			<g fill={color} font-size="0.45" text-anchor="middle">
				{#each [4, 8, 12] as n}
					<text x={n * MOA} y="0.8">{n}</text>
					<text x={-n * MOA} y="0.8">{n}</text>
					<text x="-0.4" y={n * MOA + 0.15} text-anchor="end">{n}</text>
				{/each}
			</g>
		{/if}

		<!-- Red centre cross, as on ScopeReticle -->
		<g stroke="#ff2020">
			<line x1="-0.25" y1="0" x2="0.25" y2="0" stroke-width="1.5" vector-effect="non-scaling-stroke" />
			<line x1="0" y1="-0.25" x2="0" y2="0.25" stroke-width="1.5" vector-effect="non-scaling-stroke" />
		</g>
	{/if}
</svg>
