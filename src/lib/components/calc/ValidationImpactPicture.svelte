<script>
	import { m } from '#lib/paraglide/messages.js';
	import { readDecimal } from '#lib/utils/decimal.js';
	import { validationPicture } from '#lib/utils/validationView.js';

	/**
	 * Trajectory Validation (#194): what to measure, as seen through the scope. A target with the aim
	 * point in the centre, the impact the ballistic calculator expects with the profile (dashed ring)
	 * and the observed impact (filled), to scale when both values are known (validationPicture), and
	 * a dimension line from the aim point to the observed impact: the value the user enters.
	 *
	 * @prop {'angle'|'distance'} type
	 * @prop {'below'|'above'} direction
	 * @prop {number|null} predicted - The profile's own shot in the unit of the observed value, signed
	 *   (below the line of sight negative); null when the page has no result.
	 * @prop {string} observed - The observed value box, as typed.
	 * @prop {string} unit - Unit label of the observed value ('MOA', 'cm').
	 * @prop {(value: number) => string} format - Number formatting of the page.
	 */
	let { type, direction, predicted = null, observed, unit, format } = $props();
	const uid = $props.id();

	const C = 120; // centre of the 240 × 240 view
	let pic = $derived(validationPicture(predicted, observed, direction));
	let calcY = $derived(C + pic.predictedY);
	let seenY = $derived(C + pic.observedY);

	const TICKS = [-96, -84, -72, -60, -48, -36, -24, -12, 12, 24, 36, 48, 60, 72, 84, 96];

	let seenText = $derived(pic.example ? '' : `${format(Math.abs(readDecimal(observed)))} ${unit}`);
	let calcText = $derived(pic.example ? '' : `${format(Math.abs(predicted))} ${unit}`);

	// The picture's text alternative: what it shows, with the values when known.
	let alt = $derived(
		[
			m.traj_val_picture_alt(),
			calcText ? `${m.traj_val_picture_calc()}: ${calcText}` : '',
			seenText ? `${m.traj_val_picture_seen()}: ${seenText}` : ''
		]
			.filter(Boolean)
			.join('. ')
	);
</script>

<section
	class="card preset-filled-surface-100-900 border border-surface-200-800 p-4 flex flex-col gap-3"
	aria-labelledby="{uid}-title"
>
	<h2 id="{uid}-title" class="text-[15px] font-semibold">{m.traj_val_picture_title()}</h2>

	<div class="flex flex-wrap items-center gap-4">
		<svg
			viewBox="0 0 240 240"
			class="w-full max-w-[220px] mx-auto shrink-0"
			role="img"
			aria-label={alt}
		>
			<defs>
				<clipPath id="{uid}-lens"><circle cx={C} cy={C} r="112" /></clipPath>
			</defs>
			<!-- Lens -->
			<circle cx={C} cy={C} r="116" class="fill-surface-400-600" />
			<g clip-path="url(#{uid}-lens)">
				<rect width="240" height="240" class="fill-surface-50-950" />
				<!-- Target -->
				{#each [64, 48, 32, 16] as r, i (r)}
					<circle
						cx={C}
						cy={C}
						{r}
						stroke-width="1"
						class="{i % 2 ? 'fill-surface-200-800' : 'fill-surface-100-900'} stroke-surface-400-600"
					/>
				{/each}
				<!-- Reticle, hash marks every 12 units -->
				<g class="stroke-surface-950-50" stroke-width="1.2">
					<line x1="0" y1={C} x2="240" y2={C} />
					<line x1={C} y1="0" x2={C} y2="240" />
					{#each TICKS as t (t)}
						<line x1={C + t} y1={C - 4} x2={C + t} y2={C + 4} />
						<line x1={C - 4} y1={C + t} x2={C + 4} y2={C + t} />
					{/each}
				</g>
				<!-- Dimension: aim point → observed impact -->
				<g class="stroke-warning-600-400" stroke-width="1.5">
					<line x1={C + 22} y1={C} x2={C + 22} y2={seenY} />
					<line x1={C + 16} y1={C} x2={C + 28} y2={C} />
					<line x1={C + 16} y1={seenY} x2={C + 28} y2={seenY} />
					<line x1={C + 9} y1={seenY} x2={C + 16} y2={seenY} stroke-dasharray="2 2" />
				</g>
				<!-- Calculator impact -->
				<circle
					cx={C}
					cy={calcY}
					r="7"
					fill="none"
					stroke-width="2.5"
					stroke-dasharray="3 2.5"
					class="stroke-primary-600-400"
				/>
				<!-- Observed impact -->
				<circle cx={C} cy={seenY} r="5.5" stroke-width="1.5" class="fill-warning-600-400 stroke-surface-50-950" />
				<!-- Aim point -->
				<circle cx={C} cy={C} r="3" class="fill-error-500" />
			</g>
		</svg>

		<ul class="flex-[1_1_180px] min-w-0 flex flex-col gap-2 text-xs leading-snug">
			<li class="flex items-start gap-2">
				<span class="mt-0.5 inline-block size-3 shrink-0 rounded-full bg-error-500" aria-hidden="true"></span>
				<span><span class="font-semibold">{m.traj_val_picture_aim()}</span></span>
			</li>
			<li class="flex items-start gap-2">
				<span class="mt-0.5 inline-block size-3 shrink-0 rounded-full border-2 border-dashed border-primary-600-400" aria-hidden="true"></span>
				<span>
					<span class="font-semibold">{m.traj_val_picture_calc()}</span>
					{#if calcText}<span class="tabular-nums text-surface-600-400"> · {calcText}</span>{/if}
				</span>
			</li>
			<li class="flex items-start gap-2">
				<span class="mt-0.5 inline-block size-3 shrink-0 rounded-full bg-warning-600-400" aria-hidden="true"></span>
				<span>
					<span class="font-semibold">{m.traj_val_picture_seen()}</span>
					{#if seenText}<span class="tabular-nums text-surface-600-400"> · {seenText}</span>{/if}
				</span>
			</li>
			<li class="flex items-start gap-2">
				<span class="mt-1.5 inline-block w-3 shrink-0 border-t-2 border-warning-600-400" aria-hidden="true"></span>
				<span class="font-semibold">{m.traj_val_picture_value()}</span>
			</li>
		</ul>
	</div>

	<p class="text-xs leading-snug text-surface-600-400">
		{type === 'angle' ? m.traj_val_picture_text_angle() : m.traj_val_picture_text_distance()}
	</p>
	{#if pic.example}
		<p class="text-xs leading-snug text-surface-600-400">{m.traj_val_picture_example()}</p>
	{/if}
</section>
