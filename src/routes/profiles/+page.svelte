<script>
	/**
	 * Profiles (#166): the picker pattern. Tapping a row puts that profile in use; the summary card of
	 * the profile in use holds Edit, Duplicate, Export this profile and Delete. Export all and Import
	 * in the header. Phone: one column with a tonal summary; md and up: list left, details right.
	 */
	import { m } from '#lib/paraglide/messages.js';
	import { localizeHref } from '#lib/paraglide/runtime.js';
	import { profiles, importProfiles } from '#lib/stores/profiles.svelte.js';
	import { activeProfile, deleteProfile } from '#lib/stores/activeProfile.svelte.js';
	import { Plus, Upload, Download, Copy, Trash2 } from '@lucide/svelte';
	import { shownProfile } from '#lib/utils/storedProfiles.js';
	import { copyName, canDeleteProfile, nextActiveAfterDelete } from '#lib/utils/profileOps.js';
	import {
		downloadProfile,
		downloadAllProfiles,
		allProfilesExportFileName,
		profileExportFilename
	} from '#lib/utils/profileExport.js';
	import ProfilePicker from '#lib/components/ProfilePicker.svelte';
	import ProfileSummaryCard from '#lib/components/profile/ProfileSummaryCard.svelte';
	import ProfileDetailsCard from '#lib/components/profile/ProfileDetailsCard.svelte';
	import ProfileImportDialog from '#lib/components/profile/ProfileImportDialog.svelte';
	import ConfirmDialog from '#lib/components/ConfirmDialog.svelte';
	import Toast from '#lib/components/Toast.svelte';
	import { profileName } from '#lib/components/profile/profileLabels.js';

	// The profiles as the page shows them (#120): names are text, so they sort and search.
	let shownProfiles = $derived(profiles.list.map(shownProfile));
	let activeId = $derived(activeProfile.id);
	let current = $derived(shownProfiles.find((p) => p.id === activeId) ?? null);
	let canDelete = $derived(canDeleteProfile(profiles.list));

	/** Ids imported in this visit, marked New in the list. */
	let newIds = $state([]);
	let toast = $state('');
	let importDialog = $state(null);

	function use(id) {
		if (id !== activeProfile.id) activeProfile.setActive(id);
	}

	function duplicate() {
		const src = profiles.get(activeId);
		if (!src) return;
		const { id: _id, ...rest } = src;
		profiles.add({ ...rest, name: copyName(src) });
		toast = m.profiles_duplicated({ name: copyName(src) });
	}

	function exportOne() {
		const src = profiles.get(activeId);
		if (!src) return;
		if (downloadProfile(src)) {
			toast = m.profiles_exported_one({ name: profileName(current), file: profileExportFilename(current?.name) });
		}
	}

	function exportAll() {
		const now = new Date();
		const count = profiles.list.length;
		if (downloadAllProfiles(profiles.list, now)) {
			toast =
				count === 1
					? m.profiles_exported_all_one({ file: allProfilesExportFileName(now) })
					: m.profiles_exported_all({ count, file: allProfilesExportFileName(now) });
		}
	}

	// ── Delete ────────────────────────────────────────────────────────────
	let confirmDelete = $state(false);
	let nextName = $derived.by(() => {
		const id = nextActiveAfterDelete(profiles.list, activeId);
		const next = shownProfiles.find((p) => p.id === id);
		return next ? profileName(next) : '';
	});

	function doDelete() {
		const name = profileName(current);
		confirmDelete = false;
		if (deleteProfile(activeId)) toast = m.profiles_deleted({ name });
	}

	function imported(ids) {
		newIds = [...newIds, ...ids];
		if (ids.length > 0) toast = ids.length === 1 ? m.profiles_imported_one() : m.profiles_imported({ count: ids.length });
	}

	const focusRing = 'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary-500';
	const outlineBtn = `btn preset-outlined-surface-300-700 hover:preset-tonal-surface h-11 px-3.5 gap-2 text-sm font-semibold ${focusRing}`;
	let exportAllLabel = $derived(m.profiles_export_all({ count: profiles.list.length }));
</script>

<svelte:head>
	<title>{m.profiles_title()} — {m.app_name()}</title>
</svelte:head>

