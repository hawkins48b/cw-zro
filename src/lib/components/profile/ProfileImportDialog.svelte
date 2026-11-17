<script>
	/**
	 * Import profiles (#166): pick one or several .json files (single profile or "export all",
	 * mixed), review them with the picker pattern (all checked, tap to leave one out), confirm.
	 * Full-screen sheet on phones, dialog on tablet and desktop (ResponsiveDialog).
	 *
	 * Call `chooseFiles()` (bind:this) from the Import button: it opens the file chooser, reads the
	 * files and opens the review. Nothing is imported until "Import N profiles".
	 *
	 * @prop {object[]} existing   - profiles.list (as stored), for copy names.
	 * @prop {string}   inUseName  - Name of the profile in use, which stays in use.
	 * @prop {(profiles: object[]) => string[] | null} onimport - Stores the kept profiles
	 *                               (importProfiles), returns their new ids, or null when storage
	 *                               refused them: the dialog stays open with a message.
	 * @prop {(ids: string[]) => void} [ondone] - After an import, with the new ids.
	 */
	import { m } from '#lib/paraglide/messages.js';
	import { FileWarning } from '@lucide/svelte';
	import ResponsiveDialog from '#lib/components/ResponsiveDialog.svelte';
	import ProfilePicker from '#lib/components/ProfilePicker.svelte';
	import { parseProfileFile, planImport, isImportFileTooLarge } from '#lib/utils/profileImport.js';
	import { shownProfile } from '#lib/utils/storedProfiles.js';

	let { existing = [], inUseName = '', onimport, ondone } = $props();

	let open = $state(false);
	let fileInput = $state(null);
	/** parseProfileFile results, in the order the files were added. */
	let parsed = $state([]);
	/** Candidates left out, by their index in the plan (keys are new on every plan). */
	let offIndexes = $state(new Set());
	let reading = $state(false);
	/** Storage refused the import (full or blocked): nothing was added. */
	let saveFailed = $state(false);

	// planImport gives new ids each time it runs, so it runs only when the files change.
	let plan = $state({ candidates: [], errors: [], skipped: [] });

	function replan() {
		plan = planImport(existing, parsed);
		saveFailed = false;
	}

	/** Opens the file chooser; the review opens once the files are read. */
	export function chooseFiles() {
		fileInput?.click();
	}

	async function onfiles(e) {
		const input = /** @type {HTMLInputElement} */ (e.currentTarget);
		const files = [...(input.files ?? [])];
		input.value = '';
		if (files.length === 0) return;
		reading = true;
		const results = [];
		for (const file of files) {
			// The size is checked before reading, so a huge file is never loaded.
			if (isImportFileTooLarge(file.size)) {
				results.push(parseProfileFile(file.name, '', { size: file.size }));
				continue;
			}
			let text = '';
			try {
				text = await file.text();
			} catch {
				text = '';
			}
			results.push(parseProfileFile(file.name, text, { size: file.size }));
		}
		parsed = [...parsed, ...results];
		replan();
		reading = false;
		open = true;
	}

	function close() {
		open = false;
		parsed = [];
		offIndexes = new Set();
		plan = { candidates: [], errors: [], skipped: [] };
		saveFailed = false;
	}

	let candidates = $derived(plan.candidates);
	let checkedIds = $derived(candidates.filter((_, i) => !offIndexes.has(i)).map((c) => c.key));
	let kept = $derived(candidates.filter((_, i) => !offIndexes.has(i)));

	function toggle(key) {
		const i = candidates.findIndex((c) => c.key === key);
		if (i === -1) return;
		const next = new Set(offIndexes);
		if (next.has(i)) next.delete(i);
		else next.add(i);
		offIndexes = next;
	}

	// Rows: shown as the lists show profiles, with the candidate key as id.
	let rows = $derived(candidates.map((c) => ({ ...shownProfile(c.profile), id: c.key })));
	let notes = $derived(
		Object.fromEntries(
			candidates.filter((c) => c.renamed).map((c) => [c.key, m.import_renamed({ name: c.profile.name })])
		)
	);

	/** One group per readable file: "file.json · Export of all profiles". */
	let groups = $derived.by(() => {
		const out = [];
		for (const result of parsed) {
			if (!result.ok || out.some((g) => g.fileName === result.fileName)) continue;
			const ids = candidates.filter((c) => c.fileName === result.fileName).map((c) => c.key);
			// A file refused by the total cap (too_many_total) is listed with the errors instead.
			if (ids.length === 0) continue;
			const kind = result.profiles.length > 1 ? m.import_kind_all() : m.import_kind_one();
			const skipped = plan.skipped.find((s) => s.fileName === result.fileName)?.count ?? 0;
			out.push({
				fileName: result.fileName,
				heading: `${result.fileName} · ${kind}`,
				note: skipped > 0 ? (skipped === 1 ? m.import_skipped_one() : m.import_skipped({ count: skipped })) : '',
				ids
			});
		}
		return out;
	});

	const REASONS = {
		too_large: () => m.import_reason_too_large(),
		empty: () => m.import_reason_empty(),
		not_json: () => m.import_reason_not_json(),
		unknown_format: () => m.import_reason_unknown_format(),
		unsupported_version: () => m.import_reason_unsupported_version(),
		too_many_profiles: () => m.import_reason_too_many_profiles(),
		no_valid_profiles: () => m.import_reason_no_valid_profiles(),
		too_many_total: () => m.import_reason_too_many_total()
	};

	let fileCount = $derived(parsed.length);
	let foundText = $derived(
		m.import_found({
			profiles: candidates.length === 1 ? m.profiles_count_one() : m.profiles_count({ count: candidates.length }),
			files: fileCount === 1 ? m.import_files_one() : m.import_files({ count: fileCount })
		})
	);
	let n = $derived(kept.length);
	let confirmLabel = $derived(
		n === 0 ? m.profiles_import() : n === 1 ? m.import_confirm_one() : m.import_confirm({ count: n })
	);
	let summary = $derived.by(() => {
		const total = candidates.length;
		if (inUseName) {
			return n === 1
				? m.import_summary_one({ total, name: inUseName })
				: m.import_summary({ count: n, total, name: inUseName });
		}
		return n === 1 ? m.import_summary_unnamed_one({ total }) : m.import_summary_unnamed({ count: n, total });
	});

	function confirm() {
		if (n === 0) return;
		const ids = onimport?.(kept.map((c) => c.profile)) ?? [];
		if (ids === null) {
			saveFailed = true;
			return;
		}
		close();
		ondone?.(ids);
	}

	const focusRing = 'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary-500';
