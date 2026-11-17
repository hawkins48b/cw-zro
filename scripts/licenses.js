/**
 * Writes src/lib/data/licenses.json, the packages the app ships with their licences (#166), from
 * package.json and package-lock.json (and the installed package.json files, for the web address).
 * No network. Run it after every dependency update: `npm run licenses:generate`. With --check it
 * writes nothing and exits 1 when the file is out of date. The rules are in license-rules.js.
 */
import { readFileSync, writeFileSync } from 'fs';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';
import { buildLicenses, formatLicenses } from './license-rules.js';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const OUTPUT = join(root, 'src/lib/data/licenses.json');

const readJson = (path) => JSON.parse(readFileSync(path, 'utf-8'));

function readManifest(lockPath) {
	try {
		return readJson(join(root, lockPath, 'package.json'));
	} catch {
		return null;
	}
}

const text = formatLicenses(
	buildLicenses({ lock: readJson(join(root, 'package-lock.json')), pkg: readJson(join(root, 'package.json')), readManifest })
);

if (process.argv.includes('--check')) {
	let current = '';
	try {
		current = readFileSync(OUTPUT, 'utf-8');
	} catch {
		// missing: out of date
	}
	if (current !== text) {
		console.error('src/lib/data/licenses.json is out of date with package-lock.json: run npm run licenses:generate');
		process.exitCode = 1;
	} else {
		console.log('src/lib/data/licenses.json is up to date.');
	}
} else {
	writeFileSync(OUTPUT, text);
	console.log(`Wrote ${JSON.parse(text).length} packages to src/lib/data/licenses.json.`);
}
