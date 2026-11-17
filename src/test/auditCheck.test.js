import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
	NPM_AUDIT_ARGS,
	advisoryId,
	auditWithRetry,
	evaluateAudit,
	formatFinding,
	parseAuditOutput,
	parseExceptions
} from '../../scripts/audit-rules.js';
import {
	GHSA_LODASH_CRITICAL,
	GHSA_LODASH_HIGH,
	GHSA_MINIMIST_CRITICAL,
	advisory,
	clean,
	connectionError,
	critical,
	entry,
	high,
	moderateOnly,
	npmError,
	registryError,
	report,
	silentError,
	transitive,
	twoAdvisories
} from './fixtures/auditReports.js';

const TODAY = '2026-11-05';
const exception = (id, expires = '2026-12-31') => ({ id, reason: 'No fix yet', expires });
const ids = (items) => items.map((item) => item.id);

describe('NPM_AUDIT_ARGS', () => {
	it('overrides every setting that would shrink the audit', () => {
		expect(NPM_AUDIT_ARGS).toEqual([
			'audit',
			'--json',
			'--registry=https://registry.npmjs.org/',
			'--offline=false',
			'--package-lock=true',
			'--include=dev',
			'--include=optional',
			'--include=peer'
		]);
	});
});

describe('advisoryId', () => {
	it.each([
		['https://github.com/advisories/GHSA-35jh-r3h4-6jhm', 'GHSA-35jh-r3h4-6jhm'],
		['https://github.com/advisories/GHSA-35JH-R3H4-6JHM', 'GHSA-35jh-r3h4-6jhm'],
		['https://github.com/advisories/GHSA-35jh-r3h4-6jhm/', 'GHSA-35jh-r3h4-6jhm'],
		['https://github.com/advisories/GHSA-35jh-r3h4-6jhm?x=1', 'GHSA-35jh-r3h4-6jhm']
	])('reads %s', (url, id) => {
		expect(advisoryId(url)).toBe(id);
	});

	it.each([
		'https://npmjs.com/advisories/1234',
		'https://github.com/advisories/GHSA-35jh-r3h4-6jhm-extra',
		'',
		undefined,
		null
	])('finds nothing in %s', (url) => {
		expect(advisoryId(url)).toBeNull();
	});
});

describe('parseAuditOutput', () => {
	it('accepts a clean report with exit 0', () => {
		expect(parseAuditOutput(JSON.stringify(clean), 0).report).toEqual(clean);
	});

	it('accepts a report with findings with exit 1, the exit code of a finding', () => {
		expect(parseAuditOutput(JSON.stringify(high), 1).report).toEqual(high);
	});

	it('reads a registry error from its shape, not its exit code', () => {
		const result = parseAuditOutput(JSON.stringify(registryError), 1);
		expect(result.report).toBeUndefined();
		expect(result.error).toContain('400 Bad Request');
	});

	it('does not trust exit 0 on a registry error', () => {
		expect(parseAuditOutput(JSON.stringify(registryError), 0).error).toContain('400');
	});

	it('reports an error of npm itself', () => {
		expect(parseAuditOutput(JSON.stringify(npmError), 1).error).toContain('ENOLOCK');
	});

	it('reports a connection error', () => {
		expect(parseAuditOutput(JSON.stringify(connectionError), 1).error).toContain('failed');
	});

	it('never gives an empty error, which the caller could read as no error', () => {
		expect(parseAuditOutput(JSON.stringify(silentError), 1).error).toBe('no report in the output');
	});

	it.each([
		['empty output', ''],
		['text', 'npm error network'],
		['cut off JSON', '{"auditReportVersion":2,"vulnera'],
		['null', 'null'],
		['an array', '[]'],
		['an object without a report', '{}'],
		['no metadata', '{"vulnerabilities":{}}'],
		['no vulnerabilities', '{"metadata":{"vulnerabilities":{}}}']
	])('rejects %s', (_, stdout) => {
		expect(parseAuditOutput(stdout, 1).error).toEqual(expect.any(String));
	});

	it.each([
		['zero', { total: 0 }],
		['missing', {}],
		['not a number', { total: '617' }],
		['negative', { total: -1 }]
	])('rejects a report whose dependency total is %s', (_, dependencies) => {
		const empty = { ...clean, metadata: { ...clean.metadata, dependencies } };
		expect(parseAuditOutput(JSON.stringify(empty), 0).error).toContain('no dependencies');
	});

	it('rejects a report without a dependency count', () => {
		const { vulnerabilities } = clean.metadata;
		const empty = { ...clean, metadata: { vulnerabilities } };
		expect(parseAuditOutput(JSON.stringify(empty), 0).error).toContain('no dependencies');
	});

	it('rejects an empty report whose metadata counts findings', () => {
		const vulnerabilities = { ...clean.metadata.vulnerabilities, high: 1, total: 1 };
		const odd = { ...clean, metadata: { ...clean.metadata, vulnerabilities } };
		expect(parseAuditOutput(JSON.stringify(odd), 0).error).toContain('lists none');
	});

	it('rejects a failed exit with an empty report', () => {
		expect(parseAuditOutput(JSON.stringify(clean), 1).error).toContain('empty report');
		expect(parseAuditOutput(JSON.stringify(clean), null).error).toContain('empty report');
	});
});

