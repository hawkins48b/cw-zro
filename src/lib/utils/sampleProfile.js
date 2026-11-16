/**
 * The sample profile (#150): the profile new users were given before #150 (then DEFAULT_PROFILE in
 * the profiles store), values unchanged. Since #150 it is no longer stored on first launch; the
 * Welcome screen's "Try it with a sample profile" adds it. It has no id: profiles.add gives it a
 * fresh one. Frozen, so that no caller can change it in place.
 */
export const SAMPLE_PROFILE = Object.freeze({
	name: 'Example Colt M4',
	barrelTwist: '',
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
	bulletLength: '',
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
