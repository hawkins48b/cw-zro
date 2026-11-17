<script>
	/**
	 * The profile in use with "Change" (#166), on every calculator and the Calculators hub. "Change"
	 * opens the profile picker in place: a full-screen sheet on phones, a dialog from `sm`
	 * (ResponsiveDialog). A tap selects a row, "Use this profile" puts it in use (activeProfile store);
	 * Cancel, Escape or the scrim change nothing. With no profile at all the dialog links to New profile.
	 *
	 * @prop {string} [label]   - Small line above the name (default "Active profile"); `inline`: the
	 *                            word before the name (e.g. "For"). Already translated.
	 * @prop {'card'|'compact'|'inline'} [variant] - card (default): bordered button, min 48 px, label
	 *                            above the name, as on Scope View and MPBR. compact: one line, 44 px,
	 *                            for page headers (hub, Ballistic). inline: tinted row inside a card
	 *                            (Dope Cards mid-range card), "Change" as a text button.
	 * @prop {string} [class]   - Extra classes on the outer element (width, margins).
	 */
	import { m } from '#lib/paraglide/messages.js';
	import { localizeHref } from '#lib/paraglide/runtime.js';
	import { Plus } from '@lucide/svelte';
	import { profiles } from '#lib/stores/profiles.svelte.js';
	import { activeProfile } from '#lib/stores/activeProfile.svelte.js';
	import { shownProfile } from '#lib/utils/storedProfiles.js';
	import ProfilePicker from '#lib/components/ProfilePicker.svelte';
	import ProfileSummaryCard from '#lib/components/profile/ProfileSummaryCard.svelte';
	import ResponsiveDialog from '#lib/components/ResponsiveDialog.svelte';
	import { profileName, ammoName, profileTitle } from '#lib/components/profile/profileLabels.js';

	let { label = undefined, variant = 'card', class: cls = '' } = $props();

	// The profiles as the pages show them (#120): names are text.
	let shownProfiles = $derived(profiles.list.map(shownProfile));
	let activeId = $derived(activeProfile.id);
	let current = $derived(shownProfiles.find((p) => p.id === activeId) ?? null);
	let ammo = $derived(current ? ammoName(current) : '');

	let open = $state(false);
	/** The row tapped in the picker; put in use only by "Use this profile". */
	let pickedId = $state(null);
	let picked = $derived(shownProfiles.find((p) => p.id === pickedId) ?? null);

	function openPicker() {
		pickedId = activeId;
		open = true;
	}

	function close() {
		open = false;
	}

	function usePicked() {
		if (picked && picked.id !== activeProfile.id) activeProfile.setActive(picked.id);
		open = false;
	}

	const focusRing = 'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary-500';
	let actionText = $derived(current ? m.scope_view_profile_change() : m.scope_view_profile_choose());
	let buttonLabel = $derived(
		current
			? m.profile_picker_change_named({ name: profileTitle(current) })
			: m.profile_picker_choose_none()
	);
</script>

{#snippet name()}
	{#if current}
		{profileName(current)}{#if ammo}<span class="font-normal text-surface-600-400"> · {ammo}</span>{/if}
	{:else}
		{m.scope_view_profile_none()}
	{/if}
{/snippet}

{#snippet dot()}
	<span
		class="size-2 rounded-full shrink-0 {current ? 'bg-primary-500' : 'bg-surface-400-600'}"
		aria-hidden="true"
	></span>
{/snippet}

{#if variant === 'inline'}
	<div class="flex items-center gap-2.5 min-h-11 pl-3 pr-1 rounded-base bg-surface-50-950 text-[13px] {cls}">
		{@render dot()}
		<span class="flex-1 min-w-0 break-words">
			{#if label}{label}{' '}{/if}<strong class="font-semibold">{@render name()}</strong>
		</span>
		<button
			type="button"
			class="shrink-0 min-h-11 px-2.5 rounded-base font-semibold text-primary-700-300 hover:underline underline-offset-2 {focusRing}"
			aria-haspopup="dialog"
			aria-label={buttonLabel}
			onclick={openPicker}
		>
			{actionText}
		</button>
	</div>
{:else}
	<button
		type="button"
		class="flex items-center gap-2.5 max-w-full text-left rounded-container border border-surface-200-800 preset-filled-surface-100-900 hover:border-primary-500 {focusRing} {variant ===
		'compact'
			? 'h-11 px-3.5'
			: 'w-full min-h-12 px-3 py-1.5'} {cls}"
		aria-haspopup="dialog"
		aria-label={buttonLabel}
		onclick={openPicker}
	>
		{@render dot()}
		{#if variant === 'compact'}
			<span class="min-w-0 truncate text-sm font-semibold">{@render name()}</span>
		{:else}
			<span class="flex-1 min-w-0">
				<span class="block text-[11px] text-surface-600-400">{label ?? m.scope_view_active_profile()}</span>
				<span class="block text-sm font-semibold truncate">{@render name()}</span>
			</span>
		{/if}
		<span class="shrink-0 text-[13px] font-semibold text-primary-700-300">{actionText}</span>
	</button>
{/if}

{#if open}
	<ResponsiveDialog title={m.profile_picker_title()} onclose={close} width="sm:max-w-[460px]">
		{#if shownProfiles.length === 0}
			<p class="text-sm leading-relaxed text-surface-600-400">{m.profile_picker_empty()}</p>
			<a
				href={localizeHref('/profiles/new')}
				class="btn preset-filled-primary-500 h-12 gap-2 font-semibold {focusRing}"
				onclick={close}
			>
				<Plus class="size-[18px]" strokeWidth={2.5} aria-hidden="true" />
				{m.profiles_new()}
			</a>
		{:else}
			<p class="text-[13px] leading-snug text-surface-600-400">{m.profile_picker_intro()}</p>
			<ProfilePicker
				profiles={shownProfiles}
				selectedId={pickedId}
				onselect={(id) => (pickedId = id)}
				sortable={false}
				label={m.profile_picker_title()}
				rowLabel={(p) => profileTitle(p)}
			/>
			{#if picked}
				<ProfileSummaryCard
					profile={picked}
					eyebrow={picked.id === activeId ? m.profiles_in_use() : m.profile_picker_selected()}
					label={m.profile_picker_selected()}
					editHref={localizeHref(`/profiles/${picked.id}`)}
				/>
			{/if}
		{/if}

		{#snippet footer()}
			<div class="grid grid-cols-2 gap-2.5">
				<button
					type="button"
					class="btn h-12 border border-surface-300-700 hover:preset-tonal-surface text-[15px] font-medium {focusRing}"
					onclick={close}
				>
					{m.common_cancel()}
				</button>
				<button
					type="button"
					class="btn h-12 preset-filled-primary-500 text-[15px] font-semibold {focusRing}"
					disabled={!picked}
					onclick={usePicked}
				>
					{m.profile_picker_use()}
				</button>
			</div>
		{/snippet}
	</ResponsiveDialog>
{/if}
