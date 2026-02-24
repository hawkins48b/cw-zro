<script>
	import { page } from '$app/state';
	import { goto } from '$app/navigation';
	import { localizeHref } from '$lib/paraglide/runtime.js';
	import { profiles } from '$lib/stores/profiles.svelte.js';
	import { m } from '$lib/paraglide/messages.js';
	import ProfileForm from '$lib/components/ProfileForm.svelte';

	let profile = $derived(profiles.get(page.params.id));
</script>

<svelte:head>
	<title>{m.profiles_edit()} — {m.app_name()}</title>
</svelte:head>

{#if profile}
	<ProfileForm
		title={m.profiles_edit()}
		initialData={profile}
		onSave={(data) => {
			profiles.update(page.params.id, data);
			goto(localizeHref('/profiles'));
		}}
		onCancel={() => goto(localizeHref('/profiles'))}
	/>
{:else}
	<p class="text-surface-500">{m.common_error()}</p>
{/if}
