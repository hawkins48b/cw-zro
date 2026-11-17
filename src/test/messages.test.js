/**
 * Paraglide only warns when it cannot load the messages, and the build then succeeds with an empty
 * catalog, so the app would ship showing raw keys. This fails instead.
 */
import { describe, it, expect } from 'vitest';
import { m } from '#lib/paraglide/messages.js';
import en from '../../messages/en.json';
import fr from '../../messages/fr.json';
import de from '../../messages/de.json';

const catalogs = { en, fr, de };
const keys = (catalog) => Object.keys(catalog).filter((key) => !key.startsWith('$'));

describe('message catalog', () => {
	it('has a real catalog to check', () => {
		expect(keys(en).length).toBeGreaterThan(300);
	});

	it.each(['fr', 'de'])('has the same keys in %s as in en', (locale) => {
		expect(keys(catalogs[locale]).sort()).toEqual(keys(en).sort());
	});

	it.each(['en', 'fr', 'de'])('compiles every message for %s', (locale) => {
		const missing = keys(en).filter((key) => {
			const text = m[key]?.({}, { locale });
			return typeof text !== 'string' || text === '' || text === key;
		});
		expect(missing).toEqual([]);
	});
});
