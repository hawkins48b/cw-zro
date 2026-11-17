/**
 * Whether a package licence needs a closer look (#166, Licences page): anything that is not a plain
 * permissive licence, such as LGPL-3.0 (bclibc) or the ApexCharts licence, is highlighted.
 * This only picks a highlight; the full texts are on the Licences page.
 */

/** SPDX ids read as permissive: no terms beyond keeping the notice. */
const PERMISSIVE = new Set([
	'MIT',
	'MIT-0',
	'ISC',
	'0BSD',
	'BSD-2-Clause',
	'BSD-3-Clause',
	'Apache-2.0',
	'CC0-1.0',
	'Unlicense',
	'BlueOak-1.0.0',
	'Zlib',
	'Python-2.0',
	'CC-BY-4.0'
]);

/**
 * @param {unknown} license - An SPDX id or expression ("MIT", "(MIT OR Apache-2.0)"), or any text.
 * @returns {boolean} true when the licence carries terms beyond a permissive one, or is unknown
 */
export function hasExtraTerms(license) {
	if (typeof license !== 'string' || license.trim() === '') return true;
	const expr = license.trim().replace(/^\((.*)\)$/, '$1');
	// One permissive alternative is enough; every part of an AND must be permissive.
	return !expr
		.split(/\s+OR\s+/i)
		.some((alt) => alt.replace(/[()]/g, '').split(/\s+AND\s+/i).every((id) => PERMISSIVE.has(id.trim())));
}
