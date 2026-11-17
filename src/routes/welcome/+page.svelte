<script>
	// First-run Welcome screen (#150). The layout renders this route without navigation.
	import { goto } from '$app/navigation';
	import { onMount } from 'svelte';
	import { localizeHref } from '#lib/paraglide/runtime.js';
	import { m } from '#lib/paraglide/messages.js';
	import WelcomeScreen from '#lib/components/WelcomeScreen.svelte';
	import { profiles } from '#lib/stores/profiles.svelte.js';
	import { activeProfile } from '#lib/stores/activeProfile.svelte.js';
	import { isFirstRun } from '#lib/utils/firstRun.js';
	import { SAMPLE_PROFILES } from '#lib/utils/sampleProfile.js';

	// Welcome only while there is no usable profile: otherwise this page goes on to Scope View.
	const firstRun = isFirstRun(profiles.list);
	let leaving = false;

	onMount(() => {
		if (!firstRun) goto(localizeHref('/scope-view'), { replace: true });
	});

	function setup() {
		goto(localizeHref('/setup'));
	}

	function sample() {
		// Once only, also on a double tap.
		if (leaving) return;
		leaving = true;
		// #175: the M4 and the Remington 700; the M4 (first) is the active one.
		const [id] = SAMPLE_PROFILES.map((profile) => profiles.add({ ...profile }));
		activeProfile.setActive(id);
		goto(localizeHref('/scope-view'), { replace: true });
	}
</script>

<svelte:head>
	<title>{m.welcome_page_title()} — {m.app_name()}</title>
</svelte:head>

{#if firstRun}
	<WelcomeScreen onSetup={setup} onSample={sample} />
{/if}
