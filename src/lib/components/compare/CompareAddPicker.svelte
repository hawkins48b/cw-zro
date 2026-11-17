<script>
	/**
	 * "Add profile" of Compare Trajectories (#166), with the picker pattern: search, sort, one list,
	 * a tap selects (rows already on the chart carry an "On chart" badge), the tonal summary of the
	 * selection, then the confirm button adds it. Nothing is added before the button.
	 *
	 * Used by the /calculators/compare-trajectories/add page on every device (#193); the confirm
	 * button sits in a bar pinned to the bottom.
	 *
	 * @prop {(entryProfileId: string) => void} [onadded] - After the entry was added (the page goes back).
	 */
	import { m } from '#lib/paraglide/messages.js';
	import { localizeHref } from '#lib/paraglide/runtime.js';
	import { NEW_PROFILE_PATH } from '#lib/utils/setupSteps.js';
	import { Plus } from '@lucide/svelte';
	import { profiles } from '#lib/stores/profiles.svelte.js';
	import { compareTrajectories } from '#lib/stores/compareTrajectories.svelte.js';
	import { shownProfile } from '#lib/utils/storedProfiles.js';
	import ProfilePicker from '#lib/components/ProfilePicker.svelte';
	import ProfileSummaryCard from '#lib/components/profile/ProfileSummaryCard.svelte';
	import { profileName, profileTitle } from '#lib/components/profile/profileLabels.js';

	let { onadded } = $props();

	let shownProfiles = $derived(profiles.list.map(shownProfile));
	let onChartIds = $derived(new Set(compareTrajectories.entries.map((e) => profiles.findStored(e.profileId)?.id).filter(Boolean)));
	let badges = $derived(Object.fromEntries([...onChartIds].map((id) => [id, m.compare_on_chart()])));

	// Starts on the newest profile that is not on the chart yet (the first row of "Recent").
	let pickedId = $state(null);
	$effect.pre(() => {
		if (pickedId !== null && shownProfiles.some((p) => p.id === pickedId)) return;
		const free = [...shownProfiles].reverse().find((p) => !onChartIds.has(p.id));
		pickedId = free?.id ?? null;
	});
	let picked = $derived(shownProfiles.find((p) => p.id === pickedId) ?? null);
	let again = $derived(picked ? onChartIds.has(picked.id) : false);

	function add() {
		const profile = picked && profiles.get(picked.id);
		if (!profile) return;
		// As before #166: the entry starts on the profile's zero; a zero that cannot be read is added
		// as an empty box, so the entry shows its message.
		const shown = shownProfile(profile);
		compareTrajectories.addEntry(profile.id, String(profile.zeroDist == null ? '100' : shown.zeroDist), shown.zeroUnit);
		onadded?.(profile.id);
	}

	const focusRing = 'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary-500';
</script>

{#if shownProfiles.length === 0}
	<p class="text-sm text-surface-600-400">{m.compare_no_profiles()}</p>
	<a href={localizeHref(NEW_PROFILE_PATH)} class="btn preset-tonal-primary self-start {focusRing}">{m.profiles_new()}</a>
{:else}
	<ProfilePicker
		profiles={shownProfiles}
		selectedId={pickedId}
		onselect={(id) => (pickedId = id)}
		{badges}
		label={m.compare_pick_profile()}
		rowLabel={(p) => (onChartIds.has(p.id) ? m.compare_row_on_chart({ name: profileTitle(p) }) : profileTitle(p))}
	/>

	{#if picked}
		<ProfileSummaryCard
			profile={picked}
			eyebrow={again ? m.compare_selected_on_chart() : m.profile_picker_selected()}
			label={m.profile_picker_selected()}
			editHref={localizeHref(`/profiles/${picked.id}`)}
		>
			{#snippet actions()}
				<p class="text-xs leading-snug">{m.compare_add_zero_note()}</p>
			{/snippet}
		</ProfileSummaryCard>
	{/if}

	<div class="sticky bottom-0 -mx-2 sm:-mx-0 px-2 sm:px-0 pt-2.5 pb-3 bg-surface-50-950 border-t border-surface-200-800 sm:border-0">
		<button
			type="button"
			class="btn w-full h-12 text-[15px] preset-filled-primary-500 gap-2 font-semibold {focusRing}"
			disabled={!picked}
			onclick={add}
		>
			<Plus class="size-[18px]" strokeWidth={2.5} aria-hidden="true" />
			<span class="truncate">
				{#if !picked}
					{m.compare_add_profile()}
				{:else if again}
					{m.compare_add_again({ name: profileName(picked) })}
				{:else}
					{m.compare_add_to_chart({ name: profileName(picked) })}
				{/if}
			</span>
		</button>
	</div>
{/if}
