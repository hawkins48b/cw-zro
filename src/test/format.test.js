import { describe, it, expect } from 'vitest';
import { formatLimit } from '#lib/utils/format.js';

describe('formatLimit', () => {
	it('writes a limit without thousands grouping, so it reads back as typed', () => {
		expect(formatLimit(3000)).toBe('3000');
		expect(formatLimit(25.4)).toBe('25.4');
		expect(formatLimit(-130)).toBe('-130');
		expect(formatLimit(0.01)).toBe('0.01');
	});
});
