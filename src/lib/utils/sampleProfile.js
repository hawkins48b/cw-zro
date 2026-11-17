/**
 * The sample profile (#150): the profile new users were given before #150 (then DEFAULT_PROFILE in
 * the profiles store). #175 added the M4's 1:7 barrel twist and the M193 bullet length (0.745 in,
 * as in the ammo library). Since #150 it is no longer stored on first launch; the Welcome screen's
 * "Try it with sample profiles" adds it, with SAMPLE_R700 (#175) as a second rifle. It has no id: profiles.add gives it a fresh one. Frozen, so that no caller can change it in place.
 */
export const SAMPLE_PROFILE = Object.freeze({
	name: 'Example Colt M4',
	barrelTwist: '7',
	barrelTwistUnit: 'in',
	opticName: 'Aimpoint CompM2',
	opticHeight: '3.5',
	opticHeightUnit: 'in',
	zeroDist: 25,
	zeroUnit: 'yd',
	bulletBrand: 'M193',
	bulletDiameter: '0.223',
	bulletDiameterUnit: 'in',
	bulletWeight: '55',
	bulletWeightUnit: 'gr',
	bcType: 'G1',
	bc: '0.285',
	bulletLength: '0.745',
	bulletLengthUnit: 'in',
	velocity: '3000',
	velocityUnit: 'fps',
	temperature: '59',
	temperatureUnit: 'f',
	tempModifier: '',
	spinDrift: false,
	tempSensitivity: false,
	reticleType: 'red-dot',
	elevationClickValue: '0.5',
	elevationClickUnit: 'MOA',
	windageClickValue: '0.5',
	windageClickUnit: 'MOA',
	clickLink: true,
	ammo: 'M193 55\u202fgr',
	optic: 'Aimpoint CompM2'
});

/**
 * The second sample profile (#175): a Remington 700 in .308 Winchester, so that the calculators can
 * be tried on a scoped bolt rifle as well. Ammo values are the library's "308 Winchester 7.62x51"
 * (150 gr, G1 0.435, 28.96 mm long); 1:10 twist (SPS Tactical), 2820 fps (150 gr factory load).
 */
export const SAMPLE_R700 = Object.freeze({
	name: 'Example Remington 700',
	barrelTwist: '10',
	barrelTwistUnit: 'in',
	opticName: 'Riflescope 4-16x44',
	opticHeight: '1.5',
	opticHeightUnit: 'in',
	zeroDist: 100,
	zeroUnit: 'yd',
	bulletBrand: '308 Winchester 7.62x51',
	bulletDiameter: '0.308',
	bulletDiameterUnit: 'in',
	bulletWeight: '150',
	bulletWeightUnit: 'gr',
	bcType: 'G1',
	bc: '0.435',
	bulletLength: '1.14',
	bulletLengthUnit: 'in',
	velocity: '2820',
	velocityUnit: 'fps',
	temperature: '59',
	temperatureUnit: 'f',
	tempModifier: '',
	spinDrift: false,
	tempSensitivity: false,
	reticleType: 'moa',
	elevationClickValue: '0.25',
	elevationClickUnit: 'MOA',
	windageClickValue: '0.25',
	windageClickUnit: 'MOA',
	clickLink: true,
	ammo: '308 Winchester 7.62x51 150\u202fgr',
	optic: 'Riflescope 4-16x44'
});

/** What the Welcome screen adds, in order; the first becomes the active profile. */
export const SAMPLE_PROFILES = Object.freeze([SAMPLE_PROFILE, SAMPLE_R700]);
