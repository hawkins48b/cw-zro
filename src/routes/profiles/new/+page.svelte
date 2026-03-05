<script>
	import { goto } from '$app/navigation';
	import { localizeHref } from '$lib/paraglide/runtime.js';
	import { profiles } from '$lib/stores/profiles.svelte.js';
	import { m } from '$lib/paraglide/messages.js';
	import ProfileForm from '$lib/components/ProfileForm.svelte';
</script>

<svelte:head>
	<title>{m.profiles_new()} — {m.app_name()}</title>
</svelte:head>

<ProfileForm
	onSave={(data) => {
		profiles.add(data);
		goto(localizeHref('/profiles'));
	}}
	onCancel={() => goto(localizeHref('/profiles'))}
/>
