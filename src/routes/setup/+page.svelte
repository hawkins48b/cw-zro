<script>
	// Guided profile setup (#150). The layout renders this route without navigation. Since #177 every
	// "+ New profile" link opens it too; the full profile form stays at /profiles/new.
	import { goto, afterNavigate } from '$app/navigation';
	import { localizeHref, deLocalizeHref } from '#lib/paraglide/runtime.js';
	import { m } from '#lib/paraglide/messages.js';
	import GuidedSetup from '#lib/components/GuidedSetup.svelte';
	import { setupProfileData } from '#lib/utils/profileValidation.js';
	import { FULL_FORM_PATH, setupSavedTarget, setupStepErrors } from '#lib/utils/setupSteps.js';
	import { profiles } from '#lib/stores/profiles.svelte.js';
	import { activeProfile } from '#lib/stores/activeProfile.svelte.js';
	import { isFirstRun } from '#lib/utils/firstRun.js';

	/** The page this one was opened from, without a language prefix; null when opened directly. */
	let fromPath = null;
	afterNavigate(({ from }) => {
		fromPath = from?.url ? deLocalizeHref(from.url.pathname) : null;
	});

	let saved = false;

	// First run (no usable profile yet): no "Use the full form" link, so it stays the guided path of #150.
	const firstRunAtOpen = isFirstRun(profiles.list);

	/** The profile form's errors, kept to the fields of this step; step 4 follows its switches. */
	function validateStep(step, form, advanced) {
		return setupStepErrors(step, form, advanced);
	}

	/** Nothing is stored before this: leaving the setup midway saves nothing. */
	function save(form, advanced) {
		if (saved) return;
		const data = setupProfileData(form, advanced?.spinDrift, advanced?.tempSensitivity);
		// Every step was checked with the same validation, so this does not happen; store nothing.
		if (!data) return;
		// Before the profile is added: is this the first one?
		const target = setupSavedTarget({ firstRun: isFirstRun(profiles.list), fromPath });
		saved = true;
		const id = profiles.add(data);
		activeProfile.setActive(id);
		if (target.back) history.back();
		else goto(localizeHref(target.path), { replace: true });
	}

	/** Back on step 1. */
	function exit() {
		if (isFirstRun(profiles.list)) {
			// First run: back to the Welcome screen. From it, a history step back; opened directly,
			// replace this page, so that Back does not return to an empty setup.
			if (fromPath === '/welcome') history.back();
			else goto(localizeHref('/welcome'), { replace: true });
		} else if (fromPath !== null) {
			history.back();
		} else {
			goto(localizeHref('/profiles'), { replace: true });
		}
	}
</script>

<svelte:head>
	<title>{m.profiles_new()} — {m.app_name()}</title>
</svelte:head>

<GuidedSetup
	onValidateStep={validateStep}
	onSave={save}
	onExit={exit}
	fullFormHref={firstRunAtOpen ? '' : localizeHref(FULL_FORM_PATH)}
/>
