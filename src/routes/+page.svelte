<script>
	import { goto } from '$app/navigation';
	import { localizeHref } from '$lib/paraglide/runtime';
	import { onMount } from 'svelte';

	onMount(() => {
		goto(localizeHref('/dashboard'), { replaceState: true });
	});
</script>
