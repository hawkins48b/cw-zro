<script>
	/**
	 * One choice as a row of toggle buttons: units, presets, modes (#148).
	 * Each option is a real button with aria-pressed, at least 44 px wide, with a 44 px tall touch
	 * area (.touch-hit in app.css) so the chips can stay small.
	 *
	 * @prop {Array<{ value: string, label: string, title?: string }>} options - Labels already translated.
	 * @prop {string|null} value   - The selected value. Null selects none (a wind speed no preset matches).
	 * @prop {(value: string) => void} onselect
	 * @prop {string} label        - Accessible name of the group (already translated).
	 * @prop {'chips'|'segmented'|'on-primary'} variant
	 *   chips: separate Skeleton chips (inside fields and card headers);
	 *   segmented: pill track on a surface card (Atmosphere mode);
	 *   on-primary: pill track on the filled primary result card (Dial / Hold).
	 * @prop {boolean} stretch     - Options share the full width (wind presets on narrow cards).
	 */
	let { options, value = null, onselect, label = '', variant = 'chips', stretch = false, class: cls = '' } = $props();

	const TRACK = {
		chips: 'gap-1',
		segmented: 'gap-0.5 p-0.5 rounded-full bg-surface-200-800',
		'on-primary': 'gap-0.5 p-0.5 rounded-full bg-primary-950/30'
	};

	function buttonClass(on) {
		if (variant === 'chips') {
			return `chip ${on ? 'preset-filled-primary-500' : 'preset-tonal-surface'} focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary-500`;
		}
		const base = 'h-7 px-3 rounded-full text-xs focus-visible:outline-2 focus-visible:outline-offset-2';
		if (variant === 'on-primary') {
			return `${base} focus-visible:outline-primary-50 ${on ? 'bg-primary-50 text-primary-800 font-semibold' : 'text-primary-50 font-medium hover:bg-primary-50/15'}`;
		}
		return `${base} focus-visible:outline-primary-500 ${on ? 'preset-filled-primary-500 font-semibold' : 'font-medium hover:preset-tonal-surface'}`;
	}
</script>

<div
	role="group"
	aria-label={label || undefined}
	class="flex items-center {stretch ? 'w-full' : 'shrink-0'} {TRACK[variant]} {cls}"
>
	{#each options as opt (opt.value)}
		<button
			type="button"
			class="touch-hit min-w-11 whitespace-nowrap {stretch ? 'flex-1' : ''} {buttonClass(opt.value === value)}"
			aria-pressed={opt.value === value}
			title={opt.title}
			onclick={() => onselect?.(opt.value)}
		>
			{opt.label}
		</button>
	{/each}
</div>
