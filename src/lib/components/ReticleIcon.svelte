<script>
	let { class: className = 'size-6', ...rest } = $props();
</script>

<svg
	xmlns="http://www.w3.org/2000/svg"
	viewBox="0 0 24 24"
	fill="none"
	stroke="currentColor"
	stroke-width="1.75"
	stroke-linecap="round"
	stroke-linejoin="round"
	class={className}
	{...rest}
>
	<!-- Outer circle (scope tube) -->
	<circle cx="12" cy="12" r="10" />
	<!-- Crosshair lines with gap at center -->
	<!-- Top -->
	<line x1="12" y1="2" x2="12" y2="9" />
	<!-- Bottom -->
	<line x1="12" y1="15" x2="12" y2="22" />
	<!-- Left -->
	<line x1="2" y1="12" x2="9" y2="12" />
	<!-- Right -->
	<line x1="15" y1="12" x2="22" y2="12" />
	<!-- Center dot -->
	<circle cx="12" cy="12" r="0.75" fill="currentColor" stroke="none" />
</svg>
