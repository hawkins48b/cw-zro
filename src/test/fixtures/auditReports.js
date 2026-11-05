// Shapes copied from real `npm audit --json` output of npm 10.9.9, trimmed to the
// fields the audit check reads.

export const GHSA_LODASH_HIGH = 'GHSA-35jh-r3h4-6jhm';
export const GHSA_LODASH_CRITICAL = 'GHSA-jf85-cpcp-j695';
export const GHSA_MINIMIST_CRITICAL = 'GHSA-xvch-5gv4-984h';

export function advisory(name, source, severity, id) {
	return {
		source,
		name,
		dependency: name,
		title: `Advisory ${source} in ${name}`,
		url: `https://github.com/advisories/${id}`,
		severity,
		range: '<1.0.0'
	};
}

export function report(vulnerabilities) {
	const counts = { info: 0, low: 0, moderate: 0, high: 0, critical: 0 };
	for (const { severity } of Object.values(vulnerabilities)) {
		counts[severity] = (counts[severity] ?? 0) + 1;
	}
	const total = Object.keys(vulnerabilities).length;
	return {
		auditReportVersion: 2,
		vulnerabilities,
		metadata: { vulnerabilities: { ...counts, total }, dependencies: { total: 617 } }
	};
}

export function entry(name, severity, via, fixAvailable = true) {
	return { name, severity, isDirect: false, via, effects: [], fixAvailable };
}

export const clean = report({});

export const moderateOnly = report({
	minimatch: entry('minimatch', 'moderate', [
		advisory('minimatch', 1113465, 'moderate', 'GHSA-3ppc-4f35-3m26')
	]),
	'@electron/universal': entry('@electron/universal', 'moderate', ['minimatch'], {
		name: 'electron-builder',
		version: '24.13.3',
		isSemVerMajor: true
	})
});

export const high = report({
	lodash: entry('lodash', 'high', [advisory('lodash', 1106913, 'high', GHSA_LODASH_HIGH)], {
		name: 'lodash',
		version: '4.18.1',
		isSemVerMajor: false
	})
});

export const critical = report({
	lodash: entry('lodash', 'critical', [
		advisory('lodash', 1106918, 'critical', GHSA_LODASH_CRITICAL)
	])
});

// One package, two serious advisories and a moderate one.
export const twoAdvisories = report({
	lodash: entry('lodash', 'critical', [
		advisory('lodash', 1106900, 'moderate', 'GHSA-fvqr-27wr-82fm'),
		advisory('lodash', 1106913, 'high', GHSA_LODASH_HIGH),
		advisory('lodash', 1106918, 'critical', GHSA_LODASH_CRITICAL)
	])
});

// mkdirp only names minimist, whose entry holds the advisories.
export const transitive = report({
	minimist: entry('minimist', 'critical', [
		advisory('minimist', 1096466, 'moderate', 'GHSA-vh95-rmgr-6w4m'),
		advisory('minimist', 1097677, 'critical', GHSA_MINIMIST_CRITICAL)
	]),
	mkdirp: entry('mkdirp', 'critical', ['minimist'], {
		name: 'mkdirp',
		version: '0.5.6',
		isSemVerMajor: false
	})
});

// Real output of npm 10.9.9 when both audit endpoints answer 400. The empty error
// object is part of it.
export const registryError = {
	message: '400 Bad Request - POST https://registry.npmjs.org/-/npm/v1/security/audits/quick',
	method: 'POST',
	uri: 'https://registry.npmjs.org/-/npm/v1/security/audits/quick',
	headers: { 'x-fetch-attempts': ['1'] },
	statusCode: 400,
	body: { error: 'Bad Request' },
	error: { summary: '', detail: '' }
};

// Real output when the registry cannot be reached.
export const connectionError = {
	message: 'request to https://registry.npmjs.org/-/npm/v1/security/audits/quick failed',
	error: { summary: '', detail: '' }
};

// What npm prints for an error of its own, such as a missing lockfile.
export const npmError = {
	error: { code: 'ENOLOCK', summary: 'This command requires an existing lockfile.', detail: '' }
};

// An error with nothing to say must still count as an error.
export const silentError = { error: { summary: '', detail: '' } };
