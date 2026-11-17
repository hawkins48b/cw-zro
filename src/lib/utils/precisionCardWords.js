/**
 * The words of the precision dope card (#157), EN, FR and DE. One table for both sides:
 * `scripts/precision-card-templates.js` prints the static words into the templates
 * (`static/pdf/precision-<locale>-<units>.pdf`), and precisionCardPdf.js draws the words that
 * depend on the data (clicks, MRAD or MOA, left or right, page) and measures the template words
 * it writes next to. Change a word here, then run `npm run templates:precision`.
 *
 * The PDF fonts are the standard Helvetica fonts, which encode WinAnsi only: keep to Western
 * European characters (no U+2212 minus, no narrow no-break space).
 *
 * The app's messages are in messages/*.json. These words are not, because the templates are built
 * by a Node script, and the PDF wording follows the printed card, not the screens. German follows
 * the app's "DOPE-Karte"; French uses "Abaque" (owner decision on #157).
 */

/** @typedef {typeof EN} PrecisionWords */

const EN = Object.freeze({
	title: 'Precision dope card',
	groupRifle: 'Rifle and optic',
	groupAmmo: 'Ammunition',
	groupCard: 'Card',
	zero: 'Zero',
	sightHeight: 'Sight height',
	reticle: 'Reticle',
	click: 'Click',
	twist: 'Twist',
	optic: 'Optic',
	velocity: 'Muzzle vel.',
	bc: 'BC',
	weight: 'Weight',
	diameter: 'Diameter',
	length: 'Length',
	powder: 'Powder sens.',
	distances: 'Distances',
	corrections: 'Corrections',
	refPressure: 'Ref. pressure',
	refTemperature: 'Ref. temp.',
	wind: 'Wind',
	worksheet: 'Worksheet',
	disclaimer: 'Check the card against your own shots before relying on it.',
	distance: 'Distance',
	elevation: 'Elevation',
	spinDrift: 'Spin drift',
	timeOfFlight: 'Time of flight',
	firingData: 'Firing data',
	data: 'Data',
	elevationSection: 'Elevation',
	windageSection: 'Windage',
	pageDistance: 'Page distance',
	extraDistance: 'Extra distance',
	pressure: 'Pressure',
	temperature: 'Temperature',
	elevationTurret: 'Elevation turret',
	windageTurret: 'Windage turret',
	leftOrRight: 'L / R',
	// Drawn at fill time
	clickOne: 'click',
	clickMany: 'clicks',
	clicksHeader: 'Clicks',
	left: 'Left',
	right: 'Right',
	leftShort: 'L',
	rightShort: 'R',
	twistLeft: 'left',
	twistRight: 'right',
	page: 'page'
});

const FR = Object.freeze({
	title: 'Abaque de précision',
	groupRifle: 'Arme et optique',
	groupAmmo: 'Munition',
	groupCard: 'Abaque',
	zero: 'Zéro',
	sightHeight: 'Haut. optique',
	reticle: 'Réticule',
	click: 'Clic',
	twist: 'Pas',
	optic: 'Optique',
	velocity: 'Vitesse init.',
	bc: 'CB',
	weight: 'Poids',
	diameter: 'Diamètre',
	length: 'Longueur',
	powder: 'Sens. therm.',
	distances: 'Distances',
	corrections: 'Corrections',
	refPressure: 'Pression réf.',
	refTemperature: 'Temp. réf.',
	wind: 'Vent',
	worksheet: 'Calcul',
	disclaimer: 'Vérifiez l\'abaque avec vos propres tirs avant de vous y fier.',
	distance: 'Distance',
	elevation: 'Élévation',
	spinDrift: 'Dérive gyro.',
	timeOfFlight: 'Temps de vol',
	firingData: 'Éléments de tir',
	data: 'Données',
	elevationSection: 'Élévation',
	windageSection: 'Dérive',
	pageDistance: 'Distance page',
	extraDistance: 'Distance en plus',
	pressure: 'Pression',
	temperature: 'Température',
	elevationTurret: 'Tourelle élévation',
	windageTurret: 'Tourelle dérive',
	leftOrRight: 'G / D',
	clickOne: 'clic',
	clickMany: 'clics',
	clicksHeader: 'Clics',
	left: 'Gauche',
	right: 'Droite',
	leftShort: 'G',
	rightShort: 'D',
	twistLeft: 'gauche',
	twistRight: 'droite',
	page: 'page'
});

const DE = Object.freeze({
	title: 'Präzisions-DOPE-Karte',
	groupRifle: 'Gewehr und Optik',
	groupAmmo: 'Munition',
	groupCard: 'Karte',
	zero: 'Null',
	sightHeight: 'Optikhöhe',
	reticle: 'Absehen',
	click: 'Klick',
	twist: 'Drall',
	optic: 'Optik',
	velocity: 'V0',
	bc: 'BC',
	weight: 'Gewicht',
	diameter: 'Durchm.',
	length: 'Länge',
	powder: 'Temp.-Empf.',
	distances: 'Distanzen',
	corrections: 'Korrekturen',
	refPressure: 'Ref.-Druck',
	refTemperature: 'Ref.-Temp.',
	wind: 'Wind',
	worksheet: 'Rechenblatt',
	disclaimer: 'Prüfen Sie die Karte mit eigenen Schüssen, bevor Sie sich darauf verlassen.',
	distance: 'Distanz',
	elevation: 'Höhe',
	spinDrift: 'Spin-Drift',
	timeOfFlight: 'Flugzeit',
	firingData: 'Schusselemente',
	data: 'Daten',
	elevationSection: 'Höhe',
	windageSection: 'Seite',
	pageDistance: 'Seitendistanz',
	extraDistance: 'Zusatzdistanz',
	pressure: 'Luftdruck',
	temperature: 'Temperatur',
	elevationTurret: 'Höhenturm',
	windageTurret: 'Seitenturm',
	leftOrRight: 'L / R',
	clickOne: 'Klick',
	clickMany: 'Klicks',
	clicksHeader: 'Klicks',
	left: 'Links',
	right: 'Rechts',
	leftShort: 'L',
	rightShort: 'R',
	twistLeft: 'links',
	twistRight: 'rechts',
	page: 'Seite'
});

/** The languages of the card. */
export const PRECISION_LOCALES = Object.freeze(['en', 'fr', 'de']);

const WORDS = Object.freeze({ en: EN, fr: FR, de: DE });

/**
 * The card language for an app locale: 'fr' or 'de', and 'en' for anything else.
 * @param {unknown} locale
 * @returns {'en'|'fr'|'de'}
 */
export function precisionLocale(locale) {
	return locale === 'fr' || locale === 'de' ? locale : 'en';
}

/**
 * The words of a language, 'en' for an unknown one.
 * @param {unknown} locale
 * @returns {PrecisionWords}
 */
export function precisionWords(locale) {
	return WORDS[precisionLocale(locale)];
}