</script>

<input
	bind:this={fileInput}
	type="file"
	accept=".json,application/json"
	multiple
	class="hidden"
	tabindex="-1"
	aria-hidden="true"
	onchange={onfiles}
/>

{#if open}
	<ResponsiveDialog title={m.import_title()} onclose={close}>
		{#snippet actions()}
			<button
				type="button"
				class="btn h-11 px-2.5 text-sm font-semibold text-primary-700-300 hover:preset-tonal-surface {focusRing}"
				disabled={reading}
				onclick={chooseFiles}
			>
				{m.import_add_files()}
			</button>
		{/snippet}

		{#if candidates.length > 0}
			<p class="text-sm leading-relaxed text-surface-600-400">{foundText}</p>
			<ProfilePicker
				profiles={rows}
				multiple
				{checkedIds}
				ontoggle={toggle}
				{notes}
				{groups}
				searchable={false}
				sortable={false}
				label={m.import_title()}
				listClass="shrink-0 sm:max-h-[50vh]"
			/>
		{:else}
			<p class="text-sm leading-relaxed text-surface-600-400" role="status">{m.import_nothing()}</p>
		{/if}

		{#each plan.errors as error, i (i)}
			<div role="note" class="shrink-0 card preset-filled-surface-100-900 border border-surface-200-800 px-3.5 py-2.5 flex items-start gap-2.5 text-[13px] leading-snug">
				<FileWarning class="size-[18px] shrink-0 mt-px text-error-600-400" aria-hidden="true" />
				<span class="min-w-0">
					<strong class="font-semibold break-all">{error.fileName}</strong>
					<span class="block">{REASONS[error.reason]?.() ?? m.import_reason_unknown_format()} {m.import_bad_tail()}</span>
				</span>
			</div>
		{/each}

		{#if saveFailed}
			<div role="alert" class="shrink-0 card preset-tonal-error px-3.5 py-2.5 flex items-start gap-2.5 text-[13px] leading-snug">
				<FileWarning class="size-[18px] shrink-0 mt-px" aria-hidden="true" />
				<span class="min-w-0">{m.import_save_failed()}</span>
			</div>
		{/if}

		{#if candidates.length > 0}
			<div class="shrink-0 card preset-tonal-primary px-3.5 py-3 text-[13px] leading-snug" aria-live="polite">
				<strong class="font-bold">{summary}</strong>
				{m.import_new_ids()}
			</div>
		{/if}

		{#snippet footer()}
			<div class="grid grid-cols-2 gap-2.5">
				<button
					type="button"
					class="btn preset-outlined-surface-300-700 hover:preset-tonal-surface h-[50px] text-[15px] {focusRing}"
					onclick={close}
				>
					{m.common_cancel()}
				</button>
				<button
					type="button"
					class="btn preset-filled-primary-500 h-[50px] text-[15px] font-semibold {focusRing}"
					disabled={n === 0}
					onclick={confirm}
				>
					{confirmLabel}
				</button>
			</div>
		{/snippet}
	</ResponsiveDialog>
{/if}
