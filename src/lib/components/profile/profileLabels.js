/**
 * Text for showing a profile on the Profiles screens and in the profile picker (#166). Display only:
 * each takes a profile as shownProfile gives it (storedProfiles.js) or a profile form, and never
 * changes a value. Numbers are shown in the current locale, without rounding them away.
 */
import { m } from '#lib/paraglide/messages.js';
import { formatNumber } from '#lib/utils/format.js';

const UNIT_LABELS = {
	in: () => m.unit_in(),
	mm: () => m.unit_mm(),
	cm: () => m.unit_cm(),
	gr: () => m.unit_gr(),
	g: () => m.unit_g(),
	yd: () => m.unit_yd(),
	m: () => m.unit_m(),
	fps: () => m.unit_fps(),
	mps: () => m.unit_mps(),
	f: () => m.unit_f(),
	c: () => m.unit_c()
};

const RETICLE_LABELS = {
	'red-dot': () => m.scope_view_reticle_red_dot(),
	moa: () => m.scope_view_reticle_moa(),
	mrad: () => m.scope_view_reticle_mrad(),
	'mil-dot': () => m.scope_view_reticle_mil_dot()
};

/** The unit as the app writes it ("gr", "m/s"); an unknown unit as given. */
export function unitLabel(unit) {
	const key = String(unit ?? '').toLowerCase();
	return UNIT_LABELS[key]?.() ?? String(unit ?? '');
}

/** Whether a field holds something to show. */
export function hasValue(value) {
	return value !== '' && value !== null && value !== undefined && String(value).trim() !== '';
}

/** A typed value in the current locale ("0,505" in French); text that is not a number as typed. */
export function numberText(value) {
	if (!hasValue(value)) return '—';
	const n = Number(String(value).trim().replace(',', '.'));
	return Number.isFinite(n) ? formatNumber(n, { maximumFractionDigits: 6 }) : String(value);
}

/** "174 gr", or "—" when the value is empty. */
export function withUnit(value, unit) {
	return hasValue(value) ? `${numberText(value)} ${unitLabel(unit)}` : '—';
}

/** "0.505 G1", or "—". */
export function bcText(p) {
	return hasValue(p.bc) ? `${numberText(p.bc)} ${p.bcType}` : '—';
}

/** "MRAD 0.1" (the turret unit first, as on the profile cards), or "—". */
export function clickText(value, unit) {
	return hasValue(value) ? `${unit} ${numberText(value)}` : '—';
}

/** "1/270 mm", or "—". */
export function twistText(p) {
	return hasValue(p.barrelTwist) ? `1/${numberText(p.barrelTwist)} ${unitLabel(p.barrelTwistUnit)}` : '—';
}

/** "MRAD", "Red Dot"… */
export function reticleText(type) {
	return RETICLE_LABELS[type]?.() ?? String(type ?? '');
}

/** The rifle name, or "Unnamed profile". */
export function profileName(p) {
	return p?.name?.trim() ? p.name : m.scope_view_profile_unnamed();
}

/** The ammunition name: the bullet brand, else the stored ammo text. */
export function ammoName(p) {
	const brand = p?.bulletBrand?.trim();
	if (brand) return brand;
	const ammo = p?.ammo?.trim();
	return ammo && ammo !== '—' ? ammo : '';
}

/** "K31 · GP 11 7.5x55", the rifle alone when there is no ammunition. */
export function profileTitle(p) {
	const ammo = ammoName(p);
	return ammo ? `${profileName(p)} · ${ammo}` : profileName(p);
}

/** Detail line of a profile row: "GP 11 7.5x55 · 174 gr · Zero 200 m", empty parts left out. */
export function profileRowDetail(p) {
	const parts = [];
	const ammo = ammoName(p);
	if (ammo) parts.push(ammo);
	if (hasValue(p.bulletWeight)) parts.push(withUnit(p.bulletWeight, p.bulletWeightUnit));
	if (hasValue(p.zeroDist)) parts.push(m.profiles_meta_zero({ distance: withUnit(p.zeroDist, p.zeroUnit) }));
	return parts.join(' · ');
}

/** "15 °C · 1.2 fps/°C" when temperature sensitivity is on, else "Not corrected". */
export function temperatureText(p, sensitivity = p.tempSensitivity) {
	if (!sensitivity) return m.profile_editor_temp_off();
	const modUnit = p.temperatureUnit === 'c' ? m.unit_fps_per_c() : m.unit_fps_per_f();
	const parts = [withUnit(p.temperature, p.temperatureUnit)];
	if (hasValue(p.tempModifier)) parts.push(`${numberText(p.tempModifier)} ${modUnit}`);
	return parts.join(' · ');
}

/** "15 °C" … the temperature modifier alone ("1.2 fps/°C"), or "—". */
export function tempModifierText(p) {
	if (!hasValue(p.tempModifier)) return '—';
	const modUnit = p.temperatureUnit === 'c' ? m.unit_fps_per_c() : m.unit_fps_per_f();
	return `${numberText(p.tempModifier)} ${modUnit}`;
}

/** "1/270 mm · 31.75 mm" when spin drift is on, else "Off". */
export function spinText(p, spin = p.spinDrift) {
	if (!spin) return m.profile_editor_off();
	return `${twistText(p)} · ${withUnit(p.bulletLength, p.bulletLengthUnit)}`;
}
