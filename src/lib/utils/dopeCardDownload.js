/**
 * What downloadDopeCard did (#123):
 *
 * | Value       | Case                                                              | Page shows       |
 * |-------------|-------------------------------------------------------------------|------------------|
 * | 'saved'     | The card had data and was saved                                   | Nothing          |
 * | 'no-data'   | The generator returned no card: the profile gives no trajectory   | dope_no_result   |
 * | 'failed'    | Generating or saving threw, e.g. the PDF template could not be fetched or loaded | dope_save_failed |
 *
 * @typedef {'saved'|'no-data'|'failed'} DopeCardOutcome
 */

/**
 * Generate a dope card and save it, unless it has no data (#91).
 *
 * The generators return null when the profile gives no trajectory: a value out of its limits, or a
 * zero or load that does not solve. Saving then would give a blank card with no error, so nothing
 * is saved and the page shows dope_no_result. A failure while generating or saving is reported
 * apart (#123), so that a user whose profile is fine is not told to check it.
 *
 * @param {(profile: object) => Promise<object|null>} generate - generateImperialDopeCard or generateMetricDopeCard
 * @param {object} profile
 * @param {(pdfDoc: object) => Promise<void>} save
 * @returns {Promise<DopeCardOutcome>}
 */
export async function downloadDopeCard(generate, profile, save) {
	try {
		const pdfDoc = await generate(profile);
		if (!pdfDoc) return 'no-data';
		await save(pdfDoc);
		return 'saved';
	} catch (e) {
		console.error('Dope card generation failed:', e);
		return 'failed';
	}
}
