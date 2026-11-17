<script>
	/**
	 * The search field of the picker pattern (#150, #166): Setup ammunition step, Ammo Library,
	 * Profiles, profile picker. Enter does not submit a surrounding form.
	 *
	 * @prop {string} value       - Bindable query.
	 * @prop {string} label       - Accessible name (already translated).
	 * @prop {string} placeholder
	 * @prop {string} [controls]  - id of the list it filters (aria-controls).
	 */
	import { Search } from '@lucide/svelte';

	let { value = $bindable(''), label, placeholder = '', controls = undefined } = $props();
</script>

<label
	class="input !flex !items-center gap-2 h-[46px] shrink-0 px-3 text-surface-600-400 focus-within:outline-2 focus-within:outline-offset-2 focus-within:outline-primary-500"
>
	<Search class="size-[18px] shrink-0" aria-hidden="true" />
	<input
		type="search"
		class="flex-1 min-w-0 bg-transparent border-none outline-none shadow-none p-0 text-[15px] text-surface-950-50"
		{placeholder}
		aria-label={label}
		aria-controls={controls}
		bind:value
		onkeydown={(e) => {
			if (e.key === 'Enter') e.preventDefault();
		}}
	/>
</label>
