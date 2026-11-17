<script>
	/**
	 * Details of the profile in use, for the right pane of Profiles on tablet and desktop (#166):
	 * name with "In use", Edit profile, the 4 key numbers in a tonal strip, the spin drift and
	 * temperature states, then every field in two lists.
	 *
	 * @prop {object} profile    - As shownProfile gives it.
	 * @prop {string} editHref   - Edit page (already localized).
	 * @prop {import('svelte').Snippet} [actions] - Footer buttons (Duplicate, Export this profile, Delete).
	 */
	import { m } from '#lib/paraglide/messages.js';
	import { Pencil } from '@lucide/svelte';
	import {
		profileName,
		ammoName,
		withUnit,
		clickText,
		bcText,
		twistText,
		reticleText,
		tempModifierText
	} from './profileLabels.js';

	let { profile, editHref, actions } = $props();
	let p = $derived(profile);

	let subtitle = $derived(
		[ammoName(p), p.bulletWeight !== '' ? withUnit(p.bulletWeight, p.bulletWeightUnit) : '', p.opticName]
			.filter(Boolean)
			.join(' · ')
	);
	let keyNumbers = $derived([
		[m.profiles_key_zero(), withUnit(p.zeroDist, p.zeroUnit)],
		[m.profiles_key_velocity(), withUnit(p.velocity, p.velocityUnit)],
		[m.profiles_key_clicks(), clickText(p.elevationClickValue, p.elevationClickUnit)],
		[m.setup_ammo_bc(), bcText(p)]
	]);
	let rifle = $derived([
		[m.profile_rifle_barrel_twist(), twistText(p)],
		[m.profile_optic_name(), p.opticName || '—'],
		[m.profile_optic_height(), withUnit(p.opticHeight, p.opticHeightUnit)],
		[m.profile_optic_zero_dist(), withUnit(p.zeroDist, p.zeroUnit)],
		[m.profile_optic_reticle_type(), reticleText(p.reticleType)],
		[m.profile_optic_click_elevation(), clickText(p.elevationClickValue, p.elevationClickUnit)],
		[m.profile_optic_click_windage(), clickText(p.windageClickValue, p.windageClickUnit)]
	]);
	let ammo = $derived([
		[m.profile_ammo_diameter(), withUnit(p.bulletDiameter, p.bulletDiameterUnit)],
		[m.profile_ammo_weight(), withUnit(p.bulletWeight, p.bulletWeightUnit)],
		[m.profile_ammo_bc(), bcText(p)],
		[m.profile_ammo_length(), withUnit(p.bulletLength, p.bulletLengthUnit)]
	]);
	let measures = $derived([
		[m.profile_measures_velocity(), withUnit(p.velocity, p.velocityUnit)],
		[m.profile_measures_temperature(), p.tempSensitivity ? withUnit(p.temperature, p.temperatureUnit) : '—'],
		[m.profile_measures_temp_modifier(), p.tempSensitivity ? tempModifierText(p) : '—']
	]);
</script>

{#snippet list(heading, rows)}
	<div>
		<h3 class="mb-1 text-xs font-bold tracking-wider uppercase text-surface-600-400">{heading}</h3>
		<dl class="text-[13px] divide-y divide-surface-200-800">
			{#each rows as [term, value] (term)}
				<div class="flex justify-between gap-3 py-[7px]">
					<dt class="text-surface-600-400">{term}</dt>
					<dd class="font-semibold text-right tabular-nums break-words min-w-0">{value}</dd>
				</div>
			{/each}
		</dl>
	</div>
{/snippet}

<section
	aria-labelledby="profile-details-name"
	class="@container card preset-filled-surface-100-900 border border-surface-200-800 p-5 flex flex-col gap-4"
>
	<div class="flex flex-wrap items-start gap-3">
		<div class="flex-1 basis-60 min-w-0">
			<p class="flex flex-wrap items-center gap-2">
				<span id="profile-details-name" class="text-[22px] font-bold tracking-tight break-words">{profileName(p)}</span>
				<span class="px-2.5 py-0.5 rounded-full preset-tonal-primary text-[11px] font-bold tracking-wide uppercase">
					{m.profiles_in_use()}
				</span>
			</p>
			{#if subtitle}
				<p class="mt-1 text-sm text-surface-600-400 break-words">{subtitle}</p>
			{/if}
		</div>
		<a
			href={editHref}
			class="btn preset-outlined-surface-300-700 hover:preset-tonal-surface h-11 px-4 gap-2 text-sm font-semibold focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary-500"
		>
			<Pencil class="size-4" aria-hidden="true" />
			{m.profiles_edit_profile()}
		</a>
	</div>

	<dl class="rounded-base preset-tonal-primary px-4 py-3.5 grid grid-cols-2 @md:grid-cols-4 gap-2.5">
		{#each keyNumbers as [term, value] (term)}
			<div class="min-w-0">
				<dt class="text-xs">{term}</dt>
				<dd class="mt-0.5 text-lg font-bold tabular-nums">{value}</dd>
			</div>
		{/each}
	</dl>

	<div class="flex flex-wrap gap-1.5">
		<span
			class="h-7 px-3 rounded-full flex items-center text-xs font-semibold {p.spinDrift
				? 'preset-tonal-primary'
				: 'preset-tonal-surface text-surface-600-400'}"
		>
			{p.spinDrift ? m.profiles_spin_on() : m.profiles_spin_off()}
		</span>
		<span
			class="h-7 px-3 rounded-full flex items-center text-xs font-semibold {p.tempSensitivity
				? 'preset-tonal-primary'
				: 'preset-tonal-surface text-surface-600-400'}"
		>
			{p.tempSensitivity ? m.profiles_temp_on() : m.profiles_temp_off()}
		</span>
	</div>

	<div class="grid grid-cols-1 @lg:grid-cols-2 gap-x-6 gap-y-4">
		{@render list(m.profiles_details_rifle(), rifle)}
		<div class="flex flex-col gap-3.5">
			{@render list(m.profile_section_ammo(), ammo)}
			{@render list(m.profile_section_measures(), measures)}
		</div>
	</div>

	{@render actions?.()}
</section>
