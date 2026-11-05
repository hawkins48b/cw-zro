// Pure rules behind audit-check.js: no process, network or file access here.

const BELOW_THRESHOLD = new Set(['info', 'low', 'moderate']);
const GHSA_ID = /^GHSA(-[a-z0-9]{4}){3}$/;
const GHSA_IN_URL = /\/GHSA((?:-[a-z0-9]{4}){3})(?:[/?#]|$)/i;
const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;
const MAX_EXCEPTION_DAYS = 92;
const DAY_MS = 24 * 60 * 60 * 1000;

// Every flag overrides a setting that would shrink the audit without an error,
// from .npmrc, the environment or NODE_ENV: offline sends no request at all, omit
// leaves out dev, optional or peer packages, package-lock=false drops every
// transitive package, and a mirror in registry may answer that nothing is wrong.
export const NPM_AUDIT_ARGS = [
	'audit',
	'--json',
	'--registry=https://registry.npmjs.org/',
	'--offline=false',
	'--package-lock=true',
	'--include=dev',
	'--include=optional',
	'--include=peer'
];

// An unknown severity counts as serious, so that a format change cannot pass.
const isSerious = (severity) => !BELOW_THRESHOLD.has(severity);

const isObject = (value) => typeof value === 'object' && value !== null && !Array.isArray(value);

/** @returns {string|null} the GHSA ID at the end of an advisory URL */
export function advisoryId(url) {
	const match = GHSA_IN_URL.exec(String(url ?? ''));
	return match ? `GHSA${match[1].toLowerCase()}` : null;
}

// npm prints {message, error: {summary: '', detail: ''}} for a registry error and
// {error: {code, summary, detail}} for an error of its own.
function describeErrorOutput(output) {
	const { message, error } = output;
	return message || [error?.code, error?.summary].filter(Boolean).join(': ') || 'no report in the output';
}

/**
 * Tells a report from a failed run by the shape of the output, because npm
 * audit exits 1 both on a finding and on a registry error.
 * @returns {{report: object}|{error: string}}
 */
export function parseAuditOutput(stdout, exitCode) {
	let output;
	try {
		output = JSON.parse(stdout);
	} catch {
		return { error: 'output is not JSON' };
	}
	if (!isObject(output)) {
		return { error: 'output is not a report' };
	}
	if (!isObject(output.vulnerabilities) || !isObject(output.metadata?.vulnerabilities)) {
		return { error: describeErrorOutput(output) };
	}
	// An emptied lockfile sends no request and exits 0 with an empty report.
	const dependencies = output.metadata.dependencies?.total;
	if (!Number.isInteger(dependencies) || dependencies <= 0) {
		return { error: 'the audit covered no dependencies: check package-lock.json' };
	}
	if (Object.keys(output.vulnerabilities).length === 0) {
		if (exitCode !== 0) {
			return { error: `exit code ${exitCode} with an empty report` };
		}
		if (Object.values(output.metadata.vulnerabilities).some((count) => count !== 0)) {
			return { error: 'the metadata counts findings but the report lists none' };
		}
	}
	return { report: output };
}

/**
 * Runs the audit until it gives a report, one retry per delay.
 * @returns {Promise<{report: object}|{error: string}>}
 */
export async function auditWithRetry({ run, sleep, delays }) {
	for (let attempt = 0; ; attempt++) {
		const { stdout, exitCode } = await run();
		const result = parseAuditOutput(stdout, exitCode);
		if (result.report || attempt === delays.length) {
			return result;
		}
		console.warn(`npm audit attempt ${attempt + 1} failed (${result.error}), retrying.`);
		await sleep(delays[attempt]);
	}
}

/**
 * Validates the exceptions file.
 * @returns {{id: string, reason: string, expires: string}[]}
 * @throws {Error} listing every problem
 */
export function parseExceptions(text) {
	let parsed;
	try {
		parsed = JSON.parse(text);
	} catch (error) {
		throw new Error(`not valid JSON: ${error.message}`);
	}
	if (!Array.isArray(parsed?.exceptions)) {
		throw new Error('expected an object with an "exceptions" array');
	}

	const problems = [];
	const seen = new Set();
	parsed.exceptions.forEach((exception, index) => {
		const where = `exceptions[${index}]`;
		if (!isObject(exception)) {
			problems.push(`${where}: not an object`);
			return;
		}
		const { id, reason, expires } = exception;
		if (typeof id !== 'string' || !GHSA_ID.test(id)) {
			problems.push(`${where}: id must look like GHSA-xxxx-xxxx-xxxx`);
		} else if (seen.has(id)) {
			problems.push(`${where}: ${id} is listed twice`);
		}
		seen.add(id);
		if (typeof reason !== 'string' || reason.trim() === '') {
			problems.push(`${where}: reason is required`);
		}
		if (!isIsoDate(expires)) {
			problems.push(`${where}: expires must be a real date as YYYY-MM-DD`);
		}
	});
	if (problems.length > 0) {
		throw new Error(problems.join('; '));
	}
	return parsed.exceptions;
}

function isIsoDate(value) {
	if (typeof value !== 'string' || !ISO_DATE.test(value)) {
		return false;
	}
	const date = new Date(`${value}T00:00:00Z`);
	return !Number.isNaN(date.getTime()) && date.toISOString().startsWith(value);
}

/**
 * Follows `via` down to the advisories behind a package. Strings in `via` name
 * another package, objects are advisories. `complete` is false when a branch
 * leads nowhere, which could be hiding an advisory.
 */
function collectAdvisories(name, vulnerabilities, seen = new Set()) {
	const advisories = [];
	let complete = true;
	if (seen.has(name)) {
		return { advisories, complete };
	}
	seen.add(name);

	const via = vulnerabilities[name]?.via;
	if (!Array.isArray(via) || via.length === 0) {
		return { advisories, complete: false };
	}
	for (const item of via) {
		if (typeof item === 'string') {
			const deeper = collectAdvisories(item, vulnerabilities, seen);
			advisories.push(...deeper.advisories);
			complete &&= deeper.complete;
		} else if (isObject(item)) {
			advisories.push(item);
		} else {
			complete = false;
		}
	}
	return { advisories, complete };
}

function describeFix(fixAvailable) {
	if (fixAvailable === true) return 'npm audit fix';
	if (fixAvailable === false) return 'no fix available';
	if (isObject(fixAvailable) && fixAvailable.name) {
		const major = fixAvailable.isSemVerMajor ? ' (major)' : '';
		return `${fixAvailable.name}@${fixAvailable.version}${major}`;
	}
	return 'unknown';
}

/**
 * Decides on advisories rather than packages: a package fails on each serious
 * advisory behind it that no live exception covers, so an exception never hides
 * a second advisory on the same package.
 * @param {string} today YYYY-MM-DD; an exception still applies on its expiry date
 * @returns {{findings: object[], accepted: object[], warnings: string[]}}
 */
export function evaluateAudit(report, exceptions, today) {
	const live = new Map();
	const expired = new Map();
	for (const exception of exceptions) {
		(exception.expires >= today ? live : expired).set(exception.id, exception);
	}

	const findings = [];
	const accepted = [];
	const used = new Set();

	for (const [name, entry] of Object.entries(report.vulnerabilities)) {
		const { advisories, complete } = collectAdvisories(name, report.vulnerabilities);
		const fix = describeFix(entry?.fixAvailable);
		const serious = new Map();
		for (const advisory of advisories.filter((item) => isSerious(item.severity))) {
			serious.set(advisory.url ?? advisory.source ?? advisory.title, advisory);
		}

		for (const advisory of serious.values()) {
			const id = advisoryId(advisory.url);
			const finding = {
				package: name,
				severity: advisory.severity ?? 'unknown',
				id,
				source: advisory.source ?? null,
				origin: advisory.name ?? null,
				title: advisory.title ?? null,
				url: advisory.url ?? null,
				fix
			};
			if (live.has(id)) {
				used.add(id);
				accepted.push({ ...finding, exception: live.get(id) });
			} else {
				findings.push({ ...finding, expiredOn: expired.get(id)?.expires ?? null });
			}
		}

		if (isSerious(entry?.severity) && (!complete || serious.size === 0)) {
			findings.push({
				package: name,
				severity: entry?.severity ?? 'unknown',
				id: null,
				source: null,
				origin: null,
				title: 'advisories could not be traced through "via"',
				url: null,
				fix,
				expiredOn: null
			});
		}
	}

	const warnings = [];
	for (const { id } of live.values()) {
		if (!used.has(id)) {
			warnings.push(`${id} matches no high or critical finding: remove the exception.`);
		}
	}
	const latest = new Date(Date.parse(today) + MAX_EXCEPTION_DAYS * DAY_MS).toISOString().slice(0, 10);
	for (const { id, expires } of live.values()) {
		if (expires > latest) {
			warnings.push(`${id} expires on ${expires}, more than ${MAX_EXCEPTION_DAYS} days away.`);
		}
	}
	for (const { id, expires } of expired.values()) {
		warnings.push(`${id} expired on ${expires} and no longer applies.`);
	}
	return { findings, accepted, warnings };
}

/** One line for a finding, an accepted one included. */
export function formatFinding({ package: name, severity, id, source, origin, title, fix, expiredOn }) {
	const advisory = id ?? (source === null ? 'no advisory' : `no GHSA ID, source ${source}`);
	const through = origin && origin !== name ? ` through ${origin}` : '';
	const expiry = expiredOn ? ` [exception expired ${expiredOn}]` : '';
	return `${severity.toUpperCase()} ${name}${through}: ${advisory}: ${title ?? 'no title'}; fix: ${fix}${expiry}`;
}
