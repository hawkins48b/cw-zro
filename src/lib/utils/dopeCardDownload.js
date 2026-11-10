/**
 * Generate a dope card and save it, unless it has no data (#91).
 *
 * The generators return null when the profile gives no trajectory: a value out of its limits, or a
 * zero or load that does not solve. Saving then would give a blank card with no error, so nothing
 * is saved and the page shows dope_no_result. A failure while generating or saving counts the same.
 *
 * @param {(profile: object) => Promise<object|null>} generate - generateImperialDopeCard or generateMetricDopeCard
 * @param {object} profile
 * @param {(pdfDoc: object) => Promise<void>} save
 * @returns {Promise<boolean>} true when a card was saved
 */
export async function downloadDopeCard(generate, profile, save) {
	try {
		const pdfDoc = await generate(profile);
		if (!pdfDoc) return false;
		await save(pdfDoc);
		return true;
	} catch (e) {
		console.error('Dope card generation failed:', e);
		return false;
	}
}
