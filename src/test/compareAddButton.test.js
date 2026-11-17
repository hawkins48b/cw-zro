import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

// Compare Trajectories has one Add profile button, a link to the Add a profile page on every
// device, and no inline picker (#193). Read from the source: the page needs the browser chart.
const page = readFileSync('src/routes/calculators/compare-trajectories/+page.svelte', 'utf8');
const addPage = readFileSync('src/routes/calculators/compare-trajectories/add/+page.svelte', 'utf8');

describe('Compare Add profile (#193)', () => {
	it('has one button, a link to the Add page', () => {
		expect(page).toContain("const addHref = localizeHref('/calculators/compare-trajectories/add');");
		const snippet = page.slice(page.indexOf('{#snippet addButton()}'), page.indexOf('{/snippet}'));
		expect(snippet.match(/<a\b/g)).toHaveLength(1);
		expect(snippet).toContain('href={addHref}');
		expect(snippet).not.toMatch(/<button\b|lg:hidden|hidden lg:/);
	});

	it('renders it once per screen size: phone in the list row, sm and up in the header', () => {
		const uses = page.match(/\{@render addButton\(\)\}/g);
		expect(uses).toHaveLength(2);
		expect(page).toContain('<div class="max-sm:hidden">{@render addButton()}</div>');
		expect(page).toContain('<div class="sm:hidden">{@render addButton()}</div>');
	});

	it('has no inline picker on the Compare page', () => {
		expect(page).not.toContain('CompareAddPicker');
		expect(page).not.toContain('addOpen');
	});

	it('gives the Add page a way back to Compare on desktop', () => {
		expect(addPage).toContain("const compareHref = localizeHref('/calculators/compare-trajectories');");
		expect(addPage).toMatch(/<a\s+href=\{compareHref\}\s+class="hidden lg:inline-flex/);
		expect(addPage).toContain('<CompareAddPicker onadded={() => goto(compareHref)} />');
	});
});