{#snippet newProfileButton(cls)}
	<a
		href={localizeHref('/profiles/new')}
		class="btn preset-filled-primary-500 gap-2 font-semibold {focusRing} {cls}"
	>
		<Plus class="size-[18px]" strokeWidth={2.5} aria-hidden="true" />
		{m.profiles_new()}
	</a>
{/snippet}

{#snippet phoneActions()}
	<div class="flex gap-1.5">
		<button type="button" class="btn flex-1 min-w-0 h-11 px-1 text-[13px] font-semibold bg-surface-50-950 {focusRing}" onclick={duplicate}>
			{m.profiles_duplicate()}
		</button>
		<button type="button" class="btn flex-[1.6] min-w-0 h-11 px-1 text-[13px] font-semibold bg-surface-50-950 {focusRing}" onclick={exportOne}>
			<span class="truncate">{m.profiles_export_this()}</span>
		</button>
		<button
			type="button"
			class="btn flex-1 min-w-0 h-11 px-1 text-[13px] font-semibold bg-surface-50-950 text-error-600-400 {focusRing}"
			disabled={!canDelete}
			title={canDelete ? undefined : m.profiles_delete_last()}
			onclick={() => (confirmDelete = true)}
		>
			{m.common_delete()}
		</button>
	</div>
	{#if !canDelete}
		<p class="-mt-1 text-xs">{m.profiles_delete_last()}</p>
	{/if}
{/snippet}

{#snippet paneActions()}
	<div class="flex flex-wrap items-center gap-2 pt-3 border-t border-surface-200-800">
		<button type="button" class={outlineBtn} onclick={duplicate}>
			<Copy class="size-4" aria-hidden="true" />
			{m.profiles_duplicate()}
		</button>
		<button type="button" class={outlineBtn} onclick={exportOne}>
			<Download class="size-4" aria-hidden="true" />
			{m.profiles_export_this()}
		</button>
		<span class="flex-1"></span>
		{#if !canDelete}
			<span class="text-xs text-surface-600-400">{m.profiles_delete_last()}</span>
		{/if}
		<button
			type="button"
			class="{outlineBtn} text-error-600-400"
			disabled={!canDelete}
			onclick={() => (confirmDelete = true)}
		>
			<Trash2 class="size-4" aria-hidden="true" />
			{m.common_delete()}
		</button>
	</div>
{/snippet}

<div class="flex flex-col gap-3 sm:gap-4 lg:gap-5">
	<!-- Header: title on tablet/desktop (the phone header shows it), Import, Export all, New profile -->
	<header class="flex flex-wrap items-center gap-x-4 gap-y-2">
		<div class="hidden md:block flex-1 basis-80 min-w-0">
			<h1 class="text-2xl lg:text-[28px] font-bold tracking-tight">{m.profiles_title()}</h1>
			<p class="mt-1 text-sm text-surface-600-400">{m.profiles_tap_intro()}</p>
		</div>
		<h1 class="sr-only md:hidden">{m.profiles_title()}</h1>
		{#if profiles.list.length > 0}
			<div class="flex gap-0.5 md:gap-2 -mt-1 md:mt-0 ml-auto md:ml-0">
				<button
					type="button"
					class="btn h-11 px-2.5 gap-1.5 text-sm font-semibold text-primary-700-300 md:text-surface-950-50 md:preset-outlined-surface-300-700 md:hover:preset-tonal-surface md:px-3.5 {focusRing}"
					aria-haspopup="dialog"
					onclick={() => importDialog?.chooseFiles()}
				>
					<Upload class="size-[17px]" aria-hidden="true" />
					{m.profiles_import()}
				</button>
				<button
					type="button"
					class="btn h-11 px-2.5 gap-1.5 text-sm font-semibold text-primary-700-300 md:text-surface-950-50 md:preset-outlined-surface-300-700 md:hover:preset-tonal-surface md:px-3.5 {focusRing}"
					onclick={exportAll}
				>
					<Download class="size-[17px]" aria-hidden="true" />
					{exportAllLabel}
				</button>
			</div>
			<div class="hidden md:block">
				{@render newProfileButton('h-11 px-[18px] text-sm')}
			</div>
		{/if}
	</header>

	{#if profiles.list.length === 0}
		<!-- Empty state: create one, or import a file -->
		<div class="card preset-filled-surface-100-900 border border-surface-200-800 p-5 flex flex-col gap-4 max-w-lg">
			<p class="text-sm leading-relaxed text-surface-600-400">{m.profiles_empty()}</p>
			{@render newProfileButton('w-full h-[50px] text-[15px]')}
			<button type="button" class="{outlineBtn} w-full" aria-haspopup="dialog" onclick={() => importDialog?.chooseFiles()}>
				<Upload class="size-4" aria-hidden="true" />
				{m.profiles_import()}
			</button>
		</div>
	{:else}
		<p class="md:hidden mx-1 text-sm leading-snug text-surface-600-400">{m.profiles_tap_intro()}</p>

		<div class="flex flex-col gap-2.5 md:flex-row md:items-start md:gap-5 lg:gap-6">
			<!-- List -->
			<div class="md:w-[320px] lg:w-[380px] md:shrink-0 min-w-0">
				<ProfilePicker
					profiles={shownProfiles}
					selectedId={activeId}
					onselect={use}
					{newIds}
					label={m.profiles_title()}
					rowLabel={(p) => m.profiles_use_named({ name: profileName(p) })}
					showCount
				/>
			</div>

			<!-- Profile in use -->
			{#if current}
				<div class="md:hidden">
					<ProfileSummaryCard
						profile={current}
						editHref={localizeHref(`/profiles/${current.id}`)}
						actions={phoneActions}
					/>
				</div>
				<div class="hidden md:block flex-1 min-w-0">
					<ProfileDetailsCard
						profile={current}
						editHref={localizeHref(`/profiles/${current.id}`)}
						actions={paneActions}
					/>
				</div>
			{/if}
		</div>

		<div class="md:hidden pt-1">
			{@render newProfileButton('w-full h-[50px] text-[15px]')}
		</div>
	{/if}
</div>

<ProfileImportDialog
	bind:this={importDialog}
	existing={profiles.list}
	inUseName={current ? profileName(current) : ''}
	onimport={importProfiles}
	ondone={imported}
/>

{#if confirmDelete && current}
	<ConfirmDialog
		title={m.profiles_delete()}
		message={nextName
			? m.profiles_delete_confirm_next({ name: profileName(current), next: nextName })
			: m.profiles_delete_confirm({ name: profileName(current) })}
		confirmLabel={m.common_delete()}
		onconfirm={doDelete}
		oncancel={() => (confirmDelete = false)}
	/>
{/if}

<Toast message={toast} ondismiss={() => (toast = '')} />
