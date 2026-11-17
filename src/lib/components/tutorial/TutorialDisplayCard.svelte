<script>
	/**
	 * Scene card of the 3D ballistic tutorial (#182): weather and quality chips. Both change only the
	 * picture; the ballistics use the Atmosphere card (#180). The weather values are the Atmosphere
	 * card's ('sunny', 'cloudy', 'rain', 'snow') and use its labels.
	 *
	 * @prop {'sunny'|'cloudy'|'rain'|'snow'} weather
	 * @prop {'low'|'medium'|'high'} quality
	 * @prop {(patch: { weather?: string, quality?: string }) => void} onchange
	 */
	import { m } from '#lib/paraglide/messages.js';
	import ChipGroup from '#lib/components/ChipGroup.svelte';

	let { weather, quality, onchange } = $props();

	const uid = $props.id();

	let weatherOptions = $derived([
		{ value: 'sunny', label: m.scope_view_weather_sunny() },
		{ value: 'cloudy', label: m.scope_view_weather_cloudy() },
		{ value: 'rain', label: m.scope_view_weather_rain() },
		{ value: 'snow', label: m.scope_view_weather_snow() }
	]);
	let qualityOptions = $derived([
		{ value: 'low', label: m.tutorial_quality_low() },
		{ value: 'medium', label: m.tutorial_quality_medium() },
		{ value: 'high', label: m.tutorial_quality_high() }
	]);
</script>

<section
	class="card preset-filled-surface-100-900 border border-surface-200-800 px-3.5 py-3 space-y-3 min-w-0"
	aria-labelledby="{uid}-title"
>
	<h2 id="{uid}-title" class="text-sm font-semibold">{m.tutorial_display_title()}</h2>

	<div class="space-y-1.5">
		<span class="block text-xs text-surface-600-400" aria-hidden="true">{m.tutorial_weather()}</span>
		<ChipGroup
			label={m.tutorial_weather()}
			options={weatherOptions}
			value={weather}
			onselect={(value) => onchange?.({ weather: value })}
			stretch
			class="flex-wrap"
		/>
		<p class="text-xs text-surface-600-400">{m.tutorial_weather_hint()}</p>
	</div>

	<div class="space-y-1.5">
		<div class="flex flex-wrap items-center justify-between gap-2">
			<span class="text-xs text-surface-600-400" aria-hidden="true">{m.tutorial_quality()}</span>
			<ChipGroup
				variant="segmented"
				label={m.tutorial_quality()}
				options={qualityOptions}
				value={quality}
				onselect={(value) => onchange?.({ quality: value })}
			/>
		</div>
		<p class="text-xs text-surface-600-400">{m.tutorial_quality_hint()}</p>
	</div>
</section>
