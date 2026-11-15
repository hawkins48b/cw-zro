// Throwaway probe for #68: fails on purpose. Never merge.
import { expect, test } from 'vitest';
test('probe #68: a failing test must fail PR CI', () => {
	expect(1).toBe(2);
});
