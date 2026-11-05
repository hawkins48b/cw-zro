// CI gate on npm audit. See "Dependency Updates" in README.md.
// Exit codes: 0 passed, 1 unaccepted high or critical finding, 2 could not decide.
import { spawnSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { setTimeout as sleep } from 'node:timers/promises';
import {
	NPM_AUDIT_ARGS,
	auditWithRetry,
	evaluateAudit,
	formatFinding,
	parseExceptions
} from './audit-rules.js';

const PASSED = 0;
const FAILED = 1;
const UNDECIDED = 2;
const EXCEPTIONS_FILE = '.github/audit-exceptions.json';
const RETRY_DELAYS_MS = [5000, 15000, 30000];

function runNpmAudit() {
	const { stdout, status } = spawnSync('npm', NPM_AUDIT_ARGS, {
		encoding: 'utf8',
		maxBuffer: 64 * 1024 * 1024,
		stdio: ['ignore', 'pipe', 'inherit'],
		timeout: 120000
	});
	return { stdout: stdout ?? '', exitCode: status };
}

async function main() {
	let exceptions;
	try {
		exceptions = parseExceptions(readFileSync(EXCEPTIONS_FILE, 'utf8'));
	} catch (error) {
		console.error(`AUDIT NOT DECIDED: ${EXCEPTIONS_FILE} is invalid: ${error.message}`);
		return UNDECIDED;
	}

	const { report, error } = await auditWithRetry({
		run: runNpmAudit,
		sleep,
		delays: RETRY_DELAYS_MS
	});
	if (!report) {
		console.error(`AUDIT COULD NOT RUN after ${RETRY_DELAYS_MS.length + 1} attempts: ${error}`);
		console.error('This is not a finding: the state of the dependencies is unknown.');
		console.error('Fix the cause above, or rerun the job when the registry is back.');
		return UNDECIDED;
	}

	const today = new Date().toISOString().slice(0, 10);
	const { findings, accepted, warnings } = evaluateAudit(report, exceptions, today);
	const { critical, high, moderate, low } = report.metadata.vulnerabilities;
	console.log(`npm audit: ${critical} critical, ${high} high, ${moderate} moderate, ${low} low.`);

	for (const finding of accepted) {
		const { reason, expires } = finding.exception;
		console.log(`Accepted until ${expires}: ${formatFinding(finding)} (${reason})`);
	}
	for (const warning of warnings) {
		console.warn(`Warning: ${warning}`);
	}
	if (findings.length > 0) {
		console.error(`AUDIT FAILED: ${findings.length} high or critical finding(s) not accepted:`);
		for (const finding of findings) {
			console.error(`  ${formatFinding(finding)}`);
		}
		console.error('To accept one for a limited time, see "Accepting an exception" in README.md.');
		return FAILED;
	}
	console.log('Audit passed.');
	return PASSED;
}

// An uncaught error would exit 1, the code of a finding.
main().then(
	(code) => {
		process.exitCode = code;
	},
	(error) => {
		console.error(`AUDIT NOT DECIDED: the check crashed: ${error.stack}`);
		process.exitCode = UNDECIDED;
	}
);
