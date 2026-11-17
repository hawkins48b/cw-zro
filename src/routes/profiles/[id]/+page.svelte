<script>
	import { page } from '$app/state';
	import { goto } from '$app/navigation';
	import { localizeHref } from '#lib/paraglide/runtime.js';
	import { profiles } from '#lib/stores/profiles.svelte.js';
	import { activeProfile } from '#lib/stores/activeProfile.svelte.js';
	import { m } from '#lib/paraglide/messages.js';
	import ProfileForm from '#lib/components/ProfileForm.svelte';
	import { shownProfile } from '#lib/utils/storedProfiles.js';

	let profile = $derived(profiles.get(page.params.id));
</script>

<svelte:head>
	<title>{m.profiles_edit_profile()} — {m.app_name()}</title>
</svelte:head>

{#if profile}
	{#key page.params.id}
		<ProfileForm
			initialData={shownProfile(profile)}
			inUse={profile.id === activeProfile.id}
			onSave={(data) => {
				profiles.update(page.params.id, data);
				goto(localizeHref('/profiles'));
			}}
			onCancel={() => goto(localizeHref('/profiles'))}
		/>
	{/key}
{:else}
	<div class="px-2 sm:px-4 lg:px-0 py-4 flex flex-col items-start gap-3">
		<p class="text-surface-600-400">{m.common_error()}</p>
		<a href={localizeHref('/profiles')} class="btn preset-tonal-surface h-11">{m.profiles_title()}</a>
	</div>
{/if}
