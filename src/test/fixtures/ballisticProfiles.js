/**
 * Shared inputs for the ballistics reference tests (#70).
 *
 * The profile shape is the flat v2 profile from the profiles store, with the same string
 * fields the form produces. These are representative loads chosen to exercise the code paths
 * (calibers, G1/G7, imperial/metric inputs, subsonic transition); they are NOT published load
 * data. Published data lives in ballistics.published.test.js, next to its source.
 */

const imperialProfile = {
	barrelTwistUnit: 'in',
	opticHeightUnit: 'in',
	zeroUnit: 'yd',
	bulletDiameterUnit: 'in',
	bulletWeightUnit: 'gr',
	bulletLengthUnit: 'in',
	velocityUnit: 'fps',
	temperature: '59',
	temperatureUnit: 'f',
	tempModifier: '',
	spinDrift: false,
	tempSensitivity: false
};

/** .223, 55 gr, G1, imperial inputs. Goes subsonic before 1000 yd. */
export const P223_G1 = {
	...imperialProfile,
	name: '.223 55 gr G1',
	barrelTwist: '9',
	opticHeight: '2.5',
	zeroDist: 100,
	bulletDiameter: '0.224',
	bulletWeight: '55',
	bcType: 'G1',
	bc: '0.255',
	bulletLength: '0.75',
	velocity: '3240'
};

/** .308, 168 gr, G1, imperial inputs. */
export const P308_G1 = {
	...imperialProfile,
	name: '.308 168 gr G1',
	barrelTwist: '10',
	opticHeight: '1.5',
	zeroDist: 100,
	bulletDiameter: '0.308',
	bulletWeight: '168',
	bcType: 'G1',
	bc: '0.462',
	bulletLength: '1.215',
	velocity: '2650'
};

/** 6.5 Creedmoor, 140 gr, G7, imperial inputs, spin drift on. */
export const P65_G7 = {
	...imperialProfile,
	name: '6.5 CM 140 gr G7',
	barrelTwist: '8',
	opticHeight: '1.9',
	zeroDist: 100,
	bulletDiameter: '0.264',
	bulletWeight: '140',
	bcType: 'G7',
	bc: '0.305',
	bulletLength: '1.35',
	velocity: '2710',
	spinDrift: true
};

/** .338 Lapua Magnum, 16.2 g, G7, every input metric, spin drift on. */
export const P338_G7_METRIC = {
	name: '.338 LM 16.2 g G7',
	barrelTwist: '254',
	barrelTwistUnit: 'mm',
	opticHeight: '5',
	opticHeightUnit: 'cm',
	zeroDist: 100,
	zeroUnit: 'm',
	bulletDiameter: '8.59',
	bulletDiameterUnit: 'mm',
	bulletWeight: '16.2',
	bulletWeightUnit: 'g',
	bcType: 'G7',
	bc: '0.322',
	bulletLength: '39.6',
	bulletLengthUnit: 'mm',
	velocity: '905',
	velocityUnit: 'mps',
	temperature: '15',
	temperatureUnit: 'c',
	tempModifier: '',
	spinDrift: true,
	tempSensitivity: false
};

/**
 * P308_G1 with every input converted exactly to metric (1 in = 25.4 mm, 1 yd = 0.9144 m,
 * 1 ft = 0.3048 m, 1 gr = 0.06479891 g). The results must match P308_G1.
 */
export const P308_G1_METRIC_EXACT = {
	...P308_G1,
	name: '.308 168 gr G1 (exact metric)',
	barrelTwist: '254',
	barrelTwistUnit: 'mm',
	opticHeight: '3.81',
	opticHeightUnit: 'cm',
	zeroDist: 91.44,
	zeroUnit: 'm',
	bulletDiameter: '7.8232',
	bulletDiameterUnit: 'mm',
	bulletWeight: '10.88621688',
	bulletWeightUnit: 'g',
	bulletLength: '30.861',
	bulletLengthUnit: 'mm',
	velocity: '807.72',
	velocityUnit: 'mps'
};

/** The same load as a user would type it in metric, rounded to what a box or scale shows. */
export const P308_G1_METRIC_ROUNDED = {
	...P308_G1_METRIC_EXACT,
	name: '.308 168 gr G1 (rounded metric)',
	opticHeight: '3.8',
	zeroDist: 91.4,
	bulletDiameter: '7.82',
	bulletWeight: '10.9',
	bulletLength: '30.9',
	velocity: '808'
};

/** Hot, thin air, imperial inputs. */
export const ATMO_HOT_ALTITUDE = {
	altitude: '5000',
	altitudeUnit: 'ft',
	pressure: '24.9',
	pressureUnit: 'inhg',
	temperature: '85',
	temperatureUnit: 'f',
	humidity: '35'
};

/** Cold, thin air, metric inputs. */
export const ATMO_COLD_METRIC = {
	altitude: '1500',
	altitudeUnit: 'm',
	pressure: '845',
	pressureUnit: 'hpa',
	temperature: '-5',
	temperatureUnit: 'c',
	humidity: '60'
};

/** Full-value crosswinds as the wind control produces them (90 = from the left). */
export const WIND_10MPH = { speed: '10', speedUnit: 'mph', direction: '90' };
export const WIND_4MPS = { speed: '4', speedUnit: 'mps', direction: '90' };