describe('auditWithRetry', () => {
	const failed = { stdout: JSON.stringify(registryError), exitCode: 1 };
	const passed = { stdout: JSON.stringify(clean), exitCode: 0 };
	const finding = { stdout: JSON.stringify(high), exitCode: 1 };

	beforeEach(() => {
		vi.spyOn(console, 'warn').mockImplementation(() => {});
	});

	afterEach(() => {
		vi.restoreAllMocks();
	});

	function setup(...runs) {
		const run = vi.fn();
		runs.forEach((result) => run.mockReturnValueOnce(result));
		return { run, sleep: vi.fn().mockResolvedValue(), delays: [1, 2, 3] };
	}

	it('does not retry a report', async () => {
		const options = setup(passed);
		expect((await auditWithRetry(options)).report).toEqual(clean);
		expect(options.run).toHaveBeenCalledTimes(1);
		expect(options.sleep).not.toHaveBeenCalled();
	});

	it('does not retry a finding', async () => {
		const options = setup(finding);
		expect((await auditWithRetry(options)).report).toEqual(high);
		expect(options.run).toHaveBeenCalledTimes(1);
	});

	it('retries a registry error and uses the next report', async () => {
		const options = setup(failed, failed, finding);
		expect((await auditWithRetry(options)).report).toEqual(high);
		expect(options.run).toHaveBeenCalledTimes(3);
		expect(options.sleep.mock.calls).toEqual([[1], [2]]);
	});

	it('gives up with an error after the last delay', async () => {
		const options = setup(failed, failed, failed, failed);
		const result = await auditWithRetry(options);
		expect(result.report).toBeUndefined();
		expect(result.error).toContain('400 Bad Request');
		expect(options.run).toHaveBeenCalledTimes(4);
	});
});

describe('parseExceptions', () => {
	const file = (...exceptions) => JSON.stringify({ exceptions });

	it('accepts an empty list', () => {
		expect(parseExceptions(file())).toEqual([]);
	});

	it('accepts a complete exception', () => {
		const item = exception(GHSA_LODASH_HIGH);
		expect(parseExceptions(file(item))).toEqual([item]);
	});

	it.each([
		['invalid JSON', '{'],
		['a bare array', '[]'],
		['null', 'null'],
		['no exceptions key', '{}'],
		['exceptions not a list', '{"exceptions":{}}'],
		['an entry that is not an object', file('GHSA-35jh-r3h4-6jhm')],
		['a missing id', file({ reason: 'x', expires: '2026-12-31' })],
		['a CVE id', file(exception('CVE-2021-23337'))],
		['an upper case id', file(exception('GHSA-35JH-R3H4-6JHM'))],
		['a missing reason', file({ id: GHSA_LODASH_HIGH, expires: '2026-12-31' })],
		['a blank reason', file({ id: GHSA_LODASH_HIGH, reason: '  ', expires: '2026-12-31' })],
		['a missing expiry', file({ id: GHSA_LODASH_HIGH, reason: 'x' })],
		['a numeric expiry', file(exception(GHSA_LODASH_HIGH, 20261231))],
		['another date format', file(exception(GHSA_LODASH_HIGH, '31.12.2026'))],
		['a date that does not exist', file(exception(GHSA_LODASH_HIGH, '2026-02-31'))],
		['a duplicate', file(exception(GHSA_LODASH_HIGH), exception(GHSA_LODASH_HIGH, '2027-01-01'))]
	])('rejects %s', (_, text) => {
		expect(() => parseExceptions(text)).toThrow();
	});

	it('lists every problem at once', () => {
		const text = file({ id: 'x', expires: 'y' });
		expect(() => parseExceptions(text)).toThrow(/id must.*reason is required.*expires must/);
	});
});

describe('evaluateAudit', () => {
	it('passes a clean report', () => {
		expect(evaluateAudit(clean, [], TODAY)).toEqual({ findings: [], accepted: [], warnings: [] });
	});

	it('passes moderate findings, direct and through via', () => {
		expect(evaluateAudit(moderateOnly, [], TODAY).findings).toEqual([]);
	});

	it('fails on a high finding with package, severity, ID and fix', () => {
		const { findings } = evaluateAudit(high, [], TODAY);
		expect(findings).toHaveLength(1);
		expect(findings[0]).toMatchObject({
			package: 'lodash',
			severity: 'high',
			id: GHSA_LODASH_HIGH,
			fix: 'lodash@4.18.1'
		});
	});

	it('fails on a critical finding', () => {
		expect(ids(evaluateAudit(critical, [], TODAY).findings)).toEqual([GHSA_LODASH_CRITICAL]);
	});

	it('accepts an excepted finding', () => {
		const result = evaluateAudit(high, [exception(GHSA_LODASH_HIGH)], TODAY);
		expect(result.findings).toEqual([]);
		expect(ids(result.accepted)).toEqual([GHSA_LODASH_HIGH]);
		expect(result.warnings).toEqual([]);
	});

	it('still applies an exception on its expiry date', () => {
		expect(evaluateAudit(high, [exception(GHSA_LODASH_HIGH, TODAY)], TODAY).findings).toEqual([]);
	});

	it('stops applying an exception the day after it expires', () => {
		const result = evaluateAudit(high, [exception(GHSA_LODASH_HIGH, '2026-11-04')], TODAY);
		expect(ids(result.findings)).toEqual([GHSA_LODASH_HIGH]);
		expect(result.findings[0].expiredOn).toBe('2026-11-04');
		expect(result.accepted).toEqual([]);
		expect(result.warnings[0]).toContain('expired on 2026-11-04');
	});

	it('warns about an exception that matches nothing, without failing', () => {
		const result = evaluateAudit(clean, [exception(GHSA_LODASH_HIGH)], TODAY);
		expect(result.findings).toEqual([]);
		expect(result.warnings).toHaveLength(1);
		expect(result.warnings[0]).toContain(GHSA_LODASH_HIGH);
	});

	it('warns about an exception for an advisory that is only moderate', () => {
		const result = evaluateAudit(moderateOnly, [exception('GHSA-3ppc-4f35-3m26')], TODAY);
		expect(result.warnings[0]).toContain('GHSA-3ppc-4f35-3m26');
	});

	it('accepts an exception 92 days away without a warning', () => {
		const result = evaluateAudit(high, [exception(GHSA_LODASH_HIGH, '2027-02-05')], TODAY);
		expect(result.warnings).toEqual([]);
	});

	it('warns about an exception 93 days away, without failing', () => {
		const result = evaluateAudit(high, [exception(GHSA_LODASH_HIGH, '2027-02-06')], TODAY);
		expect(result.findings).toEqual([]);
		expect(ids(result.accepted)).toEqual([GHSA_LODASH_HIGH]);
		expect(result.warnings).toHaveLength(1);
		expect(result.warnings[0]).toContain('more than 92 days');
	});

	it('does not let one exception hide a second advisory on the package', () => {
		const result = evaluateAudit(twoAdvisories, [exception(GHSA_LODASH_HIGH)], TODAY);
		expect(ids(result.findings)).toEqual([GHSA_LODASH_CRITICAL]);
		expect(ids(result.accepted)).toEqual([GHSA_LODASH_HIGH]);
	});

	it('passes a package once each serious advisory is excepted, whatever its overall severity', () => {
		const exceptions = [exception(GHSA_LODASH_HIGH), exception(GHSA_LODASH_CRITICAL)];
		expect(evaluateAudit(twoAdvisories, exceptions, TODAY).findings).toEqual([]);
	});

	it('follows a via string to the root advisory', () => {
		const { findings } = evaluateAudit(transitive, [], TODAY);
		expect(findings.map((finding) => [finding.package, finding.id])).toEqual([
			['minimist', GHSA_MINIMIST_CRITICAL],
			['mkdirp', GHSA_MINIMIST_CRITICAL]
		]);
		expect(findings[1].origin).toBe('minimist');
	});

	it('clears a transitive package when its root advisory is excepted', () => {
		const result = evaluateAudit(transitive, [exception(GHSA_MINIMIST_CRITICAL)], TODAY);
		expect(result.findings).toEqual([]);
		expect(result.warnings).toEqual([]);
	});

	it('follows a chain of several via strings', () => {
		const chain = report({
			...transitive.vulnerabilities,
			top: entry('top', 'critical', ['mkdirp'])
		});
		const { findings } = evaluateAudit(chain, [], TODAY);
		expect(findings.find((finding) => finding.package === 'top').id).toBe(GHSA_MINIMIST_CRITICAL);
	});

	it('keeps a transitive package failing when only one of its roots is excepted', () => {
		const both = report({
			...high.vulnerabilities,
			...transitive.vulnerabilities,
			parent: entry('parent', 'critical', ['lodash', 'minimist'])
		});
		const { findings } = evaluateAudit(both, [exception(GHSA_MINIMIST_CRITICAL)], TODAY);
		expect(findings.map((finding) => [finding.package, finding.id])).toEqual([
			['lodash', GHSA_LODASH_HIGH],
			['parent', GHSA_LODASH_HIGH]
		]);
	});

	it('counts an advisory reached along two paths once', () => {
		const diamond = report({
			...transitive.vulnerabilities,
			left: entry('left', 'critical', ['minimist']),
			right: entry('right', 'critical', ['minimist']),
			top: entry('top', 'critical', ['left', 'right'])
		});
		const { findings } = evaluateAudit(diamond, [], TODAY);
		expect(findings.filter((finding) => finding.package === 'top')).toHaveLength(1);
	});

	it('fails a high package whose via leads to a package missing from the report', () => {
		const broken = report({ orphan: entry('orphan', 'high', ['gone']) });
		const { findings } = evaluateAudit(broken, [], TODAY);
		expect(findings).toHaveLength(1);
		expect(findings[0]).toMatchObject({ package: 'orphan', id: null });
	});

	it('fails when an exception covers one via branch and another leads nowhere', () => {
		const broken = report({
			...high.vulnerabilities,
			parent: entry('parent', 'high', ['lodash', 'gone'])
		});
		const { findings } = evaluateAudit(broken, [exception(GHSA_LODASH_HIGH)], TODAY);
		expect(findings.map((finding) => finding.package)).toEqual(['parent']);
	});

	it('fails a high package in a via cycle with no advisory, without hanging', () => {
		const cycle = report({
			a: entry('a', 'high', ['b']),
			b: entry('b', 'high', ['a'])
		});
		expect(evaluateAudit(cycle, [], TODAY).findings).toHaveLength(2);
	});

	it('fails a high package whose advisories are all below high', () => {
		const odd = report({
			a: entry('a', 'high', [advisory('a', 1, 'moderate', 'GHSA-aaaa-bbbb-cccc')])
		});
		expect(evaluateAudit(odd, [], TODAY).findings).toHaveLength(1);
	});

	it.each([[null], [undefined], ['severe']])('treats advisory severity %s as serious', (severity) => {
		const odd = report({
			a: entry('a', 'moderate', [advisory('a', 1, severity, 'GHSA-aaaa-bbbb-cccc')])
		});
		const { findings } = evaluateAudit(odd, [], TODAY);
		expect(findings).toHaveLength(1);
		expect(() => formatFinding(findings[0])).not.toThrow();
	});

	it('fails an advisory without a GHSA ID, which no exception can match', () => {
		const npmOnly = report({
			a: entry('a', 'high', [
				{ source: 42, name: 'a', severity: 'high', url: 'https://npmjs.com/advisories/42' }
			])
		});
		const { findings } = evaluateAudit(npmOnly, [exception(GHSA_LODASH_HIGH)], TODAY);
		expect(findings).toHaveLength(1);
		expect(formatFinding(findings[0])).toContain('no GHSA ID, source 42');
	});
});

describe('formatFinding', () => {
	it('prints package, severity, advisory and fix', () => {
		const [finding] = evaluateAudit(high, [], TODAY).findings;
		const line = formatFinding(finding);
		for (const part of ['HIGH', 'lodash', GHSA_LODASH_HIGH, 'lodash@4.18.1']) {
			expect(line).toContain(part);
		}
	});

	it('names the root package of a transitive finding', () => {
		const { findings } = evaluateAudit(transitive, [], TODAY);
		expect(formatFinding(findings[1])).toContain('mkdirp through minimist');
	});

	it('marks a major fix and a missing one', () => {
		const major = { name: 'electron-builder', version: '24.13.3', isSemVerMajor: true };
		const withFix = (fix) =>
			report({ a: entry('a', 'high', [advisory('a', 1, 'high', GHSA_LODASH_HIGH)], fix) });
		const line = (fix) => formatFinding(evaluateAudit(withFix(fix), [], TODAY).findings[0]);
		expect(line(major)).toContain('electron-builder@24.13.3 (major)');
		expect(line(false)).toContain('no fix available');
		expect(line(true)).toContain('npm audit fix');
		expect(line({ isSemVerMajor: true })).toContain('fix: unknown');
	});
});
